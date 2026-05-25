"use client";

import { useState, useTransition } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { toggleFeatureFlag } from "@/features/feature-flags/admin-actions";
import type { FeatureFlagKey } from "@/features/feature-flags/flags";
import type { FeatureFlagRecord } from "@/types/feature-flag";

export function DashboardFlagToggles({
  flags,
}: Readonly<{
  flags: FeatureFlagRecord[];
}>) {
  const [rows, setRows] = useState(flags);
  const [status, setStatus] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function setFlag(flag: FeatureFlagRecord, enabled: boolean) {
    setPendingKey(flag.key);
    setStatus(null);

    startTransition(async () => {
      const result = await toggleFeatureFlag({
        key: flag.key as FeatureFlagKey,
        enabled,
        expectedUpdatedAt: flag.updated_at,
      });

      if (result.ok) {
        setRows((current) => current.map((row) => (row.key === flag.key ? result.flag : row)));
        setStatus(`${flag.key} ${enabled ? "enabled" : "disabled"}.`);
      } else {
        setStatus(result.message);
      }

      setPendingKey(null);
    });
  }

  return (
    <div className="space-y-2">
      {status ? <p className="text-admin-caption text-admin-text-muted">{status}</p> : null}
      {rows.map((flag) => (
        <label
          className="flex min-h-9 items-center justify-between gap-3 rounded-admin-sm border border-admin-border bg-admin-surface px-2 py-1.5 text-admin-sm"
          key={flag.key}
        >
          <span className="font-mono text-admin-text">{flag.key}</span>
          <Checkbox
            aria-label={`Toggle ${flag.key}`}
            checked={flag.enabled}
            disabled={pendingKey === flag.key}
            onCheckedChange={(value) => setFlag(flag, value === true)}
          />
        </label>
      ))}
    </div>
  );
}
