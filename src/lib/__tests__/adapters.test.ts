import { afterEach, describe, expect, it, vi } from "vitest";
import { getShippingAdapter } from "@/lib/icarry";
import { StubShippingAdapter } from "@/lib/icarry/stub-adapter";
import { getPaymentAdapter } from "@/lib/paymob";
import { StubPaymentAdapter } from "@/lib/paymob/stub-adapter";
import { fromInteger } from "@/lib/money/aed";
import { NullSupportChatProvider } from "@/features/support-chat/null-provider";
import { getSupportChatProvider } from "@/features/support-chat";

const address = {
  recipient_name: "A Buyer",
  phone_e164: "+971501234567",
  line1: "Warehouse Road",
  line2: null,
  city: "Dubai",
  emirate: "Dubai",
  country_code: "AE",
} as const;

describe("adapter stubs", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates stub payment intents without calling fetch", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network called"));
    const adapter = new StubPaymentAdapter();

    await expect(
      adapter.createIntent({
        order: {
          id: "order_123",
          reference: "VIT-123",
          total_aed: fromInteger(100),
          customer: {
            email: "buyer@example.com",
            phone_e164: "+971501234567",
            full_name: "A Buyer",
          },
          ship_to: address,
          items: [{ name: "Critical Whey", quantity: 1, unit_price_aed: fromInteger(100) }],
        },
        method: "cards",
        idempotency_key: "idem_123",
      }),
    ).resolves.toMatchObject({
      intent_id: "stub_intent_order_123",
      status: "stub_pending",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("selects the payment adapter by mode", () => {
    expect(getPaymentAdapter("stub")).toBeInstanceOf(StubPaymentAdapter);
    expect(() => getPaymentAdapter("live")).toThrow(/M5/);
  });

  it("creates stub shipping quotes and shipments without calling fetch", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network called"));
    const adapter = new StubShippingAdapter();

    const quote = await adapter.getQuote({
      destination: { city: "Dubai", emirate: "Dubai", country_code: "AE" },
      total_weight_grams: 500,
      declared_value_aed: fromInteger(199),
      is_cod: false,
    });

    expect(quote.methods[0]).toMatchObject({
      id: "standard",
      cost_aed: 20,
    });

    await expect(
      adapter.createShipment({
        order_id: "order_123",
        order_reference: "VIT-123",
        customer: { name: "A Buyer", phone_e164: "+971501234567", email: "buyer@example.com" },
        origin: {},
        destination: address,
        items: [{ name: "Critical Whey", quantity: 1 }],
        method: "standard",
        total_weight_grams: 500,
        declared_value_aed: fromInteger(199),
        is_cod: false,
        idempotency_key: "idem_ship",
      }),
    ).resolves.toMatchObject({
      provider_shipment_id: "stub_order_123",
      tracking_number: "STUB-VIT-123",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("selects the shipping adapter by mode", () => {
    expect(getShippingAdapter("stub")).toBeInstanceOf(StubShippingAdapter);
    expect(() => getShippingAdapter("live")).toThrow(/M6/);
  });

  it("returns the null support-chat provider and logs messages without fetch", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network called"));
    const provider = new NullSupportChatProvider();

    await expect(provider.isAvailable()).resolves.toBe(false);
    await expect(
      provider.sendMessage(
        { conversation_id: "null-session", guest_session_id: "guest_123" },
        { content: "Do you have whey?" },
      ),
    ).resolves.toMatchObject({
      kind: "unavailable",
      content: "Support chat will be available soon — for now please email support@vitaminaty.ae.",
    });
    expect(getSupportChatProvider("null")).toBeInstanceOf(NullSupportChatProvider);
    expect(() => getSupportChatProvider("anthropic")).toThrow(/post-MVP/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
