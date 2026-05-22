export interface BrandRecord {
  id: string;
  display_name: string;
  slug: string;
  aliases: string[];
  logo_url: string | null;
  hero_image_url: string | null;
  country_of_origin: string | null;
  short_description: string | null;
  long_description: string | null;
  is_visible_on_directory: boolean;
  is_featured_homepage_brand: boolean;
  brand_tier: "heavy" | "medium" | "light" | null;
  created_at: string;
  updated_at: string;
}
