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

CREATE TABLE feature_flags (
  key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  description text,
  category text,                                    -- 'surface' | 'feature' | 'operational'
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- Seeded with all flags from DECISION_CAPTURE.md §4 with default values.
