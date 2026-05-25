import "server-only";

import { record } from "@/features/audit-log/record";
import { calculateCompletionScore } from "@/features/admin-products/completion-score";
import { mergeFieldStatus } from "@/features/admin-products/field-status";
import { deriveProductStatus } from "@/features/admin-products/status-transitions";
import { prepareProductImageUpload } from "@/lib/images/upload";
import type { AuditActor } from "@/server/services/audit-service";
import type { AuditDiff, AuditFieldChange } from "@/lib/audit/diff-types";
import type { Database, Json } from "@/lib/supabase/types.generated";
import {
  clearPrimaryProductImagesForAdmin,
  findProductByIdForAdmin,
  insertProductImageForAdmin,
  listProductGoalTagsForAdmin,
  listProductImagesForAdmin,
  updateProductForAdmin,
  updateProductForAdminIfFresh,
  uploadProductImageAssetForAdmin,
} from "@/server/repositories/product-admin-repository";
import type { AdminProductInlinePatch } from "@/lib/validation/product";
import type {
  ProductContent,
  ProductFieldsStatus,
  ProductImageKind,
  ProductImageRecord,
  ProductLabelData,
  ProductRecord,
} from "@/types/product";

type ProductUpdate = Database["public"]["Tables"]["products"]["Update"];

export type ProductUpdateServiceInput = Readonly<{
  productId: string;
  expectedUpdatedAt: string;
  patch: AdminProductInlinePatch;
  force: boolean;
  actor: AuditActor;
}>;

export type ProductUpdateServiceResult =
  | Readonly<{
      ok: true;
      before: ProductRecord;
      product: ProductRecord;
      changes: AuditFieldChange[];
      statusChanged: boolean;
    }>
  | Readonly<{
      ok: false;
      error: "not_found" | "stale_data";
      message: string;
      current?: ProductRecord | null;
    }>;

export type ProductImageUploadServiceInput = Readonly<{
  productId: string;
  variantId?: string | null;
  file: File;
  kind: ProductImageKind;
  altText?: string;
  isPrimary: boolean;
  actor: AuditActor;
}>;

export type ProductImageUploadServiceResult =
  | Readonly<{
      ok: true;
      product: ProductRecord;
      image: ProductImageRecord;
    }>
  | Readonly<{
      ok: false;
      error: "not_found" | "validation_failed";
      message: string;
    }>;

export async function updateProductWithRecalculation(
  input: ProductUpdateServiceInput,
): Promise<ProductUpdateServiceResult> {
  const before = await findProductByIdForAdmin(input.productId);

  if (!before) {
    return {
      ok: false,
      error: "not_found",
      message: "Product not found.",
    };
  }

  const counts = await readEditorCounts(input.productId);
  const projected = projectProduct(before, input.patch);
  const score = calculateCompletionScore({
    ...projected,
    goal_tag_count: counts.goalTagCount,
    image_count: counts.imageCount,
    additional_image_count: counts.additionalImageCount,
  }).score;
  const status =
    input.patch.status ??
    deriveProductStatus(projected, before.status, Object.keys(input.patch).length);
  const patch = toProductUpdate(input.patch, score, status);
  const updated = input.force
    ? await updateProductForAdmin(input.productId, patch)
    : await updateProductForAdminIfFresh(input.productId, input.expectedUpdatedAt, patch);

  if (!updated) {
    return {
      ok: false,
      error: "stale_data",
      message: "This product changed after the editor loaded.",
      current: await findProductByIdForAdmin(input.productId),
    };
  }

  const changes = buildProductChanges(before, updated, input.patch, score, status);
  const diff = buildAuditDiff(input, before, updated, changes);
  await record({
    actor: input.actor,
    diff,
    entityId: updated.id,
  });

  return {
    ok: true,
    before,
    product: updated,
    changes,
    statusChanged: before.status !== updated.status,
  };
}

