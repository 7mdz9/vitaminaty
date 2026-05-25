import type { FieldStatusValue, ProductFieldsStatus } from "@/types/product";

export const DEFAULT_PRODUCT_FIELDS_STATUS: ProductFieldsStatus = {
  name: "missing",
  brand: "missing",
  category: "missing",
  form: "missing",
  retail_price: "missing",
  description: "missing",
  benefits: "missing",
  image: "missing",
  nutrition_panel: "missing",
  ingredients: "missing",
  allergens: "missing",
  directions: "missing",
  warnings: "missing",
  storage: "missing",
  seo_title: "missing",
  seo_description: "missing",
  often_bought_with: "missing",
};

export function mergeFieldStatus(
  current: ProductFieldsStatus,
  patch: Partial<ProductFieldsStatus>,
): ProductFieldsStatus {
  return {
    ...DEFAULT_PRODUCT_FIELDS_STATUS,
    ...current,
    ...removeUndefinedStatuses(patch),
  };
}

export function deriveFieldStatus(value: unknown): FieldStatusValue {
  if (Array.isArray(value)) {
    return value.length > 0 ? "complete" : "missing";
  }

  if (value && typeof value === "object") {
    return Object.keys(value).length > 0 ? "complete" : "missing";
  }

  if (typeof value === "string") {
    return value.trim().length > 0 ? "complete" : "missing";
  }

  return value === null || value === undefined ? "missing" : "complete";
}

function removeUndefinedStatuses(
  patch: Partial<ProductFieldsStatus>,
): Partial<ProductFieldsStatus> {
  return Object.fromEntries(
    Object.entries(patch).filter(
      (entry): entry is [keyof ProductFieldsStatus, FieldStatusValue] => entry[1] !== undefined,
    ),
  ) as Partial<ProductFieldsStatus>;
}
