import { requireAdminSession, toMobileUserProfile } from "@/lib/auth";
import { AdminSidebar } from "./AdminSidebar";
import { AdminTopbar } from "./AdminTopbar";

export async function AdminConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAdminSession();
  const user = toMobileUserProfile(session.user);

  return (
    <div className="admin-shell">
      <div className="admin-shell__desktop">
        <AdminSidebar />
      </div>
      <div className="admin-shell__body">
        <AdminTopbar user={user} />
        <main className="admin-main">{children}</main>
      </div>
    </div>
  );
}
