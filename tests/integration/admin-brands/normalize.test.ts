import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BrandRecord } from "@/types/brand";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findBrandByIdForAdmin: vi.fn(),
  updateBrand: vi.fn(),
  updateBrandIfFresh: vi.fn(),
  upsertBrand: vi.fn(),
  countFeaturedHomepageBrandsForAdmin: vi.fn(),
  addBrandAliasAndRecomputeProductsForAdmin: vi.fn(),
  uploadBrandImageAssetForAdmin: vi.fn(),
  record: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/policies", () => ({
  requireAdmin: mocks.requireAdmin,
}));

vi.mock("@/server/repositories/brand-admin-repository", () => ({
  findBrandByIdForAdmin: mocks.findBrandByIdForAdmin,
  updateBrand: mocks.updateBrand,
  updateBrandIfFresh: mocks.updateBrandIfFresh,
  upsertBrand: mocks.upsertBrand,
  countFeaturedHomepageBrandsForAdmin: mocks.countFeaturedHomepageBrandsForAdmin,
  addBrandAliasAndRecomputeProductsForAdmin: mocks.addBrandAliasAndRecomputeProductsForAdmin,
  uploadBrandImageAssetForAdmin: mocks.uploadBrandImageAssetForAdmin,
}));

vi.mock("@/features/audit-log/record", () => ({
  record: mocks.record,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

describe("admin brand normalization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({
      userId: "00000000-0000-4000-8000-000000000100",
      email: "admin@example.test",
      role: "admin",
    });
  });

  it("adds an alias and recomputes affected products in one repository contract", async () => {
    const before = brandFactory({ aliases: ["ON"] });
    const after = brandFactory({ aliases: ["ON", "Optimum Nutrition"] });
    mocks.findBrandByIdForAdmin.mockResolvedValueOnce(before).mockResolvedValueOnce(after);
    mocks.addBrandAliasAndRecomputeProductsForAdmin.mockResolvedValueOnce([
      {
        product_id: "00000000-0000-4000-8000-000000000201",
        previous_brand_id: null,
        new_brand_id: after.id,
      },
    ]);

    const { addBrandAlias } = await import("@/features/admin-brands/actions");
    const result = await addBrandAlias({
      brandId: before.id,
      alias: "Optimum Nutrition",
    });

    expect(result).toMatchObject({
      ok: true,
      brand: { id: before.id },
      affectedProductIds: ["00000000-0000-4000-8000-000000000201"],
    });
    expect(mocks.addBrandAliasAndRecomputeProductsForAdmin).toHaveBeenCalledWith(
      before.id,
      "Optimum Nutrition",
    );
    expect(mocks.record).toHaveBeenCalledWith(
      expect.objectContaining({
        diff: expect.objectContaining({
          action: "update",
          entity_type: "brand",
          brand_id: before.id,
          changes: expect.arrayContaining([
            { field: "aliases", before: ["ON"], after: ["ON", "Optimum Nutrition"] },
          ]),
        }),
      }),
    );
  });

  it("blocks a third featured brand before writing", async () => {
    const brand = brandFactory({ is_featured_homepage_brand: false });
    mocks.findBrandByIdForAdmin.mockResolvedValueOnce(brand);
    mocks.countFeaturedHomepageBrandsForAdmin.mockResolvedValueOnce(2);

    const { updateBrand } = await import("@/features/admin-brands/actions");
    const result = await updateBrand({
      brandId: brand.id,
      expectedUpdatedAt: brand.updated_at,
      force: false,
      patch: { is_featured_homepage_brand: true },
    });

    expect(result).toMatchObject({
      ok: false,
      code: "featured_limit",
    });
    expect(mocks.updateBrandIfFresh).not.toHaveBeenCalled();
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it("returns stale_data without auditing when expected_updated_at misses", async () => {
    const before = brandFactory({ updated_at: "2026-05-24T14:00:00.000Z" });
    const current = brandFactory({ updated_at: "2026-05-24T14:05:00.000Z" });
    mocks.findBrandByIdForAdmin.mockResolvedValueOnce(before).mockResolvedValueOnce(current);
    mocks.updateBrandIfFresh.mockResolvedValueOnce(null);

    const { updateBrand } = await import("@/features/admin-brands/actions");
    const result = await updateBrand({
      brandId: before.id,
      expectedUpdatedAt: before.updated_at,
      force: false,
      patch: { display_name: "Updated Brand" },
    });

    expect(result).toMatchObject({
      ok: false,
      code: "stale_data",
      current: { updated_at: current.updated_at },
    });
    expect(mocks.record).not.toHaveBeenCalled();
  });
});

function brandFactory(overrides: Partial<BrandRecord> = {}): BrandRecord {
  return {
    id: "00000000-0000-4000-8000-000000000010",
    display_name: "Optimum Nutrition",
    slug: "optimum-nutrition",
    aliases: ["ON"],
    logo_url: null,
    hero_image_url: null,
    country_of_origin: null,
    short_description: null,
    long_description: null,
    is_visible_on_directory: false,
    is_featured_homepage_brand: false,
    brand_tier: null,
    created_at: "2026-05-24T14:00:00.000Z",
    updated_at: "2026-05-24T14:00:00.000Z",
    ...overrides,
  };
}
