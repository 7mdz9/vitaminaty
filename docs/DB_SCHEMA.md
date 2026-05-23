# DB_SCHEMA.md

**Project:** Vitaminaty
**Document version:** v1.0
**Owned by:** M1 (Data Layer milestone)
**Format:** SQL DDL with prose annotations
**Authoritative scope:** Every table, column, index, constraint, RLS policy, and seed insert needed for the production app.

---

## 1. Schema design principles (reminder)

Per `DECISION_CAPTURE.md` Decision 2 (Hybrid relational + JSONB):

- **Relational columns** for fields used in WHERE / ORDER BY / JOIN / INDEX / RLS / aggregate.
- **JSONB columns** for content payloads read together, never filtered.
- **Variants and images stay relational** (FKs, indexes, per-row mutations).
- **Goal tags as junction table** for OR-filtering.
- **Audit log append-only**, no UPDATE/DELETE policies.

All tables use UUIDv4 primary keys for unpredictability and decoupling from sequence counters.
All timestamps use `timestamptz` for unambiguous timezones.
All money is `integer` in whole AED (no fractional money).

---

## 2. Extensions

```sql
-- Run once at project init
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- for fuzzy search on product names
```

---

## 3. Enumerated types

```sql
CREATE TYPE product_status AS ENUM (
  'imported',
  'draft',
  'partial',
  'ready_to_publish',
  'published',
  'hidden',
  'archived'
);

CREATE TYPE product_form AS ENUM (
  'powder',
  'capsule',
  'tablet',
  'softgel',
  'gummies',
  'liquid',
  'rtd',
  'food'
);

CREATE TYPE goal_tag AS ENUM (
  'build_muscle',
  'boost_energy',
  'recovery',
  'weight_management',
  'endurance'
);

CREATE TYPE order_status AS ENUM (
  'pending_payment',
  'paid',
  'preparing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
  'failed'
);

CREATE TYPE payment_method AS ENUM (
  'card',
  'apple_pay',
  'tabby',
  'tamara',
  'cod'
);

CREATE TYPE payment_event_kind AS ENUM (
  'intent_created',
  'authorized',
  'captured',
  'failed',
  'refunded',
  'voided',
  'chargeback'
);

CREATE TYPE shipment_status AS ENUM (
  'created',
  'picked_up',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'delivery_failed',
  'returned',
  'cancelled'
);

CREATE TYPE image_kind AS ENUM (
  'front',
  'label_nutrition',
  'label_ingredients',
  'angle',
  'open',
  'lifestyle'
);

CREATE TYPE audit_action AS ENUM (
  'create',
  'update',
  'publish',
  'unpublish',
  'archive',
  'restore',
  'flag_toggle',
  'image_upload',
  'role_change'
);

-- Added in M1 addendum migration 0012 (inventory tracking). DDL lives in 0012,
-- documented here in §3 for catalog completeness. See INVENTORY_SPEC.md.
CREATE TYPE stock_status AS ENUM (
  'in_stock',
  'low_stock',
  'out_of_stock'
);

-- Added in M1 addendum migration 0012 (inventory tracking). DDL lives in 0012,
-- documented here in §3 for catalog completeness. See INVENTORY_SPEC.md §4.3.
CREATE TYPE inventory_movement_reason AS ENUM (
  'manual_adjustment',
  'order_placed',
  'order_cancelled',
  'payment_failed',
  'refund_returned',
  'stock_recount',
  'import_update'
);
```

---

## 4. Reference tables (seeded in M1)

### 4.1 `brands`

Canonical brand records. Seeded from the `CONTEXT_EXPANSION_NOTES.md` and `PRODUCT_CONTENT_SPEC_v1.1_ADMIN_DRIVEN.md` §12.2 normalization table.

```sql
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
```

### 4.2 `categories`

The 16 Plan v2 public categories. Seeded statically.

```sql
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
```

### 4.3 `md_category_mapping`

Maps the 15 MD source categories to the public taxonomy. Seeded from `PRODUCT_CONTENT_SPEC_v1.1_ADMIN_DRIVEN.md` §13.3. Used by the import script and by admin tooling.

```sql
CREATE TABLE md_category_mapping (
  md_category text PRIMARY KEY,
  default_public_category_slug text REFERENCES categories(slug),
  requires_split boolean NOT NULL DEFAULT false,
  split_hint text                                  -- prose hint for the admin doing the split
);
```

