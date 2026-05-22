import type { AedAmount } from "@/lib/money/aed";
import type { AddressSnapshot } from "@/types/address";

export type PaymentMethod = "cards" | "apple_pay" | "tabby" | "tamara" | "cod";

export type PaymentStatus =
  | "stub_pending"
  | "intent_created"
  | "authorized"
  | "captured"
  | "failed"
  | "refunded"
  | "voided"
  | "chargeback";

export type PaymentEventKind =
  | "intent_created"
  | "authorized"
  | "captured"
  | "failed"
  | "refunded"
  | "voided"
  | "chargeback";

export type PaymentAction =
  | { kind: "redirect"; url: string }
  | { kind: "iframe"; iframe_url: string; token: string }
  | { kind: "cod"; reference: string };

export interface CreateIntentInput {
  order: {
    id: string;
    reference: string;
    total_aed: AedAmount;
    customer: { email: string; phone_e164: string; full_name: string };
    ship_to: AddressSnapshot;
    items: Array<{ name: string; quantity: number; unit_price_aed: AedAmount }>;
  };
  method: PaymentMethod;
  idempotency_key: string;
}

export interface PaymentIntent {
  intent_id: string;
  provider_order_id: string;
  action: PaymentAction;
  expires_at: string;
  status: PaymentStatus;
}

export interface RefundInput {
  order_id: string;
  payment_id: string;
  provider_transaction_id: string;
  amount_aed: AedAmount;
  reason?: string;
}

export interface RefundResult {
  refund_id: string;
  payment_id: string;
  amount_aed: AedAmount;
  status: "stub_pending" | "succeeded" | "failed";
}

export interface VerifiedEvent {
  provider: "paymob";
  provider_transaction_id: string;
  provider_order_id: string;
  provider_intent_id: string;
  kind: PaymentEventKind;
  amount_aed: AedAmount;
  currency: "AED";
  occurred_at: string;
  raw_payload: object;
  signature_received: string;
}
