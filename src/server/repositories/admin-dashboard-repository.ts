import "server-only";

import { supabaseAdmin } from "@/server/db/supabase-admin";
import type { Database, Json } from "@/lib/supabase/types.generated";

type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type ProductVariantRow = Database["public"]["Tables"]["product_variants"]["Row"];
type AuditLogRow = Database["public"]["Tables"]["audit_log"]["Row"];

export type AdminCatalogSnapshot = Readonly<{
  totalProducts: number;
  publishedProducts: number;
  missingPrice: number;
  missingImage: number;
  missingStockQuantity: number;
  needsCategoryReview: number;
  needsBrandReview: number;
  outOfStock: number;
  lowStock: number;
  readyToPublish: number;
  averageCompletionScore: number;
  outOfStockPublished: number;
}>;

export type AdminRecentProduct = Readonly<{
  id: string;
  name: string;
  slug: string;
  status: ProductRow["status"];
  completionScore: number;
  updatedAt: string;
  editedByEmail: string | null;
}>;

export type AdminProductActivityProgress = Readonly<{
  today: number;
  lastHour: number;
}>;

export async function getAdminCatalogSnapshot(): Promise<AdminCatalogSnapshot> {
  const [{ data: products, error: productsError }, { data: variants, error: variantsError }] =
    await Promise.all([
      supabaseAdmin
        .from("products")
        .select(
          "id, status, is_public_visible, retail_price_aed, completion_score, admin_review_flags",
        ),
      supabaseAdmin.from("product_variants").select("product_id, stock_status"),
    ]);

  if (productsError) {
    throw new Error(`Admin dashboard product snapshot failed: ${productsError.message}`);
  }

  if (variantsError) {
    throw new Error(`Admin dashboard variant snapshot failed: ${variantsError.message}`);
  }

  const rows =
    (products as Pick<
      ProductRow,
      | "id"
      | "status"
      | "is_public_visible"
      | "retail_price_aed"
      | "completion_score"
      | "admin_review_flags"
    >[]) ?? [];
  const variantRows = (variants as Pick<ProductVariantRow, "product_id" | "stock_status">[]) ?? [];
  const stockByProduct = groupStockStatuses(variantRows);
  const completionTotal = rows.reduce((sum, row) => sum + row.completion_score, 0);

  let missingPrice = 0;
  let missingImage = 0;
  let missingStockQuantity = 0;
  let needsCategoryReview = 0;
  let needsBrandReview = 0;
  let lowStock = 0;
  let outOfStock = 0;
  let outOfStockPublished = 0;

  for (const row of rows) {
    const flags = mapJsonObject<Record<string, boolean>>(row.admin_review_flags);
    const statuses = stockByProduct.get(row.id) ?? [];
    const isOutOfStock =
      statuses.length > 0 && statuses.every((status) => status === "out_of_stock");
    const isLowStock = statuses.some((status) => status === "low_stock");

    missingPrice += row.retail_price_aed ? 0 : 1;
    missingImage += flags.missing_image ? 1 : 0;
    missingStockQuantity += flags.missing_stock_quantity ? 1 : 0;
    needsCategoryReview += flags.needs_category_review ? 1 : 0;
    needsBrandReview += flags.needs_brand_review ? 1 : 0;
    outOfStock += isOutOfStock ? 1 : 0;
    lowStock += isLowStock ? 1 : 0;
    outOfStockPublished +=
      isOutOfStock && row.status === "published" && row.is_public_visible ? 1 : 0;
  }

  return {
    totalProducts: rows.length,
    publishedProducts: rows.filter((row) => row.status === "published").length,
    missingPrice,
    missingImage,
    missingStockQuantity,
    needsCategoryReview,
    needsBrandReview,
    outOfStock,
    lowStock,
    readyToPublish: rows.filter((row) => row.status === "ready_to_publish").length,
    averageCompletionScore: rows.length ? Math.round(completionTotal / rows.length) : 0,
    outOfStockPublished,
  };
}

export async function listRecentlyUpdatedProductsForDashboard(
  limit = 10,
): Promise<AdminRecentProduct[]> {
  const { data, error } = await supabaseAdmin
    .from("products")
    .select("id, name, slug, status, completion_score, updated_at")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Admin dashboard recent products failed: ${error.message}`);
  }

  const rows =
    (data as Pick<
      ProductRow,
      "id" | "name" | "slug" | "status" | "completion_score" | "updated_at"
    >[]) ?? [];
  const editorMap = await fetchRecentEditors(rows.map((row) => row.id));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    completionScore: row.completion_score,
    updatedAt: row.updated_at,
    editedByEmail: editorMap.get(row.id) ?? null,
  }));
}

export async function countAdminProductActivity(
  actorUserId: string,
  since: string,
): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("audit_log")
    .select("id", { count: "exact", head: true })
    .eq("actor_user_id", actorUserId)
    .in("entity_type", ["product", "product_variant", "bulk", "bulk_publish"])
    .gte("occurred_at", since);

  if (error) {
    throw new Error(`Admin dashboard product progress failed: ${error.message}`);
  }

  return count ?? 0;
}

async function fetchRecentEditors(productIds: string[]): Promise<Map<string, string>> {
  if (productIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabaseAdmin
    .from("audit_log")
    .select("entity_id, actor_email, occurred_at")
    .eq("entity_type", "product")
    .in("entity_id", productIds)
    .order("occurred_at", { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(`Admin dashboard editor lookup failed: ${error.message}`);
  }

  const result = new Map<string, string>();

  for (const row of (data as Pick<AuditLogRow, "entity_id" | "actor_email">[]) ?? []) {
    if (row.entity_id && row.actor_email && !result.has(row.entity_id)) {
      result.set(row.entity_id, row.actor_email);
    }
  }

  return result;
}

function groupStockStatuses(
  variants: Pick<ProductVariantRow, "product_id" | "stock_status">[],
): Map<string, ProductVariantRow["stock_status"][]> {
  const grouped = new Map<string, ProductVariantRow["stock_status"][]>();

  for (const variant of variants) {
    grouped.set(variant.product_id, [
      ...(grouped.get(variant.product_id) ?? []),
      variant.stock_status,
    ]);
  }

  return grouped;
}

function mapJsonObject<T>(value: Json): T {
  return (value && typeof value === "object" && !Array.isArray(value) ? value : {}) as T;
}
