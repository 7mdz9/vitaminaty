import "server-only";

import { record } from "@/features/audit-log/record";
import {
  appendMovement,
  listMovementsByActor,
  listMovementsByDateRange,
  listMovementsByReason,
  listMovementsForOrder,
  listMovementsForProduct,
  listMovementsForVariant,
} from "@/server/repositories/inventory-movement-repository";
import {
  findProductVariantByIdForAdmin,
  findProductVariantsByIdsForAdmin,
  insertProductVariantForAdmin,
  updateProductVariantForAdmin,
  updateProductVariantForAdminIfFresh,
} from "@/server/repositories/product-admin-repository";
import type { AuditActor } from "@/server/services/audit-service";
import type { AuditFieldChange, AuditVariantStockAction } from "@/lib/audit/diff-types";
import type { Database } from "@/lib/supabase/types.generated";
import type { ProductVariantRecord } from "@/types/product";

type InventoryMovementRow = Database["public"]["Tables"]["inventory_movements"]["Row"];
type InventoryMovementReason = Database["public"]["Enums"]["inventory_movement_reason"];

type InventoryOperationResult =
  | Readonly<{
      ok: true;
      before: ProductVariantRecord;
      variant: ProductVariantRecord;
      movement: InventoryMovementRow;
    }>
  | Readonly<{
      ok: false;
      code: "not_found" | "stale_data" | "insufficient_stock";
      message: string;
      current?: ProductVariantRecord | null;
    }>;

type InventoryActorInput = Readonly<{
  actor: AuditActor;
}>;

export type SetVariantStockInput = InventoryActorInput &
  Readonly<{
    variantId: string;
    expectedUpdatedAt: string;
    newQuantity: number;
    changeReasonNote?: string | null;
    force: boolean;
  }>;

export type AdjustVariantStockInput = InventoryActorInput &
  Readonly<{
    variantId: string;
    expectedUpdatedAt: string;
    delta: number;
    changeReasonNote?: string | null;
    force: boolean;
  }>;

export type RecountVariantStockInput = InventoryActorInput &
  Readonly<{
    variantId: string;
    expectedUpdatedAt: string;
    newQuantity: number;
    changeAmount?: number;
    changeReasonNote?: string | null;
    force: boolean;
  }>;

export type SetVariantLowStockThresholdInput = InventoryActorInput &
  Readonly<{
    variantId: string;
    expectedUpdatedAt: string;
    lowStockThreshold: number;
    changeReasonNote?: string | null;
    force: boolean;
  }>;

export type BulkAdjustVariantStockInput = InventoryActorInput &
  Readonly<{
    adjustments: ReadonlyArray<{
      variantId: string;
      expectedUpdatedAt: string;
      delta: number;
    }>;
    changeReasonNote?: string | null;
  }>;

export type InventoryHistoryInput = Readonly<{
  productId?: string;
  variantId?: string;
  orderId?: string;
  reason?: InventoryMovementReason;
  actorUserId?: string;
  start?: string;
  end?: string;
}>;

export type CreateProductVariantInput = InventoryActorInput &
  Readonly<{
    productId: string;
    flavor?: string | null;
    size: string;
    sku?: string | null;
    barcode?: string | null;
    priceAed: number;
    stockQuantity: number;
    lowStockThreshold: number;
    weightGrams?: number | null;
  }>;

export type ArchiveProductVariantInput = InventoryActorInput &
  Readonly<{
    variantId: string;
    expectedUpdatedAt: string;
    changeReasonNote?: string | null;
  }>;

export type BulkAdjustVariantStockResult =
  | Readonly<{
      ok: true;
      results: Array<Extract<InventoryOperationResult, { ok: true }>>;
    }>
  | Readonly<{
      ok: false;
      code: "not_found" | "stale_data" | "insufficient_stock";
      message: string;
      variantId?: string;
      current?: ProductVariantRecord | null;
    }>;

