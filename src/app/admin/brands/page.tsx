import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandListTable } from "@/features/admin-brands/components/BrandListTable";
import { getBrandList } from "@/features/admin-brands/queries";

export const dynamic = "force-dynamic";

export default async function AdminBrandsPage() {
  const brands = await getBrandList();

  return (
    <div className="space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-admin-display text-xl text-admin-text">Brands</h2>
          <p className="text-admin-sm text-admin-text-muted">
            {brands.length} canonical brands · {brands.filter((brand) => brand.products_total_count > 0).length} with products
          </p>
        </div>
        <Button render={<Link href="/admin/brands/normalize" />} size="sm">
          <Plus className="size-4" />
          Normalize
        </Button>
      </header>
      <section className="overflow-hidden rounded-admin-md border border-admin-border bg-admin-surface">
        <BrandListTable brands={brands} />
      </section>
    </div>
  );
}
