"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/policies";
import { isAppError } from "@/lib/errors";
import {
  AdminProductBatchUpdateActionSchema,
  AdminProductUpdateActionSchema,
  type AdminProductBatchUpdateActionInput,
  type AdminProductUpdateActionInput,
} from "@/lib/validation/product";
import { updateProductWithRecalculation } from "@/server/services/product-service";
import type { ProductRecord } from "@/types/product";

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
        code: result.code,
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
