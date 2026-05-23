import { execFileSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/types.generated";

type LocalSupabaseEnv = {
  apiUrl: string;
  anonKey: string;
  serviceRoleKey: string;
};

const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const password = "test-password-123";
const orderReference = `VIT-TEST-${runId}`;

let adminClient: SupabaseClient<Database>;
let customerClient: SupabaseClient<Database>;
let otherCustomerClient: SupabaseClient<Database>;
let customerId: string;
let otherCustomerId: string;
let orderId: string;
let supportConversationId: string;

describe("PII repositories", () => {
  beforeAll(async () => {
    const localEnv = readLocalSupabaseEnv();
    adminClient = createClient<Database>(localEnv.apiUrl, localEnv.serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    customerClient = createClient<Database>(localEnv.apiUrl, localEnv.anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    otherCustomerClient = createClient<Database>(localEnv.apiUrl, localEnv.anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    customerId = await createAuthCustomer(`pii-${runId}@example.test`, "Step Seven Buyer");
    otherCustomerId = await createAuthCustomer(`pii-other-${runId}@example.test`, "Other Buyer");

    await signIn(customerClient, `pii-${runId}@example.test`);
    await signIn(otherCustomerClient, `pii-other-${runId}@example.test`);
  });

  afterAll(async () => {
    await cleanupRows();
  });

  it("scopes customer profile and address access through RLS", async () => {
    const {
      createCurrentCustomerAddress,
      findCurrentCustomer,
      listCurrentCustomerAddresses,
      updateCurrentCustomer,
    } = await import("@/server/repositories/customer-repository");

    await expect(findCurrentCustomer(customerId, customerClient)).resolves.toMatchObject({
      full_name: "Step Seven Buyer",
    });
    await expect(findCurrentCustomer(customerId, otherCustomerClient)).resolves.toBeNull();

    await expect(
      updateCurrentCustomer(
        customerId,
        { phone_e164: "+971501111111", marketing_opt_in: true },
        customerClient,
      ),
    ).resolves.toMatchObject({ phone_e164: "+971501111111", marketing_opt_in: true });

    await expect(
      createCurrentCustomerAddress(
        {
          customer_id: customerId,
          recipient_name: "Step Seven Buyer",
          phone_e164: "+971501111111",
          line1: "Test Tower",
          city: "Dubai",
          emirate: "Dubai",
          is_default: true,
        },
        customerClient,
      ),
    ).resolves.toMatchObject({ customer_id: customerId, is_default: true });

    await expect(listCurrentCustomerAddresses(customerId, customerClient)).resolves.toHaveLength(1);

    await expect(
      createCurrentCustomerAddress(
        {
          customer_id: otherCustomerId,
          recipient_name: "Blocked Buyer",
          phone_e164: "+971501222222",
          line1: "Wrong Tower",
          city: "Dubai",
          emirate: "Dubai",
        },
        customerClient,
      ),
    ).rejects.toThrow(/address insert failed/i);
  });

  it("creates orders through service-role paths and reads them only for the owning customer", async () => {
    const { createOrderForAdmin, bulkInsertOrderItemsForAdmin } =
      await import("@/server/repositories/order-admin-repository");
    const {
      findCurrentCustomerOrderById,
      listCurrentCustomerOrderItems,
      listCurrentCustomerOrders,
    } = await import("@/server/repositories/order-repository");

    const order = await createOrderForAdmin(
      {
        customer_id: customerId,
        ship_to: {
          recipient_name: "Step Seven Buyer",
          phone_e164: "+971501111111",
          line1: "Test Tower",
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
        idempotency_key: `idem-${runId}`,
        reference: orderReference,
      },
      adminClient,
    );
    orderId = order.id;

    await expect(
      bulkInsertOrderItemsForAdmin(
        [
          {
            order_id: orderId,
            product_name: "Repository Test Whey",
            variant_size: "1 kg",
            unit_price_aed: 100,
            quantity: 1,
            line_total_aed: 100,
          },
        ],
        adminClient,
      ),
    ).resolves.toHaveLength(1);

    await expect(listCurrentCustomerOrders(customerId, customerClient)).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: orderId, reference: orderReference })]),
    );
    await expect(findCurrentCustomerOrderById(orderId, customerClient)).resolves.toMatchObject({
      id: orderId,
      ship_to: expect.objectContaining({ city: "Dubai" }),
    });
    await expect(listCurrentCustomerOrderItems(orderId, customerClient)).resolves.toHaveLength(1);

    await expect(findCurrentCustomerOrderById(orderId, otherCustomerClient)).resolves.toBeNull();
    await expect(listCurrentCustomerOrderItems(orderId, otherCustomerClient)).resolves.toEqual([]);
  });

  it("keeps payment, shipment, audit, and support records behind admin/service paths", async () => {
    const { appendEvent: appendPaymentEvent, listEventsForOrder: listPaymentEventsForOrder } =
      await import("@/server/repositories/payment-event-repository");
    const { appendEvent: appendShipmentEvent, listEventsForOrder: listShipmentEventsForOrder } =
      await import("@/server/repositories/shipment-event-repository");
    const { appendEntry, listEntriesForEntity } =
      await import("@/server/repositories/audit-log-repository");
    const { createSupportConversationForAdmin, insertSupportMessageForAdmin } =
      await import("@/server/repositories/support-chat-admin-repository");
    const { listCurrentCustomerSupportConversations, listCurrentCustomerSupportMessages } =
      await import("@/server/repositories/support-chat-repository");

    await expect(
      appendPaymentEvent(
        {
          order_id: orderId,
          kind: "intent_created",
          provider: "stub",
          provider_transaction_id: `txn-${runId}`,
          provider_intent_id: `intent-${runId}`,
          amount_aed: 120,
          raw_payload: { source: "test" },
          occurred_at: new Date().toISOString(),
        },
        adminClient,
      ),
    ).resolves.toMatchObject({ order_id: orderId, provider: "stub" });

    await expect(
      appendShipmentEvent(
        {
          order_id: orderId,
          status: "created",
          provider: "stub",
          provider_shipment_id: `ship-${runId}`,
          raw_payload: { source: "test" },
          occurred_at: new Date().toISOString(),
        },
        adminClient,
      ),
    ).resolves.toMatchObject({ order_id: orderId, status: "created" });

    await expect(listPaymentEventsForOrder(orderId, adminClient)).resolves.toHaveLength(1);
    await expect(listShipmentEventsForOrder(orderId, adminClient)).resolves.toHaveLength(1);

    await expect(
      appendEntry(
        {
          actor_user_id: customerId,
          actor_email: `pii-${runId}@example.test`,
          action: "create",
          entity_type: "order",
          entity_id: orderId,
          diff: { after: { reference: orderReference } },
        },
        adminClient,
      ),
    ).resolves.toMatchObject({ entity_id: orderId });
    await expect(
      listEntriesForEntity("order", orderId, adminClient),
    ).resolves.toHaveLength(1);

    const conversation = await createSupportConversationForAdmin(
      { customer_id: customerId, status: "open" },
      adminClient,
    );
    supportConversationId = conversation.id;
    await insertSupportMessageForAdmin(
      {
        conversation_id: supportConversationId,
        sender: "system",
        content: "Repository test message.",
      },
      adminClient,
    );

    await expect(
      listCurrentCustomerSupportConversations(customerId, customerClient),
    ).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: supportConversationId })]),
    );
    await expect(
      listCurrentCustomerSupportMessages(supportConversationId, customerClient),
    ).resolves.toHaveLength(1);
    await expect(
      listCurrentCustomerSupportMessages(supportConversationId, otherCustomerClient),
    ).resolves.toEqual([]);

    await expect(customerClient.from("payment_events").select("id")).resolves.toMatchObject({
      data: [],
    });
    await expect(customerClient.from("audit_log").select("id")).resolves.toMatchObject({
      data: [],
    });
  });
});