export async function setVariantStock(
  input: SetVariantStockInput,
): Promise<InventoryOperationResult> {
  const before = await findProductVariantByIdForAdmin(input.variantId);

  if (!before) {
    return notFound();
  }

  return updateQuantityAndAppendMovement({
    action: "stock_adjustment",
    before,
    expectedUpdatedAt: input.expectedUpdatedAt,
    newQuantity: input.newQuantity,
    changeAmount: input.newQuantity - (before.stock_quantity ?? 0),
    reason: "manual_adjustment",
    changeReasonNote: input.changeReasonNote ?? null,
    actor: input.actor,
    force: input.force,
    changes: [
      { field: "stock_quantity", before: before.stock_quantity, after: input.newQuantity },
    ],
  });
}

export async function adjustVariantStock(
  input: AdjustVariantStockInput,
): Promise<InventoryOperationResult> {
  const before = await findProductVariantByIdForAdmin(input.variantId);

  if (!before) {
    return notFound();
  }

  const previousQuantity = before.stock_quantity ?? 0;
  const newQuantity = previousQuantity + input.delta;

  if (newQuantity < 0) {
    return {
      ok: false,
      code: "insufficient_stock",
      message: "Stock adjustment would reduce the variant below zero.",
      current: before,
    };
  }

  return updateQuantityAndAppendMovement({
    action: "stock_adjustment",
    before,
    expectedUpdatedAt: input.expectedUpdatedAt,
    newQuantity,
    changeAmount: input.delta,
    reason: "manual_adjustment",
    changeReasonNote: input.changeReasonNote ?? null,
    actor: input.actor,
    force: input.force,
    changes: [
      { field: "stock_quantity", before: before.stock_quantity, after: newQuantity },
    ],
  });
}

export async function recountVariantStock(
  input: RecountVariantStockInput,
): Promise<InventoryOperationResult> {
  const before = await findProductVariantByIdForAdmin(input.variantId);

  if (!before) {
    return notFound();
  }

  const computedDelta = input.newQuantity - (before.stock_quantity ?? 0);
  const changeAmount = input.changeAmount ?? computedDelta;

  return updateQuantityAndAppendMovement({
    action: "stock_recount",
    before,
    expectedUpdatedAt: input.expectedUpdatedAt,
    newQuantity: input.newQuantity,
    changeAmount,
    reason: "stock_recount",
    changeReasonNote: input.changeReasonNote ?? null,
    actor: input.actor,
    force: input.force,
    changes: [
      { field: "stock_quantity", before: before.stock_quantity, after: input.newQuantity },
      { field: "inventory_discrepancy", before: computedDelta, after: changeAmount },
    ],
  });
}

export async function setVariantLowStockThreshold(
  input: SetVariantLowStockThresholdInput,
): Promise<InventoryOperationResult> {
  const before = await findProductVariantByIdForAdmin(input.variantId);

  if (!before) {
    return notFound();
  }

  const currentQuantity = before.stock_quantity ?? 0;
  const updated = input.force
    ? await updateProductVariantForAdmin(input.variantId, {
        low_stock_threshold: input.lowStockThreshold,
      })
    : await updateProductVariantForAdminIfFresh(input.variantId, input.expectedUpdatedAt, {
        low_stock_threshold: input.lowStockThreshold,
      });

  if (!updated) {
    return stale(input.variantId);
  }

  const movement = await appendMovement({
    product_id: before.product_id,
    variant_id: before.id,
    previous_quantity: before.stock_quantity,
    new_quantity: currentQuantity,
    change_amount: 0,
    reason: "manual_adjustment",
    change_reason_note: input.changeReasonNote ?? "low_stock_threshold_change",
    changed_by: input.actor.userId,
  });

  await writeVariantAudit({
    action: "low_stock_threshold_change",
    before,
    updated,
    previousQuantity: before.stock_quantity,
    newQuantity: currentQuantity,
    changeAmount: 0,
    reason: "manual_adjustment",
    changeReasonNote: input.changeReasonNote ?? null,
    actor: input.actor,
    changes: [
      {
        field: "low_stock_threshold",
        before: before.low_stock_threshold,
        after: input.lowStockThreshold,
      },
    ],
  });

  return {
    ok: true,
    before,
    variant: updated,
    movement,
  };
}

