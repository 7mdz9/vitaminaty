import "server-only";

import { supabaseAdmin } from "@/server/db/supabase-admin";
import type { Database, Json } from "@/lib/supabase/types.generated";
import type {
  ProductAdminReviewFlags,
  ProductContent,
  ProductFieldsStatus,
  ProductGoalTagRecord,
  ProductImageRecord,
  ProductLabelData,
  ProductRecord,
  ProductVariantRecord,
  SlugHistoryRecord,
} from "@/types/product";

type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type ProductInsert = Database["public"]["Tables"]["products"]["Insert"];
type ProductUpdate = Database["public"]["Tables"]["products"]["Update"];
type ProductVariantRow = Database["public"]["Tables"]["product_variants"]["Row"];
type ProductVariantInsert = Database["public"]["Tables"]["product_variants"]["Insert"];
type ProductImageRow = Database["public"]["Tables"]["product_images"]["Row"];
type ProductImageInsert = Database["public"]["Tables"]["product_images"]["Insert"];
type ProductGoalTagRow = Database["public"]["Tables"]["product_goal_tags"]["Row"];
type ProductGoalTagInsert = Database["public"]["Tables"]["product_goal_tags"]["Insert"];
type SlugHistoryRow = Database["public"]["Tables"]["slug_history"]["Row"];
type SlugHistoryInsert = Database["public"]["Tables"]["slug_history"]["Insert"];

export type ImportedProductInsert = ProductInsert;

const ADMIN_PRODUCT_COLUMNS = [
  "id",
  "slug",
  "name",
  "name_raw",
  "brand_id",
  "brand_raw",
  "category_id",
  "source_category",
  "form",
  "source_file",
  "source_row",
  "source_notes",
  "retail_price_aed",
  "wholesale_price_internal",
  "compare_at_price_aed",
  "status",
  "is_public_visible",
  "is_add_to_cart_enabled",
  "is_checkout_enabled",
  "completion_score",
  "featured_score",
  "content",
  "label_data",
  "fields_status",
  "admin_review_flags",
  "created_at",
  "updated_at",
  "published_at",
].join(", ");

export async function listAllProductsForAdmin(): Promise<ProductRecord[]> {
  const { data, error } = await supabaseAdmin
    .from("products")
    .select(ADMIN_PRODUCT_COLUMNS)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`Admin products query failed: ${error.message}`);
  }

  return (data as unknown as ProductRow[]).map(mapProduct);
}

export async function findProductByIdForAdmin(id: string): Promise<ProductRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("products")
    .select(ADMIN_PRODUCT_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Admin product by id query failed: ${error.message}`);
  }

  return data ? mapProduct(data as unknown as ProductRow) : null;
}

export async function findProductBySlugForAdmin(slug: string): Promise<ProductRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("products")
    .select(ADMIN_PRODUCT_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new Error(`Admin product by slug query failed: ${error.message}`);
  }

  return data ? mapProduct(data as unknown as ProductRow) : null;
}

export async function updateProductForAdmin(
  id: string,
  patch: ProductUpdate,
): Promise<ProductRecord> {
  const { data, error } = await supabaseAdmin
    .from("products")
    .update(patch)
    .eq("id", id)
    .select(ADMIN_PRODUCT_COLUMNS)
    .single();

  if (error) {
    throw new Error(`Admin product update failed: ${error.message}`);
  }

  return mapProduct(data as unknown as ProductRow);
}

export async function bulkInsertImported(rows: ImportedProductInsert[]): Promise<ProductRecord[]> {
  if (rows.length === 0) {
    return [];
  }

  const { data, error } = await supabaseAdmin
    .from("products")
    .upsert(rows, { onConflict: "slug" })
    .select(ADMIN_PRODUCT_COLUMNS);

  if (error) {
    throw new Error(`Imported products bulk upsert failed: ${error.message}`);
  }

  return (data as unknown as ProductRow[]).map(mapProduct);
}

export async function bulkUpsertProductVariants(
  rows: ProductVariantInsert[],
): Promise<ProductVariantRecord[]> {
  if (rows.length === 0) {
    return [];
  }

  const { data, error } = await supabaseAdmin
    .from("product_variants")
    .upsert(rows, { onConflict: "product_id,flavor,size" })
    .select(
      "id, product_id, flavor, size, sku, barcode, price_aed, in_stock, stock_quantity, low_stock_threshold, weight_grams, sort_order, created_at, updated_at",
    );

  if (error) {
    throw new Error(`Product variants bulk upsert failed: ${error.message}`);
  }

  return (data as unknown as ProductVariantRow[]).map(mapVariant);
}

export async function bulkInsertProductImages(
  rows: ProductImageInsert[],
): Promise<ProductImageRecord[]> {
  if (rows.length === 0) {
    return [];
  }

  const { data, error } = await supabaseAdmin
    .from("product_images")
    .insert(rows)
    .select(
      "id, product_id, variant_id, storage_path, public_url, alt_text, kind, sort_order, is_primary, created_at",
    );

  if (error) {
    throw new Error(`Product images bulk insert failed: ${error.message}`);
  }

  return (data as unknown as ProductImageRow[]).map(mapImage);
}

export async function bulkUpsertProductGoalTags(
  rows: ProductGoalTagInsert[],
): Promise<ProductGoalTagRecord[]> {
  if (rows.length === 0) {
    return [];
  }

  const { data, error } = await supabaseAdmin
    .from("product_goal_tags")
    .upsert(rows, { onConflict: "product_id,goal" })
    .select("product_id, goal, is_primary");

  if (error) {
    throw new Error(`Product goal tags bulk upsert failed: ${error.message}`);
  }

  return (data as unknown as ProductGoalTagRow[]).map(mapGoalTag);
}

export async function insertSlugHistoryForAdmin(
  row: SlugHistoryInsert,
): Promise<SlugHistoryRecord> {
  const { data, error } = await supabaseAdmin
    .from("slug_history")
    .insert(row)
    .select("id, product_id, old_slug, new_slug, changed_at")
    .single();

  if (error) {
    throw new Error(`Slug history insert failed: ${error.message}`);
  }

  return mapSlugHistory(data as unknown as SlugHistoryRow);
}

function mapProduct(row: ProductRow): ProductRecord {
  return {
    ...row,
    content: mapJsonObject<ProductContent>(row.content),
    label_data: mapJsonObject<ProductLabelData>(row.label_data),
    fields_status: mapJsonObject<ProductFieldsStatus>(row.fields_status),
    admin_review_flags: mapJsonObject<ProductAdminReviewFlags>(row.admin_review_flags),
  };
}

function mapVariant(row: ProductVariantRow): ProductVariantRecord {
  return row;
}

function mapImage(row: ProductImageRow): ProductImageRecord {
  return {
    ...row,
    alt_text: row.alt_text ?? "",
  };
}

function mapGoalTag(row: ProductGoalTagRow): ProductGoalTagRecord {
  return row;
}

function mapSlugHistory(row: SlugHistoryRow): SlugHistoryRecord {
  return row;
}

function mapJsonObject<T>(value: Json): T {
  return (value && typeof value === "object" && !Array.isArray(value) ? value : {}) as T;
}
