import { Badge } from "@/components/ui/badge";
import type { OrderStatus } from "@/types/order";

const toneByStatus: Record<OrderStatus, string> = {
  pending_payment: "border-admin-warning text-admin-warning",
  paid: "border-admin-success text-admin-success",
  preparing: "border-admin-accent text-admin-accent",
  shipped: "border-admin-accent text-admin-accent",
  delivered: "border-admin-success text-admin-success",
  cancelled: "border-admin-text-muted text-admin-text-muted",
  refunded: "border-admin-warning text-admin-warning",
  failed: "border-admin-danger text-admin-danger",
};

export function OrderStatusBadge({ status }: Readonly<{ status: OrderStatus }>) {
  return (
    <Badge className={toneByStatus[status]} variant="outline">
      {status.replaceAll("_", " ")}
    </Badge>
  );
}
