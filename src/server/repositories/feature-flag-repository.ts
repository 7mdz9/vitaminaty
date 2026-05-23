import "server-only";

import { supabaseAdmin } from "@/server/db/supabase-admin";
import { createSupabaseServerClient } from "@/server/db/supabase-server";
import type { Database } from "@/lib/supabase/types.generated";
import type { FeatureFlagKey } from "@/features/feature-flags/flags";
import type { FeatureFlagRecord } from "@/types/feature-flag";

type PublicClient = Pick<Awaited<ReturnType<typeof createSupabaseServerClient>>, "from">;
type FeatureFlagRow = Database["public"]["Tables"]["feature_flags"]["Row"];
type FeatureFlagUpdate = Database["public"]["Tables"]["feature_flags"]["Update"];

const FEATURE_FLAG_COLUMNS = "key, enabled, description, category, updated_at, updated_by";

export async function getFeatureFlag(
  key: FeatureFlagKey,
  client?: PublicClient,
): Promise<FeatureFlagRecord | null> {
  const supabase = await resolvePublicClient(client);
  const { data, error } = await supabase
    .from("feature_flags")
    .select(FEATURE_FLAG_COLUMNS)
    .eq("key", key)
    .maybeSingle();

  if (error) {
    throw new Error(`Feature flag query failed: ${error.message}`);
  }

  return data ? mapFeatureFlag(data as unknown as FeatureFlagRow) : null;
}

export async function getFeatureFlagFromDB(
  key: FeatureFlagKey,
  client?: PublicClient,
): Promise<boolean | null> {
  const row = await getFeatureFlag(key, client);
  return row?.enabled ?? null;
}

export async function listFeatureFlags(client?: PublicClient): Promise<FeatureFlagRecord[]> {
  const supabase = await resolvePublicClient(client);
  const { data, error } = await supabase
    .from("feature_flags")
    .select(FEATURE_FLAG_COLUMNS)
    .order("category", { ascending: true })
    .order("key", { ascending: true });

  if (error) {
    throw new Error(`Feature flags query failed: ${error.message}`);
  }

  return (data as unknown as FeatureFlagRow[]).map(mapFeatureFlag);
}

export async function updateFeatureFlagForAdmin(
  key: FeatureFlagKey,
  patch: FeatureFlagUpdate,
): Promise<FeatureFlagRecord> {
  const { data, error } = await supabaseAdmin
    .from("feature_flags")
    .update(patch)
    .eq("key", key)
    .select(FEATURE_FLAG_COLUMNS)
    .single();

  if (error) {
    throw new Error(`Feature flag update failed: ${error.message}`);
  }

  return mapFeatureFlag(data as unknown as FeatureFlagRow);
}

async function resolvePublicClient(client?: PublicClient): Promise<PublicClient> {
  return client ?? createSupabaseServerClient();
}

function mapFeatureFlag(row: FeatureFlagRow): FeatureFlagRecord {
  return row;
}
