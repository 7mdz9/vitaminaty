"use client";

import { useState, useTransition } from "react";
import { CheckCircle, PackageCheck, PackageOpen, RotateCcw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { refundOrder, transitionOrderStatus } from "@/features/admin-orders/actions";
import type { OrderRecord, OrderStatus } from "@/types/order";

export function OrderStatusActions({ order }: Readonly<{ order: OrderRecord }>) {
  const [current, setCurrent] = useState(order);
  const [reason, setReason] = useState("manual_admin_transition");
  const [trackingNumber, setTrackingNumber] = useState(current.tracking_number ?? "");
  const [trackingUrl, setTrackingUrl] = useState(current.tracking_url ?? "");
  const [refundAmount, setRefundAmount] = useState(String(current.total_aed));
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submitTransition(toStatus: OrderStatus) {
    setMessage(null);
    startTransition(async () => {
      const result = await transitionOrderStatus({
        orderId: current.id,
        expectedUpdatedAt: current.updated_at,
        toStatus,
        reason,
        trackingNumber: trackingNumber || null,
        trackingUrl: trackingUrl || null,
        notifyCustomer: true,
      });

      if (result.ok) {
        setCurrent(result.order);
        setMessage("Order status updated.");
      } else {
        setMessage(result.message);
        if (result.error === "stale_data" && result.current) {
          setCurrent(result.current);
        }
      }
    });
  }

  function submitRefund(refundKind: "full" | "partial") {
    setMessage(null);
    startTransition(async () => {
      const result = await refundOrder({
        orderId: current.id,
        expectedUpdatedAt: current.updated_at,
        refundKind,
        amountAed: Number(refundAmount),
        reason,
        notifyCustomer: true,
      });

      if (result.ok) {
        setCurrent(result.order);
        setMessage("Refund recorded.");
      } else {
        setMessage(result.message);
        if (result.error === "stale_data" && result.current) {
          setCurrent(result.current);
        }
      }
    });
  }

  const canPrepare = current.status === "paid";
  const canShip = current.status === "preparing";
  const canDeliver = current.status === "shipped";
  const canCancel = ["pending_payment", "paid", "preparing"].includes(current.status);
  const canRefund = ["paid", "preparing", "shipped", "delivered"].includes(current.status);

  return (
    <section className="space-y-3 rounded-admin-md border border-admin-border bg-admin-surface p-4">
      <div>
        <h3 className="font-admin-display text-admin-title text-admin-text">Order actions</h3>
        <p className="text-admin-sm text-admin-text-muted">
          Current status: {current.status.replaceAll("_", " ")}
        </p>
      </div>

      <label className="space-y-1 text-admin-sm">
        <span className="text-admin-text-muted">Reason</span>
        <Input value={reason} onChange={(event) => setReason(event.target.value)} />
      </label>

      {canShip ? (
        <div className="grid gap-2 md:grid-cols-2">
          <label className="space-y-1 text-admin-sm">
            <span className="text-admin-text-muted">Tracking number</span>
            <Input
              value={trackingNumber}
              onChange={(event) => setTrackingNumber(event.target.value)}
            />
          </label>
          <label className="space-y-1 text-admin-sm">
            <span className="text-admin-text-muted">Tracking URL</span>
            <Input value={trackingUrl} onChange={(event) => setTrackingUrl(event.target.value)} />
          </label>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {canPrepare ? (
          <Button disabled={isPending} onClick={() => submitTransition("preparing")} size="sm">
            <PackageOpen className="size-4" />
            Preparing
          </Button>
        ) : null}
        {canShip ? (
          <Button disabled={isPending} onClick={() => submitTransition("shipped")} size="sm">
            <PackageCheck className="size-4" />
            Shipped
          </Button>
        ) : null}
        {canDeliver ? (
          <Button disabled={isPending} onClick={() => submitTransition("delivered")} size="sm">
            <CheckCircle className="size-4" />
            Delivered
          </Button>
        ) : null}
        {canCancel ? (
          <Button
            disabled={isPending}
            onClick={() => submitTransition("cancelled")}
            size="sm"
            variant="destructive"
          >
            <XCircle className="size-4" />
            Cancel
          </Button>
        ) : null}
      </div>

      {canRefund ? (
        <div className="space-y-2 border-t border-admin-border pt-3">
          <label className="max-w-48 space-y-1 text-admin-sm">
            <span className="text-admin-text-muted">Refund amount</span>
            <Input
              min={1}
              type="number"
              value={refundAmount}
              onChange={(event) => setRefundAmount(event.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={isPending}
              onClick={() => submitRefund("full")}
              size="sm"
              variant="outline"
            >
              <RotateCcw className="size-4" />
              Full refund
            </Button>
            <Button
              disabled={isPending}
              onClick={() => submitRefund("partial")}
              size="sm"
              variant="outline"
            >
              Partial refund
            </Button>
          </div>
        </div>
      ) : null}

      {message ? <p className="text-admin-sm text-admin-text-muted">{message}</p> : null}
    </section>
  );
}
