import { describe, expect, it } from "vitest";
import {
  add,
  fromInteger,
  fromIntegerOrThrow,
  isPositive,
  multiplyByQuantity,
  subtract,
  sumOf,
} from "@/lib/money/aed";
import { formatAed } from "@/lib/money/format";
import { vatInclusiveToNetAndVat, vatInclusiveTotalFromLines } from "@/lib/money/vat";

describe("AED money primitives", () => {
  it("constructs zero, positive, and large whole-AED amounts", () => {
    expect(fromInteger(0)).toBe(0);
    expect(fromInteger(42)).toBe(42);
    expect(fromInteger(1_000_000)).toBe(1_000_000);
    expect(fromIntegerOrThrow(42)).toBe(42);
  });

  it("rejects negative and fractional AED amounts", () => {
    expect(() => fromInteger(-1)).toThrow(/cannot be negative/);
    expect(() => fromInteger(3.14)).toThrow(/whole integers/);
    expect(() => fromIntegerOrThrow(-1)).toThrow(/cannot be negative/);
    expect(() => fromIntegerOrThrow(3.14)).toThrow(/whole integers/);
  });

  it("adds zero, positive, and large amounts", () => {
    expect(add(fromInteger(0), fromInteger(0))).toBe(0);
    expect(add(fromInteger(40), fromInteger(2))).toBe(42);
    expect(add(fromInteger(1_000_000), fromInteger(1_000_000))).toBe(2_000_000);
  });

  it("subtracts without allowing negative results", () => {
    expect(subtract(fromInteger(0), fromInteger(0))).toBe(0);
    expect(subtract(fromInteger(42), fromInteger(2))).toBe(40);
    expect(subtract(fromInteger(1_000_000), fromInteger(1))).toBe(999_999);
    expect(() => subtract(fromInteger(1), fromInteger(2))).toThrow(/cannot be negative/);
  });

  it("multiplies by quantity while rejecting negative and fractional quantities", () => {
    expect(multiplyByQuantity(fromInteger(42), 0)).toBe(0);
    expect(multiplyByQuantity(fromInteger(42), 2)).toBe(84);
    expect(multiplyByQuantity(fromInteger(1_000_000), 3)).toBe(3_000_000);
    expect(() => multiplyByQuantity(fromInteger(1), -1)).toThrow(/Quantity cannot be negative/);
    expect(() => multiplyByQuantity(fromInteger(1), 1.5)).toThrow(/Quantity must be/);
  });

  it("sums amount lists", () => {
    expect(sumOf([])).toBe(0);
    expect(sumOf([fromInteger(10), fromInteger(32)])).toBe(42);
    expect(sumOf([fromInteger(1_000_000), fromInteger(2)])).toBe(1_000_002);
  });

  it("checks positivity", () => {
    expect(isPositive(fromInteger(0))).toBe(false);
    expect(isPositive(fromInteger(42))).toBe(true);
    expect(isPositive(fromInteger(1_000_000))).toBe(true);
  });

  it("formats AED strings without introducing fractional arithmetic", () => {
    expect(formatAed(fromInteger(0))).toBe("AED 0");
    expect(formatAed(fromInteger(42))).toBe("AED 42");
    expect(formatAed(fromInteger(1_000_000), { showDecimals: true })).toBe("AED 1000000.00");
  });
});

describe("VAT inclusive math", () => {
  it("computes documented VAT examples", () => {
    expect(vatInclusiveToNetAndVat(fromInteger(0))).toEqual({ net: 0, vat: 0 });
    expect(vatInclusiveToNetAndVat(fromInteger(100))).toEqual({ net: 95, vat: 5 });
    expect(vatInclusiveToNetAndVat(fromInteger(105))).toEqual({ net: 100, vat: 5 });
    expect(vatInclusiveToNetAndVat(fromInteger(1_000_000))).toEqual({
      net: 952_381,
      vat: 47_619,
    });
  });

  it("rejects negative and fractional VAT inputs at the AED constructor boundary", () => {
    expect(() => vatInclusiveToNetAndVat(fromInteger(-1))).toThrow(/cannot be negative/);
    expect(() => vatInclusiveToNetAndVat(fromInteger(3.14))).toThrow(/whole integers/);
    expect(() => vatInclusiveTotalFromLines([fromInteger(-1)])).toThrow(/cannot be negative/);
    expect(() => vatInclusiveTotalFromLines([fromInteger(3.14)])).toThrow(/whole integers/);
  });

  it("totals VAT from individual lines", () => {
    expect(vatInclusiveTotalFromLines([])).toEqual({ net: 0, vat: 0, total: 0 });
    expect(vatInclusiveTotalFromLines([fromInteger(100), fromInteger(105)])).toEqual({
      net: 195,
      vat: 10,
      total: 205,
    });
    expect(vatInclusiveTotalFromLines([fromInteger(1_000_000)])).toEqual({
      net: 952_381,
      vat: 47_619,
      total: 1_000_000,
    });
  });

  it("keeps net plus VAT equal to the inclusive amount for AED 1 through 10000", () => {
    for (let value = 1; value <= 10_000; value += 1) {
      const amount = fromInteger(value);
      const breakdown = vatInclusiveToNetAndVat(amount);

      expect(breakdown.net + breakdown.vat).toBe(value);
    }
  });
});
