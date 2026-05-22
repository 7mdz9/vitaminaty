import { add, type AedAmount, fromInteger, sumOf } from "@/lib/money/aed";

/**
 * VAT is inclusive at 5%. For whole-AED prices, VAT is amount * 5 / 105
 * rounded to the nearest AED with banker's rounding (round half to even).
 * Example: AED 105 -> net AED 100 + VAT AED 5.
 * Example: AED 100 -> net AED 95 + VAT AED 5.
 */

type VatBreakdown = Readonly<{
  net: AedAmount;
  vat: AedAmount;
}>;

type VatTotalBreakdown = VatBreakdown &
  Readonly<{
    total: AedAmount;
  }>;

function roundHalfToEvenFraction(numerator: number, denominator: number): number {
  const quotient = Math.floor(numerator / denominator);
  const remainder = numerator % denominator;
  const doubledRemainder = remainder * 2;

  if (doubledRemainder < denominator) return quotient;
  if (doubledRemainder > denominator) return quotient + 1;
  return quotient % 2 === 0 ? quotient : quotient + 1;
}

export function vatInclusiveToNetAndVat(amount: AedAmount): VatBreakdown {
  const vat = fromInteger(roundHalfToEvenFraction(amount * 5, 105));
  const net = fromInteger(amount - vat);

  return { net, vat };
}

export function vatInclusiveTotalFromLines(lines: readonly AedAmount[]): VatTotalBreakdown {
  const breakdowns = lines.map(vatInclusiveToNetAndVat);
  const net = sumOf(breakdowns.map((line) => line.net));
  const vat = sumOf(breakdowns.map((line) => line.vat));

  return {
    net,
    vat,
    total: add(net, vat),
  };
}
