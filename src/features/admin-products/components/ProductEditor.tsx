"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { CompletionScoreBadge } from "@/components/admin/CompletionScoreBadge";
import { updateProduct } from "@/features/admin-products/actions";
import { calculateCompletionScore } from "@/features/admin-products/completion-score";
import { useShortcuts } from "@/features/admin-shell/use-shortcuts";
import type { AdminProductReferenceOption } from "@/server/repositories/product-admin-repository";
import type {
  ProductGoalTagRecord,
  ProductImageRecord,
  ProductRecord,
  ProductVariantRecord,
} from "@/types/product";
import type { AdminProductInlinePatch } from "@/lib/validation/product";
import { IdentitySection } from "./sections/IdentitySection";
import { BrandCategorySection } from "./sections/BrandCategorySection";
import { PricingVariantsSection } from "./sections/PricingVariantsSection";
import { GoalsTagsSection } from "./sections/GoalsTagsSection";
import { MediaSection } from "./sections/MediaSection";
import { ContentSection } from "./sections/ContentSection";
import { ComplianceSection } from "./sections/ComplianceSection";
import { SeoSection } from "./sections/SeoSection";
import { InternalSection } from "./sections/InternalSection";

export function ProductEditor({
  product: initialProduct,
  variants,
  images,
  goalTags,
  brands,
  categories,
}: Readonly<{
  product: ProductRecord;
  variants: ProductVariantRecord[];
  images: ProductImageRecord[];
  goalTags: ProductGoalTagRecord[];
  brands: AdminProductReferenceOption[];
  categories: AdminProductReferenceOption[];
}>) {
  const [product, setProduct] = useState(initialProduct);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const projectedScore = calculateCompletionScore({
    ...product,
    image_count: images.length,
    additional_image_count: images.filter((image) => !image.is_primary).length,
    goal_tag_count: goalTags.length,
  });

  async function save(patch: AdminProductInlinePatch) {
    setMessage(null);
    const result = await updateProduct({
      productId: product.id,
      expectedUpdatedAt: product.updated_at,
      force: false,
      patch,
    });

    if (result.ok) {
      setProduct(result.product);
      setMessage("Saved");
      return;
    }

    setMessage(result.code === "stale_data" ? `${result.message} Reload before retrying.` : result.message);
  }

  const sectionProps = {
    product,
    variants,
    images,
    goalTags,
    brands,
    categories,
    onSave: (patch: AdminProductInlinePatch) => startTransition(() => void save(patch)),
    saving: isPending,
  };

  useShortcuts(
    useMemo(
      () => [
        {
          key: "s",
          label: "Save current product",
          action: () => setMessage("Use the section save button for the active field group."),
        },
        {
          key: "n",
          label: "Save and next product",
          action: () => setMessage("Save and Next lands with queues in Step 7."),
        },
      ],
      [],
    ),
  );

  return (
    <div className="space-y-3">
      <header className="sticky top-14 z-20 border-b border-admin-border bg-admin-bg/95 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Button render={<Link href="/admin/products" />} size="icon-sm" variant="outline">
              <ArrowLeft className="size-4" />
            </Button>
            <div className="min-w-0">
              <h2 className="truncate font-admin-display text-xl text-admin-text">{product.name}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <StatusBadge status={product.status} />
                <CompletionScoreBadge score={projectedScore.score} />
                <Badge variant="outline">raw {projectedScore.rawPreClampValue}</Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {message ? <span className="text-admin-sm text-admin-text-muted">{message}</span> : null}
            <Button size="sm" type="button" variant="outline">Preview as Public</Button>
            <Button size="sm" type="button"><Save className="size-4" /> Save</Button>
          </div>
        </div>
      </header>
      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_260px]">
        <aside className="rounded-admin-md border border-admin-border bg-admin-surface p-3">
          <h3 className="mb-2 font-admin-display text-admin-title">Checklist</h3>
          <Checklist product={product} />
        </aside>
        <main className="overflow-hidden rounded-admin-md border border-admin-border bg-admin-surface">
          <IdentitySection {...sectionProps} />
          <BrandCategorySection {...sectionProps} />
          <PricingVariantsSection {...sectionProps} />
          <GoalsTagsSection {...sectionProps} />
          <MediaSection {...sectionProps} />
          <ContentSection {...sectionProps} />
          <ComplianceSection {...sectionProps} />
          <SeoSection {...sectionProps} />
          <InternalSection {...sectionProps} />
        </main>
        <aside className="space-y-3 rounded-admin-md border border-admin-border bg-admin-surface p-3">
          <h3 className="font-admin-display text-admin-title">Status panel</h3>
          <p className="text-admin-sm text-admin-text-muted">
            {projectedScore.tier1Complete}/6 import, {projectedScore.tier2Complete}/6 MVP, {projectedScore.tier3Complete}/13 quality.
          </p>
          <div className="flex flex-wrap gap-1">
            {Object.entries(product.admin_review_flags).filter(([, active]) => active).map(([flag]) => (
              <Badge key={flag} variant="outline">{flag.replace(/_/g, " ")}</Badge>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Checklist({ product }: Readonly<{ product: ProductRecord }>) {
  return (
    <nav className="space-y-1 text-admin-sm">
      {[
        ["identity", "Identity", product.name ? "complete" : "missing"],
        ["brand-category", "Brand", product.brand_id ? "complete" : "missing"],
        ["pricing-variants", "Pricing", product.retail_price_aed ? "complete" : "missing"],
        ["media", "Media", product.fields_status.image],
        ["content", "Content", product.fields_status.description],
        ["compliance", "Label data", product.fields_status.ingredients],
        ["seo", "SEO", product.fields_status.seo_title],
        ["internal", "Internal", product.status],
      ].map(([href, label, status]) => (
        <a className="flex items-center justify-between rounded-admin-sm px-2 py-1 hover:bg-admin-surface-muted" href={`#${href}`} key={href}>
          <span>{label}</span>
          <span className="text-admin-caption text-admin-text-muted">{status}</span>
        </a>
      ))}
    </nav>
  );
}
