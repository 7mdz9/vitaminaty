"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ExternalLink, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { CompletionScoreBadge } from "@/components/admin/CompletionScoreBadge";
import { useShortcuts } from "@/features/admin-shell/use-shortcuts";
import { ImageUploadField } from "./ImageUploadField";
import { StockEditCell } from "./StockEditCell";
import {
  updateProductPartial,
  type AdminProductDrawerDataResult,
  type AdminProductImageUploadResult,
} from "@/features/admin-products/actions";
import type {
  AdminProductEditorData,
  AdminProductReferenceOption,
} from "@/server/repositories/product-admin-repository";
import type { AdminProductInlinePatch } from "@/lib/validation/product";

const statusOptions = [
  { value: "imported", label: "Imported" },
  { value: "draft", label: "Draft" },
  { value: "partial", label: "Partial" },
  { value: "ready_to_publish", label: "Ready to publish" },
  { value: "published", label: "Published" },
  { value: "hidden", label: "Hidden" },
  { value: "archived", label: "Archived" },
];

export function ProductDrawer({
  open,
  productId,
  data,
  brands,
  categories,
  loading,
  onOpenChange,
  onRequestData,
  onProductSaved,
}: Readonly<{
  open: boolean;
  productId: string | null;
  data: AdminProductEditorData | null;
  brands: AdminProductReferenceOption[];
  categories: AdminProductReferenceOption[];
  loading: boolean;
  onOpenChange: (open: boolean) => void;
  onRequestData: (productId: string) => Promise<AdminProductDrawerDataResult>;
  onProductSaved: (result: Extract<AdminProductImageUploadResult, { ok: true }>["product"]) => void;
}>) {
  const [localData, setLocalData] = useState<AdminProductEditorData | null>(data);
  const [price, setPrice] = useState("");
  const [brandId, setBrandId] = useState("__null");
  const [categoryId, setCategoryId] = useState("__null");
  const [status, setStatus] = useState("imported");
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setLocalData(data);
  }, [data]);

  useEffect(() => {
    if (!open || !productId || data) {
      return;
    }

    void onRequestData(productId);
  }, [data, onRequestData, open, productId]);

  useEffect(() => {
    const product = localData?.product;

    if (!product) {
      return;
    }

    setPrice(product.retail_price_aed?.toString() ?? "");
    setBrandId(product.brand_id ?? "__null");
    setCategoryId(product.category_id ?? "__null");
    setStatus(product.status);
    setVisible(product.is_public_visible);
    setMessage(null);
  }, [localData?.product]);

  const save = useCallback(
    async (closeAfterSave = false) => {
      const product = localData?.product;

      if (!product) {
        return;
      }

      const parsedPrice = price.trim() ? Number.parseInt(price, 10) : null;
      const patch: AdminProductInlinePatch = {
        retail_price_aed: Number.isNaN(parsedPrice) ? null : parsedPrice,
        brand_id: brandId === "__null" ? null : brandId,
        category_id: categoryId === "__null" ? null : categoryId,
        status: status as typeof product.status,
        is_public_visible: visible,
        fields_status: {
          retail_price: parsedPrice ? "complete" : "missing",
          brand: brandId === "__null" ? "missing" : "complete",
          category: categoryId === "__null" ? "missing" : "complete",
        },
      };
      const result = await updateProductPartial({
        productId: product.id,
        expectedUpdatedAt: product.updated_at,
        force: false,
        patch,
      });

      if (!result.ok) {
        setMessage(
          result.code === "stale_data"
            ? `${result.message} Reload before retrying.`
            : result.message,
        );
        return;
      }

      const next = {
        ...localData,
        product: result.product,
      };
      setLocalData(next);
      onProductSaved(result.product);
      setMessage("Saved");

      if (closeAfterSave) {
        onOpenChange(false);
      }
    },
    [brandId, categoryId, localData, onOpenChange, onProductSaved, price, status, visible],
  );

  useShortcuts(
    useMemo(
      () =>
        open
          ? [
              {
                key: "s",
                label: "Save drawer changes",
                action: () => startTransition(() => void save(false)),
              },
            ]
          : [],
      [open, save],
    ),
  );

  const product = localData?.product;
  const primaryImage =
    localData?.images.find((image) => image.is_primary) ?? localData?.images[0] ?? null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full max-w-full border-admin-border bg-admin-bg p-0 sm:max-w-[480px]">
        <SheetHeader className="border-b border-admin-border bg-admin-surface p-4">
          <SheetTitle className="pr-8 font-admin-display text-lg text-admin-text">
            {product?.name ?? "Product"}
          </SheetTitle>
          <SheetDescription>
            {product ? (
              <span className="flex items-center gap-2">
                <StatusBadge status={product.status} />
                <CompletionScoreBadge score={product.completion_score} />
              </span>
            ) : (
              "Loading product..."
            )}
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {loading && !product ? (
            <p className="text-admin-sm text-admin-text-muted">Loading drawer...</p>
          ) : null}
          {product ? (
            <>
              <div className="overflow-hidden rounded-admin-md border border-admin-border bg-admin-surface">
                {primaryImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt={primaryImage.alt_text}
                    className="aspect-video w-full object-cover"
                    src={primaryImage.public_url}
                  />
                ) : (
                  <ImageUploadField
                    productId={product.id}
                    isPrimaryDefault
                    onUploaded={(result) => {
                      setLocalData((current) =>
                        current
                          ? {
                              ...current,
                              product: result.product,
                              images: [result.image, ...current.images],
                            }
                          : current,
                      );
                      onProductSaved(result.product);
                    }}
                  />
                )}
                {primaryImage ? (
                  <div className="border-t border-admin-border p-3">
                    <ImageUploadField
                      productId={product.id}
                      onUploaded={(result) => {
                        setLocalData((current) =>
                          current
                            ? {
                                ...current,
                                product: result.product,
                                images: [...current.images, result.image],
                              }
                            : current,
                        );
                        onProductSaved(result.product);
                      }}
                    />
                  </div>
                ) : null}
              </div>
              <div className="grid gap-3">
                <label className="space-y-1 text-admin-sm">
                  <span className="text-admin-text-muted">Retail price</span>
                  <Input
                    inputMode="numeric"
                    min={0}
                    type="number"
                    value={price}
                    onChange={(event) => setPrice(event.target.value)}
                  />
                </label>
                <DrawerSelect
                  label="Brand"
                  value={brandId}
                  onChange={setBrandId}
                  options={brands}
                />
                <DrawerSelect
                  label="Category"
                  value={categoryId}
                  onChange={setCategoryId}
                  options={categories}
                />
                <label className="space-y-1 text-admin-sm">
                  <span className="text-admin-text-muted">Status</span>
                  <Select value={status} onValueChange={(value) => setStatus(value ?? "imported")}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <label className="flex items-center gap-2 text-admin-sm">
                  <Checkbox
                    checked={visible}
                    onCheckedChange={(checked) => setVisible(checked === true)}
                  />
                  <span>Publicly visible</span>
                </label>
              </div>
              <div className="rounded-admin-md border border-admin-border bg-admin-surface p-3">
                <h3 className="font-admin-display text-admin-title">Variant stock</h3>
                {localData.variants.length === 0 ? (
                  <p className="mt-2 text-admin-sm text-admin-text-muted">No variants yet.</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {localData.variants.map((variant) => (
                      <div
                        className="flex items-center justify-between gap-3 text-admin-sm"
                        key={variant.id}
                      >
                        <span className="min-w-0 truncate">{variant.flavor ?? variant.size}</span>
                        <div className="flex flex-wrap items-center justify-end gap-2 tabular-nums">
                          <StockEditCell
                            variant={variant}
                            onSaved={(saved) =>
                              setLocalData((current) =>
                                current
                                  ? {
                                      ...current,
                                      variants: current.variants.map((candidate) =>
                                        candidate.id === saved.id ? saved : candidate,
                                      ),
                                    }
                                  : current,
                              )
                            }
                          />
                          <Badge variant="outline">{variant.stock_status.replace(/_/g, " ")}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="rounded-admin-md border border-admin-border bg-admin-surface p-3">
                <h3 className="font-admin-display text-admin-title">Missing fields</h3>
                <div className="mt-2 flex flex-wrap gap-1">
                  {Object.entries(product.fields_status)
                    .filter(
                      ([, fieldStatus]) =>
                        fieldStatus === "missing" || fieldStatus === "needs_review",
                    )
                    .slice(0, 8)
                    .map(([field]) => (
                      <Badge key={field} variant="outline">
                        {field.replace(/_/g, " ")}
                      </Badge>
                    ))}
                </div>
              </div>
            </>
          ) : null}
        </div>
        <SheetFooter className="border-t border-admin-border bg-admin-surface p-3">
          <div className="flex w-full flex-col gap-2">
            {message ? <p className="text-admin-sm text-admin-text-muted">{message}</p> : null}
            <div className="flex flex-wrap justify-end gap-2">
              {product ? (
                <Button
                  render={<Link href={`/admin/products/${product.id}`} />}
                  size="sm"
                  variant="outline"
                >
                  <ExternalLink className="size-4" />
                  Open full editor
                </Button>
              ) : null}
              <Button
                disabled={!product || isPending}
                onClick={() => onOpenChange(false)}
                size="sm"
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                disabled={!product || isPending}
                onClick={() => startTransition(() => void save(false))}
                size="sm"
                type="button"
                variant="outline"
              >
                <Save className="size-4" />
                Save
              </Button>
              <Button
                disabled={!product || isPending}
                onClick={() => startTransition(() => void save(true))}
                size="sm"
                type="button"
              >
                Save & close
              </Button>
            </div>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function DrawerSelect({
  label,
  value,
  onChange,
  options,
}: Readonly<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: AdminProductReferenceOption[];
}>) {
  return (
    <label className="space-y-1 text-admin-sm">
      <span className="text-admin-text-muted">{label}</span>
      <Select value={value} onValueChange={(next) => onChange(next ?? "__null")}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__null">Unassigned</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}
