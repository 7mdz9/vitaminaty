-- Run once at project init
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- for fuzzy search on product names

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
