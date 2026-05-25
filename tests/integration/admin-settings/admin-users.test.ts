import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthAdminUserSummary } from "@/server/repositories/admin-repository";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  beginTotpChallenge: vi.fn(),
  verifyTotpChallenge: vi.fn(),
  inviteAuthAdminByEmail: vi.fn(),
  deactivateAuthAdmin: vi.fn(),
  deleteAuthAdmin: vi.fn(),
  deleteAuthAdminMfaFactor: vi.fn(),
  listAuthAdmins: vi.fn(),
  getPaymentIntegrationEventStats: vi.fn(),
  getShipmentIntegrationEventStats: vi.fn(),
  record: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  env: {
    PAYMOB_MODE: "stub",
    PAYMOB_API_KEY: "paymob_api_key_1234567890",
    PAYMOB_HMAC_SECRET: undefined,
    PAYMOB_INTEGRATION_ID_CARDS: "cards_9876",
    PAYMOB_INTEGRATION_ID_APPLE_PAY: undefined,
    PAYMOB_INTEGRATION_ID_TABBY: undefined,
    PAYMOB_INTEGRATION_ID_TAMARA: undefined,
    PAYMOB_IFRAME_ID: undefined,
    ICARRY_MODE: "stub",
    ICARRY_API_KEY: "icarry_api_key_1234",
    ICARRY_ACCOUNT_ID: undefined,
    ICARRY_WEBHOOK_SECRET: undefined,
    ICARRY_ORIGIN_ADDRESS_ID: undefined,
  },
}));

vi.mock("@/lib/auth/policies", () => ({
  requireAdmin: mocks.requireAdmin,
}));

vi.mock("@/lib/auth/mfa", () => ({
  beginTotpChallenge: mocks.beginTotpChallenge,
  verifyTotpChallenge: mocks.verifyTotpChallenge,
}));

vi.mock("@/server/repositories/admin-repository", () => ({
  inviteAuthAdminByEmail: mocks.inviteAuthAdminByEmail,
  deactivateAuthAdmin: mocks.deactivateAuthAdmin,
  deleteAuthAdmin: mocks.deleteAuthAdmin,
  deleteAuthAdminMfaFactor: mocks.deleteAuthAdminMfaFactor,
  listAuthAdmins: mocks.listAuthAdmins,
}));

vi.mock("@/server/repositories/payment-event-repository", () => ({
  getPaymentIntegrationEventStats: mocks.getPaymentIntegrationEventStats,
}));

vi.mock("@/server/repositories/shipment-event-repository", () => ({
  getShipmentIntegrationEventStats: mocks.getShipmentIntegrationEventStats,
}));

