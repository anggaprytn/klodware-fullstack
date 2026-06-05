import { requireAdminSession, toMobileUserProfile } from "@/lib/auth";
import { AdminNav } from "./components/AdminNav";

export async function AdminShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const session = await requireAdminSession();
  const user = toMobileUserProfile(session.user);

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <p className="admin-brand">Klodware</p>
        <AdminNav />
      </aside>
      <main className="admin-main">
        <div className="admin-header">
          <div>
            <h1>{title}</h1>
            <p>{description}</p>
          </div>
          <p className="muted">{user.full_name}</p>
        </div>
        {children}
      </main>
    </div>
  );
}
