"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/policies";
import { isAppError, type ErrorCode } from "@/lib/errors";
import { record } from "@/features/audit-log/record";
import {
  AdminProductBulkAssignBrandActionSchema,
  AdminProductBulkAssignCategoryActionSchema,
  AdminProductBulkPublishActionSchema,
  AdminProductImageUploadMetadataSchema,
  AdminProductBatchUpdateActionSchema,
  AdminProductUpdateActionSchema,
  type AdminProductBulkAssignBrandActionInput,
  type AdminProductBulkAssignCategoryActionInput,
  type AdminProductBulkPublishActionInput,
  type AdminProductBatchUpdateActionInput,
  type AdminProductUpdateActionInput,
} from "@/lib/validation/product";
import {
  AdjustVariantStockActionSchema,
  ArchiveProductVariantActionSchema,
  BulkAdjustVariantStockActionSchema,
  CreateProductVariantActionSchema,
  GetInventoryHistoryActionSchema,
  RecountVariantStockActionSchema,
  SetVariantLowStockThresholdActionSchema,
  SetVariantStockActionSchema,
  type AdjustVariantStockActionInput,
  type ArchiveProductVariantActionInput,
  type BulkAdjustVariantStockActionInput,
  type CreateProductVariantActionInput,
  type GetInventoryHistoryActionInput,
  type RecountVariantStockActionInput,
  type SetVariantLowStockThresholdActionInput,
  type SetVariantStockActionInput,
} from "@/lib/validation/inventory";
import {
  updateProductWithRecalculation,
  uploadProductImageWithAudit,
} from "@/server/services/product-service";
import {
  adjustVariantStock as adjustVariantStockService,
  archiveProductVariant as archiveProductVariantService,
  bulkAdjustVariantStock as bulkAdjustVariantStockService,
  createProductVariant as createProductVariantService,
  getInventoryHistory as getInventoryHistoryService,
  recountVariantStock as recountVariantStockService,
  setVariantLowStockThreshold as setVariantLowStockThresholdService,
  setVariantStock as setVariantStockService,
} from "@/server/services/inventory-service";
import {
  bulkUpdateProductsForAdmin,
  findProductEditorDataForAdmin,
  findProductsByIdsForAdmin,
  type AdminProductEditorData,
} from "@/server/repositories/product-admin-repository";
import type { AuditBulkOperationChange, AuditDiff } from "@/lib/audit/diff-types";
import type { ProductImageRecord, ProductRecord } from "@/types/product";
import type { ProductVariantRecord } from "@/types/product";
import type { Database } from "@/lib/supabase/types.generated";

export type AdminProductActionResult =
  | {
      ok: true;
      product: ProductRecord;
    }
  | {
      ok: false;
      error: ErrorCode;
      message: string;
      current?: {
        updated_at: string;
        original_editor: {
          user_id: string | null;
          email: string | null;
        };
      };
    };
type AdminProductActionErrorResult = Extract<AdminProductActionResult, { ok: false }>;

export type AdminProductBatchActionResult = {
  ok: boolean;
  results: AdminProductActionResult[];
};

export type AdminProductBulkActionResult =
  | {
      ok: true;
      updatedProductIds: string[];
      hardBlockedProductIds?: string[];
      reviewFlagsByProductId?: Record<string, string[]>;
    }
  | {
      ok: false;
      error: ErrorCode;
      message: string;
      hardBlockedProductIds?: string[];
      reviewFlagsByProductId?: Record<string, string[]>;
    };

export type AdminProductDrawerDataResult =
  | {
      ok: true;
      data: AdminProductEditorData;
    }
  | {
      ok: false;
      error: ErrorCode;
      message: string;
    };

export type AdminProductImageUploadResult =
  | {
      ok: true;
      product: ProductRecord;
      image: ProductImageRecord;
    }
  | {
      ok: false;
      error: ErrorCode;
      message: string;
    };

type InventoryMovementRecord = Database["public"]["Tables"]["inventory_movements"]["Row"];

