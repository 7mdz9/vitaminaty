"use client";

import { Badge } from "@/components/ui/badge";
import { SectionCard } from "./SectionCard";
import type { ProductEditorSectionProps } from "./types";

export function GoalsTagsSection({ goalTags }: ProductEditorSectionProps) {
  return (
    <SectionCard id="goals-tags" title="Goals and tags">
      <div className="flex flex-wrap gap-2">
        {goalTags.length === 0 ? (
          <span className="text-admin-sm text-admin-text-muted">No goal tags assigned yet.</span>
        ) : (
          goalTags.map((tag) => (
            <Badge key={tag.goal} variant={tag.is_primary ? "default" : "outline"}>
              {tag.goal.replace(/_/g, " ")}
            </Badge>
          ))
        )}
      </div>
    </SectionCard>
  );
}
