import Link from "next/link";
import { AdminShell } from "../../AdminShell";
import { requireAdminSession } from "@/lib/auth";
import {
  getInspectionOrThrow,
  getTemplateForInspection,
  inspectionPhotos,
  toMobileInspectionDetail,
} from "@/lib/inspections";
import { getSuperuserPocketBase } from "@/lib/pocketbase";
import type { SyncEventRecord } from "@/lib/types";

export default async function AdminInspectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminSession();
  const { id } = await params;
  const pb = await getSuperuserPocketBase();
  const inspection = await getInspectionOrThrow(pb, id);
  const [template, photos, rawEvents] = await Promise.all([
    getTemplateForInspection(pb, inspection),
    inspectionPhotos(pb, inspection.id),
    pb.collection("sync_events").getList<SyncEventRecord>(1, 80, {
      filter: pb.filter("user = {:userId}", { userId: inspection.user }),
      sort: "-occurred_at",
    }),
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
