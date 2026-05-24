import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusStyles: Record<string, string> = {
  imported: "border-admin-border bg-admin-surface-muted text-admin-text-muted",
  draft: "border-admin-warning/30 bg-admin-warning/10 text-admin-warning",
  partial: "border-admin-warning/30 bg-admin-warning/10 text-admin-warning",
  ready_to_publish: "border-admin-success/30 bg-admin-success/10 text-admin-success",
  published: "border-admin-success/30 bg-admin-success/10 text-admin-success",
  hidden: "border-admin-border bg-admin-surface-muted text-admin-text-muted",
  archived: "border-admin-border bg-admin-surface-muted text-admin-text-muted",
};

export function StatusBadge({ status }: Readonly<{ status: string }>) {
  return (
    <Badge
      className={cn("h-6 rounded-admin-sm px-2 text-admin-caption", statusStyles[status])}
      variant="outline"
    >
      {status.replace(/_/g, " ")}
    </Badge>
  );
}
