import type { ReactNode } from "react";
import { AdminHeader } from "@/components/layout/AdminHeader";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { AdminShellProviders } from "@/features/admin-shell";

export default function AdminLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <AdminShellProviders>
      <div className="min-h-screen bg-admin-bg font-admin text-admin-text">
        <div className="grid min-h-screen grid-cols-1 md:grid-cols-[236px_minmax(0,1fr)]">
          <AdminSidebar />
          <div className="min-w-0">
            <AdminHeader />
            <main className="mx-auto min-h-[calc(100vh-56px)] w-full max-w-[1440px] px-4 py-4 md:px-6">
              {children}
            </main>
          </div>
        </div>
      </div>
    </AdminShellProviders>
  );
}
