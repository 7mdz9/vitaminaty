import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProductRecord } from "@/types/product";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findProductEditorDataForAdmin: vi.fn(),
  findProductsByIdsForAdmin: vi.fn(),
  bulkUpdateProductsForAdmin: vi.fn(),
  findProductByIdForAdmin: vi.fn(),
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
  findProductEditorDataForAdmin: mocks.findProductEditorDataForAdmin,
  findProductsByIdsForAdmin: mocks.findProductsByIdsForAdmin,
  bulkUpdateProductsForAdmin: mocks.bulkUpdateProductsForAdmin,
  findProductByIdForAdmin: mocks.findProductByIdForAdmin,
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

describe("admin product bulk actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({
      userId: "00000000-0000-4000-8000-000000000100",
      email: "admin@example.test",
      role: "admin",
    });
  });

  it("bulk assigns category and writes one bulk_operation audit row", async () => {
    const before = [
      productFactory({ id: "00000000-0000-4000-8000-000000000001", category_id: null }),
      productFactory({ id: "00000000-0000-4000-8000-000000000002", category_id: null }),
    ];
    const categoryId = "00000000-0000-4000-8000-000000000099";
    mocks.findProductsByIdsForAdmin.mockResolvedValueOnce(before);
    mocks.bulkUpdateProductsForAdmin.mockResolvedValueOnce(
      before.map((product) => ({ ...product, category_id: categoryId })),
    );

    const { bulkAssignCategory } = await import("@/features/admin-products/actions");
    const result = await bulkAssignCategory({
      productIds: before.map((product) => product.id),
      categoryId,
    });

    expect(result).toMatchObject({
      ok: true,
      updatedProductIds: before.map((product) => product.id),
    });
    expect(mocks.record).toHaveBeenCalledTimes(1);
    expect(mocks.record).toHaveBeenCalledWith(
      expect.objectContaining({
        diff: expect.objectContaining({
          action: "bulk_operation",
          operation: "assign_category",
          affected_count: 2,
        }),
      }),
    );
  });

  it("requires force override when selected publish candidates have review flags", async () => {
    const product = productFactory({
      id: "00000000-0000-4000-8000-000000000003",
      brand_id: "00000000-0000-4000-8000-000000000010",
      retail_price_aed: 99,
      admin_review_flags: { missing_image: true },
    });
    mocks.findProductsByIdsForAdmin.mockResolvedValueOnce([product]);

    const { bulkPublish } = await import("@/features/admin-products/actions");
    const result = await bulkPublish({ productIds: [product.id], forceOverride: false });

    expect(result).toMatchObject({
      ok: false,
      error: "force_override_required",
      reviewFlagsByProductId: {
        [product.id]: ["missing_image"],
      },
    });
    expect(mocks.bulkUpdateProductsForAdmin).not.toHaveBeenCalled();
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it("excludes hard-blocked products and records override reason", async () => {
    const publishable = productFactory({
      id: "00000000-0000-4000-8000-000000000004",
      brand_id: "00000000-0000-4000-8000-000000000010",
      retail_price_aed: 99,
      admin_review_flags: { missing_image: true },
    });
    const blocked = productFactory({
      id: "00000000-0000-4000-8000-000000000005",
      brand_id: "00000000-0000-4000-8000-000000000010",
      retail_price_aed: 99,
      admin_review_flags: { case_pack: true },
    });
    mocks.findProductsByIdsForAdmin.mockResolvedValueOnce([publishable, blocked]);
    mocks.bulkUpdateProductsForAdmin.mockResolvedValueOnce([
      { ...publishable, status: "published" },
    ]);

    const { bulkPublish } = await import("@/features/admin-products/actions");
    const result = await bulkPublish({
      productIds: [publishable.id, blocked.id],
      forceOverride: true,
      overrideReason: "Label image is queued for tomorrow.",
    });

    expect(result).toMatchObject({
      ok: true,
      updatedProductIds: [publishable.id],
      hardBlockedProductIds: [blocked.id],
    });
    expect(mocks.bulkUpdateProductsForAdmin).toHaveBeenCalledWith([publishable.id], {
      status: "published",
      is_public_visible: true,
    });
    expect(mocks.record).toHaveBeenCalledWith(
      expect.objectContaining({
        diff: expect.objectContaining({
          action: "bulk_publish_override",
          published_product_ids: [publishable.id],
          hard_blocked_product_ids: [blocked.id],
          override_reason: "Label image is queued for tomorrow.",
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
    retail_price_aed: null,
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
    admin_review_flags: {},
    created_at: "2026-05-24T12:00:00.000Z",
    updated_at: "2026-05-24T12:00:00.000Z",
    published_at: null,
    ...overrides,
  };
}
