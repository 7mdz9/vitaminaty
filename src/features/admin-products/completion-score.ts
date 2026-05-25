import type {
  FieldStatusValue,
  ProductAdminReviewFlags,
  ProductContent,
  ProductLabelData,
  ProductRecord,
} from "@/types/product";

export const TIER_1_SCORED_FIELDS = [
  "name_raw",
  "name",
  "brand_raw",
  "source_category",
  "source_row",
  "source_file",
] as const;

export const TIER_2_SCORED_FIELDS = [
  "brand",
  "category",
  "form",
  "retail_price",
  "goal_tags",
  "image",
] as const;

export const TIER_3_SCORED_FIELDS = [
  "description",
  "benefits",
  "directions",
  "warnings",
  "storage",
  "nutrition_panel",
  "ingredients",
  "allergens",
  "seo_title",
  "seo_description",
  "additional_images",
  "often_bought_with",
  "manufacturer_country",
] as const;

export type CompletionScoreInput = ProductRecord & {
  goal_tag_count?: number;
  image_count?: number;
  additional_image_count?: number;
};

export type CompletionScoreResult = Readonly<{
  score: number;
  rawPreClampValue: number;
  tier1Complete: number;
  tier2Complete: number;
  tier3Complete: number;
  activeFlagCount: number;
}>;

export function calculateCompletionScore(product: CompletionScoreInput): CompletionScoreResult {
  const tier1Complete = TIER_1_SCORED_FIELDS.filter((field) =>
    isTier1Complete(product, field),
  ).length;
  const tier2Complete = TIER_2_SCORED_FIELDS.filter((field) =>
    isTier2Complete(product, field),
  ).length;
  const tier3Complete = TIER_3_SCORED_FIELDS.filter((field) =>
    isTier3Complete(product, field),
  ).length;
  const activeFlagCount = countActiveReviewFlags(product.admin_review_flags);
  const rawPreClampValue =
    tier1Complete * 5 + tier2Complete * 6 + tier3Complete * 3 - activeFlagCount * 5;
  const mvpOnlyCapApplies =
    tier1Complete === TIER_1_SCORED_FIELDS.length &&
    tier2Complete === TIER_2_SCORED_FIELDS.length &&
    tier3Complete === 0 &&
    activeFlagCount === 0;
  const cappedValue = mvpOnlyCapApplies ? Math.min(rawPreClampValue, 60) : rawPreClampValue;

  return {
    score: Math.max(0, Math.min(100, cappedValue)),
    rawPreClampValue,
    tier1Complete,
    tier2Complete,
    tier3Complete,
    activeFlagCount,
  };
}

export function countActiveReviewFlags(flags: ProductAdminReviewFlags): number {
  return Object.values(flags).filter(Boolean).length;
}

function isTier1Complete(
  product: CompletionScoreInput,
  field: (typeof TIER_1_SCORED_FIELDS)[number],
) {
  switch (field) {
    case "name_raw":
    case "name":
    case "brand_raw":
    case "source_category":
    case "source_file":
      return hasText(product[field]);
    case "source_row":
      return product.source_row.length > 0;
  }
}

function isTier2Complete(
  product: CompletionScoreInput,
  field: (typeof TIER_2_SCORED_FIELDS)[number],
) {
  switch (field) {
    case "brand":
      return Boolean(product.brand_id) && isCompleteStatus(product.fields_status.brand);
    case "category":
      return Boolean(product.category_id) && isCompleteStatus(product.fields_status.category);
    case "form":
      return Boolean(product.form) && isCompleteStatus(product.fields_status.form);
    case "retail_price":
      return (
        product.retail_price_aed !== null && isCompleteStatus(product.fields_status.retail_price)
      );
    case "goal_tags":
      return (product.goal_tag_count ?? 0) > 0;
    case "image":
      return (product.image_count ?? 0) > 0 && isCompleteStatus(product.fields_status.image);
  }
}

function isTier3Complete(
  product: CompletionScoreInput,
  field: (typeof TIER_3_SCORED_FIELDS)[number],
) {
  const content = product.content;
  const labelData = product.label_data;

  switch (field) {
    case "description":
      return hasText(content.description) && isCompleteStatus(product.fields_status.description);
    case "benefits":
      return hasArray(content.benefits) && isCompleteStatus(product.fields_status.benefits);
    case "directions":
      return (
        hasText(content.directions_of_use) && isCompleteStatus(product.fields_status.directions)
      );
    case "warnings":
      return hasText(content.warnings) && isCompleteStatus(product.fields_status.warnings);
    case "storage":
      return (
        hasText(content.storage_instructions) && isCompleteStatus(product.fields_status.storage)
      );
    case "nutrition_panel":
      return (
        hasObject(labelData.nutrition_panel) &&
        isCompleteStatus(product.fields_status.nutrition_panel)
      );
    case "ingredients":
      return hasText(labelData.ingredients) && isCompleteStatus(product.fields_status.ingredients);
    case "allergens":
      return hasArray(labelData.allergens) && isCompleteStatus(product.fields_status.allergens);
    case "seo_title":
      return hasText(content.seo_title) && isCompleteStatus(product.fields_status.seo_title);
    case "seo_description":
      return (
        hasText(content.seo_description) && isCompleteStatus(product.fields_status.seo_description)
      );
    case "additional_images":
      return (product.additional_image_count ?? 0) > 0;
    case "often_bought_with":
      return (
        hasArray(content.often_bought_with_ids) &&
        isCompleteStatus(product.fields_status.often_bought_with)
      );
    case "manufacturer_country":
      return hasText(content.manufacturer_country);
  }
}

function isCompleteStatus(status: FieldStatusValue | undefined): boolean {
  return status === "complete" || status === "verified";
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function hasArray(value: unknown): value is unknown[] {
  return Array.isArray(value) && value.length > 0;
}

function hasObject(
  value: ProductContent[keyof ProductContent] | ProductLabelData[keyof ProductLabelData],
): boolean {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
