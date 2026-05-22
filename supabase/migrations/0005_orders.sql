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
