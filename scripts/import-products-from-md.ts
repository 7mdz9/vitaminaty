import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

import type { Database, Json } from "../src/lib/supabase/types.generated";

type ProductInsert = Database["public"]["Tables"]["products"]["Insert"];
type BrandRow = Database["public"]["Tables"]["brands"]["Row"];
type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];
type MdCategoryMappingRow = Database["public"]["Tables"]["md_category_mapping"]["Row"];
type FieldStatus = "complete" | "missing" | "needs_review";

type SourceProduct = {
  nameRaw: string;
  brandRaw: string;
  wholesaleRaw: string;
  retailRaw: string;
  quantityRaw: string;
  sourceCategory: string;
  sourceLine: number;
  sourceNotes: string | null;
  sourceRow: number[];
};

type LocalSupabaseEnv = {
  apiUrl: string;
  serviceRoleKey: string;
};

type VerificationCounts = {
  products: number;
  distinctBrands: number;
  casePack: number;
  missingPrice: number;
  needsCategoryReview: number;
  nonImported: number;
  publicVisible: number;
  publicVisibleCasePack: number;
  rowsMissingFieldStatusKeys: number;
  rowsMissingReviewFlagKeys: number;
};

const SOURCE_FILE = "product.md";
const SOURCE_PATH = path.join(process.cwd(), "docs", "reference", SOURCE_FILE);
const BATCH_SIZE = 100;

const FIELD_STATUS_KEYS = [
  "name",
  "brand",
  "category",
  "form",
  "retail_price",
  "description",
  "benefits",
  "image",
  "nutrition_panel",
  "ingredients",
  "allergens",
  "directions",
  "warnings",
  "storage",
  "seo_title",
  "seo_description",
  "often_bought_with",
] as const;

const REVIEW_FLAG_KEYS = [
  "missing_price",
  "missing_image",
  "missing_stock_quantity",
  "case_pack",
  "duplicate_suspected",
  "multiple_price_pairs",
  "needs_category_review",
  "needs_brand_review",
  "needs_label_data",
] as const;

const SOURCE_CATEGORY_ALIASES = new Map<string, string>([
  ["Proteins & Mass Gainers", "Proteins & Mass Gainers"],
  ["Amino Acids & BCAA/EAA", "Amino Acids / BCAAs / EAAs"],
  ["Creatine", "Creatine"],
  ["Pre-Workout & Performance", "Pre Workout / Pre-Workout"],
  ["Weight Management & Fat Burners", "Fat Burners / Weight Loss"],
  ["Energy & Hydration", "Drinks / Beverages"],
  ["Carbohydrates & Endurance", "Specialized / Other Health"],
  ["Vitamins & Health Supplements", "Vitamins"],
  ["Digestive Health", "Daily Health / Wellness"],
  ["Beauty & Personal Care", "Specialized / Other Health"],
  ["Food & Snacks", "Snacks"],
  ["Beverages", "Drinks / Beverages"],
  ["Honey", "Snacks"],
  ["Gym Accessories", "Specialized / Other Health"],
  ["Uncategorized", "Uncategorized / Misc"],
]);

const ACRONYMS = new Set([
  "BCAA",
  "EAA",
  "CLA",
  "B12",
  "B6",
  "HMB",
  "RTD",
  "ISO",
  "HD",
  "XP",
  "NAC",
  "TUDCA",
  "MSM",
  "MCT",
  "ZMA",
  "C4",
]);

function log(event: string, data: Record<string, unknown> = {}): void {
  process.stdout.write(`${JSON.stringify({ event, ...data })}\n`);
}

