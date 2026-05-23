import "server-only";

import { createSupabaseServerClient } from "@/server/db/supabase-server";
import type { Database } from "@/lib/supabase/types.generated";
import type { BrandRecord } from "@/types/brand";

type PublicClient = Pick<Awaited<ReturnType<typeof createSupabaseServerClient>>, "from">;
type BrandRow = Database["public"]["Tables"]["brands"]["Row"];

export type BrandListFilters = {
  visible_on_directory?: boolean;
};

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

export async function listBrands(
  filters: BrandListFilters = { visible_on_directory: true },
  client?: PublicClient,
): Promise<BrandRecord[]> {
  const supabase = await resolvePublicClient(client);
  let query = supabase
    .from("brands")
    .select(BRAND_COLUMNS)
    .order("display_name", { ascending: true });

  if (filters.visible_on_directory !== undefined) {
    query = query.eq("is_visible_on_directory", filters.visible_on_directory);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Brands query failed: ${error.message}`);
  }

  return (data as unknown as BrandRow[]).map(mapBrand);
}

export async function findBrandBySlug(
  slug: string,
  client?: PublicClient,
): Promise<BrandRecord | null> {
  const supabase = await resolvePublicClient(client);
  const { data, error } = await supabase
    .from("brands")
    .select(BRAND_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new Error(`Brand by slug query failed: ${error.message}`);
  }

  return data ? mapBrand(data as unknown as BrandRow) : null;
}

async function resolvePublicClient(client?: PublicClient): Promise<PublicClient> {
  return client ?? createSupabaseServerClient();
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
