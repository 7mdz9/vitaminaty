import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Database } from "@/lib/supabase/types.generated";

type InventoryMovement = Database["public"]["Tables"]["inventory_movements"]["Row"];

export function InventoryHistoryTable({
  movements,
}: Readonly<{
  movements: InventoryMovement[];
}>) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead scope="col">Timestamp</TableHead>
          <TableHead scope="col">Variant</TableHead>
          <TableHead scope="col" className="text-right">Previous</TableHead>
          <TableHead scope="col" className="text-right">New</TableHead>
          <TableHead scope="col" className="text-right">Change</TableHead>
          <TableHead scope="col">Reason</TableHead>
          <TableHead scope="col">Admin</TableHead>
          <TableHead scope="col">Order</TableHead>
          <TableHead scope="col">Note</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {movements.length === 0 ? (
          <TableRow>
            <TableCell colSpan={9}>No inventory movements match this view.</TableCell>
          </TableRow>
        ) : (
          movements.map((movement) => (
            <TableRow key={movement.id}>
              <TableCell className="whitespace-nowrap tabular-nums">
                {new Date(movement.changed_at).toLocaleString()}
              </TableCell>
              <TableCell className="font-mono text-admin-caption">{movement.variant_id}</TableCell>
              <TableCell className="text-right tabular-nums">{movement.previous_quantity ?? "-"}</TableCell>
              <TableCell className="text-right tabular-nums">{movement.new_quantity}</TableCell>
              <TableCell className="text-right tabular-nums">{formatChange(movement.change_amount)}</TableCell>
              <TableCell>
                <Badge variant="outline">{movement.reason.replace(/_/g, " ")}</Badge>
              </TableCell>
              <TableCell className="font-mono text-admin-caption">{movement.changed_by ?? "-"}</TableCell>
              <TableCell className="font-mono text-admin-caption">{movement.order_id ?? "-"}</TableCell>
              <TableCell>{movement.change_reason_note ?? "-"}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

function formatChange(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}
