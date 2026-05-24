import { OrderListTable } from "@/features/admin-orders/components/OrderListTable";
import {
  getAdminOrderList,
  parseAdminOrderListSearchParams,
} from "@/features/admin-orders/queries";
import type { AdminOrderListSearchParams } from "@/lib/validation/admin-order";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const dynamic = "force-dynamic";

const statuses = [
  "pending_payment",
  "paid",
  "preparing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
  "failed",
];

const paymentMethods = ["card", "apple_pay", "tabby", "tamara", "cod"];

export default async function AdminOrdersPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<AdminOrderListSearchParams>;
}>) {
  const params = await searchParams;
  const input = parseAdminOrderListSearchParams(params);
  const orders = await getAdminOrderList(input);

  return (
    <div className="space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-admin-display text-xl text-admin-text">Orders</h2>
          <p className="text-admin-sm text-admin-text-muted">
            {orders.length} orders shown
          </p>
        </div>
      </header>

      <section className="overflow-hidden rounded-admin-md border border-admin-border bg-admin-surface">
        <form className="grid gap-2 border-b border-admin-border p-3 md:grid-cols-6">
          <Input defaultValue={params.q ?? ""} name="q" placeholder="Reference" />
          <Input defaultValue={params.customer ?? ""} name="customer" placeholder="Customer" />
          <select
            className="h-8 rounded-admin-md border border-admin-border bg-admin-surface px-2 text-admin-sm"
            defaultValue={params.status ?? ""}
            name="status"
          >
            <option value="">All statuses</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          <select
            className="h-8 rounded-admin-md border border-admin-border bg-admin-surface px-2 text-admin-sm"
            defaultValue={params.payment_method ?? ""}
            name="payment_method"
          >
            <option value="">All payments</option>
            {paymentMethods.map((method) => (
              <option key={method} value={method}>
                {method.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          <Input defaultValue={params.date_from ?? ""} name="date_from" type="date" />
          <div className="flex gap-2">
            <Input defaultValue={params.date_to ?? ""} name="date_to" type="date" />
            <Button size="sm" type="submit">
              Filter
            </Button>
          </div>
        </form>
        <OrderListTable orders={orders} />
      </section>
    </div>
  );
}
