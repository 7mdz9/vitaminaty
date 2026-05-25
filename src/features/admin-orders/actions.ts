"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/policies";
import { isAppError, type ErrorCode } from "@/lib/errors";
import {
  AdminOrderRefundActionSchema,
  AdminOrderStatusTransitionActionSchema,
  type AdminOrderRefundActionInput,
  type AdminOrderStatusTransitionActionInput,
} from "@/lib/validation/admin-order";
import { record } from "@/features/audit-log/record";
import { listAuthUserEmailsByIds } from "@/server/repositories/admin-repository";
import {
  findOrderByIdForAdmin,
  listOrderItemsForAdmin,
  updateOrderIfFreshForAdmin,
} from "@/server/repositories/order-admin-repository";
import { appendEvent as appendPaymentEvent } from "@/server/repositories/payment-event-repository";
import { appendEvent as appendShipmentEvent } from "@/server/repositories/shipment-event-repository";
import type { OrderRecord, OrderStatus } from "@/types/order";

export type AdminOrderActionResult =
  | {
      ok: true;
      order: OrderRecord;
    }
  | {
      ok: false;
      error: ErrorCode;
      message: string;
      current?: OrderRecord | null;
    };

type AdminOrderActionErrorResult = Extract<AdminOrderActionResult, { ok: false }>;

const allowedTransitions: Partial<Record<OrderStatus, OrderStatus[]>> = {
  pending_payment: ["cancelled"],
  paid: ["preparing", "cancelled"],
  preparing: ["shipped", "cancelled"],
  shipped: ["delivered"],
};

export async function transitionOrderStatus(
  input: AdminOrderStatusTransitionActionInput,
): Promise<AdminOrderActionResult> {
  try {
    const admin = await requireAdmin();
    const parsed = AdminOrderStatusTransitionActionSchema.parse(input);
    const before = await findOrderByIdForAdmin(parsed.orderId);

    if (!before) {
      return { ok: false, error: "not_found", message: "Order not found." };
    }

    if (!canTransition(before.status, parsed.toStatus)) {
      return {
        ok: false,
        error: "conflict",
        message: `Cannot move order from ${before.status} to ${parsed.toStatus}.`,
      };
    }

    if (parsed.toStatus === "shipped" && !parsed.trackingNumber) {
      return {
        ok: false,
        error: "validation_failed",
        message: "Tracking number is required before marking an order as shipped.",
      };
    }

    const updated = await updateOrderIfFreshForAdmin(
      before.id,
      parsed.expectedUpdatedAt,
      buildTransitionPatch(
        parsed.toStatus,
        parsed.trackingNumber ?? null,
        parsed.trackingUrl ?? null,
      ),
    );

    if (!updated) {
      return {
        ok: false,
        error: "stale_data",
        message: "This order changed after the page loaded.",
        current: await findOrderByIdForAdmin(before.id),
      };
    }

    await appendShipmentStatusEventIfNeeded(before, updated);
    const customerEmail = await getCustomerEmail(before.customer_id);

    await record({
      actor: { userId: admin.userId, email: admin.email },
      entityId: updated.id,
      diff: {
        version: 1,
        action: "order_status_change",
        entity_type: "order",
        order_id: updated.id,
        order_reference: updated.reference,
        status_before: before.status,
        status_after: updated.status,
        reason: parsed.reason,
        tracking_number: updated.tracking_number,
        customer_email: customerEmail,
        notify_customer: parsed.notifyCustomer,
      },
    });

    revalidateOrderPaths(updated.id);
    return { ok: true, order: updated };
  } catch (error) {
    return mapOrderActionError(error);
  }
}

