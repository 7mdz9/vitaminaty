import "server-only";

/**
 * M0 note: the feature_flags migration is prepared but not applied until M1.
 * This repository is the locked DB access point for feature flags, but it
 * intentionally returns null in M0 so eval.ts can fall through to Decision 4
 * defaults without making network calls during builds. M1 replaces this body
 * with the Supabase read once the migration is applied.
 */
export async function getFeatureFlagFromDB(key: string): Promise<boolean | null> {
  void key;
  return null;
}
