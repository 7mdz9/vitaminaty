import { describe, expect, it } from "vitest";
import { renderAuditEntry } from "@/features/admin-audit/render";
import type { AuditLogRecord } from "@/types/audit-log";

describe("audit diff renderer", () => {
  it("renders money, status, and actor email with redaction", () => {
    const rendered = renderAuditEntry(
      auditEntryFactory({
        actor_email: "admin@example.test",
        action: "update",
        entity_type: "product",
        diff: {
          version: 1,
          action: "update",
          entity_type: "product",
          product_id: "00000000-0000-4000-8000-000000000001",
          changes: [
            { field: "retail_price_aed", before: 89, after: 94 },
            { field: "status", before: "imported", after: "published" },
          ],
        },
      }),
    );

    expect(rendered.summary).toContain("***@example.test");
    expect(rendered.lines).toContain("retail_price_aed: AED 89 → AED 94");
    expect(rendered.lines).toContain("Status: imported → published");
  });

  it("redacts PII fields in rendered lines while raw JSON remains available", () => {
    const rendered = renderAuditEntry(
      auditEntryFactory({
        action: "order_status_change",
        entity_type: "order",
        diff: {
          version: 1,
          action: "order_status_change",
          entity_type: "order",
          order_id: "00000000-0000-4000-8000-000000000010",
          order_reference: "VIT-TEST-001",
          status_before: "paid",
          status_after: "preparing",
          reason: "manual_admin_transition",
          tracking_number: null,
          customer_email: "customer@example.test",
          notify_customer: true,
        },
      }),
    );

    expect(rendered.lines).toContain("Customer: ***@example.test");
    expect(rendered.rawJson).toContain("customer@example.test");
  });

  it("summarizes bulk operations and exposes affected ids", () => {
    const rendered = renderAuditEntry(
      auditEntryFactory({
        action: "bulk_operation",
        entity_type: "bulk",
        diff: {
          version: 1,
          action: "bulk_operation",
          entity_type: "bulk",
          operation: "assign_brand",
          affected_product_ids: [
            "00000000-0000-4000-8000-000000000001",
            "00000000-0000-4000-8000-000000000002",
          ],
          affected_count: 2,
          changes: [],
        },
      }),
    );

    expect(rendered.summary).toContain("assign_brand");
    expect(rendered.affectedIds).toEqual([
      "00000000-0000-4000-8000-000000000001",
      "00000000-0000-4000-8000-000000000002",
    ]);
  });
});

function auditEntryFactory(overrides: Partial<AuditLogRecord> = {}): AuditLogRecord {
  return {
    id: "00000000-0000-4000-8000-000000000100",
    actor_user_id: "00000000-0000-4000-8000-000000000200",
    actor_email: "admin@example.test",
    action: "update",
    entity_type: "product",
    entity_id: "00000000-0000-4000-8000-000000000001",
    diff: null,
    ip: "127.0.0.1",
    user_agent: "vitest",
    occurred_at: "2026-05-24T16:00:00.000Z",
    ...overrides,
  };
}
