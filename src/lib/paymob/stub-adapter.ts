import { IntegrationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import type { PaymentAdapter } from "@/lib/paymob/adapter";
import type {
  CreateIntentInput,
  PaymentIntent,
  PaymentStatus,
  RefundInput,
  RefundResult,
  VerifiedEvent,
} from "@/lib/paymob/types";

export class StubPaymentAdapter implements PaymentAdapter {
  async createIntent(input: CreateIntentInput): Promise<PaymentIntent> {
    logger.debug("paymob.stub.create_intent", {
      order_id: input.order.id,
      method: input.method,
      idempotency_key: input.idempotency_key,
    });

    const intentId =
      input.method === "cod" ? `cod_${input.order.id}` : `stub_intent_${input.order.id}`;

    return {
      intent_id: intentId,
      provider_order_id: `stub_order_${input.order.id}`,
      action:
        input.method === "cod"
          ? { kind: "cod", reference: input.order.reference }
          : { kind: "redirect", url: `https://stub.payments.local/${intentId}` },
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      status: "stub_pending",
    };
  }

  async verifyWebhook(rawBody: string, headers: Headers): Promise<VerifiedEvent> {
    logger.debug("paymob.stub.verify_webhook", {
      raw_body_length: rawBody.length,
      signature_received: headers.get("x-paymob-signature"),
    });

    throw new IntegrationError({
      code: "paymob_stub_webhook_not_supported",
      message: "Stub Paymob adapter does not accept webhook events.",
    });
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    logger.debug("paymob.stub.refund", {
      order_id: input.order_id,
      payment_id: input.payment_id,
      provider_transaction_id: input.provider_transaction_id,
    });

    return {
      refund_id: `stub_refund_${input.payment_id}`,
      payment_id: input.payment_id,
      amount_aed: input.amount_aed,
      status: "stub_pending",
    };
  }

  async getPaymentStatus(intentId: string): Promise<PaymentStatus> {
    logger.debug("paymob.stub.get_payment_status", { intent_id: intentId });
    return "stub_pending";
  }
}
