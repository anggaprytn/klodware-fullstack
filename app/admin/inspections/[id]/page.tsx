import Link from "next/link";
import { revalidatePath } from "next/cache";
import { AdminShell } from "../../AdminShell";
import { requireAdminSession } from "@/lib/auth";
import {
  findPdfReport,
  getInspectionOrThrow,
  getTemplateForInspection,
  inspectionPhotos,
  toMobileInspectionDetail,
} from "@/lib/inspections";
import { getSuperuserPocketBase } from "@/lib/pocketbase";
import { canGeneratePdfDownloadToken } from "@/lib/pdf/pdf-token";
import { buildPdfDownloadUrl } from "@/lib/pdf/report-access";
import { requestPdfRegeneration } from "@/lib/pdf/report-lifecycle";
import type { PdfReportRecord, SyncEventRecord } from "@/lib/types";

function signedDownloadHref(report: PdfReportRecord | null) {
  if (
    !report ||
    !canGeneratePdfDownloadToken() ||
    report.status !== "ready" ||
    !report.file
  ) {
    return null;
  }

  return buildPdfDownloadUrl({
    inspectionId: report.inspection,
    pdfReportId: report.id,
  }).url;
}

async function regeneratePdfAction(formData: FormData) {
  "use server";

  const session = await requireAdminSession();
  const inspectionId = String(formData.get("inspection_id") ?? "");
  const pb = await getSuperuserPocketBase();
  const inspection = await getInspectionOrThrow(pb, inspectionId);
  await requestPdfRegeneration({
    pb,
    inspection,
    userId: session.user.id,
    deviceId: inspection.device_id,
  });
  revalidatePath("/admin/reports");
  revalidatePath(`/admin/inspections/${inspectionId}`);
}

