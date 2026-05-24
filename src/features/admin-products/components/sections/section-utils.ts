import type { ProductFieldsStatus } from "@/types/product";

export function statusForText(value: string | null | undefined) {
  return value && value.trim().length > 0 ? "complete" : "missing";
}

export function statusForArray(value: unknown[] | undefined) {
  return value && value.length > 0 ? "complete" : "missing";
}

export function compactFieldStatus(patch: Partial<ProductFieldsStatus>) {
  return patch;
}

export function nullableNumber(value: string) {
  return value.trim() === "" ? null : Number(value);
}
