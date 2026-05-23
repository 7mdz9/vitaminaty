// Authz model: shipment-event-repository
//   appendEvent({provider, provider_shipment_id, status, raw_payload}):
//     caller=server-side only (iCarry/manual/stub shipping boundary, never customer);
//     uses src/server/db/supabase-admin.ts service-role by default;
//     shipment history is append-only; no update/delete functions exist in this module.
//   listEventsForOrder(orderId): caller=authenticated admin; reads shipment history for one order.
import "server-only";

import { supabaseAdmin } from "@/server/db/supabase-admin";
import type { Database } from "@/lib/supabase/types.generated";
import type { ShipmentEventRecord } from "@/types/order";
import { mapJsonObject } from "./order-repository";

type ShipmentEventRow = Database["public"]["Tables"]["shipment_events"]["Row"];
type ShipmentEventInsert = Database["public"]["Tables"]["shipment_events"]["Insert"];
type AdminClient = Pick<typeof supabaseAdmin, "from">;

const SHIPMENT_EVENT_COLUMNS = [
  "id",
  "order_id",
  "status",
  "provider",
  "provider_shipment_id",
  "raw_payload",
  "occurred_at",
  "recorded_at",
].join(", ");

export async function appendEvent(
  row: ShipmentEventInsert,
  client: AdminClient = supabaseAdmin,
): Promise<ShipmentEventRecord> {
  const { data, error } = await client
    .from("shipment_events")
    .insert(row)
    .select(SHIPMENT_EVENT_COLUMNS)
    .single();

  if (error) {
    throw new Error(`Shipment event append failed: ${error.message}`);
  }

  return mapShipmentEvent(data as unknown as ShipmentEventRow);
}

export async function listEventsForOrder(
  orderId: string,
  client: AdminClient = supabaseAdmin,
): Promise<ShipmentEventRecord[]> {
  const { data, error } = await client
    .from("shipment_events")
    .select(SHIPMENT_EVENT_COLUMNS)
    .eq("order_id", orderId)
    .order("recorded_at", { ascending: false });

  if (error) {
    throw new Error(`Shipment events query failed: ${error.message}`);
  }

  return (data as unknown as ShipmentEventRow[]).map(mapShipmentEvent);
}

function mapShipmentEvent(row: ShipmentEventRow): ShipmentEventRecord {
  return {
    ...row,
    provider:
      row.provider === "icarry" || row.provider === "manual" || row.provider === "stub"
        ? row.provider
        : "manual",
    raw_payload: row.raw_payload ? mapJsonObject<Record<string, unknown>>(row.raw_payload) : null,
  };
}
