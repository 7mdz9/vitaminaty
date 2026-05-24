"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Edit, Star, StarOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toggleFeatured, toggleVisibility } from "@/features/admin-brands/actions";
import type { AdminBrandListItem } from "@/server/repositories/brand-admin-repository";

export function BrandListTable({ brands }: Readonly<{ brands: AdminBrandListItem[] }>) {
  const [rows, setRows] = useState(brands);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function mutateVisibility(brand: AdminBrandListItem, isVisible: boolean) {
    setPendingId(brand.id);
    startTransition(async () => {
      const result = await toggleVisibility({
        brandId: brand.id,
        expectedUpdatedAt: brand.updated_at,
        isVisible,
      });

      if (result.ok) {
        setRows((current) =>
          current.map((row) =>
            row.id === brand.id
              ? {
                  ...row,
                  ...result.brand,
                  aliases_count: result.brand.aliases.length,
                }
              : row,
          ),
        );
      }

      setPendingId(null);
    });
  }

  function mutateFeatured(brand: AdminBrandListItem, isFeatured: boolean) {
    setPendingId(brand.id);
    startTransition(async () => {
      const result = await toggleFeatured({
        brandId: brand.id,
        expectedUpdatedAt: brand.updated_at,
        isFeatured,
      });

      if (result.ok) {
        setRows((current) =>
          current.map((row) =>
            row.id === brand.id
              ? {
                  ...row,
                  ...result.brand,
                  aliases_count: result.brand.aliases.length,
                }
              : row,
          ),
        );
      }

      setPendingId(null);
    });
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="h-9">
          <TableHead className="w-16">Logo</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Slug</TableHead>
          <TableHead className="text-right">Aliases</TableHead>
          <TableHead className="text-right">Visible</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead>Tier</TableHead>
          <TableHead>Featured</TableHead>
          <TableHead>Directory</TableHead>
          <TableHead className="w-20 text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((brand) => (
          <TableRow className="h-10" key={brand.id}>
            <TableCell>
              {brand.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt=""
                  className="size-8 rounded-admin-sm border border-admin-border object-contain"
                  src={brand.logo_url}
                />
              ) : (
                <div className="grid size-8 place-items-center rounded-admin-sm border border-admin-border bg-admin-surface-muted text-admin-caption text-admin-text-muted">
                  {brand.display_name.slice(0, 2).toUpperCase()}
                </div>
              )}
            </TableCell>
            <TableCell className="font-medium text-admin-text">{brand.display_name}</TableCell>
            <TableCell className="text-admin-text-muted">{brand.slug}</TableCell>
            <TableCell className="text-right tabular-nums">{brand.aliases_count}</TableCell>
            <TableCell className="text-right tabular-nums">{brand.products_visible_count}</TableCell>
            <TableCell className="text-right tabular-nums">{brand.products_total_count}</TableCell>
            <TableCell>
              <Badge variant="outline">{brand.brand_tier ?? "unset"}</Badge>
            </TableCell>
            <TableCell>
              <Button
                aria-label={brand.is_featured_homepage_brand ? "Remove featured brand" : "Feature brand"}
                disabled={pendingId === brand.id}
                onClick={() => mutateFeatured(brand, !brand.is_featured_homepage_brand)}
                size="icon"
                type="button"
                variant="ghost"
              >
                {brand.is_featured_homepage_brand ? (
                  <Star className="size-4 fill-admin-accent text-admin-accent" />
                ) : (
                  <StarOff className="size-4" />
                )}
              </Button>
            </TableCell>
            <TableCell>
              <Checkbox
                aria-label={`Toggle ${brand.display_name} directory visibility`}
                checked={brand.is_visible_on_directory}
                disabled={pendingId === brand.id}
                onCheckedChange={(value) => mutateVisibility(brand, value === true)}
              />
            </TableCell>
            <TableCell className="text-right">
              <Button render={<Link href={`/admin/brands/${brand.id}`} />} size="icon" variant="ghost">
                <Edit className="size-4" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
