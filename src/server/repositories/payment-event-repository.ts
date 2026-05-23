// Authz model: payment-event-repository
//   appendEvent({provider, provider_transaction_id, kind, raw_payload, signature_received}):
//     caller=server-side only (Paymob/stub webhook or checkout boundary, never customer);
//     uses src/server/db/supabase-admin.ts service-role by default;
//     idempotency enforced by UNIQUE(provider, provider_transaction_id, kind);
//     append-only mutation surface -- no update/delete functions exist in this module.
//   listEventsForOrder(orderId): caller=authenticated admin; reads payment history for one order.
import "server-only";

import { supabaseAdmin } from "@/server/db/supabase-admin";
import type { Database } from "@/lib/supabase/types.generated";
import type { PaymentEventRecord } from "@/types/payment";
import { mapJsonObject } from "./order-repository";

type PaymentEventRow = Database["public"]["Tables"]["payment_events"]["Row"];
type PaymentEventInsert = Database["public"]["Tables"]["payment_events"]["Insert"];
type AdminClient = Pick<typeof supabaseAdmin, "from">;

const PAYMENT_EVENT_COLUMNS = [
  "id",
  "order_id",
  "kind",
  "provider",
  "provider_transaction_id",
  "provider_intent_id",
  "amount_aed",
  "currency",
  "raw_payload",
  "signature_received",
  "occurred_at",
  "recorded_at",
].join(", ");

export async function appendEvent(
  row: PaymentEventInsert,
  client: AdminClient = supabaseAdmin,
): Promise<PaymentEventRecord> {
  const { data, error } = await client
    .from("payment_events")
    .insert(row)
    .select(PAYMENT_EVENT_COLUMNS)
    .single();

  if (error) {
    throw new Error(`Payment event append failed: ${error.message}`);
  }

  return mapPaymentEvent(data as unknown as PaymentEventRow);
}

export async function listEventsForOrder(
  orderId: string,
  client: AdminClient = supabaseAdmin,
): Promise<PaymentEventRecord[]> {
  const { data, error } = await client
    .from("payment_events")
    .select(PAYMENT_EVENT_COLUMNS)
    .eq("order_id", orderId)
    .order("recorded_at", { ascending: false });

  if (error) {
    throw new Error(`Payment events query failed: ${error.message}`);
  }

  return (data as unknown as PaymentEventRow[]).map(mapPaymentEvent);
}

function mapPaymentEvent(row: PaymentEventRow): PaymentEventRecord {
  return {
    ...row,
    provider: row.provider === "paymob" ? "paymob" : "stub",
    currency: "AED",
    raw_payload: mapJsonObject<Record<string, unknown>>(row.raw_payload),
  };
}
