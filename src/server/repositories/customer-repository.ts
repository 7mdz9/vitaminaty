import "server-only";

import { createSupabaseServerClient } from "@/server/db/supabase-server";
import type { Database } from "@/lib/supabase/types.generated";
import type { supabaseAdmin } from "@/server/db/supabase-admin";
import type { AddressRecord, UaeEmirate } from "@/types/address";
import type { CustomerRecord } from "@/types/customer";

type PublicClient = unknown;
type TypedClient = typeof supabaseAdmin;
type CustomerRow = Database["public"]["Tables"]["customers"]["Row"];
type CustomerUpdate = Database["public"]["Tables"]["customers"]["Update"];
type AddressRow = Database["public"]["Tables"]["addresses"]["Row"];
type AddressInsert = Database["public"]["Tables"]["addresses"]["Insert"];
type AddressUpdate = Database["public"]["Tables"]["addresses"]["Update"];

export type CurrentCustomerUpdate = Pick<
  CustomerUpdate,
  "full_name" | "phone_e164" | "marketing_opt_in" | "marketing_opt_in_at"
>;

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

const ADDRESS_COLUMNS = [
  "id",
  "customer_id",
  "label",
  "recipient_name",
  "phone_e164",
  "line1",
  "line2",
  "city",
  "emirate",
  "country_code",
  "is_default",
  "created_at",
  "updated_at",
].join(", ");

export async function findCurrentCustomer(
  customerId: string,
  client?: PublicClient,
): Promise<CustomerRecord | null> {
  const supabase = await resolveTypedPublicClient(client);
  const { data, error } = await supabase
    .from("customers")
    .select(CUSTOMER_COLUMNS)
    .eq("id", customerId)
    .maybeSingle();

  if (error) {
    throw new Error(`Current customer query failed: ${error.message}`);
  }

  return data ? mapCustomer(data as unknown as CustomerRow) : null;
}

export async function updateCurrentCustomer(
  customerId: string,
  patch: CurrentCustomerUpdate,
  client?: PublicClient,
): Promise<CustomerRecord> {
  const supabase = await resolveTypedPublicClient(client);
  const { data, error } = await supabase
    .from("customers")
    .update(patch)
    .eq("id", customerId)
    .select(CUSTOMER_COLUMNS)
    .single();

  if (error) {
    throw new Error(`Current customer update failed: ${error.message}`);
  }

  return mapCustomer(data as unknown as CustomerRow);
}

export async function listCurrentCustomerAddresses(
  customerId: string,
  client?: PublicClient,
): Promise<AddressRecord[]> {
  const supabase = await resolveTypedPublicClient(client);
  const { data, error } = await supabase
    .from("addresses")
    .select(ADDRESS_COLUMNS)
    .eq("customer_id", customerId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Current customer addresses query failed: ${error.message}`);
  }

  return (data as unknown as AddressRow[]).map(mapAddress);
}

export async function createCurrentCustomerAddress(
  row: AddressInsert,
  client?: PublicClient,
): Promise<AddressRecord> {
  const supabase = await resolveTypedPublicClient(client);
  const { data, error } = await supabase
    .from("addresses")
    .insert(row)
    .select(ADDRESS_COLUMNS)
    .single();

  if (error) {
    throw new Error(`Current customer address insert failed: ${error.message}`);
  }

  return mapAddress(data as unknown as AddressRow);
}

export async function updateCurrentCustomerAddress(
  addressId: string,
  patch: AddressUpdate,
  client?: PublicClient,
): Promise<AddressRecord> {
  const supabase = await resolveTypedPublicClient(client);
  const { data, error } = await supabase
    .from("addresses")
    .update(patch)
    .eq("id", addressId)
    .select(ADDRESS_COLUMNS)
    .single();

  if (error) {
    throw new Error(`Current customer address update failed: ${error.message}`);
  }

  return mapAddress(data as unknown as AddressRow);
}

export async function deleteCurrentCustomerAddress(
  addressId: string,
  client?: PublicClient,
): Promise<void> {
  const supabase = await resolveTypedPublicClient(client);
  const { error } = await supabase.from("addresses").delete().eq("id", addressId);

  if (error) {
    throw new Error(`Current customer address delete failed: ${error.message}`);
  }
}

async function resolvePublicClient(
  client?: PublicClient,
): Promise<Awaited<ReturnType<typeof createSupabaseServerClient>> | PublicClient> {
  return client ?? createSupabaseServerClient();
}

async function resolveTypedPublicClient(client?: PublicClient): Promise<TypedClient> {
  return (await resolvePublicClient(client)) as unknown as TypedClient;
}

function mapCustomer(row: CustomerRow): CustomerRecord {
  return row;
}

function mapAddress(row: AddressRow): AddressRecord {
  return {
    ...row,
    emirate: row.emirate as UaeEmirate,
    country_code: "AE",
  };
}
