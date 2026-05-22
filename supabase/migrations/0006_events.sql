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
