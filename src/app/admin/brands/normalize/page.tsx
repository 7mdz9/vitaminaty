import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandNormalizationTool } from "@/features/admin-brands/components/BrandNormalizationTool";
import {
  getBrandList,
  getOrphanCanonicalBrands,
  getUnmatchedBrandRaws,
} from "@/features/admin-brands/queries";

export const dynamic = "force-dynamic";

export default async function AdminBrandNormalizePage() {
  const [brands, unmatched, orphanBrands] = await Promise.all([
    getBrandList(),
    getUnmatchedBrandRaws(),
    getOrphanCanonicalBrands(),
  ]);

  return (
    <div className="space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button render={<Link href="/admin/brands" />} size="icon" variant="ghost">
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h2 className="font-admin-display text-xl text-admin-text">Brand normalization</h2>
            <p className="text-admin-sm text-admin-text-muted">
              Map raw MD spellings to canonical brands
            </p>
          </div>
        </div>
      </header>
      <BrandNormalizationTool
        brandOptions={brands}
        orphanBrands={orphanBrands}
        unmatched={unmatched}
      />
    </div>
  );
}