export async function refundOrder(
  input: AdminOrderRefundActionInput,
): Promise<AdminOrderActionResult> {
  try {
    const admin = await requireAdmin();
    const parsed = AdminOrderRefundActionSchema.parse(input);
    const before = await findOrderByIdForAdmin(parsed.orderId);

    if (!before) {
      return { ok: false, error: "not_found", message: "Order not found." };
    }

    if (!isRefundable(before.status)) {
      return {
        ok: false,
        error: "conflict",
        message: `Cannot refund an order with status ${before.status}.`,
      };
    }

    if (parsed.amountAed > before.total_aed) {
      return {
        ok: false,
        error: "validation_failed",
        message: "Refund amount cannot exceed the order total.",
      };
    }

    const nextStatus = parsed.refundKind === "full" ? "refunded" : before.status;
    const updated = await updateOrderIfFreshForAdmin(before.id, parsed.expectedUpdatedAt, {
      status: nextStatus,
    });

    if (!updated) {
      return {
        ok: false,
        error: "stale_data",
        message: "This order changed after the page loaded.",
        current: await findOrderByIdForAdmin(before.id),
      };
    }

    const [event, items, customerEmail] = await Promise.all([
      appendPaymentEvent({
        order_id: updated.id,
        kind: "refunded",
        provider: updated.payment_provider === "paymob" ? "paymob" : "stub",
        provider_transaction_id: `manual-refund-${updated.reference}-${Date.now()}`,
        provider_intent_id: updated.payment_provider_intent_id,
        amount_aed: -parsed.amountAed,
        currency: "AED",
        raw_payload: {
          source: "admin",
          reason: parsed.reason,
          refund_kind: parsed.refundKind,
          notify_customer: parsed.notifyCustomer,
        },
        signature_received: null,
        occurred_at: new Date().toISOString(),
      }),
      listOrderItemsForAdmin(updated.id),
      getCustomerEmail(updated.customer_id),
    ]);

    await record({
      actor: { userId: admin.userId, email: admin.email },
      entityId: updated.id,
      diff: {
        version: 1,
        action: "order_refund",
        entity_type: "order",
        order_id: updated.id,
        order_reference: updated.reference,
        refund_kind: parsed.refundKind,
        amount_aed: parsed.amountAed,
        currency: "AED",
        reason: parsed.reason,
        customer_email: customerEmail,
        payment_event_ids: [event.id],
        goods_returned_to_inventory: false,
        inventory_movement_ids: [],
        line_items:
          parsed.refundKind === "full"
            ? items.map((item) => ({
                order_item_id: item.id,
                product_id: item.product_id ?? "",
                variant_id: item.variant_id,
                quantity_refunded: item.quantity,
                amount_aed: item.line_total_aed,
              }))
            : [],
      },
    });

    revalidateOrderPaths(updated.id);
    return { ok: true, order: updated };
  } catch (error) {
    return mapOrderActionError(error);
  }
}

function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return allowedTransitions[from]?.includes(to) ?? false;
}

function isRefundable(status: OrderStatus): boolean {
  return ["paid", "preparing", "shipped", "delivered"].includes(status);
}

function buildTransitionPatch(
  toStatus: OrderStatus,
  trackingNumber: string | null,
  trackingUrl: string | null,
) {
  const now = new Date().toISOString();
  const patch: {
    status: OrderStatus;
    tracking_number?: string | null;
    tracking_url?: string | null;
    shipping_provider?: "manual";
    shipped_at?: string | null;
    delivered_at?: string | null;
    cancelled_at?: string | null;
  } = { status: toStatus };

  if (toStatus === "shipped") {
    patch.tracking_number = trackingNumber;
    patch.tracking_url = trackingUrl;
    patch.shipping_provider = "manual";
    patch.shipped_at = now;
  }

  if (toStatus === "delivered") {
    patch.delivered_at = now;
  }

  if (toStatus === "cancelled") {
    patch.cancelled_at = now;
  }

  return patch;
}

async function appendShipmentStatusEventIfNeeded(
  before: OrderRecord,
  updated: OrderRecord,
): Promise<void> {
  if (updated.status !== "shipped" && updated.status !== "delivered") {
    return;
  }

  await appendShipmentEvent({
    order_id: updated.id,
    status: updated.status === "delivered" ? "delivered" : "created",
    provider: "manual",
    provider_shipment_id: updated.shipping_provider_shipment_id,
    raw_payload: {
      source: "admin",
      status_before: before.status,
      status_after: updated.status,
      tracking_number: updated.tracking_number,
    },
    occurred_at: new Date().toISOString(),
  });
}

async function getCustomerEmail(customerId: string | null): Promise<string> {
  if (!customerId) {
    return "internal_error";
  }

  const [user] = await listAuthUserEmailsByIds([customerId]);
  return user?.email ?? "internal_error";
}

function revalidateOrderPaths(orderId: string): void {
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
}

function mapOrderActionError(error: unknown): AdminOrderActionErrorResult {
  if (isAppError(error)) {
    return {
      ok: false,
      error: error.code,
      message: error.message,
    };
  }

  if (error instanceof Error && error.name === "ZodError") {
    return {
      ok: false,
      error: "validation_failed",
      message: error.message,
    };
  }

  return {
    ok: false,
    error: "internal_error",
    message: error instanceof Error ? error.message : "Unknown order action error.",
  };
}
