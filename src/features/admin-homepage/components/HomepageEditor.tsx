"use client";

import { useMemo, useState, useTransition } from "react";
import type { ReactNode } from "react";
import { Eye, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { updateHomepageConfig } from "@/features/admin-homepage/actions";
import type { GoalRecord, GoalTag } from "@/types/category";
import type {
  HomepageConfigRecord,
  HomepageCurationBrand,
  HomepageCurationProduct,
} from "@/types/homepage";

type HomepageEditorState = Readonly<{
  heroTitle: string;
  heroSubtitle: string;
  heroCtaLabel: string;
  heroCtaHref: string;
  promoBannerText: string;
  promoBannerHref: string;
  promoStartsAt: string;
  promoEndsAt: string;
  newArrivalProductIds: string[];
  bestsellerProductIds: string[];
  featuredBrandIds: string[];
  goalOrder: string[];
}>;

export function HomepageEditor({
  config,
  products,
  brands,
  goals,
}: Readonly<{
  config: HomepageConfigRecord;
  products: HomepageCurationProduct[];
  brands: HomepageCurationBrand[];
  goals: GoalRecord[];
}>) {
  const [state, setState] = useState<HomepageEditorState>(() => ({
    heroTitle: config.hero_title,
    heroSubtitle: config.hero_subtitle,
    heroCtaLabel: config.hero_cta_label,
    heroCtaHref: config.hero_cta_href,
    promoBannerText: config.promo_banner_text ?? "",
    promoBannerHref: config.promo_banner_href ?? "",
    promoStartsAt: toLocalDateTime(config.promo_starts_at),
    promoEndsAt: toLocalDateTime(config.promo_ends_at),
    newArrivalProductIds: pad(config.new_arrival_product_ids, 4),
    bestsellerProductIds: pad(config.bestseller_product_ids, 4),
    featuredBrandIds: pad(config.featured_brand_ids, 2),
    goalOrder: pad(config.goal_order, 5),
  }));
  const [updatedAt, setUpdatedAt] = useState(config.updated_at);
  const [status, setStatus] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [, startTransition] = useTransition();

  const productMap = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );
  const brandMap = useMemo(() => new Map(brands.map((brand) => [brand.id, brand])), [brands]);
  const goalMap = useMemo(
    () => new Map(goals.map((goal) => [goal.tag, goal.display_name])),
    [goals],
  );

  function updateField<Key extends keyof HomepageEditorState>(
    key: Key,
    value: HomepageEditorState[Key],
  ) {
    setState((current) => ({ ...current, [key]: value }));
  }

  function updateSlot(
    key: "newArrivalProductIds" | "bestsellerProductIds" | "featuredBrandIds" | "goalOrder",
    index: number,
    value: string,
  ) {
    setState((current) => ({
      ...current,
      [key]: current[key].map((item, itemIndex) => (itemIndex === index ? value : item)),
    }));
  }

  function save() {
    setStatus(null);
    startTransition(async () => {
      const result = await updateHomepageConfig({
        configId: config.id,
        expectedUpdatedAt: updatedAt,
        heroTitle: state.heroTitle,
        heroSubtitle: state.heroSubtitle,
        heroCtaLabel: state.heroCtaLabel,
        heroCtaHref: state.heroCtaHref,
        promoBannerText: state.promoBannerText,
        promoBannerHref: state.promoBannerHref,
        promoStartsAt: toIsoOrUndefined(state.promoStartsAt),
        promoEndsAt: toIsoOrUndefined(state.promoEndsAt),
        newArrivalProductIds: compactUnique(state.newArrivalProductIds),
        bestsellerProductIds: compactUnique(state.bestsellerProductIds),
        featuredBrandIds: compactUnique(state.featuredBrandIds),
        goalOrder: compactUnique(state.goalOrder) as GoalTag[],
      });

      if (result.ok) {
        setUpdatedAt(result.config.updated_at);
        setStatus("Homepage curation saved.");
      } else {
        setStatus(result.message);
        if (result.current) {
          setUpdatedAt(result.current.updated_at);
        }
      }
    });
  }

  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1.25fr)_minmax(22rem,0.75fr)]">
      <div className="space-y-3">
        {status ? (
          <div className="rounded-admin-md border border-admin-border bg-admin-surface-muted px-3 py-2 text-admin-sm text-admin-text">
            {status}
          </div>
        ) : null}

        <EditorSection title="Hero">
          <Field label="Title">
            <Input
              value={state.heroTitle}
              onChange={(event) => updateField("heroTitle", event.target.value)}
            />
          </Field>
          <Field label="Subtitle">
            <Textarea
              value={state.heroSubtitle}
              onChange={(event) => updateField("heroSubtitle", event.target.value)}
            />
          </Field>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="CTA label">
              <Input
                value={state.heroCtaLabel}
                onChange={(event) => updateField("heroCtaLabel", event.target.value)}
              />
            </Field>
            <Field label="CTA link">
              <Input
                value={state.heroCtaHref}
                onChange={(event) => updateField("heroCtaHref", event.target.value)}
              />
            </Field>
          </div>
        </EditorSection>

        <EditorSection title="Promo Banner">
          <Field label="Text">
            <Input
              value={state.promoBannerText}
              onChange={(event) => updateField("promoBannerText", event.target.value)}
            />
          </Field>
          <Field label="Link">
            <Input
              value={state.promoBannerHref}
              onChange={(event) => updateField("promoBannerHref", event.target.value)}
            />
          </Field>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Start">
              <Input
                type="datetime-local"
                value={state.promoStartsAt}
                onChange={(event) => updateField("promoStartsAt", event.target.value)}
              />
            </Field>
            <Field label="End">
              <Input
                type="datetime-local"
                value={state.promoEndsAt}
                onChange={(event) => updateField("promoEndsAt", event.target.value)}
              />
            </Field>
          </div>
        </EditorSection>

        <EditorSection title="Product Rails">
          <SlotGroup
            label="New arrivals"
            options={products.map((product) => ({
              value: product.id,
              label: `${product.name} (${product.status})`,
            }))}
            values={state.newArrivalProductIds}
            onChange={(index, value) => updateSlot("newArrivalProductIds", index, value)}
          />
          <SlotGroup
            label="Bestsellers"
            options={products.map((product) => ({
              value: product.id,
              label: `${product.name} (${product.status})`,
            }))}
            values={state.bestsellerProductIds}
            onChange={(index, value) => updateSlot("bestsellerProductIds", index, value)}
          />
        </EditorSection>

        <EditorSection title="Featured Brands And Goals">
          <SlotGroup
            label="Featured brands"
            options={brands.map((brand) => ({ value: brand.id, label: brand.displayName }))}
            values={state.featuredBrandIds}
            onChange={(index, value) => updateSlot("featuredBrandIds", index, value)}
          />
          <SlotGroup
            label="Goal pills"
            options={goals.map((goal) => ({ value: goal.tag, label: goal.display_name }))}
            values={state.goalOrder}
            onChange={(index, value) => updateSlot("goalOrder", index, value)}
          />
        </EditorSection>
      </div>

      <aside className="space-y-3">
        <div className="flex gap-2">
          <Button className="flex-1" onClick={save} type="button">
            <Save className="size-4" />
            Save
          </Button>
          <Button
            className="flex-1"
            onClick={() => setShowPreview((current) => !current)}
            type="button"
            variant="outline"
          >
            <Eye className="size-4" />
            Preview
          </Button>
        </div>

        <Preview
          brandMap={brandMap}
          goalMap={goalMap}
          productMap={productMap}
          showPreview={showPreview}
          state={state}
        />
      </aside>
    </div>
  );
}