async function main(): Promise<void> {
  const localEnv = loadLocalSupabaseEnv();

  const supabase = createClient<Database>(localEnv.apiUrl, localEnv.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const [markdown, brands, categories, mappings] = await Promise.all([
    readFile(SOURCE_PATH, "utf8"),
    loadBrands(supabase),
    loadCategories(supabase),
    loadMdCategoryMappings(supabase),
  ]);

  const sourceRows = parseCatalog(markdown);
  const importRows = sourceRows.map((row) =>
    mapProductInsert(row, {
      brandResolver: createBrandResolver(brands),
      categoriesBySlug: new Map(categories.map((category) => [category.slug, category])),
      mappingsByMdCategory: new Map(mappings.map((mapping) => [mapping.md_category, mapping])),
    }),
  );

  log("import-products.parsed", {
    sourceRows: sourceRows.length,
    brandsLoaded: brands.length,
    categoriesLoaded: categories.length,
    mappingsLoaded: mappings.length,
  });

  for (let index = 0; index < importRows.length; index += BATCH_SIZE) {
    const batch = importRows.slice(index, index + BATCH_SIZE);
    await bulkInsertImported(supabase, batch);
    log("import-products.batch_upserted", {
      from: index + 1,
      to: index + batch.length,
      total: importRows.length,
    });
  }

  const counts = await verifyImport(supabase);
  log("import-products.verified", counts);
  assertDodCounts(counts);
}

async function bulkInsertImported(
  supabase: ReturnType<typeof createClient<Database>>,
  rows: ProductInsert[],
): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  const { error } = await supabase.from("products").upsert(rows, { onConflict: "slug" }).select("id");

  if (error) {
    throw new Error(`Imported products bulk upsert failed: ${error.message}`);
  }
}

function loadLocalSupabaseEnv(): LocalSupabaseEnv {
  const output =
    process.platform === "win32"
      ? execFileSync("cmd.exe", ["/d", "/s", "/c", "pnpm exec supabase status -o env"], {
          cwd: process.cwd(),
        }).toString("utf8")
      : execFileSync("pnpm", ["exec", "supabase", "status", "-o", "env"], {
          cwd: process.cwd(),
        }).toString("utf8");

  const values = new Map<string, string>();

  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)="(.*)"$/);

    if (match) {
      values.set(match[1], match[2]);
    }
  }

  const apiUrl = requireEnvValue(values, "API_URL");
  const dbUrl = requireEnvValue(values, "DB_URL");

  if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(apiUrl)) {
    throw new Error(`Refusing to import against non-local Supabase API URL: ${apiUrl}`);
  }

  if (!/^postgresql:\/\/postgres:postgres@(127\.0\.0\.1|localhost):\d+\/postgres$/.test(dbUrl)) {
    throw new Error("Refusing to import against non-local Supabase database URL.");
  }

  return {
    apiUrl,
    serviceRoleKey: requireEnvValue(values, "SERVICE_ROLE_KEY"),
  };
}

function requireEnvValue(values: Map<string, string>, key: string): string {
  const value = values.get(key);

  if (!value) {
    throw new Error(`Missing ${key} from local Supabase status output.`);
  }

  return value;
}

async function loadBrands(supabase: ReturnType<typeof createClient<Database>>): Promise<BrandRow[]> {
  const { data, error } = await supabase
    .from("brands")
    .select("id, display_name, slug, aliases, brand_tier, country_of_origin, hero_image_url, is_featured_homepage_brand, is_visible_on_directory, logo_url, long_description, short_description, created_at, updated_at")
    .order("display_name", { ascending: true });

  if (error) {
    throw new Error(`Brand lookup failed: ${error.message}`);
  }

  return data;
}

async function loadCategories(
  supabase: ReturnType<typeof createClient<Database>>,
): Promise<CategoryRow[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug, parent_nav, subcategories, supported_goals, listing_copy, seo_title, seo_description, is_visible, sort_order, created_at, updated_at")
    .order("sort_order", { ascending: true });

  if (error) {
    throw new Error(`Category lookup failed: ${error.message}`);
  }

  return data;
}

