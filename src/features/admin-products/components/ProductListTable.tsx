"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { Archive, EyeOff, MoreHorizontal, Pencil, Send, type LucideIcon } from "lucide-react";
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
import { CompletionScoreBadge } from "@/components/admin/CompletionScoreBadge";
import { useShortcuts } from "@/features/admin-shell/use-shortcuts";
import {
  archiveProduct,
  getProductDrawerData,
  publishProduct,
  unpublishProduct,
  updateProduct,
  type AdminProductActionResult,
  type AdminProductDrawerDataResult,
} from "@/features/admin-products/actions";
import { InlineEditCell } from "./InlineEditCell";
import { ProductDrawer } from "./ProductDrawer";
import type {
  AdminProductEditorData,
  AdminProductListItem,
  AdminProductReferenceOption,
} from "@/server/repositories/product-admin-repository";

const statusOptions = [
  { value: "imported", label: "Imported" },
  { value: "draft", label: "Draft" },
  { value: "partial", label: "Partial" },
  { value: "ready_to_publish", label: "Ready" },
  { value: "published", label: "Published" },
  { value: "hidden", label: "Hidden" },
  { value: "archived", label: "Archived" },
];

const visibleFlagLabels: Record<string, string> = {
  missing_price: "Price",
  missing_image: "Image",
  missing_stock_quantity: "Stock",
  case_pack: "Case",
  duplicate_suspected: "Dup",
  multiple_price_pairs: "Pairs",
  needs_category_review: "Cat",
  needs_brand_review: "Brand",
  needs_label_data: "Label",
};

