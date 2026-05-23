import "server-only";

import { supabaseAdmin } from "@/server/db/supabase-admin";
import type { Database } from "@/lib/supabase/types.generated";
import type { CustomerRecord } from "@/types/customer";

type CustomerRow = Database["public"]["Tables"]["customers"]["Row"];
type CustomerInsert = Database["public"]["Tables"]["customers"]["Insert"];
type CustomerUpdate = Database["public"]["Tables"]["customers"]["Update"];
type AdminClient = Pick<typeof supabaseAdmin, "from">;

const CUSTOMER_COLUMNS = [
  "id",
  "full_name",
  "phone_e164",
  "email_verified_at",
  "marketing_opt_in",
  "marketing_opt_in_at",
  "consent_version",
  "consent_at",
  "deleted_at",
  "created_at",
  "updated_at",
].join(", ");

export async function listCustomersForAdmin(
  client: AdminClient = supabaseAdmin,
): Promise<CustomerRecord[]> {
  const { data, error } = await client
    .from("customers")
    .select(CUSTOMER_COLUMNS)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Admin customers query failed: ${error.message}`);
  }

  return (data as unknown as CustomerRow[]).map(mapCustomer);
}

export async function findCustomerByIdForAdmin(
  id: string,
  client: AdminClient = supabaseAdmin,
): Promise<CustomerRecord | null> {
  const { data, error } = await client
    .from("customers")
    .select(CUSTOMER_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Admin customer by id query failed: ${error.message}`);
  }

  return data ? mapCustomer(data as unknown as CustomerRow) : null;
}

export async function upsertCustomerForAdmin(
  row: CustomerInsert,
  client: AdminClient = supabaseAdmin,
): Promise<CustomerRecord> {
  const { data, error } = await client
    .from("customers")
    .upsert(row, { onConflict: "id" })
    .select(CUSTOMER_COLUMNS)
    .single();

  if (error) {
    throw new Error(`Admin customer upsert failed: ${error.message}`);
  }

  return mapCustomer(data as unknown as CustomerRow);
}

export async function updateCustomerForAdmin(
  id: string,
  patch: CustomerUpdate,
  client: AdminClient = supabaseAdmin,
): Promise<CustomerRecord> {
  const { data, error } = await client
    .from("customers")
    .update(patch)
    .eq("id", id)
    .select(CUSTOMER_COLUMNS)
    .single();

  if (error) {
    throw new Error(`Admin customer update failed: ${error.message}`);
  }

  return mapCustomer(data as unknown as CustomerRow);
}

function mapCustomer(row: CustomerRow): CustomerRecord {
  return row;
}
