"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/policies";
import { beginTotpChallenge, verifyTotpChallenge } from "@/lib/auth/mfa";
import { isAppError } from "@/lib/errors";
import { record } from "@/features/audit-log/record";
import {
  AdminInviteActionSchema,
  AdminUserTargetActionSchema,
  type AdminInviteActionInput,
  type AdminUserTargetActionInput,
} from "@/lib/validation/admin-settings";
import {
  deactivateAuthAdmin,
  deleteAuthAdmin,
  deleteAuthAdminMfaFactor,
  inviteAuthAdminByEmail,
  listAuthAdmins,
  type AuthAdminUserSummary,
} from "@/server/repositories/admin-repository";

export type AdminSettingsMfaChallengeResult =
  | {
      ok: true;
      factorId: string;
      challengeId: string;
    }
  | {
      ok: false;
      code: "authorization_error" | "validation_error" | "unknown";
      message: string;
    };

export type AdminUserActionResult =
  | {
      ok: true;
      user?: AuthAdminUserSummary;
      affectedUserId?: string;
    }
  | {
      ok: false;
      code:
        | "not_found"
        | "self_action_blocked"
        | "mfa_required"
        | "validation_error"
        | "authorization_error"
        | "unknown";
      message: string;
    };

export async function beginAdminSettingsMfaChallenge(): Promise<AdminSettingsMfaChallengeResult> {
  try {
    await requireAdmin();
    const challenge = await beginTotpChallenge();

    return {
      ok: true,
      factorId: challenge.factorId,
      challengeId: challenge.challengeId,
    };
  } catch (error) {
    return mapChallengeError(error);
  }
}

export async function inviteAdminUser(
  input: AdminInviteActionInput,
): Promise<AdminUserActionResult> {
  try {
    const admin = await requireAdmin();
    const parsed = AdminInviteActionSchema.parse(input);

    await verifyTotpChallenge(parsed.mfa);

    const invited = await inviteAuthAdminByEmail(parsed.email);
    await record({
      actor: { userId: admin.userId, email: admin.email },
      entityId: invited.id,
      diff: {
        version: 1,
        action: "create",
        entity_type: "admin_user",
        user_id: invited.id,
        changes: [
          { field: "email", before: null, after: invited.email },
          { field: "app_metadata.role", before: null, after: "admin" },
        ],
      },
    });

    revalidatePath("/admin/settings/users");
    return { ok: true, user: invited };
  } catch (error) {
    return mapUserActionError(error);
  }
}

export async function deactivateAdminUser(
  input: AdminUserTargetActionInput,
): Promise<AdminUserActionResult> {
  try {
    const admin = await requireAdmin();
    const parsed = AdminUserTargetActionSchema.parse(input);

    if (parsed.userId === admin.userId) {
      return {
        ok: false,
        code: "self_action_blocked",
        message: "Admins cannot deactivate their own admin access.",
      };
    }

    await verifyTotpChallenge(parsed.mfa);
    const before = await findAdminSummary(parsed.userId);

    if (!before) {
      return { ok: false, code: "not_found", message: "Admin user not found." };
    }

    const deactivated = await deactivateAuthAdmin(parsed.userId);
    await record({
      actor: { userId: admin.userId, email: admin.email },
      entityId: deactivated.id,
      diff: {
        version: 1,
        action: "role_change",
        entity_type: "admin_user",
        user_id: deactivated.id,
        changes: [
          { field: "app_metadata.role", before: before.role, after: deactivated.role },
          { field: "active", before: before.isActive, after: deactivated.isActive },
        ],
      },
    });

    revalidatePath("/admin/settings/users");
    return { ok: true, user: deactivated };
  } catch (error) {
    return mapUserActionError(error);
  }
}

export async function deleteAdminUser(
  input: AdminUserTargetActionInput,
): Promise<AdminUserActionResult> {
  try {
    const admin = await requireAdmin();
    const parsed = AdminUserTargetActionSchema.parse(input);

    if (parsed.userId === admin.userId) {
      return {
        ok: false,
        code: "self_action_blocked",
        message: "Admins cannot delete their own admin account.",
      };
    }

    await verifyTotpChallenge(parsed.mfa);
    const before = await findAdminSummary(parsed.userId);

    if (!before) {
      return { ok: false, code: "not_found", message: "Admin user not found." };
    }

    await deleteAuthAdmin(parsed.userId);
    await record({
      actor: { userId: admin.userId, email: admin.email },
      entityId: before.id,
      diff: {
        version: 1,
        action: "archive",
        entity_type: "admin_user",
        user_id: before.id,
        changes: [
          { field: "deleted", before: false, after: true },
          { field: "email", before: before.email, after: null },
        ],
      },
    });

    revalidatePath("/admin/settings/users");
    return { ok: true, affectedUserId: before.id };
  } catch (error) {
    return mapUserActionError(error);
  }
}

export async function revokeAdminMfa(
  input: AdminUserTargetActionInput,
): Promise<AdminUserActionResult> {
  try {
    const admin = await requireAdmin();
    const parsed = AdminUserTargetActionSchema.parse(input);

    if (parsed.userId === admin.userId) {
      return {
        ok: false,
        code: "self_action_blocked",
        message: "Admins cannot revoke their own MFA from this panel.",
      };
    }

    await verifyTotpChallenge(parsed.mfa);
    const before = await findAdminSummary(parsed.userId);

    if (!before) {
      return { ok: false, code: "not_found", message: "Admin user not found." };
    }

    await Promise.all(
      before.factorIds.map((factorId) => deleteAuthAdminMfaFactor(before.id, factorId)),
    );
    await record({
      actor: { userId: admin.userId, email: admin.email },
      entityId: before.id,
      diff: {
        version: 1,
        action: "mfa_reset",
        entity_type: "admin_user",
        user_id: before.id,
        changes: [
          { field: "mfa_enrolled", before: before.mfaEnrolled, after: false },
          { field: "mfa_factor_count", before: before.factorIds.length, after: 0 },
        ],
      },
    });

    revalidatePath("/admin/settings/users");
    return {
      ok: true,
      user: {
        ...before,
        factorIds: [],
        mfaEnrolled: false,
      },
    };
  } catch (error) {
    return mapUserActionError(error);
  }
}

async function findAdminSummary(userId: string): Promise<AuthAdminUserSummary | null> {
  return (await listAuthAdmins()).find((user) => user.id === userId) ?? null;
}

function mapChallengeError(
  error: unknown,
): Extract<AdminSettingsMfaChallengeResult, { ok: false }> {
  if (isAppError(error)) {
    return {
      ok: false,
      code: error.code === "authorization_error" ? "authorization_error" : "validation_error",
      message: error.message,
    };
  }

  return {
    ok: false,
    code: "unknown",
    message: error instanceof Error ? error.message : "Unknown MFA challenge error.",
  };
}

function mapUserActionError(error: unknown): Extract<AdminUserActionResult, { ok: false }> {
  if (isAppError(error)) {
    return {
      ok: false,
      code: error.code === "authorization_error" ? "authorization_error" : "validation_error",
      message: error.message,
    };
  }

  return {
    ok: false,
    code: "unknown",
    message: error instanceof Error ? error.message : "Unknown admin user action error.",
  };
}