export function ProductListTable({
  products,
  brands,
  categories,
}: Readonly<{
  products: AdminProductListItem[];
  brands: AdminProductReferenceOption[];
  categories: AdminProductReferenceOption[];
}>) {
  const [rows, setRows] = useState(products);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [drawerProductId, setDrawerProductId] = useState<string | null>(null);
  const [drawerCache, setDrawerCache] = useState<Record<string, AdminProductEditorData>>({});
  const [drawerLoadingId, setDrawerLoadingId] = useState<string | null>(null);
  const brandOptions = useMemo(
    () => brands.map((brand) => ({ value: brand.id, label: brand.label })),
    [brands],
  );
  const categoryOptions = useMemo(
    () => categories.map((category) => ({ value: category.id, label: category.label })),
    [categories],
  );

  const prefetchDrawer = useCallback(async (productId: string): Promise<AdminProductDrawerDataResult> => {
    if (drawerCache[productId]) {
      return {
        ok: true,
        data: drawerCache[productId],
      };
    }

    setDrawerLoadingId(productId);
    const result = await getProductDrawerData(productId);
    setDrawerLoadingId((current) => (current === productId ? null : current));

    if (result.ok) {
      setDrawerCache((current) => ({ ...current, [productId]: result.data }));
    }

    return result;
  }, [drawerCache]);

  const openDrawer = useCallback((productId: string) => {
    setDrawerProductId(productId);
    void prefetchDrawer(productId);
  }, [prefetchDrawer]);

  useShortcuts(
    useMemo(
      () => [
        {
          key: "j",
          label: "Next product row",
          action: () => setFocusedIndex((index) => Math.min(rows.length - 1, index + 1)),
        },
        {
          key: "k",
          label: "Previous product row",
          action: () => setFocusedIndex((index) => Math.max(0, index - 1)),
        },
        {
          key: "e",
          label: "Open product drawer",
          action: () => {
            const focused = rows[focusedIndex];
            if (focused) {
              openDrawer(focused.id);
            }
          },
        },
      ],
      [focusedIndex, openDrawer, rows],
    ),
  );

  async function saveField(
    product: AdminProductListItem,
    field: "retail_price_aed" | "brand_id" | "category_id" | "status" | "is_public_visible",
    value: string | number | boolean | null,
    force = false,
  ): Promise<{ ok: boolean; message?: string }> {
    const result = await updateProduct({
      productId: product.id,
      expectedUpdatedAt: product.updated_at,
      force,
      patch: {
        [field]: value,
      },
    });

    applyActionResult(product.id, result, field, value);

    return {
      ok: result.ok,
      message: result.ok
        ? undefined
        : result.code === "stale_data"
          ? `${result.message} Original editor: ${
              result.current?.original_editor.email ?? "another admin"
            }.`
          : result.message,
    };
  }

  function applyActionResult(
    productId: string,
    result: AdminProductActionResult,
    field?: string,
    value?: string | number | boolean | null,
  ) {
    if (!result.ok) {
      return;
    }

    setRows((current) =>
      current.map((row) =>
        row.id === productId
          ? {
              ...row,
              [field ?? "updated_at"]: value ?? row[field as keyof AdminProductListItem],
              retail_price_aed: result.product.retail_price_aed,
              brand_id: result.product.brand_id,
              brand_name: findLabel(brands, result.product.brand_id),
              category_id: result.product.category_id,
              category_name: findLabel(categories, result.product.category_id),
              status: result.product.status,
              is_public_visible: result.product.is_public_visible,
              completion_score: result.product.completion_score,
              admin_review_flags: result.product.admin_review_flags,
              updated_at: result.product.updated_at,
            }
          : row,
      ),
    );
  }

  function toggleSelected(productId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  }

  return (
    <div className="bg-admin-surface">
      <div className="flex h-10 items-center justify-between border-b border-admin-border px-3">
        <p className="text-admin-sm text-admin-text-muted">
          {selectedIds.size > 0 ? `${selectedIds.size} selected` : `${rows.length} visible rows`}
        </p>
        <Button size="sm" variant="outline" type="button" disabled={selectedIds.size === 0}>
          Bulk actions land in Step 7
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="h-9">
            <TableHead scope="col" className="w-8">
              <span className="sr-only">Select</span>
            </TableHead>
            <TableHead scope="col" className="w-14">Image</TableHead>
            <TableHead scope="col" className="min-w-72">Name</TableHead>
            <TableHead scope="col">Brand</TableHead>
            <TableHead scope="col">Category</TableHead>
            <TableHead scope="col" className="text-right">Price</TableHead>
            <TableHead scope="col">Stock</TableHead>
            <TableHead scope="col">Status</TableHead>
            <TableHead scope="col">Visible</TableHead>
            <TableHead scope="col">Score</TableHead>
            <TableHead scope="col">Flags</TableHead>
            <TableHead scope="col" className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((product, index) => (
            <TableRow
              className="h-10 cursor-pointer outline-none data-[focused=true]:bg-admin-surface-muted data-[focused=true]:shadow-[inset_3px_0_0_var(--admin-accent)]"
              data-focused={index === focusedIndex}
              key={product.id}
              onClick={() => openDrawer(product.id)}
              onFocus={() => setFocusedIndex(index)}
              onMouseEnter={() => void prefetchDrawer(product.id)}
              tabIndex={0}
            >
              <TableCell onClick={(event) => event.stopPropagation()}>
                <Checkbox
                  checked={selectedIds.has(product.id)}
                  onCheckedChange={() => toggleSelected(product.id)}
                  aria-label={`Select ${product.name}`}
                />
              </TableCell>
              <TableCell>
                {product.primary_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt=""
                    className="size-8 rounded-admin-sm border border-admin-border object-cover"
                    src={product.primary_image_url}
                  />
                ) : (
                  <div className="flex size-8 items-center justify-center rounded-admin-sm border border-admin-border bg-admin-surface-muted text-admin-caption text-admin-text-muted">
                    {product.name.slice(0, 1)}
                  </div>
                )}
              </TableCell>
              <TableCell>
                <Link
                  className="block max-w-72 truncate font-medium text-admin-text underline-offset-2 hover:underline"
                  href={`/admin/products/${product.id}`}
                  onClick={(event) => event.stopPropagation()}
                >
                  {product.name}
                </Link>
                <p className="text-admin-caption text-admin-text-muted">{product.slug}</p>
              </TableCell>
              <TableCell>
                <InlineEditCell
                  ariaLabel={`Brand for ${product.name}`}
                  kind="select"
                  onSave={(value, force) => saveField(product, "brand_id", value, force)}
                  options={brandOptions}
                  value={product.brand_id}
                />
              </TableCell>
              <TableCell>
                <InlineEditCell
                  ariaLabel={`Category for ${product.name}`}
                  kind="select"
                  onSave={(value, force) => saveField(product, "category_id", value, force)}
                  options={categoryOptions}
                  value={product.category_id}
                />
              </TableCell>
              <TableCell className="text-right">
                <InlineEditCell
                  ariaLabel={`Retail price for ${product.name}`}
                  kind="money"
                  onSave={(value, force) => saveField(product, "retail_price_aed", value, force)}
                  value={product.retail_price_aed}
                />
              </TableCell>
              <TableCell>
                <StockSummary product={product} />
              </TableCell>
              <TableCell>
                <InlineEditCell
                  ariaLabel={`Status for ${product.name}`}
                  kind="select"
                  onSave={(value, force) => saveField(product, "status", value, force)}
                  options={statusOptions}
                  value={product.status}
                />
              </TableCell>
              <TableCell>
                <InlineEditCell
                  ariaLabel={`Visibility for ${product.name}`}
                  kind="toggle"
                  onSave={(value, force) => saveField(product, "is_public_visible", value, force)}
                  value={product.is_public_visible}
                />
              </TableCell>
              <TableCell>
                <CompletionScoreBadge score={product.completion_score} />
              </TableCell>
              <TableCell>
                <FlagChips product={product} />
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1" onClick={(event) => event.stopPropagation()}>
                  <Button
                    render={
                      <Link aria-label={`Edit ${product.name}`} href={`/admin/products/${product.id}`} />
                    }
                    size="icon-sm"
                    variant="ghost"
                  >
                      <Pencil className="size-4" />
                  </Button>
                  <ProductActionButton
                    icon={product.status === "published" ? EyeOff : Send}
                    label={product.status === "published" ? "Unpublish" : "Publish"}
                    onClick={async () => {
                      const result =
                        product.status === "published"
                          ? await unpublishProduct({
                              productId: product.id,
                              expectedUpdatedAt: product.updated_at,
                            })
                          : await publishProduct({
                              productId: product.id,
                              expectedUpdatedAt: product.updated_at,
                            });
                      applyActionResult(product.id, result);
                    }}
                  />
                  <ProductActionButton
                    icon={Archive}
                    label="Archive"
                    onClick={async () => {
                      const result = await archiveProduct({
                        productId: product.id,
                        expectedUpdatedAt: product.updated_at,
                      });
                      applyActionResult(product.id, result);
                    }}
                  />
                  <Button aria-label="More actions" size="icon-sm" type="button" variant="ghost">
                    <MoreHorizontal className="size-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <ProductDrawer
        open={drawerProductId !== null}
        productId={drawerProductId}
        data={drawerProductId ? drawerCache[drawerProductId] ?? null : null}
        brands={brands}
        categories={categories}
        loading={drawerProductId !== null && drawerLoadingId === drawerProductId}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setDrawerProductId(null);
          }
        }}
        onRequestData={prefetchDrawer}
        onProductSaved={(product) => {
          applyActionResult(product.id, { ok: true, product });
          setDrawerCache((current) => {
            const existing = current[product.id];
            return existing
              ? {
                  ...current,
                  [product.id]: {
                    ...existing,
                    product,
                  },
                }
              : current;
          });
        }}
      />
    </div>
  );
}

