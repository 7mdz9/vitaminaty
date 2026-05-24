"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SectionCard } from "./SectionCard";
import { nullableNumber } from "./section-utils";
import type { ProductEditorSectionProps } from "./types";

export function PricingVariantsSection({
  product,
  variants,
  onSave,
  saving,
}: ProductEditorSectionProps) {
  const [retail, setRetail] = useState(product.retail_price_aed?.toString() ?? "");
  const [wholesale, setWholesale] = useState(product.wholesale_price_internal?.toString() ?? "");
  const [compareAt, setCompareAt] = useState(product.compare_at_price_aed?.toString() ?? "");

  return (
    <SectionCard id="pricing-variants" title="Pricing and variants">
      <div className="grid gap-3 md:grid-cols-3">
        <NumberField label="Retail AED" value={retail} onChange={setRetail} />
        <NumberField label="Wholesale AED" value={wholesale} onChange={setWholesale} />
        <NumberField label="Compare-at AED" value={compareAt} onChange={setCompareAt} />
      </div>
      <Button
        className="mt-3"
        disabled={saving}
        onClick={() =>
          onSave({
            retail_price_aed: nullableNumber(retail),
            wholesale_price_internal: nullableNumber(wholesale),
            compare_at_price_aed: nullableNumber(compareAt),
            fields_status: {
              retail_price: retail.trim() ? "complete" : "missing",
            },
          })
        }
        size="sm"
      >
        Save pricing
      </Button>
      <div className="mt-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Variant</TableHead>
              <TableHead scope="col">SKU</TableHead>
              <TableHead scope="col">Stock status</TableHead>
              <TableHead scope="col" className="text-right">Quantity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {variants.length === 0 ? (
              <TableRow><TableCell colSpan={4}>No variants yet. Variant CRUD lands in Step 8b.</TableCell></TableRow>
            ) : variants.map((variant) => (
              <TableRow key={variant.id}>
                <TableCell>{[variant.flavor, variant.size].filter(Boolean).join(" / ")}</TableCell>
                <TableCell>{variant.sku ?? "-"}</TableCell>
                <TableCell>{variant.stock_status.replace(/_/g, " ")}</TableCell>
                <TableCell className="text-right tabular-nums">{variant.stock_quantity ?? "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </SectionCard>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: Readonly<{ label: string; value: string; onChange: (value: string) => void }>) {
  return (
    <label className="space-y-1 text-admin-sm">
      <span className="text-admin-text-muted">{label}</span>
      <Input type="number" min={1} value={value} onChange={(event) => onChange(event.currentTarget.value)} />
    </label>
  );
}
