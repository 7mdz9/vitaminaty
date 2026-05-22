import type { AedAmount } from "@/lib/money/aed";
import type { AddressSnapshot } from "@/types/address";
import type { ShipmentStatus } from "@/types/shipment";

export type ShippingMethod = "standard" | "express" | "same_day";

export interface QuoteInput {
  destination: { city: string; emirate: string; country_code: "AE" };
  total_weight_grams: number;
  declared_value_aed: AedAmount;
  is_cod: boolean;
  cod_amount_aed?: AedAmount;
}

export interface ShippingQuote {
  methods: Array<{
    id: ShippingMethod;
    label: string;
    cost_aed: AedAmount;
    eta_min_days: number;
    eta_max_days: number;
    available: boolean;
  }>;
}

export interface CreateShipmentInput {
  order_id: string;
  order_reference: string;
  customer: { name: string; phone_e164: string; email: string };
  origin: Record<string, unknown>;
  destination: AddressSnapshot;
  items: Array<{ name: string; quantity: number; weight_grams?: number; sku?: string }>;
  method: ShippingMethod;
  total_weight_grams: number;
  declared_value_aed: AedAmount;
  is_cod: boolean;
  cod_amount_aed?: AedAmount;
  special_instructions?: string;
  idempotency_key: string;
}

export interface Shipment {
  provider_shipment_id: string;
  tracking_number: string;
  tracking_url: string | null;
  estimated_delivery: string | null;
  label_pdf_url: string | null;
}

export interface VerifiedShipmentEvent {
  provider: "icarry" | string;
  provider_shipment_id: string;
  status: ShipmentStatus;
  occurred_at: string;
  raw_payload: object;
}

export type { ShipmentStatus };
