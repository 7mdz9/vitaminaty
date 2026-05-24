import "server-only";

import { supabaseAdmin } from "@/server/db/supabase-admin";
import { PRODUCT_IMAGE_BUCKET, type PreparedProductImageUpload } from "@/lib/images/upload";
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
type BrandRow = Database["public"]["Tables"]["brands"]["Row"];
type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];

export type AdminProductSort =
  | "newest_imported"
  | "lowest_completion"
  | "recently_updated"
  | "alphabetical";

export type AdminProductListFilters = Readonly<{
  status?: ProductRow["status"] | "all";
  reviewFlags?: string[];
  stockStatus?: ProductVariantRow["stock_status"] | "all";
  brandId?: string;
  categoryId?: string;
  search?: string;
  completionMin?: number;
  completionMax?: number;
}>;

export type AdminProductListInput = Readonly<{
  filters?: AdminProductListFilters;
  sort?: AdminProductSort;
  page?: number;
  pageSize?: number;
}>;

export type AdminProductListItem = Readonly<{
  id: string;
  slug: string;
  name: string;
  brand_id: string | null;
  brand_name: string | null;
  category_id: string | null;
  category_name: string | null;
  retail_price_aed: number | null;
  status: ProductRow["status"];
  is_public_visible: boolean;
  completion_score: number;
  admin_review_flags: ProductAdminReviewFlags;
  updated_at: string;
  primary_image_url: string | null;
  stock_total: number | null;
  stock_badge: "in_stock" | "low_stock" | "out_of_stock" | "mixed" | "missing";
  variant_count: number;
}>;

export type AdminProductListResult = Readonly<{
  items: AdminProductListItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}>;

export type AdminProductReferenceOption = Readonly<{
  id: string;
  label: string;
  slug: string;
}>;

export type AdminProductEditorData = Readonly<{
  product: ProductRecord;
  variants: ProductVariantRecord[];
  images: ProductImageRecord[];
  goalTags: ProductGoalTagRecord[];
}>;

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

