import "server-only";

import { supabaseAdmin } from "@/server/db/supabase-admin";

export type AuthAdminUserSummary = {
  id: string;
  email: string | null;
  role: string | null;
  mfaEnrolled: boolean;
  factorIds: string[];
  isActive: boolean;
  created_at: string;
  last_sign_in_at: string | null;
};

export type AuthUserEmailSummary = {
  id: string;
  email: string | null;
};

export async function listAuthAdmins(): Promise<AuthAdminUserSummary[]> {
  const { data, error } = await supabaseAdmin.auth.admin.listUsers();

  if (error) {
    throw new Error(`Auth admin users query failed: ${error.message}`);
  }

  return data.users
    .filter((user) => user.app_metadata?.role === "admin" || user.app_metadata?.role === "deactivated_admin")
    .map((user) => ({
      id: user.id,
      email: user.email ?? null,
      role: typeof user.app_metadata?.role === "string" ? user.app_metadata.role : null,
      factorIds: Array.isArray(user.factors)
        ? user.factors.flatMap((factor) => (typeof factor.id === "string" ? [factor.id] : []))
        : [],
      mfaEnrolled: Array.isArray(user.factors) && user.factors.length > 0,
      isActive: user.app_metadata?.role === "admin",
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
    factorIds: Array.isArray(data.user.factors)
      ? data.user.factors.flatMap((factor) => (typeof factor.id === "string" ? [factor.id] : []))
      : [],
    mfaEnrolled: Array.isArray(data.user.factors) && data.user.factors.length > 0,
    isActive: true,
    created_at: data.user.created_at,
    last_sign_in_at: data.user.last_sign_in_at ?? null,
  };
}

export async function inviteAuthAdminByEmail(email: string): Promise<AuthAdminUserSummary> {
  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    data: { invited_as: "admin" },
  });

  if (error || !data.user) {
    throw new Error(`Auth admin invite failed: ${error?.message ?? "No user returned."}`);
  }

  return setAuthUserAdminRole(data.user.id);
}

export async function deactivateAuthAdmin(userId: string): Promise<AuthAdminUserSummary> {
  const { data: current, error: currentError } = await supabaseAdmin.auth.admin.getUserById(userId);

  if (currentError || !current.user) {
    throw new Error(`Auth admin user query failed: ${currentError?.message ?? "No user returned."}`);
  }

  const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    app_metadata: {
      ...current.user.app_metadata,
      role: "deactivated_admin",
      deactivated_at: new Date().toISOString(),
    },
  });

  if (error) {
    throw new Error(`Auth admin deactivation failed: ${error.message}`);
  }

  return {
    id: data.user.id,
    email: data.user.email ?? null,
    role: "deactivated_admin",
    factorIds: Array.isArray(data.user.factors)
      ? data.user.factors.flatMap((factor) => (typeof factor.id === "string" ? [factor.id] : []))
      : [],
    mfaEnrolled: Array.isArray(data.user.factors) && data.user.factors.length > 0,
    isActive: false,
    created_at: data.user.created_at,
    last_sign_in_at: data.user.last_sign_in_at ?? null,
  };
}

export async function deleteAuthAdmin(userId: string): Promise<void> {
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId, true);

  if (error) {
    throw new Error(`Auth admin deletion failed: ${error.message}`);
  }
}

export async function deleteAuthAdminMfaFactor(userId: string, factorId: string): Promise<void> {
  const { error } = await supabaseAdmin.auth.admin.mfa.deleteFactor({
    userId,
    id: factorId,
  });

  if (error) {
    throw new Error(`Auth admin MFA factor deletion failed: ${error.message}`);
  }
}

export async function listAuthUserEmailsByIds(userIds: string[]): Promise<AuthUserEmailSummary[]> {
  const uniqueIds = Array.from(new Set(userIds)).filter(Boolean);

  if (uniqueIds.length === 0) {
    return [];
  }

  const users = await Promise.all(
    uniqueIds.map(async (id) => {
      const { data, error } = await supabaseAdmin.auth.admin.getUserById(id);

      if (error) {
        return { id, email: null };
      }

      return { id, email: data.user.email ?? null };
    }),
  );

  return users;
}
