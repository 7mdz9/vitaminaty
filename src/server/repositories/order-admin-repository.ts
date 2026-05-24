import "server-only";

import { supabaseAdmin } from "@/server/db/supabase-admin";
import type { Database } from "@/lib/supabase/types.generated";
import type { OrderItemRecord, OrderRecord } from "@/types/order";
import { mapOrder, mapOrderItem } from "./order-repository";

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
type OrderInsert = Database["public"]["Tables"]["orders"]["Insert"];
type OrderUpdate = Database["public"]["Tables"]["orders"]["Update"];
type OrderItemRow = Database["public"]["Tables"]["order_items"]["Row"];
type OrderItemInsert = Database["public"]["Tables"]["order_items"]["Insert"];
type AdminClient = Pick<typeof supabaseAdmin, "from">;

export type AdminOrderListFilters = Readonly<{
  status?: OrderRow["status"];
  paymentMethod?: OrderRow["payment_method"];
  referenceSearch?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}>;

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

export async function listOrdersForAdmin(
  filters: AdminOrderListFilters = {},
  client: AdminClient = supabaseAdmin,
): Promise<OrderRecord[]> {
  let query = client
    .from("orders")
    .select(ORDER_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(filters.limit ?? 100);

  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  if (filters.paymentMethod) {
    query = query.eq("payment_method", filters.paymentMethod);
  }

  if (filters.referenceSearch) {
    query = query.ilike("reference", `%${escapeLikePattern(filters.referenceSearch)}%`);
  }

  if (filters.dateFrom) {
    query = query.gte("created_at", filters.dateFrom);
  }

  if (filters.dateTo) {
    query = query.lte("created_at", filters.dateTo);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Admin orders query failed: ${error.message}`);
  }

  return (data as unknown as OrderRow[]).map(mapOrder);
}

export async function findOrderByIdForAdmin(
  id: string,
  client: AdminClient = supabaseAdmin,
): Promise<OrderRecord | null> {
  const { data, error } = await client
    .from("orders")
    .select(ORDER_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Admin order by id query failed: ${error.message}`);
  }

  return data ? mapOrder(data as unknown as OrderRow) : null;
}

export async function findOrderByIdempotencyKeyForAdmin(
  idempotencyKey: string,
  client: AdminClient = supabaseAdmin,
): Promise<OrderRecord | null> {
  const { data, error } = await client
    .from("orders")
    .select(ORDER_COLUMNS)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (error) {
    throw new Error(`Admin order idempotency query failed: ${error.message}`);
  }

  return data ? mapOrder(data as unknown as OrderRow) : null;
}

export async function createOrderForAdmin(
  row: OrderInsert,
  client: AdminClient = supabaseAdmin,
): Promise<OrderRecord> {
  const { data, error } = await client.from("orders").insert(row).select(ORDER_COLUMNS).single();

  if (error) {
    throw new Error(`Admin order insert failed: ${error.message}`);
  }

  return mapOrder(data as unknown as OrderRow);
}

export async function updateOrderForAdmin(
  id: string,
  patch: OrderUpdate,
  client: AdminClient = supabaseAdmin,
): Promise<OrderRecord> {
  const { data, error } = await client
    .from("orders")
    .update(patch)
    .eq("id", id)
    .select(ORDER_COLUMNS)
    .single();

  if (error) {
    throw new Error(`Admin order update failed: ${error.message}`);
  }

  return mapOrder(data as unknown as OrderRow);
}

export async function updateOrderIfFreshForAdmin(
  id: string,
  expectedUpdatedAt: string,
  patch: OrderUpdate,
  client: AdminClient = supabaseAdmin,
): Promise<OrderRecord | null> {
  const { data, error } = await client
    .from("orders")
    .update(patch)
    .eq("id", id)
    .eq("updated_at", expectedUpdatedAt)
    .select(ORDER_COLUMNS)
    .maybeSingle();

  if (error) {
    throw new Error(`Admin order stale-safe update failed: ${error.message}`);
  }

  return data ? mapOrder(data as unknown as OrderRow) : null;
}

export async function bulkInsertOrderItemsForAdmin(
  rows: OrderItemInsert[],
  client: AdminClient = supabaseAdmin,
): Promise<OrderItemRecord[]> {
  if (rows.length === 0) {
    return [];
  }

  const { data, error } = await client.from("order_items").insert(rows).select(ORDER_ITEM_COLUMNS);

  if (error) {
    throw new Error(`Admin order items insert failed: ${error.message}`);
  }

  return (data as unknown as OrderItemRow[]).map(mapOrderItem);
}

export async function listOrderItemsForAdmin(
  orderId: string,
  client: AdminClient = supabaseAdmin,
): Promise<OrderItemRecord[]> {
  const { data, error } = await client
    .from("order_items")
    .select(ORDER_ITEM_COLUMNS)
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Admin order items query failed: ${error.message}`);
  }

  return (data as unknown as OrderItemRow[]).map(mapOrderItem);
}

export async function listOrderItemsForOrdersForAdmin(
  orderIds: string[],
  client: AdminClient = supabaseAdmin,
): Promise<OrderItemRecord[]> {
  const uniqueIds = Array.from(new Set(orderIds)).filter(Boolean);

  if (uniqueIds.length === 0) {
    return [];
  }

  const { data, error } = await client
    .from("order_items")
    .select(ORDER_ITEM_COLUMNS)
    .in("order_id", uniqueIds)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Admin order items by orders query failed: ${error.message}`);
  }

  return (data as unknown as OrderItemRow[]).map(mapOrderItem);
}

function escapeLikePattern(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}
