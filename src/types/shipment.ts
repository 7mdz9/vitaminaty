export type ShipmentStatus =
  | "created"
  | "picked_up"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "delivery_failed"
  | "returned"
  | "cancelled";

export interface ShipmentRecord {
  provider_shipment_id: string;
  tracking_number: string;
  tracking_url: string | null;
  estimated_delivery: string | null;
  label_pdf_url: string | null;
}
