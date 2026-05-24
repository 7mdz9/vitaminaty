import "server-only";

import { headers } from "next/headers";
import { appendEntry } from "@/server/repositories/audit-log-repository";
import { auditDiffToJson, type AuditDiff } from "@/lib/audit/diff-types";
import type { Database } from "@/lib/supabase/types.generated";
import type { AuditLogRecord } from "@/types/audit-log";

type AuditLogInsert = Database["public"]["Tables"]["audit_log"]["Insert"];
type AuditLogClient = Parameters<typeof appendEntry>[1];

export type AuditActor = Readonly<{
  userId: string | null;
  email: string | null;
}>;

export type RecordAuditInput = Readonly<{
  actor: AuditActor;
  diff: AuditDiff;
  entityId?: string | null;
  occurredAt?: string;
}>;

export async function record(
  input: RecordAuditInput,
  client?: AuditLogClient,
): Promise<AuditLogRecord> {
  const requestContext = await readAuditRequestContext();
  const row: AuditLogInsert = {
    actor_user_id: input.actor.userId,
    actor_email: input.actor.email,
    action: input.diff.action,
    entity_type: input.diff.entity_type,
    entity_id: input.entityId ?? inferEntityId(input.diff),
    diff: auditDiffToJson(input.diff),
    ip: requestContext.ip,
    user_agent: requestContext.userAgent,
    occurred_at: input.occurredAt,
  };

  return appendEntry(row, client);
}

async function readAuditRequestContext(): Promise<{ ip: string | null; userAgent: string | null }> {
  try {
    const headerStore = await headers();
    const forwardedFor = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim();

    return {
      ip: forwardedFor || headerStore.get("x-real-ip"),
      userAgent: headerStore.get("user-agent"),
    };
  } catch {
    return {
      ip: null,
      userAgent: null,
    };
  }
}

function inferEntityId(diff: AuditDiff): string | null {
  switch (diff.entity_type) {
    case "product":
      return diff.product_id;
    case "product_variant":
      return diff.variant_id;
    case "order":
      return diff.order_id;
    case "admin_user":
      return diff.user_id;
    case "bulk":
    case "bulk_publish":
      return null;
  }
}
