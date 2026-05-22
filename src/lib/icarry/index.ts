import { env } from "@/lib/env";
import { NotImplementedError } from "@/lib/errors";
import type { ShippingAdapter } from "@/lib/icarry/adapter";
import { StubShippingAdapter } from "@/lib/icarry/stub-adapter";

export function getShippingAdapter(mode: "stub" | "live" = env.ICARRY_MODE): ShippingAdapter {
  if (mode === "live") {
    throw new NotImplementedError("iCarry live adapter lands in M6.");
  }

  return new StubShippingAdapter();
}
