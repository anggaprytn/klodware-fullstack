import Link from "next/link";
import { AdminShell } from "../AdminShell";
import { requireAdminSession } from "@/lib/auth";
import { adminInspectionRow } from "@/lib/inspections";
import { getSuperuserPocketBase } from "@/lib/pocketbase";
import type { InspectionRecord, InspectionStatus, PdfStatus } from "@/lib/types";

const inspectionStatuses = ["draft", "submitted", "locked"] as const;
const pdfStatuses = [
  "not_requested",
  "queued",
  "generating",
  "ready",
  "failed",
] as const;

function stringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminInspectionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminSession();
  const params = await searchParams;
  const status = stringParam(params.status);
  const pdfStatus = stringParam(params.pdf_status);
  const pb = await getSuperuserPocketBase();
  const filters: string[] = [];

  if (inspectionStatuses.includes(status as InspectionStatus)) {
    filters.push(pb.filter("status = {:status}", { status }));
  }

  if (pdfStatuses.includes(pdfStatus as PdfStatus)) {
    filters.push(pb.filter("pdf_status = {:pdfStatus}", { pdfStatus }));
  }

  const inspections = await pb.collection("inspections").getFullList<InspectionRecord>({
    filter: filters.join(" && "),
    expand: "vessel,user",
    sort: "-synced_at",
  });
  const rows = inspections.map(adminInspectionRow);

  return (
    <AdminShell
      title="Inspections"
      description="Review synced mobile inspections and submission state."
    >
      <div className="admin-grid">
        <section className="panel">
          <form className="form form-grid" method="get">
            <label className="field">
              <span>Status</span>
              <select name="status" defaultValue={status ?? ""}>
                <option value="">All</option>
                {inspectionStatuses.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>PDF status</span>
              <select name="pdf_status" defaultValue={pdfStatus ?? ""}>
                <option value="">All</option>
                {pdfStatuses.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <button className="button" type="submit">
              Filter
            </button>
          </form>
        </section>

        <section className="panel">
          <h2>Inspection Records</h2>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Vessel</th>
                  <th>Inspector</th>
                  <th>Status</th>
                  <th>PDF</th>
                  <th>Findings</th>
                  <th>Drydock</th>
                  <th>Progress</th>
                  <th>Synced</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.vessel_name}</td>
                    <td>{row.inspector_name}</td>
                    <td>{row.status}</td>
                    <td>{row.pdf_status}</td>
                    <td>{row.findings_count}</td>
                    <td>{row.drydock_count}</td>
                    <td>
                      {row.completed_items}/{row.total_items}
                    </td>
                    <td>{row.synced_at}</td>
                    <td>
                      <Link className="button secondary" href={`/admin/inspections/${row.id}`}>
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={9}>No inspections found.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
