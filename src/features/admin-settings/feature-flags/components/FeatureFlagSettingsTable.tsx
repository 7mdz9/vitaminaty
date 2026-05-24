"use client";

import { useMemo, useState, useTransition } from "react";
import { Lock, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  beginFeatureFlagMfaChallenge,
  toggleFeatureFlag,
} from "@/features/feature-flags/admin-actions";
import type { AdminFeatureFlagRow } from "@/features/admin-settings/feature-flags/queries";

type PendingToggle = Readonly<{
  row: AdminFeatureFlagRow;
  enabled: boolean;
  factorId: string | null;
  challengeId: string | null;
}>;

const categoryLabels = {
  surface: "Surface",
  feature: "Feature",
  operational: "Operational",
} as const;

export function FeatureFlagSettingsTable({
  flags,
}: Readonly<{ flags: AdminFeatureFlagRow[] }>) {
  const [rows, setRows] = useState(flags);
  const [pendingToggle, setPendingToggle] = useState<PendingToggle | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [phrase, setPhrase] = useState("");
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const groupedRows = useMemo(
    () =>
      rows.reduce<Record<string, AdminFeatureFlagRow[]>>((groups, row) => {
        groups[row.category] = [...(groups[row.category] ?? []), row];
        return groups;
      }, {}),
    [rows],
  );

  function requestToggle(row: AdminFeatureFlagRow, enabled: boolean) {
    setStatus(null);

    if (row.gate) {
      openHighRigorDialog(row, enabled);
      return;
    }

    submitToggle(row, enabled);
  }

  function openHighRigorDialog(row: AdminFeatureFlagRow, enabled: boolean) {
    setMfaCode("");
    setPhrase("");
    setPendingToggle({ row, enabled, factorId: null, challengeId: null });
    setPendingKey(row.key);

    startTransition(async () => {
      const challenge = await beginFeatureFlagMfaChallenge();

      if (challenge.ok) {
        setPendingToggle({ row, enabled, factorId: challenge.factorId, challengeId: challenge.challengeId });
        setStatus(null);
      } else {
        setStatus(challenge.message);
      }

      setPendingKey(null);
    });
  }

  function submitToggle(row: AdminFeatureFlagRow, enabled: boolean, mfa?: PendingToggle) {
    setPendingKey(row.key);

    startTransition(async () => {
      const result = await toggleFeatureFlag({
        key: row.key,
        enabled,
        expectedUpdatedAt: row.updatedAt,
        confirmationPhrase: phrase || undefined,
        mfa:
          mfa?.factorId && mfa.challengeId
            ? {
                factorId: mfa.factorId,
                challengeId: mfa.challengeId,
                code: mfaCode,
              }
            : undefined,
      });

      if (result.ok) {
        setRows((current) =>
          current.map((item) =>
            item.key === row.key
              ? {
                  ...item,
                  enabled: result.flag.enabled,
                  updatedAt: result.flag.updated_at,
                  updatedBy: result.flag.updated_by,
                }
              : item,
          ),
        );
        setPendingToggle(null);
        setStatus(`${row.key} ${enabled ? "enabled" : "disabled"}.`);
      } else {
        setStatus(result.message);
        if (result.current) {
          setRows((current) =>
            current.map((item) =>
              item.key === row.key
                ? {
                    ...item,
                    enabled: result.current?.enabled ?? item.enabled,
                    updatedAt: result.current?.updated_at ?? item.updatedAt,
                    updatedBy: result.current?.updated_by ?? item.updatedBy,
                  }
                : item,
            ),
          );
        }
      }

      setPendingKey(null);
    });
  }

  return (
    <>
      {status ? (
        <div className="rounded-admin-md border border-admin-border bg-admin-surface-muted px-3 py-2 text-admin-sm text-admin-text">
          {status}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-admin-md border border-admin-border bg-admin-surface">
        {(["surface", "feature", "operational"] as const).map((category) => (
          <section key={category}>
            <div className="border-b border-admin-border bg-admin-surface-muted px-3 py-2">
              <h3 className="font-admin-display text-admin-sm text-admin-text">
                {categoryLabels[category]}
              </h3>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="h-9">
                  <TableHead>Key</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Last changed</TableHead>
                  <TableHead className="w-24 text-right">Toggle</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(groupedRows[category] ?? []).map((row) => (
                  <TableRow className="h-11" key={row.key}>
                    <TableCell className="font-mono text-admin-sm text-admin-text">{row.key}</TableCell>
                    <TableCell className="max-w-xl text-admin-sm text-admin-text-muted">
                      <div className="space-y-1">
                        <p>{row.description}</p>
                        {row.gate ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant="outline">
                              <ShieldCheck className="size-3" />
                              {row.gate.signoffLabel}
                            </Badge>
                            {row.isLocked ? (
                              <Badge variant="secondary">
                                <Lock className="size-3" />
                                Locked
                              </Badge>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={row.enabled ? "default" : "outline"}>
                        {row.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-admin-sm text-admin-text-muted">
                      <div>{row.updatedByEmail ?? row.updatedBy ?? "Seed/migration"}</div>
                      <div className="tabular-nums">{formatDateTime(row.updatedAt)}</div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Checkbox
                        aria-label={`Toggle ${row.key}`}
                        checked={row.enabled}
                        disabled={row.isLocked || pendingKey === row.key}
                        onCheckedChange={(value) => requestToggle(row, value === true)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        ))}
      </div>

      <Dialog open={pendingToggle !== null} onOpenChange={(open) => (!open ? setPendingToggle(null) : null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirm HIGH_RIGOR flag change</DialogTitle>
            <DialogDescription>
              {pendingToggle?.row.key} will be {pendingToggle?.enabled ? "enabled" : "disabled"}.
            </DialogDescription>
          </DialogHeader>

          {pendingToggle?.row.gate ? (
            <div className="space-y-3 text-admin-sm">
              <div className="rounded-admin-md border border-admin-border bg-admin-surface-muted p-3">
                <p className="font-medium text-admin-text">{pendingToggle.row.gate.signoffLabel}</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-admin-text-muted">
                  {pendingToggle.row.gate.consequences.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <Input
                inputMode="numeric"
                maxLength={6}
                onChange={(event) => setMfaCode(event.target.value)}
                placeholder="TOTP code"
                value={mfaCode}
              />
              {pendingToggle.enabled && pendingToggle.row.gate.enablePhrase ? (
                <Input
                  onChange={(event) => setPhrase(event.target.value)}
                  placeholder={pendingToggle.row.gate.enablePhrase}
                  value={phrase}
                />
              ) : null}
            </div>
          ) : null}

          <DialogFooter>
            <Button onClick={() => setPendingToggle(null)} type="button" variant="outline">
              Cancel
            </Button>
            <Button
              disabled={
                pendingKey === pendingToggle?.row.key ||
                !pendingToggle?.factorId ||
                !pendingToggle.challengeId ||
                mfaCode.length !== 6
              }
              onClick={() =>
                pendingToggle
                  ? submitToggle(pendingToggle.row, pendingToggle.enabled, pendingToggle)
                  : null
              }
              type="button"
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-AE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
