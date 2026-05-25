"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type InlineEditState = "idle" | "dirty" | "saving" | "saved" | "error";

export function InlineEditCell({
  ariaLabel,
  value,
  kind,
  options = [],
  onSave,
}: Readonly<{
  ariaLabel: string;
  value: string | number | boolean | null;
  kind: "money" | "select" | "toggle";
  options?: Array<{ value: string; label: string }>;
  onSave: (
    value: string | number | boolean | null,
    force?: boolean,
  ) => Promise<{ ok: boolean; message?: string }>;
}>) {
  const [draft, setDraft] = useState(value);
  const [state, setState] = useState<InlineEditState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setDraft(value);
  }, [value]);

  async function save(nextValue = draft, force = false) {
    if (nextValue === value && !force) {
      setState("idle");
      return;
    }

    setState("saving");
    setMessage(null);
    const result = await onSave(nextValue, force);

    if (result.ok) {
      setState("saved");
      setTimeout(() => setState("idle"), 1200);
      return;
    }

    setState("error");
    setMessage(result.message ?? "Save failed.");
  }

  if (kind === "toggle") {
    return (
      <div className="flex items-center gap-2">
        <Button
          aria-label={ariaLabel}
          className={cn("h-7 rounded-admin-sm text-admin-caption", draft && "border-admin-accent")}
          onClick={() => {
            const next = !Boolean(draft);
            setDraft(next);
            startTransition(() => void save(next));
          }}
          size="sm"
          type="button"
          variant="outline"
        >
          {draft ? "Visible" : "Hidden"}
        </Button>
        <StateIcon state={isPending ? "saving" : state} />
      </div>
    );
  }

  if (kind === "select") {
    const selected = typeof draft === "string" ? draft : "";

    return (
      <div className="flex min-w-36 items-center gap-2">
        <Select
          value={selected || "__null"}
          onValueChange={(next) => {
            const normalized = next === "__null" ? null : next;
            setDraft(normalized);
            startTransition(() => void save(normalized));
          }}
        >
          <SelectTrigger
            aria-label={ariaLabel}
            className={cn(
              "h-7 w-full rounded-admin-sm text-admin-caption",
              state === "dirty" && "border-admin-accent",
            )}
          >
            <SelectValue>
              {options.find((option) => option.value === selected)?.label ?? "Unassigned"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__null">Unassigned</SelectItem>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <StateIcon state={isPending ? "saving" : state} />
        {state === "error" ? <ForceSaveButton onClick={() => save(draft, true)} /> : null}
      </div>
    );
  }

  return (
    <div className="flex min-w-24 items-center gap-2">
      <Input
        aria-label={ariaLabel}
        className={cn(
          "h-7 w-24 rounded-admin-sm text-right text-admin-sm tabular-nums",
          state === "dirty" && "border-admin-accent bg-admin-surface-muted",
        )}
        min={1}
        onBlur={() => startTransition(() => void save())}
        onChange={(event) => {
          const next = event.currentTarget.value === "" ? null : Number(event.currentTarget.value);
          setDraft(next);
          setState("dirty");
        }}
        type="number"
        value={draft === null ? "" : String(draft)}
      />
      <StateIcon state={isPending ? "saving" : state} />
      {state === "error" ? <ForceSaveButton onClick={() => save(draft, true)} /> : null}
      {message ? <span className="sr-only">{message}</span> : null}
    </div>
  );
}

function StateIcon({ state }: Readonly<{ state: InlineEditState }>) {
  if (state === "saving") {
    return <Loader2 className="size-3.5 animate-spin text-admin-text-muted" aria-label="Saving" />;
  }

  if (state === "saved") {
    return <Check className="size-3.5 text-admin-success" aria-label="Saved" />;
  }

  if (state === "error") {
    return <TriangleAlert className="size-3.5 text-admin-danger" aria-label="Save failed" />;
  }

  return <span className="size-3.5" aria-hidden="true" />;
}

function ForceSaveButton({ onClick }: Readonly<{ onClick: () => void }>) {
  return (
    <Button
      className="h-7 rounded-admin-sm text-admin-caption"
      onClick={onClick}
      size="sm"
      type="button"
      variant="destructive"
    >
      Save anyway
    </Button>
  );
}
