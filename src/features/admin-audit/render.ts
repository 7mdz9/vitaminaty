import type { AuditLogRecord } from "@/types/audit-log";

export type RenderedAuditDiff = Readonly<{
  summary: string;
  lines: string[];
  rawJson: string;
  affectedIds?: string[];
}>;

type JsonObject = Record<string, unknown>;

const piiFieldPattern = /(email|phone|recipient|customer_email|phone_e164)/i;
const moneyFieldPattern = /(aed|price|amount|total|subtotal|shipping_cost|vat)/i;

export function renderAuditEntry(entry: AuditLogRecord): RenderedAuditDiff {
  const diff = isObject(entry.diff) ? entry.diff : {};
  const action = stringValue(diff.action) ?? entry.action;
  const entityType = stringValue(diff.entity_type) ?? entry.entity_type;

  return {
    summary: renderSummary(entry, diff, action, entityType),
    lines: renderLines(diff, action),
    rawJson: JSON.stringify(entry.diff ?? {}, null, 2),
    affectedIds: readAffectedIds(diff),
  };
}

function renderSummary(
  entry: AuditLogRecord,
  diff: JsonObject,
  action: string,
  entityType: string,
): string {
  const actor = entry.actor_email ? redactEmail(entry.actor_email) : "Unknown admin";

  if (action === "bulk_operation") {
    return `${actor} ran ${stringValue(diff.operation) ?? "a bulk operation"} on ${
      numberValue(diff.affected_count) ?? readAffectedIds(diff).length
    } products`;
  }

  if (action === "bulk_publish_override") {
    return `${actor} bulk-published ${numberValue(diff.published_count) ?? 0} products`;
  }

  if (action === "order_status_change") {
    return `${actor} changed order ${stringValue(diff.order_reference) ?? entry.entity_id ?? ""}`;
  }

  if (action === "order_refund") {
    return `${actor} recorded a ${stringValue(diff.refund_kind) ?? "manual"} refund`;
  }

  return `${actor} ${humanize(action)} ${humanize(entityType)} ${entry.entity_id ?? ""}`.trim();
}

function renderLines(diff: JsonObject, action: string): string[] {
  if (Array.isArray(diff.changes)) {
    const variantLabel = stringValue(diff.variant_label);
    return diff.changes.filter(isObject).map((change) => renderFieldChange(change, variantLabel));
  }

  if (action === "bulk_operation") {
    return [
      `Affected products: ${numberValue(diff.affected_count) ?? readAffectedIds(diff).length}`,
    ];
  }

  if (action === "bulk_publish_override") {
    return [
      `Published products: ${numberValue(diff.published_count) ?? 0}`,
      `Override review flags: ${booleanValue(diff.override_review_flags) ? "yes" : "no"}`,
    ];
  }

  if (action === "order_status_change") {
    return [
      `Status: ${formatValue("status", diff.status_before)} → ${formatValue("status", diff.status_after)}`,
      `Reason: ${formatValue("reason", diff.reason)}`,
      `Customer: ${formatValue("customer_email", diff.customer_email)}`,
    ];
  }

  if (action === "order_refund") {
    return [
      `Refund: ${formatValue("amount_aed", diff.amount_aed)}`,
      `Kind: ${formatValue("refund_kind", diff.refund_kind)}`,
      `Customer: ${formatValue("customer_email", diff.customer_email)}`,
    ];
  }

  if (action === "mfa_enrolled") {
    return [
      `Recovery codes generated: ${formatValue("recovery_codes_count", diff.recovery_codes_count)}`,
    ];
  }

  return ["No structured diff fields available."];
}

function renderFieldChange(change: JsonObject, variantLabel: string | null): string {
  const field = stringValue(change.field) ?? "field";
  const label = field === "stock_quantity" && variantLabel ? `${field} (${variantLabel})` : field;

  if (field === "status") {
    return `Status: ${formatValue(field, change.before)} → ${formatValue(field, change.after)}`;
  }

  return `${label}: ${formatValue(field, change.before)} → ${formatValue(field, change.after)}`;
}

function formatValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "empty";
  }

  if (piiFieldPattern.test(field)) {
    return redactPii(String(value));
  }

  if (moneyFieldPattern.test(field) && typeof value === "number") {
    return `AED ${value}`;
  }

  if (Array.isArray(value)) {
    return value.map((item) => formatValue(field, item)).join(", ") || "empty";
  }

  if (isObject(value)) {
    return JSON.stringify(value);
  }

  return String(value).replaceAll("_", " ");
}

function redactPii(value: string): string {
  if (value.includes("@")) {
    return redactEmail(value);
  }

  return value.replace(/\d(?=\d{2})/g, "*");
}

function redactEmail(value: string): string {
  const [, domain] = value.split("@");

  if (!domain) {
    return value;
  }

  return `***@${domain}`;
}

function readAffectedIds(diff: JsonObject): string[] {
  for (const key of ["affected_product_ids", "published_product_ids", "hard_blocked_product_ids"]) {
    const value = diff[key];

    if (Array.isArray(value)) {
      return value.filter((item): item is string => typeof item === "string");
    }
  }

  return [];
}

function humanize(value: string): string {
  return value.replaceAll("_", " ");
}

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function booleanValue(value: unknown): boolean {
  return value === true;
}
