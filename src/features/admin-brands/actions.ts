"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/policies";
import { isAppError, type ErrorCode } from "@/lib/errors";
import { generateSlug } from "@/lib/slug";
import { record } from "@/features/audit-log/record";
import { prepareBrandImageUpload } from "@/lib/images/upload";
import {
  AdminBrandAliasActionSchema,
  AdminBrandCreateActionSchema,
  AdminBrandImageUploadMetadataSchema,
  AdminBrandUpdateActionSchema,
  type AdminBrandAliasActionInput,
  type AdminBrandCreateActionInput,
  type AdminBrandPatch,
  type AdminBrandUpdateActionInput,
} from "@/lib/validation/brand";
import {
  addBrandAliasAndRecomputeProductsForAdmin,
  countFeaturedHomepageBrandsForAdmin,
  findBrandByIdForAdmin,
  updateBrand as updateBrandForAdmin,
  updateBrandIfFresh,
  uploadBrandImageAssetForAdmin,
  upsertBrand,
} from "@/server/repositories/brand-admin-repository";
import type { AuditFieldChange } from "@/lib/audit/diff-types";
import type { BrandRecord } from "@/types/brand";

export type AdminBrandActionResult =
  | {
      ok: true;
      brand: BrandRecord;
      affectedProductIds?: string[];
    }
  | {
      ok: false;
      error: ErrorCode;
      message: string;
      current?: BrandRecord | null;
    };

type AdminBrandActionErrorResult = Extract<AdminBrandActionResult, { ok: false }>;

export async function updateBrand(
  input: AdminBrandUpdateActionInput,
): Promise<AdminBrandActionResult> {
  try {
    const admin = await requireAdmin();
    const parsed = AdminBrandUpdateActionSchema.parse(input);
    const before = await findBrandByIdForAdmin(parsed.brandId);

    if (!before) {
      return {
        ok: false,
        error: "not_found",
        message: "Brand not found.",
      };
    }

    if (
      parsed.patch.is_featured_homepage_brand === true &&
      before.is_featured_homepage_brand === false &&
      (await countFeaturedHomepageBrandsForAdmin(before.id)) >= 2
    ) {
      return {
        ok: false,
        error: "conflict",
        message: "Only two brands can be featured on the homepage.",
      };
    }

    const updated = parsed.force
      ? await updateBrandForAdmin(before.id, normalizePatch(parsed.patch))
      : await updateBrandIfFresh(before.id, parsed.expectedUpdatedAt, normalizePatch(parsed.patch));

    if (!updated) {
      return {
        ok: false,
        error: "stale_data",
        message: "This brand changed after the editor loaded.",
        current: await findBrandByIdForAdmin(before.id),
      };
    }

    await record({
      actor: { userId: admin.userId, email: admin.email },
      entityId: updated.id,
      diff: {
        version: 1,
        action: "update",
        entity_type: "brand",
        brand_id: updated.id,
        changes: buildBrandChanges(before, updated, parsed.patch),
      },
    });

    revalidateBrandPaths(updated.id);

    return {
      ok: true,
      brand: updated,
    };
  } catch (error) {
    return mapBrandActionError(error);
  }
}

export async function createBrand(
  input: AdminBrandCreateActionInput,
): Promise<AdminBrandActionResult> {
  try {
    const admin = await requireAdmin();
    const parsed = AdminBrandCreateActionSchema.parse(input);
    const slug = generateSlug(parsed.slug ?? parsed.displayName);
    const aliases = parsed.alias ? [parsed.alias] : [];
    const brand = await upsertBrand({
      display_name: parsed.displayName,
      slug,
      aliases,
      is_visible_on_directory: false,
    });
    const affected = parsed.alias
      ? await addBrandAliasAndRecomputeProductsForAdmin(brand.id, parsed.alias)
      : [];
    const refreshed = (await findBrandByIdForAdmin(brand.id)) ?? brand;

    await record({
      actor: { userId: admin.userId, email: admin.email },
      entityId: refreshed.id,
      diff: {
        version: 1,
        action: "create",
        entity_type: "brand",
        brand_id: refreshed.id,
        changes: [
          { field: "display_name", before: null, after: refreshed.display_name },
          { field: "slug", before: null, after: refreshed.slug },
          { field: "aliases", before: [], after: refreshed.aliases },
          {
            field: "products.brand_id",
            before: null,
            after: affected.map((entry) => entry.product_id),
          },
        ],
      },
    });

    revalidateBrandPaths(refreshed.id);

    return {
      ok: true,
      brand: refreshed,
      affectedProductIds: affected.map((entry) => entry.product_id),
    };
  } catch (error) {
    return mapBrandActionError(error);
  }
}

