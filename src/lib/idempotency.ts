import { NotImplementedError } from "@/lib/errors";

export function deriveIdempotencyKey(parts: readonly string[]): string {
  void parts;
  throw new NotImplementedError("deriveIdempotencyKey will be implemented in M4.");
}
