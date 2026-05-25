import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("0014 admin MFA recovery", () => {
  it("creates service-role-only recovery code storage with RLS enabled", () => {
    expect(
      runLocalPsql(
        "select count(*) from information_schema.tables where table_schema='public' and table_name='admin_mfa_recovery_codes'",
      ),
    ).toBe("1");
    expect(
      runLocalPsql(
        "select relrowsecurity from pg_class where relname='admin_mfa_recovery_codes' and relnamespace='public'::regnamespace",
      ),
    ).toBe("t");
    expect(
      runLocalPsql("select count(*) from pg_policies where tablename='admin_mfa_recovery_codes'"),
    ).toBe("0");
  });
});

function runLocalPsql(sql: string): string {
  return execFileSync(
    "docker",
    [
      "exec",
      "-i",
      "supabase_db_vitaminaty",
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-tAc",
      sql,
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  ).trim();
}
