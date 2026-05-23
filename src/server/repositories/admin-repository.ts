import "server-only";

import { supabaseAdmin } from "@/server/db/supabase-admin";

export type AuthAdminUserSummary = {
  id: string;
  email: string | null;
  role: string | null;
  mfaEnrolled: boolean;
  created_at: string;
  last_sign_in_at: string | null;
};

export async function listAuthAdmins(): Promise<AuthAdminUserSummary[]> {
  const { data, error } = await supabaseAdmin.auth.admin.listUsers();

  if (error) {
    throw new Error(`Auth admin users query failed: ${error.message}`);
  }

  return data.users
    .filter((user) => user.app_metadata?.role === "admin")
    .map((user) => ({
      id: user.id,
      email: user.email ?? null,
      role: typeof user.app_metadata?.role === "string" ? user.app_metadata.role : null,
      mfaEnrolled: Array.isArray(user.factors) && user.factors.length > 0,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at ?? null,
    }));
}

export async function setAuthUserAdminRole(userId: string): Promise<AuthAdminUserSummary> {
  const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    app_metadata: { role: "admin" },
  });

  if (error) {
    throw new Error(`Auth admin role update failed: ${error.message}`);
  }

  return {
    id: data.user.id,
    email: data.user.email ?? null,
    role: "admin",
    mfaEnrolled: Array.isArray(data.user.factors) && data.user.factors.length > 0,
    created_at: data.user.created_at,
    last_sign_in_at: data.user.last_sign_in_at ?? null,
  };
}
