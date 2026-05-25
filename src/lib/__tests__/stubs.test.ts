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

  it("locks HMAC and hashing outputs used by MFA recovery-code storage", () => {
    const signature = "b82fcb791acec57859b989b430a826488ce2e479fdf92326bd0a2e8375a42ba4";

    expect(hmacSha256Hex({ secret: "secret", payload: "payload" })).toBe(signature);
    expect(verifyHmacSha256({ secret: "secret", payload: "payload", signature })).toBe(true);
    expect(verifyHmacSha256({ secret: "secret", payload: "payload", signature: "00" })).toBe(false);
    expect(sha256Hex("payload")).toBe(
      "239f59ed55e737c77147cf55ad0c1b030b6d7ee748a7426952f9b852d5a935e5",
    );
  });
});
