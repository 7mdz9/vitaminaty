import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProductRecord } from "@/types/product";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findProductByIdForAdmin: vi.fn(),
  findManyForAdmin: vi.fn(),
  listBrandOptionsForAdmin: vi.fn(),
  listCategoryOptionsForAdmin: vi.fn(),
  listProductImagesForAdmin: vi.fn(),
  listProductGoalTagsForAdmin: vi.fn(),
  updateProductForAdmin: vi.fn(),
  updateProductForAdminIfFresh: vi.fn(),
  uploadProductImageAssetForAdmin: vi.fn(),
  insertProductImageForAdmin: vi.fn(),
  clearPrimaryProductImagesForAdmin: vi.fn(),
  record: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/policies", () => ({
  requireAdmin: mocks.requireAdmin,
}));

vi.mock("@/server/repositories/product-admin-repository", () => ({
  findProductByIdForAdmin: mocks.findProductByIdForAdmin,
  findManyForAdmin: mocks.findManyForAdmin,
  listBrandOptionsForAdmin: mocks.listBrandOptionsForAdmin,
  listCategoryOptionsForAdmin: mocks.listCategoryOptionsForAdmin,
  listProductImagesForAdmin: mocks.listProductImagesForAdmin,
  listProductGoalTagsForAdmin: mocks.listProductGoalTagsForAdmin,
  updateProductForAdmin: mocks.updateProductForAdmin,
  updateProductForAdminIfFresh: mocks.updateProductForAdminIfFresh,
  uploadProductImageAssetForAdmin: mocks.uploadProductImageAssetForAdmin,
  insertProductImageForAdmin: mocks.insertProductImageForAdmin,
  clearPrimaryProductImagesForAdmin: mocks.clearPrimaryProductImagesForAdmin,
}));

vi.mock("@/features/audit-log/record", () => ({
  record: mocks.record,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

describe("admin product list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({
      userId: "00000000-0000-4000-8000-000000000100",
      email: "admin@example.test",
      role: "admin",
    });
    mocks.listProductImagesForAdmin.mockResolvedValue([]);
    mocks.listProductGoalTagsForAdmin.mockResolvedValue([]);
  });

  it("parses URL-backed filters, sort, and pagination", async () => {
    const { parseProductListSearchParams } = await import("@/features/admin-products/queries");

    const parsed = parseProductListSearchParams({
      status: "imported",
      flag: ["missing_price", "needs_brand_review"],
      stock_status: "low_stock",
      sort: "lowest_completion",
      page: "3",
      page_size: "25",
      q: "whey",
      completion_min: "10",
      completion_max: "90",
    });

    expect(parsed).toMatchObject({
      sort: "lowest_completion",
      page: 3,
      pageSize: 25,
      filters: {
        status: "imported",
        reviewFlags: ["missing_price", "needs_brand_review"],
        stockStatus: "low_stock",
        search: "whey",
        completionMin: 10,
        completionMax: 90,
      },
    });
  });

  it("requires admin auth, updates a fresh inline edit, and writes audit", async () => {
    const before = productFactory({ retail_price_aed: 89 });
    const after = productFactory({
      retail_price_aed: 94,
      updated_at: "2026-05-24T10:01:00.000Z",
    });
    mocks.findProductByIdForAdmin.mockResolvedValueOnce(before);
    mocks.updateProductForAdminIfFresh.mockResolvedValueOnce(after);

    const { updateProduct } = await import("@/features/admin-products/actions");
    const result = await updateProduct({
      productId: before.id,
      expectedUpdatedAt: before.updated_at,
      force: false,
      patch: { retail_price_aed: 94 },
    });

    expect(result.ok).toBe(true);
    expect(mocks.requireAdmin).toHaveBeenCalledTimes(1);
    expect(mocks.updateProductForAdminIfFresh).toHaveBeenCalledWith(
      before.id,
      before.updated_at,
      expect.objectContaining({
        retail_price_aed: 94,
        completion_score: 10,
        status: "draft",
      }),
    );
    expect(mocks.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: { userId: "00000000-0000-4000-8000-000000000100", email: "admin@example.test" },
        diff: expect.objectContaining({
          action: "update",
          entity_type: "product",
          product_id: before.id,
          changes: expect.arrayContaining([{ field: "retail_price_aed", before: 89, after: 94 }]),
        }),
      }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/products");
  });

  it("returns stale_data without writing audit when expected_updated_at does not match", async () => {
    const before = productFactory({ updated_at: "2026-05-24T10:00:00.000Z" });
    const current = productFactory({ updated_at: "2026-05-24T10:05:00.000Z" });
    mocks.findProductByIdForAdmin.mockResolvedValueOnce(before).mockResolvedValueOnce(current);
    mocks.updateProductForAdminIfFresh.mockResolvedValueOnce(null);

    const { updateProduct } = await import("@/features/admin-products/actions");
    const result = await updateProduct({
      productId: before.id,
      expectedUpdatedAt: before.updated_at,
      force: false,
      patch: { retail_price_aed: 99 },
    });

    expect(result).toMatchObject({
      ok: false,
      error: "stale_data",
      current: { updated_at: current.updated_at },
    });
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it("force-save records a stale_data_override diff", async () => {
    const before = productFactory({ retail_price_aed: 89 });
    const after = productFactory({
      retail_price_aed: 99,
      updated_at: "2026-05-24T10:06:00.000Z",
    });
    mocks.findProductByIdForAdmin.mockResolvedValueOnce(before);
    mocks.updateProductForAdmin.mockResolvedValueOnce(after);

    const { updateProduct } = await import("@/features/admin-products/actions");
    const result = await updateProduct({
      productId: before.id,
      expectedUpdatedAt: "2026-05-24T09:59:00.000Z",
      force: true,
      patch: { retail_price_aed: 99 },
    });

    expect(result.ok).toBe(true);
    expect(mocks.record).toHaveBeenCalledWith(
      expect.objectContaining({
        diff: expect.objectContaining({
          action: "stale_data_override",
          loaded_updated_at: "2026-05-24T09:59:00.000Z",
          database_updated_at: before.updated_at,
        }),
      }),
    );
  });
});

function productFactory(overrides: Partial<ProductRecord> = {}): ProductRecord {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    slug: "test-product",
    name: "Test Product",
    name_raw: "Test Product",
    brand_id: null,
    brand_raw: null,
    category_id: null,
    source_category: null,
    form: null,
    source_file: "product.md",
    source_row: [],
    source_notes: null,
    retail_price_aed: 89,
    wholesale_price_internal: null,
    compare_at_price_aed: null,
    status: "imported",
    is_public_visible: false,
    is_add_to_cart_enabled: false,
    is_checkout_enabled: false,
    completion_score: 0,
    featured_score: 0,
    content: {},
    label_data: {},
    fields_status: {
      name: "missing",
      brand: "missing",
      category: "missing",
      form: "missing",
      retail_price: "missing",
      description: "missing",
      benefits: "missing",
      image: "missing",
      nutrition_panel: "missing",
      ingredients: "missing",
      allergens: "missing",
      directions: "missing",
      warnings: "missing",
      storage: "missing",
      seo_title: "missing",
      seo_description: "missing",
      often_bought_with: "missing",
    },
    admin_review_flags: { missing_stock_quantity: true },
    created_at: "2026-05-24T10:00:00.000Z",
    updated_at: "2026-05-24T10:00:00.000Z",
    published_at: null,
    ...overrides,
  };
}