function EditorSection({ title, children }: Readonly<{ title: string; children: ReactNode }>) {
  return (
    <section className="rounded-admin-md border border-admin-border bg-admin-surface">
      <div className="border-b border-admin-border bg-admin-surface-muted px-3 py-2">
        <h3 className="font-admin-display text-admin-sm text-admin-text">{title}</h3>
      </div>
      <div className="space-y-3 p-3">{children}</div>
    </section>
  );
}

function Field({ label, children }: Readonly<{ label: string; children: ReactNode }>) {
  return (
    <label className="grid gap-1 text-admin-sm">
      <span className="font-medium text-admin-text">{label}</span>
      {children}
    </label>
  );
}

function SlotGroup({
  label,
  values,
  options,
  onChange,
}: Readonly<{
  label: string;
  values: string[];
  options: Array<{ value: string; label: string }>;
  onChange: (index: number, value: string) => void;
}>) {
  return (
    <div className="space-y-2">
      <p className="text-admin-sm font-medium text-admin-text">{label}</p>
      <div className="grid gap-2">
        {values.map((value, index) => (
          <select
            className="h-9 rounded-admin-md border border-admin-border bg-admin-surface px-2 text-admin-sm text-admin-text"
            key={`${label}-${index}`}
            onChange={(event) => onChange(index, event.target.value)}
            value={value}
          >
            <option value="">Empty slot</option>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {index + 1}. {option.label}
              </option>
            ))}
          </select>
        ))}
      </div>
    </div>
  );
}