export default async function AdminInspectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminSession();
  const { id } = await params;
  const pb = await getSuperuserPocketBase();
  const inspection = await getInspectionOrThrow(pb, id);
  const [template, photos, rawEvents, pdfReport] = await Promise.all([
    getTemplateForInspection(pb, inspection),
    inspectionPhotos(pb, inspection.id),
    pb.collection("sync_events").getList<SyncEventRecord>(1, 80, {
      filter: pb.filter("user = {:userId}", { userId: inspection.user }),
      sort: "-occurred_at",
    }),
    findPdfReport(pb, inspection.id),
  ]);
  const detail = toMobileInspectionDetail({ inspection, template, photos });
  const events = rawEvents.items.filter((event) => {
    const payload = event.payload_json as Record<string, unknown> | null;
    return (
      payload?.inspection_id === inspection.id ||
      payload?.local_id === inspection.local_id ||
      event.device_id === inspection.device_id
    );
  });
  const summary = detail.summary as
    | {
        total_items?: number;
        completed_items?: number;
        findings_count?: number;
        drydock_count?: number;
        missing_score_count?: number;
        missing_required_remarks_count?: number;
        missing_required_photo_count?: number;
        section_summaries?: Array<{
          code: string;
          name: string;
          total_items: number;
          completed_items: number;
          findings_count: number;
        }>;
      }
    | null;
  const downloadHref = signedDownloadHref(pdfReport);

  return (
    <AdminShell
      title="Inspection Detail"
      description="Read-only review of synced inspection payload, evidence, and sync diagnostics."
    >
      <div className="admin-grid">
        <section className="panel">
          <Link href="/admin/inspections">Back to inspections</Link>
          <dl className="detail-list">
            <div>
              <dt>Inspection</dt>
              <dd className="checksum">{inspection.id}</dd>
            </div>
            <div>
              <dt>Vessel</dt>
              <dd>{detail.vessel?.name ?? inspection.vessel}</dd>
            </div>
            <div>
              <dt>Inspector</dt>
              <dd>{inspection.inspector_name}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>
                {inspection.status} / PDF {inspection.pdf_status}
              </dd>
            </div>
            <div>
              <dt>Template</dt>
              <dd>
                {template.name} v{template.version}
              </dd>
            </div>
          </dl>
        </section>

        <section className="panel">
          <h2>PDF Report</h2>
          <dl className="detail-list">
            <div>
              <dt>Inspection PDF Status</dt>
              <dd>{inspection.pdf_status}</dd>
            </div>
            <div>
              <dt>Report Status</dt>
              <dd>{pdfReport?.status ?? "not_requested"}</dd>
            </div>
            <div>
              <dt>Report</dt>
              <dd className="checksum">{pdfReport?.id ?? ""}</dd>
            </div>
            <div>
              <dt>File Size</dt>
              <dd>{pdfReport?.file_size_bytes ?? 0}</dd>
            </div>
            <div>
              <dt>Generated</dt>
              <dd>{pdfReport?.generated_at ?? ""}</dd>
            </div>
            {pdfReport?.error_message ? (
              <div>
                <dt>PDF Error</dt>
                <dd className="error">{pdfReport.error_message}</dd>
              </div>
            ) : null}
          </dl>
          <div className="row-actions">
            {downloadHref ? (
              <Link className="button secondary" href={downloadHref}>
                Download PDF
              </Link>
            ) : null}
            <form action={regeneratePdfAction}>
              <input name="inspection_id" type="hidden" value={inspection.id} />
              <button className="button" type="submit">
                Regenerate PDF
              </button>
            </form>
          </div>
          {!downloadHref && pdfReport?.status === "ready" ? (
            <p className="muted">
              Set PDF_DOWNLOAD_SECRET to enable signed admin download links.
            </p>
          ) : null}
        </section>

        <section className="metric-grid">
          <div className="panel">
            <span className="metric-value">
              {summary?.completed_items ?? 0}/{summary?.total_items ?? 0}
            </span>
            <p className="muted">Completed items</p>
          </div>
          <div className="panel">
            <span className="metric-value">{summary?.findings_count ?? 0}</span>
            <p className="muted">Findings</p>
          </div>
          <div className="panel">
            <span className="metric-value">{summary?.drydock_count ?? 0}</span>
            <p className="muted">Drydock items</p>
          </div>
          <div className="panel">
            <span className="metric-value">
              {(summary?.missing_score_count ?? 0) +
                (summary?.missing_required_remarks_count ?? 0) +
                (summary?.missing_required_photo_count ?? 0)}
            </span>
            <p className="muted">Open validation items</p>
          </div>
        </section>

        <section className="panel">
          <h2>Checklist Section Summary</h2>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Section</th>
                  <th>Completed</th>
                  <th>Findings</th>
                </tr>
              </thead>
              <tbody>
                {(summary?.section_summaries ?? []).map((section) => (
                  <tr key={section.code}>
                    <td>
                      {section.code} {section.name}
                    </td>
                    <td>
                      {section.completed_items}/{section.total_items}
                    </td>
                    <td>{section.findings_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <h2>Uploaded Photos</h2>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Type</th>
                  <th>Checksum</th>
                  <th>Captured</th>
                  <th>Uploaded</th>
                </tr>
              </thead>
              <tbody>
                {detail.photos.map((photo) => (
                  <tr key={photo.photo_id}>
                    <td>{photo.item_template_id}</td>
                    <td>{photo.photo_type}</td>
                    <td className="checksum">{photo.checksum}</td>
                    <td>{photo.captured_at}</td>
                    <td>{photo.uploaded_at}</td>
                  </tr>
                ))}
                {detail.photos.length === 0 ? (
                  <tr>
                    <td colSpan={5}>No uploaded photos.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <h2>Sync Events</h2>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Event</th>
                  <th>Status</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id}>
                    <td>{event.occurred_at}</td>
                    <td>{event.event_type}</td>
                    <td>{event.status}</td>
                    <td>
                      <pre className="checksum">
                        {event.error_json ? JSON.stringify(event.error_json) : ""}
                      </pre>
                    </td>
                  </tr>
                ))}
                {events.length === 0 ? (
                  <tr>
                    <td colSpan={4}>No sync events found for this inspection.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <h2>Raw Payload Summary</h2>
          <pre className="json-preview">
            {JSON.stringify(detail.raw_payload_json, null, 2)}
          </pre>
        </section>
      </div>
    </AdminShell>
  );
}
