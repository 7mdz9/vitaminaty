"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/policies";
import { isAppError, type ErrorCode } from "@/lib/errors";
import {
  HomepageConfigUpdateActionSchema,
  type HomepageConfigUpdateActionInput,
} from "@/lib/validation/homepage";
import { record } from "@/features/audit-log/record";
import {
  getHomepageConfigForAdmin,
  listHomepageBrandsByIdsForAdmin,
  listHomepageProductsByIdsForAdmin,
  updateHomepageConfigForAdminIfFresh,
} from "@/server/repositories/homepage-config-admin-repository";
import type { AuditFieldChange } from "@/lib/audit/diff-types";
import type { HomepageConfigRecord } from "@/types/homepage";

export type HomepageConfigActionResult =
  | {
      ok: true;
      config: HomepageConfigRecord;
    }
  | {
      ok: false;
      error: ErrorCode;
      message: string;
      current?: HomepageConfigRecord;
    };

export async function updateHomepageConfig(
  input: HomepageConfigUpdateActionInput,
): Promise<HomepageConfigActionResult> {
  try {
    const admin = await requireAdmin();
    const parsed = HomepageConfigUpdateActionSchema.parse(input);
    const before = await getHomepageConfigForAdmin();

    if (before.id !== parsed.configId) {
      return {
        ok: false,
        error: "not_found",
        message: "Homepage config not found.",
      };
    }

    const [selectedProducts, selectedBrands] = await Promise.all([
      listHomepageProductsByIdsForAdmin([
        ...parsed.newArrivalProductIds,
        ...parsed.bestsellerProductIds,
      ]),
      listHomepageBrandsByIdsForAdmin(parsed.featuredBrandIds),
    ]);
    const selectedProductIds = new Set(selectedProducts.map((product) => product.id));
    const selectedBrandIds = new Set(selectedBrands.map((brand) => brand.id));

    if (
      parsed.newArrivalProductIds.some((id) => !selectedProductIds.has(id)) ||
      parsed.bestsellerProductIds.some((id) => !selectedProductIds.has(id))
    ) {
      return {
        ok: false,
        error: "validation_failed",
        message: "One or more selected homepage products no longer exist.",
      };
    }

    if (parsed.featuredBrandIds.some((id) => !selectedBrandIds.has(id))) {
      return {
        ok: false,
        error: "validation_failed",
        message: "One or more selected homepage brands no longer exist.",
      };
    }

    const patch = {
      hero_title: parsed.heroTitle,
      hero_subtitle: parsed.heroSubtitle,
      hero_cta_label: parsed.heroCtaLabel,
      hero_cta_href: parsed.heroCtaHref,
      promo_banner_text: emptyToNull(parsed.promoBannerText),
      promo_banner_href: emptyToNull(parsed.promoBannerHref),
      promo_starts_at: parsed.promoStartsAt ?? null,
      promo_ends_at: parsed.promoEndsAt ?? null,
      new_arrival_product_ids: unique(parsed.newArrivalProductIds),
      bestseller_product_ids: unique(parsed.bestsellerProductIds),
      featured_brand_ids: unique(parsed.featuredBrandIds),
      goal_order: unique(parsed.goalOrder),
      updated_by: admin.userId,
      updated_at: new Date().toISOString(),
    };

    const updated = await updateHomepageConfigForAdminIfFresh(
      before.id,
      parsed.expectedUpdatedAt,
      patch,
    );

    if (!updated) {
      return {
        ok: false,
        error: "stale_data",
        message: "Homepage curation changed after this page loaded.",
        current: await getHomepageConfigForAdmin(),
      };
    }

    await record({
      actor: { userId: admin.userId, email: admin.email },
      entityId: updated.id,
      diff: {
        version: 1,
        action: "update",
        entity_type: "homepage_config",
        homepage_config_id: updated.id,
        changes: buildHomepageChanges(before, updated),
      },
    });

    revalidatePath("/admin/homepage");
    revalidatePath("/");

    return {
      ok: true,
      config: updated,
    };
  } catch (error) {
    return mapHomepageActionError(error);
  }
}

function buildHomepageChanges(
  before: HomepageConfigRecord,
  after: HomepageConfigRecord,
): AuditFieldChange[] {
  const fields: Array<keyof HomepageConfigRecord> = [
    "hero_title",
    "hero_subtitle",
    "hero_cta_label",
    "hero_cta_href",
    "promo_banner_text",
    "promo_banner_href",
    "promo_starts_at",
    "promo_ends_at",
    "new_arrival_product_ids",
    "bestseller_product_ids",
    "featured_brand_ids",
    "goal_order",
  ];

  return fields.flatMap((field) => {
    const beforeValue = before[field];
    const afterValue = after[field];

    if (JSON.stringify(beforeValue) === JSON.stringify(afterValue)) {
      return [];
    }

    return [{ field, before: beforeValue, after: afterValue }];
  });
}

function mapHomepageActionError(
  error: unknown,
): Extract<HomepageConfigActionResult, { ok: false }> {
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
    message: error instanceof Error ? error.message : "Unknown homepage action error.",
  };
}

function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}
