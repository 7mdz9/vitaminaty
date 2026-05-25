"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createCategory, updateCategory } from "@/features/admin-categories/actions";
import type { CategoryPatch } from "@/lib/validation/category";
import type { CategoryRecord, ParentNav } from "@/types/category";

const parentNavOptions: ParentNav[] = ["Sport Nutrition", "Health & Wellness", "Snacks & Drinks"];

export function CategoryEditorForm({
  category,
  categories,
}: Readonly<{
  category: CategoryRecord | null;
  categories: CategoryRecord[];
}>) {
  const router = useRouter();
  const [current, setCurrent] = useState(category);
  const [form, setForm] = useState({
    name: category?.name ?? "",
    slug: category?.slug ?? "",
    parent_nav: category?.parent_nav ?? "Sport Nutrition",
    parent_id: category?.parent_id ?? "__root",
    subcategories: category?.subcategories.join("\n") ?? "",
    listing_copy: category?.listing_copy ?? "",
    seo_title: category?.seo_title ?? "",
    seo_description: category?.seo_description ?? "",
    is_visible: category?.is_visible ?? true,
  });
  const [status, setStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const parentOptions = categories.filter((candidate) => candidate.id !== current?.id);

  function save() {
    setStatus(null);
    startTransition(async () => {
      if (current) {
        const patch: CategoryPatch = {
          name: form.name,
          slug: form.slug,
          parent_nav: form.parent_nav,
          parent_id: form.parent_id === "__root" ? null : form.parent_id,
          subcategories: splitLines(form.subcategories),
          listing_copy: form.listing_copy || null,
          seo_title: form.seo_title || null,
          seo_description: form.seo_description || null,
          is_visible: form.is_visible,
        };
        const result = await updateCategory({
          categoryId: current.id,
          expectedUpdatedAt: current.updated_at,
          force: false,
          patch,
        });

        if (result.ok) {
          setCurrent(result.category);
          setStatus("Saved.");
        } else if (result.error === "stale_data" && result.current) {
          setCurrent(result.current);
          setStatus("This category changed in another session. Reloaded latest values.");
        } else {
          setStatus(result.message);
        }
        return;
      }

      const result = await createCategory({
        name: form.name,
        slug: form.slug,
        parent_nav: form.parent_nav,
        parent_id: form.parent_id === "__root" ? null : form.parent_id,
        is_visible: form.is_visible,
      });

      if (result.ok) {
        router.replace(`/admin/categories/${result.category.id}`);
      } else {
        setStatus(result.message);
      }
    });
  }

  return (
    <section className="space-y-4 rounded-admin-md border border-admin-border bg-admin-surface p-4">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1 text-admin-sm">
          <span className="text-admin-text-muted">Name</span>
          <Input
            value={form.name}
            onChange={(event) =>
              setForm((currentValue) => ({ ...currentValue, name: event.target.value }))
            }
          />
        </label>
        <label className="space-y-1 text-admin-sm">
          <span className="text-admin-text-muted">Slug</span>
          <Input
            value={form.slug}
            onChange={(event) =>
              setForm((currentValue) => ({ ...currentValue, slug: event.target.value }))
            }
          />
        </label>
        <div className="space-y-1 text-admin-sm">
          <span className="text-admin-text-muted">Navigation group</span>
          <Select
            value={form.parent_nav}
            onValueChange={(value) =>
              setForm((currentValue) => ({
                ...currentValue,
                parent_nav: (value ?? "Sport Nutrition") as ParentNav,
              }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {parentNavOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 text-admin-sm">
          <span className="text-admin-text-muted">Parent category</span>
          <Select
            value={form.parent_id}
            onValueChange={(value) =>
              setForm((currentValue) => ({ ...currentValue, parent_id: value ?? "__root" }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__root">Top level</SelectItem>
              {parentOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <label className="space-y-1 text-admin-sm">
        <span className="text-admin-text-muted">Subcategories</span>
        <textarea
          className="min-h-28 w-full rounded-admin-md border border-admin-border bg-admin-surface px-3 py-2 text-admin-sm outline-none focus-visible:ring-2 focus-visible:ring-admin-accent"
          value={form.subcategories}
          onChange={(event) =>
            setForm((currentValue) => ({ ...currentValue, subcategories: event.target.value }))
          }
        />
      </label>

      <label className="space-y-1 text-admin-sm">
        <span className="text-admin-text-muted">Listing copy</span>
        <textarea
          className="min-h-28 w-full rounded-admin-md border border-admin-border bg-admin-surface px-3 py-2 text-admin-sm outline-none focus-visible:ring-2 focus-visible:ring-admin-accent"
          value={form.listing_copy}
          onChange={(event) =>
            setForm((currentValue) => ({ ...currentValue, listing_copy: event.target.value }))
          }
        />
      </label>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1 text-admin-sm">
          <span className="text-admin-text-muted">SEO title</span>
          <Input
            value={form.seo_title}
            onChange={(event) =>
              setForm((currentValue) => ({ ...currentValue, seo_title: event.target.value }))
            }
          />
        </label>
        <label className="space-y-1 text-admin-sm">
          <span className="text-admin-text-muted">SEO description</span>
          <Input
            value={form.seo_description}
            onChange={(event) =>
              setForm((currentValue) => ({ ...currentValue, seo_description: event.target.value }))
            }
          />
        </label>
      </div>

      <label className="flex items-center gap-2 text-admin-sm">
        <Checkbox
          checked={form.is_visible}
          onCheckedChange={(value) =>
            setForm((currentValue) => ({ ...currentValue, is_visible: value === true }))
          }
        />
        Visible
      </label>

      <div className="flex items-center gap-2">
        <Button disabled={isPending} onClick={save} size="sm" type="button">
          Save category
        </Button>
        {status ? <span className="text-admin-sm text-admin-text-muted">{status}</span> : null}
      </div>
    </section>
  );
}

function splitLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}
