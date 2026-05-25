import "server-only";

import { readFile } from "node:fs/promises";
import { requireAdmin } from "@/lib/auth/policies";
import { FEATURE_FLAGS, type FeatureFlagKey } from "@/features/feature-flags/flags";
import {
  getHighRigorFeatureFlagGate,
  hasHighRigorSignoff,
  type HighRigorFeatureFlagGate,
} from "@/features/feature-flags/gates";
import { listAuthUserEmailsByIds } from "@/server/repositories/admin-repository";
import { listFeatureFlags } from "@/server/repositories/feature-flag-repository";

export type AdminFeatureFlagRow = Readonly<{
  key: FeatureFlagKey;
  description: string;
  category: "surface" | "feature" | "operational";
  enabled: boolean;
  updatedAt: string;
  updatedBy: string | null;
  updatedByEmail: string | null;
  gate: HighRigorFeatureFlagGate | null;
  isLocked: boolean;
}>;

const CATEGORY_ORDER = {
  surface: 0,
  feature: 1,
  operational: 2,
} as const;

export async function getFeatureFlagSettings(): Promise<AdminFeatureFlagRow[]> {
  await requireAdmin();

  const [rows, lastSessionText] = await Promise.all([listFeatureFlags(), readLastSessionText()]);
  const byKey = new Map(rows.map((row) => [row.key, row]));
  const users = await listAuthUserEmailsByIds(
    rows.flatMap((row) => (row.updated_by ? [row.updated_by] : [])),
  );
  const emailById = new Map(users.map((user) => [user.id, user.email]));

  return (Object.keys(FEATURE_FLAGS) as FeatureFlagKey[])
    .map((key) => {
      const definition = FEATURE_FLAGS[key];
      const row = byKey.get(key);
      const gate = getHighRigorFeatureFlagGate(key);

      return {
        key,
        description: row?.description ?? definition.description,
        category: definition.category,
        enabled: row?.enabled ?? definition.default,
        updatedAt: row?.updated_at ?? new Date(0).toISOString(),
        updatedBy: row?.updated_by ?? null,
        updatedByEmail: row?.updated_by ? (emailById.get(row.updated_by) ?? null) : null,
        gate,
        isLocked: gate ? !hasHighRigorSignoff(gate, lastSessionText) : false,
      };
    })
    .sort((left, right) => {
      const byCategory = CATEGORY_ORDER[left.category] - CATEGORY_ORDER[right.category];
      return byCategory || left.key.localeCompare(right.key);
    });
}

async function readLastSessionText(): Promise<string> {
  try {
    return await readFile("docs/LAST_SESSION.md", "utf8");
  } catch {
    return "";
  }
}
