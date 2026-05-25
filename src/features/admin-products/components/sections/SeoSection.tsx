"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SectionCard } from "./SectionCard";
import { statusForText } from "./section-utils";
import type { ProductEditorSectionProps } from "./types";

export function SeoSection({ product, onSave, saving }: ProductEditorSectionProps) {
  const [title, setTitle] = useState(product.content.seo_title ?? "");
  const [description, setDescription] = useState(product.content.seo_description ?? "");

  return (
    <SectionCard id="seo" title="SEO">
      <div className="grid gap-3">
        <label className="space-y-1 text-admin-sm">
          <span className="text-admin-text-muted">SEO title</span>
          <Input value={title} onChange={(event) => setTitle(event.currentTarget.value)} />
        </label>
        <label className="space-y-1 text-admin-sm">
          <span className="text-admin-text-muted">SEO description</span>
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.currentTarget.value)}
          />
        </label>
      </div>
      <Button
        className="mt-3"
        disabled={saving}
        onClick={() =>
          onSave({
            content: {
              ...product.content,
              seo_title: title,
              seo_description: description,
            },
            fields_status: {
              seo_title: statusForText(title),
              seo_description: statusForText(description),
            },
          })
        }
        size="sm"
      >
        Save SEO
      </Button>
    </SectionCard>
  );
}
