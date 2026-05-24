import "server-only";

import { requireAdmin } from "@/lib/auth/policies";
import {
  AdminProductListInputSchema,
  type AdminProductListInput,
} from "@/lib/validation/product";
import {
  findProductEditorDataForAdmin,
  findManyForAdmin,
  listBrandOptionsForAdmin,
  listCategoryOptionsForAdmin,
  type AdminProductEditorData,
  type AdminProductListResult,
  type AdminProductReferenceOption,
} from "@/server/repositories/product-admin-repository";

export type ProductListSearchParams = Record<string, string | string[] | undefined>;

export type ProductListFilters = AdminProductListInput["filters"];

export async function getProductList(
  input: AdminProductListInput,
): Promise<AdminProductListResult> {
  await requireAdmin();
  const parsed = AdminProductListInputSchema.parse(input);

  return findManyForAdmin(parsed);
}

export async function getProductFilterOptions(): Promise<{
  brands: AdminProductReferenceOption[];
  categories: AdminProductReferenceOption[];
}> {
  await requireAdmin();
  const [brands, categories] = await Promise.all([
    listBrandOptionsForAdmin(),
    listCategoryOptionsForAdmin(),
  ]);

  return { brands, categories };
}

export async function getProductEditor(productId: string): Promise<{
  editor: AdminProductEditorData | null;
  brands: AdminProductReferenceOption[];
  categories: AdminProductReferenceOption[];
}> {
  await requireAdmin();
  const [editor, brands, categories] = await Promise.all([
    findProductEditorDataForAdmin(productId),
    listBrandOptionsForAdmin(),
    listCategoryOptionsForAdmin(),
  ]);

  return { editor, brands, categories };
}

export function parseProductListSearchParams(
  searchParams: ProductListSearchParams,
): AdminProductListInput {
  const completionMin = parseOptionalNumber(readOne(searchParams.completion_min));
  const completionMax = parseOptionalNumber(readOne(searchParams.completion_max));

  return AdminProductListInputSchema.parse({
    filters: {
      status: normalizeEmpty(readOne(searchParams.status)) ?? "all",
      reviewFlags: readMany(searchParams.flag),
      stockStatus: normalizeEmpty(readOne(searchParams.stock_status)) ?? "all",
      brandId: normalizeEmpty(readOne(searchParams.brand)),
      categoryId: normalizeEmpty(readOne(searchParams.category)),
      search: normalizeEmpty(readOne(searchParams.q)),
      completionMin,
      completionMax,
    },
    sort: normalizeEmpty(readOne(searchParams.sort)) ?? "recently_updated",
    page: parseOptionalNumber(readOne(searchParams.page)) ?? 1,
    pageSize: parseOptionalNumber(readOne(searchParams.page_size)) ?? 50,
  });
}

function readOne(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function readMany(value: string | string[] | undefined): string[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value.filter(Boolean) : value.split(",").filter(Boolean);
}

function normalizeEmpty(value: string | undefined): string | undefined {
  return value && value !== "all" ? value : undefined;
}

function parseOptionalNumber(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
