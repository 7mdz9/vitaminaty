import { notFound } from "next/navigation";
import Link from "next/link";
import { FilterBar } from "@/features/admin-products/components/FilterBar";
import { ProductListTable } from "@/features/admin-products/components/ProductListTable";
import {
  getProductFilterOptions,
  getQueue,
  parseProductListSearchParams,
  PRODUCT_QUEUE_LABELS,
  type ProductListSearchParams,
  type ProductQueueKind,
} from "@/features/admin-products/queries";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

const queueKinds = new Set(Object.keys(PRODUCT_QUEUE_LABELS));

export default async function AdminProductQueuePage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ queueKind: string }>;
  searchParams: Promise<ProductListSearchParams>;
}>) {
  const [{ queueKind }, query] = await Promise.all([params, searchParams]);

  if (!queueKinds.has(queueKind)) {
    notFound();
  }

  const typedQueueKind = queueKind as ProductQueueKind;
  const listInput = parseProductListSearchParams(query);
  const [productList, filterOptions] = await Promise.all([
    getQueue(typedQueueKind, listInput),
    getProductFilterOptions(),
  ]);

  return (
    <div className="space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-admin-display text-xl text-admin-text">
            {PRODUCT_QUEUE_LABELS[typedQueueKind]}
          </h2>
          <p className="text-admin-sm text-admin-text-muted">
            {productList.total} products in queue · page {productList.page} of{" "}
            {productList.pageCount}
          </p>
        </div>
        <Button render={<Link href="/admin/products" />} size="sm" variant="outline">
          All products
        </Button>
      </header>
      <section className="overflow-hidden rounded-admin-md border border-admin-border bg-admin-surface">
        <FilterBar brands={filterOptions.brands} categories={filterOptions.categories} />
        <ProductListTable
          brands={filterOptions.brands}
          categories={filterOptions.categories}
          products={productList.items}
        />
      </section>
    </div>
  );
}