export type AdminInventoryActionResult =
  | {
      ok: true;
      variant: ProductVariantRecord;
      movement: InventoryMovementRecord;
    }
  | {
      ok: false;
      error: ErrorCode;
      message: string;
      current?: ProductVariantRecord | null;
    };
type AdminInventoryActionErrorResult = Extract<AdminInventoryActionResult, { ok: false }>;

export type AdminInventoryBulkActionResult =
  | {
      ok: true;
      results: Array<Extract<AdminInventoryActionResult, { ok: true }>>;
    }
  | {
      ok: false;
      error: ErrorCode;
      message: string;
      variantId?: string;
      current?: ProductVariantRecord | null;
    };

export type AdminInventoryHistoryResult =
  | {
      ok: true;
      movements: InventoryMovementRecord[];
    }
  | {
      ok: false;
      error: ErrorCode;
      message: string;
    };

type ProductTransitionInput = Readonly<{
  productId: string;
  expectedUpdatedAt: string;
  force?: boolean;
}>;

export async function updateProduct(
  input: AdminProductUpdateActionInput,
): Promise<AdminProductActionResult> {
  try {
    const admin = await requireAdmin();
    const parsed = AdminProductUpdateActionSchema.parse(input);
    const result = await updateProductWithRecalculation({
      productId: parsed.productId,
      expectedUpdatedAt: parsed.expectedUpdatedAt,
      patch: parsed.patch,
      force: parsed.force,
      actor: { userId: admin.userId, email: admin.email },
    });

    if (!result.ok) {
      return {
        ok: false,
        error: result.error,
        message: result.message,
        current: result.current
          ? {
              updated_at: result.current.updated_at,
              original_editor: {
                user_id: null,
                email: null,
              },
            }
          : undefined,
      };
    }

    revalidatePath("/admin/products");
    revalidatePath(`/admin/products/${parsed.productId}`);

    return {
      ok: true,
      product: result.product,
    };
  } catch (error) {
    return mapActionError(error);
  }
}

export async function batchUpdateProducts(
  input: AdminProductBatchUpdateActionInput,
): Promise<AdminProductBatchActionResult> {
  const parsed = AdminProductBatchUpdateActionSchema.parse(input);
  const results: AdminProductActionResult[] = [];

  for (const update of parsed.updates) {
    results.push(await updateProduct(update));
  }

  return {
    ok: results.every((result) => result.ok),
    results,
  };
}

export async function getProductDrawerData(
  productId: string,
): Promise<AdminProductDrawerDataResult> {
  try {
    await requireAdmin();
    const data = await findProductEditorDataForAdmin(productId);

    if (!data) {
      return {
        ok: false,
        error: "not_found",
        message: "Product not found.",
      };
    }

    return {
      ok: true,
      data,
    };
  } catch (error) {
    const mapped = mapActionError(error);

    return {
      ok: false,
      error: mapped.error,
      message: mapped.message,
    };
  }
}

export async function updateProductPartial(
  input: AdminProductUpdateActionInput,
): Promise<AdminProductActionResult> {
  return updateProduct(input);
}

export async function uploadProductImage(
  formData: FormData,
): Promise<AdminProductImageUploadResult> {
  try {
    const admin = await requireAdmin();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return {
        ok: false,
        error: "validation_failed",
        message: "Image file is required.",
      };
    }

    const parsed = AdminProductImageUploadMetadataSchema.parse({
      productId: String(formData.get("productId") ?? ""),
      variantId: nullableString(formData.get("variantId")),
      kind: String(formData.get("kind") ?? "front"),
      altText: optionalString(formData.get("altText")),
      isPrimary: String(formData.get("isPrimary") ?? "false") === "true",
    });
    const result = await uploadProductImageWithAudit({
      productId: parsed.productId,
      variantId: parsed.variantId ?? null,
      file,
      kind: parsed.kind,
      altText: parsed.altText,
      isPrimary: parsed.isPrimary,
      actor: { userId: admin.userId, email: admin.email },
    });

    if (!result.ok) {
      return result;
    }

    revalidatePath("/admin/products");
    revalidatePath(`/admin/products/${parsed.productId}`);

    return result;
  } catch (error) {
    return mapImageActionError(error);
  }
}

