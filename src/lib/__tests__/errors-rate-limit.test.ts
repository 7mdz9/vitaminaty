import { describe, expect, it } from "vitest";
import {
  AppError,
  AuthorizationError,
  IntegrationError,
  isAppError,
  NotFoundError,
  PaymentError,
  ValidationError,
} from "@/lib/errors";
import { createRateLimiter, MemoryRateLimiter, UpstashRateLimiter } from "@/lib/rate-limit";

describe("app errors", () => {
  it("carries stable code strings and supports isAppError narrowing", () => {
    const errors = [
      new ValidationError({ message: "Bad input" }),
      new NotFoundError({ message: "Missing" }),
      new AuthorizationError({ message: "Forbidden" }),
      new PaymentError({ code: "payment_declined", message: "Declined" }),
      new IntegrationError({ code: "vendor_down", message: "Vendor down" }),
    ];

    expect(errors.every((error) => error instanceof AppError)).toBe(true);
    expect(errors.map((error) => error.code)).toEqual([
      "validation_error",
      "not_found",
      "authorization_error",
      "payment_declined",
      "vendor_down",
    ]);
    expect(isAppError(errors[0])).toBe(true);
    expect(isAppError(new Error("plain"))).toBe(false);
  });
});

describe("rate limiter", () => {
  it("allows requests until the memory bucket limit is exceeded", async () => {
    const limiter = new MemoryRateLimiter();
    const options = { limit: 2, windowMs: 1_000 };

    await expect(limiter.check("ip:1", options)).resolves.toMatchObject({
      allowed: true,
      remaining: 1,
    });
    await expect(limiter.check("ip:1", options)).resolves.toMatchObject({
      allowed: true,
      remaining: 0,
    });
    await expect(limiter.check("ip:1", options)).resolves.toMatchObject({
      allowed: false,
      remaining: 0,
    });
  });

  it("keeps memory buckets isolated by key", async () => {
    const limiter = new MemoryRateLimiter();
    const options = { limit: 1, windowMs: 1_000 };

    await expect(limiter.check("ip:1", options)).resolves.toMatchObject({ allowed: true });
    await expect(limiter.check("ip:2", options)).resolves.toMatchObject({ allowed: true });
  });

  it("throws a stable IntegrationError for the Upstash stub", async () => {
    const limiter = new UpstashRateLimiter();

    await expect(limiter.check("ip:1", { limit: 1, windowMs: 1_000 })).rejects.toMatchObject({
      code: "rate_limiter_not_configured",
    });
  });

  it("selects the configured limiter implementation", async () => {
    expect(createRateLimiter("memory")).toBeInstanceOf(MemoryRateLimiter);
    await expect(
      createRateLimiter("upstash").check("ip:1", { limit: 1, windowMs: 1_000 }),
    ).rejects.toMatchObject({
      code: "rate_limiter_not_configured",
    });
  });
});
