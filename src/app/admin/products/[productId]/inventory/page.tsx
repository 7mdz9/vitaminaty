import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { InventoryHistoryFilters } from "@/features/admin-products/components/InventoryHistoryFilters";
import { InventoryHistoryTable } from "@/features/admin-products/components/InventoryHistoryTable";
import { getInventoryHistory } from "@/features/admin-products/actions";
import { getProductEditor } from "@/features/admin-products/queries";
import type { GetInventoryHistoryActionInput } from "@/lib/validation/inventory";

export const dynamic = "force-dynamic";

const inventoryReasons = [
  "manual_adjustment",
  "order_placed",
  "order_cancelled",
  "payment_failed",
  "refund_returned",
  "stock_recount",
  "import_update",
] as const;

export default async function AdminProductInventoryPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ productId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const { productId } = await params;
  const filters = await searchParams;
  const { editor } = await getProductEditor(productId);

  if (!editor) {
    notFound();
  }

  const historyInput = buildHistoryInput(productId, filters);
  const result = await getInventoryHistory(historyInput);

  if (!result.ok) {
    throw new Error(result.message);
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-admin-border pb-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            render={<Link href={`/admin/products/${productId}`} />}
            size="icon-sm"
            variant="outline"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div className="min-w-0">
            <h2 className="truncate font-admin-display text-xl text-admin-text">
              {editor.product.name}
            </h2>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant="outline">Inventory history</Badge>
              <span className="text-admin-sm text-admin-text-muted">
                {result.movements.length} rows
              </span>
            </div>
          </div>
        </div>
      </header>
      <section className="rounded-admin-md border border-admin-border bg-admin-surface p-3">
        <InventoryHistoryFilters
          actor={readOne(filters.actor)}
          end={readOne(filters.end)}
          productId={productId}
          reason={readOne(filters.reason)}
          start={readOne(filters.start)}
        />
      </section>
      <section className="overflow-hidden rounded-admin-md border border-admin-border bg-admin-surface">
        <InventoryHistoryTable movements={result.movements} />
      </section>
    </div>
  );
}

function buildHistoryInput(
  productId: string,
  searchParams: Record<string, string | string[] | undefined>,
): GetInventoryHistoryActionInput {
  const reason = readOne(searchParams.reason);
  const actorUserId = readOne(searchParams.actor);
  const start = readDateTime(searchParams.start);
  const end = readDateTime(searchParams.end);

  return {
    productId,
    reason: isInventoryReason(reason) ? reason : undefined,
    actorUserId: actorUserId || undefined,
    start: start && end ? start : undefined,
    end: start && end ? end : undefined,
  };
}

function isInventoryReason(
  value: string | undefined,
): value is NonNullable<GetInventoryHistoryActionInput["reason"]> {
  return inventoryReasons.some((reason) => reason === value);
}

function readOne(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function readDateTime(value: string | string[] | undefined): string | undefined {
  const raw = readOne(value);

  if (!raw) {
    return undefined;
  }

  const parsed = new Date(raw);

  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}
