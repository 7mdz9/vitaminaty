"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SectionCard } from "./SectionCard";
import type { ProductEditorSectionProps } from "./types";

const statuses = [
  "imported",
  "draft",
  "partial",
  "ready_to_publish",
  "published",
  "hidden",
  "archived",
] as const;

export function InternalSection({ product, onSave, saving }: ProductEditorSectionProps) {
  const [status, setStatus] = useState(product.status);
  const [visible, setVisible] = useState(product.is_public_visible);

  return (
    <SectionCard id="internal" title="Internal state">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1 text-admin-sm">
          <span className="text-admin-text-muted">Status</span>
          <Select
            value={status}
            onValueChange={(value) => value && setStatus(value as typeof status)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statuses.map((option) => (
                <SelectItem key={option} value={option}>
                  {option.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="flex items-center gap-2 text-admin-sm">
          <Checkbox checked={visible} onCheckedChange={(checked) => setVisible(Boolean(checked))} />
          Publicly visible
        </label>
      </div>
      <Button
        className="mt-3"
        disabled={saving}
        onClick={() => onSave({ status, is_public_visible: visible })}
        size="sm"
      >
        Save internal state
      </Button>
    </SectionCard>
  );
}