async function loadMdCategoryMappings(
  supabase: ReturnType<typeof createClient<Database>>,
): Promise<MdCategoryMappingRow[]> {
  const { data, error } = await supabase
    .from("md_category_mapping")
    .select("md_category, default_public_category_slug, requires_split, split_hint")
    .order("md_category", { ascending: true });

  if (error) {
    throw new Error(`MD category mapping lookup failed: ${error.message}`);
  }

  return data;
}

function parseCatalog(markdown: string): SourceProduct[] {
  const rows: SourceProduct[] = [];
  const lines = markdown.split(/\r?\n/);
  let currentCategory: string | null = null;
  let insideProductTable = false;

  lines.forEach((line, index) => {
    const heading = line.match(/^###\s+(.+)$/);

    if (heading) {
      currentCategory = heading[1].trim();
      insideProductTable = false;
      return;
    }

    if (!currentCategory) {
      return;
    }

    if (line.startsWith("| Product Name(s) Exactly From Excel |")) {
      insideProductTable = true;
      return;
    }

    if (!insideProductTable) {
      return;
    }

    if (/^\|\s*-+/.test(line)) {
      return;
    }

    if (!line.startsWith("|")) {
      insideProductTable = false;
      return;
    }

    const cells = splitMarkdownRow(line);

    if (cells.length !== 7) {
      throw new Error(`Unexpected product table row at ${SOURCE_FILE}:${index + 1}`);
    }

    const [nameRaw, brandRaw, wholesaleRaw, retailRaw, quantityRaw, sourceRowRaw, sourceNotesRaw] =
      cells.map(normalizeCell);

    if (!nameRaw || nameRaw === "Product Name(s) Exactly From Excel") {
      return;
    }

    rows.push({
      nameRaw,
      brandRaw,
      wholesaleRaw,
      retailRaw,
      quantityRaw,
      sourceCategory: currentCategory,
      sourceLine: index + 1,
      sourceNotes: sourceNotesRaw || null,
      sourceRow: parseSourceRows(sourceRowRaw),
    });
  });

  return rows;
}

function splitMarkdownRow(line: string): string[] {
  return line
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function normalizeCell(cell: string): string {
  return cell.replace(/<br\s*\/?>/gi, "\n").replace(/&amp;/gi, "&").trim();
}

function parseSourceRows(value: string): number[] {
  return [...value.matchAll(/\d+/g)].map((match) => Number(match[0]));
}

function createBrandResolver(brands: BrandRow[]): (brandRaw: string) => BrandRow | null {
  const exactAliases = new Map<string, BrandRow>();
  const candidates: Array<{ key: string; brand: BrandRow }> = [];

  for (const brand of brands) {
    const aliases = [brand.display_name, brand.slug, ...(brand.aliases ?? [])];

    for (const alias of aliases) {
      const key = normalizeLookupKey(alias);

      if (!key) {
        continue;
      }

      exactAliases.set(key, brand);
      candidates.push({ key, brand });
    }
  }

  return (brandRaw: string) => {
    const rawKey = normalizeLookupKey(brandRaw);
    const exact = exactAliases.get(rawKey);

    if (exact) {
      return exact;
    }

    if (rawKey.length < 5) {
      return null;
    }

    let best: { distance: number; brand: BrandRow } | null = null;

    for (const candidate of candidates) {
      if (candidate.key.length < 5) {
        continue;
      }

      const distance = levenshtein(rawKey, candidate.key);
      const ratio = distance / Math.max(rawKey.length, candidate.key.length);

      if (ratio <= 0.15 && (!best || distance < best.distance)) {
        best = { distance, brand: candidate.brand };
      }
    }

    return best?.brand ?? null;
  };
}

function mapProductInsert(
  row: SourceProduct,
  context: {
    brandResolver: (brandRaw: string) => BrandRow | null;
    categoriesBySlug: Map<string, CategoryRow>;
    mappingsByMdCategory: Map<string, MdCategoryMappingRow>;
  },
): ProductInsert {
  const brand = context.brandResolver(row.brandRaw);
  const category = resolveCategory(row, context);
  const retailPrice = parseSinglePrice(row.retailRaw);
  const wholesalePrice = parseSinglePrice(row.wholesaleRaw);
  const multiplePricePairs =
    priceTokenCount(row.retailRaw) > 1 ||
    priceTokenCount(row.wholesaleRaw) > 1 ||
    /multiple source price pairs/i.test(row.sourceNotes ?? "");
  const casePack = isCasePack(row);
  const fieldsStatus = createFieldsStatus({
    hasBrand: Boolean(brand),
    hasCategory: Boolean(category),
    hasRetailPrice: retailPrice !== null,
  });
  const reviewFlags = createReviewFlags({
    casePack,
    duplicateSuspected: row.sourceRow.length > 1 || row.nameRaw.includes("\n"),
    missingPrice: retailPrice === null,
    multiplePricePairs,
    needsBrandReview: !brand,
    needsCategoryReview: !category,
  });
  const normalizedName = normalizeProductName(row.nameRaw, row.brandRaw, brand);
  const hash = hashProduct(row);

  return {
    admin_review_flags: reviewFlags as Json,
    brand_id: brand?.id ?? null,
    brand_raw: row.brandRaw,
    category_id: category?.id ?? null,
    compare_at_price_aed: null,
    completion_score: calculateCompletionScore(fieldsStatus, reviewFlags),
    content: {} as Json,
    featured_score: 0,
    fields_status: fieldsStatus as Json,
    form: null,
    is_add_to_cart_enabled: false,
    is_checkout_enabled: false,
    is_public_visible: false,
    label_data: {} as Json,
    name: normalizedName,
    name_raw: row.nameRaw,
    published_at: null,
    retail_price_aed: multiplePricePairs ? null : retailPrice,
    slug: `${generateSlug(normalizedName).slice(0, 91)}-${hash.slice(0, 8)}`,
    source_category: row.sourceCategory,
    source_file: SOURCE_FILE,
    source_notes: row.sourceNotes,
    source_row: row.sourceRow,
    status: "imported",
    wholesale_price_internal: multiplePricePairs ? null : wholesalePrice,
  };
}

function resolveCategory(
  row: SourceProduct,
  context: {
    categoriesBySlug: Map<string, CategoryRow>;
    mappingsByMdCategory: Map<string, MdCategoryMappingRow>;
  },
): CategoryRow | null {
  const mappedMdCategory = SOURCE_CATEGORY_ALIASES.get(row.sourceCategory);

  if (!mappedMdCategory) {
    throw new Error(`No seeded MD category alias for ${row.sourceCategory} at ${SOURCE_FILE}:${row.sourceLine}`);
  }

  const mapping = context.mappingsByMdCategory.get(mappedMdCategory);

  if (!mapping) {
    throw new Error(`No md_category_mapping row for ${mappedMdCategory}`);
  }

  let slug = mapping.default_public_category_slug;

  if (mapping.requires_split) {
    if (mapping.md_category === "Proteins & Mass Gainers") {
      slug = /\bGAINER\b/i.test(row.nameRaw) ? "mass-gainers" : "proteins";
    }

    if (mapping.md_category === "Snacks") {
      slug = /\bBARS?\b/i.test(row.nameRaw) ? "protein-bars" : "healthy-snacks";
    }
  }

  if (!slug) {
    return null;
  }

  const category = context.categoriesBySlug.get(slug);

  if (!category) {
    throw new Error(`No public category row found for slug ${slug}`);
  }

  return category;
}

function createFieldsStatus(input: {
  hasBrand: boolean;
  hasCategory: boolean;
  hasRetailPrice: boolean;
}): Record<(typeof FIELD_STATUS_KEYS)[number], FieldStatus> {
  return {
    name: "complete",
    brand: input.hasBrand ? "complete" : "needs_review",
    category: input.hasCategory ? "complete" : "needs_review",
    form: "missing",
    retail_price: input.hasRetailPrice ? "complete" : "missing",
    description: "missing",
    benefits: "missing",
    image: "missing",
    nutrition_panel: "missing",
    ingredients: "missing",
    allergens: "missing",
    directions: "missing",
    warnings: "missing",
    storage: "missing",
    seo_title: "missing",
    seo_description: "missing",
    often_bought_with: "missing",
  };
}

function createReviewFlags(input: {
  casePack: boolean;
  duplicateSuspected: boolean;
  missingPrice: boolean;
  multiplePricePairs: boolean;
  needsBrandReview: boolean;
  needsCategoryReview: boolean;
}): Record<(typeof REVIEW_FLAG_KEYS)[number], boolean> {
  return {
    missing_price: input.missingPrice,
    missing_image: true,
    missing_stock_quantity: true,
    case_pack: input.casePack,
    duplicate_suspected: input.duplicateSuspected,
    multiple_price_pairs: input.multiplePricePairs,
    needs_category_review: input.needsCategoryReview,
    needs_brand_review: input.needsBrandReview,
    needs_label_data: true,
  };
}

function calculateCompletionScore(
  fieldsStatus: Record<(typeof FIELD_STATUS_KEYS)[number], FieldStatus>,
  reviewFlags: Record<(typeof REVIEW_FLAG_KEYS)[number], boolean>,
): number {
  const completeFields = Object.values(fieldsStatus).filter((status) => status === "complete").length;
  const reviewPenalty = Object.values(reviewFlags).filter(Boolean).length;

  return Math.max(0, Math.min(100, completeFields * 6 - reviewPenalty * 3));
}

function parseSinglePrice(value: string): number | null {
  if (!value || /n\/a/i.test(value)) {
    return null;
  }

  const tokens = [...value.matchAll(/\d+(?:\.\d+)?/g)];

  if (tokens.length !== 1) {
    return null;
  }

  const price = Number(tokens[0][0]);

  return Number.isInteger(price) ? price : null;
}

function priceTokenCount(value: string): number {
  return [...value.matchAll(/\d+(?:\.\d+)?/g)].length;
}

function isCasePack(row: SourceProduct): boolean {
  const searchable = `${row.nameRaw} ${row.sourceNotes ?? ""}`;

  return /\b\d+\s*\/\s*(?:CASE|C|CA|CS)\b/i.test(searchable) || /\bCASE\s*PACK\b/i.test(searchable);
}

function normalizeProductName(nameRaw: string, brandRaw: string, brand: BrandRow | null): string {
  const candidates = [brandRaw, brand?.display_name, ...(brand?.aliases ?? [])]
    .filter((candidate): candidate is string => Boolean(candidate))
    .sort((a, b) => b.length - a.length);
  let cleaned = nameRaw.replace(/\s+/g, " ").trim();

  for (const candidate of candidates) {
    const escaped = escapeRegExp(candidate);
    const prefixPattern = new RegExp(`^${escaped}(?:\\s+|-|:)+`, "i");
    cleaned = cleaned.replace(prefixPattern, "").trim();
  }

  return titleCase(cleaned || nameRaw);
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/\s+/)
    .map((word) => {
      const stripped = word.replace(/[^a-z0-9]/gi, "").toUpperCase();

      if (ACRONYMS.has(stripped) || /\d/.test(word)) {
        return word.toUpperCase();
      }

      return word.replace(/[a-z]/i, (letter) => letter.toUpperCase());
    })
    .join(" ");
}

function generateSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 100);

  return slug || "imported-product";
}

