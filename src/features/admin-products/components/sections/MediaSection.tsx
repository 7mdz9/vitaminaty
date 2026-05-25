"use client";

import { Badge } from "@/components/ui/badge";
import { SectionCard } from "./SectionCard";
import type { ProductEditorSectionProps } from "./types";

export function MediaSection({ images }: ProductEditorSectionProps) {
  return (
    <SectionCard id="media" title="Media">
      {images.length === 0 ? (
        <p className="text-admin-sm text-admin-text-muted">
          No images yet. Upload lands in Step 6.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {images.map((image) => (
            <figure
              className="overflow-hidden rounded-admin-md border border-admin-border"
              key={image.id}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt={image.alt_text}
                className="aspect-square w-full object-cover"
                src={image.public_url}
              />
              <figcaption className="flex items-center justify-between gap-2 px-2 py-1 text-admin-caption">
                <span>{image.kind.replace(/_/g, " ")}</span>
                {image.is_primary ? <Badge>Primary</Badge> : null}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
