"use client";

import { useRef, useState, useTransition } from "react";
import { Upload } from "lucide-react";
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
import { updateBrand, uploadBrandHero, uploadBrandLogo } from "@/features/admin-brands/actions";
import type { AdminBrandPatch } from "@/lib/validation/brand";
import type { BrandRecord } from "@/types/brand";

type BrandTierFormValue = "unset" | "heavy" | "medium" | "light";

export function BrandEditorForm({ brand }: Readonly<{ brand: BrandRecord }>) {
  const [current, setCurrent] = useState(brand);
  const [form, setForm] = useState({
    display_name: brand.display_name,
    slug: brand.slug,
    country_of_origin: brand.country_of_origin ?? "",
    short_description: brand.short_description ?? "",
    long_description: brand.long_description ?? "",
    brand_tier: (brand.brand_tier ?? "unset") as BrandTierFormValue,
    is_visible_on_directory: brand.is_visible_on_directory,
    is_featured_homepage_brand: brand.is_featured_homepage_brand,
  });
  const [status, setStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const heroInputRef = useRef<HTMLInputElement>(null);

  function save() {
    const patch: AdminBrandPatch = {
      display_name: form.display_name,
      slug: form.slug,
      country_of_origin: form.country_of_origin || null,
      short_description: form.short_description || null,
      long_description: form.long_description || null,
      brand_tier: form.brand_tier === "unset" ? null : form.brand_tier,
      is_visible_on_directory: form.is_visible_on_directory,
      is_featured_homepage_brand: form.is_featured_homepage_brand,
    };

    setStatus(null);
    startTransition(async () => {
      const result = await updateBrand({
        brandId: current.id,
        expectedUpdatedAt: current.updated_at,
        force: false,
        patch,
      });

      if (result.ok) {
        setCurrent(result.brand);
        setStatus("Saved.");
      } else if (result.code === "stale_data" && result.current) {
        setCurrent(result.current);
        setStatus("This brand changed in another session. Reloaded the latest values.");
      } else {
        setStatus(result.message);
      }
    });
  }

  function upload(kind: "logo" | "hero", file: File | null) {
    if (!file) {
      return;
    }

    const body = new FormData();
    body.set("brandId", current.id);
    body.set("file", file);
    setStatus(null);
    startTransition(async () => {
      const result = kind === "logo" ? await uploadBrandLogo(body) : await uploadBrandHero(body);

      if (result.ok) {
        setCurrent(result.brand);
        setStatus(`${kind === "logo" ? "Logo" : "Hero"} uploaded.`);
      } else {
        setStatus(result.message);
      }
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="space-y-4 rounded-admin-md border border-admin-border bg-admin-surface p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-admin-sm">
            <span className="text-admin-text-muted">Display name</span>
            <Input
              value={form.display_name}
              onChange={(event) =>
                setForm((value) => ({ ...value, display_name: event.target.value }))
              }
            />
          </label>
          <label className="space-y-1 text-admin-sm">
            <span className="text-admin-text-muted">Slug</span>
            <Input
              value={form.slug}
              onChange={(event) => setForm((value) => ({ ...value, slug: event.target.value }))}
            />
          </label>
          <label className="space-y-1 text-admin-sm">
            <span className="text-admin-text-muted">Country</span>
            <Input
              value={form.country_of_origin}
              onChange={(event) =>
                setForm((value) => ({ ...value, country_of_origin: event.target.value }))
              }
            />
          </label>
          <div className="space-y-1 text-admin-sm">
            <span className="text-admin-text-muted">Tier</span>
            <Select
              value={form.brand_tier}
              onValueChange={(value) =>
                setForm((currentValue) => ({
                  ...currentValue,
                  brand_tier: (value ?? "unset") as BrandTierFormValue,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unset">Unset</SelectItem>
                <SelectItem value="heavy">Heavy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="light">Light</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <label className="space-y-1 text-admin-sm">
          <span className="text-admin-text-muted">Short description</span>
          <Input
            value={form.short_description}
            onChange={(event) =>
              setForm((value) => ({ ...value, short_description: event.target.value }))
            }
          />
        </label>

        <label className="space-y-1 text-admin-sm">
          <span className="text-admin-text-muted">Long description</span>
          <textarea
            className="min-h-32 w-full rounded-admin-md border border-admin-border bg-admin-surface px-3 py-2 text-admin-sm outline-none focus-visible:ring-2 focus-visible:ring-admin-accent"
            value={form.long_description}
            onChange={(event) =>
              setForm((value) => ({ ...value, long_description: event.target.value }))
            }
          />
        </label>

        <div className="flex flex-wrap gap-4 text-admin-sm">
          <label className="flex items-center gap-2">
            <Checkbox
              checked={form.is_visible_on_directory}
              onCheckedChange={(value) =>
                setForm((currentValue) => ({
                  ...currentValue,
                  is_visible_on_directory: value === true,
                }))
              }
            />
            Visible in directory
          </label>
          <label className="flex items-center gap-2">
            <Checkbox
              checked={form.is_featured_homepage_brand}
              onCheckedChange={(value) =>
                setForm((currentValue) => ({
                  ...currentValue,
                  is_featured_homepage_brand: value === true,
                }))
              }
            />
            Featured homepage brand
          </label>
        </div>

        <div className="flex items-center gap-2">
          <Button disabled={isPending} onClick={save} size="sm" type="button">
            Save brand
          </Button>
          {status ? <span className="text-admin-sm text-admin-text-muted">{status}</span> : null}
        </div>
      </section>

      <aside className="space-y-3 rounded-admin-md border border-admin-border bg-admin-surface p-4">
        <ImagePreview label="Logo" url={current.logo_url} />
        <input
          ref={logoInputRef}
          className="hidden"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => upload("logo", event.target.files?.[0] ?? null)}
        />
        <Button
          className="w-full"
          disabled={isPending}
          onClick={() => logoInputRef.current?.click()}
          size="sm"
          type="button"
          variant="outline"
        >
          <Upload className="size-4" />
          Upload logo
        </Button>

        <ImagePreview label="Hero" url={current.hero_image_url} />
        <input
          ref={heroInputRef}
          className="hidden"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => upload("hero", event.target.files?.[0] ?? null)}
        />
        <Button
          className="w-full"
          disabled={isPending}
          onClick={() => heroInputRef.current?.click()}
          size="sm"
          type="button"
          variant="outline"
        >
          <Upload className="size-4" />
          Upload hero
        </Button>
      </aside>
    </div>
  );
}

function ImagePreview({ label, url }: Readonly<{ label: string; url: string | null }>) {
  return (
    <div className="space-y-1">
      <p className="text-admin-sm text-admin-text-muted">{label}</p>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt=""
          className="aspect-video w-full rounded-admin-md border border-admin-border object-contain"
          src={url}
        />
      ) : (
        <div className="grid aspect-video w-full place-items-center rounded-admin-md border border-admin-border bg-admin-surface-muted text-admin-sm text-admin-text-muted">
          No image
        </div>
      )}
    </div>
  );
}