export async function setVariantStock(
  input: SetVariantStockActionInput,
): Promise<AdminInventoryActionResult> {
  try {
    const admin = await requireAdmin();
    const parsed = SetVariantStockActionSchema.parse(input);
    const result = await setVariantStockService({
      ...parsed,
      actor: { userId: admin.userId, email: admin.email },
    });

    return revalidateInventoryResult(result);
  } catch (error) {
    return mapInventoryActionError(error);
  }
}

export async function adjustVariantStock(
  input: AdjustVariantStockActionInput,
): Promise<AdminInventoryActionResult> {
  try {
    const admin = await requireAdmin();
    const parsed = AdjustVariantStockActionSchema.parse(input);
    const result = await adjustVariantStockService({
      ...parsed,
      actor: { userId: admin.userId, email: admin.email },
    });

    return revalidateInventoryResult(result);
  } catch (error) {
    return mapInventoryActionError(error);
  }
}

export async function recountVariantStock(
  input: RecountVariantStockActionInput,
): Promise<AdminInventoryActionResult> {
  try {
    const admin = await requireAdmin();
    const parsed = RecountVariantStockActionSchema.parse(input);
    const result = await recountVariantStockService({
      ...parsed,
      actor: { userId: admin.userId, email: admin.email },
    });

    return revalidateInventoryResult(result);
  } catch (error) {
    return mapInventoryActionError(error);
  }
}

export async function setVariantLowStockThreshold(
  input: SetVariantLowStockThresholdActionInput,
): Promise<AdminInventoryActionResult> {
  try {
    const admin = await requireAdmin();
    const parsed = SetVariantLowStockThresholdActionSchema.parse(input);
    const result = await setVariantLowStockThresholdService({
      ...parsed,
      actor: { userId: admin.userId, email: admin.email },
    });

    return revalidateInventoryResult(result);
  } catch (error) {
    return mapInventoryActionError(error);
  }
}

export async function bulkAdjustVariantStock(
  input: BulkAdjustVariantStockActionInput,
): Promise<AdminInventoryBulkActionResult> {
  try {
    const admin = await requireAdmin();
    const parsed = BulkAdjustVariantStockActionSchema.parse(input);
    const result = await bulkAdjustVariantStockService({
      ...parsed,
      actor: { userId: admin.userId, email: admin.email },
    });

    if (!result.ok) {
      return result;
    }

    for (const item of result.results) {
      revalidateInventoryPaths(item.variant.product_id);
    }

    return result;
  } catch (error) {
    const mapped = mapInventoryActionError(error);

    return {
      ok: false,
      error: mapped.error,
      message: mapped.message,
      current: mapped.current,
    };
  }
}

export async function getInventoryHistory(
  input: GetInventoryHistoryActionInput,
): Promise<AdminInventoryHistoryResult> {
  try {
    await requireAdmin();
    const parsed = GetInventoryHistoryActionSchema.parse(input);
    const movements = await getInventoryHistoryService(parsed);

    return {
      ok: true,
      movements,
    };
  } catch (error) {
    const mapped = mapActionError(error);

    return {
      ok: false,
      error: mapped.error,
      message: mapped.message,
    };
  }
}

export async function createProductVariant(
  input: CreateProductVariantActionInput,
): Promise<AdminInventoryActionResult> {
  try {
    const admin = await requireAdmin();
    const parsed = CreateProductVariantActionSchema.parse(input);
    const result = await createProductVariantService({
      ...parsed,
      actor: { userId: admin.userId, email: admin.email },
    });

    return revalidateInventoryResult(result);
  } catch (error) {
    return mapInventoryActionError(error);
  }
}

export async function archiveProductVariant(
  input: ArchiveProductVariantActionInput,
): Promise<AdminInventoryActionResult> {
  try {
    const admin = await requireAdmin();
    const parsed = ArchiveProductVariantActionSchema.parse(input);
    const result = await archiveProductVariantService({
      ...parsed,
      actor: { userId: admin.userId, email: admin.email },
    });

    return revalidateInventoryResult(result);
  } catch (error) {
    return mapInventoryActionError(error);
  }
}

