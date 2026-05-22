import type {
  CreateShipmentInput,
  Shipment,
  ShipmentStatus,
  ShippingQuote,
  QuoteInput,
  VerifiedShipmentEvent,
} from "@/lib/icarry/types";

export interface ShippingAdapter {
  getQuote(input: QuoteInput): Promise<ShippingQuote>;
  createShipment(input: CreateShipmentInput): Promise<Shipment>;
  verifyWebhook(rawBody: string, signature: string): Promise<VerifiedShipmentEvent>;
  cancelShipment(shipment_id: string): Promise<void>;
  getShipmentStatus?(providerShipmentId: string): Promise<ShipmentStatus>;
}
