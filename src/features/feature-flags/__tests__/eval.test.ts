import { afterEach, describe, expect, it, vi } from "vitest";
import type { FeatureFlagRecord } from "@/types/feature-flag";

const getFeatureFlagMock = vi.hoisted(() => vi.fn<() => Promise<FeatureFlagRecord | null>>());

vi.mock("@/server/repositories/feature-flag-repository", () => ({
  getFeatureFlag: getFeatureFlagMock,
}));

import { clearFeatureFlagCacheForTests, isEnabled } from "@/features/feature-flags/eval";
import { FEATURE_FLAGS } from "@/features/feature-flags/flags";

describe("feature flag evaluation", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    getFeatureFlagMock.mockReset();
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
    getFeatureFlagMock.mockResolvedValue(null);

    await expect(isEnabled("commerce_enabled")).resolves.toBe(false);
    expect(getFeatureFlagMock).toHaveBeenCalledWith("commerce_enabled");
  });

  it("lets FF_<KEY> env overrides win over the database and default", async () => {
    vi.stubEnv("FF_COMMERCE_ENABLED", "true");
    getFeatureFlagMock.mockResolvedValue(featureFlagRecord("commerce_enabled", false));

    await expect(isEnabled("commerce_enabled")).resolves.toBe(true);
    expect(getFeatureFlagMock).not.toHaveBeenCalled();
  });

  it("accepts false env overrides for default-on flags", async () => {
    vi.stubEnv("FF_ADMIN_PORTAL_ENABLED", "false");
    getFeatureFlagMock.mockResolvedValue(featureFlagRecord("admin_portal_enabled", true));

    await expect(isEnabled("admin_portal_enabled")).resolves.toBe(false);
    expect(getFeatureFlagMock).not.toHaveBeenCalled();
  });

  it("uses the database value before the default when present", async () => {
    getFeatureFlagMock.mockResolvedValue(featureFlagRecord("commerce_enabled", true));

    await expect(isEnabled("commerce_enabled")).resolves.toBe(true);
    expect(getFeatureFlagMock).toHaveBeenCalledWith("commerce_enabled");
  });
});

function featureFlagRecord(key: string, enabled: boolean): FeatureFlagRecord {
  return {
    key,
    enabled,
    description: null,
    category: "feature",
    updated_at: "2026-05-23T00:00:00.000Z",
    updated_by: null,
  };
}
