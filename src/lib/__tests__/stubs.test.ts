import { describe, expect, it } from "vitest";
import { hmacSha256Hex, sha256Hex, verifyHmacSha256 } from "@/lib/crypto";
import { isAppError } from "@/lib/errors";
import { deriveIdempotencyKey } from "@/lib/idempotency";

describe("future cryptographic stubs", () => {
  it("locks idempotency key convention until M4", () => {
    expect(() => deriveIdempotencyKey(["customer", "cart"])).toThrow(/M4/);

    try {
      deriveIdempotencyKey(["customer", "cart"]);
    } catch (error) {
      expect(isAppError(error)).toBe(true);
      expect((error as Error & { code: string }).code).toBe("not_implemented");
    }
  });

  it("locks HMAC and hashing signatures until M5", () => {
    expect(() => hmacSha256Hex({ secret: "secret", payload: "payload" })).toThrow(/M5/);
    expect(() =>
      verifyHmacSha256({ secret: "secret", payload: "payload", signature: "signature" }),
    ).toThrow(/M5/);
    expect(() => sha256Hex("payload")).toThrow(/M5/);
  });
});
