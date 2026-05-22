CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Identity & display
  slug text NOT NULL UNIQUE,
  name text NOT NULL,                              -- normalized display name
  name_raw text NOT NULL,                          -- exact Excel name preserved

  -- Taxonomy (relational FKs for joins/RLS)
  brand_id uuid REFERENCES brands(id) ON DELETE SET NULL,
  brand_raw text,                                  -- preserved raw spelling
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  source_category text,                            -- one of 15 MD categories
  form product_form,

  -- Source traceability
  source_file text NOT NULL DEFAULT 'product.md',
  source_row int[] NOT NULL DEFAULT '{}',
  source_notes text,

  -- Pricing (whole AED integers)
  retail_price_aed int CHECK (retail_price_aed IS NULL OR retail_price_aed > 0),
  wholesale_price_internal int CHECK (wholesale_price_internal IS NULL OR wholesale_price_internal > 0),
  compare_at_price_aed int CHECK (compare_at_price_aed IS NULL OR compare_at_price_aed > retail_price_aed),

  -- Status & visibility
  status product_status NOT NULL DEFAULT 'imported',
  is_public_visible boolean NOT NULL DEFAULT false,
  is_add_to_cart_enabled boolean NOT NULL DEFAULT false,
  is_checkout_enabled boolean NOT NULL DEFAULT false,
  completion_score int NOT NULL DEFAULT 0 CHECK (completion_score BETWEEN 0 AND 100),
  featured_score int NOT NULL DEFAULT 0,

  -- Flexible content (JSONB)
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- shape: { description, benefits[], directions_of_use, storage_instructions,
  --          warnings, seo_title, seo_description, often_bought_with_ids[],
  --          manufacturer_country, authorized_distributor_note }

  label_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- shape: { nutrition_panel, ingredients, allergens[],
  --          manufacturing_facility_warnings, serving_size,
  --          servings_per_container }

  fields_status jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- shape per v1.1 §5.1

  admin_review_flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- shape per v1.1 §5.4

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);

-- Indexes
CREATE INDEX products_slug_idx ON products(slug);
CREATE INDEX products_brand_idx ON products(brand_id);
CREATE INDEX products_category_idx ON products(category_id);
CREATE INDEX products_visible_idx ON products(is_public_visible) WHERE is_public_visible = true;
CREATE INDEX products_status_idx ON products(status);
CREATE INDEX products_public_listing_idx 
  ON products(category_id, is_public_visible, featured_score DESC, published_at DESC)
  WHERE is_public_visible = true;
CREATE INDEX products_review_flags_gin ON products USING gin(admin_review_flags);
CREATE INDEX products_fields_status_gin ON products USING gin(fields_status);
CREATE INDEX products_name_trgm ON products USING gin(name gin_trgm_ops);

-- Triggers
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TABLE product_variants (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  flavor text,
  size text NOT NULL,
  sku text UNIQUE,
  barcode text,
  price_aed int NOT NULL CHECK (price_aed > 0),
  in_stock boolean NOT NULL DEFAULT true,
  stock_quantity int CHECK (stock_quantity IS NULL OR stock_quantity >= 0),
  low_stock_threshold int NOT NULL DEFAULT 5,
  weight_grams int CHECK (weight_grams IS NULL OR weight_grams > 0),
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id, flavor, size)
);

CREATE INDEX variants_product_idx ON product_variants(product_id);
CREATE INDEX variants_sku_idx ON product_variants(sku);
CREATE INDEX variants_low_stock_idx 
  ON product_variants(stock_quantity)
  WHERE in_stock = true AND stock_quantity IS NOT NULL;

CREATE TRIGGER variants_updated_at BEFORE UPDATE ON product_variants
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TABLE product_images (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES product_variants(id) ON DELETE SET NULL,
  storage_path text NOT NULL,                      -- Supabase Storage path
  public_url text NOT NULL,                        -- CDN URL
  alt_text text,
  kind image_kind NOT NULL DEFAULT 'front',
  sort_order int NOT NULL DEFAULT 0,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX images_product_idx ON product_images(product_id);
CREATE INDEX images_primary_idx ON product_images(product_id) WHERE is_primary = true;

-- A product can have at most one primary image
CREATE UNIQUE INDEX images_one_primary_per_product 
  ON product_images(product_id) WHERE is_primary = true;

CREATE TABLE product_goal_tags (
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  goal goal_tag NOT NULL REFERENCES goals(tag),
  is_primary boolean NOT NULL DEFAULT false,
  PRIMARY KEY (product_id, goal)
);

CREATE INDEX goal_tags_goal_idx ON product_goal_tags(goal);

CREATE TABLE slug_history (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  old_slug text NOT NULL UNIQUE,
  new_slug text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX slug_history_old_idx ON slug_history(old_slug);
