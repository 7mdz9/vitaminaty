"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/policies";
import { isAppError } from "@/lib/errors";
import {
  AdminProductImageUploadMetadataSchema,
  AdminProductBatchUpdateActionSchema,
  AdminProductUpdateActionSchema,
  type AdminProductBatchUpdateActionInput,
  type AdminProductUpdateActionInput,
} from "@/lib/validation/product";
import {
  updateProductWithRecalculation,
  uploadProductImageWithAudit,
} from "@/server/services/product-service";
import {
  findProductEditorDataForAdmin,
  type AdminProductEditorData,
} from "@/server/repositories/product-admin-repository";
import type { ProductImageRecord, ProductRecord } from "@/types/product";

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
type AdminProductActionErrorResult = Extract<AdminProductActionResult, { ok: false }>;

export type AdminProductBatchActionResult = {
  ok: boolean;
  results: AdminProductActionResult[];
};

export type AdminProductDrawerDataResult =
  | {
      ok: true;
      data: AdminProductEditorData;
    }
  | {
      ok: false;
      code: "not_found" | "authorization_error" | "unknown";
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
      code: "not_found" | "validation_error" | "authorization_error" | "unknown";
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

export async function getProductDrawerData(productId: string): Promise<AdminProductDrawerDataResult> {
  try {
    await requireAdmin();
    const data = await findProductEditorDataForAdmin(productId);

    if (!data) {
      return {
        ok: false,
        code: "not_found",
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
      code: mapped.code === "authorization_error" ? "authorization_error" : "unknown",
      message: mapped.message,
    };
  }
}

export async function updateProductPartial(
  input: AdminProductUpdateActionInput,
): Promise<AdminProductActionResult> {
  return updateProduct(input);
}

export async function uploadProductImage(formData: FormData): Promise<AdminProductImageUploadResult> {
  try {
    const admin = await requireAdmin();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return {
        ok: false,
        code: "validation_error",
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

function mapImageActionError(error: unknown): AdminProductImageUploadResult {
  const mapped = mapActionError(error);

  return {
    ok: false,
    code:
      mapped.code === "authorization_error" || mapped.code === "validation_error"
        ? mapped.code
        : "unknown",
    message: mapped.message,
  };
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
