import { AdminShell } from "../AdminShell";

export default function AdminUsersPage() {
  return (
    <AdminShell
      title="Users"
      description="Manage admin, inspector, and viewer accounts."
    >
      <section className="panel">
        <p className="muted">User creation, deactivation, role assignment, and manual password reset will be implemented on top of the verified PocketBase users collection.</p>
      </section>
    </AdminShell>
  );
}
