import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const reasons = [
  "manual_adjustment",
  "order_placed",
  "order_cancelled",
  "payment_failed",
  "refund_returned",
  "stock_recount",
  "import_update",
];

export function InventoryHistoryFilters({
  productId,
  reason,
  actor,
  start,
  end,
}: Readonly<{
  productId: string;
  reason?: string;
  actor?: string;
  start?: string;
  end?: string;
}>) {
  return (
    <form action={`/admin/products/${productId}/inventory`} className="grid gap-2 md:grid-cols-[180px_1fr_1fr_1fr_auto]">
      <Select name="reason" defaultValue={reason ?? "__all"}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Reason" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all">All reasons</SelectItem>
          {reasons.map((item) => (
            <SelectItem key={item} value={item}>
              {item.replace(/_/g, " ")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input name="actor" placeholder="Actor user id" defaultValue={actor ?? ""} />
      <Input name="start" type="datetime-local" defaultValue={start ?? ""} />
      <Input name="end" type="datetime-local" defaultValue={end ?? ""} />
      <Button type="submit">Filter</Button>
    </form>
  );
}
