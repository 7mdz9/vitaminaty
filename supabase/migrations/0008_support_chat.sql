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
