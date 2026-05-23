// Authz model: audit-log-repository
//   appendEntry({actor_user_id, action, entity_type, entity_id, diff}):
//     caller=server-side only (admin mutation/service boundary);
//     uses src/server/db/supabase-admin.ts service-role by default;
//     append-only mutation surface -- no update/delete functions exist in this module.
//   listEntries/listEntriesForEntity: caller=authenticated admin; reads immutable audit history.
import "server-only";

import { supabaseAdmin } from "@/server/db/supabase-admin";
import type { Database, Json } from "@/lib/supabase/types.generated";
import type { AuditLogRecord } from "@/types/audit-log";

type AuditLogRow = Database["public"]["Tables"]["audit_log"]["Row"];
type AuditLogInsert = Database["public"]["Tables"]["audit_log"]["Insert"];
type AdminClient = Pick<typeof supabaseAdmin, "from">;

const AUDIT_LOG_COLUMNS = [
  "id",
  "actor_user_id",
  "actor_email",
  "action",
  "entity_type",
  "entity_id",
  "diff",
  "ip",
  "user_agent",
  "occurred_at",
].join(", ");

export async function appendEntry(
  row: AuditLogInsert,
  client: AdminClient = supabaseAdmin,
): Promise<AuditLogRecord> {
  const { data, error } = await client
    .from("audit_log")
    .insert(row)
    .select(AUDIT_LOG_COLUMNS)
    .single();

  if (error) {
    throw new Error(`Audit log insert failed: ${error.message}`);
  }

  return mapAuditLog(data as unknown as AuditLogRow);
}

export async function listEntries(
  limit = 100,
  client: AdminClient = supabaseAdmin,
): Promise<AuditLogRecord[]> {
  const { data, error } = await client
    .from("audit_log")
    .select(AUDIT_LOG_COLUMNS)
    .order("occurred_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Audit log query failed: ${error.message}`);
  }

  return (data as unknown as AuditLogRow[]).map(mapAuditLog);
}

export async function listEntriesForEntity(
  entityType: string,
  entityId: string,
  client: AdminClient = supabaseAdmin,
): Promise<AuditLogRecord[]> {
  const { data, error } = await client
    .from("audit_log")
    .select(AUDIT_LOG_COLUMNS)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("occurred_at", { ascending: false });

  if (error) {
    throw new Error(`Audit log entity query failed: ${error.message}`);
  }

  return (data as unknown as AuditLogRow[]).map(mapAuditLog);
}

function mapAuditLog(row: AuditLogRow): AuditLogRecord {
  return {
    ...row,
    diff: row.diff ? mapJsonObject<Record<string, unknown>>(row.diff) : null,
  };
}

function mapJsonObject<T>(value: Json): T {
  return (value && typeof value === "object" && !Array.isArray(value) ? value : {}) as T;
}
