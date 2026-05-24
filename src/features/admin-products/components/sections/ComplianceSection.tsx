"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SectionCard } from "./SectionCard";
import { statusForArray, statusForText } from "./section-utils";
import type { ProductEditorSectionProps } from "./types";

export function ComplianceSection({ product, onSave, saving }: ProductEditorSectionProps) {
  const [ingredients, setIngredients] = useState(product.label_data.ingredients ?? "");
  const [allergens, setAllergens] = useState((product.label_data.allergens ?? []).join(", "));
  const [servingSize, setServingSize] = useState(product.label_data.serving_size ?? "");
  const allergenList = allergens.split(",").map((item) => item.trim()).filter(Boolean);

  return (
    <SectionCard id="compliance" title="Label data">
      <div className="grid gap-3">
        <label className="space-y-1 text-admin-sm">
          <span className="text-admin-text-muted">Ingredients</span>
          <Textarea value={ingredients} onChange={(event) => setIngredients(event.currentTarget.value)} />
        </label>
        <label className="space-y-1 text-admin-sm">
          <span className="text-admin-text-muted">Allergens, comma-separated</span>
          <Textarea value={allergens} onChange={(event) => setAllergens(event.currentTarget.value)} />
        </label>
        <label className="space-y-1 text-admin-sm">
          <span className="text-admin-text-muted">Serving size</span>
          <Textarea value={servingSize} onChange={(event) => setServingSize(event.currentTarget.value)} />
        </label>
      </div>
      <Button
        className="mt-3"
        disabled={saving}
        onClick={() =>
          onSave({
            label_data: {
              ...product.label_data,
              ingredients,
              allergens: allergenList,
              serving_size: servingSize,
            },
            fields_status: {
              ingredients: statusForText(ingredients),
              allergens: statusForArray(allergenList),
              nutrition_panel: product.label_data.nutrition_panel ? "verified" : "missing",
            },
          })
        }
        size="sm"
      >
        Save label data
      </Button>
    </SectionCard>
  );
}
