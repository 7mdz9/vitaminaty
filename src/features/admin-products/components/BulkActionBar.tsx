"use client";

import { useState, useTransition } from "react";
import { Building2, FolderTree, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  bulkAssignBrand,
  bulkAssignCategory,
  bulkPublish,
  type AdminProductBulkActionResult,
} from "@/features/admin-products/actions";
import { BulkConfirmDialog } from "./BulkConfirmDialog";
import { ForceOverrideDialog } from "./ForceOverrideDialog";
import type {
  AdminProductListItem,
  AdminProductReferenceOption,
} from "@/server/repositories/product-admin-repository";

type PendingAction = "assign_brand" | "assign_category" | "publish" | null;

export function BulkActionBar({
  selectedProducts,
  brands,
  categories,
  onApplied,
}: Readonly<{
  selectedProducts: AdminProductListItem[];
  brands: AdminProductReferenceOption[];
  categories: AdminProductReferenceOption[];
  onApplied: (
    result: AdminProductBulkActionResult,
    context: { action: Exclude<PendingAction, null>; brandId?: string; categoryId?: string },
  ) => void;
}>) {
  const [brandId, setBrandId] = useState(brands[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [forceState, setForceState] = useState<{
    reviewFlagsByProductId: Record<string, string[]>;
    hardBlockedProductIds: string[];
  } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const productIds = selectedProducts.map((product) => product.id);

  if (selectedProducts.length === 0) {
    return null;
  }

  function runConfirmed() {
    const action = pendingAction;
    setPendingAction(null);

    if (!action) {
      return;
    }

    startTransition(() => {
      void run(action);
    });
  }

  async function run(action: Exclude<PendingAction, null>, overrideReason?: string) {
    const result =
      action === "assign_brand"
        ? await bulkAssignBrand({ productIds, brandId })
        : action === "assign_category"
          ? await bulkAssignCategory({ productIds, categoryId })
          : await bulkPublish({
              productIds,
              forceOverride: Boolean(overrideReason),
              overrideReason,
            });

    if (!result.ok && result.code === "force_override_required") {
      setForceState({
        reviewFlagsByProductId: result.reviewFlagsByProductId ?? {},
        hardBlockedProductIds: result.hardBlockedProductIds ?? [],
      });
      return;
    }

    setMessage(result.ok ? `Updated ${result.updatedProductIds.length} products` : result.message);
    onApplied(result, { action, brandId, categoryId });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-admin-border bg-admin-surface-muted px-3 py-2">
      <p className="text-admin-sm text-admin-text">{selectedProducts.length} selected</p>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={brandId} onValueChange={(value) => setBrandId(value ?? "")}>
          <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            {brands.map((brand) => (
              <SelectItem key={brand.id} value={brand.id}>{brand.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          disabled={!brandId || isPending}
          onClick={() => setPendingAction("assign_brand")}
          size="sm"
          type="button"
          variant="outline"
        >
          <Building2 className="size-4" />
          Assign brand
        </Button>
        <Select value={categoryId} onValueChange={(value) => setCategoryId(value ?? "")}>
          <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>{category.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          disabled={!categoryId || isPending}
          onClick={() => setPendingAction("assign_category")}
          size="sm"
          type="button"
          variant="outline"
        >
          <FolderTree className="size-4" />
          Assign category
        </Button>
        <Button disabled={isPending} onClick={() => setPendingAction("publish")} size="sm" type="button">
          <Send className="size-4" />
          Publish
        </Button>
      </div>
      {message ? <p className="w-full text-admin-caption text-admin-text-muted">{message}</p> : null}
      <BulkConfirmDialog
        open={pendingAction !== null}
        count={selectedProducts.length}
        actionLabel={labelForAction(pendingAction)}
        onCancel={() => setPendingAction(null)}
        onConfirm={runConfirmed}
      />
      <ForceOverrideDialog
        open={forceState !== null}
        reviewFlagsByProductId={forceState?.reviewFlagsByProductId ?? {}}
        hardBlockedProductIds={forceState?.hardBlockedProductIds ?? []}
        onCancel={() => setForceState(null)}
        onConfirm={(reason) => {
          setForceState(null);
          startTransition(() => {
            void run("publish", reason);
          });
        }}
      />
    </div>
  );
}

function labelForAction(action: PendingAction): string {
  switch (action) {
    case "assign_brand":
      return "Assign brand";
    case "assign_category":
      return "Assign category";
    case "publish":
      return "Bulk publish";
    default:
      return "Bulk action";
  }
}
