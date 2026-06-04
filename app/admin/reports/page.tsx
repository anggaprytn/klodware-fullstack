import Link from "next/link";
import { AdminShell } from "../AdminShell";
import { requireAdminSession } from "@/lib/auth";
import { getSuperuserPocketBase } from "@/lib/pocketbase";
import type { InspectionRecord, PdfReportRecord } from "@/lib/types";

function inspectionFromExpand(report: PdfReportRecord) {
  const expanded = report.expand as Record<string, unknown> | undefined;
  return expanded?.inspection as InspectionRecord | undefined;
}

export default async function AdminReportsPage() {
  await requireAdminSession();
  const pb = await getSuperuserPocketBase();
  const reports = await pb.collection("pdf_reports").getFullList<PdfReportRecord>({
    expand: "inspection",
    sort: "-generated_at",
  });

  return (
    <AdminShell
      title="Reports"
      description="Track queued PDF report records. Generation is scheduled for Phase 2C."
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
                <th>Generated</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => {
                const inspection = inspectionFromExpand(report);
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
                    <td>{report.generated_at ?? ""}</td>
                    <td>{report.error_message ?? ""}</td>
                  </tr>
                );
              })}
              {reports.length === 0 ? (
                <tr>
                  <td colSpan={5}>No PDF report records yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}
