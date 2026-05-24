import { FilterBar } from "@/features/admin-products/components/FilterBar";
import { ProductListTable } from "@/features/admin-products/components/ProductListTable";
import {
  getProductFilterOptions,
  getProductList,
  parseProductListSearchParams,
  type ProductListSearchParams,
} from "@/features/admin-products/queries";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<ProductListSearchParams>;
}>) {
  const params = await searchParams;
  const listInput = parseProductListSearchParams(params);
  const [productList, filterOptions] = await Promise.all([
    getProductList(listInput),
    getProductFilterOptions(),
  ]);

  return (
    <div className="space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-admin-display text-xl text-admin-text">Products</h2>
          <p className="text-admin-sm text-admin-text-muted">
            {productList.total} products · page {productList.page} of {productList.pageCount}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" type="button">
            Quick edit
          </Button>
          <Button size="sm" type="button">
            Import
          </Button>
        </div>
      </header>
      <section className="overflow-hidden rounded-admin-md border border-admin-border bg-admin-surface">
        <FilterBar brands={filterOptions.brands} categories={filterOptions.categories} />
        <ProductListTable
          brands={filterOptions.brands}
          categories={filterOptions.categories}
          products={productList.items}
        />
        <PaginationFooter
          page={productList.page}
          pageCount={productList.pageCount}
          params={params}
        />
      </section>
    </div>
  );
}

function PaginationFooter({
  page,
  pageCount,
  params,
}: Readonly<{
  page: number;
  pageCount: number;
  params: ProductListSearchParams;
}>) {
  const previousHref = buildPageHref(params, Math.max(1, page - 1));
  const nextHref = buildPageHref(params, Math.min(pageCount, page + 1));

  return (
    <div className="flex items-center justify-between border-t border-admin-border px-3 py-2 text-admin-sm">
      <Button disabled={page <= 1} render={<a href={previousHref} />} size="sm" variant="outline">
        Previous
      </Button>
      <span className="text-admin-text-muted tabular-nums">
        {page} / {pageCount}
      </span>
      <Button disabled={page >= pageCount} render={<a href={nextHref} />} size="sm" variant="outline">
        Next
      </Button>
    </div>
  );
}

function buildPageHref(params: ProductListSearchParams, page: number): string {
  const next = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      value.forEach((entry) => next.append(key, entry));
    } else if (value) {
      next.set(key, value);
    }
  }

  next.set("page", String(page));

  return `/admin/products?${next.toString()}`;
}
