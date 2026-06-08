"use client";

import { useState } from "react";
import { Menu, ShieldCheck } from "lucide-react";
import { getInitials } from "@/lib/admin-format";
import type { MobileUserProfile } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { AdminSidebar } from "./AdminSidebar";

export function AdminTopbar({ user }: { user: MobileUserProfile }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="admin-topbar">
      <div className="admin-topbar__mobile">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button aria-label="Open admin navigation" size="icon" variant="secondary">
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent className="admin-mobile-sheet">
            <AdminSidebar onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>
      <div className="admin-topbar__status">
        <ShieldCheck aria-hidden="true" />
        <span>Admin control plane</span>
      </div>
      <div className="admin-user-chip" title={user.full_name}>
        <span>{getInitials(user.full_name || user.username)}</span>
        <div>
          <strong>{user.full_name || user.username}</strong>
          <small>{user.role}</small>
        </div>
      </div>
    </header>
  );
}
