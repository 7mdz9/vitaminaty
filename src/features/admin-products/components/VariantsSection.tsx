"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Archive, History, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createProductVariant,
  archiveProductVariant,
  setVariantLowStockThreshold,
} from "@/features/admin-products/actions";
import type { ProductRecord, ProductVariantRecord } from "@/types/product";
import { StockEditCell } from "./StockEditCell";
import { SectionCard } from "./sections/SectionCard";

export function VariantsSection({
  product,
  variants,
  onVariantSaved,
}: Readonly<{
  product: ProductRecord;
  variants: ProductVariantRecord[];
  onVariantSaved: (variant: ProductVariantRecord) => void;
}>) {
  const [createOpen, setCreateOpen] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<ProductVariantRecord | null>(null);

  return (
    <SectionCard id="variants" title="Variants and stock">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <Button
          render={<Link href={`/admin/products/${product.id}/inventory`} />}
          size="sm"
          variant="outline"
        >
          <History className="size-4" />
          History
        </Button>
        <Button size="sm" type="button" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          Add variant
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">Variant</TableHead>
            <TableHead scope="col">SKU</TableHead>
            <TableHead scope="col">Status</TableHead>
            <TableHead scope="col" className="text-right">
              Stock
            </TableHead>
            <TableHead scope="col" className="text-right">
              Low threshold
            </TableHead>
            <TableHead scope="col" className="text-right">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {variants.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6}>No variants yet.</TableCell>
            </TableRow>
          ) : (
            variants.map((variant) => (
              <TableRow key={variant.id}>
                <TableCell>
                  <div className="font-medium text-admin-text">{variantLabel(variant)}</div>
                  <div className="text-admin-caption text-admin-text-muted">
                    AED {variant.price_aed}
                  </div>
                </TableCell>
                <TableCell>{variant.sku ?? "-"}</TableCell>
                <TableCell>
                  <Badge variant="outline">{variant.stock_status.replace(/_/g, " ")}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <StockEditCell variant={variant} onSaved={onVariantSaved} />
                </TableCell>
                <TableCell className="text-right">
                  <ThresholdCell variant={variant} onSaved={onVariantSaved} />
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    aria-label={`Archive ${variantLabel(variant)}`}
                    size="icon-sm"
                    type="button"
                    variant="outline"
                    onClick={() => setArchiveTarget(variant)}
                  >
                    <Archive className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      <CreateVariantDialog
        open={createOpen}
        product={product}
        onOpenChange={setCreateOpen}
        onCreated={(variant) => {
          onVariantSaved(variant);
          setCreateOpen(false);
        }}
      />
      <ArchiveVariantDialog
        variant={archiveTarget}
        onArchived={(variant) => {
          onVariantSaved(variant);
          setArchiveTarget(null);
        }}
        onOpenChange={(open) => {
          if (!open) {
            setArchiveTarget(null);
          }
        }}
      />
    </SectionCard>
  );
}

function ThresholdCell({
  variant,
  onSaved,
}: Readonly<{
  variant: ProductVariantRecord;
  onSaved: (variant: ProductVariantRecord) => void;
}>) {
  const [value, setValue] = useState(variant.low_stock_threshold.toString());
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center justify-end gap-2">
      <Input
        aria-label="Low-stock threshold"
        className="h-8 w-20 text-right tabular-nums"
        disabled={isPending}
        min={0}
        type="number"
        value={value}
        onBlur={() => {
          const lowStockThreshold = Number.parseInt(value, 10);

          if (
            Number.isNaN(lowStockThreshold) ||
            lowStockThreshold < 0 ||
            lowStockThreshold === variant.low_stock_threshold
          ) {
            return;
          }

          startTransition(async () => {
            const result = await setVariantLowStockThreshold({
              variantId: variant.id,
              expectedUpdatedAt: variant.updated_at,
              lowStockThreshold,
            });

            if (result.ok) {
              setMessage("Saved");
              onSaved(result.variant);
              return;
            }

            setMessage(result.message);
          });
        }}
        onChange={(event) => {
          setValue(event.currentTarget.value);
          setMessage(null);
        }}
      />
      {message ? (
        <span className="max-w-28 text-admin-caption text-admin-text-muted">{message}</span>
      ) : null}
    </div>
  );
}

function CreateVariantDialog({
  open,
  product,
  onOpenChange,
  onCreated,
}: Readonly<{
  open: boolean;
  product: ProductRecord;
  onOpenChange: (open: boolean) => void;
  onCreated: (variant: ProductVariantRecord) => void;
}>) {
  const [flavor, setFlavor] = useState("");
  const [size, setSize] = useState("");
  const [sku, setSku] = useState("");
  const [price, setPrice] = useState(product.retail_price_aed?.toString() ?? "");
  const [quantity, setQuantity] = useState("0");
  const [threshold, setThreshold] = useState("5");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-admin-border bg-admin-surface">
        <DialogHeader>
          <DialogTitle className="font-admin-display">Add variant</DialogTitle>
          <DialogDescription>Stock status is computed after save.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <TextField label="Flavor" value={flavor} onChange={setFlavor} />
          <TextField label="Size" required value={size} onChange={setSize} />
          <TextField label="SKU" value={sku} onChange={setSku} />
          <NumberField label="Price AED" min={1} value={price} onChange={setPrice} />
          <NumberField label="Stock quantity" min={0} value={quantity} onChange={setQuantity} />
          <NumberField
            label="Low-stock threshold"
            min={0}
            value={threshold}
            onChange={setThreshold}
          />
          {message ? <p className="text-admin-sm text-admin-text-muted">{message}</p> : null}
        </div>
        <DialogFooter>
          <Button
            disabled={isPending}
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            disabled={isPending}
            type="button"
            onClick={() =>
              startTransition(async () => {
                const result = await createProductVariant({
                  productId: product.id,
                  flavor: flavor.trim() || null,
                  size,
                  sku: sku.trim() || null,
                  priceAed: Number.parseInt(price, 10),
                  stockQuantity: Number.parseInt(quantity, 10),
                  lowStockThreshold: Number.parseInt(threshold, 10),
                });

                if (result.ok) {
                  onCreated(result.variant);
                  return;
                }

                setMessage(result.message);
              })
            }
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ArchiveVariantDialog({
  variant,
  onOpenChange,
  onArchived,
}: Readonly<{
  variant: ProductVariantRecord | null;
  onOpenChange: (open: boolean) => void;
  onArchived: (variant: ProductVariantRecord) => void;
}>) {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <Dialog open={Boolean(variant)} onOpenChange={onOpenChange}>
      <DialogContent className="border-admin-border bg-admin-surface">
        <DialogHeader>
          <DialogTitle className="font-admin-display">Archive variant</DialogTitle>
          <DialogDescription>
            The row stays in place for inventory history; stock is set to 0 and an audit row is
            written.
          </DialogDescription>
        </DialogHeader>
        {message ? <p className="text-admin-sm text-admin-text-muted">{message}</p> : null}
        <DialogFooter>
          <Button
            disabled={isPending}
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            disabled={!variant || isPending}
            type="button"
            variant="destructive"
            onClick={() => {
              if (!variant) {
                return;
              }

              startTransition(async () => {
                const result = await archiveProductVariant({
                  variantId: variant.id,
                  expectedUpdatedAt: variant.updated_at,
                  changeReasonNote: "Archived from admin variant table.",
                });

                if (result.ok) {
                  onArchived(result.variant);
                  return;
                }

                setMessage(result.message);
              });
            }}
          >
            Archive
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TextField({
  label,
  value,
  required = false,
  onChange,
}: Readonly<{
  label: string;
  value: string;
  required?: boolean;
  onChange: (value: string) => void;
}>) {
  return (
    <label className="space-y-1 text-admin-sm">
      <span className="text-admin-text-muted">{label}</span>
      <Input
        required={required}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  min,
  onChange,
}: Readonly<{
  label: string;
  value: string;
  min: number;
  onChange: (value: string) => void;
}>) {
  return (
    <label className="space-y-1 text-admin-sm">
      <span className="text-admin-text-muted">{label}</span>
      <Input
        min={min}
        type="number"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </label>
  );
}

function variantLabel(variant: ProductVariantRecord): string {
  return [variant.flavor, variant.size].filter(Boolean).join(" / ") || variant.sku || variant.id;
}
