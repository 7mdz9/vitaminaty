import type { AedAmount } from "@/lib/money/aed";

export function formatAed(
  amount: AedAmount,
  options: Readonly<{ showDecimals?: boolean }> = {},
): string {
  return options.showDecimals ? `AED ${amount}.00` : `AED ${amount}`;
}
