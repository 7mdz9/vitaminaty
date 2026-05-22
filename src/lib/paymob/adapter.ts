import type {
  CreateIntentInput,
  PaymentIntent,
  PaymentStatus,
  RefundInput,
  RefundResult,
  VerifiedEvent,
} from "@/lib/paymob/types";

export interface PaymentAdapter {
  createIntent(input: CreateIntentInput): Promise<PaymentIntent>;
  verifyWebhook(rawBody: string, headers: Headers): Promise<VerifiedEvent>;
  refund(input: RefundInput): Promise<RefundResult>;
  getPaymentStatus(intentId: string): Promise<PaymentStatus>;
}
