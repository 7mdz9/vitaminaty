import { NotImplementedError } from "@/lib/errors";

export type HmacSha256Input = Readonly<{
  secret: string;
  payload: string;
}>;

export type HmacVerificationInput = HmacSha256Input &
  Readonly<{
    signature: string;
  }>;

export function hmacSha256Hex(input: HmacSha256Input): string {
  void input;
  throw new NotImplementedError("hmacSha256Hex will be implemented in M5.");
}

export function verifyHmacSha256(input: HmacVerificationInput): boolean {
  void input;
  throw new NotImplementedError("verifyHmacSha256 will be implemented in M5.");
}

export function sha256Hex(payload: string): string {
  void payload;
  throw new NotImplementedError("sha256Hex will be implemented in M5.");
}
