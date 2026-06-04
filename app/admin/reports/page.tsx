import { AdminShell } from "../AdminShell";

export default function AdminReportsPage() {
  return (
    <AdminShell
      title="Reports"
      description="Track generated PDF reports and queue status."
    >
      <section className="panel">
        <p className="muted">PDF generation is deferred until the Playwright worker phase.</p>
      </section>
    </AdminShell>
  );
}
