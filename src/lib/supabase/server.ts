/**
 * Authz model: service role, bypasses RLS, MUST only be invoked from
 * src/server/repositories/. This module is blocked from app, component, and
 * feature imports by ESLint because it can read and mutate all database rows.
 */
import "server-only";

import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

export const supabaseAdmin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);
