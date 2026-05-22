import type { NextConfig } from "next";
import { existsSync, readFileSync } from "node:fs";
import { z } from "zod";

function loadLocalEnvFile() {
  if (!existsSync(".env.local")) return;

  const lines = readFileSync(".env.local", "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();

    process.env[key] ??= value;
  }
}

loadLocalEnvFile();

const requiredSecret = z.string().min(32, "Must be at least 32 characters");
const bootEnvSchema = z.object({
  VITAMINATY_APP_URL: z.string().url(),
  VITAMINATY_APP_ENV: z.enum(["development", "staging", "production"]),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_APP_ENV: z.enum(["development", "staging", "production"]),
  NEXT_PUBLIC_SITE_NAME: z.string().trim().min(1, "Required"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().trim().min(1, "Required"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().trim().min(1, "Required"),
  SUPABASE_PROJECT_REF: z.string().trim().min(1, "Required"),
  SUPABASE_JWT_SECRET: z.string().trim().min(1, "Required"),
  PAYMOB_MODE: z.enum(["stub", "live"]),
  ICARRY_MODE: z.enum(["stub", "live"]),
  EMAIL_PROVIDER: z.enum(["resend", "stub"]),
  EMAIL_FROM_ADDRESS: z.string().email(),
  EMAIL_FROM_NAME: z.string().trim().min(1, "Required"),
  EMAIL_REPLY_TO: z.string().email(),
  ADMIN_SESSION_SECRET: requiredSecret,
  INITIAL_ADMIN_EMAIL: z.string().email(),
  MFA_ISSUER_NAME: z.string().trim().min(1, "Required"),
  FEATURE_FLAGS_PROVIDER: z.enum(["database", "env"]),
  RATE_LIMIT_BACKEND: z.enum(["memory", "upstash"]),
  IDEMPOTENCY_HMAC_SECRET: requiredSecret,
  SUPPORT_CHAT_PROVIDER: z.enum(["null", "anthropic"]),
});

const bootEnv = bootEnvSchema.safeParse(process.env);

if (!bootEnv.success) {
  const lines = bootEnv.error.issues.map((issue) => {
    const variableName = issue.path.join(".") || "ENV";
    return `  - ${variableName}: ${issue.message}`;
  });

  throw new Error(["Env validation failed:", ...lines].join("\n"));
}

const nextConfig: NextConfig = {};

export default nextConfig;