async function createAuthCustomer(email: string, fullName: string): Promise<string> {
  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error || !data.user) {
    throw new Error(`Could not create local test auth user: ${error?.message ?? "missing user"}`);
  }

  const { upsertCustomerForAdmin } =
    await import("@/server/repositories/customer-admin-repository");
  await upsertCustomerForAdmin(
    {
      id: data.user.id,
      full_name: fullName,
      phone_e164: "+971501000000",
      marketing_opt_in: false,
      email_verified_at: new Date().toISOString(),
    },
    adminClient,
  );

  return data.user.id;
}

async function signIn(client: SupabaseClient<Database>, email: string): Promise<void> {
  const { error } = await client.auth.signInWithPassword({ email, password });

  if (error) {
    throw new Error(`Could not sign in local test user: ${error.message}`);
  }
}

async function cleanupRows(): Promise<void> {
  if (orderId) {
    await adminClient.from("payment_events").delete().eq("order_id", orderId);
    await adminClient.from("shipment_events").delete().eq("order_id", orderId);
    await adminClient.from("audit_log").delete().eq("entity_id", orderId);
    await adminClient.from("orders").delete().eq("id", orderId);
  }

  if (supportConversationId) {
    await adminClient.from("support_conversations").delete().eq("id", supportConversationId);
  }

  for (const id of [customerId, otherCustomerId].filter(Boolean)) {
    await adminClient.from("addresses").delete().eq("customer_id", id);
    await adminClient.from("customers").delete().eq("id", id);
    await adminClient.auth.admin.deleteUser(id);
  }
}

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
  const serviceRoleKey = values.get("SERVICE_ROLE_KEY");

  if (!apiUrl || !anonKey || !serviceRoleKey) {
    throw new Error(
      "Local Supabase API_URL, ANON_KEY, or SERVICE_ROLE_KEY missing from `supabase status -o env`.",
    );
  }

  return { apiUrl, anonKey, serviceRoleKey };
}
