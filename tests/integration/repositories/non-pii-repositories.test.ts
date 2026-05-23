import { execFileSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/types.generated";

type LocalSupabaseEnv = {
  apiUrl: string;
  anonKey: string;
};

let anonClient: SupabaseClient<Database>;

beforeAll(() => {
  const localEnv = readLocalSupabaseEnv();
  anonClient = createClient<Database>(localEnv.apiUrl, localEnv.anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
});

describe("non-PII repositories", () => {
  it("reads seeded feature flag defaults from the local database", async () => {
    const { getFeatureFlag } = await import("@/server/repositories/feature-flag-repository");

    const flag = await getFeatureFlag("public_storefront_enabled", anonClient);

    expect(flag?.enabled).toBe(false);
  });

  it("returns no published products before the Step 8 product import", async () => {
    const { listPublishedProducts } = await import("@/server/repositories/product-repository");

    await expect(listPublishedProducts({}, {}, anonClient)).resolves.toEqual([]);
  });

  it("reads seeded reference data through public repository paths", async () => {
    const { listCategories, listMdCategoryMappings } =
      await import("@/server/repositories/category-repository");
    const { listGoals } = await import("@/server/repositories/goal-repository");

    await expect(listCategories(anonClient)).resolves.toHaveLength(16);
    await expect(listGoals(anonClient)).resolves.toHaveLength(5);
    await expect(listMdCategoryMappings(anonClient)).resolves.toHaveLength(15);
  });
});

function readLocalSupabaseEnv(): LocalSupabaseEnv {
  const pnpmExecutable = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const output = execFileSync(pnpmExecutable, ["exec", "supabase", "status", "-o", "env"], {
    encoding: "utf8",
    shell: process.platform === "win32",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const values = new Map<string, string>();

  output.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^([A-Z_]+)="?(.*?)"?$/);

    if (match) {
      values.set(match[1], match[2]);
    }
  });

  const apiUrl = values.get("API_URL");
  const anonKey = values.get("ANON_KEY");

  if (!apiUrl || !anonKey) {
    throw new Error("Local Supabase API_URL or ANON_KEY missing from `supabase status -o env`.");
  }

  return { apiUrl, anonKey };
}