export async function bulkAdjustVariantStock(
  input: BulkAdjustVariantStockInput,
): Promise<BulkAdjustVariantStockResult> {
  const variantIds = input.adjustments.map((adjustment) => adjustment.variantId);
  const variants = await findProductVariantsByIdsForAdmin(variantIds);
  const variantsById = new Map(variants.map((variant) => [variant.id, variant]));

  for (const adjustment of input.adjustments) {
    const variant = variantsById.get(adjustment.variantId);

    if (!variant) {
      return {
        ok: false,
        code: "not_found",
        message: "Variant not found.",
        variantId: adjustment.variantId,
      };
    }

    if (variant.updated_at !== adjustment.expectedUpdatedAt) {
      return {
        ok: false,
        code: "stale_data",
        message: "At least one selected variant changed after the inventory view loaded.",
        variantId: adjustment.variantId,
        current: variant,
      };
    }

    if ((variant.stock_quantity ?? 0) + adjustment.delta < 0) {
      return {
        ok: false,
        code: "insufficient_stock",
        message: "At least one stock adjustment would reduce a variant below zero.",
        variantId: adjustment.variantId,
        current: variant,
      };
    }
  }

  const results: Array<Extract<InventoryOperationResult, { ok: true }>> = [];

  for (const adjustment of input.adjustments) {
    const result = await adjustVariantStock({
      ...adjustment,
      actor: input.actor,
      changeReasonNote: input.changeReasonNote,
      force: false,
    });

    if (!result.ok) {
      return {
        ok: false,
        code: result.code,
        message: result.message,
        variantId: adjustment.variantId,
        current: result.current,
      };
    }

    results.push(result);
  }

  return {
    ok: true,
    results,
  };
}

export async function createProductVariant(
  input: CreateProductVariantInput,
): Promise<InventoryOperationResult> {
  const variant = await insertProductVariantForAdmin({
    product_id: input.productId,
    flavor: input.flavor ?? null,
    size: input.size,
    sku: input.sku ?? null,
    barcode: input.barcode ?? null,
    price_aed: input.priceAed,
    stock_quantity: input.stockQuantity,
    low_stock_threshold: input.lowStockThreshold,
    weight_grams: input.weightGrams ?? null,
  });
  const movement = await appendMovement({
    product_id: variant.product_id,
    variant_id: variant.id,
    previous_quantity: null,
    new_quantity: input.stockQuantity,
    change_amount: input.stockQuantity,
    reason: "manual_adjustment",
    change_reason_note: "variant_create",
    changed_by: input.actor.userId,
  });

  await writeVariantAudit({
    action: "variant_create",
    before: variant,
    updated: variant,
    previousQuantity: null,
    newQuantity: input.stockQuantity,
    changeAmount: input.stockQuantity,
    reason: "manual_adjustment",
    changeReasonNote: "variant_create",
    actor: input.actor,
    changes: [
      { field: "variant", before: null, after: variantLabel(variant) },
      { field: "stock_quantity", before: null, after: input.stockQuantity },
      { field: "low_stock_threshold", before: null, after: input.lowStockThreshold },
    ],
  });

  return {
    ok: true,
    before: variant,
    variant,
    movement,
  };
}

export async function archiveProductVariant(
  input: ArchiveProductVariantInput,
): Promise<InventoryOperationResult> {
  const before = await findProductVariantByIdForAdmin(input.variantId);

  if (!before) {
    return notFound();
  }

  return updateQuantityAndAppendMovement({
    action: "variant_delete",
    before,
    expectedUpdatedAt: input.expectedUpdatedAt,
    newQuantity: 0,
    changeAmount: 0 - (before.stock_quantity ?? 0),
    reason: "manual_adjustment",
    changeReasonNote: input.changeReasonNote ?? "variant_archive",
    actor: input.actor,
    force: false,
    changes: [
      { field: "stock_quantity", before: before.stock_quantity, after: 0 },
      { field: "variant_archived", before: false, after: true },
    ],
  });
}

