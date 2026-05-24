"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionCard } from "./SectionCard";
import type { ProductEditorSectionProps } from "./types";

export function IdentitySection({ product, onSave, saving }: ProductEditorSectionProps) {
  const [name, setName] = useState(product.name);

  return (
    <SectionCard id="identity" title="Identity">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1 text-admin-sm">
          <span className="text-admin-text-muted">Normalized name</span>
          <Input value={name} onChange={(event) => setName(event.currentTarget.value)} />
        </label>
        <div className="space-y-1 text-admin-sm">
          <span className="text-admin-text-muted">Raw name</span>
          <p className="rounded-admin-md border border-admin-border bg-admin-surface-muted px-3 py-2">
            {product.name_raw}
          </p>
        </div>
        <div className="space-y-1 text-admin-sm">
          <span className="text-admin-text-muted">Source category</span>
          <p className="rounded-admin-md border border-admin-border bg-admin-surface-muted px-3 py-2">
            {product.source_category ?? "Missing"}
          </p>
        </div>
        <div className="space-y-1 text-admin-sm">
          <span className="text-admin-text-muted">Source rows</span>
          <p className="rounded-admin-md border border-admin-border bg-admin-surface-muted px-3 py-2 tabular-nums">
            {product.source_row.join(", ") || "Missing"}
          </p>
        </div>
      </div>
      <Button className="mt-3" disabled={saving} onClick={() => onSave({ name })} size="sm">
        Save identity
      </Button>
    </SectionCard>
  );
}
