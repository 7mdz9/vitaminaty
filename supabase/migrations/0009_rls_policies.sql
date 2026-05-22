CREATE OR REPLACE FUNCTION is_admin() RETURNS boolean AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
$$ LANGUAGE sql STABLE;

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_goal_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE slug_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE md_category_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;

-- Public can read only published & visible products
CREATE POLICY products_public_read ON products
  FOR SELECT TO anon, authenticated
  USING (is_public_visible = true AND status = 'published');

-- Admin can read everything
CREATE POLICY products_admin_all ON products
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY product_variants_public_read ON product_variants
  FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM products p
    WHERE p.id = product_variants.product_id
    AND p.is_public_visible = true
    AND p.status = 'published'
  ));

CREATE POLICY product_variants_admin_all ON product_variants
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY product_images_public_read ON product_images
  FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM products p
    WHERE p.id = product_images.product_id
    AND p.is_public_visible = true
    AND p.status = 'published'
  ));

CREATE POLICY product_images_admin_all ON product_images
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY product_goal_tags_public_read ON product_goal_tags
  FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM products p
    WHERE p.id = product_goal_tags.product_id
    AND p.is_public_visible = true
    AND p.status = 'published'
  ));

CREATE POLICY product_goal_tags_admin_all ON product_goal_tags
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY slug_history_public_read ON slug_history
  FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM products p
    WHERE p.id = slug_history.product_id
    AND p.is_public_visible = true
    AND p.status = 'published'
  ));

CREATE POLICY slug_history_admin_all ON slug_history
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY brands_public_read ON brands
  FOR SELECT TO anon, authenticated
  USING (is_visible_on_directory = true);

CREATE POLICY brands_admin_all ON brands
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY categories_public_read ON categories
  FOR SELECT TO anon, authenticated
  USING (is_visible = true);

CREATE POLICY categories_admin_all ON categories
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY goals_public_read ON goals
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY goals_admin_all ON goals
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY md_category_mapping_public_read ON md_category_mapping
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY md_category_mapping_admin_all ON md_category_mapping
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

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

CREATE POLICY addresses_self_all ON addresses
  FOR ALL TO authenticated
  USING (customer_id = auth.uid())
  WITH CHECK (customer_id = auth.uid());

CREATE POLICY addresses_admin_read ON addresses
  FOR SELECT TO authenticated
  USING (is_admin());

CREATE POLICY orders_self_read ON orders
  FOR SELECT TO authenticated
  USING (customer_id = auth.uid());

CREATE POLICY orders_admin_all ON orders
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- order_items: same pattern, joined to order
CREATE POLICY order_items_self_read ON order_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM orders o WHERE o.id = order_items.order_id AND o.customer_id = auth.uid()
  ));

CREATE POLICY order_items_admin_all ON order_items
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- No SELECT for anon or authenticated (except admin)
CREATE POLICY payment_events_admin_read ON payment_events
  FOR SELECT TO authenticated
  USING (is_admin());

CREATE POLICY shipment_events_admin_read ON shipment_events
  FOR SELECT TO authenticated
  USING (is_admin());

-- INSERT only via service role (webhook handlers)
-- No UPDATE or DELETE policies -- append-only by design.

CREATE POLICY audit_log_admin_read ON audit_log
  FOR SELECT TO authenticated
  USING (is_admin());

-- INSERT via service role only.
-- No UPDATE or DELETE policies.

-- All authenticated users (including customers) can read flags for client rendering
-- -- but flags are read server-side only per architecture, so this is defensive.
CREATE POLICY feature_flags_read ON feature_flags
  FOR SELECT TO authenticated, anon
  USING (true);

CREATE POLICY feature_flags_admin_write ON feature_flags
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

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

-- Wholesale price is never selectable by anon/customer
-- This is enforced at the application layer via repository queries
-- that explicitly exclude the column. Postgres RLS column-level security
-- is also configured:
REVOKE SELECT ON products FROM anon, authenticated;
GRANT SELECT (
  id,
  slug,
  name,
  name_raw,
  brand_id,
  brand_raw,
  category_id,
  source_category,
  form,
  source_file,
  source_row,
  source_notes,
  retail_price_aed,
  compare_at_price_aed,
  status,
  is_public_visible,
  is_add_to_cart_enabled,
  is_checkout_enabled,
  completion_score,
  featured_score,
  content,
  label_data,
  fields_status,
  admin_review_flags,
  created_at,
  updated_at,
  published_at
) ON products TO anon, authenticated;
REVOKE SELECT (wholesale_price_internal) ON products FROM anon, authenticated;
GRANT SELECT (wholesale_price_internal) ON products TO service_role;
