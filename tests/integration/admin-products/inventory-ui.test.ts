import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProductVariantRecord } from "@/types/product";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findProductVariantByIdForAdmin: vi.fn(),
  findProductVariantsByIdsForAdmin: vi.fn(),
  insertProductVariantForAdmin: vi.fn(),
  updateProductVariantForAdmin: vi.fn(),
  updateProductVariantForAdminIfFresh: vi.fn(),
  appendMovement: vi.fn(),
  listMovementsForVariant: vi.fn(),
  listMovementsForProduct: vi.fn(),
  listMovementsForOrder: vi.fn(),
  listMovementsByReason: vi.fn(),
  listMovementsByActor: vi.fn(),
  listMovementsByDateRange: vi.fn(),
  record: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/policies", () => ({
  requireAdmin: mocks.requireAdmin,
}));

vi.mock("@/server/repositories/product-admin-repository", () => ({
  findProductVariantByIdForAdmin: mocks.findProductVariantByIdForAdmin,
  findProductVariantsByIdsForAdmin: mocks.findProductVariantsByIdsForAdmin,
  insertProductVariantForAdmin: mocks.insertProductVariantForAdmin,
  updateProductVariantForAdmin: mocks.updateProductVariantForAdmin,
  updateProductVariantForAdminIfFresh: mocks.updateProductVariantForAdminIfFresh,
}));

vi.mock("@/server/repositories/inventory-movement-repository", () => ({
  appendMovement: mocks.appendMovement,
  listMovementsForVariant: mocks.listMovementsForVariant,
  listMovementsForProduct: mocks.listMovementsForProduct,
  listMovementsForOrder: mocks.listMovementsForOrder,
  listMovementsByReason: mocks.listMovementsByReason,
  listMovementsByActor: mocks.listMovementsByActor,
  listMovementsByDateRange: mocks.listMovementsByDateRange,
}));

vi.mock("@/features/audit-log/record", () => ({
  record: mocks.record,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

describe("admin inventory UI contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({
      userId: "00000000-0000-4000-8000-000000000100",
      email: "admin@example.test",
      role: "admin",
    });
  });

  it("creates a variant through the UI action contract and records initial stock", async () => {
    const variant = variantFactory({ stock_quantity: 12, low_stock_threshold: 5 });
    mocks.insertProductVariantForAdmin.mockResolvedValueOnce(variant);
    mocks.appendMovement.mockResolvedValueOnce(
      movementFactory({ previous_quantity: null, new_quantity: 12, change_amount: 12 }),
    );

    const { createProductVariant } = await import("@/features/admin-products/actions");
    const result = await createProductVariant({
      productId: variant.product_id,
      flavor: "Chocolate",
      size: "2kg",
      sku: "SKU-2KG-CHOC",
      priceAed: 199,
      stockQuantity: 12,
      lowStockThreshold: 5,
    });

    expect(result).toMatchObject({ ok: true, variant: { id: variant.id } });
    expect(mocks.insertProductVariantForAdmin).toHaveBeenCalledWith(
      expect.objectContaining({
        product_id: variant.product_id,
        stock_quantity: 12,
        low_stock_threshold: 5,
      }),
    );
    expect(mocks.appendMovement).toHaveBeenCalledWith(
      expect.objectContaining({
        previous_quantity: null,
        new_quantity: 12,
        change_amount: 12,
        reason: "manual_adjustment",
      }),
    );
    expect(mocks.record).toHaveBeenCalledWith(
      expect.objectContaining({
        diff: expect.objectContaining({
          action: "variant_create",
          entity_type: "product_variant",
          previous_quantity: null,
          new_quantity: 12,
        }),
      }),
    );
  });

  it("archives a variant by zeroing stock so inventory history is preserved", async () => {
    const before = variantFactory({ stock_quantity: 8 });
    const after = variantFactory({ stock_quantity: 0, stock_status: "out_of_stock" });
    mocks.findProductVariantByIdForAdmin.mockResolvedValueOnce(before);
    mocks.updateProductVariantForAdminIfFresh.mockResolvedValueOnce(after);
    mocks.appendMovement.mockResolvedValueOnce(
      movementFactory({ previous_quantity: 8, new_quantity: 0, change_amount: -8 }),
    );

    const { archiveProductVariant } = await import("@/features/admin-products/actions");
    const result = await archiveProductVariant({
      variantId: before.id,
      expectedUpdatedAt: before.updated_at,
      changeReasonNote: "Archived from admin variant table.",
    });

    expect(result).toMatchObject({ ok: true, variant: { stock_quantity: 0 } });
    expect(mocks.updateProductVariantForAdminIfFresh).toHaveBeenCalledWith(
      before.id,
      before.updated_at,
      { stock_quantity: 0 },
    );
    expect(mocks.record).toHaveBeenCalledWith(
      expect.objectContaining({
        diff: expect.objectContaining({
          action: "variant_delete",
          changes: expect.arrayContaining([
            { field: "variant_archived", before: false, after: true },
          ]),
        }),
      }),
    );
  });
});

function variantFactory(overrides: Partial<ProductVariantRecord> = {}): ProductVariantRecord {
  return {
    id: "00000000-0000-4000-8000-000000000200",
    product_id: "00000000-0000-4000-8000-000000000001",
    flavor: "Chocolate",
    size: "2kg",
    sku: "SKU-1",
    barcode: null,
    price_aed: 99,
    stock_status: "in_stock",
    stock_quantity: 5,
    low_stock_threshold: 5,
    weight_grams: 2000,
    sort_order: 0,
    created_at: "2026-05-24T14:00:00.000Z",
    updated_at: "2026-05-24T14:00:00.000Z",
    ...overrides,
  };
}

function movementFactory(
  overrides: Partial<{
    id: string;
    product_id: string;
    variant_id: string;
    previous_quantity: number | null;
    new_quantity: number;
    change_amount: number;
    reason: "manual_adjustment";
    change_reason_note: string | null;
    changed_by: string | null;
    changed_at: string;
    order_id: string | null;
  }> = {},
) {
  return {
    id: "00000000-0000-4000-8000-000000000300",
    product_id: "00000000-0000-4000-8000-000000000001",
    variant_id: "00000000-0000-4000-8000-000000000200",
    previous_quantity: null,
    new_quantity: 12,
    change_amount: 12,
    reason: "manual_adjustment" as const,
    change_reason_note: null,
    changed_by: "00000000-0000-4000-8000-000000000100",
    changed_at: "2026-05-24T14:01:00.000Z",
    order_id: null,
    ...overrides,
  };
}
