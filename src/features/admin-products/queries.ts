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
export type ProductQueueKind =
  | "missing-price"
  | "missing-image"
  | "missing-stock-quantity"
  | "needs-brand-review"
  | "needs-category-review"
  | "needs-label-data"
  | "ready-to-publish"
  | "out-of-stock"
  | "low-stock";

export const PRODUCT_QUEUE_LABELS: Record<ProductQueueKind, string> = {
  "missing-price": "Missing price",
  "missing-image": "Missing image",
  "missing-stock-quantity": "Missing stock quantity",
  "needs-brand-review": "Needs brand review",
  "needs-category-review": "Needs category review",
  "needs-label-data": "Needs label data",
  "ready-to-publish": "Ready to publish",
  "out-of-stock": "Out of stock",
  "low-stock": "Low stock",
};

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

export async function getQueue(
  queueKind: ProductQueueKind,
  input: AdminProductListInput,
): Promise<AdminProductListResult> {
  const parsed = AdminProductListInputSchema.parse(input);
  return getProductList({
    ...parsed,
    filters: {
      ...parsed.filters,
      ...filtersForQueue(queueKind),
    },
  });
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

function filtersForQueue(queueKind: ProductQueueKind): Partial<ProductListFilters> {
  switch (queueKind) {
    case "missing-price":
      return { reviewFlags: ["missing_price"] };
    case "missing-image":
      return { reviewFlags: ["missing_image"] };
    case "missing-stock-quantity":
      return { reviewFlags: ["missing_stock_quantity"] };
    case "needs-brand-review":
      return { reviewFlags: ["needs_brand_review"] };
    case "needs-category-review":
      return { reviewFlags: ["needs_category_review"] };
    case "needs-label-data":
      return { reviewFlags: ["needs_label_data"] };
    case "ready-to-publish":
      return { status: "ready_to_publish" };
    case "out-of-stock":
      return { stockStatus: "out_of_stock" };
    case "low-stock":
      return { stockStatus: "low_stock" };
  }
}
