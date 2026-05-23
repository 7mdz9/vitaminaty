// Authz model: inventory-movement-repository
//   appendMovement({product_id, variant_id, previous_quantity, new_quantity, change_amount,
//                   reason, change_reason_note, changed_by, order_id}):
//     caller=server-side only (admin inventory service, checkout transaction, restoration service);
//     uses src/server/db/supabase-admin.ts service-role;
//     append-only mutation surface -- no update/delete functions exist in this module.
//   listMovementsForVariant / listMovementsForProduct / listMovementsForOrder:
//     caller=authenticated admin; reads immutable inventory history.
import "server-only";

import { supabaseAdmin } from "@/server/db/supabase-admin";
import type { Database } from "@/lib/supabase/types.generated";

type InventoryMovementRow = Database["public"]["Tables"]["inventory_movements"]["Row"];
type InventoryMovementInsert = Database["public"]["Tables"]["inventory_movements"]["Insert"];
type AdminClient = Pick<typeof supabaseAdmin, "from">;

const INVENTORY_MOVEMENT_COLUMNS = [
  "id",
  "product_id",
  "variant_id",
  "previous_quantity",
  "new_quantity",
  "change_amount",
  "reason",
  "change_reason_note",
  "changed_by",
  "changed_at",
  "order_id",
].join(", ");

export async function appendMovement(
  row: InventoryMovementInsert,
  client: AdminClient = supabaseAdmin,
): Promise<InventoryMovementRow> {
  const { data, error } = await client
    .from("inventory_movements")
    .insert(row)
    .select(INVENTORY_MOVEMENT_COLUMNS)
    .single();

  if (error) {
    throw new Error(`Inventory movement append failed: ${error.message}`);
  }

  return data as unknown as InventoryMovementRow;
}

export async function listMovementsForVariant(
  variantId: string,
  client: AdminClient = supabaseAdmin,
): Promise<InventoryMovementRow[]> {
  const { data, error } = await client
    .from("inventory_movements")
    .select(INVENTORY_MOVEMENT_COLUMNS)
    .eq("variant_id", variantId)
    .order("changed_at", { ascending: false });

  if (error) {
    throw new Error(`Inventory movements variant query failed: ${error.message}`);
  }

  return data as unknown as InventoryMovementRow[];
}

export async function listMovementsForProduct(
  productId: string,
  client: AdminClient = supabaseAdmin,
): Promise<InventoryMovementRow[]> {
  const { data, error } = await client
    .from("inventory_movements")
    .select(INVENTORY_MOVEMENT_COLUMNS)
    .eq("product_id", productId)
    .order("changed_at", { ascending: false });

  if (error) {
    throw new Error(`Inventory movements product query failed: ${error.message}`);
  }

  return data as unknown as InventoryMovementRow[];
}

export async function listMovementsForOrder(
  orderId: string,
  client: AdminClient = supabaseAdmin,
): Promise<InventoryMovementRow[]> {
  const { data, error } = await client
    .from("inventory_movements")
    .select(INVENTORY_MOVEMENT_COLUMNS)
    .eq("order_id", orderId)
    .order("changed_at", { ascending: false });

  if (error) {
    throw new Error(`Inventory movements order query failed: ${error.message}`);
  }

  return data as unknown as InventoryMovementRow[];
}
