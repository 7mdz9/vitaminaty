import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const expectedAuditActions = [
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
];

describe("0013 audit_action extension", () => {
  it("extends audit_action to the approved migration-order baseline", () => {
    const output = runLocalPsql("select enum_range(null::audit_action)::text");
    const values = output
      .replace(/^{|}$/g, "")
      .split(",")
      .filter(Boolean);

    expect(values).toEqual(expectedAuditActions);
  });
});

function runLocalPsql(sql: string): string {
  return execFileSync(
    "docker",
    ["exec", "-i", "supabase_db_vitaminaty", "psql", "-U", "postgres", "-d", "postgres", "-tAc", sql],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  ).trim();
}
