import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OrderStatusActions } from "@/features/admin-orders/components/OrderStatusActions";
import { OrderStatusBadge } from "@/features/admin-orders/components/OrderStatusBadge";
import { getAdminOrderDetail, type AdminOrderTimelineItem } from "@/features/admin-orders/queries";
import type { OrderItemRecord, OrderRecord } from "@/types/order";
import type { PaymentEventRecord } from "@/types/payment";
import type { ShipmentEventRecord } from "@/types/order";

export const dynamic = "force-dynamic";

export default async function AdminOrderDetailPage({
  params,
}: Readonly<{
  params: Promise<{ orderId: string }>;
}>) {
  const { orderId } = await params;
  const detail = await getAdminOrderDetail(orderId);

  if (!detail) {
    notFound();
  }

  return (
    <div className="space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button render={<Link href="/admin/orders" />} size="icon" variant="ghost">
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h2 className="font-admin-display text-xl text-admin-text">
              {detail.order.reference}
            </h2>
            <p className="text-admin-sm text-admin-text-muted">
              {detail.customer.email ?? detail.customer.name ?? "Guest order"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <OrderStatusBadge status={detail.order.status} />
          <span className="font-admin-display text-xl tabular-nums text-admin-text">
            {formatAedNumber(detail.order.total_aed)}
          </span>
        </div>
      </header>

      <div className="grid gap-3 xl:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          <OrderSummary order={detail.order} items={detail.items} />
          <InfoGrid order={detail.order} />
          <Timeline items={detail.timeline} />
          <EventTables paymentEvents={detail.paymentEvents} shipmentEvents={detail.shipmentEvents} />
        </div>
        <OrderStatusActions order={detail.order} />
      </div>
    </div>
  );
}

function OrderSummary({
  order,
  items,
}: Readonly<{ order: OrderRecord; items: OrderItemRecord[] }>) {
  return (
    <section className="overflow-hidden rounded-admin-md border border-admin-border bg-admin-surface">
      <div className="border-b border-admin-border px-3 py-2">
        <h3 className="font-admin-display text-admin-title text-admin-text">Order summary</h3>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead>Variant</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="text-right">Unit</TableHead>
            <TableHead className="text-right">Line total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium">{item.product_name}</TableCell>
              <TableCell>
                {[item.variant_size, item.variant_flavor].filter(Boolean).join(" / ")}
              </TableCell>
              <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatAedNumber(item.unit_price_aed)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatAedNumber(item.line_total_aed)}
              </TableCell>
            </TableRow>
          ))}
          <TableRow>
            <TableCell className="text-right text-admin-text-muted" colSpan={4}>
              Subtotal
            </TableCell>
            <TableCell className="text-right tabular-nums">{formatAedNumber(order.subtotal_aed)}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="text-right text-admin-text-muted" colSpan={4}>
              Shipping
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatAedNumber(order.shipping_cost_aed)}
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="text-right text-admin-text-muted" colSpan={4}>
              VAT
            </TableCell>
            <TableCell className="text-right tabular-nums">{formatAedNumber(order.vat_amount_aed)}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="text-right font-medium" colSpan={4}>
              Total
            </TableCell>
            <TableCell className="text-right font-medium tabular-nums">
              {formatAedNumber(order.total_aed)}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </section>
  );
}

function InfoGrid({ order }: Readonly<{ order: OrderRecord }>) {
  const address = order.ship_to;

  return (
    <section className="grid gap-3 lg:grid-cols-3">
      <InfoPanel title="Shipping address">
        <p>{address.recipient_name}</p>
        <p>{address.phone_e164}</p>
        <p>{address.line1}</p>
        {address.line2 ? <p>{address.line2}</p> : null}
        <p>
          {address.city}, {address.emirate}
        </p>
      </InfoPanel>
      <InfoPanel title="Payment">
        <p>{order.payment_method.replaceAll("_", " ")}</p>
        <p>{order.payment_provider ?? "not assigned"}</p>
        <p className="break-all">{order.payment_provider_intent_id ?? "no intent"}</p>
      </InfoPanel>
      <InfoPanel title="Shipment">
        <p>{order.shipping_method}</p>
        <p>{order.shipping_provider ?? "not assigned"}</p>
        <p>{order.tracking_number ?? "no tracking"}</p>
        {order.tracking_url ? (
          <a className="text-admin-accent underline" href={order.tracking_url}>
            Tracking link
          </a>
        ) : null}
      </InfoPanel>
    </section>
  );
}

function InfoPanel({ title, children }: Readonly<{ title: string; children: ReactNode }>) {
  return (
    <div className="space-y-1 rounded-admin-md border border-admin-border bg-admin-surface p-3 text-admin-sm">
      <h3 className="font-admin-display text-admin-title text-admin-text">{title}</h3>
      <div className="space-y-1 text-admin-text-muted">{children}</div>
    </div>
  );
}

function Timeline({ items }: Readonly<{ items: AdminOrderTimelineItem[] }>) {
  return (
    <section className="rounded-admin-md border border-admin-border bg-admin-surface p-3">
      <h3 className="font-admin-display text-admin-title text-admin-text">Timeline</h3>
      <ol className="mt-2 space-y-2">
        {items.map((item) => (
          <li className="grid gap-1 text-admin-sm md:grid-cols-[180px_1fr]" key={`${item.label}-${item.occurredAt}`}>
            <span className="text-admin-text-muted">{formatDateTime(item.occurredAt)}</span>
            <span>
              {item.label}
              {item.detail ? <span className="text-admin-text-muted"> - {item.detail}</span> : null}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function EventTables({
  paymentEvents,
  shipmentEvents,
}: Readonly<{
  paymentEvents: PaymentEventRecord[];
  shipmentEvents: ShipmentEventRecord[];
}>) {
  return (
    <section className="grid gap-3 lg:grid-cols-2">
      <EventPanel title="Payment events">
        {paymentEvents.map((event) => (
          <EventRow
            detail={`${event.provider} ${formatAedNumber(event.amount_aed)}`}
            key={event.id}
            label={event.kind}
            occurredAt={event.occurred_at}
          />
        ))}
      </EventPanel>
      <EventPanel title="Shipment events">
        {shipmentEvents.map((event) => (
          <EventRow
            detail={event.provider_shipment_id ?? event.provider}
            key={event.id}
            label={event.status}
            occurredAt={event.occurred_at}
          />
        ))}
      </EventPanel>
    </section>
  );
}

function EventPanel({ title, children }: Readonly<{ title: string; children: ReactNode }>) {
  return (
    <div className="space-y-2 rounded-admin-md border border-admin-border bg-admin-surface p-3">
      <h3 className="font-admin-display text-admin-title text-admin-text">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function EventRow({
  label,
  detail,
  occurredAt,
}: Readonly<{ label: string; detail: string; occurredAt: string }>) {
  return (
    <div className="grid gap-1 text-admin-sm md:grid-cols-[130px_1fr]">
      <span className="text-admin-text-muted">{formatDateTime(occurredAt)}</span>
      <span>
        {label}
        <span className="text-admin-text-muted"> - {detail}</span>
      </span>
    </div>
  );
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-AE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Dubai",
  }).format(new Date(value));
}

function formatAedNumber(amount: number): string {
  return `AED ${amount}`;
}
