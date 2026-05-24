import type { ProductRecord, ProductStatus } from "@/types/product";

const LOCKED_STATUSES = new Set<ProductStatus>(["published", "hidden", "archived"]);

export function deriveProductStatus(
  product: ProductRecord,
  previousStatus: ProductStatus,
  changedFieldCount: number,
): ProductStatus {
  if (LOCKED_STATUSES.has(product.status)) {
    return product.status;
  }

  if (isReadyToPublish(product)) {
    return "ready_to_publish";
  }

  if (previousStatus === "imported" && changedFieldCount > 0) {
    return "draft";
  }

  if (previousStatus === "draft" || previousStatus === "partial" || hasAnyEnrichment(product)) {
    return "partial";
  }

  return previousStatus;
}

export function isReadyToPublish(product: ProductRecord): boolean {
  const flags = product.admin_review_flags;

  return (
    Boolean(product.brand_id) &&
    Boolean(product.category_id) &&
    Boolean(product.form) &&
    product.retail_price_aed !== null &&
    product.fields_status.brand === "complete" &&
    product.fields_status.category === "complete" &&
    product.fields_status.form === "complete" &&
    product.fields_status.retail_price === "complete" &&
    product.fields_status.image === "complete" &&
    !flags.case_pack &&
    !flags.missing_price &&
    !flags.missing_image &&
    !flags.missing_stock_quantity &&
    !flags.needs_brand_review &&
    !flags.needs_category_review
  );
}

function hasAnyEnrichment(product: ProductRecord): boolean {
  return (
    product.retail_price_aed !== null ||
    Boolean(product.brand_id) ||
    Boolean(product.category_id) ||
    Object.values(product.content).some(Boolean) ||
    Object.values(product.label_data).some(Boolean)
  );
}
