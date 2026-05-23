CREATE TYPE stock_status AS ENUM ('in_stock', 'low_stock', 'out_of_stock');

CREATE TYPE inventory_movement_reason AS ENUM (
  'manual_adjustment',
  'order_placed',
  'order_cancelled',
  'payment_failed',
  'refund_returned',
  'stock_recount',
  'import_update'
);

ALTER TABLE product_variants
  ADD COLUMN stock_status stock_status NOT NULL DEFAULT 'out_of_stock';

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

UPDATE product_variants SET stock_quantity = stock_quantity;

DROP INDEX IF EXISTS variants_low_stock_idx;

CREATE INDEX variants_low_stock_idx
  ON product_variants(stock_quantity)
  WHERE stock_status = 'low_stock';

CREATE INDEX variants_stock_status_idx
  ON product_variants(stock_status);

ALTER TABLE product_variants
  DROP COLUMN in_stock;

CREATE TABLE inventory_movements (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  previous_quantity int CHECK (previous_quantity IS NULL OR previous_quantity >= 0),
  new_quantity int NOT NULL CHECK (new_quantity >= 0),
  change_amount int NOT NULL,  -- signed; positive=increment, negative=decrement
  reason inventory_movement_reason NOT NULL,
  change_reason_note text,  -- optional freetext, e.g. "3 units damaged in storage"
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  -- order_id is set when reason ∈ {order_placed, order_cancelled, payment_failed, refund_returned}
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

ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY inventory_movements_admin_read ON inventory_movements
  FOR SELECT TO authenticated
  USING (is_admin());

-- No INSERT/UPDATE/DELETE policies. Service-role bypasses RLS for writes
-- (admin inventory adjustments, checkout decrement, restoration flows all
-- run through src/server/repositories/inventory-movement-repository.ts
-- with the service-role client).
