import Link from "next/link";
import { requireAdminSession, toMobileUserProfile } from "@/lib/auth";

const navItems = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/vessels", label: "Vessels" },
  { href: "/admin/templates", label: "Templates" },
  { href: "/admin/inspections", label: "Inspections" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/users", label: "Users" },
];

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
        <nav className="admin-nav" aria-label="Admin navigation">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
          <form action="/api/admin/auth/logout" method="post">
            <button type="submit">Logout</button>
          </form>
        </nav>
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
