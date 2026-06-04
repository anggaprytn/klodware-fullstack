import { AdminShell } from "../AdminShell";

export default function AdminInspectionsPage() {
  return (
    <AdminShell
      title="Inspections"
      description="Monitor submitted and draft inspection records."
    >
      <section className="panel">
        <p className="muted">Inspection list, owner filters, and detail views will follow the sync/upsert implementation.</p>
      </section>
    </AdminShell>
  );
}
