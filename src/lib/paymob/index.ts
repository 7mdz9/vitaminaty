import { env } from "@/lib/env";
import { NotImplementedError } from "@/lib/errors";
import type { PaymentAdapter } from "@/lib/paymob/adapter";
import { StubPaymentAdapter } from "@/lib/paymob/stub-adapter";

export function getPaymentAdapter(mode: "stub" | "live" = env.PAYMOB_MODE): PaymentAdapter {
  if (mode === "live") {
    throw new NotImplementedError("Paymob live adapter lands in M5.");
  }

  return new StubPaymentAdapter();
}
