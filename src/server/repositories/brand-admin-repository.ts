import "server-only";

import { supabaseAdmin } from "@/server/db/supabase-admin";
import { PRODUCT_IMAGE_BUCKET, type PreparedBrandImageUpload } from "@/lib/images/upload";
import type { Database } from "@/lib/supabase/types.generated";
import type { BrandRecord } from "@/types/brand";

type BrandRow = Database["public"]["Tables"]["brands"]["Row"];
type BrandInsert = Database["public"]["Tables"]["brands"]["Insert"];
type BrandUpdate = Database["public"]["Tables"]["brands"]["Update"];
type ProductRow = Database["public"]["Tables"]["products"]["Row"];

export type AdminBrandListItem = BrandRecord & {
  aliases_count: number;
  products_visible_count: number;
  products_total_count: number;
};

export type AdminUnmatchedBrandRaw = Readonly<{
  brand_raw: string;
  product_count: number;
  sample_product_ids: string[];
  sample_product_names: string[];
}>;

export type AdminBrandAliasRecomputeResult = Readonly<{
  product_id: string;
  previous_brand_id: string | null;
  new_brand_id: string;
}>;

const BRAND_COLUMNS = [
  "id",
  "display_name",
  "slug",
  "aliases",
  "logo_url",
  "hero_image_url",
  "country_of_origin",
  "short_description",
  "long_description",
  "is_visible_on_directory",
  "is_featured_homepage_brand",
  "brand_tier",
  "created_at",
  "updated_at",
].join(", ");

export async function listAllBrandsForAdmin(): Promise<BrandRecord[]> {
  const { data, error } = await supabaseAdmin
    .from("brands")
    .select(BRAND_COLUMNS)
    .order("display_name", { ascending: true });

  if (error) {
    throw new Error(`Admin brands query failed: ${error.message}`);
  }

  return (data as unknown as BrandRow[]).map(mapBrand);
}

export async function listBrandListItemsForAdmin(): Promise<AdminBrandListItem[]> {
  const [brands, counts] = await Promise.all([listAllBrandsForAdmin(), countProductsByBrand()]);

  return brands.map((brand) => {
    const brandCounts = counts.get(brand.id) ?? { total: 0, visible: 0 };

    return {
      ...brand,
      aliases_count: brand.aliases.length,
      products_visible_count: brandCounts.visible,
      products_total_count: brandCounts.total,
    };
  });
}

