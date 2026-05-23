-- Reference seed data for M1.
-- Feature flag rows are inlined from supabase/seed/feature-flags.sql.

INSERT INTO categories (name, slug, parent_nav, sort_order) VALUES
  ('Proteins', 'proteins', 'Sport Nutrition', 10),
  ('Mass Gainers', 'mass-gainers', 'Sport Nutrition', 20),
  ('Pre-Workouts', 'preworkouts', 'Sport Nutrition', 30),
  ('Creatine', 'creatine', 'Sport Nutrition', 40),
  ('Amino Acids', 'amino-acids', 'Sport Nutrition', 50),
  ('Performance Enhancers', 'performance-enhancers', 'Sport Nutrition', 60),
  ('Post-Workout Recovery', 'postworkout-recovery', 'Sport Nutrition', 70),
  ('Weight Management', 'weight-management', 'Sport Nutrition', 80),
  ('Vitamins & Minerals', 'vitamins-minerals', 'Health & Wellness', 90),
  ('Wellness & Daily Health', 'wellness-daily-health', 'Health & Wellness', 100),
  ('Immunity Support', 'immunity-support', 'Health & Wellness', 110),
  ('Hormonal & Anti-Aging Support', 'hormonal-antiaging-support', 'Health & Wellness', 120),
  ('Specialized Health', 'specialized-health', 'Health & Wellness', 130),
  ('Healthy Snacks', 'healthy-snacks', 'Snacks & Drinks', 140),
  ('Protein Bars', 'protein-bars', 'Snacks & Drinks', 150),
  ('Functional Drinks', 'functional-drinks', 'Snacks & Drinks', 160)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  parent_nav = EXCLUDED.parent_nav,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO goals (tag, display_name, description, sort_order) VALUES
  ('build_muscle', 'Build Muscle', 'Higher protein, creatine, mass gainers, recovery', 10),
  ('boost_energy', 'Boost Energy', 'Pre-workouts, caffeine, energy drinks, B-vitamins', 20),
  ('recovery', 'Recovery', 'BCAAs, EAAs, post-workout, glutamine, joint support', 30),
  ('weight_management', 'Weight Management', 'Fat burners, low-cal proteins, appetite control', 40),
  ('endurance', 'Endurance', 'Carbs, electrolytes, beta-alanine, cardio support', 50)
ON CONFLICT (tag) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order;

INSERT INTO md_category_mapping (md_category, default_public_category_slug, requires_split, split_hint) VALUES
  ('Proteins & Mass Gainers', 'proteins', true, 'Import script auto-splits; admin reviews'),
  ('Pre Workout / Pre-Workout', 'preworkouts', false, NULL),
  ('Creatine', 'creatine', false, NULL),
  ('Amino Acids / BCAAs / EAAs', 'amino-acids', false, NULL),
  ('Test Boosters', 'hormonal-antiaging-support', false, NULL),
  ('Fat Burners / Weight Loss', 'weight-management', false, NULL),
  ('Recovery', 'postworkout-recovery', false, NULL),
  ('Vitamins', 'vitamins-minerals', false, NULL),
  ('Daily Health / Wellness', 'wellness-daily-health', false, NULL),
  ('Immunity', 'immunity-support', false, NULL),
  ('Anti-Aging / Hormones', 'hormonal-antiaging-support', false, NULL),
  ('Specialized / Other Health', 'specialized-health', false, NULL),
  ('Snacks', 'healthy-snacks', true, NULL),
  ('Drinks / Beverages', 'functional-drinks', false, NULL),
  ('Uncategorized / Misc', NULL, true, '~36 products land here; admin assigns manually')
ON CONFLICT (md_category) DO UPDATE SET
  default_public_category_slug = EXCLUDED.default_public_category_slug,
  requires_split = EXCLUDED.requires_split,
  split_hint = EXCLUDED.split_hint;

INSERT INTO brands (display_name, slug, aliases) VALUES
  ('Applied Nutrition', 'applied-nutrition', '{"APPLED NUTRITION","AN","APPLIED NUTRITION"}'),
  ('Athletic Nutrition', 'athletic-nutrition', '{"ATHLETIC NUTRITION","AN ATHLETIC"}'),
  ('Big and Fit', 'big-and-fit', '{"BIG AND FIT","BIG & FIT","B&F"}'),
  ('BiotechUSA', 'biotech-usa', '{"BIOTECH USA","BIOTECHUSA","BIO TECH USA"}'),
  ('BPI Sports', 'bpi-sports', '{"BPI","BPI SPORTS"}'),
  ('BSN', 'bsn', '{"BSN"}'),
  ('Cellucor', 'cellucor', '{"CELLUCOR","C4"}'),
  ('Dymatize', 'dymatize', '{"DYMATIZE","DYMA"}'),
  ('EAS', 'eas', '{"EAS"}'),
  ('Evogen', 'evogen', '{"EVOGEN"}'),
  ('Gaspari Nutrition', 'gaspari-nutrition', '{"GASPARI","GASPARI NUTRITION"}'),
  ('GAT Sport', 'gat-sport', '{"GAT","GAT SPORT"}'),
  ('Hi-Tech Pharmaceuticals', 'hi-tech-pharmaceuticals', '{"HI-TECH","HITECH","HI TECH PHARMA"}'),
  ('Hydroxycut', 'hydroxycut', '{"HYDROXYCUT","MUSCLETECH HYDROXYCUT"}'),
  ('Insane Labz', 'insane-labz', '{"INSANE LABZ","INSANE"}'),
  ('iSatori', 'isatori', '{"ISATORI"}'),
  ('Kevin Levrone', 'kevin-levrone', '{"KEVIN LEVRONE","LEVRONE"}'),
  ('MHP', 'mhp', '{"MHP"}'),
  ('MuscleMeds', 'musclemeds', '{"MUSCLE MEDS","MUSCLEMEDS"}'),
  ('MuscleTech', 'muscletech', '{"MUSCLETECH","MUSCLE TECH"}'),
  ('Mutant', 'mutant', '{"MUTANT"}'),
  ('Nutrex', 'nutrex', '{"NUTREX","NUTREX RESEARCH"}'),
  ('Optimum Nutrition', 'optimum-nutrition', '{"OPTIMUM NUTRITION","ON","OPTIMUM"}'),
  ('QNT', 'qnt', '{"QNT"}'),
  ('Redcon1', 'redcon1', '{"REDCON1","REDCON 1","RED CON 1"}'),
  ('Rule 1 Proteins', 'rule-1-proteins', '{"RULE 1","R1","RULE ONE"}'),
  ('Scitec Nutrition', 'scitec-nutrition', '{"SCITEC","SCITEC NUTRITION"}'),
  ('SuperHuman', 'superhuman', '{"SUPERHUMAN","SUPER HUMAN"}'),
  ('Universal Nutrition', 'universal-nutrition', '{"UNIVERSAL","UNIVERSAL NUTRITION"}'),
  ('USPlabs', 'usplabs', '{"USPLABS","USP LABS"}')
ON CONFLICT (slug) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  aliases = EXCLUDED.aliases,
  updated_at = now();

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
