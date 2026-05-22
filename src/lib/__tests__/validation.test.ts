import { describe, expect, it } from "vitest";
import { UaeAddressSchema } from "@/lib/validation/address";
import { OrderCreateInputSchema, OrderStatusTransitionSchema } from "@/lib/validation/order";
import {
  ProductCreateInputSchema,
  ProductFieldStatusUpdateSchema,
  ProductUpdateInputSchema,
} from "@/lib/validation/product";
import {
  ICarryWebhookEventSchema,
  PaymobWebhookEventSchema,
} from "@/lib/validation/webhook-payloads";

const productFieldsStatus = {
  name: "complete",
  brand: "complete",
  category: "complete",
  form: "complete",
  retail_price: "complete",
  description: "draft",
  benefits: "missing",
  image: "complete",
  nutrition_panel: "verified",
  ingredients: "verified",
  allergens: "complete",
  directions: "verified",
  warnings: "verified",
  storage: "missing",
  seo_title: "draft",
  seo_description: "missing",
  often_bought_with: "missing",
} as const;

const address = {
  recipient_name: "A Buyer",
  phone_e164: "+971501234567",
  line1: "Warehouse Road",
  city: "Dubai",
  emirate: "Dubai",
  country_code: "AE",
} as const;

describe("validation schemas", () => {
  it("validates product create input and rejects invalid field statuses", () => {
    expect(
      ProductCreateInputSchema.parse({
        name: "Critical Whey",
        name_raw: "Critical Whey",
        slug: "critical-whey",
        fields_status: productFieldsStatus,
      }),
    ).toMatchObject({ slug: "critical-whey" });

    expect(() =>
      ProductCreateInputSchema.parse({
        name: "Critical Whey",
        name_raw: "Critical Whey",
        slug: "critical-whey",
        fields_status: { ...productFieldsStatus, name: "ready" },
      }),
    ).toThrow();
  });

  it("validates product update input and field-status updates", () => {
    expect(
      ProductUpdateInputSchema.parse({
        id: "11111111-1111-4111-8111-111111111111",
        retail_price_aed: 100,
      }),
    ).toMatchObject({ retail_price_aed: 100 });

    expect(
      ProductFieldStatusUpdateSchema.parse({
        product_id: "11111111-1111-4111-8111-111111111111",
        field: "nutrition_panel",
        status: "verified",
      }),
    ).toMatchObject({ field: "nutrition_panel" });

    expect(() =>
      ProductFieldStatusUpdateSchema.parse({
        product_id: "11111111-1111-4111-8111-111111111111",
        field: "nutrition_panel",
        status: "approved",
      }),
    ).toThrow();
  });

  it("validates UAE addresses and rejects non-UAE phone format", () => {
    expect(UaeAddressSchema.parse(address)).toMatchObject({ emirate: "Dubai" });
    expect(() => UaeAddressSchema.parse({ ...address, phone_e164: "+97144123456" })).toThrow();
  });

  it("validates order creation and status transitions", () => {
    expect(
      OrderCreateInputSchema.parse({
        ship_to: address,
        items: [{ product_id: "11111111-1111-4111-8111-111111111111", quantity: 1 }],
        payment_method: "cards",
        shipping_method: "standard",
        idempotency_key: "idem_123",
      }),
    ).toMatchObject({ payment_method: "cards" });

    expect(() =>
      OrderCreateInputSchema.parse({
        ship_to: address,
        items: [],
        payment_method: "cards",
        shipping_method: "standard",
        idempotency_key: "idem_123",
      }),
    ).toThrow();

    expect(
      OrderStatusTransitionSchema.parse({
        order_id: "11111111-1111-4111-8111-111111111111",
        from: "pending_payment",
        to: "paid",
      }),
    ).toMatchObject({ to: "paid" });

    expect(() =>
      OrderStatusTransitionSchema.parse({
        order_id: "11111111-1111-4111-8111-111111111111",
        from: "pending_payment",
        to: "unknown",
      }),
    ).toThrow();
  });

  it("keeps webhook schemas permissive until M5/M6 fill real payload shapes", () => {
    expect(PaymobWebhookEventSchema.parse({ any: "payload" })).toEqual({ any: "payload" });
    expect(ICarryWebhookEventSchema.parse({ any: "payload" })).toEqual({ any: "payload" });
  });
});
