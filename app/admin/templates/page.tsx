import { AdminShell } from "../AdminShell";

export default function AdminTemplatesPage() {
  return (
    <AdminShell
      title="Templates"
      description="Review active checklist templates and versions."
    >
      <section className="panel">
        <p className="muted">Template publishing controls are intentionally deferred beyond this foundation pass.</p>
      </section>
    </AdminShell>
  );
}
