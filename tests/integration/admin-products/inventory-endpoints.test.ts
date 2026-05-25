import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProductVariantRecord } from "@/types/product";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findProductVariantByIdForAdmin: vi.fn(),
  findProductVariantsByIdsForAdmin: vi.fn(),
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

describe("admin inventory endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({
      userId: "00000000-0000-4000-8000-000000000100",
      email: "admin@example.test",
      role: "admin",
    });
  });

  it("sets variant stock, appends movement, and writes a stock_adjustment audit row", async () => {
    const before = variantFactory({ stock_quantity: 5 });
    const updated = variantFactory({ stock_quantity: 12, updated_at: "2026-05-24T14:01:00.000Z" });
    const movement = movementFactory({ previous_quantity: 5, new_quantity: 12, change_amount: 7 });
    mocks.findProductVariantByIdForAdmin.mockResolvedValueOnce(before);
    mocks.updateProductVariantForAdminIfFresh.mockResolvedValueOnce(updated);
    mocks.appendMovement.mockResolvedValueOnce(movement);

    const { setVariantStock } = await import("@/features/admin-products/actions");
    const result = await setVariantStock({
      variantId: before.id,
      expectedUpdatedAt: before.updated_at,
      newQuantity: 12,
      changeReasonNote: "Shelf refill",
    });

    expect(result).toMatchObject({ ok: true, variant: { stock_quantity: 12 } });
    expect(mocks.updateProductVariantForAdminIfFresh).toHaveBeenCalledWith(
      before.id,
      before.updated_at,
      { stock_quantity: 12 },
    );
    expect(mocks.appendMovement).toHaveBeenCalledWith(
      expect.objectContaining({
        previous_quantity: 5,
        new_quantity: 12,
        change_amount: 7,
        reason: "manual_adjustment",
      }),
    );
    expect(mocks.record).toHaveBeenCalledWith(
      expect.objectContaining({
        diff: expect.objectContaining({
          action: "stock_adjustment",
          entity_type: "product_variant",
          previous_quantity: 5,
          new_quantity: 12,
        }),
      }),
    );
  });

  it("returns stale_data without appending movement or audit when expected_updated_at differs", async () => {
    const before = variantFactory();
    const current = variantFactory({ updated_at: "2026-05-24T14:05:00.000Z" });
    mocks.findProductVariantByIdForAdmin
      .mockResolvedValueOnce(before)
      .mockResolvedValueOnce(current);
    mocks.updateProductVariantForAdminIfFresh.mockResolvedValueOnce(null);

    const { setVariantStock } = await import("@/features/admin-products/actions");
    const result = await setVariantStock({
      variantId: before.id,
      expectedUpdatedAt: before.updated_at,
      newQuantity: 8,
    });

    expect(result).toMatchObject({
      ok: false,
      code: "stale_data",
      current: { updated_at: current.updated_at },
    });
    expect(mocks.appendMovement).not.toHaveBeenCalled();
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it("blocks negative adjustments with insufficient_stock", async () => {
    const before = variantFactory({ stock_quantity: 2 });
    mocks.findProductVariantByIdForAdmin.mockResolvedValueOnce(before);

    const { adjustVariantStock } = await import("@/features/admin-products/actions");
    const result = await adjustVariantStock({
      variantId: before.id,
      expectedUpdatedAt: before.updated_at,
      delta: -3,
    });

    expect(result).toMatchObject({ ok: false, code: "insufficient_stock" });
    expect(mocks.updateProductVariantForAdminIfFresh).not.toHaveBeenCalled();
    expect(mocks.appendMovement).not.toHaveBeenCalled();
  });

  it("records stock recount discrepancy when change_amount differs from computed delta", async () => {
    const before = variantFactory({ stock_quantity: 10 });
    const updated = variantFactory({ stock_quantity: 12 });
    const movement = movementFactory({
      previous_quantity: 10,
      new_quantity: 12,
      change_amount: 5,
      reason: "stock_recount",
    });
    mocks.findProductVariantByIdForAdmin.mockResolvedValueOnce(before);
    mocks.updateProductVariantForAdminIfFresh.mockResolvedValueOnce(updated);
    mocks.appendMovement.mockResolvedValueOnce(movement);

    const { recountVariantStock } = await import("@/features/admin-products/actions");
    const result = await recountVariantStock({
      variantId: before.id,
      expectedUpdatedAt: before.updated_at,
      newQuantity: 12,
      changeAmount: 5,
      changeReasonNote: "Physical count found discrepancy.",
    });

    expect(result.ok).toBe(true);
    expect(mocks.appendMovement).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: "stock_recount",
        change_amount: 5,
      }),
    );
    expect(mocks.record).toHaveBeenCalledWith(
      expect.objectContaining({
        diff: expect.objectContaining({
          action: "stock_recount",
          changes: expect.arrayContaining([
            { field: "inventory_discrepancy", before: 2, after: 5 },
          ]),
        }),
      }),
    );
  });

  it("updates low-stock threshold without writing stock_status directly", async () => {
    const before = variantFactory({ low_stock_threshold: 5, stock_quantity: 20 });
    const updated = variantFactory({ low_stock_threshold: 9, stock_quantity: 20 });
    mocks.findProductVariantByIdForAdmin.mockResolvedValueOnce(before);
    mocks.updateProductVariantForAdminIfFresh.mockResolvedValueOnce(updated);
    mocks.appendMovement.mockResolvedValueOnce(
      movementFactory({ change_amount: 0, new_quantity: 20 }),
    );

    const { setVariantLowStockThreshold } = await import("@/features/admin-products/actions");
    const result = await setVariantLowStockThreshold({
      variantId: before.id,
      expectedUpdatedAt: before.updated_at,
      lowStockThreshold: 9,
    });

    expect(result.ok).toBe(true);
    expect(mocks.updateProductVariantForAdminIfFresh).toHaveBeenCalledWith(
      before.id,
      before.updated_at,
      { low_stock_threshold: 9 },
    );
    expect(mocks.record).toHaveBeenCalledWith(
      expect.objectContaining({
        diff: expect.objectContaining({
          action: "low_stock_threshold_change",
          changes: [{ field: "low_stock_threshold", before: 5, after: 9 }],
        }),
      }),
    );
  });

  it("bulk-adjusts variants after preflight and writes one movement per variant", async () => {
    const first = variantFactory({ id: "00000000-0000-4000-8000-000000000201", stock_quantity: 5 });
    const second = variantFactory({
      id: "00000000-0000-4000-8000-000000000202",
      stock_quantity: 10,
    });
    mocks.findProductVariantsByIdsForAdmin.mockResolvedValueOnce([first, second]);
    mocks.findProductVariantByIdForAdmin.mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    mocks.updateProductVariantForAdminIfFresh
      .mockResolvedValueOnce({ ...first, stock_quantity: 7 })
      .mockResolvedValueOnce({ ...second, stock_quantity: 8 });
    mocks.appendMovement
      .mockResolvedValueOnce(
        movementFactory({ variant_id: first.id, new_quantity: 7, change_amount: 2 }),
      )
      .mockResolvedValueOnce(
        movementFactory({ variant_id: second.id, new_quantity: 8, change_amount: -2 }),
      );

    const { bulkAdjustVariantStock } = await import("@/features/admin-products/actions");
    const result = await bulkAdjustVariantStock({
      adjustments: [
        { variantId: first.id, expectedUpdatedAt: first.updated_at, delta: 2 },
        { variantId: second.id, expectedUpdatedAt: second.updated_at, delta: -2 },
      ],
      changeReasonNote: "Cycle count batch",
    });

    expect(result).toMatchObject({
      ok: true,
      results: [{ variant: { id: first.id } }, { variant: { id: second.id } }],
    });
    expect(mocks.appendMovement).toHaveBeenCalledTimes(2);
    expect(mocks.record).toHaveBeenCalledTimes(2);
  });

  it("bulk-adjust preflight rolls back the whole batch when one variant is stale", async () => {
    const variants = [
      variantFactory({ id: "00000000-0000-4000-8000-000000000211" }),
      variantFactory({ id: "00000000-0000-4000-8000-000000000212" }),
      variantFactory({
        id: "00000000-0000-4000-8000-000000000213",
        updated_at: "2026-05-24T14:10:00.000Z",
      }),
    ];
    mocks.findProductVariantsByIdsForAdmin.mockResolvedValueOnce(variants);

    const { bulkAdjustVariantStock } = await import("@/features/admin-products/actions");
    const result = await bulkAdjustVariantStock({
      adjustments: [
        { variantId: variants[0].id, expectedUpdatedAt: variants[0].updated_at, delta: 1 },
        { variantId: variants[1].id, expectedUpdatedAt: variants[1].updated_at, delta: 1 },
        { variantId: variants[2].id, expectedUpdatedAt: "2026-05-24T14:00:00.000Z", delta: 1 },
      ],
    });

    expect(result).toMatchObject({
      ok: false,
      code: "stale_data",
      variantId: variants[2].id,
    });
    expect(mocks.updateProductVariantForAdminIfFresh).not.toHaveBeenCalled();
    expect(mocks.appendMovement).not.toHaveBeenCalled();
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it("returns inventory history filtered by variant", async () => {
    const movement = movementFactory();
    mocks.listMovementsForVariant.mockResolvedValueOnce([movement]);

    const { getInventoryHistory } = await import("@/features/admin-products/actions");
    const result = await getInventoryHistory({ variantId: movement.variant_id });

    expect(result).toMatchObject({ ok: true, movements: [{ id: movement.id }] });
    expect(mocks.listMovementsForVariant).toHaveBeenCalledWith(movement.variant_id);
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
    reason: "manual_adjustment" | "stock_recount";
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
    previous_quantity: 5,
    new_quantity: 12,
    change_amount: 7,
    reason: "manual_adjustment" as const,
    change_reason_note: null,
    changed_by: "00000000-0000-4000-8000-000000000100",
    changed_at: "2026-05-24T14:01:00.000Z",
    order_id: null,
    ...overrides,
  };
}
