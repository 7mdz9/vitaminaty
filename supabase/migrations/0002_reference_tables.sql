CREATE TABLE brands (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  display_name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  aliases text[] DEFAULT '{}',                   -- raw spellings that map here
  logo_url text,
  hero_image_url text,
  country_of_origin text,
  short_description text,
  long_description text,
  is_visible_on_directory boolean NOT NULL DEFAULT false,
  is_featured_homepage_brand boolean NOT NULL DEFAULT false,
  brand_tier text,                                -- 'heavy' | 'medium' | 'light' (computed)
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX brands_slug_idx ON brands(slug);
CREATE INDEX brands_visible_idx ON brands(is_visible_on_directory) WHERE is_visible_on_directory = true;
CREATE INDEX brands_aliases_gin ON brands USING gin(aliases);

CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  parent_nav text NOT NULL,                       -- 'Sport Nutrition' | 'Health & Wellness' | 'Snacks & Drinks'
  subcategories text[] DEFAULT '{}',
  supported_goals goal_tag[] DEFAULT '{}',
  listing_copy text,
  seo_title text,
  seo_description text,
  is_visible boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX categories_slug_idx ON categories(slug);
CREATE INDEX categories_parent_nav_idx ON categories(parent_nav);

CREATE TABLE md_category_mapping (
  md_category text PRIMARY KEY,
  default_public_category_slug text REFERENCES categories(slug),
  requires_split boolean NOT NULL DEFAULT false,
  split_hint text                                  -- prose hint for the admin doing the split
);

CREATE TABLE goals (
  tag goal_tag PRIMARY KEY,
  display_name text NOT NULL,
  description text,
  sort_order int NOT NULL DEFAULT 0
);
