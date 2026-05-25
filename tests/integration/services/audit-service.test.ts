import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { AuditDiff, AuditProductUpdateDiff } from "@/lib/audit/diff-types";
import type { Database } from "@/lib/supabase/types.generated";
import { createLocalAdminClient, readLocalSupabaseEnv } from "../../fixtures/customers";

vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers({
      "x-forwarded-for": "203.0.113.10, 10.0.0.1",
      "user-agent": "audit-service-test-agent",
    }),
}));

const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const actorEmail = `audit-actor-${runId}@example.test`;
const actorPassword = "audit-service-test-password-1234567890";

let adminClient: SupabaseClient<Database>;
let actorUserId: string;
const auditLogIds: string[] = [];

describe("audit-service", () => {
  beforeAll(async () => {
    const localEnv = readLocalSupabaseEnv();
    adminClient = createLocalAdminClient(localEnv);
    const authClient = createClient<Database>(localEnv.apiUrl, localEnv.serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await authClient.auth.admin.createUser({
      email: actorEmail,
      password: actorPassword,
      email_confirm: true,
      app_metadata: { role: "admin" },
    });

    if (error || !data.user) {
      throw new Error(`Could not create audit test actor: ${error?.message ?? "missing user"}`);
    }

    actorUserId = data.user.id;
  });

  afterAll(async () => {
    if (auditLogIds.length > 0) {
      await adminClient.from("audit_log").delete().in("id", auditLogIds);
    }

    if (actorUserId) {
      await adminClient.auth.admin.deleteUser(actorUserId);
    }
  });

  it("writes actor, IP, user agent, and a single-product update diff", async () => {
    const { record } = await import("@/server/services/audit-service");
    const diff = buildDiffs()[0] as AuditProductUpdateDiff;
    const entry = await record(
      {
        actor: { userId: actorUserId, email: actorEmail },
        diff,
        occurredAt: "2026-05-24T10:00:00.000Z",
      },
      adminClient,
    );
    auditLogIds.push(entry.id);

    expect(entry).toMatchObject({
      actor_user_id: actorUserId,
      actor_email: actorEmail,
      action: diff.action,
      entity_type: diff.entity_type,
      entity_id: diff.product_id,
      ip: "203.0.113.10",
      user_agent: "audit-service-test-agent",
      diff,
    });
  });

  it("round-trips all approved audit diff shapes through JSONB", async () => {
    const { record } = await import("@/server/services/audit-service");

    for (const diff of buildDiffs()) {
      const entry = await record(
        {
          actor: { userId: actorUserId, email: actorEmail },
          diff,
        },
        adminClient,
      );
      auditLogIds.push(entry.id);

      expect(entry.diff).toEqual(diff);
      expect(entry.action).toBe(diff.action);
      expect(entry.entity_type).toBe(diff.entity_type);
    }
  });
});

function buildDiffs(): AuditDiff[] {
  return [
    {
      version: 1,
      action: "update",
      entity_type: "product",
      product_id: "00000000-0000-4000-8000-000000000001",
      changes: [{ field: "retail_price_aed", before: 89, after: 94 }],
    },
    {
      version: 1,
      action: "stock_adjustment",
      entity_type: "product_variant",
      product_id: "00000000-0000-4000-8000-000000000001",
      variant_id: "00000000-0000-4000-8000-000000000002",
      variant_label: "Chocolate 2kg",
      previous_quantity: 12,
      new_quantity: 8,
      change_amount: -4,
      reason: "manual_adjustment",
      change_reason_note: "Damaged units removed",
      changes: [{ field: "stock_quantity", before: 12, after: 8 }],
    },
    {
      version: 1,
      action: "bulk_operation",
      entity_type: "bulk",
      operation: "assign_category",
      affected_product_ids: ["00000000-0000-4000-8000-000000000001"],
      affected_count: 1,
      changes: [
        {
          field: "category_id",
          before_by_product_id: { "00000000-0000-4000-8000-000000000001": null },
          after: "00000000-0000-4000-8000-000000000003",
        },
      ],
    },
    {
      version: 1,
      action: "bulk_publish_override",
      entity_type: "bulk_publish",
      published_product_ids: ["00000000-0000-4000-8000-000000000001"],
      published_count: 1,
      override_review_flags: true,
      products_with_review_flags_count: 1,
      review_flags_by_product_id: {
        "00000000-0000-4000-8000-000000000001": ["missing_image"],
      },
      hard_blocked_product_ids: ["00000000-0000-4000-8000-000000000004"],
    },
    {
      version: 1,
      action: "stale_data_override",
      entity_type: "product",
      product_id: "00000000-0000-4000-8000-000000000001",
      loaded_updated_at: "2026-05-23T10:00:00.000Z",
      database_updated_at: "2026-05-23T10:03:00.000Z",
      original_editor: {
        user_id: "00000000-0000-4000-8000-000000000005",
        email: "other-admin@example.com",
      },
      overridden_by: {
        user_id: "00000000-0000-4000-8000-000000000006",
        email: "admin@example.com",
      },
      changes: [{ field: "retail_price_aed", before: 89, after: 94 }],
    },
    {
      version: 1,
      action: "order_status_change",
      entity_type: "order",
      order_id: "00000000-0000-4000-8000-000000000007",
      order_reference: "VIT-1001",
      status_before: "paid",
      status_after: "preparing",
      reason: "manual_admin_transition",
      tracking_number: null,
      customer_email: "customer@example.com",
      notify_customer: true,
    },
    {
      version: 1,
      action: "order_refund",
      entity_type: "order",
      order_id: "00000000-0000-4000-8000-000000000007",
      order_reference: "VIT-1001",
      refund_kind: "partial",
      amount_aed: 50,
      currency: "AED",
      reason: "customer_request",
      customer_email: "customer@example.com",
      payment_event_ids: ["00000000-0000-4000-8000-000000000008"],
      goods_returned_to_inventory: false,
      inventory_movement_ids: [],
      line_items: [
        {
          order_item_id: "00000000-0000-4000-8000-000000000009",
          product_id: "00000000-0000-4000-8000-000000000001",
          variant_id: "00000000-0000-4000-8000-000000000002",
          quantity_refunded: 1,
          amount_aed: 50,
        },
      ],
    },
    {
      version: 1,
      action: "mfa_enrolled",
      entity_type: "admin_user",
      user_id: "00000000-0000-4000-8000-000000000010",
      factor_type: "totp",
      factor_id: "totp-factor",
      recovery_codes_count: 10,
    },
  ];
}
