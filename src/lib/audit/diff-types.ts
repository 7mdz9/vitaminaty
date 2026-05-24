import type { Database, Json } from "@/lib/supabase/types.generated";

export type AuditAction = Database["public"]["Enums"]["audit_action"];

export type AuditScalar = string | number | boolean | null;
export type AuditValue = AuditScalar | Json;

export type AuditFieldChange = Readonly<{
  field: string;
  before: AuditValue;
  after: AuditValue;
}>;

export type AuditProductUpdateAction =
  | "create"
  | "update"
  | "publish"
  | "unpublish"
  | "archive"
  | "restore"
  | "flag_toggle"
  | "image_upload";

export type AuditProductUpdateDiff = Readonly<{
  version: 1;
  action: AuditProductUpdateAction;
  entity_type: "product";
  product_id: string;
  changes: AuditFieldChange[];
}>;

export type AuditVariantStockAction =
  | "stock_adjustment"
  | "stock_recount"
  | "variant_create"
  | "variant_delete"
  | "low_stock_threshold_change";

export type AuditVariantStockDiff = Readonly<{
  version: 1;
  action: AuditVariantStockAction;
  entity_type: "product_variant";
  product_id: string;
  variant_id: string;
  variant_label: string;
  previous_quantity: number | null;
  new_quantity: number;
  change_amount: number;
  reason: string;
  change_reason_note: string | null;
  changes: AuditFieldChange[];
}>;

export type AuditBulkOperationChange = Readonly<{
  field: string;
  before_by_product_id: Record<string, AuditValue>;
  after: AuditValue;
}>;

export type AuditBulkOperationDiff = Readonly<{
  version: 1;
  action: "bulk_operation";
  entity_type: "bulk";
  operation: string;
  affected_product_ids: string[];
  affected_count: number;
  changes: AuditBulkOperationChange[];
}>;

export type AuditBulkPublishOverrideDiff = Readonly<{
  version: 1;
  action: "bulk_publish_override";
  entity_type: "bulk_publish";
  published_product_ids: string[];
  published_count: number;
  override_review_flags: true;
  products_with_review_flags_count: number;
  review_flags_by_product_id: Record<string, string[]>;
  hard_blocked_product_ids: string[];
}>;

export type AuditActorSnapshot = Readonly<{
  user_id: string;
  email: string;
}>;

export type AuditStaleDataOverrideDiff = Readonly<{
  version: 1;
  action: "stale_data_override";
  entity_type: "product";
  product_id: string;
  loaded_updated_at: string;
  database_updated_at: string;
  original_editor: AuditActorSnapshot;
  overridden_by: AuditActorSnapshot;
  changes: AuditFieldChange[];
}>;

export type AuditOrderStatusChangeDiff = Readonly<{
  version: 1;
  action: "order_status_change";
  entity_type: "order";
  order_id: string;
  order_reference: string;
  status_before: string;
  status_after: string;
  reason: string;
  tracking_number: string | null;
  customer_email: string;
  notify_customer: boolean;
}>;

export type AuditRefundLineItem = Readonly<{
  order_item_id: string;
  product_id: string;
  variant_id: string | null;
  quantity_refunded: number;
  amount_aed: number;
}>;

export type AuditRefundDiff = Readonly<{
  version: 1;
  action: "order_refund";
  entity_type: "order";
  order_id: string;
  order_reference: string;
  refund_kind: "full" | "partial";
  amount_aed: number;
  currency: "AED";
  reason: string;
  customer_email: string;
  payment_event_ids: string[];
  goods_returned_to_inventory: boolean;
  inventory_movement_ids: string[];
  line_items: AuditRefundLineItem[];
}>;

export type AuditMfaEnrolledDiff = Readonly<{
  version: 1;
  action: "mfa_enrolled";
  entity_type: "admin_user";
  user_id: string;
  factor_type: "totp";
  factor_id: string;
  recovery_codes_count: number;
}>;

export type AuditDiff =
  | AuditProductUpdateDiff
  | AuditVariantStockDiff
  | AuditBulkOperationDiff
  | AuditBulkPublishOverrideDiff
  | AuditStaleDataOverrideDiff
  | AuditOrderStatusChangeDiff
  | AuditRefundDiff
  | AuditMfaEnrolledDiff;

export function auditDiffToJson(diff: AuditDiff): Json {
  return diff as unknown as Json;
}
