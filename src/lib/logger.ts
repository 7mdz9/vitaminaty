import { AsyncLocalStorage } from "node:async_hooks";
import { env } from "@/lib/env";

// Authz model: Logger has no authz -- any caller may invoke. Containment is via redaction, not access control.
// Redaction key design: env-var-named keys are stored with their full
// canonical name (e.g. paymob_integration_id_cards), not bare suffixes
// (e.g. integration_id_cards). Rationale: the env loader and adapters
// log under the canonical key, and the bare suffix is generic enough
// that adding it would over-redact unrelated integrations. Verified
// by the Step 3 manual checkpoint (TEST 2 finding) and intentionally
// not changed. Vercel automation bypass redaction follows the same
// canonical env-var-name pattern.

const REDACTED = "[REDACTED]";
const CIRCULAR = "[CIRCULAR]";

export const REDACTION_KEYS: ReadonlySet<string> = Object.freeze(
  new Set([
    "password",
    "passwd",
    "secret",
    "token",
    "api_key",
    "apikey",
    "authorization",
    "cookie",
    "set-cookie",
    "service_role_key",
    "service-role-key",
    "hmac_secret",
    "webhook_secret",
    "session_secret",
    "idempotency_hmac_secret",
    "anthropic_api_key",
    "resend_api_key",
    "paymob_api_key",
    "paymob_hmac_secret",
    "paymob_integration_id_cards",
    "paymob_integration_id_apple_pay",
    "paymob_integration_id_tabby",
    "paymob_integration_id_tamara",
    "icarry_api_key",
    "icarry_webhook_secret",
    "supabase_service_role_key",
    "supabase_jwt_secret",
    "supabase_db_password",
    "admin_session_secret",
    "upstash_redis_rest_token",
    "vercel_automation_bypass_secret",
    "sentry_dsn",
    "email",
    "phone",
    "phone_number",
    "address",
    "address_line_1",
    "address_line_2",
    "name_raw_pii",
    "customer_email",
    "customer_phone",
    "dob",
    "national_id",
    "card_number",
    "cvv",
    "pan",
  ]),
);

type LogLevel = "debug" | "info" | "warn" | "error";

type RequestContext = Readonly<{
  requestId?: string;
  userId?: string;
  adminId?: string;
}>;

type RedactionIssue = Readonly<{
  field: string;
  message: string;
}>;

const levelPriority: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const requestContext = new AsyncLocalStorage<RequestContext>();

const jwtLikePattern = /^eyJ[A-Za-z0-9_-]*(?:\.[A-Za-z0-9_-]+){0,2}$/;
const supabaseKeyPattern = /^sb_[a-z]_[A-Za-z0-9_-]{32,}$/;
const pemBlockPattern = /-----BEGIN[\s\S]+?-----END[\s\S]+?-----/;

function shouldLog(level: LogLevel): boolean {
  return levelPriority[level] >= levelPriority[env.LOG_LEVEL];
}

function isRedactionKey(key: string): boolean {
  return REDACTION_KEYS.has(key.toLowerCase());
}

function shouldRedactValue(value: string): boolean {
  return (
    jwtLikePattern.test(value) || supabaseKeyPattern.test(value) || pemBlockPattern.test(value)
  );
}

function redact(
  value: unknown,
  key: string,
  seen: WeakSet<object>,
  issues: RedactionIssue[],
): unknown {
  if (isRedactionKey(key)) return REDACTED;

  if (typeof value === "string") {
    return shouldRedactValue(value) ? REDACTED : value;
  }

  if (value === null || typeof value !== "object") return value;

  if (seen.has(value)) return CIRCULAR;
  seen.add(value);

  if (Array.isArray(value)) {
    const output = value.map((item, index) => redact(item, String(index), seen, issues));
    seen.delete(value);
    return output;
  }

  const output: Record<string, unknown> = {};

  for (const objectKey of Object.keys(value)) {
    try {
      output[objectKey] = redact(
        (value as Record<string, unknown>)[objectKey],
        objectKey,
        seen,
        issues,
      );
    } catch (error) {
      issues.push({
        field: objectKey,
        message: error instanceof Error ? error.message : "Unknown redaction error",
      });
      output[objectKey] = REDACTED;
    }
  }

  seen.delete(value);
  return output;
}

function buildLogEntry(
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>,
): { entry: Record<string, unknown>; issues: RedactionIssue[] } {
  const issues: RedactionIssue[] = [];
  const activeContext = requestContext.getStore() ?? {};
  const redactedContext = redact(context ?? {}, "context", new WeakSet(), issues);

  return {
    entry: {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...activeContext,
      context: redactedContext,
    },
    issues,
  };
}

function serializeEntry(entry: Record<string, unknown>): string {
  if (env.VITAMINATY_APP_ENV === "development") {
    const { level, message } = entry;
    const details = {
      requestId: entry.requestId,
      userId: entry.userId,
      adminId: entry.adminId,
      context: entry.context,
    };
    return `[${level}] ${message} ${JSON.stringify(details)}\n`;
  }

  return `${JSON.stringify(entry)}\n`;
}

function write(level: LogLevel, line: string): void {
  if (level === "warn" || level === "error") {
    process.stderr.write(line);
    return;
  }

  process.stdout.write(line);
}

function emitRedactionIssues(issues: RedactionIssue[]): void {
  if (issues.length === 0) return;

  const entry = {
    level: "warn",
    message: "Log redaction issue",
    timestamp: new Date().toISOString(),
    ...requestContext.getStore(),
    context: {
      fields: issues.map((issue) => issue.field),
    },
  };

  write("warn", serializeEntry(entry));
}

function log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  if (!shouldLog(level)) return;

  const { entry, issues } = buildLogEntry(level, message, context);
  write(level, serializeEntry(entry));
  emitRedactionIssues(issues);
}

export const logger = Object.freeze({
  debug(message: string, context?: Record<string, unknown>) {
    log("debug", message, context);
  },
  info(message: string, context?: Record<string, unknown>) {
    log("info", message, context);
  },
  warn(message: string, context?: Record<string, unknown>) {
    log("warn", message, context);
  },
  error(message: string, context?: Record<string, unknown>) {
    log("error", message, context);
  },
});

export function withRequestContext<T>(
  context: RequestContext,
  fn: () => T | Promise<T>,
): T | Promise<T> {
  const parent = requestContext.getStore() ?? {};
  return requestContext.run({ ...parent, ...context }, fn);
}
