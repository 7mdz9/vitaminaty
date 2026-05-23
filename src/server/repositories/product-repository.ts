import "server-only";

import { createSupabaseServerClient } from "@/server/db/supabase-server";
import type { Database, Json } from "@/lib/supabase/types.generated";
import type {
  ProductAdminReviewFlags,
  ProductContent,
  ProductFieldsStatus,
  ProductGoalTagRecord,
  ProductImageRecord,
  ProductLabelData,
  ProductVariantRecord,
  PublicProductRecord,
  SlugHistoryRecord,
} from "@/types/product";

type PublicClient = Pick<Awaited<ReturnType<typeof createSupabaseServerClient>>, "from">;
type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type ProductVariantRow = Database["public"]["Tables"]["product_variants"]["Row"];
type ProductImageRow = Database["public"]["Tables"]["product_images"]["Row"];
type ProductGoalTagRow = Database["public"]["Tables"]["product_goal_tags"]["Row"];
type SlugHistoryRow = Database["public"]["Tables"]["slug_history"]["Row"];
type GoalTag = Database["public"]["Enums"]["goal_tag"];

export type ProductListFilters = {
  brandId?: string;
  categoryId?: string;
  goal?: GoalTag;
};

export type ProductListPage = {
  page?: number;
  pageSize?: number;
};

const DEFAULT_PAGE_SIZE = 24;

const PUBLIC_PRODUCT_COLUMNS = [
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

export async function listPublishedProducts(
  filters: ProductListFilters = {},
  page: ProductListPage = {},
  client?: PublicClient,
): Promise<PublicProductRecord[]> {
  const supabase = await resolvePublicClient(client);
  const pageSize = page.pageSize ?? DEFAULT_PAGE_SIZE;
  const pageIndex = page.page ?? 0;
  const from = pageIndex * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("products")
    .select(PUBLIC_PRODUCT_COLUMNS)
    .eq("is_public_visible", true)
    .eq("status", "published")
    .order("featured_score", { ascending: false })
    .order("published_at", { ascending: false, nullsFirst: false })
    .range(from, to);

  if (filters.categoryId) {
    query = query.eq("category_id", filters.categoryId);
  }

  if (filters.brandId) {
    query = query.eq("brand_id", filters.brandId);
  }

  if (filters.goal) {
    const { data: goalRows, error: goalError } = await supabase
      .from("product_goal_tags")
      .select("product_id")
      .eq("goal", filters.goal);

    if (goalError) {
      throw new Error(`Product goal filter query failed: ${goalError.message}`);
    }

    const productIds = (goalRows as unknown as Pick<ProductGoalTagRow, "product_id">[]).map(
      (row) => row.product_id,
    );

    if (productIds.length === 0) {
      return [];
    }

    query = query.in("id", productIds);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Published products query failed: ${error.message}`);
  }

  return (data as unknown as ProductRow[]).map(mapPublicProduct);
}

export async function findProductBySlug(
  slug: string,
  client?: PublicClient,
): Promise<PublicProductRecord | null> {
  const supabase = await resolvePublicClient(client);
  const { data, error } = await supabase
    .from("products")
    .select(PUBLIC_PRODUCT_COLUMNS)
    .eq("slug", slug)
    .eq("is_public_visible", true)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    throw new Error(`Product by slug query failed: ${error.message}`);
  }

  return data ? mapPublicProduct(data as unknown as ProductRow) : null;
}

export async function listProductVariants(
  productId: string,
  client?: PublicClient,
): Promise<ProductVariantRecord[]> {
  const supabase = await resolvePublicClient(client);
  const { data, error } = await supabase
    .from("product_variants")
    .select(
      "id, product_id, flavor, size, sku, barcode, price_aed, in_stock, stock_quantity, low_stock_threshold, weight_grams, sort_order, created_at, updated_at",
    )
    .eq("product_id", productId)
    .order("sort_order", { ascending: true });

  if (error) {
    throw new Error(`Product variants query failed: ${error.message}`);
  }

  return (data as unknown as ProductVariantRow[]).map(mapVariant);
}

export async function listProductImages(
  productId: string,
  client?: PublicClient,
): Promise<ProductImageRecord[]> {
  const supabase = await resolvePublicClient(client);
  const { data, error } = await supabase
    .from("product_images")
    .select(
      "id, product_id, variant_id, storage_path, public_url, alt_text, kind, sort_order, is_primary, created_at",
    )
    .eq("product_id", productId)
    .order("sort_order", { ascending: true });

  if (error) {
    throw new Error(`Product images query failed: ${error.message}`);
  }

  return (data as unknown as ProductImageRow[]).map(mapImage);
}

export async function listProductGoalTags(
  productId: string,
  client?: PublicClient,
): Promise<ProductGoalTagRecord[]> {
  const supabase = await resolvePublicClient(client);
  const { data, error } = await supabase
    .from("product_goal_tags")
    .select("product_id, goal, is_primary")
    .eq("product_id", productId)
    .order("is_primary", { ascending: false });

  if (error) {
    throw new Error(`Product goal tags query failed: ${error.message}`);
  }

  return (data as unknown as ProductGoalTagRow[]).map(mapGoalTag);
}

export async function findSlugHistoryByOldSlug(
  oldSlug: string,
  client?: PublicClient,
): Promise<SlugHistoryRecord | null> {
  const supabase = await resolvePublicClient(client);
  const { data, error } = await supabase
    .from("slug_history")
    .select("id, product_id, old_slug, new_slug, changed_at")
    .eq("old_slug", oldSlug)
    .maybeSingle();

  if (error) {
    throw new Error(`Slug history query failed: ${error.message}`);
  }

  return data ? mapSlugHistory(data as unknown as SlugHistoryRow) : null;
}

async function resolvePublicClient(client?: PublicClient): Promise<PublicClient> {
  return client ?? createSupabaseServerClient();
}

function mapPublicProduct(row: ProductRow): PublicProductRecord {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    name_raw: row.name_raw,
    brand_id: row.brand_id,
    brand_raw: row.brand_raw,
    category_id: row.category_id,
    source_category: row.source_category,
    form: row.form,
    source_file: row.source_file,
    source_row: row.source_row,
    source_notes: row.source_notes,
    retail_price_aed: row.retail_price_aed,
    compare_at_price_aed: row.compare_at_price_aed,
    status: row.status,
    is_public_visible: row.is_public_visible,
    is_add_to_cart_enabled: row.is_add_to_cart_enabled,
    is_checkout_enabled: row.is_checkout_enabled,
    completion_score: row.completion_score,
    featured_score: row.featured_score,
    content: mapJsonObject<ProductContent>(row.content),
    label_data: mapJsonObject<ProductLabelData>(row.label_data),
    fields_status: mapJsonObject<ProductFieldsStatus>(row.fields_status),
    admin_review_flags: mapJsonObject<ProductAdminReviewFlags>(row.admin_review_flags),
    created_at: row.created_at,
    updated_at: row.updated_at,
    published_at: row.published_at,
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
