import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OrderItemRecord, OrderRecord } from "@/types/order";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findOrderByIdForAdmin: vi.fn(),
  listOrderItemsForAdmin: vi.fn(),
  updateOrderIfFreshForAdmin: vi.fn(),
  appendPaymentEvent: vi.fn(),
  appendShipmentEvent: vi.fn(),
  listAuthUserEmailsByIds: vi.fn(),
  record: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/policies", () => ({
  requireAdmin: mocks.requireAdmin,
}));

vi.mock("@/server/repositories/order-admin-repository", () => ({
  findOrderByIdForAdmin: mocks.findOrderByIdForAdmin,
  listOrderItemsForAdmin: mocks.listOrderItemsForAdmin,
  updateOrderIfFreshForAdmin: mocks.updateOrderIfFreshForAdmin,
}));

vi.mock("@/server/repositories/payment-event-repository", () => ({
  appendEvent: mocks.appendPaymentEvent,
}));

vi.mock("@/server/repositories/shipment-event-repository", () => ({
  appendEvent: mocks.appendShipmentEvent,
}));

vi.mock("@/server/repositories/admin-repository", () => ({
  listAuthUserEmailsByIds: mocks.listAuthUserEmailsByIds,
}));

vi.mock("@/features/audit-log/record", () => ({
  record: mocks.record,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

describe("admin order actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({
      userId: "00000000-0000-4000-8000-000000000100",
      email: "admin@example.test",
      role: "admin",
    });
    mocks.listAuthUserEmailsByIds.mockResolvedValue([
      { id: "00000000-0000-4000-8000-000000000200", email: "customer@example.test" },
    ]);
  });

  it("moves a paid order to preparing and writes an order_status_change audit row", async () => {
    const before = orderFactory({ status: "paid" });
    const after = orderFactory({ status: "preparing", updated_at: "2026-05-24T15:01:00.000Z" });
    mocks.findOrderByIdForAdmin.mockResolvedValueOnce(before);
    mocks.updateOrderIfFreshForAdmin.mockResolvedValueOnce(after);

    const { transitionOrderStatus } = await import("@/features/admin-orders/actions");
    const result = await transitionOrderStatus({
      orderId: before.id,
      expectedUpdatedAt: before.updated_at,
      toStatus: "preparing",
      reason: "warehouse_pick_started",
      notifyCustomer: true,
    });

    expect(result).toMatchObject({ ok: true, order: { status: "preparing" } });
    expect(mocks.record).toHaveBeenCalledWith(
      expect.objectContaining({
        diff: expect.objectContaining({
          action: "order_status_change",
          entity_type: "order",
          order_id: before.id,
          status_before: "paid",
          status_after: "preparing",
          customer_email: "customer@example.test",
        }),
      }),
    );
  });

  it("requires tracking number before shipping", async () => {
    const before = orderFactory({ status: "preparing" });
    mocks.findOrderByIdForAdmin.mockResolvedValueOnce(before);

    const { transitionOrderStatus } = await import("@/features/admin-orders/actions");
    const result = await transitionOrderStatus({
      orderId: before.id,
      expectedUpdatedAt: before.updated_at,
      toStatus: "shipped",
      reason: "handoff_to_courier",
      notifyCustomer: true,
    });

    expect(result).toMatchObject({ ok: false, code: "validation_error" });
    expect(mocks.updateOrderIfFreshForAdmin).not.toHaveBeenCalled();
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it("returns stale_data without event or audit writes", async () => {
    const before = orderFactory({ status: "paid" });
    const current = orderFactory({ status: "preparing", updated_at: "2026-05-24T15:05:00.000Z" });
    mocks.findOrderByIdForAdmin.mockResolvedValueOnce(before).mockResolvedValueOnce(current);
    mocks.updateOrderIfFreshForAdmin.mockResolvedValueOnce(null);

    const { transitionOrderStatus } = await import("@/features/admin-orders/actions");
    const result = await transitionOrderStatus({
      orderId: before.id,
      expectedUpdatedAt: before.updated_at,
      toStatus: "preparing",
      reason: "warehouse_pick_started",
      notifyCustomer: true,
    });

    expect(result).toMatchObject({ ok: false, code: "stale_data" });
    expect(mocks.appendShipmentEvent).not.toHaveBeenCalled();
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it("records a full refund with payment event linkage and refund audit", async () => {
    const before = orderFactory({ status: "paid" });
    const after = orderFactory({ status: "refunded", updated_at: "2026-05-24T15:10:00.000Z" });
    mocks.findOrderByIdForAdmin.mockResolvedValueOnce(before);
    mocks.updateOrderIfFreshForAdmin.mockResolvedValueOnce(after);
    mocks.appendPaymentEvent.mockResolvedValueOnce({ id: "00000000-0000-4000-8000-000000000888" });
    mocks.listOrderItemsForAdmin.mockResolvedValueOnce([orderItemFactory({ order_id: before.id })]);

    const { refundOrder } = await import("@/features/admin-orders/actions");
    const result = await refundOrder({
      orderId: before.id,
      expectedUpdatedAt: before.updated_at,
      refundKind: "full",
      amountAed: before.total_aed,
      reason: "customer_request",
      notifyCustomer: true,
    });

    expect(result).toMatchObject({ ok: true, order: { status: "refunded" } });
    expect(mocks.appendPaymentEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "refunded",
        amount_aed: -before.total_aed,
      }),
    );
    expect(mocks.record).toHaveBeenCalledWith(
      expect.objectContaining({
        diff: expect.objectContaining({
          action: "order_refund",
          refund_kind: "full",
          payment_event_ids: ["00000000-0000-4000-8000-000000000888"],
        }),
      }),
    );
  });
});

function orderFactory(overrides: Partial<OrderRecord> = {}): OrderRecord {
  return {
    id: "00000000-0000-4000-8000-000000000300",
    customer_id: "00000000-0000-4000-8000-000000000200",
    status: "paid",
    ship_to: {
      recipient_name: "Customer",
      phone_e164: "+971500000000",
      line1: "Villa 1",
      line2: null,
      city: "Dubai",
      emirate: "Dubai",
      country_code: "AE",
    },
    subtotal_aed: 100,
    shipping_cost_aed: 10,
    vat_amount_aed: 5,
    total_aed: 115,
    payment_method: "card",
    payment_provider: "stub",
    payment_provider_order_id: null,
    payment_provider_intent_id: "intent_test",
    shipping_method: "standard",
    shipping_provider: "stub",
    shipping_provider_shipment_id: null,
    tracking_number: null,
    tracking_url: null,
    idempotency_key: "idem-test",
    reference: "VIT-TEST-001",
    created_at: "2026-05-24T15:00:00.000Z",
    updated_at: "2026-05-24T15:00:00.000Z",
    paid_at: "2026-05-24T15:00:00.000Z",
    shipped_at: null,
    delivered_at: null,
    cancelled_at: null,
    ...overrides,
  };
}

function orderItemFactory(overrides: Partial<OrderItemRecord> = {}): OrderItemRecord {
  return {
    id: "00000000-0000-4000-8000-000000000301",
    order_id: "00000000-0000-4000-8000-000000000300",
    product_id: "00000000-0000-4000-8000-000000000401",
    variant_id: "00000000-0000-4000-8000-000000000501",
    product_name: "Vitaminaty Test Product",
    variant_size: "1 kg",
    variant_flavor: "Chocolate",
    unit_price_aed: 100,
    quantity: 1,
    line_total_aed: 100,
    created_at: "2026-05-24T15:00:00.000Z",
    ...overrides,
  };
}
