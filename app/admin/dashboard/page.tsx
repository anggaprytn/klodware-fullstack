import { AdminShell } from "../AdminShell";
import { getAdminStats, requireAdminSession } from "@/lib/auth";

export default async function AdminDashboardPage() {
  const session = await requireAdminSession();
  const stats = await getAdminStats(session.pb);

  return (
    <AdminShell
      title="Dashboard"
      description="Operational overview for the ship maintenance API foundation."
    >
      <section className="metric-grid">
        {[
          ["Vessels", stats.vessels],
          ["Templates", stats.templates],
          ["Inspections", stats.inspections],
          ["Reports", stats.reports],
          ["Users", stats.users],
        ].map(([label, value]) => (
          <div className="panel" key={label}>
            <span className="metric-value">{value}</span>
            <span className="muted">{label}</span>
          </div>
        ))}
      </section>
    </AdminShell>
  );
}
