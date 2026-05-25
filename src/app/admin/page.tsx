import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangle, Boxes, CheckCircle2, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DashboardFlagToggles } from "@/features/admin-dashboard/components/DashboardFlagToggles";
import { getAdminDashboardData } from "@/features/admin-dashboard/queries";
import { renderAuditEntry } from "@/features/admin-audit/render";
import type { AuditLogRecord } from "@/types/audit-log";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const data = await getAdminDashboardData();
  const operationalFlags = data.featureFlags.filter((flag) =>
    ["maintenance_mode", "read_only_mode"].includes(flag.key),
  );
  const commerceFlags = data.featureFlags.filter((flag) =>
    ["commerce_enabled", "cart_visible", "checkout_enabled", "paymob_live_mode"].includes(flag.key),
  );

  return (
    <div className="space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-admin-display text-xl text-admin-text">Dashboard</h2>
          <p className="text-admin-sm text-admin-text-muted">
            Catalog, operations, and admin activity snapshot
          </p>
        </div>
        <Button render={<Link href="/admin/homepage" />} size="sm">
          Homepage curation
          <ExternalLink className="size-3.5" />
        </Button>
      </header>

      <section className="grid gap-3 lg:grid-cols-4">
        <Metric label="Total products" value={data.catalog.totalProducts} />
        <Metric label="Published" value={data.catalog.publishedProducts} />
        <Metric label="Ready to publish" value={data.catalog.readyToPublish} />
        <Metric label="Avg completion" suffix="%" value={data.catalog.averageCompletionScore} />
      </section>

      <section className="grid gap-3 xl:grid-cols-[1.4fr_1fr]">
        <Panel title="Needs Attention">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <QueueLink
              href="/admin/products?flag=missing_price"
              label="Missing price"
              value={data.catalog.missingPrice}
            />
            <QueueLink
              href="/admin/products?flag=missing_image"
              label="Missing image"
              value={data.catalog.missingImage}
            />
            <QueueLink
              href="/admin/products?flag=missing_stock_quantity"
              label="Missing stock"
              value={data.catalog.missingStockQuantity}
            />
            <QueueLink
              href="/admin/products?flag=needs_category_review"
              label="Category review"
              value={data.catalog.needsCategoryReview}
            />
            <QueueLink
              href="/admin/products?flag=needs_brand_review"
              label="Brand review"
              value={data.catalog.needsBrandReview}
            />
            <QueueLink
              href="/admin/products?stock_status=out_of_stock"
              label="Out of stock"
              value={data.catalog.outOfStock}
            />
            <QueueLink
              href="/admin/products?stock_status=low_stock"
              label="Low stock"
              value={data.catalog.lowStock}
            />
            <QueueLink
              href="/admin/products?status=ready_to_publish"
              label="Ready queue"
              value={data.catalog.readyToPublish}
            />
          </div>
        </Panel>

        <Panel title="Operations">
          <div className="space-y-2 text-admin-sm">
            <AlertRow
              active={data.operations.paymentFailureCount24h > 0}
              label="Payment webhook failures, 24h"
              value={data.operations.paymentFailureCount24h}
            />
            <AlertRow
              active={data.operations.shipmentFailureCount24h > 0}
              label="Shipment webhook failures, 24h"
              value={data.operations.shipmentFailureCount24h}
            />
            <AlertRow
              active={data.operations.outOfStockPublished > 0}
              label="Published products out of stock"
              value={data.operations.outOfStockPublished}
            />
          </div>
        </Panel>
      </section>

      <section className="grid gap-3 xl:grid-cols-2">
        <Panel title="Recent Orders">
          <CompactTable
            empty="No orders yet."
            headers={["Reference", "Status", "Total", "Created"]}
            rows={data.recentOrders.map((order) => [
              order.reference,
              order.status,
              `AED ${order.total_aed}`,
              formatDateTime(order.created_at),
            ])}
          />
        </Panel>

        <Panel title="Recently Edited Products">
          <Table>
            <TableHeader>
              <TableRow className="h-9">
                <TableHead>Product</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Editor</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.recentProducts.map((product) => (
                <TableRow className="h-10" key={product.id}>
                  <TableCell>
                    <Link
                      className="font-medium text-admin-text hover:underline"
                      href={`/admin/products/${product.id}`}
                    >
                      {product.name}
                    </Link>
                    <p className="text-admin-caption text-admin-text-muted">{product.slug}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{product.status.replace(/_/g, " ")}</Badge>
                  </TableCell>
                  <TableCell className="text-admin-sm text-admin-text-muted">
                    {product.editedByEmail ? redactEmail(product.editedByEmail) : "Unknown"}
                  </TableCell>
                  <TableCell className="text-admin-sm text-admin-text-muted">
                    {formatDateTime(product.updatedAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      </section>

      <section className="grid gap-3 xl:grid-cols-[1.3fr_1fr]">
        <Panel title="Recent Admin Activity">
          <div className="divide-y divide-admin-border">
            {data.recentActivity.map((entry) => (
              <ActivityRow entry={entry} key={entry.id} />
            ))}
          </div>
        </Panel>

        <div className="space-y-3">
          <Panel title="Feature Flags">
            <div className="space-y-3">
              <DashboardFlagToggles flags={operationalFlags} />
              <div className="flex flex-wrap gap-1.5">
                {commerceFlags.map((flag) => (
                  <Badge key={flag.key} variant={flag.enabled ? "default" : "outline"}>
                    {flag.key}: {flag.enabled ? "on" : "off"}
                  </Badge>
                ))}
              </div>
            </div>
          </Panel>

          <Panel title="System Health">
            <dl className="grid gap-2 text-admin-sm">
              <HealthRow label="Paymob" value={`${data.systemHealth.paymobMode} mode`} />
              <HealthRow label="iCarry" value={`${data.systemHealth.icarryMode} mode`} />
              <HealthRow label="Email" value={`${data.systemHealth.emailMode} provider`} />
              <HealthRow
                label="Last payment webhook"
                value={formatNullableDate(data.systemHealth.lastPaymentWebhookAt)}
              />
              <HealthRow
                label="Last shipment webhook"
                value={formatNullableDate(data.systemHealth.lastShipmentWebhookAt)}
              />
            </dl>
          </Panel>

          <Panel title="Your Progress">
            <div className="grid grid-cols-2 gap-2">
              <Metric label="Today" value={data.progress.today} compact />
              <Metric label="Last hour" value={data.progress.lastHour} compact />
            </div>
          </Panel>
        </div>
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
  suffix = "",
  compact = false,
}: Readonly<{
  label: string;
  value: number;
  suffix?: string;
  compact?: boolean;
}>) {
  return (
    <div className="rounded-admin-md border border-admin-border bg-admin-surface p-3">
      <p className="text-admin-caption uppercase text-admin-text-muted">{label}</p>
      <p
        className={
          compact
            ? "font-admin-display text-2xl text-admin-text"
            : "font-admin-display text-3xl text-admin-text"
        }
      >
        {value.toLocaleString("en-AE")}
        {suffix}
      </p>
    </div>
  );
}

function Panel({ title, children }: Readonly<{ title: string; children: ReactNode }>) {
  return (
    <section className="overflow-hidden rounded-admin-md border border-admin-border bg-admin-surface">
      <div className="border-b border-admin-border bg-admin-surface-muted px-3 py-2">
        <h3 className="font-admin-display text-admin-sm text-admin-text">{title}</h3>
      </div>
      <div className="p-3">{children}</div>
    </section>
  );
}

function QueueLink({
  href,
  label,
  value,
}: Readonly<{ href: string; label: string; value: number }>) {
  return (
    <Link
      className="flex min-h-12 items-center justify-between rounded-admin-sm border border-admin-border bg-admin-surface px-3 py-2 hover:bg-admin-surface-muted"
      href={href}
    >
      <span className="text-admin-sm text-admin-text">{label}</span>
      <Badge variant={value > 0 ? "destructive" : "outline"}>{value}</Badge>
    </Link>
  );
}

function AlertRow({
  active,
  label,
  value,
}: Readonly<{ active: boolean; label: string; value: number }>) {
  const Icon = active ? AlertTriangle : CheckCircle2;

  return (
    <div className="flex items-center justify-between gap-3 rounded-admin-sm border border-admin-border px-2 py-2">
      <span className="flex items-center gap-2 text-admin-text">
        <Icon className={active ? "size-4 text-admin-danger" : "size-4 text-admin-success"} />
        {label}
      </span>
      <Badge variant={active ? "destructive" : "outline"}>{value}</Badge>
    </div>
  );
}

function CompactTable({
  headers,
  rows,
  empty,
}: Readonly<{
  headers: string[];
  rows: string[][];
  empty: string;
}>) {
  if (rows.length === 0) {
    return <p className="text-admin-sm text-admin-text-muted">{empty}</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="h-9">
          {headers.map((header) => (
            <TableHead key={header}>{header}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow className="h-10" key={row.join("|")}>
            {row.map((cell) => (
              <TableCell className="text-admin-sm" key={cell}>
                {cell}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ActivityRow({ entry }: Readonly<{ entry: AuditLogRecord }>) {
  const rendered = renderAuditEntry(entry);

  return (
    <div className="flex min-h-12 items-center justify-between gap-3 py-2 text-admin-sm">
      <div>
        <p className="text-admin-text">{rendered.summary}</p>
        <p className="text-admin-caption text-admin-text-muted">
          {entry.entity_type}
          {entry.entity_id ? ` / ${entry.entity_id.slice(0, 8)}` : ""}
        </p>
      </div>
      <span className="whitespace-nowrap text-admin-caption text-admin-text-muted">
        {formatDateTime(entry.occurred_at)}
      </span>
    </div>
  );
}

function HealthRow({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="flex items-center gap-2 text-admin-text-muted">
        <Boxes className="size-4" />
        {label}
      </dt>
      <dd className="text-admin-text">{value}</dd>
    </div>
  );
}

function formatNullableDate(value: string | null): string {
  return value ? formatDateTime(value) : "No event yet";
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-AE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function redactEmail(value: string): string {
  const [, domain] = value.split("@");
  return domain ? `***@${domain}` : value;
}