export async function findManyForAdmin(
  input: AdminProductListInput = {},
): Promise<AdminProductListResult> {
  const page = clampPage(input.page);
  const pageSize = clampPageSize(input.pageSize);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const filters = input.filters ?? {};

  let query = supabaseAdmin
    .from("products")
    .select(ADMIN_PRODUCT_COLUMNS, { count: "exact" });

  if (filters.stockStatus && filters.stockStatus !== "all") {
    const productIds = await findProductIdsByStockStatus(filters.stockStatus);

    if (productIds.length === 0) {
      return {
        items: [],
        total: 0,
        page,
        pageSize,
        pageCount: 1,
      };
    }

    query = query.in("id", productIds);
  }

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  if (filters.brandId) {
    query = query.eq("brand_id", filters.brandId);
  }

  if (filters.categoryId) {
    query = query.eq("category_id", filters.categoryId);
  }

  if (typeof filters.completionMin === "number") {
    query = query.gte("completion_score", filters.completionMin);
  }

  if (typeof filters.completionMax === "number") {
    query = query.lte("completion_score", filters.completionMax);
  }

  for (const flag of filters.reviewFlags ?? []) {
    query = query.contains("admin_review_flags", { [flag]: true });
  }

  const search = filters.search?.trim();
  if (search) {
    const escaped = search.replace(/[%_]/g, (match) => `\\${match}`);
    query = query.or(`name.ilike.%${escaped}%,name_raw.ilike.%${escaped}%,brand_raw.ilike.%${escaped}%`);
  }

  switch (input.sort ?? "recently_updated") {
    case "newest_imported":
      query = query.order("created_at", { ascending: false });
      break;
    case "lowest_completion":
      query = query
        .order("completion_score", { ascending: true })
        .order("updated_at", { ascending: false });
      break;
    case "alphabetical":
      query = query.order("name", { ascending: true });
      break;
    case "recently_updated":
    default:
      query = query.order("updated_at", { ascending: false });
      break;
  }

  const { data, error, count } = await query.range(from, to);

  if (error) {
    throw new Error(`Admin product list query failed: ${error.message}`);
  }

  const rows = (data as unknown as ProductRow[]) ?? [];
  const items = await hydrateAdminProductListItems(rows);
  const total = count ?? 0;

  return {
    items,
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
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

export async function updateProductForAdminIfFresh(
  id: string,
  expectedUpdatedAt: string,
  patch: ProductUpdate,
): Promise<ProductRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("products")
    .update(patch)
    .eq("id", id)
    .eq("updated_at", expectedUpdatedAt)
    .select(ADMIN_PRODUCT_COLUMNS)
    .maybeSingle();

  if (error) {
    throw new Error(`Admin product stale-safe update failed: ${error.message}`);
  }

  return data ? mapProduct(data as unknown as ProductRow) : null;
}

export async function findProductEditorDataForAdmin(
  id: string,
): Promise<AdminProductEditorData | null> {
  const product = await findProductByIdForAdmin(id);

  if (!product) {
    return null;
  }

  const [variants, images, goalTags] = await Promise.all([
    listProductVariantsForAdmin(id),
    listProductImagesForAdmin(id),
    listProductGoalTagsForAdmin(id),
  ]);

  return {
    product,
    variants,
    images,
    goalTags,
  };
}

export async function listBrandOptionsForAdmin(): Promise<AdminProductReferenceOption[]> {
  const { data, error } = await supabaseAdmin
    .from("brands")
    .select("id, display_name, slug")
    .order("display_name", { ascending: true });

  if (error) {
    throw new Error(`Admin brand options query failed: ${error.message}`);
  }

  return ((data as Pick<BrandRow, "id" | "display_name" | "slug">[]) ?? []).map((row) => ({
    id: row.id,
    label: row.display_name,
    slug: row.slug,
  }));
}

export async function listCategoryOptionsForAdmin(): Promise<AdminProductReferenceOption[]> {
  const { data, error } = await supabaseAdmin
    .from("categories")
    .select("id, name, slug")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Admin category options query failed: ${error.message}`);
  }

  return ((data as Pick<CategoryRow, "id" | "name" | "slug">[]) ?? []).map((row) => ({
    id: row.id,
    label: row.name,
    slug: row.slug,
  }));
}

export async function listProductVariantsForAdmin(
  productId: string,
): Promise<ProductVariantRecord[]> {
  const { data, error } = await supabaseAdmin
    .from("product_variants")
    .select(
      "id, product_id, flavor, size, sku, barcode, price_aed, stock_status, stock_quantity, low_stock_threshold, weight_grams, sort_order, created_at, updated_at",
    )
    .eq("product_id", productId)
    .order("sort_order", { ascending: true });

  if (error) {
    throw new Error(`Admin product variants query failed: ${error.message}`);
  }

  return ((data as unknown as ProductVariantRow[]) ?? []).map(mapVariant);
}

export async function listProductImagesForAdmin(productId: string): Promise<ProductImageRecord[]> {
  const { data, error } = await supabaseAdmin
    .from("product_images")
    .select(
      "id, product_id, variant_id, storage_path, public_url, alt_text, kind, sort_order, is_primary, created_at",
    )
    .eq("product_id", productId)
    .order("sort_order", { ascending: true });

  if (error) {
    throw new Error(`Admin product images query failed: ${error.message}`);
  }

  return ((data as unknown as ProductImageRow[]) ?? []).map(mapImage);
}

export async function listProductGoalTagsForAdmin(
  productId: string,
): Promise<ProductGoalTagRecord[]> {
  const { data, error } = await supabaseAdmin
    .from("product_goal_tags")
    .select("product_id, goal, is_primary")
    .eq("product_id", productId);

  if (error) {
    throw new Error(`Admin product goal tags query failed: ${error.message}`);
  }

  return ((data as unknown as ProductGoalTagRow[]) ?? []).map(mapGoalTag);
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
      "id, product_id, flavor, size, sku, barcode, price_aed, stock_status, stock_quantity, low_stock_threshold, weight_grams, sort_order, created_at, updated_at",
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

export async function insertProductImageForAdmin(
  row: ProductImageInsert,
): Promise<ProductImageRecord> {
  const { data, error } = await supabaseAdmin
    .from("product_images")
    .insert(row)
    .select(
      "id, product_id, variant_id, storage_path, public_url, alt_text, kind, sort_order, is_primary, created_at",
    )
    .single();

  if (error) {
    throw new Error(`Product image insert failed: ${error.message}`);
  }

  return mapImage(data as unknown as ProductImageRow);
}

export async function clearPrimaryProductImagesForAdmin(productId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("product_images")
    .update({ is_primary: false })
    .eq("product_id", productId)
    .eq("is_primary", true);

  if (error) {
    throw new Error(`Product primary image clear failed: ${error.message}`);
  }
}

export async function uploadProductImageAssetForAdmin(
  asset: PreparedProductImageUpload,
): Promise<{ publicUrl: string }> {
  await ensureProductImagesBucket();

  const { error } = await supabaseAdmin.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .upload(asset.storagePath, asset.bytes, {
      contentType: asset.contentType,
      upsert: false,
    });

  if (error) {
    throw new Error(`Product image storage upload failed: ${error.message}`);
  }

  const { data } = supabaseAdmin.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .getPublicUrl(asset.storagePath);

  return { publicUrl: data.publicUrl };
}

async function ensureProductImagesBucket(): Promise<void> {
  const { data, error } = await supabaseAdmin.storage.getBucket(PRODUCT_IMAGE_BUCKET);

  if (data && !error) {
    return;
  }

  const { error: createError } = await supabaseAdmin.storage.createBucket(PRODUCT_IMAGE_BUCKET, {
    public: true,
    fileSizeLimit: "10MB",
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  });

  if (createError && !/already exists/i.test(createError.message)) {
    throw new Error(`Product image bucket setup failed: ${createError.message}`);
  }
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

async function hydrateAdminProductListItems(rows: ProductRow[]): Promise<AdminProductListItem[]> {
  if (rows.length === 0) {
    return [];
  }

  const productIds = rows.map((row) => row.id);
  const brandIds = rows.flatMap((row) => (row.brand_id ? [row.brand_id] : []));
  const categoryIds = rows.flatMap((row) => (row.category_id ? [row.category_id] : []));

  const [brandMap, categoryMap, imageMap, variantMap] = await Promise.all([
    fetchBrandMap(brandIds),
    fetchCategoryMap(categoryIds),
    fetchPrimaryImageMap(productIds),
    fetchVariantSummaryMap(productIds),
  ]);

  return rows.map((row) => {
    const variantSummary = variantMap.get(row.id) ?? {
      total: null,
      badge: "missing" as const,
      count: 0,
    };
    const flags = mapJsonObject<ProductAdminReviewFlags>(row.admin_review_flags);
    const badge = flags.missing_stock_quantity ? "missing" : variantSummary.badge;

    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      brand_id: row.brand_id,
      brand_name: row.brand_id ? (brandMap.get(row.brand_id) ?? null) : null,
      category_id: row.category_id,
      category_name: row.category_id ? (categoryMap.get(row.category_id) ?? null) : null,
      retail_price_aed: row.retail_price_aed,
      status: row.status,
      is_public_visible: row.is_public_visible,
      completion_score: row.completion_score,
      admin_review_flags: flags,
      updated_at: row.updated_at,
      primary_image_url: imageMap.get(row.id) ?? null,
      stock_total: badge === "missing" ? null : variantSummary.total,
      stock_badge: badge,
      variant_count: variantSummary.count,
    };
  });
}

async function fetchBrandMap(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) {
    return new Map();
  }

  const { data, error } = await supabaseAdmin
    .from("brands")
    .select("id, display_name")
    .in("id", unique(ids));

  if (error) {
    throw new Error(`Admin brand hydration failed: ${error.message}`);
  }

  return new Map(((data as Pick<BrandRow, "id" | "display_name">[]) ?? []).map((row) => [row.id, row.display_name]));
}

async function fetchCategoryMap(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) {
    return new Map();
  }

  const { data, error } = await supabaseAdmin
    .from("categories")
    .select("id, name")
    .in("id", unique(ids));

  if (error) {
    throw new Error(`Admin category hydration failed: ${error.message}`);
  }

  return new Map(((data as Pick<CategoryRow, "id" | "name">[]) ?? []).map((row) => [row.id, row.name]));
}

async function fetchPrimaryImageMap(productIds: string[]): Promise<Map<string, string>> {
  const { data, error } = await supabaseAdmin
    .from("product_images")
    .select("product_id, public_url")
    .in("product_id", productIds)
    .eq("is_primary", true);

  if (error) {
    throw new Error(`Admin image hydration failed: ${error.message}`);
  }

  return new Map(
    ((data as Pick<ProductImageRow, "product_id" | "public_url">[]) ?? []).map((row) => [
      row.product_id,
      row.public_url,
    ]),
  );
}

async function fetchVariantSummaryMap(productIds: string[]): Promise<
  Map<
    string,
    {
      total: number | null;
      badge: AdminProductListItem["stock_badge"];
      count: number;
    }
  >
> {
  const { data, error } = await supabaseAdmin
    .from("product_variants")
    .select("product_id, stock_status, stock_quantity")
    .in("product_id", productIds);

  if (error) {
    throw new Error(`Admin variant hydration failed: ${error.message}`);
  }

  const grouped = new Map<
    string,
    { statuses: ProductVariantRow["stock_status"][]; quantities: Array<number | null> }
  >();

  for (const row of (data as Pick<ProductVariantRow, "product_id" | "stock_status" | "stock_quantity">[]) ?? []) {
    const current = grouped.get(row.product_id) ?? { statuses: [], quantities: [] };
    current.statuses.push(row.stock_status);
    current.quantities.push(row.stock_quantity);
    grouped.set(row.product_id, current);
  }

  const result = new Map<
    string,
    {
      total: number | null;
      badge: AdminProductListItem["stock_badge"];
      count: number;
    }
  >();

  for (const [productId, summary] of grouped) {
    const hasMissingQuantity = summary.quantities.some((quantity) => quantity === null);
    const total = hasMissingQuantity
      ? null
      : summary.quantities.reduce<number>((sum, quantity) => sum + (quantity ?? 0), 0);
    const allOut = summary.statuses.every((status) => status === "out_of_stock");
    const anyLow = summary.statuses.some((status) => status === "low_stock");
    const anyOut = summary.statuses.some((status) => status === "out_of_stock");
    const anyIn = summary.statuses.some((status) => status === "in_stock" || status === "low_stock");
    const badge = hasMissingQuantity
      ? "missing"
      : allOut
        ? "out_of_stock"
        : anyLow
          ? "low_stock"
          : anyOut && anyIn
            ? "mixed"
            : "in_stock";

    result.set(productId, {
      total,
      badge,
      count: summary.statuses.length,
    });
  }

  return result;
}

async function findProductIdsByStockStatus(
  stockStatus: ProductVariantRow["stock_status"],
): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("product_variants")
    .select("product_id, stock_status");

  if (error) {
    throw new Error(`Admin stock-status filter failed: ${error.message}`);
  }

  const grouped = new Map<string, ProductVariantRow["stock_status"][]>();

  for (const row of (data as Pick<ProductVariantRow, "product_id" | "stock_status">[]) ?? []) {
    const statuses = grouped.get(row.product_id) ?? [];
    statuses.push(row.stock_status);
    grouped.set(row.product_id, statuses);
  }

  return Array.from(grouped.entries())
    .filter(([, statuses]) =>
      stockStatus === "out_of_stock"
        ? statuses.length > 0 && statuses.every((status) => status === "out_of_stock")
        : statuses.some((status) => status === stockStatus),
    )
    .map(([productId]) => productId);
}

function clampPage(value: number | undefined): number {
  return Math.max(1, Math.floor(value ?? 1));
}

function clampPageSize(value: number | undefined): number {
  return Math.max(10, Math.min(100, Math.floor(value ?? 50)));
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}
