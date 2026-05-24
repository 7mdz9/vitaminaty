import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Kbd({ className, ...props }: ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "rounded border border-admin-border bg-admin-surface-muted px-1.5 py-0.5 font-mono text-[0.7rem] text-admin-text-muted shadow-sm",
        className,
      )}
      {...props}
    />
  );
}
