"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  Settings,
  ShieldCheck,
  Ship,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/admin/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/admin/vessels", icon: Ship, label: "Vessels" },
  { href: "/admin/templates", icon: ClipboardList, label: "Templates" },
  { href: "/admin/inspections", icon: ShieldCheck, label: "Inspections" },
  { href: "/admin/reports", icon: FileText, label: "Reports" },
  { href: "/admin/users", icon: Users, label: "Users" },
  { href: "/admin/sync-events", icon: Activity, label: "Sync Events" },
  { href: "/admin/settings", icon: Settings, label: "Settings" },
];

export function AdminSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar__brand">
        <span className="admin-sidebar__mark">KW</span>
        <div>
          <strong>Klodware</strong>
          <span>Ship Maintenance</span>
        </div>
      </div>
      <nav className="admin-nav" aria-label="Admin navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={cn(active && "active")}
              href={item.href}
              key={item.href}
              onClick={onNavigate}
            >
              <Icon aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <form action="/api/admin/auth/logout" method="post">
        <button className="danger-nav" type="submit">
          <LogOut aria-hidden="true" />
          <span>Logout</span>
        </button>
      </form>
    </aside>
  );
}
