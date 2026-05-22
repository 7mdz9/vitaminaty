import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "tests/unit/server-only-stub.ts"),
    },
  },
  test: {
    environment: "node",
    env: {
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
    },
    include: ["tests/**/*.test.ts"],
  },
});
