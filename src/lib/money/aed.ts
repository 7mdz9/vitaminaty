import { ValidationError } from "@/lib/errors";

declare const aedAmountBrand: unique symbol;

export type AedAmount = number & {
  readonly [aedAmountBrand]: "AedAmount";
};

function assertValidAedInteger(value: number): void {
  if (!Number.isSafeInteger(value)) {
    throw new ValidationError({
      code: "aed_amount_not_integer",
      message: "AED amounts must be safe whole integers.",
    });
  }

  if (value < 0) {
    throw new ValidationError({
      code: "aed_amount_negative",
      message: "AED amounts cannot be negative.",
    });
  }
}

export function fromInteger(value: number): AedAmount {
  assertValidAedInteger(value);
  return value as AedAmount;
}

export function fromIntegerOrThrow(value: number): AedAmount {
  return fromInteger(value);
}

export function add(left: AedAmount, right: AedAmount): AedAmount {
  return fromInteger(left + right);
}

export function subtract(left: AedAmount, right: AedAmount): AedAmount {
  return fromInteger(left - right);
}

export function multiplyByQuantity(amount: AedAmount, quantity: number): AedAmount {
  if (!Number.isSafeInteger(quantity)) {
    throw new ValidationError({
      code: "quantity_not_integer",
      message: "Quantity must be a safe whole integer.",
    });
  }

  if (quantity < 0) {
    throw new ValidationError({
      code: "quantity_negative",
      message: "Quantity cannot be negative.",
    });
  }

  return fromInteger(amount * quantity);
}

export function sumOf(amounts: readonly AedAmount[]): AedAmount {
  return amounts.reduce((total, amount) => add(total, amount), fromInteger(0));
}

export function isPositive(amount: AedAmount): boolean {
  return amount > 0;
}
