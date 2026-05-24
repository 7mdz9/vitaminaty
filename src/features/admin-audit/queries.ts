import "server-only";

import { requireAdmin } from "@/lib/auth/policies";
import {
  AuditLogListSearchParamsSchema,
  type AuditLogListSearchParams,
} from "@/lib/validation/audit-log";
import {
  listEntriesForAdmin,
  type AuditLogListResult,
} from "@/server/repositories/audit-log-repository";
import type { AuditAction } from "@/types/audit-log";

export type AdminAuditLogListInput = Readonly<{
  actor?: string;
  action?: AuditAction;
  entityType?: string;
  entityId?: string;
  dateFrom?: string;
  dateTo?: string;
  page: number;
}>;

export function parseAuditLogSearchParams(
  params: AuditLogListSearchParams,
): AdminAuditLogListInput {
  const parsed = AuditLogListSearchParamsSchema.parse(params);

  return {
    actor: parsed.actor || undefined,
    action: parsed.action,
    entityType: parsed.entity_type || undefined,
    entityId: parsed.entity_id,
    dateFrom: toStartOfDayIso(parsed.date_from),
    dateTo: toEndOfDayIso(parsed.date_to),
    page: parsed.page ?? 1,
  };
}

export async function getAuditLogList(input: AdminAuditLogListInput): Promise<AuditLogListResult> {
  await requireAdmin();

  return listEntriesForAdmin({
    actor: input.actor,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    page: input.page,
    pageSize: 50,
  });
}

function toStartOfDayIso(value?: string): string | undefined {
  return value ? `${value}T00:00:00.000Z` : undefined;
}

function toEndOfDayIso(value?: string): string | undefined {
  return value ? `${value}T23:59:59.999Z` : undefined;
}
