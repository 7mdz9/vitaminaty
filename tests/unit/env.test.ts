import { describe, expect, it } from "vitest";
import { EnvValidationError, parseEnv } from "@/lib/env";
import { parsePublicEnv } from "@/lib/env.public";

const validEnv = {
  VITAMINATY_APP_URL: "http://localhost:3000",
  VITAMINATY_APP_ENV: "development",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  NEXT_PUBLIC_APP_ENV: "development",
  NEXT_PUBLIC_SITE_NAME: "Vitaminaty",
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  SUPABASE_PROJECT_REF: "example",
  SUPABASE_JWT_SECRET: "jwt-secret",
  PAYMOB_MODE: "stub",
  ICARRY_MODE: "stub",
  EMAIL_PROVIDER: "stub",
  EMAIL_FROM_ADDRESS: "orders@vitaminaty.ae",
  EMAIL_FROM_NAME: "Vitaminaty",
  EMAIL_REPLY_TO: "support@vitaminaty.ae",
  ADMIN_SESSION_SECRET: "a".repeat(32),
  INITIAL_ADMIN_EMAIL: "admin@vitaminaty.ae",
  MFA_ISSUER_NAME: "Vitaminaty Admin",
  FEATURE_FLAGS_PROVIDER: "database",
  RATE_LIMIT_BACKEND: "memory",
  IDEMPOTENCY_HMAC_SECRET: "b".repeat(32),
  SUPPORT_CHAT_PROVIDER: "null",
};

describe("env loader", () => {
  it("reports all missing required variables together", () => {
    expect(() => parseEnv({})).toThrow(EnvValidationError);

    try {
      parseEnv({});
    } catch (error) {
      expect(error).toBeInstanceOf(EnvValidationError);
      expect((error as Error).message).toContain("Env validation failed:");
      expect((error as Error).message).toContain("NEXT_PUBLIC_SUPABASE_URL");
      expect((error as Error).message).toContain("SUPABASE_SERVICE_ROLE_KEY");
      expect((error as Error).message).toContain("ADMIN_SESSION_SECRET");
    }
  });

  it("fails when an enum variable is invalid", () => {
    expect(() =>
      parseEnv({
        ...validEnv,
        PAYMOB_MODE: "sandbox",
      }),
    ).toThrow(/PAYMOB_MODE/);
  });

  it("keeps server-only variables out of the public export", () => {
    const parsed = parsePublicEnv(validEnv);

    expect(parsed.NEXT_PUBLIC_SUPABASE_URL).toBe(validEnv.NEXT_PUBLIC_SUPABASE_URL);
    expect("SUPABASE_SERVICE_ROLE_KEY" in parsed).toBe(false);
  });
});
