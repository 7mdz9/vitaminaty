import "server-only";

import { supabaseAdmin } from "@/server/db/supabase-admin";
import type { Database } from "@/lib/supabase/types.generated";
import type {
  HomepageConfigRecord,
  HomepageCurationBrand,
  HomepageCurationProduct,
} from "@/types/homepage";

type HomepageConfigRow = Database["public"]["Tables"]["homepage_configs"]["Row"];
type HomepageConfigUpdate = Database["public"]["Tables"]["homepage_configs"]["Update"];
type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type BrandRow = Database["public"]["Tables"]["brands"]["Row"];
type ProductImageRow = Database["public"]["Tables"]["product_images"]["Row"];

const HOMEPAGE_COLUMNS = [
  "id",
  "singleton_key",
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
  "updated_by",
  "created_at",
  "updated_at",
].join(", ");

export async function getHomepageConfigForAdmin(): Promise<HomepageConfigRecord> {
  const { data, error } = await supabaseAdmin
    .from("homepage_configs")
    .select(HOMEPAGE_COLUMNS)
    .eq("singleton_key", "homepage")
    .single();

  if (error) {
    throw new Error(`Homepage config query failed: ${error.message}`);
  }

  return mapHomepageConfig(data as unknown as HomepageConfigRow);
}

export async function updateHomepageConfigForAdminIfFresh(
  id: string,
  expectedUpdatedAt: string,
  patch: HomepageConfigUpdate,
): Promise<HomepageConfigRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("homepage_configs")
    .update(patch)
    .eq("id", id)
    .eq("updated_at", expectedUpdatedAt)
    .select(HOMEPAGE_COLUMNS)
    .maybeSingle();

  if (error) {
    throw new Error(`Homepage config stale-safe update failed: ${error.message}`);
  }

  return data ? mapHomepageConfig(data as unknown as HomepageConfigRow) : null;
}

export async function listHomepageProductOptionsForAdmin(): Promise<HomepageCurationProduct[]> {
  const { data, error } = await supabaseAdmin
    .from("products")
    .select("id, name, slug, status, brand_id, updated_at")
    .neq("status", "archived")
    .order("updated_at", { ascending: false })
    .limit(200);

  if (error) {
    throw new Error(`Homepage product options query failed: ${error.message}`);
  }

  return hydrateHomepageProducts(
    (data as Pick<ProductRow, "id" | "name" | "slug" | "status" | "brand_id">[]) ?? [],
  );
}

export async function listHomepageProductsByIdsForAdmin(
  ids: string[],
): Promise<HomepageCurationProduct[]> {
  const uniqueIds = unique(ids);

  if (uniqueIds.length === 0) {
    return [];
  }

  const { data, error } = await supabaseAdmin
    .from("products")
    .select("id, name, slug, status, brand_id")
    .in("id", uniqueIds);

  if (error) {
    throw new Error(`Homepage selected products query failed: ${error.message}`);
  }

  const products = await hydrateHomepageProducts(
    (data as Pick<ProductRow, "id" | "name" | "slug" | "status" | "brand_id">[]) ?? [],
  );
  const productById = new Map(products.map((product) => [product.id, product]));

  return uniqueIds.flatMap((id) => {
    const product = productById.get(id);
    return product ? [product] : [];
  });
}

export async function listHomepageBrandOptionsForAdmin(): Promise<HomepageCurationBrand[]> {
  const { data, error } = await supabaseAdmin
    .from("brands")
    .select("id, display_name, slug, logo_url, hero_image_url")
    .order("display_name", { ascending: true });

  if (error) {
    throw new Error(`Homepage brand options query failed: ${error.message}`);
  }

  return (
    (data as Pick<BrandRow, "id" | "display_name" | "slug" | "logo_url" | "hero_image_url">[]) ?? []
  ).map(mapHomepageBrand);
}

export async function listHomepageBrandsByIdsForAdmin(
  ids: string[],
): Promise<HomepageCurationBrand[]> {
  const uniqueIds = unique(ids);

  if (uniqueIds.length === 0) {
    return [];
  }

  const { data, error } = await supabaseAdmin
    .from("brands")
    .select("id, display_name, slug, logo_url, hero_image_url")
    .in("id", uniqueIds);

  if (error) {
    throw new Error(`Homepage selected brands query failed: ${error.message}`);
  }

  const brands = (
    (data as Pick<BrandRow, "id" | "display_name" | "slug" | "logo_url" | "hero_image_url">[]) ?? []
  ).map(mapHomepageBrand);
  const brandById = new Map(brands.map((brand) => [brand.id, brand]));

  return uniqueIds.flatMap((id) => {
    const brand = brandById.get(id);
    return brand ? [brand] : [];
  });
}

async function hydrateHomepageProducts(
  rows: Pick<ProductRow, "id" | "name" | "slug" | "status" | "brand_id">[],
): Promise<HomepageCurationProduct[]> {
  const [brandMap, imageMap] = await Promise.all([
    fetchBrandNameMap(rows.flatMap((row) => (row.brand_id ? [row.brand_id] : []))),
    fetchPrimaryImageMap(rows.map((row) => row.id)),
  ]);

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    brandName: row.brand_id ? (brandMap.get(row.brand_id) ?? null) : null,
    primaryImageUrl: imageMap.get(row.id) ?? null,
  }));
}

async function fetchBrandNameMap(ids: string[]): Promise<Map<string, string>> {
  const uniqueIds = unique(ids);

  if (uniqueIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabaseAdmin
    .from("brands")
    .select("id, display_name")
    .in("id", uniqueIds);

  if (error) {
    throw new Error(`Homepage brand hydration failed: ${error.message}`);
  }

  return new Map(
    ((data as Pick<BrandRow, "id" | "display_name">[]) ?? []).map((row) => [
      row.id,
      row.display_name,
    ]),
  );
}

async function fetchPrimaryImageMap(productIds: string[]): Promise<Map<string, string>> {
  const uniqueIds = unique(productIds);

  if (uniqueIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabaseAdmin
    .from("product_images")
    .select("product_id, public_url")
    .in("product_id", uniqueIds)
    .eq("is_primary", true);

  if (error) {
    throw new Error(`Homepage product image hydration failed: ${error.message}`);
  }

  return new Map(
    ((data as Pick<ProductImageRow, "product_id" | "public_url">[]) ?? []).map((row) => [
      row.product_id,
      row.public_url,
    ]),
  );
}

function mapHomepageConfig(row: HomepageConfigRow): HomepageConfigRecord {
  return row;
}

function mapHomepageBrand(
  row: Pick<BrandRow, "id" | "display_name" | "slug" | "logo_url" | "hero_image_url">,
): HomepageCurationBrand {
  return {
    id: row.id,
    displayName: row.display_name,
    slug: row.slug,
    logoUrl: row.logo_url,
    heroImageUrl: row.hero_image_url,
  };
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}
