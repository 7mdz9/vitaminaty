import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export type HmacSha256Input = Readonly<{
  secret: string;
  payload: string;
}>;

export type HmacVerificationInput = HmacSha256Input &
  Readonly<{
    signature: string;
  }>;

export function hmacSha256Hex(input: HmacSha256Input): string {
  return createHmac("sha256", input.secret).update(input.payload).digest("hex");
}

export function verifyHmacSha256(input: HmacVerificationInput): boolean {
  const expected = Buffer.from(hmacSha256Hex(input), "hex");
  const actual = Buffer.from(input.signature, "hex");

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function sha256Hex(payload: string): string {
  return createHash("sha256").update(payload).digest("hex");
}

export function randomBase64Url(byteLength: number): string {
  return randomBytes(byteLength).toString("base64url");
}
