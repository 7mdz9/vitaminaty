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

export type AuditLogListFilters = Readonly<{
  actor?: string;
  action?: AuditLogRow["action"];
  entityType?: string;
  entityId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}>;

export type AuditLogListResult = Readonly<{
  entries: AuditLogRecord[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}>;

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

export async function listEntriesForAdmin(
  filters: AuditLogListFilters = {},
  client: AdminClient = supabaseAdmin,
): Promise<AuditLogListResult> {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = client
    .from("audit_log")
    .select(AUDIT_LOG_COLUMNS, { count: "exact" })
    .order("occurred_at", { ascending: false })
    .range(from, to);

  if (filters.actor) {
    const actorSearch = `actor_email.ilike.%${escapeLikePattern(filters.actor)}%`;
    query = query.or(
      isUuid(filters.actor) ? `${actorSearch},actor_user_id.eq.${filters.actor}` : actorSearch,
    );
  }

  if (filters.action) {
    query = query.eq("action", filters.action);
  }

  if (filters.entityType) {
    query = query.eq("entity_type", filters.entityType);
  }

  if (filters.entityId) {
    query = query.eq("entity_id", filters.entityId);
  }

  if (filters.dateFrom) {
    query = query.gte("occurred_at", filters.dateFrom);
  }

  if (filters.dateTo) {
    query = query.lte("occurred_at", filters.dateTo);
  }

  const { data, count, error } = await query;

  if (error) {
    throw new Error(`Audit log admin query failed: ${error.message}`);
  }

  const total = count ?? 0;

  return {
    entries: (data as unknown as AuditLogRow[]).map(mapAuditLog),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
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

function escapeLikePattern(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
