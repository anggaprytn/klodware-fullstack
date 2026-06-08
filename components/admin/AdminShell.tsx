import { requireAdminSession, toMobileUserProfile } from "@/lib/auth";
import { AdminPageHeader } from "./AdminPageHeader";
import { AdminSidebar } from "./AdminSidebar";
import { AdminTopbar } from "./AdminTopbar";

export async function AdminShell({
  children,
  description,
  title,
}: {
  children: React.ReactNode;
  description: string;
  title: string;
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
        <main className="admin-main">
          <AdminPageHeader description={description} title={title} />
          {children}
        </main>
      </div>
    </div>
  );
}
