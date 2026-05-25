import type { GoalTag } from "@/types/category";

export interface HomepageConfigRecord {
  id: string;
  singleton_key: string;
  hero_title: string;
  hero_subtitle: string;
  hero_cta_label: string;
  hero_cta_href: string;
  promo_banner_text: string | null;
  promo_banner_href: string | null;
  promo_starts_at: string | null;
  promo_ends_at: string | null;
  new_arrival_product_ids: string[];
  bestseller_product_ids: string[];
  featured_brand_ids: string[];
  goal_order: GoalTag[];
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export type HomepageConfigSummary = Readonly<{
  config: HomepageConfigRecord;
  updatedByEmail: string | null;
}>;

export type HomepageCurationProduct = Readonly<{
  id: string;
  name: string;
  slug: string;
  status: string;
  brandName: string | null;
  primaryImageUrl: string | null;
}>;

export type HomepageCurationBrand = Readonly<{
  id: string;
  displayName: string;
  slug: string;
  logoUrl: string | null;
  heroImageUrl: string | null;
}>;
