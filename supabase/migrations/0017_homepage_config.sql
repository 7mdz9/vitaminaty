CREATE TABLE homepage_configs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  singleton_key text NOT NULL DEFAULT 'homepage',
  hero_title text NOT NULL DEFAULT 'Vitaminaty',
  hero_subtitle text NOT NULL DEFAULT 'Sports nutrition, vitamins, wellness, and healthy food in the UAE.',
  hero_cta_label text NOT NULL DEFAULT 'Shop products',
  hero_cta_href text NOT NULL DEFAULT '/products',
  promo_banner_text text,
  promo_banner_href text,
  promo_starts_at timestamptz,
  promo_ends_at timestamptz,
  new_arrival_product_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  bestseller_product_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  featured_brand_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  goal_order goal_tag[] NOT NULL DEFAULT ARRAY[
    'build_muscle',
    'boost_energy',
    'recovery',
    'weight_management',
    'endurance'
  ]::goal_tag[],
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT homepage_configs_singleton_key_check CHECK (singleton_key = 'homepage'),
  CONSTRAINT homepage_configs_singleton_key_unique UNIQUE (singleton_key),
  CONSTRAINT homepage_configs_new_arrivals_limit CHECK (cardinality(new_arrival_product_ids) <= 4),
  CONSTRAINT homepage_configs_bestsellers_limit CHECK (cardinality(bestseller_product_ids) <= 4),
  CONSTRAINT homepage_configs_featured_brands_limit CHECK (cardinality(featured_brand_ids) <= 2),
  CONSTRAINT homepage_configs_goal_order_limit CHECK (cardinality(goal_order) <= 5),
  CONSTRAINT homepage_configs_promo_window_check CHECK (
    promo_starts_at IS NULL
    OR promo_ends_at IS NULL
    OR promo_ends_at > promo_starts_at
  )
);

CREATE TRIGGER homepage_configs_touch_updated_at
  BEFORE UPDATE ON homepage_configs
  FOR EACH ROW
  EXECUTE FUNCTION touch_updated_at();

ALTER TABLE homepage_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY homepage_configs_public_read ON homepage_configs
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY homepage_configs_admin_all ON homepage_configs
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

INSERT INTO homepage_configs (singleton_key)
VALUES ('homepage')
ON CONFLICT (singleton_key) DO NOTHING;
