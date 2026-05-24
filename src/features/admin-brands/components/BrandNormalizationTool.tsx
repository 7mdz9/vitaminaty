"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Wand2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { addBrandAlias, createBrand } from "@/features/admin-brands/actions";
import type {
  AdminBrandListItem,
  AdminUnmatchedBrandRaw,
} from "@/server/repositories/brand-admin-repository";
import type { BrandRecord } from "@/types/brand";

export function BrandNormalizationTool({
  brandOptions,
  unmatched,
  orphanBrands,
}: Readonly<{
  brandOptions: AdminBrandListItem[];
  unmatched: AdminUnmatchedBrandRaw[];
  orphanBrands: BrandRecord[];
}>) {
  const [rows, setRows] = useState(unmatched);
  const [selectedBrandByRaw, setSelectedBrandByRaw] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const brandsById = useMemo(
    () => new Map(brandOptions.map((brand) => [brand.id, brand])),
    [brandOptions],
  );

  function mapAlias(row: AdminUnmatchedBrandRaw) {
    const brandId = selectedBrandByRaw[row.brand_raw];
    if (!brandId) {
      setStatus("Choose a canonical brand first.");
      return;
    }

    setStatus(null);
    startTransition(async () => {
      const result = await addBrandAlias({ brandId, alias: row.brand_raw });

      if (result.ok) {
        setRows((current) => current.filter((candidate) => candidate.brand_raw !== row.brand_raw));
        setStatus(
          `Mapped ${row.brand_raw} to ${brandsById.get(brandId)?.display_name ?? "brand"} (${result.affectedProductIds?.length ?? 0} products).`,
        );
      } else {
        setStatus(result.message);
      }
    });
  }

  function createCanonical(row: AdminUnmatchedBrandRaw) {
    setStatus(null);
    startTransition(async () => {
      const result = await createBrand({
        displayName: titleCase(row.brand_raw),
        alias: row.brand_raw,
      });

      if (result.ok) {
        setRows((current) => current.filter((candidate) => candidate.brand_raw !== row.brand_raw));
        setStatus(
          `Created ${result.brand.display_name} and mapped ${result.affectedProductIds?.length ?? 0} products.`,
        );
      } else {
        setStatus(result.message);
      }
    });
  }

  return (
    <div className="space-y-4">
      <section className="rounded-admin-md border border-admin-border bg-admin-surface">
        <div className="flex items-center justify-between border-b border-admin-border px-3 py-2">
          <div>
            <h3 className="font-admin-display text-lg text-admin-text">Unmatched raw brands</h3>
            <p className="text-admin-sm text-admin-text-muted">
              {rows.length} raw spelling{rows.length === 1 ? "" : "s"} need mapping
            </p>
          </div>
          {status ? <span className="text-admin-sm text-admin-text-muted">{status}</span> : null}
        </div>
        <Table>
          <TableHeader>
            <TableRow className="h-9">
              <TableHead>Raw spelling</TableHead>
              <TableHead className="text-right">Products</TableHead>
              <TableHead>Samples</TableHead>
              <TableHead>Canonical brand</TableHead>
              <TableHead className="w-40 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow className="h-10" key={row.brand_raw}>
                <TableCell className="font-medium">{row.brand_raw}</TableCell>
                <TableCell className="text-right tabular-nums">{row.product_count}</TableCell>
                <TableCell className="max-w-sm truncate text-admin-text-muted">
                  {row.sample_product_names.join(", ")}
                </TableCell>
                <TableCell>
                  <Select
                    value={selectedBrandByRaw[row.brand_raw] ?? ""}
                    onValueChange={(value) =>
                      setSelectedBrandByRaw((current) => ({
                        ...current,
                        [row.brand_raw]: value ?? "",
                      }))
                    }
                  >
                    <SelectTrigger className="h-8 min-w-56">
                      <SelectValue placeholder="Choose brand" />
                    </SelectTrigger>
                    <SelectContent>
                      {brandOptions.map((brand) => (
                        <SelectItem key={brand.id} value={brand.id}>
                          {brand.display_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      disabled={isPending}
                      onClick={() => mapAlias(row)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      <Wand2 className="size-4" />
                      Map
                    </Button>
                    <Button disabled={isPending} onClick={() => createCanonical(row)} size="sm" type="button">
                      <Plus className="size-4" />
                      New
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <section className="rounded-admin-md border border-admin-border bg-admin-surface p-3">
        <h3 className="font-admin-display text-lg text-admin-text">Orphan canonical brands</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {orphanBrands.map((brand) => (
            <Badge key={brand.id} variant="outline">
              {brand.display_name}
            </Badge>
          ))}
          {orphanBrands.length === 0 ? (
            <p className="text-admin-sm text-admin-text-muted">No orphan canonical brands.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