export async function uploadProductImageWithAudit(
  input: ProductImageUploadServiceInput,
): Promise<ProductImageUploadServiceResult> {
  const before = await findProductByIdForAdmin(input.productId);

  if (!before) {
    return {
      ok: false,
      error: "not_found",
      message: "Product not found.",
    };
  }

  const existingImages = await listProductImagesForAdmin(input.productId);
  const shouldBePrimary = input.isPrimary || existingImages.length === 0;
  let asset: Awaited<ReturnType<typeof prepareProductImageUpload>>;
  try {
    asset = await prepareProductImageUpload({
      file: input.file,
      brandSlug: before.brand_raw,
      productSlug: before.slug,
      kind: input.kind,
    });
  } catch (error) {
    return {
      ok: false,
      error: "validation_failed",
      message: error instanceof Error ? error.message : "Invalid product image.",
    };
  }
  const uploaded = await uploadProductImageAssetForAdmin(asset);

  if (shouldBePrimary) {
    await clearPrimaryProductImagesForAdmin(before.id);
  }

  const image = await insertProductImageForAdmin({
    product_id: before.id,
    variant_id: input.variantId ?? null,
    storage_path: asset.storagePath,
    public_url: uploaded.publicUrl,
    alt_text: input.altText?.trim() || `${before.name} - ${input.kind.replace(/_/g, " ")}`,
    kind: input.kind,
    sort_order: existingImages.length,
    is_primary: shouldBePrimary,
  });

  const nextImages = [
    ...existingImages.map((existing) => ({
      ...existing,
      is_primary: shouldBePrimary ? false : existing.is_primary,
    })),
    image,
  ];
  const fieldsStatus = mergeFieldStatus(before.fields_status, { image: "complete" });
  const adminReviewFlags = {
    ...before.admin_review_flags,
    missing_image: false,
  };
  const projected = {
    ...before,
    fields_status: fieldsStatus,
    admin_review_flags: adminReviewFlags,
  };
  const score = calculateCompletionScore({
    ...projected,
    image_count: nextImages.length,
    additional_image_count: nextImages.filter((candidate) => !candidate.is_primary).length,
    goal_tag_count: (await listProductGoalTagsForAdmin(before.id)).length,
  }).score;
  const status = deriveProductStatus(projected, before.status, 1);
  const product = await updateProductForAdmin(before.id, {
    fields_status: fieldsStatus,
    admin_review_flags: adminReviewFlags,
    completion_score: score,
    status,
  });

  await record({
    actor: input.actor,
    entityId: before.id,
    diff: {
      version: 1,
      action: "image_upload",
      entity_type: "product",
      product_id: before.id,
      changes: [
        {
          field: "product_images",
          before: null,
          after: {
            id: image.id,
            storage_path: image.storage_path,
            public_url: image.public_url,
            kind: image.kind,
            is_primary: image.is_primary,
            size: asset.size,
            content_type: asset.contentType,
            original_name: asset.originalName,
          },
        },
        {
          field: "fields_status.image",
          before: before.fields_status.image,
          after: fieldsStatus.image,
        },
        {
          field: "admin_review_flags.missing_image",
          before: before.admin_review_flags.missing_image ?? null,
          after: false,
        },
        {
          field: "completion_score",
          before: before.completion_score,
          after: product.completion_score,
        },
      ],
    },
  });

  return {
    ok: true,
    product,
    image,
  };
}

async function readEditorCounts(productId: string) {
  const [images, goalTags] = await Promise.all([
    listProductImagesForAdmin(productId),
    listProductGoalTagsForAdmin(productId),
  ]);

  return {
    imageCount: images.length,
    additionalImageCount: images.filter((image) => !image.is_primary).length,
    goalTagCount: goalTags.length,
  };
}

function projectProduct(product: ProductRecord, patch: AdminProductInlinePatch): ProductRecord {
  return {
    ...product,
    ...patch,
    content: {
      ...product.content,
      ...((patch.content as ProductContent | undefined) ?? {}),
    },
    label_data: {
      ...product.label_data,
      ...((patch.label_data as ProductLabelData | undefined) ?? {}),
    },
    fields_status: mergeFieldStatus(
      product.fields_status,
      (patch.fields_status as Partial<ProductFieldsStatus> | undefined) ?? {},
    ),
    admin_review_flags: {
      ...product.admin_review_flags,
      ...patch.admin_review_flags,
    },
  };
}

function toProductUpdate(
  patch: AdminProductInlinePatch,
  completionScore: number,
  status: ProductRecord["status"],
): ProductUpdate {
  return {
    name: patch.name,
    retail_price_aed: patch.retail_price_aed,
    wholesale_price_internal: patch.wholesale_price_internal,
    compare_at_price_aed: patch.compare_at_price_aed,
    brand_id: patch.brand_id,
    category_id: patch.category_id,
    form: patch.form,
    status,
    is_public_visible: patch.is_public_visible,
    content: patch.content as Json | undefined,
    label_data: patch.label_data as Json | undefined,
    fields_status: patch.fields_status as Json | undefined,
    admin_review_flags: patch.admin_review_flags as Json | undefined,
    completion_score: completionScore,
  };
}

function buildProductChanges(
  before: ProductRecord,
  after: ProductRecord,
  patch: AdminProductInlinePatch,
  completionScore: number,
  status: ProductRecord["status"],
): AuditFieldChange[] {
  const changedFields = new Set([...Object.keys(patch), "completion_score"]);

  if (before.status !== status) {
    changedFields.add("status");
  }

  return Array.from(changedFields).map((field) => ({
    field,
    before: readAuditValue(before, field),
    after: field === "completion_score" ? completionScore : readAuditValue(after, field),
  }));
}

function buildAuditDiff(
  input: ProductUpdateServiceInput,
  before: ProductRecord,
  updated: ProductRecord,
  changes: AuditFieldChange[],
): AuditDiff {
  if (input.force) {
    return {
      version: 1,
      action: "stale_data_override",
      entity_type: "product",
      product_id: updated.id,
      loaded_updated_at: input.expectedUpdatedAt,
      database_updated_at: before.updated_at,
      original_editor: {
        user_id: "00000000-0000-4000-8000-000000000000",
        email: "unknown-admin@example.test",
      },
      overridden_by: {
        user_id: input.actor.userId ?? "00000000-0000-4000-8000-000000000000",
        email: input.actor.email ?? "unknown-admin@example.test",
      },
      changes,
    };
  }

  return {
    version: 1,
    action: "update",
    entity_type: "product",
    product_id: updated.id,
    changes,
  };
}

function readAuditValue(product: ProductRecord, field: string): Json {
  return product[field as keyof ProductRecord] as Json;
}
