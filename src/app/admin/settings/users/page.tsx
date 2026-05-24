import { AdminUsersTable } from "@/features/admin-settings/components/AdminUsersTable";
import { getAdminUsers } from "@/features/admin-settings/queries";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const users = await getAdminUsers();

  return (
    <div className="space-y-3">
      <header>
        <h2 className="font-admin-display text-xl text-admin-text">Admin users</h2>
        <p className="text-admin-sm text-admin-text-muted">
          {users.length} admin accounts with MFA and access controls.
        </p>
      </header>
      <AdminUsersTable users={users} />
    </div>
  );
}
