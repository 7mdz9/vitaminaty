import "server-only";

import { createSupabaseServerClient } from "@/server/db/supabase-server";
import type { Database, Json } from "@/lib/supabase/types.generated";
import type { AddressSnapshot } from "@/types/address";
import type { OrderItemRecord, OrderRecord } from "@/types/order";

type PublicClient = Pick<Awaited<ReturnType<typeof createSupabaseServerClient>>, "from">;
type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
type OrderItemRow = Database["public"]["Tables"]["order_items"]["Row"];

const ORDER_COLUMNS = [
  "id",
  "customer_id",
  "status",
  "ship_to",
  "subtotal_aed",
  "shipping_cost_aed",
  "vat_amount_aed",
  "total_aed",
  "payment_method",
  "payment_provider",
  "payment_provider_order_id",
  "payment_provider_intent_id",
  "shipping_method",
  "shipping_provider",
  "shipping_provider_shipment_id",
  "tracking_number",
  "tracking_url",
  "idempotency_key",
  "reference",
  "created_at",
  "updated_at",
  "paid_at",
  "shipped_at",
  "delivered_at",
  "cancelled_at",
].join(", ");

const ORDER_ITEM_COLUMNS = [
  "id",
  "order_id",
  "product_id",
  "variant_id",
  "product_name",
  "variant_size",
  "variant_flavor",
  "unit_price_aed",
  "quantity",
  "line_total_aed",
  "created_at",
].join(", ");

export async function listCurrentCustomerOrders(
  customerId: string,
  client?: PublicClient,
): Promise<OrderRecord[]> {
  const supabase = await resolvePublicClient(client);
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_COLUMNS)
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Current customer orders query failed: ${error.message}`);
  }

  return (data as unknown as OrderRow[]).map(mapOrder);
}

export async function findCurrentCustomerOrderById(
  orderId: string,
  client?: PublicClient,
): Promise<OrderRecord | null> {
  const supabase = await resolvePublicClient(client);
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_COLUMNS)
    .eq("id", orderId)
    .maybeSingle();

  if (error) {
    throw new Error(`Current customer order by id query failed: ${error.message}`);
  }

  return data ? mapOrder(data as unknown as OrderRow) : null;
}

export async function listCurrentCustomerOrderItems(
  orderId: string,
  client?: PublicClient,
): Promise<OrderItemRecord[]> {
  const supabase = await resolvePublicClient(client);
  const { data, error } = await supabase
    .from("order_items")
    .select(ORDER_ITEM_COLUMNS)
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Current customer order items query failed: ${error.message}`);
  }

  return (data as unknown as OrderItemRow[]).map(mapOrderItem);
}

async function resolvePublicClient(client?: PublicClient): Promise<PublicClient> {
  return client ?? createSupabaseServerClient();
}

export function mapOrder(row: OrderRow): OrderRecord {
  return {
    ...row,
    ship_to: mapJsonObject<AddressSnapshot>(row.ship_to),
    payment_method: row.payment_method === "card" ? "card" : row.payment_method,
    payment_provider:
      row.payment_provider === "paymob" || row.payment_provider === "stub"
        ? row.payment_provider
        : null,
    shipping_provider:
      row.shipping_provider === "icarry" ||
      row.shipping_provider === "stub" ||
      row.shipping_provider === "manual"
        ? row.shipping_provider
        : null,
  };
}

export function mapOrderItem(row: OrderItemRow): OrderItemRecord {
  return row;
}

export function mapJsonObject<T>(value: Json): T {
  return (value && typeof value === "object" && !Array.isArray(value) ? value : {}) as T;
}