### 4.4 `goals`

The 5 Plan v2 goals. Static reference.

```sql
CREATE TABLE goals (
  tag goal_tag PRIMARY KEY,
  display_name text NOT NULL,
  description text,
  sort_order int NOT NULL DEFAULT 0
);
```

---

## 5. Catalog tables

### 5.1 `products`

The main product table per the hybrid design.

```sql
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
```

### 5.2 `product_variants`

Variants (flavor × size) per parent product.

```sql
CREATE TABLE product_variants (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  flavor text,
  size text NOT NULL,
  sku text UNIQUE,
  barcode text,
  price_aed int NOT NULL CHECK (price_aed > 0),
  -- in_stock boolean dropped in migration 0012; stock_status is now the source of truth.
  -- See INVENTORY_SPEC.md §3.6 for migration rationale.
  stock_quantity int CHECK (stock_quantity IS NULL OR stock_quantity >= 0),
  low_stock_threshold int NOT NULL DEFAULT 5,
  -- Added in migration 0012. Computed by the compute_stock_status() trigger; never written directly.
  -- See INVENTORY_SPEC.md §3.3.
  stock_status stock_status NOT NULL DEFAULT 'out_of_stock',
  weight_grams int CHECK (weight_grams IS NULL OR weight_grams > 0),
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id, flavor, size)
);

CREATE INDEX variants_product_idx ON product_variants(product_id);
CREATE INDEX variants_sku_idx ON product_variants(sku);

-- Rewritten in migration 0012: filter changed from `in_stock = true AND stock_quantity IS NOT NULL`
-- to `stock_status = 'low_stock'`. Drives admin /admin/queues/low-stock queue and dashboard widget.
CREATE INDEX variants_low_stock_idx
  ON product_variants(stock_quantity)
  WHERE stock_status = 'low_stock';

-- Added in migration 0012. Supports storefront (M3) and admin queue filtering on stock_status.
CREATE INDEX variants_stock_status_idx
  ON product_variants(stock_status);

CREATE TRIGGER variants_updated_at BEFORE UPDATE ON product_variants
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Added in migration 0012. Maintains stock_status from stock_quantity + low_stock_threshold.
-- Application code must NEVER write stock_status directly. See INVENTORY_SPEC.md §3.3.
CREATE OR REPLACE FUNCTION compute_stock_status()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.stock_quantity IS NULL OR NEW.stock_quantity <= 0 THEN
    NEW.stock_status := 'out_of_stock';
  ELSIF NEW.stock_quantity <= NEW.low_stock_threshold THEN
    NEW.stock_status := 'low_stock';
  ELSE
    NEW.stock_status := 'in_stock';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER variants_compute_stock_status
  BEFORE INSERT OR UPDATE OF stock_quantity, low_stock_threshold ON product_variants
  FOR EACH ROW EXECUTE FUNCTION compute_stock_status();
```

### 5.3 `product_images`

Images associated with products and (optionally) specific variants.

```sql
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
```

### 5.4 `product_goal_tags`

Junction table for product → goal assignments.

```sql
CREATE TABLE product_goal_tags (
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  goal goal_tag NOT NULL REFERENCES goals(tag),
  is_primary boolean NOT NULL DEFAULT false,
  PRIMARY KEY (product_id, goal)
);

CREATE INDEX goal_tags_goal_idx ON product_goal_tags(goal);
```

### 5.5 `slug_history`

Tracks slug changes for 301 redirects.

```sql
CREATE TABLE slug_history (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  old_slug text NOT NULL UNIQUE,
  new_slug text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX slug_history_old_idx ON slug_history(old_slug);
```

---

## 6. Customer & address tables

### 6.1 `customers`

Mirrors Supabase Auth's `auth.users` with our additional fields.

```sql
CREATE TABLE customers (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone_e164 text,                                 -- UAE format +9715XXXXXXXX
  email_verified_at timestamptz,
  marketing_opt_in boolean NOT NULL DEFAULT false,
  marketing_opt_in_at timestamptz,
  consent_version text NOT NULL DEFAULT 'v1',      -- bumps when policy text changes
  consent_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,                          -- soft delete for PDPL erasure
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX customers_phone_idx ON customers(phone_e164);
CREATE INDEX customers_deleted_idx ON customers(deleted_at) WHERE deleted_at IS NOT NULL;
```

### 6.2 `addresses`

Customer address book.

