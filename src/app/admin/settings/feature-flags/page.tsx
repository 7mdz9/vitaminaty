import { FeatureFlagSettingsTable } from "@/features/admin-settings/feature-flags/components/FeatureFlagSettingsTable";
import { getFeatureFlagSettings } from "@/features/admin-settings/feature-flags/queries";

export const dynamic = "force-dynamic";

export default async function AdminFeatureFlagsPage() {
  const flags = await getFeatureFlagSettings();
  const lockedCount = flags.filter((flag) => flag.isLocked).length;

  return (
    <div className="space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-admin-display text-xl text-admin-text">Feature flags</h2>
          <p className="text-admin-sm text-admin-text-muted">
            {flags.length} flags - {lockedCount} HIGH_RIGOR locked
          </p>
        </div>
      </header>
      <FeatureFlagSettingsTable flags={flags} />
    </div>
  );
}
