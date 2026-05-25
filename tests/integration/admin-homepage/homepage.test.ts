import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HomepageConfigRecord } from "@/types/homepage";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getHomepageConfigForAdmin: vi.fn(),
  listHomepageProductsByIdsForAdmin: vi.fn(),
  listHomepageBrandsByIdsForAdmin: vi.fn(),
  updateHomepageConfigForAdminIfFresh: vi.fn(),
  record: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/policies", () => ({
  requireAdmin: mocks.requireAdmin,
}));

vi.mock("@/server/repositories/homepage-config-admin-repository", () => ({
  getHomepageConfigForAdmin: mocks.getHomepageConfigForAdmin,
  listHomepageProductsByIdsForAdmin: mocks.listHomepageProductsByIdsForAdmin,
  listHomepageBrandsByIdsForAdmin: mocks.listHomepageBrandsByIdsForAdmin,
  updateHomepageConfigForAdminIfFresh: mocks.updateHomepageConfigForAdminIfFresh,
}));

vi.mock("@/features/audit-log/record", () => ({
  record: mocks.record,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

describe("admin homepage curation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({
      userId: "00000000-0000-4000-8000-000000000100",
      email: "admin@example.test",
      role: "admin",
    });
    mocks.listHomepageProductsByIdsForAdmin.mockResolvedValue([
      {
        id: productId(1),
        name: "Whey",
        slug: "whey",
        status: "draft",
        brandName: null,
        primaryImageUrl: null,
      },
      {
        id: productId(2),
        name: "Creatine",
        slug: "creatine",
        status: "draft",
        brandName: null,
        primaryImageUrl: null,
      },
    ]);
    mocks.listHomepageBrandsByIdsForAdmin.mockResolvedValue([
      { id: brandId(1), displayName: "Scitec", slug: "scitec", logoUrl: null, heroImageUrl: null },
    ]);
  });

  it("updates homepage config with stale protection and writes a homepage_config audit row", async () => {
    const before = homepageFactory();
    const after = homepageFactory({
      hero_title: "Fuel better",
      new_arrival_product_ids: [productId(1), productId(2)],
      featured_brand_ids: [brandId(1)],
      updated_at: "2026-05-25T09:01:00.000Z",
    });
    mocks.getHomepageConfigForAdmin.mockResolvedValueOnce(before);
    mocks.updateHomepageConfigForAdminIfFresh.mockResolvedValueOnce(after);

    const { updateHomepageConfig } = await import("@/features/admin-homepage/actions");
    const result = await updateHomepageConfig({
      configId: before.id,
      expectedUpdatedAt: before.updated_at,
      heroTitle: "Fuel better",
      heroSubtitle: before.hero_subtitle,
      heroCtaLabel: before.hero_cta_label,
      heroCtaHref: before.hero_cta_href,
      promoBannerText: "",
      promoBannerHref: "",
      newArrivalProductIds: [productId(1), productId(2)],
      bestsellerProductIds: [],
      featuredBrandIds: [brandId(1)],
      goalOrder: ["build_muscle", "boost_energy", "recovery"],
    });

    expect(result).toMatchObject({ ok: true, config: { hero_title: "Fuel better" } });
    expect(mocks.requireAdmin).toHaveBeenCalledTimes(1);
    expect(mocks.updateHomepageConfigForAdminIfFresh).toHaveBeenCalledWith(
      before.id,
      before.updated_at,
      expect.objectContaining({
        hero_title: "Fuel better",
        promo_banner_text: null,
        new_arrival_product_ids: [productId(1), productId(2)],
        featured_brand_ids: [brandId(1)],
      }),
    );
    expect(mocks.record).toHaveBeenCalledWith(
      expect.objectContaining({
        diff: expect.objectContaining({
          action: "update",
          entity_type: "homepage_config",
          homepage_config_id: before.id,
        }),
      }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/homepage");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/");
  });

  it("returns stale_data without audit when the config changed after load", async () => {
    const before = homepageFactory();
    const current = homepageFactory({ updated_at: "2026-05-25T09:05:00.000Z" });
    mocks.getHomepageConfigForAdmin.mockResolvedValueOnce(before).mockResolvedValueOnce(current);
    mocks.updateHomepageConfigForAdminIfFresh.mockResolvedValueOnce(null);

    const { updateHomepageConfig } = await import("@/features/admin-homepage/actions");
    const result = await updateHomepageConfig({
      configId: before.id,
      expectedUpdatedAt: before.updated_at,
      heroTitle: before.hero_title,
      heroSubtitle: before.hero_subtitle,
      heroCtaLabel: before.hero_cta_label,
      heroCtaHref: before.hero_cta_href,
      newArrivalProductIds: [],
      bestsellerProductIds: [],
      featuredBrandIds: [],
      goalOrder: ["build_muscle"],
    });

    expect(result).toMatchObject({
      ok: false,
      code: "stale_data",
      current: { updated_at: current.updated_at },
    });
    expect(mocks.record).not.toHaveBeenCalled();
  });
});

function homepageFactory(overrides: Partial<HomepageConfigRecord> = {}): HomepageConfigRecord {
  return {
    id: "00000000-0000-4000-8000-000000000500",
    singleton_key: "homepage",
    hero_title: "Vitaminaty",
    hero_subtitle: "Supplements in the UAE",
    hero_cta_label: "Shop products",
    hero_cta_href: "/products",
    promo_banner_text: null,
    promo_banner_href: null,
    promo_starts_at: null,
    promo_ends_at: null,
    new_arrival_product_ids: [],
    bestseller_product_ids: [],
    featured_brand_ids: [],
    goal_order: ["build_muscle", "boost_energy", "recovery"],
    updated_by: null,
    created_at: "2026-05-25T09:00:00.000Z",
    updated_at: "2026-05-25T09:00:00.000Z",
    ...overrides,
  };
}

function productId(slot: number): string {
  return `00000000-0000-4000-8000-00000000010${slot}`;
}

function brandId(slot: number): string {
  return `00000000-0000-4000-8000-00000000020${slot}`;
}
