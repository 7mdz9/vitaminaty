"use client";

import { useMemo, useState } from "react";
import { FileJson, ListTree } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { renderAuditEntry } from "@/features/admin-audit/render";
import type { AuditLogRecord } from "@/types/audit-log";

export function AuditLogTable({ entries }: Readonly<{ entries: AuditLogRecord[] }>) {
  const rendered = useMemo(
    () => entries.map((entry) => ({ entry, rendered: renderAuditEntry(entry) })),
    [entries],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const selected = rendered.find((row) => row.entry.id === selectedId) ?? null;

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow className="h-9">
            <TableHead>Timestamp</TableHead>
            <TableHead>Actor</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Entity</TableHead>
            <TableHead>Diff preview</TableHead>
            <TableHead>IP</TableHead>
            <TableHead>User agent</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rendered.length === 0 ? (
            <TableRow>
              <TableCell className="py-8 text-center text-admin-text-muted" colSpan={7}>
                No audit rows match these filters.
              </TableCell>
            </TableRow>
          ) : (
            rendered.map(({ entry, rendered: row }) => (
              <TableRow className="h-10" key={entry.id}>
                <TableCell className="text-admin-text-muted">{formatDateTime(entry.occurred_at)}</TableCell>
                <TableCell>{entry.actor_email ?? "Unknown"}</TableCell>
                <TableCell>{entry.action.replaceAll("_", " ")}</TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span>{entry.entity_type}</span>
                    <span className="text-admin-caption text-admin-text-muted">{entry.entity_id ?? "none"}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Button
                    className="justify-start"
                    onClick={() => {
                      setSelectedId(entry.id);
                      setShowRaw(false);
                    }}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    <ListTree className="size-4" />
                    {row.summary}
                  </Button>
                </TableCell>
                <TableCell>{entry.ip ?? "none"}</TableCell>
                <TableCell className="max-w-56 truncate text-admin-text-muted">
                  {entry.user_agent ?? "none"}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <Sheet
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedId(null);
          }
        }}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          {selected ? (
            <>
              <SheetHeader>
                <SheetTitle>{selected.rendered.summary}</SheetTitle>
                <SheetDescription>
                  {selected.entry.action.replaceAll("_", " ")} · {formatDateTime(selected.entry.occurred_at)}
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4 px-4 pb-4">
                <div className="space-y-2 rounded-admin-md border border-admin-border bg-admin-surface p-3">
                  <h3 className="font-admin-display text-admin-title text-admin-text">Changes</h3>
                  <ul className="space-y-2 text-admin-sm">
                    {selected.rendered.lines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
                {selected.rendered.affectedIds && selected.rendered.affectedIds.length > 0 ? (
                  <details className="rounded-admin-md border border-admin-border bg-admin-surface p-3">
                    <summary className="cursor-pointer font-admin-display text-admin-title">
                      Affected products
                    </summary>
                    <ul className="mt-2 space-y-1 text-admin-sm text-admin-text-muted">
                      {selected.rendered.affectedIds.map((id) => (
                        <li className="break-all" key={id}>
                          {id}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
                <Button onClick={() => setShowRaw((value) => !value)} size="sm" type="button" variant="outline">
                  <FileJson className="size-4" />
                  {showRaw ? "Hide raw" : "Show raw"}
                </Button>
                {showRaw ? (
                  <pre className="max-h-[420px] overflow-auto rounded-admin-md border border-admin-border bg-admin-surface-muted p-3 text-admin-caption">
                    {selected.rendered.rawJson}
                  </pre>
                ) : null}
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-AE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Dubai",
  }).format(new Date(value));
}
