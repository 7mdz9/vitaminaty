"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionCard } from "./SectionCard";
import { nullableNumber } from "./section-utils";
import type { ProductEditorSectionProps } from "./types";

export function PricingVariantsSection({ product, onSave, saving }: ProductEditorSectionProps) {
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
      <Input
        type="number"
        min={1}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </label>
  );
}