export async function bulkAssignBrand(
  input: AdminProductBulkAssignBrandActionInput,
): Promise<AdminProductBulkActionResult> {
  try {
    const admin = await requireAdmin();
    const parsed = AdminProductBulkAssignBrandActionSchema.parse(input);
    const before = await findProductsByIdsForAdmin(parsed.productIds);
    const updated = await bulkUpdateProductsForAdmin(parsed.productIds, {
      brand_id: parsed.brandId,
    });
    const updatedIds = updated.map((product) => product.id);

    await record({
      actor: { userId: admin.userId, email: admin.email },
      diff: buildBulkOperationDiff("assign_brand", before, updatedIds, [
        {
          field: "brand_id",
          before_by_product_id: Object.fromEntries(
            before.map((product) => [product.id, product.brand_id]),
          ),
          after: parsed.brandId,
        },
      ]),
    });

    revalidatePath("/admin/products");

    return {
      ok: true,
      updatedProductIds: updatedIds,
    };
  } catch (error) {
    return mapBulkActionError(error);
  }
}

export async function bulkAssignCategory(
  input: AdminProductBulkAssignCategoryActionInput,
): Promise<AdminProductBulkActionResult> {
  try {
    const admin = await requireAdmin();
    const parsed = AdminProductBulkAssignCategoryActionSchema.parse(input);
    const before = await findProductsByIdsForAdmin(parsed.productIds);
    const updated = await bulkUpdateProductsForAdmin(parsed.productIds, {
      category_id: parsed.categoryId,
    });
    const updatedIds = updated.map((product) => product.id);

    await record({
      actor: { userId: admin.userId, email: admin.email },
      diff: buildBulkOperationDiff("assign_category", before, updatedIds, [
        {
          field: "category_id",
          before_by_product_id: Object.fromEntries(
            before.map((product) => [product.id, product.category_id]),
          ),
          after: parsed.categoryId,
        },
      ]),
    });

    revalidatePath("/admin/products");

    return {
      ok: true,
      updatedProductIds: updatedIds,
    };
  } catch (error) {
    return mapBulkActionError(error);
  }
}

export async function bulkPublish(
  input: AdminProductBulkPublishActionInput,
): Promise<AdminProductBulkActionResult> {
  try {
    const admin = await requireAdmin();
    const parsed = AdminProductBulkPublishActionSchema.parse(input);
    const before = await findProductsByIdsForAdmin(parsed.productIds);

    if (before.length === 0) {
      return {
        ok: false,
        error: "not_found",
        message: "No matching products were found.",
      };
    }

    const hardBlocked = before.filter(isHardBlockedForBulkPublish);
    const publishable = before.filter(
      (product) => !hardBlocked.some((blocked) => blocked.id === product.id),
    );
    const reviewFlagsByProductId = Object.fromEntries(
      publishable
        .map((product) => [product.id, activeReviewFlags(product)] as const)
        .filter(([, flags]) => flags.length > 0),
    );

    if (publishable.length === 0) {
      return {
        ok: false,
        error: "all_products_blocked",
        message: "Every selected product is hard-blocked from bulk publish.",
        hardBlockedProductIds: hardBlocked.map((product) => product.id),
        reviewFlagsByProductId,
      };
    }

    if (Object.keys(reviewFlagsByProductId).length > 0 && !parsed.forceOverride) {
      return {
        ok: false,
        error: "force_override_required",
        message: "Some selected products have unresolved review flags.",
        hardBlockedProductIds: hardBlocked.map((product) => product.id),
        reviewFlagsByProductId,
      };
    }

    const publishableIds = publishable.map((product) => product.id);
    const updated = await bulkUpdateProductsForAdmin(publishableIds, {
      status: "published",
      is_public_visible: true,
    });
    const updatedIds = updated.map((product) => product.id);
    const diff: AuditDiff =
      parsed.forceOverride || Object.keys(reviewFlagsByProductId).length > 0
        ? {
            version: 1,
            action: "bulk_publish_override",
            entity_type: "bulk_publish",
            published_product_ids: updatedIds,
            published_count: updatedIds.length,
            override_review_flags: true,
            products_with_review_flags_count: Object.keys(reviewFlagsByProductId).length,
            review_flags_by_product_id: reviewFlagsByProductId,
            hard_blocked_product_ids: hardBlocked.map((product) => product.id),
            override_reason: parsed.overrideReason,
          }
        : buildBulkOperationDiff("bulk_publish", before, updatedIds, [
            {
              field: "status",
              before_by_product_id: Object.fromEntries(
                before.map((product) => [product.id, product.status]),
              ),
              after: "published",
            },
            {
              field: "is_public_visible",
              before_by_product_id: Object.fromEntries(
                before.map((product) => [product.id, product.is_public_visible]),
              ),
              after: true,
            },
          ]);

    await record({
      actor: { userId: admin.userId, email: admin.email },
      diff,
    });

    revalidatePath("/admin/products");

    return {
      ok: true,
      updatedProductIds: updatedIds,
      hardBlockedProductIds: hardBlocked.map((product) => product.id),
      reviewFlagsByProductId,
    };
  } catch (error) {
    return mapBulkActionError(error);
  }
}

