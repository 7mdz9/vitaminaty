import "server-only";

import { supabaseAdmin } from "@/server/db/supabase-admin";
import { createSupabaseServerClient } from "@/server/db/supabase-server";
import type { Database } from "@/lib/supabase/types.generated";
import type { CategoryRecord, MdCategoryMappingRecord, ParentNav } from "@/types/category";

type PublicClient = Pick<Awaited<ReturnType<typeof createSupabaseServerClient>>, "from">;
type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];
type CategoryInsert = Database["public"]["Tables"]["categories"]["Insert"];
type CategoryUpdate = Database["public"]["Tables"]["categories"]["Update"];
type MdCategoryMappingRow = Database["public"]["Tables"]["md_category_mapping"]["Row"];

export type AdminCategoryListItem = CategoryRecord & {
  product_count: number;
};

export type CategoryReorderItem = Readonly<{
  categoryId: string;
  parentId: string | null;
  sortOrder: number;
}>;

export type CategoryReorderChange = Readonly<{
  category_id: string;
  before_parent_id: string | null;
  after_parent_id: string | null;
  before_sort_order: number;
  after_sort_order: number;
}>;

const CATEGORY_COLUMNS = [
  "id",
  "name",
  "slug",
  "parent_nav",
  "parent_id",
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

export async function listCategoryListItemsForAdmin(): Promise<AdminCategoryListItem[]> {
  const [categories, counts] = await Promise.all([
    listAllCategoriesForAdmin(),
    countProductsByCategory(),
  ]);

  return categories.map((category) => ({
    ...category,
    product_count: counts.get(category.id) ?? 0,
  }));
}

export async function findCategoryByIdForAdmin(id: string): Promise<CategoryRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("categories")
    .select(CATEGORY_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Admin category by id query failed: ${error.message}`);
  }

  return data ? mapCategory(data as unknown as CategoryRow) : null;
}

export async function createCategory(row: CategoryInsert): Promise<CategoryRecord> {
  const { data, error } = await supabaseAdmin
    .from("categories")
    .insert(row)
    .select(CATEGORY_COLUMNS)
    .single();

  if (error) {
    throw new Error(`Category create failed: ${error.message}`);
  }

  return mapCategory(data as unknown as CategoryRow);
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

export async function updateCategoryIfFresh(
  id: string,
  expectedUpdatedAt: string,
  patch: CategoryUpdate,
): Promise<CategoryRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("categories")
    .update(patch)
    .eq("id", id)
    .eq("updated_at", expectedUpdatedAt)
    .select(CATEGORY_COLUMNS)
    .maybeSingle();

  if (error) {
    throw new Error(`Category stale-safe update failed: ${error.message}`);
  }

  return data ? mapCategory(data as unknown as CategoryRow) : null;
}

export async function reorderCategoriesForAdmin(
  items: CategoryReorderItem[],
): Promise<CategoryReorderChange[]> {
  const { data, error } = await supabaseAdmin.rpc("admin_reorder_categories", {
    p_items: items.map((item) => ({
      id: item.categoryId,
      parent_id: item.parentId,
      sort_order: item.sortOrder,
    })),
  });

  if (error) {
    throw new Error(`Category reorder failed: ${error.message}`);
  }

  return (Array.isArray(data) ? data : []) as CategoryReorderChange[];
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

async function countProductsByCategory(): Promise<Map<string, number>> {
  const { data, error } = await supabaseAdmin
    .from("products")
    .select("category_id")
    .not("category_id", "is", null);

  if (error) {
    throw new Error(`Admin category product counts failed: ${error.message}`);
  }

  const counts = new Map<string, number>();

  for (const row of (data as Array<
    Pick<Database["public"]["Tables"]["products"]["Row"], "category_id">
  >) ?? []) {
    if (row.category_id) {
      counts.set(row.category_id, (counts.get(row.category_id) ?? 0) + 1);
    }
  }

  return counts;
}

function mapCategory(row: CategoryRow): CategoryRecord {
  return {
    ...row,
    parent_nav: row.parent_nav as ParentNav,
    parent_id: row.parent_id ?? null,
    subcategories: row.subcategories ?? [],
    supported_goals: row.supported_goals ?? [],
  };
}

function mapMdCategoryMapping(row: MdCategoryMappingRow): MdCategoryMappingRecord {
  return row;
}
