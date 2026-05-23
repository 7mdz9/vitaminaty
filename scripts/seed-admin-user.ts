import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createClient, type User } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "../src/lib/supabase/types.generated";

type LocalSupabaseEnv = {
  apiUrl: string;
  serviceRoleKey: string;
};

type SeedAdminEnv = {
  email: string;
  password: string;
};

const seedAdminEmailKey = ["SEED", "ADMIN", "EMAIL"].join("_");
const seedAdminPasswordKey = ["SEED", "ADMIN", "PASSWORD"].join("_");
const adminRole = "admin";
const minPasswordLength = 32;

const seedAdminEnvSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(minPasswordLength, "Must be at least 32 characters"),
});

function log(event: string, data: Record<string, unknown> = {}): void {
  process.stdout.write(`${JSON.stringify({ event, ...data })}\n`);
}

async function main(): Promise<void> {
  const seedEnv = readSeedAdminEnv();
  const localEnv = loadLocalSupabaseEnv();
  const emailHash = hashValue(seedEnv.email.toLowerCase());
  const supabase = createClient<Database>(localEnv.apiUrl, localEnv.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const existingUser = await findUserByEmail(supabase, seedEnv.email);
  const user = existingUser ?? (await createAdminUser(supabase, seedEnv));
  const roleUpdated = await ensureAdminRole(supabase, user);

  log("seed-admin-user.completed", {
    email_hash: emailHash,
    user_id: user.id,
    role: adminRole,
    created: !existingUser,
    role_updated: roleUpdated,
  });
}

function readSeedAdminEnv(input: Record<string, string | undefined> = globalThis.process.env): SeedAdminEnv {
  const parsed = seedAdminEnvSchema.safeParse({
    email: input[seedAdminEmailKey],
    password: input[seedAdminPasswordKey],
  });

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Seed admin env validation failed: ${details}`);
  }

  return parsed.data;
}

function loadLocalSupabaseEnv(): LocalSupabaseEnv {
  const output =
    globalThis.process.platform === "win32"
      ? execFileSync("cmd.exe", ["/d", "/s", "/c", "pnpm exec supabase status -o env"], {
          cwd: globalThis.process.cwd(),
        }).toString("utf8")
      : execFileSync("pnpm", ["exec", "supabase", "status", "-o", "env"], {
          cwd: globalThis.process.cwd(),
        }).toString("utf8");

  const values = new Map<string, string>();

  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)="(.*)"$/);

    if (match) {
      values.set(match[1], match[2]);
    }
  }

  const apiUrl = requireLocalStatusValue(values, "API_URL");

  if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(apiUrl)) {
    throw new Error(`Refusing to seed admin against non-local Supabase API URL: ${apiUrl}`);
  }

  return {
    apiUrl,
    serviceRoleKey: requireLocalStatusValue(values, "SERVICE_ROLE_KEY"),
  };
}

function requireLocalStatusValue(values: Map<string, string>, key: string): string {
  const value = values.get(key);

  if (!value) {
    throw new Error(`Missing ${key} from local Supabase status output.`);
  }

  return value;
}

async function findUserByEmail(
  supabase: ReturnType<typeof createClient<Database>>,
  email: string,
): Promise<User | null> {
  const emailLower = email.toLowerCase();
  const perPage = 1000;
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });

    if (error) {
      throw new Error(`Admin user lookup failed: ${error.message}`);
    }

    const match = data.users.find((user) => user.email?.toLowerCase() === emailLower);

    if (match) {
      return match;
    }

    if (data.users.length < perPage) {
      return null;
    }

    page += 1;
  }
}

async function createAdminUser(
  supabase: ReturnType<typeof createClient<Database>>,
  seedEnv: SeedAdminEnv,
): Promise<User> {
  const { data, error } = await supabase.auth.admin.createUser({
    email: seedEnv.email,
    password: seedEnv.password,
    email_confirm: true,
    app_metadata: { role: adminRole },
  });

  if (error) {
    throw new Error(`Admin user create failed: ${error.message}`);
  }

  if (!data.user) {
    throw new Error("Admin user create succeeded without returning a user.");
  }

  return data.user;
}

async function ensureAdminRole(
  supabase: ReturnType<typeof createClient<Database>>,
  user: User,
): Promise<boolean> {
  const currentAppMetadata = user.app_metadata ?? {};

  if (currentAppMetadata.role === adminRole) {
    return false;
  }

  const { error } = await supabase.auth.admin.updateUserById(user.id, {
    app_metadata: {
      ...currentAppMetadata,
      role: adminRole,
    },
  });

  if (error) {
    throw new Error(`Admin role update failed: ${error.message}`);
  }

  return true;
}

function hashValue(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  log("seed-admin-user.failed", { message });
  globalThis.process.exitCode = 1;
});
