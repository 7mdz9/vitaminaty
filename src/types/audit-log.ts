export type AuditAction =
  | "create"
  | "update"
  | "publish"
  | "unpublish"
  | "archive"
  | "restore"
  | "flag_toggle"
  | "image_upload"
  | "role_change"
  | "bulk_operation"
  | "bulk_publish_override"
  | "stale_data_override"
  | "stock_adjustment"
  | "stock_recount"
  | "variant_create"
  | "variant_delete"
  | "low_stock_threshold_change"
  | "order_status_change"
  | "order_refund"
  | "mfa_reset"
  | "integration_credentials_update";

export interface AuditLogRecord {
  id: string;
  actor_user_id: string | null;
  actor_email: string | null;
  action: AuditAction;
  entity_type: string;
  entity_id: string | null;
  diff: Record<string, unknown> | null;
  ip: string | null;
  user_agent: string | null;
  occurred_at: string;
}
