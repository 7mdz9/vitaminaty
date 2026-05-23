import type { ReactNode } from "react";
import Link from "next/link";

export default function AdminLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-950">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <Link className="text-sm font-semibold" href="/admin">
            Vitaminaty Admin
          </Link>
          <span className="text-xs text-gray-500">M2 shell</span>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="border-b border-gray-200 bg-white md:min-h-[calc(100vh-49px)] md:border-b-0 md:border-r">
          <nav className="flex gap-2 overflow-x-auto px-4 py-3 text-sm md:flex-col md:overflow-visible">
            {adminNavItems.map((item) => (
              <Link
                className="whitespace-nowrap rounded px-2 py-1 text-gray-700 hover:bg-gray-100"
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <div className="min-w-0 px-4 py-6">{children}</div>
      </div>
    </div>
  );
}

const adminNavItems = [
  { href: "/admin/products", label: "Products" },
  { href: "/admin/brands", label: "Brands" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/homepage", label: "Homepage" },
  { href: "/admin/audit-log", label: "Audit log" },
  { href: "/admin/settings/feature-flags", label: "Settings" },
];
