import "server-only";

import { requireAdmin } from "@/lib/auth/policies";
import {
  AdminOrderListSearchParamsSchema,
  type AdminOrderListSearchParams,
} from "@/lib/validation/admin-order";
import { listAuthUserEmailsByIds } from "@/server/repositories/admin-repository";
import { findCustomersByIdsForAdmin } from "@/server/repositories/customer-admin-repository";
import {
  findOrderByIdForAdmin,
  listOrderItemsForAdmin,
  listOrderItemsForOrdersForAdmin,
  listOrdersForAdmin,
} from "@/server/repositories/order-admin-repository";
import { listEventsForOrder as listPaymentEventsForOrder } from "@/server/repositories/payment-event-repository";
import { listEventsForOrder as listShipmentEventsForOrder } from "@/server/repositories/shipment-event-repository";
import type { CustomerRecord } from "@/types/customer";
import type { OrderItemRecord, OrderRecord, ShipmentEventRecord } from "@/types/order";
import type { PaymentEventRecord } from "@/types/payment";

export type AdminOrderListInput = Readonly<{
  status?: OrderRecord["status"];
  paymentMethod?: OrderRecord["payment_method"];
  customer?: string;
  q?: string;
  dateFrom?: string;
  dateTo?: string;
}>;

export type AdminOrderCustomerSummary = Readonly<{
  id: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
}>;

export type AdminOrderListItem = Readonly<{
  order: OrderRecord;
  customer: AdminOrderCustomerSummary;
  itemsCount: number;
}>;

export type AdminOrderDetail = Readonly<{
  order: OrderRecord;
  items: OrderItemRecord[];
  customer: AdminOrderCustomerSummary;
  paymentEvents: PaymentEventRecord[];
  shipmentEvents: ShipmentEventRecord[];
  timeline: AdminOrderTimelineItem[];
}>;

export type AdminOrderTimelineItem = Readonly<{
  occurredAt: string;
  label: string;
  detail: string | null;
}>;

export function parseAdminOrderListSearchParams(
  params: AdminOrderListSearchParams,
): AdminOrderListInput {
  const parsed = AdminOrderListSearchParamsSchema.parse(params);

  return {
    status: parsed.status,
    paymentMethod: parsed.payment_method,
    customer: parsed.customer || undefined,
    q: parsed.q || undefined,
    dateFrom: toStartOfDayIso(parsed.date_from),
    dateTo: toEndOfDayIso(parsed.date_to),
  };
}

export async function getAdminOrderList(input: AdminOrderListInput): Promise<AdminOrderListItem[]> {
  await requireAdmin();
  const orders = await listOrdersForAdmin({
    status: input.status,
    paymentMethod: input.paymentMethod,
    referenceSearch: input.q,
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    limit: 100,
  });
  const [customers, authEmails, items] = await Promise.all([
    getCustomersForOrders(orders),
    getAuthEmailsForOrders(orders),
    listOrderItemsForOrdersForAdmin(orders.map((order) => order.id)),
  ]);
  const customerById = new Map(customers.map((customer) => [customer.id, customer]));
  const emailById = new Map(authEmails.map((user) => [user.id, user.email]));
  const countByOrderId = countItemsByOrder(items);

  const rows = orders.map((order) => ({
    order,
    customer: buildCustomerSummary(order.customer_id, customerById, emailById),
    itemsCount: countByOrderId.get(order.id) ?? 0,
  }));

  if (!input.customer) {
    return rows;
  }

  const needle = input.customer.toLowerCase();
  return rows.filter((row) =>
    [row.customer.name, row.customer.email, row.customer.phone]
      .filter(Boolean)
      .some((value) => value?.toLowerCase().includes(needle)),
  );
}

export async function getAdminOrderDetail(orderId: string): Promise<AdminOrderDetail | null> {
  await requireAdmin();
  const order = await findOrderByIdForAdmin(orderId);

  if (!order) {
    return null;
  }

  const [[customer], authEmails, items, paymentEvents, shipmentEvents] = await Promise.all([
    getCustomersForOrders([order]),
    getAuthEmailsForOrders([order]),
    listOrderItemsForAdmin(order.id),
    listPaymentEventsForOrder(order.id),
    listShipmentEventsForOrder(order.id),
  ]);
  const customerById = new Map(customer ? [[customer.id, customer]] : []);
  const emailById = new Map(authEmails.map((user) => [user.id, user.email]));

  return {
    order,
    items,
    customer: buildCustomerSummary(order.customer_id, customerById, emailById),
    paymentEvents,
    shipmentEvents,
    timeline: buildTimeline(order, paymentEvents, shipmentEvents),
  };
}

async function getCustomersForOrders(orders: OrderRecord[]): Promise<CustomerRecord[]> {
  return findCustomersByIdsForAdmin(
    orders.map((order) => order.customer_id).filter((id): id is string => Boolean(id)),
  );
}

async function getAuthEmailsForOrders(orders: OrderRecord[]) {
  return listAuthUserEmailsByIds(
    orders.map((order) => order.customer_id).filter((id): id is string => Boolean(id)),
  );
}

function buildCustomerSummary(
  customerId: string | null,
  customerById: Map<string, CustomerRecord>,
  emailById: Map<string, string | null>,
): AdminOrderCustomerSummary {
  if (!customerId) {
    return { id: null, name: null, email: null, phone: null };
  }

  const customer = customerById.get(customerId);

  return {
    id: customerId,
    name: customer?.full_name ?? null,
    email: emailById.get(customerId) ?? null,
    phone: customer?.phone_e164 ?? null,
  };
}

function countItemsByOrder(items: OrderItemRecord[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const item of items) {
    counts.set(item.order_id, (counts.get(item.order_id) ?? 0) + item.quantity);
  }

  return counts;
}

function buildTimeline(
  order: OrderRecord,
  paymentEvents: PaymentEventRecord[],
  shipmentEvents: ShipmentEventRecord[],
): AdminOrderTimelineItem[] {
  const items: AdminOrderTimelineItem[] = [
    { occurredAt: order.created_at, label: "Created", detail: order.reference },
  ];

  if (order.paid_at) {
    items.push({ occurredAt: order.paid_at, label: "Paid", detail: order.payment_method });
  }

  if (order.shipped_at) {
    items.push({ occurredAt: order.shipped_at, label: "Shipped", detail: order.tracking_number });
  }

  if (order.delivered_at) {
    items.push({ occurredAt: order.delivered_at, label: "Delivered", detail: null });
  }

  if (order.cancelled_at) {
    items.push({ occurredAt: order.cancelled_at, label: "Cancelled", detail: null });
  }

  paymentEvents.forEach((event) =>
    items.push({
      occurredAt: event.occurred_at,
      label: `Payment ${event.kind}`,
      detail: event.provider_transaction_id ?? event.provider_intent_id,
    }),
  );
  shipmentEvents.forEach((event) =>
    items.push({
      occurredAt: event.occurred_at,
      label: `Shipment ${event.status}`,
      detail: event.provider_shipment_id,
    }),
  );

  return items.sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));
}

function toStartOfDayIso(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  return `${value}T00:00:00.000Z`;
}

function toEndOfDayIso(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  return `${value}T23:59:59.999Z`;
}
