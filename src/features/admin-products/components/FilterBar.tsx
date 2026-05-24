"use client";

import { useMemo, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AdminProductReferenceOption } from "@/server/repositories/product-admin-repository";

const statusOptions = [
  ["all", "All"],
  ["imported", "Imported"],
  ["draft", "Draft"],
  ["partial", "Partial"],
  ["ready_to_publish", "Ready"],
  ["published", "Published"],
  ["hidden", "Hidden"],
  ["archived", "Archived"],
] as const;

const sortOptions = [
  ["recently_updated", "Recently updated"],
  ["newest_imported", "Newest imported"],
  ["lowest_completion", "Lowest score"],
  ["alphabetical", "Alphabetical"],
] as const;

const stockOptions = [
  ["all", "All stock"],
  ["in_stock", "In stock"],
  ["low_stock", "Low stock"],
  ["out_of_stock", "Out of stock"],
] as const;

const reviewFlags = [
  ["missing_price", "Missing price"],
  ["missing_image", "Missing image"],
  ["missing_stock_quantity", "Missing stock"],
  ["case_pack", "Case-pack"],
  ["duplicate_suspected", "Duplicate"],
  ["multiple_price_pairs", "Multiple prices"],
  ["needs_category_review", "Category review"],
  ["needs_brand_review", "Brand review"],
  ["needs_label_data", "Label data"],
] as const;

export function FilterBar({
  brands,
  categories,
}: Readonly<{
  brands: AdminProductReferenceOption[];
  categories: AdminProductReferenceOption[];
}>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const selectedFlags = useMemo(() => new Set(searchParams.getAll("flag")), [searchParams]);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    next.delete("page");

    if (!value || value === "all") {
      next.delete(key);
    } else {
      next.set(key, value);
    }

    startTransition(() => router.replace(`${pathname}?${next.toString()}`));
  }

  function toggleFlag(flag: string) {
    const next = new URLSearchParams(searchParams);
    const flags = new Set(next.getAll("flag"));
    next.delete("page");
    next.delete("flag");

    if (flags.has(flag)) {
      flags.delete(flag);
    } else {
      flags.add(flag);
    }

    for (const active of flags) {
      next.append("flag", active);
    }

    startTransition(() => router.replace(`${pathname}?${next.toString()}`));
  }

  function clearAll() {
    startTransition(() => router.replace(pathname));
  }

  return (
    <div className="space-y-3 border-b border-admin-border bg-admin-surface px-3 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-64 flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-admin-text-muted" />
          <Input
            aria-label="Search products"
            className="h-8 rounded-admin-md pl-8 text-admin-sm"
            defaultValue={searchParams.get("q") ?? ""}
            onBlur={(event) => setParam("q", event.currentTarget.value.trim())}
            placeholder="Search name or brand"
          />
        </div>
        <ProductSelect
          label="Status"
          onChange={(value) => setParam("status", value)}
          options={statusOptions}
          value={searchParams.get("status") ?? "all"}
        />
        <ProductSelect
          label="Stock"
          onChange={(value) => setParam("stock_status", value)}
          options={stockOptions}
          value={searchParams.get("stock_status") ?? "all"}
        />
        <ProductSelect
          label="Brand"
          onChange={(value) => setParam("brand", value)}
          options={[["all", "All brands"], ...brands.map((brand) => [brand.id, brand.label] as const)]}
          value={searchParams.get("brand") ?? "all"}
        />
        <ProductSelect
          label="Category"
          onChange={(value) => setParam("category", value)}
          options={[
            ["all", "All categories"],
            ...categories.map((category) => [category.id, category.label] as const),
          ]}
          value={searchParams.get("category") ?? "all"}
        />
        <ProductSelect
          label="Sort"
          onChange={(value) => setParam("sort", value)}
          options={sortOptions}
          value={searchParams.get("sort") ?? "recently_updated"}
        />
        <Button disabled={isPending} onClick={clearAll} size="sm" type="button" variant="outline">
          <X className="size-3.5" />
          Clear
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5" aria-label="Review flag filters">
        {reviewFlags.map(([flag, label]) => (
          <button
            className="rounded-admin-sm focus-visible:outline-admin-accent"
            key={flag}
            onClick={() => toggleFlag(flag)}
            type="button"
          >
            <Badge
              className={
                selectedFlags.has(flag)
                  ? "border-admin-accent bg-admin-accent text-white"
                  : "border-admin-border bg-admin-surface-muted text-admin-text"
              }
              variant="outline"
            >
              {label}
            </Badge>
          </button>
        ))}
      </div>
    </div>
  );
}

function ProductSelect({
  label,
  options,
  value,
  onChange,
}: Readonly<{
  label: string;
  options: readonly (readonly [string, string])[];
  value: string;
  onChange: (value: string) => void;
}>) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next ?? "all")}>
      <SelectTrigger aria-label={label} className="h-8 min-w-36 rounded-admin-md text-admin-sm">
        <SelectValue>{options.find(([key]) => key === value)?.[1] ?? label}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map(([key, optionLabel]) => (
          <SelectItem key={key} value={key}>
            {optionLabel}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
