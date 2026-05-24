"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Boxes,
  Building2,
  ClipboardList,
  Home,
  LayoutDashboard,
  ListTree,
  MessageSquare,
  ScrollText,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const adminNavItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/products", label: "Products", icon: Boxes },
  { href: "/admin/brands", label: "Brands", icon: Building2 },
  { href: "/admin/categories", label: "Categories", icon: ListTree },
  { href: "/admin/orders", label: "Orders", icon: ClipboardList },
  { href: "/admin/homepage", label: "Homepage", icon: Home },
  { href: "/admin/audit-log", label: "Audit log", icon: ScrollText },
  { href: "/admin/settings/feature-flags", label: "Settings", icon: Settings },
  { href: "/admin/support-chat", label: "Support", icon: MessageSquare },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="border-r border-admin-border bg-admin-surface">
      <div className="flex h-14 items-center gap-2 border-b border-admin-border px-4">
        <Activity className="size-5 text-admin-accent" />
        <span className="font-admin-display text-admin-title font-semibold text-admin-text">
          Vitaminaty
        </span>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 py-3 text-admin-body-sm md:flex-col md:overflow-visible">
        {adminNavItems.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/admin" ? pathname === item.href : pathname.startsWith(item.href);

          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-9 shrink-0 items-center gap-2 rounded-admin-md border border-transparent px-3 text-admin-text-muted transition-colors duration-admin-fast hover:bg-admin-surface-muted hover:text-admin-text",
                active &&
                  "border-admin-accent bg-admin-surface-muted text-admin-text shadow-[inset_3px_0_0_var(--admin-accent)]",
              )}
              href={item.href}
              key={item.href}
            >
              <Icon className="size-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
