-- Default feature flag values per DECISION_CAPTURE.md Decision 4.
-- M0 Step 6 prepares this seed file only. Do not apply until M1.

INSERT INTO feature_flags (key, enabled, description, category) VALUES
  ('public_storefront_enabled', false, 'Gate the public storefront until M3 sign-off.', 'surface'),
  ('admin_portal_enabled', true, 'Gate the admin portal surface.', 'surface'),
  ('commerce_enabled', false, 'Gate commerce paths until M5 payment sign-off.', 'surface'),
  ('customer_signup_enabled', false, 'Gate customer self-signup.', 'surface'),
  ('support_chat_enabled', false, 'Gate the support chat placeholder bubble.', 'surface'),
  ('cart_visible', false, 'Gate cart visibility.', 'feature'),
  ('checkout_enabled', false, 'Gate checkout entry points.', 'feature'),
  ('paymob_live_mode', false, 'Gate live Paymob processing.', 'feature'),
  ('icarry_live_mode', false, 'Gate live iCarry processing.', 'feature'),
  ('transactional_emails_enabled', false, 'Gate transactional email sends.', 'feature'),
  ('notify_me_enabled', false, 'Gate notify-me flows.', 'feature'),
  ('reviews_enabled', false, 'Gate reviews.', 'feature'),
  ('promo_codes_enabled', false, 'Gate promo codes.', 'feature'),
  ('wishlist_enabled', false, 'Gate wishlist.', 'feature'),
  ('arabic_rtl_enabled', false, 'Gate Arabic RTL surfaces.', 'feature'),
  ('same_day_delivery_enabled', false, 'Gate same-day delivery.', 'feature'),
  ('customer_mfa_enabled', false, 'Gate customer MFA.', 'feature'),
  ('maintenance_mode', false, 'Incident-only maintenance mode.', 'operational'),
  ('read_only_mode', false, 'Incident-only read-only mode.', 'operational'),
  ('feature_flag_admin_ui', true, 'Gate the admin feature-flag UI.', 'operational')
ON CONFLICT (key) DO UPDATE SET
  enabled = EXCLUDED.enabled,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  updated_at = now();
