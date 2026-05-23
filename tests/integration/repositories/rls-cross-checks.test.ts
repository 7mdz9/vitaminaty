import { execFileSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/types.generated";
import { appendEvent as appendPaymentEvent } from "@/server/repositories/payment-event-repository";
import {
  createLocalAdminClient,
  createTestCustomerWithSession,
  readLocalSupabaseEnv,
  type TestCustomerWithSession,
} from "../../fixtures/customers";

const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const adminEmail = "admin@example.test";
const adminPassword = "This-is-a-strong-M1-test-admin-password-12345";

let localEnv: ReturnType<typeof readLocalSupabaseEnv>;
let serviceClient: SupabaseClient<Database>;
let anonClient: SupabaseClient<Database>;
let adminSessionClient: SupabaseClient<Database>;
let customerA: TestCustomerWithSession;
let customerB: TestCustomerWithSession;
let orderAId: string;
let orderBId: string;
let addressAId: string;
let addressBId: string;
let paymentEventId: string;

describe("M1 RLS cross-checks", () => {
  beforeAll(async () => {
    seedAdminUser();
    localEnv = readLocalSupabaseEnv();
    serviceClient = createLocalAdminClient(localEnv);
    anonClient = createClient<Database>(localEnv.apiUrl, localEnv.anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    adminSessionClient = createClient<Database>(localEnv.apiUrl, localEnv.anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error: adminSignInError } = await adminSessionClient.auth.signInWithPassword({
      email: adminEmail,
      password: adminPassword,
    });

    if (adminSignInError) {
      throw new Error(`Could not sign in seeded admin user: ${adminSignInError.message}`);
    }

    customerA = await createTestCustomerWithSession();
    customerB = await createTestCustomerWithSession();

    orderAId = await createOrder(customerA.customer.id, `A-${runId}`);
    orderBId = await createOrder(customerB.customer.id, `B-${runId}`);
    addressAId = await createAddress(customerA.customer.id, "Customer A");
    addressBId = await createAddress(customerB.customer.id, "Customer B");
  });

  afterAll(async () => {
    if (paymentEventId) {
      await serviceClient.from("payment_events").delete().eq("id", paymentEventId);
    }

    for (const id of [orderAId, orderBId].filter(Boolean)) {
      await serviceClient.from("orders").delete().eq("id", id);
    }

    await customerA?.cleanup();
    await customerB?.cleanup();
  });

  it("denies anon reads of wholesale_price_internal from products", async () => {
    const { error } = await anonClient
      .from("products")
      .select("wholesale_price_internal")
      .limit(1);

    expect(error?.message).toMatch(/permission denied/i);
  });

  it("has no wholesale_price_internal column grants for anon or authenticated roles", () => {
    const grants = runLocalPsql(`
      select grantee || ':' || privilege_type
      from information_schema.column_privileges
      where table_name = 'products'
        and column_name = 'wholesale_price_internal'
        and grantee in ('anon', 'authenticated')
      order by grantee, privilege_type
    `);

    expect(grants).toBe("");
  });

  it("allows customer A to read own order and returns zero rows for customer B order", async () => {
    const { data: ownOrders, error: ownError } = await customerA.client
      .from("orders")
      .select("id, customer_id")
      .eq("customer_id", customerA.customer.id);

    expect(ownError).toBeNull();
    expect(ownOrders).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: orderAId })]),
    );

    const { data: otherOrders, error: otherError } = await customerA.client
      .from("orders")
      .select("id, customer_id")
      .eq("customer_id", customerB.customer.id);

    expect(otherError).toBeNull();
    expect(otherOrders).toEqual([]);
  });

  it("returns zero customer rows to anon", async () => {
    const { data, error } = await anonClient.from("customers").select("id");

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("allows customer A to update own address and returns zero rows for customer B address update", async () => {
    const { data: ownUpdate, error: ownError } = await customerA.client
      .from("addresses")
      .update({ label: "Home sanity" })
      .eq("id", addressAId)
      .select("id, label");

    expect(ownError).toBeNull();
    expect(ownUpdate).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: addressAId, label: "Home sanity" })]),
    );

    const { data: otherUpdate, error: otherError } = await customerA.client
      .from("addresses")
      .update({ label: "Blocked" })
      .eq("id", addressBId)
      .select("id, label");

    expect(otherError).toBeNull();
    expect(otherUpdate).toEqual([]);
  });

  it("appends payment events with service role and denies admin-session updates under RLS", async () => {
    const event = await appendPaymentEvent(
      {
        order_id: orderAId,
        kind: "intent_created",
        provider: "stub",
        provider_transaction_id: `rls-txn-${runId}`,
        provider_intent_id: `rls-intent-${runId}`,
        amount_aed: 120,
        raw_payload: { source: "rls-cross-check" },
        occurred_at: new Date().toISOString(),
      },
      serviceClient,
    );
    paymentEventId = event.id;

    expect(event).toMatchObject({
      order_id: orderAId,
      provider_transaction_id: `rls-txn-${runId}`,
    });

    const { data, error } = await adminSessionClient
      .from("payment_events")
      .update({ raw_payload: { source: "forbidden-update" } })
      .eq("id", paymentEventId)
      .select("id");

    expect(error ? error.message : data).toSatisfy((value: unknown) => {
      return typeof value === "string"
        ? /permission denied|violates row-level security/i.test(value)
        : Array.isArray(value) && value.length === 0;
    });
  });
});

function seedAdminUser(): void {
  const pnpmExecutable = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  execFileSync(pnpmExecutable, ["exec", "tsx", "scripts/seed-admin-user.ts"], {
    env: {
      ...globalThis.process.env,
      SEED_ADMIN_EMAIL: adminEmail,
      SEED_ADMIN_PASSWORD: adminPassword,
    },
    shell: process.platform === "win32",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function runLocalPsql(sql: string): string {
  return execFileSync(
    "docker",
    ["exec", "-i", "supabase_db_vitaminaty", "psql", "-U", "postgres", "-d", "postgres", "-tAc", sql],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  ).trim();
}

async function createOrder(customerId: string, marker: string): Promise<string> {
  const { data, error } = await serviceClient
    .from("orders")
    .insert({
      customer_id: customerId,
      ship_to: {
        recipient_name: `RLS ${marker}`,
        phone_e164: "+971501111111",
        line1: "RLS Test Tower",
        line2: null,
        city: "Dubai",
        emirate: "Dubai",
        country_code: "AE",
      },
      subtotal_aed: 100,
      shipping_cost_aed: 20,
      vat_amount_aed: 5,
      total_aed: 120,
      payment_method: "card",
      payment_provider: "stub",
      shipping_method: "standard",
      shipping_provider: "stub",
      idempotency_key: `rls-idem-${marker}`,
      reference: `RLS-${marker}`,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Could not create RLS test order ${marker}: ${error.message}`);
  }

  return data.id;
}

async function createAddress(customerId: string, recipientName: string): Promise<string> {
  const { data, error } = await serviceClient
    .from("addresses")
    .insert({
      customer_id: customerId,
      recipient_name: recipientName,
      phone_e164: "+971501111111",
      line1: "RLS Address Tower",
      city: "Dubai",
      emirate: "Dubai",
      is_default: false,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Could not create RLS test address: ${error.message}`);
  }

  return data.id;
}