export async function getInventoryHistory(
  input: InventoryHistoryInput,
): Promise<InventoryMovementRow[]> {
  const baseRows = await readBaseHistory(input);

  return baseRows.filter((row) => {
    if (input.productId && row.product_id !== input.productId) {
      return false;
    }
    if (input.variantId && row.variant_id !== input.variantId) {
      return false;
    }
    if (input.orderId && row.order_id !== input.orderId) {
      return false;
    }
    if (input.reason && row.reason !== input.reason) {
      return false;
    }
    if (input.actorUserId && row.changed_by !== input.actorUserId) {
      return false;
    }
    if (input.start && row.changed_at < input.start) {
      return false;
    }
    if (input.end && row.changed_at > input.end) {
      return false;
    }
    return true;
  });
}

async function updateQuantityAndAppendMovement(input: {
  action: AuditVariantStockAction;
  before: ProductVariantRecord;
  expectedUpdatedAt: string;
  newQuantity: number;
  changeAmount: number;
  reason: InventoryMovementReason;
  changeReasonNote: string | null;
  actor: AuditActor;
  force: boolean;
  changes: AuditFieldChange[];
}): Promise<InventoryOperationResult> {
  const updated = input.force
    ? await updateProductVariantForAdmin(input.before.id, {
        stock_quantity: input.newQuantity,
      })
    : await updateProductVariantForAdminIfFresh(input.before.id, input.expectedUpdatedAt, {
        stock_quantity: input.newQuantity,
      });

  if (!updated) {
    return stale(input.before.id);
  }

  const movement = await appendMovement({
    product_id: input.before.product_id,
    variant_id: input.before.id,
    previous_quantity: input.before.stock_quantity,
    new_quantity: input.newQuantity,
    change_amount: input.changeAmount,
    reason: input.reason,
    change_reason_note: input.changeReasonNote,
    changed_by: input.actor.userId,
  });

  await writeVariantAudit({
    action: input.action,
    before: input.before,
    updated,
    previousQuantity: input.before.stock_quantity,
    newQuantity: input.newQuantity,
    changeAmount: input.changeAmount,
    reason: input.reason,
    changeReasonNote: input.changeReasonNote,
    actor: input.actor,
    changes: input.changes,
  });

  return {
    ok: true,
    before: input.before,
    variant: updated,
    movement,
  };
}

async function writeVariantAudit(input: {
  action: AuditVariantStockAction;
  before: ProductVariantRecord;
  updated: ProductVariantRecord;
  previousQuantity: number | null;
  newQuantity: number;
  changeAmount: number;
  reason: InventoryMovementReason;
  changeReasonNote: string | null;
  actor: AuditActor;
  changes: AuditFieldChange[];
}) {
  await record({
    actor: input.actor,
    entityId: input.before.id,
    diff: {
      version: 1,
      action: input.action,
      entity_type: "product_variant",
      product_id: input.before.product_id,
      variant_id: input.before.id,
      variant_label: variantLabel(input.updated),
      previous_quantity: input.previousQuantity,
      new_quantity: input.newQuantity,
      change_amount: input.changeAmount,
      reason: input.reason,
      change_reason_note: input.changeReasonNote,
      changes: input.changes,
    },
  });
}

async function stale(variantId: string): Promise<Extract<InventoryOperationResult, { ok: false }>> {
  return {
    ok: false,
    code: "stale_data",
    message: "This variant changed after the inventory view loaded.",
    current: await findProductVariantByIdForAdmin(variantId),
  };
}

function notFound(): Extract<InventoryOperationResult, { ok: false }> {
  return {
    ok: false,
    code: "not_found",
    message: "Variant not found.",
  };
}

function variantLabel(variant: ProductVariantRecord): string {
  return [variant.flavor, variant.size].filter(Boolean).join(" / ") || variant.sku || variant.id;
}

async function readBaseHistory(input: InventoryHistoryInput): Promise<InventoryMovementRow[]> {
  if (input.variantId) {
    return listMovementsForVariant(input.variantId);
  }
  if (input.productId) {
    return listMovementsForProduct(input.productId);
  }
  if (input.orderId) {
    return listMovementsForOrder(input.orderId);
  }
  if (input.reason) {
    return listMovementsByReason(input.reason);
  }
  if (input.actorUserId) {
    return listMovementsByActor(input.actorUserId);
  }
  if (input.start && input.end) {
    return listMovementsByDateRange(input.start, input.end);
  }
  return [];
}
