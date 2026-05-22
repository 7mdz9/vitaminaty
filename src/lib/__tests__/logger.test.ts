import { afterEach, describe, expect, it, vi } from "vitest";
import { logger, REDACTION_KEYS, withRequestContext } from "@/lib/logger";

function captureOutput() {
  const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

  return {
    stdout,
    stderr,
    output() {
      return [...stdout.mock.calls, ...stderr.mock.calls].map((call) => String(call[0])).join("");
    },
  };
}

describe("logger redaction", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exports one frozen auditable redaction key set", () => {
    expect(Object.isFrozen(REDACTION_KEYS)).toBe(true);
    expect(REDACTION_KEYS.has("supabase_service_role_key")).toBe(true);
    expect(REDACTION_KEYS.has("anthropic_api_key")).toBe(true);
    expect(REDACTION_KEYS.has("customer_email")).toBe(true);
  });

  it("redacts matching keys without leaking the original serialized value", () => {
    const captured = captureOutput();

    logger.info("test", { password: "hunter2" });

    expect(captured.output()).toContain('"password":"[REDACTED]"');
    expect(captured.output()).not.toContain("hunter2");
  });

  it("matches redaction keys case-insensitively", () => {
    const captured = captureOutput();

    logger.info("case", {
      Authorization: "Bearer secret-token",
      Customer_Email: "buyer@example.com",
    });

    expect(captured.output()).toContain('"Authorization":"[REDACTED]"');
    expect(captured.output()).toContain('"Customer_Email":"[REDACTED]"');
    expect(captured.output()).not.toContain("buyer@example.com");
  });

  it("redacts nested object keys", () => {
    const captured = captureOutput();

    logger.info("nested", { user: { token: "nested-token" } });

    expect(captured.output()).toContain('"token":"[REDACTED]"');
    expect(captured.output()).not.toContain("nested-token");
  });

  it("redacts keys inside arrays", () => {
    const captured = captureOutput();

    logger.info("array", { users: [{ password: "array-password" }] });

    expect(captured.output()).toContain('"password":"[REDACTED]"');
    expect(captured.output()).not.toContain("array-password");
  });

  it("redacts JWT-like values even when the key is not sensitive", () => {
    const captured = captureOutput();
    const jwtLike = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.signature";

    logger.info("jwt", { harmless: jwtLike });

    expect(captured.output()).toContain('"harmless":"[REDACTED]"');
    expect(captured.output()).not.toContain(jwtLike);
  });

  it("redacts Supabase key-like and PEM block values", () => {
    const captured = captureOutput();
    const supabaseLike = `sb_s_${"a".repeat(32)}`;
    const pemLike = "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----";

    logger.info("patterns", { first: supabaseLike, second: pemLike });

    expect(captured.output()).toContain('"first":"[REDACTED]"');
    expect(captured.output()).toContain('"second":"[REDACTED]"');
    expect(captured.output()).not.toContain(supabaseLike);
    expect(captured.output()).not.toContain("PRIVATE KEY");
  });

  it("filters debug output when LOG_LEVEL is info", () => {
    const captured = captureOutput();

    logger.debug("debug-only", { safe: "value" });

    expect(captured.output()).toBe("");
  });

  it("injects request-scoped context", () => {
    const captured = captureOutput();

    withRequestContext({ requestId: "req_123", userId: "user_123" }, () => {
      logger.info("context", { safe: "value" });
    });

    expect(captured.output()).toContain('"requestId":"req_123"');
    expect(captured.output()).toContain('"userId":"user_123"');
    expect(captured.output()).toContain('"safe":"value"');
  });

  it("merges nested request context", () => {
    const captured = captureOutput();

    withRequestContext({ requestId: "req_parent", userId: "user_parent" }, () => {
      withRequestContext({ adminId: "admin_child" }, () => {
        logger.info("nested-context");
      });
    });

    expect(captured.output()).toContain('"requestId":"req_parent"');
    expect(captured.output()).toContain('"userId":"user_parent"');
    expect(captured.output()).toContain('"adminId":"admin_child"');
  });

  it("marks circular references instead of throwing", () => {
    const captured = captureOutput();
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    logger.info("circular", { circular });

    expect(captured.output()).toContain('"self":"[CIRCULAR]"');
  });

  it("emits a warn line naming fields that fail during redaction", () => {
    const captured = captureOutput();
    const payload = {};
    Object.defineProperty(payload, "broken", {
      enumerable: true,
      get() {
        throw new Error("getter failed");
      },
    });

    logger.info("getter", payload);

    expect(captured.output()).toContain('"broken":"[REDACTED]"');
    expect(captured.output()).toContain("Log redaction issue");
    expect(captured.output()).toContain('"fields":["broken"]');
  });
});
