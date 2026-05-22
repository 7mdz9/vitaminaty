/**
 * Authz model: anon key, RLS-enforced, safe for Client Components. Any data
 * access through this client must rely on Supabase RLS policies and the user's
 * authenticated session.
 */
import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env.public";

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
