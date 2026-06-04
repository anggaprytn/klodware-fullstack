import { AdminShell } from "../AdminShell";

export default function AdminVesselsPage() {
  return (
    <AdminShell
      title="Vessels"
      description="Manage vessel records used by mobile bootstrap and inspections."
    >
      <section className="panel">
        <p className="muted">Vessel list and editing workflow will be added after the PocketBase schema is seeded.</p>
      </section>
    </AdminShell>
  );
}