export async function addBrandAlias(
  input: AdminBrandAliasActionInput,
): Promise<AdminBrandActionResult> {
  try {
    const admin = await requireAdmin();
    const parsed = AdminBrandAliasActionSchema.parse(input);
    const before = await findBrandByIdForAdmin(parsed.brandId);

    if (!before) {
      return {
        ok: false,
        error: "not_found",
        message: "Brand not found.",
      };
    }

    const affected = await addBrandAliasAndRecomputeProductsForAdmin(before.id, parsed.alias);
    const after = await findBrandByIdForAdmin(before.id);

    if (!after) {
      return {
        ok: false,
        error: "not_found",
        message: "Brand not found after alias update.",
      };
    }

    await record({
      actor: { userId: admin.userId, email: admin.email },
      entityId: after.id,
      diff: {
        version: 1,
        action: "update",
        entity_type: "brand",
        brand_id: after.id,
        changes: [
          { field: "aliases", before: before.aliases, after: after.aliases },
          {
            field: "products.brand_id",
            before: Object.fromEntries(
              affected.map((entry) => [entry.product_id, entry.previous_brand_id]),
            ),
            after: Object.fromEntries(
              affected.map((entry) => [entry.product_id, entry.new_brand_id]),
            ),
          },
          {
            field: "products.admin_review_flags.needs_brand_review",
            before: true,
            after: false,
          },
        ],
      },
    });

    revalidateBrandPaths(after.id);

    return {
      ok: true,
      brand: after,
      affectedProductIds: affected.map((entry) => entry.product_id),
    };
  } catch (error) {
    return mapBrandActionError(error);
  }
}

export async function toggleVisibility(input: {
  brandId: string;
  expectedUpdatedAt: string;
  force?: boolean;
  isVisible: boolean;
}): Promise<AdminBrandActionResult> {
  return updateBrand({
    brandId: input.brandId,
    expectedUpdatedAt: input.expectedUpdatedAt,
    force: input.force ?? false,
    patch: { is_visible_on_directory: input.isVisible },
  });
}

export async function toggleFeatured(input: {
  brandId: string;
  expectedUpdatedAt: string;
  force?: boolean;
  isFeatured: boolean;
}): Promise<AdminBrandActionResult> {
  return updateBrand({
    brandId: input.brandId,
    expectedUpdatedAt: input.expectedUpdatedAt,
    force: input.force ?? false,
    patch: { is_featured_homepage_brand: input.isFeatured },
  });
}

export async function uploadBrandLogo(formData: FormData): Promise<AdminBrandActionResult> {
  return uploadBrandImage(formData, "logo");
}

export async function uploadBrandHero(formData: FormData): Promise<AdminBrandActionResult> {
  return uploadBrandImage(formData, "hero");
}

async function uploadBrandImage(
  formData: FormData,
  kind: "logo" | "hero",
): Promise<AdminBrandActionResult> {
  try {
    const admin = await requireAdmin();
    const parsed = AdminBrandImageUploadMetadataSchema.parse({
      brandId: formData.get("brandId"),
      kind,
    });
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return {
        ok: false,
        error: "validation_failed",
        message: "Image file is required.",
      };
    }

    const before = await findBrandByIdForAdmin(parsed.brandId);

    if (!before) {
      return {
        ok: false,
        error: "not_found",
        message: "Brand not found.",
      };
    }

    const asset = await prepareBrandImageUpload({
      file,
      brandSlug: before.slug,
      kind,
    });
    const uploaded = await uploadBrandImageAssetForAdmin(asset);
    const patch =
      kind === "logo" ? { logo_url: uploaded.publicUrl } : { hero_image_url: uploaded.publicUrl };
    const updated = await updateBrandForAdmin(before.id, patch);
    const field = kind === "logo" ? "logo_url" : "hero_image_url";

    await record({
      actor: { userId: admin.userId, email: admin.email },
      entityId: updated.id,
      diff: {
        version: 1,
        action: "image_upload",
        entity_type: "brand",
        brand_id: updated.id,
        changes: [
          {
            field,
            before: before[field],
            after: updated[field],
          },
          {
            field: `${field}.metadata`,
            before: null,
            after: {
              storage_path: asset.storagePath,
              size: asset.size,
              content_type: asset.contentType,
              original_name: asset.originalName,
            },
          },
        ],
      },
    });

    revalidateBrandPaths(updated.id);

    return {
      ok: true,
      brand: updated,
    };
  } catch (error) {
    return mapBrandActionError(error);
  }
}

function normalizePatch(patch: AdminBrandPatch): AdminBrandPatch {
  return Object.fromEntries(
    Object.entries(patch).map(([key, value]) => [
      key,
      typeof value === "string" ? value.trim() || null : value,
    ]),
  ) as AdminBrandPatch;
}

function buildBrandChanges(
  before: BrandRecord,
  after: BrandRecord,
  patch: AdminBrandPatch,
): AuditFieldChange[] {
  const changes: AuditFieldChange[] = [];

  for (const field of Object.keys(patch) as Array<keyof AdminBrandPatch>) {
    if (before[field] !== after[field]) {
      changes.push({
        field,
        before: before[field] ?? null,
        after: after[field] ?? null,
      });
    }
  }

  return changes;
}

function revalidateBrandPaths(brandId: string) {
  revalidatePath("/admin/brands");
  revalidatePath(`/admin/brands/${brandId}`);
  revalidatePath("/admin/brands/normalize");
  revalidatePath("/admin/products");
}

function mapBrandActionError(error: unknown): AdminBrandActionErrorResult {
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
    message: error instanceof Error ? error.message : "Unknown brand action error.",
  };
}
