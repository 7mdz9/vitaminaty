import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandEditorForm } from "@/features/admin-brands/components/BrandEditorForm";
import { getBrand } from "@/features/admin-brands/queries";

export const dynamic = "force-dynamic";

export default async function AdminBrandEditorPage({
  params,
}: Readonly<{
  params: Promise<{ brandId: string }>;
}>) {
  const { brandId } = await params;
  const brand = await getBrand(brandId);

  if (!brand) {
    notFound();
  }

  return (
    <div className="space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button render={<Link href="/admin/brands" />} size="icon" variant="ghost">
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h2 className="font-admin-display text-xl text-admin-text">{brand.display_name}</h2>
            <p className="text-admin-sm text-admin-text-muted">{brand.slug}</p>
          </div>
        </div>
      </header>
      <BrandEditorForm brand={brand} />
    </div>
  );
}
