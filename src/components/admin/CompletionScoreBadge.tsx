import { cn } from "@/lib/utils";

export function CompletionScoreBadge({ score }: Readonly<{ score: number }>) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const tone =
    clamped >= 80 ? "bg-admin-success" : clamped >= 50 ? "bg-admin-warning" : "bg-admin-danger";

  return (
    <div className="flex min-w-20 items-center gap-2 tabular-nums">
      <span className="w-8 text-right text-admin-caption text-admin-text-muted">{clamped}</span>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-admin-surface-muted">
        <span className={cn("block h-full rounded-full", tone)} style={{ width: `${clamped}%` }} />
      </span>
    </div>
  );
}