vi.mock("@/features/audit-log/record", () => ({
  record: mocks.record,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

describe("admin settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({
      userId: "00000000-0000-4000-8000-000000000100",
      email: "owner@example.test",
      role: "admin",
    });
    mocks.getPaymentIntegrationEventStats.mockResolvedValue({
      lastSuccessfulWebhookAt: "2026-05-24T18:00:00.000Z",
      failureCount24h: 2,
    });
    mocks.getShipmentIntegrationEventStats.mockResolvedValue({
      lastSuccessfulWebhookAt: null,
      failureCount24h: 0,
    });
  });

  it("reads integration status from env and event repositories behind requireAdmin", async () => {
    const { getIntegrationSettings } = await import("@/features/admin-settings/queries");
    const integrations = await getIntegrationSettings();

    expect(mocks.requireAdmin).toHaveBeenCalledTimes(1);
    expect(mocks.getPaymentIntegrationEventStats).toHaveBeenCalledWith("stub");
    expect(mocks.getShipmentIntegrationEventStats).toHaveBeenCalledWith("stub");
    expect(integrations[0]).toMatchObject({
      id: "paymob",
      mode: "stub",
      webhookFailureCount24h: 2,
      credentials: expect.arrayContaining([
        expect.objectContaining({ label: "API key", configured: true, maskedValue: "****7890" }),
        expect.objectContaining({ label: "HMAC secret", configured: false }),
      ]),
    });
  });

  it("invites an admin only after MFA re-verification and writes audit", async () => {
    const invited = adminFactory({
      id: "00000000-0000-4000-8000-000000000200",
      email: "new-admin@example.test",
    });
    mocks.inviteAuthAdminByEmail.mockResolvedValueOnce(invited);

    const { inviteAdminUser } = await import("@/features/admin-settings/actions");
    const result = await inviteAdminUser({
      email: "NEW-ADMIN@example.test",
      mfa: mfaPayload(),
    });

    expect(result).toMatchObject({ ok: true, user: { email: "new-admin@example.test" } });
    expect(mocks.verifyTotpChallenge).toHaveBeenCalledWith(mfaPayload());
    expect(mocks.inviteAuthAdminByEmail).toHaveBeenCalledWith("new-admin@example.test");
    expect(mocks.record).toHaveBeenCalledWith(
      expect.objectContaining({
        diff: expect.objectContaining({
          action: "create",
          entity_type: "admin_user",
          user_id: invited.id,
        }),
      }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/settings/users");
  });

  it("blocks self-deactivation before MFA or repository writes", async () => {
    const { deactivateAdminUser } = await import("@/features/admin-settings/actions");
    const result = await deactivateAdminUser({
      userId: "00000000-0000-4000-8000-000000000100",
      mfa: mfaPayload(),
    });

    expect(result).toMatchObject({ ok: false, error: "unauthorized" });
    expect(mocks.verifyTotpChallenge).not.toHaveBeenCalled();
    expect(mocks.deactivateAuthAdmin).not.toHaveBeenCalled();
  });

  it("revokes every MFA factor and records mfa_reset", async () => {
    const before = adminFactory({ factorIds: ["factor_a", "factor_b"], mfaEnrolled: true });
    mocks.listAuthAdmins.mockResolvedValueOnce([before]);

    const { revokeAdminMfa } = await import("@/features/admin-settings/actions");
    const result = await revokeAdminMfa({
      userId: before.id,
      mfa: mfaPayload(),
    });

    expect(result).toMatchObject({ ok: true, user: { mfaEnrolled: false, factorIds: [] } });
    expect(mocks.deleteAuthAdminMfaFactor).toHaveBeenCalledWith(before.id, "factor_a");
    expect(mocks.deleteAuthAdminMfaFactor).toHaveBeenCalledWith(before.id, "factor_b");
    expect(mocks.record).toHaveBeenCalledWith(
      expect.objectContaining({
        diff: expect.objectContaining({
          action: "mfa_reset",
          entity_type: "admin_user",
          user_id: before.id,
        }),
      }),
    );
  });

  it("soft-deletes admin users and records archive audit", async () => {
    const before = adminFactory();
    mocks.listAuthAdmins.mockResolvedValueOnce([before]);

    const { deleteAdminUser } = await import("@/features/admin-settings/actions");
    const result = await deleteAdminUser({
      userId: before.id,
      mfa: mfaPayload(),
    });

    expect(result).toMatchObject({ ok: true, affectedUserId: before.id });
    expect(mocks.deleteAuthAdmin).toHaveBeenCalledWith(before.id);
    expect(mocks.record).toHaveBeenCalledWith(
      expect.objectContaining({
        diff: expect.objectContaining({
          action: "archive",
          entity_type: "admin_user",
          user_id: before.id,
        }),
      }),
    );
  });
});

function mfaPayload() {
  return {
    factorId: "factor_123",
    challengeId: "challenge_123",
    code: "123456",
  };
}

function adminFactory(overrides: Partial<AuthAdminUserSummary> = {}): AuthAdminUserSummary {
  return {
    id: "00000000-0000-4000-8000-000000000201",
    email: "admin@example.test",
    role: "admin",
    factorIds: ["factor_123"],
    mfaEnrolled: true,
    isActive: true,
    created_at: "2026-05-24T18:00:00.000Z",
    last_sign_in_at: null,
    ...overrides,
  };
}