function Preview({
  state,
  productMap,
  brandMap,
  goalMap,
  showPreview,
}: Readonly<{
  state: HomepageEditorState;
  productMap: Map<string, HomepageCurationProduct>;
  brandMap: Map<string, HomepageCurationBrand>;
  goalMap: Map<string, string>;
  showPreview: boolean;
}>) {
  if (!showPreview) {
    return (
      <section className="rounded-admin-md border border-admin-border bg-admin-surface p-3 text-admin-sm text-admin-text-muted">
        Preview is hidden.
      </section>
    );
  }

  const arrivals = compactUnique(state.newArrivalProductIds).flatMap((id) => {
    const product = productMap.get(id);
    return product ? [product] : [];
  });
  const bestsellers = compactUnique(state.bestsellerProductIds).flatMap((id) => {
    const product = productMap.get(id);
    return product ? [product] : [];
  });
  const selectedBrands = compactUnique(state.featuredBrandIds).flatMap((id) => {
    const brand = brandMap.get(id);
    return brand ? [brand] : [];
  });

  return (
    <section className="space-y-3 rounded-admin-md border border-admin-border bg-admin-surface p-3">
      <div className="rounded-admin-md border border-admin-border bg-admin-surface-muted p-3">
        <p className="font-admin-display text-2xl text-admin-text">{state.heroTitle}</p>
        <p className="mt-1 text-admin-sm text-admin-text-muted">{state.heroSubtitle}</p>
        <Badge className="mt-3">{state.heroCtaLabel}</Badge>
      </div>
      {state.promoBannerText ? (
        <div className="rounded-admin-sm border border-admin-accent bg-admin-surface px-3 py-2 text-admin-sm text-admin-text">
          {state.promoBannerText}
        </div>
      ) : null}
      <PreviewList title="New arrivals" items={arrivals.map((product) => product.name)} />
      <PreviewList title="Bestsellers" items={bestsellers.map((product) => product.name)} />
      <PreviewList
        title="Featured brands"
        items={selectedBrands.map((brand) => brand.displayName)}
      />
      <div className="flex flex-wrap gap-1.5">
        {compactUnique(state.goalOrder).map((goal) => (
          <Badge key={goal} variant="outline">
            {goalMap.get(goal) ?? goal}
          </Badge>
        ))}
      </div>
    </section>
  );
}

function PreviewList({ title, items }: Readonly<{ title: string; items: string[] }>) {
  return (
    <div>
      <p className="text-admin-caption uppercase text-admin-text-muted">{title}</p>
      <div className="mt-1 grid gap-1">
        {items.length > 0 ? (
          items.map((item) => (
            <div
              className="rounded-admin-sm border border-admin-border px-2 py-1 text-admin-sm text-admin-text"
              key={item}
            >
              {item}
            </div>
          ))
        ) : (
          <p className="text-admin-sm text-admin-text-muted">No slots selected.</p>
        )}
      </div>
    </div>
  );
}

function pad(values: readonly string[], length: number): string[] {
  return [...values, ...Array.from({ length }, () => "")].slice(0, length);
}

function compactUnique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function toLocalDateTime(value: string | null): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 16);
}

function toIsoOrUndefined(value: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}
