import "server-only";

import { supabaseAdmin } from "@/server/db/supabase-admin";
import type { Database } from "@/lib/supabase/types.generated";
import type { BrandRecord } from "@/types/brand";

type BrandRow = Database["public"]["Tables"]["brands"]["Row"];
type BrandInsert = Database["public"]["Tables"]["brands"]["Insert"];
type BrandUpdate = Database["public"]["Tables"]["brands"]["Update"];

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
