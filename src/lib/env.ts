import "server-only";

import { z } from "zod";
import { publicEnv, publicEnvSchema } from "./env.public";

const blankToUndefined = (value: unknown) => (value === "" ? undefined : value);

const requiredString = z.string().trim().min(1, "Required");
const optionalString = z.preprocess(blankToUndefined, z.string().trim().min(1).optional());
const optionalUrl = z.preprocess(blankToUndefined, z.string().url().optional());
const requiredSecret = z.string().min(32, "Must be at least 32 characters");
const optionalBoolean = z.preprocess((value) => {
  if (value === "" || value === undefined) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}, z.boolean().optional().default(false));
const optionalIntegerWithDefault = (defaultValue: number) =>
  z.preprocess((value) => {
    if (value === "" || value === undefined) return undefined;
    if (typeof value === "string") return Number(value);
    return value;
  }, z.number().int().positive().default(defaultValue));

export const envSchema = publicEnvSchema.extend({
  VITAMINATY_APP_URL: z.string().url(),
  VITAMINATY_APP_ENV: z.enum(["development", "staging", "production"]),

  SUPABASE_SERVICE_ROLE_KEY: requiredString,
  SUPABASE_PROJECT_REF: requiredString,
  SUPABASE_DB_PASSWORD: optionalString,
  SUPABASE_JWT_SECRET: requiredString,

  PAYMOB_API_KEY: optionalString,
  PAYMOB_HMAC_SECRET: optionalString,
  PAYMOB_INTEGRATION_ID_CARDS: optionalString,
  PAYMOB_INTEGRATION_ID_APPLE_PAY: optionalString,
  PAYMOB_INTEGRATION_ID_TABBY: optionalString,
  PAYMOB_INTEGRATION_ID_TAMARA: optionalString,
  PAYMOB_IFRAME_ID: optionalString,
  PAYMOB_BASE_URL: z.preprocess(
    blankToUndefined,
    z.string().url().default("https://accept.paymob.com/api"),
  ),
  PAYMOB_MODE: z.enum(["stub", "live"]),

  ICARRY_API_KEY: optionalString,
  ICARRY_ACCOUNT_ID: optionalString,
  ICARRY_BASE_URL: optionalUrl,
  ICARRY_WEBHOOK_SECRET: optionalString,
  ICARRY_MODE: z.enum(["stub", "live"]),
  ICARRY_ORIGIN_ADDRESS_ID: optionalString,

  EMAIL_PROVIDER: z.enum(["resend", "stub"]),
  RESEND_API_KEY: optionalString,
  EMAIL_FROM_ADDRESS: z.string().email(),
  EMAIL_FROM_NAME: requiredString,
  EMAIL_REPLY_TO: z.string().email(),

  ADMIN_SESSION_SECRET: requiredSecret,
  INITIAL_ADMIN_EMAIL: z.string().email(),
  MFA_ISSUER_NAME: requiredString,

  FEATURE_FLAGS_PROVIDER: z.enum(["database", "env"]),
  MAINTENANCE_MODE: optionalBoolean,
  LOG_LEVEL: z.preprocess(
    blankToUndefined,
    z.enum(["debug", "info", "warn", "error"]).default("info"),
  ),
  SENTRY_DSN: optionalUrl,

  RATE_LIMIT_BACKEND: z.enum(["memory", "upstash"]),
  UPSTASH_REDIS_REST_URL: optionalUrl,
  UPSTASH_REDIS_REST_TOKEN: optionalString,

  IDEMPOTENCY_HMAC_SECRET: requiredSecret,
  WEBHOOK_REPLAY_WINDOW_SECONDS: optionalIntegerWithDefault(300),

  SUPPORT_CHAT_PROVIDER: z.enum(["null", "anthropic"]),
  ANTHROPIC_API_KEY: optionalString,

  // Platform-injected by Vercel (not in spec inventory); read by /api/health for build identification.
  VERCEL_GIT_COMMIT_SHA: optionalString,
  // Vercel "Protection Bypass for Automation" token. Used by verification scripts to hit protected preview deploys. Generated in the Vercel dashboard, set via Vercel env settings. Treated as a High-sensitivity operational secret per THREAT_MODEL.md §2.3.
  VERCEL_AUTOMATION_BYPASS_SECRET: optionalString,
});

export type Env = Readonly<z.infer<typeof envSchema>>;

export class EnvValidationError extends Error {
  readonly issues: z.ZodIssue[];

  constructor(issues: z.ZodIssue[]) {
    super(formatEnvIssues(issues));
    this.name = "EnvValidationError";
    this.issues = issues;
  }
}

export function formatEnvIssues(issues: z.ZodIssue[]): string {
  const lines = issues.map((issue) => {
    const variableName = issue.path.join(".") || "ENV";
    return `  - ${variableName}: ${issue.message}`;
  });

  return ["Env validation failed:", ...lines].join("\n");
}

export function parseEnv(input: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(input);

  if (!parsed.success) {
    throw new EnvValidationError(parsed.error.issues);
  }

  return Object.freeze(parsed.data);
}

export const env = parseEnv(process.env);
export { publicEnv };