```sql
CREATE TABLE addresses (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  label text,                                       -- 'Home', 'Office', etc.
  recipient_name text NOT NULL,
  phone_e164 text NOT NULL,
  line1 text NOT NULL,
  line2 text,
  city text NOT NULL,
  emirate text NOT NULL,                            -- one of 7 UAE emirates
  country_code text NOT NULL DEFAULT 'AE',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX addresses_customer_idx ON addresses(customer_id);
CREATE UNIQUE INDEX addresses_one_default_per_customer 
  ON addresses(customer_id) WHERE is_default = true;
```

---

## 7. Order tables

### 7.1 `orders`

The order record. Created at checkout, mutated by payment and shipment events. Address and totals are frozen snapshots.

```sql
CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,  -- nullable for PDPL erasure
  
  -- Status
  status order_status NOT NULL DEFAULT 'pending_payment',
  
  -- Frozen address snapshot (denormalized; address can change later)
  ship_to jsonb NOT NULL,
  -- shape: { recipient_name, phone_e164, line1, line2, city, emirate, country_code }
  
  -- Frozen totals (computed server-side at checkout, never trust client)
  subtotal_aed int NOT NULL CHECK (subtotal_aed >= 0),
  shipping_cost_aed int NOT NULL DEFAULT 0 CHECK (shipping_cost_aed >= 0),
  vat_amount_aed int NOT NULL DEFAULT 0 CHECK (vat_amount_aed >= 0),
  total_aed int NOT NULL CHECK (total_aed >= 0),
  
  -- Payment
  payment_method payment_method NOT NULL,
  payment_provider text,                            -- 'paymob' | 'stub'
  payment_provider_order_id text,                   -- Paymob's order ID
  payment_provider_intent_id text,                  -- payment_key / intention client_secret
  
  -- Shipping
  shipping_method text NOT NULL,                    -- 'standard' | 'express'
  shipping_provider text,                           -- 'icarry' | 'stub' | 'manual'
  shipping_provider_shipment_id text,
  tracking_number text,
  tracking_url text,
  
  -- Idempotency
  idempotency_key text NOT NULL UNIQUE,
  
  -- Customer-facing reference (short, human-readable)
  reference text NOT NULL UNIQUE,                   -- e.g., 'VIT-2026-000123'
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz
);

CREATE INDEX orders_customer_idx ON orders(customer_id);
CREATE INDEX orders_status_idx ON orders(status);
CREATE INDEX orders_payment_intent_idx ON orders(payment_provider_intent_id);
CREATE INDEX orders_created_idx ON orders(created_at DESC);
CREATE INDEX orders_reference_idx ON orders(reference);

CREATE TRIGGER orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
```

### 7.2 `order_items`

Line items frozen at order creation.

```sql
CREATE TABLE order_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  variant_id uuid REFERENCES product_variants(id) ON DELETE SET NULL,
  
  -- Frozen at order time (in case product changes later)
  product_name text NOT NULL,
  variant_size text NOT NULL,
  variant_flavor text,
  unit_price_aed int NOT NULL CHECK (unit_price_aed >= 0),
  quantity int NOT NULL CHECK (quantity > 0),
  line_total_aed int NOT NULL CHECK (line_total_aed >= 0),
  
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX order_items_order_idx ON order_items(order_id);
CREATE INDEX order_items_product_idx ON order_items(product_id);
```

### 7.3 `payment_events`

Append-only payment ledger. Every Paymob webhook lands here before order state mutates.

```sql
CREATE TABLE payment_events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  kind payment_event_kind NOT NULL,
  provider text NOT NULL,                           -- 'paymob' | 'stub'
  provider_transaction_id text,
  provider_intent_id text,
  amount_aed int NOT NULL,                          -- can be negative for refunds
  currency text NOT NULL DEFAULT 'AED',
  raw_payload jsonb NOT NULL,                       -- full webhook body for forensic recovery
  signature_received text,                          -- HMAC as received (audit)
  occurred_at timestamptz NOT NULL,                 -- provider's timestamp
  recorded_at timestamptz NOT NULL DEFAULT now(),   -- our receive time
  
  -- Idempotency
  UNIQUE(provider, provider_transaction_id, kind)
);

CREATE INDEX payment_events_order_idx ON payment_events(order_id);
CREATE INDEX payment_events_recorded_idx ON payment_events(recorded_at DESC);

-- No UPDATE or DELETE policy — append-only.
```

### 7.4 `shipment_events`

