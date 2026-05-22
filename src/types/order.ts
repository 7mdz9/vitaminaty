import type { AddressSnapshot } from "./address";
import type { PaymentMethod } from "./payment";
import type { ShipmentStatus } from "./shipment";

export type OrderStatus =
  | "pending_payment"
  | "paid"
  | "preparing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded"
  | "failed";

export interface OrderItemRecord {
  id: string;
  order_id: string;
  product_id: string | null;
  variant_id: string | null;
  product_name: string;
  variant_size: string;
  variant_flavor: string | null;
  unit_price_aed: number;
  quantity: number;
  line_total_aed: number;
  created_at: string;
}

export interface OrderRecord {
  id: string;
  customer_id: string | null;
  status: OrderStatus;
  ship_to: AddressSnapshot;
  subtotal_aed: number;
  shipping_cost_aed: number;
  vat_amount_aed: number;
  total_aed: number;
  payment_method: PaymentMethod;
  payment_provider: "paymob" | "stub" | null;
  payment_provider_order_id: string | null;
  payment_provider_intent_id: string | null;
  shipping_method: "standard" | "express" | "same_day" | string;
  shipping_provider: "icarry" | "stub" | "manual" | null;
  shipping_provider_shipment_id: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  idempotency_key: string;
  reference: string;
  created_at: string;
  updated_at: string;
  paid_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
}

export interface ShipmentEventRecord {
  id: string;
  order_id: string;
  status: ShipmentStatus;
  provider: "icarry" | "stub" | "manual";
  provider_shipment_id: string | null;
  raw_payload: Record<string, unknown> | null;
  occurred_at: string;
  recorded_at: string;
}
