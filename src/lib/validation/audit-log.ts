import { z } from "zod";
import type { AuditAction } from "@/types/audit-log";

const auditActions = [
  "create",
  "update",
  "publish",
  "unpublish",
  "archive",
  "restore",
  "flag_toggle",
  "image_upload",
  "role_change",
  "bulk_operation",
  "bulk_publish_override",
  "stale_data_override",
  "stock_adjustment",
  "stock_recount",
  "variant_create",
  "variant_delete",
  "low_stock_threshold_change",
  "order_status_change",
  "order_refund",
  "mfa_reset",
  "integration_credentials_update",
  "mfa_enrolled",
  "delete",
  "feature_flag_override",
] as const satisfies readonly AuditAction[];

export const AuditLogListSearchParamsSchema = z.object({
  actor: z.string().trim().optional(),
  action: z.enum(auditActions).optional(),
  entity_type: z.string().trim().optional(),
  entity_id: z.string().uuid().optional(),
  date_from: z.string().trim().optional(),
  date_to: z.string().trim().optional(),
  page: z.coerce.number().int().positive().optional(),
});

export type AuditLogListSearchParams = z.input<typeof AuditLogListSearchParamsSchema>;
export type AuditLogActionOption = (typeof auditActions)[number];

export const auditLogActionOptions = [...auditActions];
