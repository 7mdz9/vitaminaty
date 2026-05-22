export type AuditAction =
  | "create"
  | "update"
  | "publish"
  | "unpublish"
  | "archive"
  | "restore"
  | "flag_toggle"
  | "image_upload"
  | "role_change";

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