export async function findBrandByIdForAdmin(id: string): Promise<BrandRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("brands")
    .select(BRAND_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Admin brand by id query failed: ${error.message}`);
  }

  return data ? mapBrand(data as unknown as BrandRow) : null;
}

export async function upsertBrand(row: BrandInsert): Promise<BrandRecord> {
  const { data, error } = await supabaseAdmin
    .from("brands")
    .upsert(row, { onConflict: "slug" })
    .select(BRAND_COLUMNS)
    .single();

  if (error) {
    throw new Error(`Admin brand upsert failed: ${error.message}`);
  }

  return mapBrand(data as unknown as BrandRow);
}

export async function updateBrand(id: string, patch: BrandUpdate): Promise<BrandRecord> {
  const { data, error } = await supabaseAdmin
    .from("brands")
    .update(patch)
    .eq("id", id)
    .select(BRAND_COLUMNS)
    .single();

  if (error) {
    throw new Error(`Admin brand update failed: ${error.message}`);
  }

  return mapBrand(data as unknown as BrandRow);
}

export async function updateBrandIfFresh(
  id: string,
  expectedUpdatedAt: string,
  patch: BrandUpdate,
): Promise<BrandRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("brands")
    .update(patch)
    .eq("id", id)
    .eq("updated_at", expectedUpdatedAt)
    .select(BRAND_COLUMNS)
    .maybeSingle();

  if (error) {
    throw new Error(`Admin brand stale-safe update failed: ${error.message}`);
  }

  return data ? mapBrand(data as unknown as BrandRow) : null;
}

export async function countFeaturedHomepageBrandsForAdmin(
  excludeBrandId?: string,
): Promise<number> {
  let query = supabaseAdmin
    .from("brands")
    .select("id", { count: "exact", head: true })
    .eq("is_featured_homepage_brand", true);

  if (excludeBrandId) {
    query = query.neq("id", excludeBrandId);
  }

  const { error, count } = await query;

  if (error) {
    throw new Error(`Admin featured brand count failed: ${error.message}`);
  }

  return count ?? 0;
}

export async function listUnmatchedBrandRawsForAdmin(): Promise<AdminUnmatchedBrandRaw[]> {
  const { data, error } = await supabaseAdmin
    .from("products")
    .select("id, name, brand_raw")
    .is("brand_id", null)
    .not("brand_raw", "is", null)
    .order("brand_raw", { ascending: true });

  if (error) {
    throw new Error(`Admin unmatched brand_raw query failed: ${error.message}`);
  }

  const grouped = new Map<string, { ids: string[]; names: string[] }>();

  for (const row of (data as Pick<ProductRow, "id" | "name" | "brand_raw">[]) ?? []) {
    if (!row.brand_raw) {
      continue;
    }

    const current = grouped.get(row.brand_raw) ?? { ids: [], names: [] };
    current.ids.push(row.id);
    current.names.push(row.name);
    grouped.set(row.brand_raw, current);
  }

  return Array.from(grouped.entries()).map(([brandRaw, products]) => ({
    brand_raw: brandRaw,
    product_count: products.ids.length,
    sample_product_ids: products.ids.slice(0, 5),
    sample_product_names: products.names.slice(0, 5),
  }));
}

export async function listOrphanCanonicalBrandsForAdmin(): Promise<BrandRecord[]> {
  const items = await listBrandListItemsForAdmin();
  return items.filter((brand) => brand.products_total_count === 0).map(toBrandRecord);
}

export async function addBrandAliasAndRecomputeProductsForAdmin(
  brandId: string,
  alias: string,
): Promise<AdminBrandAliasRecomputeResult[]> {
  const { data, error } = await supabaseAdmin.rpc("admin_add_brand_alias_and_recompute", {
    p_alias: alias,
    p_brand_id: brandId,
  });

  if (error) {
    throw new Error(`Admin brand alias recompute failed: ${error.message}`);
  }

  return (Array.isArray(data) ? data : []) as AdminBrandAliasRecomputeResult[];
}

export async function uploadBrandImageAssetForAdmin(
  asset: PreparedBrandImageUpload,
): Promise<{ publicUrl: string }> {
  await ensureBrandImagesBucket();

  const { error } = await supabaseAdmin.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .upload(asset.storagePath, asset.bytes, {
      contentType: asset.contentType,
      upsert: false,
    });

  if (error) {
    throw new Error(`Brand image storage upload failed: ${error.message}`);
  }

  const { data } = supabaseAdmin.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(asset.storagePath);

  return { publicUrl: data.publicUrl };
}

async function countProductsByBrand(): Promise<Map<string, { total: number; visible: number }>> {
  const { data, error } = await supabaseAdmin
    .from("products")
    .select("brand_id, is_public_visible")
    .not("brand_id", "is", null);

  if (error) {
    throw new Error(`Admin brand product counts failed: ${error.message}`);
  }

  const counts = new Map<string, { total: number; visible: number }>();

  for (const row of (data as Pick<ProductRow, "brand_id" | "is_public_visible">[]) ?? []) {
    if (!row.brand_id) {
      continue;
    }

    const current = counts.get(row.brand_id) ?? { total: 0, visible: 0 };
    current.total += 1;
    current.visible += row.is_public_visible ? 1 : 0;
    counts.set(row.brand_id, current);
  }

  return counts;
}

async function ensureBrandImagesBucket(): Promise<void> {
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
    throw new Error(`Brand image bucket setup failed: ${createError.message}`);
  }
}

function mapBrand(row: BrandRow): BrandRecord {
  return {
    ...row,
    aliases: row.aliases ?? [],
    brand_tier:
      row.brand_tier === "heavy" || row.brand_tier === "medium" || row.brand_tier === "light"
        ? row.brand_tier
        : null,
  };
}

function toBrandRecord(item: AdminBrandListItem): BrandRecord {
  return {
    id: item.id,
    display_name: item.display_name,
    slug: item.slug,
    aliases: item.aliases,
    logo_url: item.logo_url,
    hero_image_url: item.hero_image_url,
    country_of_origin: item.country_of_origin,
    short_description: item.short_description,
    long_description: item.long_description,
    is_visible_on_directory: item.is_visible_on_directory,
    is_featured_homepage_brand: item.is_featured_homepage_brand,
    brand_tier: item.brand_tier,
    created_at: item.created_at,
    updated_at: item.updated_at,
  };
}
