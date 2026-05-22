import { IntegrationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { fromInteger } from "@/lib/money/aed";
import type { ShippingAdapter } from "@/lib/icarry/adapter";
import type {
  CreateShipmentInput,
  Shipment,
  ShippingQuote,
  QuoteInput,
  VerifiedShipmentEvent,
} from "@/lib/icarry/types";

export class StubShippingAdapter implements ShippingAdapter {
  async getQuote(input: QuoteInput): Promise<ShippingQuote> {
    logger.debug("icarry.stub.get_quote", {
      emirate: input.destination.emirate,
      total_weight_grams: input.total_weight_grams,
      is_cod: input.is_cod,
    });

    return {
      methods: [
        {
          id: "standard",
          label: "Standard Delivery",
          cost_aed: input.declared_value_aed >= 200 ? fromInteger(0) : fromInteger(20),
          eta_min_days: 1,
          eta_max_days: 2,
          available: true,
        },
        {
          id: "express",
          label: "Express Delivery",
          cost_aed: fromInteger(30),
          eta_min_days: 1,
          eta_max_days: 1,
          available: true,
        },
        {
          id: "same_day",
          label: "Same-Day Delivery",
          cost_aed: fromInteger(50),
          eta_min_days: 0,
          eta_max_days: 0,
          available: false,
        },
      ],
    };
  }

  async createShipment(input: CreateShipmentInput): Promise<Shipment> {
    logger.debug("icarry.stub.create_shipment", {
      order_id: input.order_id,
      method: input.method,
      idempotency_key: input.idempotency_key,
    });

    return {
      provider_shipment_id: `stub_${input.order_id}`,
      tracking_number: `STUB-${input.order_reference}`,
      tracking_url: null,
      estimated_delivery: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      label_pdf_url: null,
    };
  }

  async verifyWebhook(rawBody: string, signature: string): Promise<VerifiedShipmentEvent> {
    logger.debug("icarry.stub.verify_webhook", {
      raw_body_length: rawBody.length,
      signature,
    });

    throw new IntegrationError({
      code: "icarry_stub_webhook_not_supported",
      message: "Stub iCarry adapter does not accept webhook events.",
    });
  }

  async cancelShipment(shipment_id: string): Promise<void> {
    logger.debug("icarry.stub.cancel_shipment", { shipment_id });
  }
}
