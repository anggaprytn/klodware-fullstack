import Link from "next/link";
import { revalidatePath } from "next/cache";
import { AdminShell } from "../AdminShell";
import { requireAdminSession } from "@/lib/auth";
import { getInspectionOrThrow } from "@/lib/inspections";
import { getSuperuserPocketBase } from "@/lib/pocketbase";
import { canGeneratePdfDownloadToken } from "@/lib/pdf/pdf-token";
import { buildPdfDownloadUrl } from "@/lib/pdf/report-access";
import { requestPdfRegeneration } from "@/lib/pdf/report-lifecycle";
import type {
  InspectionRecord,
  PdfReportRecord,
  UserRecord,
  VesselRecord,
} from "@/lib/types";

function inspectionFromExpand(report: PdfReportRecord) {
  const expanded = report.expand as Record<string, unknown> | undefined;
  return expanded?.inspection as InspectionRecord | undefined;
}

function vesselFromExpand(inspection?: InspectionRecord) {
  const expanded = inspection?.expand as Record<string, unknown> | undefined;
  return expanded?.vessel as VesselRecord | undefined;
}

function userFromExpand(inspection?: InspectionRecord) {
  const expanded = inspection?.expand as Record<string, unknown> | undefined;
  return expanded?.user as UserRecord | undefined;
}

function signedDownloadHref(report: PdfReportRecord) {
  if (!canGeneratePdfDownloadToken() || report.status !== "ready" || !report.file) {
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

export default async function AdminReportsPage() {
  await requireAdminSession();
  const pb = await getSuperuserPocketBase();
  const reports = await pb.collection("pdf_reports").getFullList<PdfReportRecord>({
    expand: "inspection,inspection.vessel,inspection.user",
    sort: "-generated_at",
  });

  return (
    <AdminShell
      title="Reports"
      description="Review generated PDF reports, failures, and regeneration requests."
    >
      <section className="panel">
        <h2>PDF Report Queue</h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Report</th>
                <th>Status</th>
                <th>Inspection</th>
                <th>Vessel</th>
                <th>Inspector</th>
                <th>Size</th>
                <th>Generated</th>
                <th>Error</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => {
                const inspection = inspectionFromExpand(report);
                const vessel = vesselFromExpand(inspection);
                const user = userFromExpand(inspection);
                const downloadHref = signedDownloadHref(report);
                return (
                  <tr key={report.id}>
                    <td className="checksum">{report.id}</td>
                    <td>{report.status}</td>
                    <td>
                      {inspection ? (
                        <Link href={`/admin/inspections/${inspection.id}`}>
                          {inspection.local_id || inspection.id}
                        </Link>
                      ) : (
                        report.inspection
                      )}
                    </td>
                    <td>{vessel?.name ?? inspection?.vessel ?? ""}</td>
                    <td>{inspection?.inspector_name || user?.full_name || ""}</td>
                    <td>{report.file_size_bytes ?? 0}</td>
                    <td>{report.generated_at ?? ""}</td>
                    <td>{report.error_message ?? ""}</td>
                    <td>
                      <div className="row-actions">
                        {downloadHref ? (
                          <Link className="button secondary" href={downloadHref}>
                            Download
                          </Link>
                        ) : null}
                        {inspection ? (
                          <form action={regeneratePdfAction}>
                            <input
                              name="inspection_id"
                              type="hidden"
                              value={inspection.id}
                            />
                            <button className="button" type="submit">
                              Regenerate
                            </button>
                          </form>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {reports.length === 0 ? (
                <tr>
                  <td colSpan={9}>No PDF report records yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}
