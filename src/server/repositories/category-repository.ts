import "server-only";

import { supabaseAdmin } from "@/server/db/supabase-admin";
import { createSupabaseServerClient } from "@/server/db/supabase-server";
import type { Database } from "@/lib/supabase/types.generated";
import type { CategoryRecord, MdCategoryMappingRecord, ParentNav } from "@/types/category";

type PublicClient = Pick<Awaited<ReturnType<typeof createSupabaseServerClient>>, "from">;
type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];
type CategoryUpdate = Database["public"]["Tables"]["categories"]["Update"];
type MdCategoryMappingRow = Database["public"]["Tables"]["md_category_mapping"]["Row"];

const CATEGORY_COLUMNS = [
  "id",
  "name",
  "slug",
  "parent_nav",
  "subcategories",
  "supported_goals",
  "listing_copy",
  "seo_title",
  "seo_description",
  "is_visible",
  "sort_order",
  "created_at",
  "updated_at",
].join(", ");

const MD_MAPPING_COLUMNS = "md_category, default_public_category_slug, requires_split, split_hint";

export async function listCategories(client?: PublicClient): Promise<CategoryRecord[]> {
  const supabase = await resolvePublicClient(client);
  const { data, error } = await supabase
    .from("categories")
    .select(CATEGORY_COLUMNS)
    .eq("is_visible", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Categories query failed: ${error.message}`);
  }

  return (data as unknown as CategoryRow[]).map(mapCategory);
}

export async function findCategoryBySlug(
  slug: string,
  client?: PublicClient,
): Promise<CategoryRecord | null> {
  const supabase = await resolvePublicClient(client);
  const { data, error } = await supabase
    .from("categories")
    .select(CATEGORY_COLUMNS)
    .eq("slug", slug)
    .eq("is_visible", true)
    .maybeSingle();

  if (error) {
    throw new Error(`Category by slug query failed: ${error.message}`);
  }

  return data ? mapCategory(data as unknown as CategoryRow) : null;
}

export async function listAllCategoriesForAdmin(): Promise<CategoryRecord[]> {
  const { data, error } = await supabaseAdmin
    .from("categories")
    .select(CATEGORY_COLUMNS)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Admin categories query failed: ${error.message}`);
  }

  return (data as unknown as CategoryRow[]).map(mapCategory);
}

export async function updateCategory(id: string, patch: CategoryUpdate): Promise<CategoryRecord> {
  const { data, error } = await supabaseAdmin
    .from("categories")
    .update(patch)
    .eq("id", id)
    .select(CATEGORY_COLUMNS)
    .single();

  if (error) {
    throw new Error(`Category update failed: ${error.message}`);
  }

  return mapCategory(data as unknown as CategoryRow);
}

export async function listMdCategoryMappings(
  client?: PublicClient,
): Promise<MdCategoryMappingRecord[]> {
  const supabase = await resolvePublicClient(client);
  const { data, error } = await supabase
    .from("md_category_mapping")
    .select(MD_MAPPING_COLUMNS)
    .order("md_category", { ascending: true });

  if (error) {
    throw new Error(`MD category mapping query failed: ${error.message}`);
  }

  return (data as unknown as MdCategoryMappingRow[]).map(mapMdCategoryMapping);
}

async function resolvePublicClient(client?: PublicClient): Promise<PublicClient> {
  return client ?? createSupabaseServerClient();
}

function mapCategory(row: CategoryRow): CategoryRecord {
  return {
    ...row,
    parent_nav: row.parent_nav as ParentNav,
    subcategories: row.subcategories ?? [],
    supported_goals: row.supported_goals ?? [],
  };
}

function mapMdCategoryMapping(row: MdCategoryMappingRow): MdCategoryMappingRecord {
  return row;
}
