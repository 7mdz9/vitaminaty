"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SectionCard } from "./SectionCard";
import type { ProductEditorSectionProps } from "./types";

const forms = ["powder", "capsule", "tablet", "softgel", "gummies", "liquid", "rtd", "food"];

export function BrandCategorySection({
  product,
  brands,
  categories,
  onSave,
  saving,
}: ProductEditorSectionProps) {
  const [brandId, setBrandId] = useState(product.brand_id ?? "__null");
  const [categoryId, setCategoryId] = useState(product.category_id ?? "__null");
  const [form, setForm] = useState(product.form ?? "__null");

  return (
    <SectionCard id="brand-category" title="Brand and category">
      <div className="grid gap-3 md:grid-cols-3">
        <Picker label="Brand" value={brandId} onChange={setBrandId} options={brands} />
        <Picker label="Category" value={categoryId} onChange={setCategoryId} options={categories} />
        <label className="space-y-1 text-admin-sm">
          <span className="text-admin-text-muted">Form</span>
          <Select value={form} onValueChange={(value) => setForm(value ?? "__null")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__null">Unassigned</SelectItem>
              {forms.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </div>
      <Button
        className="mt-3"
        disabled={saving}
        onClick={() =>
          onSave({
            brand_id: brandId === "__null" ? null : brandId,
            category_id: categoryId === "__null" ? null : categoryId,
            form: form === "__null" ? null : (form as typeof product.form),
            fields_status: {
              brand: brandId === "__null" ? "missing" : "complete",
              category: categoryId === "__null" ? "missing" : "complete",
              form: form === "__null" ? "missing" : "complete",
            },
          })
        }
        size="sm"
      >
        Save taxonomy
      </Button>
    </SectionCard>
  );
}

function Picker({
  label,
  value,
  onChange,
  options,
}: Readonly<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ id: string; label: string }>;
}>) {
  return (
    <label className="space-y-1 text-admin-sm">
      <span className="text-admin-text-muted">{label}</span>
      <Select value={value} onValueChange={(next) => onChange(next ?? "__null")}>
        <SelectTrigger>
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
