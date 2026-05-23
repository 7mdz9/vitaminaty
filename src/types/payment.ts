export type PaymentMethod = "card" | "apple_pay" | "tabby" | "tamara" | "cod";

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

export interface PaymentEventRecord {
  id: string;
  order_id: string;
  kind: PaymentEventKind;
  provider: "paymob" | "stub";
  provider_transaction_id: string | null;
  provider_intent_id: string | null;
  amount_aed: number;
  currency: "AED";
  raw_payload: Record<string, unknown>;
  signature_received: string | null;
  occurred_at: string;
  recorded_at: string;
}
