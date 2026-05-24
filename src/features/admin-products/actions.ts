"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/policies";
import { isAppError } from "@/lib/errors";
import {
  AdminProductBatchUpdateActionSchema,
  AdminProductUpdateActionSchema,
  type AdminProductBatchUpdateActionInput,
  type AdminProductInlinePatch,
  type AdminProductUpdateActionInput,
} from "@/lib/validation/product";
import { record } from "@/features/audit-log/record";
import type { AuditDiff, AuditFieldChange } from "@/lib/audit/diff-types";
import type { Database, Json } from "@/lib/supabase/types.generated";
import {
  findProductByIdForAdmin,
  updateProductForAdmin,
  updateProductForAdminIfFresh,
} from "@/server/repositories/product-admin-repository";
import type { ProductRecord } from "@/types/product";

type ProductUpdate = Database["public"]["Tables"]["products"]["Update"];

export type AdminProductActionResult =
  | {
      ok: true;
      product: ProductRecord;
    }
  | {
      ok: false;
      code: "not_found" | "stale_data" | "validation_error" | "authorization_error" | "unknown";
      message: string;
      current?: {
        updated_at: string;
        original_editor: {
          user_id: string | null;
          email: string | null;
        };
      };
    };

export type AdminProductBatchActionResult = {
  ok: boolean;
  results: AdminProductActionResult[];
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
    const before = await findProductByIdForAdmin(parsed.productId);

    if (!before) {
      return {
        ok: false,
        code: "not_found",
        message: "Product not found.",
      };
    }

    const patch = toProductUpdate(parsed.patch);
    const updated = parsed.force
      ? await updateProductForAdmin(parsed.productId, patch)
      : await updateProductForAdminIfFresh(parsed.productId, parsed.expectedUpdatedAt, patch);

    if (!updated) {
      const current = await findProductByIdForAdmin(parsed.productId);

      return {
        ok: false,
        code: "stale_data",
        message: "This product changed after the list loaded.",
        current: current
          ? {
              updated_at: current.updated_at,
              original_editor: {
                user_id: null,
                email: null,
              },
            }
          : undefined,
      };
    }

    const changes = buildProductChanges(before, updated, parsed.patch);
    const diff: AuditDiff = parsed.force
      ? {
          version: 1,
          action: "stale_data_override",
          entity_type: "product",
          product_id: updated.id,
          loaded_updated_at: parsed.expectedUpdatedAt,
          database_updated_at: before.updated_at,
          original_editor: {
            user_id: "00000000-0000-4000-8000-000000000000",
            email: "unknown-admin@example.test",
          },
          overridden_by: {
            user_id: admin.userId,
            email: admin.email,
          },
          changes,
        }
      : {
          version: 1,
          action: "update",
          entity_type: "product",
          product_id: updated.id,
          changes,
        };

    await record({
      actor: { userId: admin.userId, email: admin.email },
      diff,
      entityId: updated.id,
    });

    revalidatePath("/admin/products");

    return {
      ok: true,
      product: updated,
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

function toProductUpdate(patch: AdminProductInlinePatch): ProductUpdate {
  return {
    retail_price_aed: patch.retail_price_aed,
    brand_id: patch.brand_id,
    category_id: patch.category_id,
    status: patch.status,
    is_public_visible: patch.is_public_visible,
    admin_review_flags: patch.admin_review_flags as Json | undefined,
  };
}

function buildProductChanges(
  before: ProductRecord,
  after: ProductRecord,
  patch: AdminProductInlinePatch,
): AuditFieldChange[] {
  return Object.keys(patch).map((field) => ({
    field,
    before: readAuditValue(before, field),
    after: readAuditValue(after, field),
  }));
}

function readAuditValue(product: ProductRecord, field: string): Json {
  return product[field as keyof ProductRecord] as Json;
}

function mapActionError(error: unknown): AdminProductActionResult {
  if (isAppError(error)) {
    return {
      ok: false,
      code: error.code === "authorization_error" ? "authorization_error" : "validation_error",
      message: error.message,
    };
  }

  return {
    ok: false,
    code: "unknown",
    message: error instanceof Error ? error.message : "Unknown product action error.",
  };
}