export async function publishProduct(
  input: ProductTransitionInput,
): Promise<AdminProductActionResult> {
  return updateProduct({
    ...input,
    force: input.force ?? false,
    patch: {
      status: "published",
      is_public_visible: true,
    },
  });
}

export async function unpublishProduct(
  input: ProductTransitionInput,
): Promise<AdminProductActionResult> {
  return updateProduct({
    ...input,
    force: input.force ?? false,
    patch: {
      status: "hidden",
      is_public_visible: false,
    },
  });
}

export async function archiveProduct(
  input: ProductTransitionInput,
): Promise<AdminProductActionResult> {
  return updateProduct({
    ...input,
    force: input.force ?? false,
    patch: {
      status: "archived",
      is_public_visible: false,
    },
  });
}

function mapActionError(error: unknown): AdminProductActionErrorResult {
  if (isAppError(error)) {
    return {
      ok: false,
      error: error.code,
      message: error.message,
    };
  }

  return {
    ok: false,
    error: "internal_error",
    message: error instanceof Error ? error.message : "Unknown product action error.",
  };
}

function mapImageActionError(error: unknown): AdminProductImageUploadResult {
  const mapped = mapActionError(error);

  return {
    ok: false,
    error: mapped.error,
    message: mapped.message,
  };
}

function mapInventoryActionError(error: unknown): AdminInventoryActionErrorResult {
  const mapped = mapActionError(error);

  return {
    ok: false,
    error: mapped.error,
    message: mapped.message,
  };
}

function revalidateInventoryResult(
  result: Awaited<ReturnType<typeof setVariantStockService>>,
): AdminInventoryActionResult {
  if (!result.ok) {
    return result;
  }

  revalidateInventoryPaths(result.variant.product_id);

  return {
    ok: true,
    variant: result.variant,
    movement: result.movement,
  };
}

function revalidateInventoryPaths(productId: string) {
  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath(`/admin/products/${productId}/inventory`);
}

function mapBulkActionError(error: unknown): AdminProductBulkActionResult {
  const mapped = mapActionError(error);

  return {
    ok: false,
    error: mapped.error,
    message: mapped.message,
  };
}

function buildBulkOperationDiff(
  operation: string,
  before: ProductRecord[],
  affectedProductIds: string[],
  changes: AuditBulkOperationChange[],
): AuditDiff {
  return {
    version: 1,
    action: "bulk_operation",
    entity_type: "bulk",
    operation,
    affected_product_ids: affectedProductIds,
    affected_count: affectedProductIds.length,
    changes,
  };
}

function isHardBlockedForBulkPublish(product: ProductRecord): boolean {
  return Boolean(
    product.admin_review_flags.case_pack || !product.retail_price_aed || !product.brand_id,
  );
}

function activeReviewFlags(product: ProductRecord): string[] {
  return Object.entries(product.admin_review_flags)
    .filter(([, active]) => active)
    .map(([flag]) => flag);
}

function optionalString(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function nullableString(value: FormDataEntryValue | null): string | null {
  const optional = optionalString(value);
  return optional ?? null;
}
