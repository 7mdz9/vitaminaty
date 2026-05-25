import { ShieldCheck } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Badge } from "@/components/ui/badge";

export function AdminHeader() {
  return (
    <header className="sticky top-0 z-admin-header border-b border-admin-border bg-admin-surface/95 backdrop-blur">
      <div className="flex h-14 items-center justify-between gap-3 px-4">
        <div className="min-w-0">
          <p className="text-admin-caption font-medium uppercase text-admin-text-muted">
            Admin portal
          </p>
          <h1 className="truncate font-admin-display text-admin-title text-admin-text">
            Operations workspace
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            className="gap-1 border-admin-border bg-admin-surface-muted text-admin-text"
            variant="outline"
          >
            <ShieldCheck className="size-3.5 text-admin-success" />
            MFA
          </Badge>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
