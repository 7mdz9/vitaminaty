import { execFileSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types.generated";

export type TestCustomerWithSession = {
  customer: { id: string; email: string };
  client: SupabaseClient<Database>;
  cleanup: () => Promise<void>;
};

type LocalSupabaseEnv = {
  apiUrl: string;
  anonKey: string;
  serviceRoleKey: string;
};

const testPassword = "test-password-123";

export function readLocalSupabaseEnv(): LocalSupabaseEnv {
  const pnpmExecutable = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const output = execFileSync(pnpmExecutable, ["exec", "supabase", "status", "-o", "env"], {
    encoding: "utf8",
    shell: process.platform === "win32",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const values = new Map<string, string>();

  output.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^([A-Z0-9_]+)="?(.*?)"?$/);

    if (match) {
      values.set(match[1], match[2]);
    }
  });

  const apiUrl = values.get("API_URL");
  const anonKey = values.get("ANON_KEY");
  const serviceRoleKey = values.get("SERVICE_ROLE_KEY");

  if (!apiUrl || !anonKey || !serviceRoleKey) {
    throw new Error(
      "Local Supabase API_URL, ANON_KEY, or SERVICE_ROLE_KEY missing from `supabase status -o env`.",
    );
  }

  return { apiUrl, anonKey, serviceRoleKey };
}

export function createLocalAdminClient(
  localEnv: LocalSupabaseEnv = readLocalSupabaseEnv(),
): SupabaseClient<Database> {
  return createClient<Database>(localEnv.apiUrl, localEnv.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function createTestCustomerWithSession(): Promise<TestCustomerWithSession> {
  const localEnv = readLocalSupabaseEnv();
  const adminClient = createLocalAdminClient(localEnv);
  const email = `test-customer-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`;

  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password: testPassword,
    email_confirm: true,
  });

  if (error || !data.user) {
    throw new Error(`Could not create local test auth user: ${error?.message ?? "missing user"}`);
  }

  const customerId = data.user.id;

  const { error: customerError } = await adminClient.from("customers").upsert(
    {
      id: customerId,
      full_name: "RLS Test Customer",
      phone_e164: "+971501000000",
      marketing_opt_in: false,
      email_verified_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (customerError) {
    await adminClient.auth.admin.deleteUser(customerId);
    throw new Error(`Could not create local test customer row: ${customerError.message}`);
  }

  const client = createClient<Database>(localEnv.apiUrl, localEnv.anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: signInError } = await client.auth.signInWithPassword({
    email,
    password: testPassword,
  });

  if (signInError) {
    await destroyTestCustomer(customerId, adminClient);
    throw new Error(`Could not sign in local test customer: ${signInError.message}`);
  }

  return {
    customer: { id: customerId, email },
    client,
    cleanup: () => destroyTestCustomer(customerId, adminClient),
  };
}

export async function destroyTestCustomer(
  customerId: string,
  adminClient: SupabaseClient<Database> = createLocalAdminClient(),
): Promise<void> {
  await adminClient.from("addresses").delete().eq("customer_id", customerId);
  await adminClient.from("customers").delete().eq("id", customerId);
  await adminClient.auth.admin.deleteUser(customerId);
}
