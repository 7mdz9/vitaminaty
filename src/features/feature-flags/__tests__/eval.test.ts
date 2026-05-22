import { afterEach, describe, expect, it, vi } from "vitest";

const getFeatureFlagFromDBMock = vi.hoisted(() => vi.fn<() => Promise<boolean | null>>());

vi.mock("@/server/repositories/feature-flag-repository", () => ({
  getFeatureFlagFromDB: getFeatureFlagFromDBMock,
}));

import { clearFeatureFlagCacheForTests, isEnabled } from "@/features/feature-flags/eval";
import { FEATURE_FLAGS } from "@/features/feature-flags/flags";

describe("feature flag evaluation", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    getFeatureFlagFromDBMock.mockReset();
    clearFeatureFlagCacheForTests();
  });

  it("enumerates the Decision 4 flag set with safe defaults", () => {
    expect(Object.keys(FEATURE_FLAGS).sort()).toEqual(
      [
        "admin_portal_enabled",
        "arabic_rtl_enabled",
        "cart_visible",
        "checkout_enabled",
        "commerce_enabled",
        "customer_mfa_enabled",
        "customer_signup_enabled",
        "feature_flag_admin_ui",
        "icarry_live_mode",
        "maintenance_mode",
        "notify_me_enabled",
        "paymob_live_mode",
        "promo_codes_enabled",
        "public_storefront_enabled",
        "read_only_mode",
        "reviews_enabled",
        "same_day_delivery_enabled",
        "support_chat_enabled",
        "transactional_emails_enabled",
        "wishlist_enabled",
      ].sort(),
    );
    expect(FEATURE_FLAGS.commerce_enabled.default).toBe(false);
    expect(FEATURE_FLAGS.admin_portal_enabled.default).toBe(true);
    expect(FEATURE_FLAGS.feature_flag_admin_ui.default).toBe(true);
  });

  it("falls through to the default when no env override or database row exists", async () => {
    getFeatureFlagFromDBMock.mockResolvedValue(null);

    await expect(isEnabled("commerce_enabled")).resolves.toBe(false);
    expect(getFeatureFlagFromDBMock).toHaveBeenCalledWith("commerce_enabled");
  });

  it("lets FF_<KEY> env overrides win over the database and default", async () => {
    vi.stubEnv("FF_COMMERCE_ENABLED", "true");
    getFeatureFlagFromDBMock.mockResolvedValue(false);

    await expect(isEnabled("commerce_enabled")).resolves.toBe(true);
    expect(getFeatureFlagFromDBMock).not.toHaveBeenCalled();
  });

  it("accepts false env overrides for default-on flags", async () => {
    vi.stubEnv("FF_ADMIN_PORTAL_ENABLED", "false");
    getFeatureFlagFromDBMock.mockResolvedValue(true);

    await expect(isEnabled("admin_portal_enabled")).resolves.toBe(false);
    expect(getFeatureFlagFromDBMock).not.toHaveBeenCalled();
  });

  it("uses the database value before the default when present", async () => {
    getFeatureFlagFromDBMock.mockResolvedValue(true);

    await expect(isEnabled("commerce_enabled")).resolves.toBe(true);
    expect(getFeatureFlagFromDBMock).toHaveBeenCalledWith("commerce_enabled");
  });
});
