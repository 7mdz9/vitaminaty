import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProductImageRecord, ProductRecord } from "@/types/product";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findProductEditorDataForAdmin: vi.fn(),
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

describe("admin product drawer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({
      userId: "00000000-0000-4000-8000-000000000100",
      email: "admin@example.test",
      role: "admin",
    });
    mocks.listProductGoalTagsForAdmin.mockResolvedValue([]);
  });

  it("requires admin auth and returns drawer data", async () => {
    const product = productFactory();
    mocks.findProductEditorDataForAdmin.mockResolvedValueOnce({
      product,
      variants: [],
      images: [],
      goalTags: [],
    });

    const { getProductDrawerData } = await import("@/features/admin-products/actions");
    const result = await getProductDrawerData(product.id);

    expect(result).toMatchObject({
      ok: true,
      data: {
        product: { id: product.id },
      },
    });
    expect(mocks.requireAdmin).toHaveBeenCalledTimes(1);
    expect(mocks.findProductEditorDataForAdmin).toHaveBeenCalledWith(product.id);
  });

  it("rejects non-image uploads before storage write", async () => {
    const product = productFactory();
    mocks.findProductByIdForAdmin.mockResolvedValueOnce(product);
    mocks.listProductImagesForAdmin.mockResolvedValueOnce([]);

    const { uploadProductImage } = await import("@/features/admin-products/actions");
    const result = await uploadProductImage(
      uploadForm(product.id, new File(["not image"], "note.txt", { type: "text/plain" })),
    );

    expect(result).toMatchObject({
      ok: false,
      code: "validation_error",
    });
    expect(mocks.uploadProductImageAssetForAdmin).not.toHaveBeenCalled();
    expect(mocks.insertProductImageForAdmin).not.toHaveBeenCalled();
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it("uploads, persists, and audit-logs a primary product image", async () => {
    const before = productFactory({
      admin_review_flags: { missing_image: true, missing_stock_quantity: true },
    });
    const after = productFactory({
      admin_review_flags: { missing_image: false, missing_stock_quantity: true },
      fields_status: {
        ...before.fields_status,
        image: "complete",
      },
      completion_score: 15,
      updated_at: "2026-05-24T12:01:00.000Z",
    });
    const image = imageFactory({ product_id: before.id });
    mocks.findProductByIdForAdmin.mockResolvedValueOnce(before);
    mocks.listProductImagesForAdmin.mockResolvedValueOnce([]);
    mocks.uploadProductImageAssetForAdmin.mockResolvedValueOnce({ publicUrl: image.public_url });
    mocks.insertProductImageForAdmin.mockResolvedValueOnce(image);
    mocks.updateProductForAdmin.mockResolvedValueOnce(after);

    const { uploadProductImage } = await import("@/features/admin-products/actions");
    const result = await uploadProductImage(
      uploadForm(before.id, new File(["png"], "front.png", { type: "image/png" })),
    );

    expect(result).toMatchObject({
      ok: true,
      product: { id: before.id, completion_score: 15 },
      image: { id: image.id },
    });
    expect(mocks.clearPrimaryProductImagesForAdmin).toHaveBeenCalledWith(before.id);
    expect(mocks.insertProductImageForAdmin).toHaveBeenCalledWith(
      expect.objectContaining({
        product_id: before.id,
        kind: "front",
        is_primary: true,
        public_url: image.public_url,
      }),
    );
    expect(mocks.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: { userId: "00000000-0000-4000-8000-000000000100", email: "admin@example.test" },
        entityId: before.id,
        diff: expect.objectContaining({
          action: "image_upload",
          entity_type: "product",
          product_id: before.id,
          changes: expect.arrayContaining([
            expect.objectContaining({ field: "product_images" }),
            { field: "admin_review_flags.missing_image", before: true, after: false },
          ]),
        }),
      }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/products");
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/admin/products/${before.id}`);
  });
});

function uploadForm(productId: string, file: File): FormData {
  const formData = new FormData();
  formData.set("productId", productId);
  formData.set("file", file);
  formData.set("kind", "front");
  formData.set("isPrimary", "true");
  return formData;
}

function imageFactory(overrides: Partial<ProductImageRecord> = {}): ProductImageRecord {
  return {
    id: "00000000-0000-4000-8000-000000000200",
    product_id: "00000000-0000-4000-8000-000000000001",
    variant_id: null,
    storage_path: "products/test/test-product/front-abc.png",
    public_url:
      "http://127.0.0.1:54321/storage/v1/object/public/product-images/products/test/test-product/front-abc.png",
    alt_text: "Test Product - front",
    kind: "front",
    sort_order: 0,
    is_primary: true,
    created_at: "2026-05-24T12:00:00.000Z",
    ...overrides,
  };
}

function productFactory(overrides: Partial<ProductRecord> = {}): ProductRecord {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    slug: "test-product",
    name: "Test Product",
    name_raw: "Test Product",
    brand_id: null,
    brand_raw: "Test",
    category_id: null,
    source_category: "Imported",
    form: null,
    source_file: "product.md",
    source_row: [1],
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
    created_at: "2026-05-24T12:00:00.000Z",
    updated_at: "2026-05-24T12:00:00.000Z",
    published_at: null,
    ...overrides,
  };
}
