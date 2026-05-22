import "server-only";

import { FEATURE_FLAGS, type FeatureFlagKey } from "@/features/feature-flags/flags";
import { getFeatureFlagFromDB } from "@/server/repositories/feature-flag-repository";

const dbCache = new Map<FeatureFlagKey, boolean | null>();

export async function isEnabled(key: FeatureFlagKey): Promise<boolean> {
  const override = readEnvOverride(key);

  if (override !== null) {
    return override;
  }

  const databaseValue = await getCachedDatabaseValue(key);

  if (databaseValue !== null) {
    return databaseValue;
  }

  return FEATURE_FLAGS[key].default;
}

export function clearFeatureFlagCacheForTests(): void {
  dbCache.clear();
}

function readEnvOverride(key: FeatureFlagKey): boolean | null {
  const overrideKey = `FF_${key.toUpperCase()}`;
  // Decision 4 defines dynamic FF_* escape hatches; these are intentionally
  // not enumerated in src/lib/env.ts because operators may add them per flag.
  const value = globalThis.process?.env?.[overrideKey];

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return null;
}

async function getCachedDatabaseValue(key: FeatureFlagKey): Promise<boolean | null> {
  if (dbCache.has(key)) {
    return dbCache.get(key) ?? null;
  }

  const value = await getFeatureFlagFromDB(key);
  dbCache.set(key, value);
  return value;
}
