import Link from "next/link";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OrderStatusBadge } from "@/features/admin-orders/components/OrderStatusBadge";
import type { AdminOrderListItem } from "@/features/admin-orders/queries";

export function OrderListTable({ orders }: Readonly<{ orders: AdminOrderListItem[] }>) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="h-9">
          <TableHead>Reference</TableHead>
          <TableHead>Customer</TableHead>
          <TableHead>Date</TableHead>
          <TableHead className="text-right">Items</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead>Payment</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="w-20 text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.length === 0 ? (
          <TableRow>
            <TableCell className="py-8 text-center text-admin-text-muted" colSpan={8}>
              No orders match these filters.
            </TableCell>
          </TableRow>
        ) : (
          orders.map((row) => (
            <TableRow className="h-10" key={row.order.id}>
              <TableCell className="font-medium text-admin-text">{row.order.reference}</TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span>{row.customer.name ?? "Guest"}</span>
                  <span className="text-admin-caption text-admin-text-muted">
                    {row.customer.email ?? row.customer.phone ?? "No customer contact"}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-admin-text-muted">
                {formatDateTime(row.order.created_at)}
              </TableCell>
              <TableCell className="text-right tabular-nums">{row.itemsCount}</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatAedNumber(row.order.total_aed)}
              </TableCell>
              <TableCell>{row.order.payment_method.replaceAll("_", " ")}</TableCell>
              <TableCell>
                <OrderStatusBadge status={row.order.status} />
              </TableCell>
              <TableCell className="text-right">
                <Button
                  render={<Link href={`/admin/orders/${row.order.id}`} />}
                  size="icon"
                  variant="ghost"
                >
                  <Eye className="size-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
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
