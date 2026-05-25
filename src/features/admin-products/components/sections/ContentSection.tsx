"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SectionCard } from "./SectionCard";
import { statusForArray, statusForText } from "./section-utils";
import type { ProductEditorSectionProps } from "./types";

export function ContentSection({ product, onSave, saving }: ProductEditorSectionProps) {
  const [description, setDescription] = useState(product.content.description ?? "");
  const [benefits, setBenefits] = useState((product.content.benefits ?? []).join("\n"));
  const [directions, setDirections] = useState(product.content.directions_of_use ?? "");
  const [storage, setStorage] = useState(product.content.storage_instructions ?? "");
  const [warnings, setWarnings] = useState(product.content.warnings ?? "");

  const benefitList = benefits
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);

  return (
    <SectionCard id="content" title="About this product">
      <div className="grid gap-3">
        <TextField label="Description" value={description} onChange={setDescription} />
        <TextField label="Benefits, one per line" value={benefits} onChange={setBenefits} />
        <TextField label="Directions" value={directions} onChange={setDirections} />
        <TextField label="Storage" value={storage} onChange={setStorage} />
        <TextField label="Warnings" value={warnings} onChange={setWarnings} />
      </div>
      <Button
        className="mt-3"
        disabled={saving}
        onClick={() =>
          onSave({
            content: {
              ...product.content,
              description,
              benefits: benefitList,
              directions_of_use: directions,
              storage_instructions: storage,
              warnings,
            },
            fields_status: {
              description: statusForText(description),
              benefits: statusForArray(benefitList),
              directions: statusForText(directions),
              storage: statusForText(storage),
              warnings: statusForText(warnings),
            },
          })
        }
        size="sm"
      >
        Save content
      </Button>
    </SectionCard>
  );
}

function TextField({
  label,
  value,
  onChange,
}: Readonly<{ label: string; value: string; onChange: (value: string) => void }>) {
  return (
    <label className="space-y-1 text-admin-sm">
      <span className="text-admin-text-muted">{label}</span>
      <Textarea value={value} onChange={(event) => onChange(event.currentTarget.value)} />
    </label>
  );
}
