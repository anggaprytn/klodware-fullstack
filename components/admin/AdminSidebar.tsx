"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore, type MouseEvent } from "react";
import {
  Activity,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ShieldCheck,
  Ship,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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

const SIDEBAR_COLLAPSED_KEY = "klodware-admin-sidebar-collapsed";
const SIDEBAR_COLLAPSED_EVENT = "klodware-admin-sidebar-collapsed-change";

function getStoredSidebarCollapsed() {
  if (typeof window === "undefined") {
    return false;
  }

  return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
}

function subscribeToSidebarCollapsed(callback: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener("storage", callback);
  window.addEventListener(SIDEBAR_COLLAPSED_EVENT, callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(SIDEBAR_COLLAPSED_EVENT, callback);
  };
}

export function AdminSidebar({
  collapsible = true,
  onNavigate,
}: {
  collapsible?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const storedCollapsed = useSyncExternalStore(
    subscribeToSidebarCollapsed,
    getStoredSidebarCollapsed,
    () => false,
  );
  const collapsed = collapsible && storedCollapsed;
  const [pendingNav, setPendingNav] = useState<{
    fromPath: string;
    href: string;
  } | null>(null);

  function toggleCollapsed() {
    if (!collapsible) {
      return;
    }

    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(!storedCollapsed));
    window.dispatchEvent(new Event(SIDEBAR_COLLAPSED_EVENT));
  }

  function handleNavigate(
    event: MouseEvent<HTMLAnchorElement>,
    href: string,
    active: boolean,
  ) {
    if (
      event.defaultPrevented ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0
    ) {
      return;
    }

    if (!active) {
      setPendingNav({ fromPath: pathname, href });
    }
    onNavigate?.();
  }

  return (
    <aside
      className={cn(
        "admin-sidebar",
        collapsible && "admin-sidebar--collapsible",
        collapsed && "is-collapsed",
      )}
      data-collapsed={collapsible && collapsed ? "true" : "false"}
    >
      <div className="admin-sidebar__brand">
        <span className="admin-sidebar__mark">KW</span>
        <div className="admin-sidebar__brand-copy">
          <strong>Klodware</strong>
          <span>Ship Maintenance</span>
        </div>
        {collapsible ? (
          <Button
            aria-label={collapsed ? "Show sidebar" : "Hide sidebar"}
            aria-pressed={collapsed}
            className="admin-sidebar__toggle"
            onClick={toggleCollapsed}
            size="icon"
            type="button"
            variant="ghost"
          >
            {collapsed ? (
              <PanelLeftOpen aria-hidden="true" />
            ) : (
              <PanelLeftClose aria-hidden="true" />
            )}
          </Button>
        ) : null}
      </div>

      <TooltipProvider delayDuration={120}>
        <ScrollArea className="admin-sidebar__scroll">
          <nav className="admin-nav" aria-label="Admin navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              const pending =
                pendingNav?.href === item.href &&
                pendingNav.fromPath === pathname &&
                !active;
              const navLink = (
                <Link
                  aria-current={active ? "page" : undefined}
                  aria-label={collapsed ? item.label : undefined}
                  className={cn(active && "active", pending && "pending")}
                  href={item.href}
                  onClick={(event) => handleNavigate(event, item.href, active)}
                >
                  <Icon aria-hidden="true" />
                  <span className="admin-nav__label">{item.label}</span>
                </Link>
              );

              if (!collapsed) {
                return <span key={item.href}>{navLink}</span>;
              }

              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>{navLink}</TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              );
            })}
          </nav>
        </ScrollArea>

        <form action="/api/admin/auth/logout" method="post">
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button aria-label="Logout" className="danger-nav" type="submit">
                  <LogOut aria-hidden="true" />
                  <span className="admin-nav__label">Logout</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Logout</TooltipContent>
            </Tooltip>
          ) : (
            <button className="danger-nav" type="submit">
              <LogOut aria-hidden="true" />
              <span className="admin-nav__label">Logout</span>
            </button>
          )}
        </form>
      </TooltipProvider>
    </aside>
  );
}
