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
