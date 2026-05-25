import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Database } from "@/lib/supabase/types.generated";
import { createLocalAdminClient, readLocalSupabaseEnv } from "../../fixtures/customers";

vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers({
      "x-forwarded-for": "203.0.113.25",
      "user-agent": "mfa-enrollment-test-agent",
    }),
  cookies: async () => ({
    getAll: () => [],
    set: () => undefined,
    delete: () => undefined,
    get: () => undefined,
  }),
}));

const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const actorEmail = `mfa-admin-${runId}@example.test`;
const actorPassword = "mfa-admin-test-password-1234567890";

let adminClient: SupabaseClient<Database>;
let actorUserId: string;
const auditLogIds: string[] = [];

describe("admin MFA enrollment recovery codes", () => {
  beforeAll(async () => {
    const localEnv = readLocalSupabaseEnv();
    adminClient = createLocalAdminClient(localEnv);
    const authClient = createClient<Database>(localEnv.apiUrl, localEnv.serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await authClient.auth.admin.createUser({
      email: actorEmail,
      password: actorPassword,
      email_confirm: true,
      app_metadata: { role: "admin" },
    });

    if (error || !data.user) {
      throw new Error(`Could not create MFA test admin: ${error?.message ?? "missing user"}`);
    }

    actorUserId = data.user.id;
  });

  afterAll(async () => {
    if (auditLogIds.length > 0) {
      await adminClient.from("audit_log").delete().in("id", auditLogIds);
    }

    if (actorUserId) {
      await adminClient.from("admin_mfa_recovery_codes").delete().eq("user_id", actorUserId);
      await adminClient.auth.admin.deleteUser(actorUserId);
    }
  });

  it("stores recovery codes hashed and writes an mfa_enrolled audit row without plaintext codes", async () => {
    const { createRecoveryCodesForVerifiedMfa, hashRecoveryCode } = await import("@/lib/auth/mfa");
    const { listRecoveryCodeHashes } =
      await import("@/server/repositories/admin-mfa-recovery-repository");
    const factorId = "totp-factor-for-test";

    const result = await createRecoveryCodesForVerifiedMfa({
      actor: { userId: actorUserId, email: actorEmail },
      userId: actorUserId,
      factorId,
      client: adminClient,
    });

    const { data: auditRows, error: auditError } = await adminClient
      .from("audit_log")
      .select("id, action, entity_type, entity_id, diff")
      .eq("actor_user_id", actorUserId)
      .eq("action", "mfa_enrolled")
      .order("occurred_at", { ascending: false })
      .limit(1);

    if (auditError) {
      throw new Error(`Could not read MFA audit row: ${auditError.message}`);
    }

    const auditRow = auditRows?.[0];
    if (auditRow?.id) {
      auditLogIds.push(auditRow.id);
    }

    const storedHashes = await listRecoveryCodeHashes(actorUserId, adminClient);
    const expectedHashes = result.recoveryCodes.map(hashRecoveryCode);
    const rawAuditJson = JSON.stringify(auditRow?.diff);

    expect(result.recoveryCodes).toHaveLength(10);
    expect([...storedHashes].sort()).toEqual([...expectedHashes].sort());
    expect(storedHashes).not.toContain(result.recoveryCodes[0]);
    expect(auditRow).toMatchObject({
      action: "mfa_enrolled",
      entity_type: "admin_user",
      entity_id: actorUserId,
    });
    expect(auditRow?.diff).toMatchObject({
      action: "mfa_enrolled",
      entity_type: "admin_user",
      recovery_codes_count: 10,
      factor_id: factorId,
    });
    expect(rawAuditJson).not.toContain(result.recoveryCodes[0]);
  });
});