function hashProduct(row: SourceProduct): string {
  return createHash("sha256")
    .update([row.nameRaw, row.brandRaw, row.sourceRow.join(",")].join("\0"))
    .digest("hex");
}

function normalizeLookupKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function levenshtein(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = Array.from({ length: right.length + 1 }, () => 0);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    current[0] = leftIndex;

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const cost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + cost,
      );
    }

    for (let index = 0; index < previous.length; index += 1) {
      previous[index] = current[index];
    }
  }

  return previous[right.length];
}

async function verifyImport(
  supabase: ReturnType<typeof createClient<Database>>,
): Promise<VerificationCounts> {
  const { data, error } = await supabase
    .from("products")
    .select("brand_id, status, is_public_visible, fields_status, admin_review_flags");

  if (error) {
    throw new Error(`Post-import verification query failed: ${error.message}`);
  }

  const rows = data ?? [];

  return {
    products: rows.length,
    distinctBrands: new Set(rows.map((row) => row.brand_id).filter(Boolean)).size,
    casePack: rows.filter((row) => Boolean(readFlag(row.admin_review_flags, "case_pack"))).length,
    missingPrice: rows.filter((row) => Boolean(readFlag(row.admin_review_flags, "missing_price"))).length,
    needsCategoryReview: rows.filter((row) =>
      Boolean(readFlag(row.admin_review_flags, "needs_category_review")),
    ).length,
    nonImported: rows.filter((row) => row.status !== "imported").length,
    publicVisible: rows.filter((row) => row.is_public_visible).length,
    publicVisibleCasePack: rows.filter(
      (row) => row.is_public_visible && Boolean(readFlag(row.admin_review_flags, "case_pack")),
    ).length,
    rowsMissingFieldStatusKeys: rows.filter(
      (row) => Object.keys(row.fields_status as Record<string, unknown>).length !== FIELD_STATUS_KEYS.length,
    ).length,
    rowsMissingReviewFlagKeys: rows.filter(
      (row) => Object.keys(row.admin_review_flags as Record<string, unknown>).length !== REVIEW_FLAG_KEYS.length,
    ).length,
  };
}