Append-only shipment ledger. iCarry webhooks (or polled status updates) land here.

```sql
CREATE TABLE shipment_events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  status shipment_status NOT NULL,
  provider text NOT NULL,                           -- 'icarry' | 'stub' | 'manual'
  provider_shipment_id text,
  raw_payload jsonb,
  occurred_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX shipment_events_order_idx ON shipment_events(order_id);
CREATE INDEX shipment_events_recorded_idx ON shipment_events(recorded_at DESC);
```

---

## 8. Operational tables

### 8.1 `audit_log`

Append-only audit log for admin actions.

```sql
CREATE TABLE audit_log (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_user_id uuid REFERENCES auth.users(id),
  actor_email text,                                 -- snapshot in case user is deleted
  action audit_action NOT NULL,
  entity_type text NOT NULL,                        -- 'product' | 'brand' | 'order' | ...
  entity_id uuid,
  diff jsonb,                                       -- before/after, redacted for secrets
  ip text,
  user_agent text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_log_actor_idx ON audit_log(actor_user_id);
CREATE INDEX audit_log_entity_idx ON audit_log(entity_type, entity_id);
CREATE INDEX audit_log_occurred_idx ON audit_log(occurred_at DESC);

-- No UPDATE or DELETE policy — append-only.
```

### 8.2 `feature_flags`

Per `DECISION_CAPTURE.md` Decision 4.

```sql
CREATE TABLE feature_flags (
  key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  description text,
  category text,                                    -- 'surface' | 'feature' | 'operational'
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- Seeded with all flags from DECISION_CAPTURE.md §4 with default values.
```

### 8.3 `support_conversations` (M0 stub; real use post-MVP)

Created in M0 with the SupportChatProvider null implementation. No AI use in MVP.

```sql
CREATE TABLE support_conversations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  guest_session_id text,                            -- for anonymous chatters
  status text NOT NULL DEFAULT 'open',              -- 'open' | 'closed' | 'escalated'
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  CHECK (customer_id IS NOT NULL OR guest_session_id IS NOT NULL)
);

CREATE TABLE support_messages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id uuid NOT NULL REFERENCES support_conversations(id) ON DELETE CASCADE,
  sender text NOT NULL,                             -- 'customer' | 'system' | 'admin' | 'assistant'
  content text NOT NULL,
  context_refs jsonb,                                -- products/orders referenced (post-MVP)
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX support_messages_convo_idx ON support_messages(conversation_id);
```

### 8.4 `inventory_movements` (added in M1 addendum migration 0012)

Append-only ledger of every change to `product_variants.stock_quantity`. Architectural pattern matches `payment_events`, `shipment_events`, `audit_log` (append-only via service role; admin SELECT only; no UPDATE/DELETE policies). Full spec: `INVENTORY_SPEC.md §4`.

```sql
CREATE TABLE inventory_movements (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  previous_quantity int CHECK (previous_quantity IS NULL OR previous_quantity >= 0),
  new_quantity int NOT NULL CHECK (new_quantity >= 0),
  change_amount int NOT NULL,            -- signed: positive=increment, negative=decrement
  reason inventory_movement_reason NOT NULL,
  change_reason_note text,               -- optional freetext from admin
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  -- order_id is populated when reason ∈ {order_placed, order_cancelled, payment_failed, refund_returned}
  CONSTRAINT inventory_movements_change_consistency
    CHECK (change_amount = new_quantity - COALESCE(previous_quantity, 0)
        OR reason = 'stock_recount')
);

CREATE INDEX inventory_movements_variant_idx
  ON inventory_movements(variant_id, changed_at DESC);

CREATE INDEX inventory_movements_product_idx
  ON inventory_movements(product_id, changed_at DESC);

CREATE INDEX inventory_movements_order_idx
  ON inventory_movements(order_id)
  WHERE order_id IS NOT NULL;

CREATE INDEX inventory_movements_reason_idx
  ON inventory_movements(reason, changed_at DESC);
```

---

## 9. RLS policies

All tables that hold customer data or admin-only data have RLS enabled. Public reference data (categories, goals, brands directory) is readable by anyone; admin mutations are restricted.

### 9.1 Helper functions

```sql
CREATE OR REPLACE FUNCTION is_admin() RETURNS boolean AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
$$ LANGUAGE sql STABLE;
```

### 9.2 Products