function StockSummary({ product }: Readonly<{ product: AdminProductListItem }>) {
  if (product.stock_badge === "missing") {
    return <Badge variant="destructive">missing</Badge>;
  }

  return (
    <div className="flex items-center gap-2 tabular-nums">
      <span>{product.stock_total ?? 0}</span>
      {product.stock_badge !== "in_stock" ? (
        <Badge variant="outline">{product.stock_badge.replace(/_/g, " ")}</Badge>
      ) : null}
    </div>
  );
}

function FlagChips({ product }: Readonly<{ product: AdminProductListItem }>) {
  const activeFlags = Object.entries(product.admin_review_flags).filter(([, active]) => active);

  if (activeFlags.length === 0) {
    return <span className="text-admin-caption text-admin-text-muted">None</span>;
  }

  return (
    <div className="flex max-w-36 flex-wrap gap-1">
      {activeFlags.slice(0, 3).map(([flag]) => (
        <Badge className="rounded-admin-sm px-1.5" key={flag} variant="outline">
          {visibleFlagLabels[flag] ?? flag}
        </Badge>
      ))}
      {activeFlags.length > 3 ? <Badge variant="outline">+{activeFlags.length - 3}</Badge> : null}
    </div>
  );
}

function ProductActionButton({
  icon: Icon,
  label,
  onClick,
}: Readonly<{
  icon: LucideIcon;
  label: string;
  onClick: () => Promise<void>;
}>) {
  return (
    <Button aria-label={label} onClick={() => void onClick()} size="icon-sm" type="button" variant="ghost">
      <Icon className="size-4" />
    </Button>
  );
}

function findLabel(options: AdminProductReferenceOption[], id: string | null): string | null {
  return id ? (options.find((option) => option.id === id)?.label ?? null) : null;
}