function readFlag(value: Json, key: (typeof REVIEW_FLAG_KEYS)[number]): boolean | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const flag = (value as Record<string, unknown>)[key];

  return typeof flag === "boolean" ? flag : null;
}

function assertDodCounts(counts: VerificationCounts): void {
  const failures = [
    counts.products < 777 || counts.products > 797
      ? `product count ${counts.products} outside [777, 797]`
      : null,
    counts.distinctBrands < 28 ? `distinct brand count ${counts.distinctBrands} below 28` : null,
    counts.casePack < 130 || counts.casePack > 150
      ? `case_pack count ${counts.casePack} outside [130, 150]`
      : null,
    counts.missingPrice < 350 || counts.missingPrice > 370
      ? `missing_price count ${counts.missingPrice} outside [350, 370]`
      : null,
    counts.needsCategoryReview < 26 || counts.needsCategoryReview > 46
      ? `needs_category_review count ${counts.needsCategoryReview} outside [26, 46]`
      : null,
    counts.nonImported !== 0 ? `non-imported count ${counts.nonImported} is not 0` : null,
    counts.publicVisible !== 0 ? `public visible count ${counts.publicVisible} is not 0` : null,
    counts.publicVisibleCasePack !== 0
      ? `public visible case-pack count ${counts.publicVisibleCasePack} is not 0`
      : null,
    counts.rowsMissingFieldStatusKeys !== 0
      ? `${counts.rowsMissingFieldStatusKeys} rows do not have ${FIELD_STATUS_KEYS.length} fields_status keys`
      : null,
    counts.rowsMissingReviewFlagKeys !== 0
      ? `${counts.rowsMissingReviewFlagKeys} rows do not have ${REVIEW_FLAG_KEYS.length} admin_review_flags keys`
      : null,
  ].filter(Boolean);

  if (failures.length > 0) {
    throw new Error(`Import verification failed: ${failures.join("; ")}`);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  log("import-products.failed", { message });
  process.exitCode = 1;
});