```sql
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Public can read only published & visible products
CREATE POLICY products_public_read ON products
  FOR SELECT TO anon, authenticated
  USING (is_public_visible = true AND status = 'published');

-- Admin can read everything
CREATE POLICY products_admin_all ON products
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Wholesale price is never selectable by anon/customer
-- This is enforced at the application layer via repository queries
-- that explicitly exclude the column. Postgres RLS column-level security
-- is also configured:
REVOKE SELECT (wholesale_price_internal) ON products FROM anon, authenticated;
GRANT SELECT (wholesale_price_internal) ON products TO service_role;
```

Similar policies for `product_variants`, `product_images`, `product_goal_tags`, `slug_history` — public reads gated on parent product visibility; admin all-access.

### 9.3 Brands & categories

```sql
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY brands_public_read ON brands
  FOR SELECT TO anon, authenticated
  USING (is_visible_on_directory = true);

CREATE POLICY brands_admin_all ON brands
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Categories: similar pattern with is_visible
```

### 9.4 Customers & addresses

```sql
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY customers_self_read ON customers
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY customers_self_update ON customers
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY customers_admin_read ON customers
  FOR SELECT TO authenticated
  USING (is_admin());

-- No public read of customers.

ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY addresses_self_all ON addresses
  FOR ALL TO authenticated
  USING (customer_id = auth.uid())
  WITH CHECK (customer_id = auth.uid());

CREATE POLICY addresses_admin_read ON addresses
  FOR SELECT TO authenticated
  USING (is_admin());
```

### 9.5 Orders

```sql
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY orders_self_read ON orders
  FOR SELECT TO authenticated
  USING (customer_id = auth.uid());

CREATE POLICY orders_admin_all ON orders
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- order_items: same pattern, joined to order
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY order_items_self_read ON order_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM orders o WHERE o.id = order_items.order_id AND o.customer_id = auth.uid()
  ));

CREATE POLICY order_items_admin_all ON order_items
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());
```

### 9.6 Payment & shipment events

```sql
ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_events ENABLE ROW LEVEL SECURITY;

-- No SELECT for anon or authenticated (except admin)
CREATE POLICY payment_events_admin_read ON payment_events
  FOR SELECT TO authenticated
  USING (is_admin());

CREATE POLICY shipment_events_admin_read ON shipment_events
  FOR SELECT TO authenticated
  USING (is_admin());

-- INSERT only via service role (webhook handlers)
-- No UPDATE or DELETE policies — append-only by design.
```

### 9.7 Audit log

```sql
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_log_admin_read ON audit_log
  FOR SELECT TO authenticated
  USING (is_admin());

-- INSERT via service role only.
-- No UPDATE or DELETE policies.
```

### 9.8 Feature flags

```sql
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

-- All authenticated users (including customers) can read flags for client rendering
-- — but flags are read server-side only per architecture, so this is defensive.
CREATE POLICY feature_flags_read ON feature_flags
  FOR SELECT TO authenticated, anon
  USING (true);

CREATE POLICY feature_flags_admin_write ON feature_flags
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());
```

### 9.9 Support conversations

```sql
ALTER TABLE support_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;

-- Customer reads their own conversations
CREATE POLICY support_convo_self_read ON support_conversations
  FOR SELECT TO authenticated
  USING (customer_id = auth.uid());

-- Admin reads all
CREATE POLICY support_convo_admin_all ON support_conversations
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Messages follow conversation visibility
CREATE POLICY support_msg_via_convo ON support_messages
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM support_conversations c
    WHERE c.id = support_messages.conversation_id
    AND (c.customer_id = auth.uid() OR is_admin())
  ));
```

### 9.10 Inventory movements (added in M1 addendum migration 0012)

```sql
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY inventory_movements_admin_read ON inventory_movements
  FOR SELECT TO authenticated
  USING (is_admin());

-- INSERT via service role only.
-- No UPDATE or DELETE policies. Append-only ledger.
-- See INVENTORY_SPEC.md §4.4.
```

---

## 10. Migration sequence (M1)

Migrations are applied in numeric order. M1 ships these:

1. `0001_extensions_and_enums.sql` — extensions + ENUM types (core M1 enums only; the inventory enums `stock_status` and `inventory_movement_reason` are documented in §3 for catalog completeness but their CREATE TYPE DDL lives in the 0012 addendum below to keep that addendum self-contained).
2. `0002_reference_tables.sql` — brands, categories, md_category_mapping, goals
3. `0003_products.sql` — products + variants + images + goal_tags + slug_history
4. `0004_customers_addresses.sql`
5. `0005_orders.sql` — orders + order_items
6. `0006_events.sql` — payment_events + shipment_events
7. `0007_operations.sql` — audit_log + feature_flags
8. `0008_support_chat.sql` — support_conversations + support_messages
9. `0009_rls_policies.sql` — all RLS policies
10. `0010_seed.sql` — reference data: categories, goals, md_category_mapping, feature_flags defaults, initial admin user

**M1 Final Audit recovery addenda (shipped 2026-05-23):**

11. `0011_wholesale_revoke_writes.sql` — revokes INSERT/UPDATE/REFERENCES on `products.wholesale_price_internal` from `anon` and `authenticated` to close the defense-in-depth gap surfaced by the M1 Final Audit. See `LAST_SESSION.md` for the recovery context.

**M1 spec-evolution addendum (inventory tracking, planned):**

12. `0012_inventory.sql` — inventory tracking schema additions. Lands as a final M1 addendum step. Touches:
    - Adds `stock_status` and `inventory_movement_reason` enums (CREATE TYPE statements live here; the §3 reference above documents them at the catalog level but the DDL belongs in 0012 to keep the addendum self-contained).
    - Drops `product_variants.in_stock` boolean.
    - Adds `product_variants.stock_status stock_status NOT NULL DEFAULT 'out_of_stock'`.
    - Adds `compute_stock_status()` trigger function + `variants_compute_stock_status` trigger on INSERT/UPDATE of `stock_quantity` or `low_stock_threshold`.
    - Drops existing `variants_low_stock_idx`; recreates with `WHERE stock_status = 'low_stock'`.
    - Adds `variants_stock_status_idx` for storefront and admin queue filtering.
    - Creates `inventory_movements` table per §8.4.
    - Enables RLS on `inventory_movements` and adds admin-read policy per §9.10. No INSERT/UPDATE/DELETE policies (append-only via service role).
    - Backfills `missing_stock_quantity = true` on every existing product (787 imported rows from M1 Step 8). Implementation: UPDATE on `products.admin_review_flags` JSONB. See `PRODUCT_CONTENT_SPEC_v1.1_ADMIN_DRIVEN.md §5.4` for the 9-flag shape after this addendum.

Full inventory spec: `INVENTORY_SPEC.md`.

The `scripts/import-products-from-md.ts` runs after migrations to populate `products` from `docs/reference/product.md`.

---

## 11. Indexes summary

Critical indexes (re-stated for review):

| Index | Purpose |
|---|---|
| `products_public_listing_idx` | Public listing pages with category filter + sort |
| `products_review_flags_gin` | Admin filter views by review flags |
| `products_fields_status_gin` | Admin filter views by field status |
| `products_name_trgm` | Fuzzy search on product names (Phase 2 typo tolerance ready) |
| `variants_low_stock_idx` (rewritten in 0012) | Admin low-stock queue + dashboard widget; filters on `stock_status='low_stock'` |
| `variants_stock_status_idx` (added in 0012) | Storefront filtering by stock status (M3) + admin queue queries |
| `inventory_movements_variant_idx` (added in 0012) | Per-variant inventory history viewer (ADMIN_PORTAL §10.8) |
| `inventory_movements_product_idx` (added in 0012) | Per-product inventory history |
| `inventory_movements_order_idx` (added in 0012) | Find stock movements for a given order (M7 restoration audit trail) |
| `inventory_movements_reason_idx` (added in 0012) | Filtered movement log views by reason |
| `orders_customer_idx` | Customer order history |
| `orders_payment_intent_idx` | Webhook handler to find order by Paymob intent ID |
| `payment_events` unique constraint | Idempotency on webhook re-delivery |
| `audit_log_entity_idx` | Audit log viewer filtering by entity |

---

## 12. Backups & retention

- **Supabase daily backups** retained per Supabase plan (Pro plan: 7 days; Team: 14 days). Sufficient for MVP; upgrade pre-launch if business policy demands more.
- **Long-term backups** — manual `pg_dump` weekly to S3 (or Supabase Storage with separate credentials), retention 5+ years per `THREAT_MODEL.md` §5.10.
- **Retention** — see `THREAT_MODEL.md` §5.10 for the per-table retention policy (pending M8 legal review).

---

_End of `DB_SCHEMA.md` v1.0._
