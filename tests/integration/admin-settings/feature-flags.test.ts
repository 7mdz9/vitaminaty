import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FeatureFlagRecord } from "@/types/feature-flag";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  readFile: vi.fn(),
  beginTotpChallenge: vi.fn(),
  verifyTotpChallenge: vi.fn(),
  getFeatureFlag: vi.fn(),
  updateFeatureFlagForAdminIfFresh: vi.fn(),
  record: vi.fn(),
  revalidatePath: vi.fn(),
  clearFeatureFlagCache: vi.fn(),
}));

vi.mock("@/lib/auth/policies", () => ({
  requireAdmin: mocks.requireAdmin,
}));

vi.mock("node:fs/promises", () => ({
  readFile: mocks.readFile,
}));

vi.mock("@/lib/auth/mfa", () => ({
  beginTotpChallenge: mocks.beginTotpChallenge,
  verifyTotpChallenge: mocks.verifyTotpChallenge,
}));

vi.mock("@/server/repositories/feature-flag-repository", () => ({
  getFeatureFlag: mocks.getFeatureFlag,
  updateFeatureFlagForAdminIfFresh: mocks.updateFeatureFlagForAdminIfFresh,
}));

vi.mock("@/features/audit-log/record", () => ({
  record: mocks.record,
}));

vi.mock("@/features/feature-flags/eval", () => ({
  clearFeatureFlagCache: mocks.clearFeatureFlagCache,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

describe("admin feature flag settings actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({
      userId: "00000000-0000-4000-8000-000000000100",
      email: "admin@example.test",
      role: "admin",
    });
    mocks.readFile.mockResolvedValue("# LAST_SESSION\n\nNo sign-off yet.");
  });

  it("toggles a non-HIGH_RIGOR flag and writes a flag_toggle audit row", async () => {
    const before = flagFactory({ key: "support_chat_enabled", enabled: false });
    const after = flagFactory({
      key: "support_chat_enabled",
      enabled: true,
      updated_by: "00000000-0000-4000-8000-000000000100",
      updated_at: "2026-05-24T18:05:00.000Z",
    });
    mocks.getFeatureFlag.mockResolvedValueOnce(before);
    mocks.updateFeatureFlagForAdminIfFresh.mockResolvedValueOnce(after);

    const { toggleFeatureFlag } = await import("@/features/feature-flags/admin-actions");
    const result = await toggleFeatureFlag({
      key: "support_chat_enabled",
      enabled: true,
      expectedUpdatedAt: before.updated_at,
    });

    expect(result).toMatchObject({ ok: true, flag: { enabled: true } });
    expect(mocks.requireAdmin).toHaveBeenCalledTimes(1);
    expect(mocks.verifyTotpChallenge).not.toHaveBeenCalled();
    expect(mocks.updateFeatureFlagForAdminIfFresh).toHaveBeenCalledWith(
      "support_chat_enabled",
      before.updated_at,
      expect.objectContaining({
        enabled: true,
        updated_by: "00000000-0000-4000-8000-000000000100",
      }),
    );
    expect(mocks.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: { userId: "00000000-0000-4000-8000-000000000100", email: "admin@example.test" },
        diff: expect.objectContaining({
          action: "flag_toggle",
          entity_type: "feature_flag",
          feature_flag_key: "support_chat_enabled",
          changes: expect.arrayContaining([{ field: "enabled", before: false, after: true }]),
        }),
      }),
    );
    expect(mocks.clearFeatureFlagCache).toHaveBeenCalledTimes(1);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/settings/feature-flags");
  });

  it("keeps HIGH_RIGOR flags locked until LAST_SESSION has the sign-off", async () => {
    const before = flagFactory({ key: "commerce_enabled", enabled: false });
    mocks.getFeatureFlag.mockResolvedValueOnce(before);

    const { toggleFeatureFlag } = await import("@/features/feature-flags/admin-actions");
    const result = await toggleFeatureFlag({
      key: "commerce_enabled",
      enabled: true,
      expectedUpdatedAt: before.updated_at,
    });

    expect(result).toMatchObject({
      ok: false,
      error: "feature_disabled",
    });
    expect(mocks.updateFeatureFlagForAdminIfFresh).not.toHaveBeenCalled();
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it("requires MFA and the typed phrase after HIGH_RIGOR sign-off", async () => {
    const before = flagFactory({ key: "paymob_live_mode", enabled: false });
    const after = flagFactory({ key: "paymob_live_mode", enabled: true });
    mocks.readFile.mockResolvedValueOnce(
      "M5 Paymob live-mode cross-check passed sign-off complete.",
    );
    mocks.getFeatureFlag.mockResolvedValueOnce(before);
    mocks.updateFeatureFlagForAdminIfFresh.mockResolvedValueOnce(after);

    const { toggleFeatureFlag } = await import("@/features/feature-flags/admin-actions");
    const result = await toggleFeatureFlag({
      key: "paymob_live_mode",
      enabled: true,
      expectedUpdatedAt: before.updated_at,
      confirmationPhrase: "ENABLE PAYMOB LIVE",
      mfa: {
        factorId: "factor_123",
        challengeId: "challenge_123",
        code: "123456",
      },
    });

    expect(result).toMatchObject({ ok: true, flag: { enabled: true } });
    expect(mocks.verifyTotpChallenge).toHaveBeenCalledWith({
      factorId: "factor_123",
      challengeId: "challenge_123",
      code: "123456",
    });
  });

  it("returns stale_data without auditing when the flag changed after page load", async () => {
    const before = flagFactory({ key: "support_chat_enabled", enabled: false });
    const current = flagFactory({
      key: "support_chat_enabled",
      enabled: true,
      updated_at: "2026-05-24T18:10:00.000Z",
    });
    mocks.getFeatureFlag.mockResolvedValueOnce(before).mockResolvedValueOnce(current);
    mocks.updateFeatureFlagForAdminIfFresh.mockResolvedValueOnce(null);

    const { toggleFeatureFlag } = await import("@/features/feature-flags/admin-actions");
    const result = await toggleFeatureFlag({
      key: "support_chat_enabled",
      enabled: true,
      expectedUpdatedAt: before.updated_at,
    });

    expect(result).toMatchObject({
      ok: false,
      error: "stale_data",
      current: { updated_at: current.updated_at },
    });
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it("starts a TOTP challenge for HIGH_RIGOR confirmation dialogs", async () => {
    mocks.beginTotpChallenge.mockResolvedValueOnce({
      factorId: "factor_123",
      challengeId: "challenge_123",
    });

    const { beginFeatureFlagMfaChallenge } = await import("@/features/feature-flags/admin-actions");
    const result = await beginFeatureFlagMfaChallenge();

    expect(result).toEqual({
      ok: true,
      factorId: "factor_123",
      challengeId: "challenge_123",
    });
    expect(mocks.requireAdmin).toHaveBeenCalledTimes(1);
  });
});

function flagFactory(overrides: Partial<FeatureFlagRecord> = {}): FeatureFlagRecord {
  return {
    key: "support_chat_enabled",
    enabled: false,
    description: "Gate support chat.",
    category: "surface",
    updated_at: "2026-05-24T18:00:00.000Z",
    updated_by: null,
    ...overrides,
  };
}
