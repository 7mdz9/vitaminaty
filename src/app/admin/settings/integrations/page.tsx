import { IntegrationsStatusDashboard } from "@/features/admin-settings/components/IntegrationsStatusDashboard";
import { getIntegrationSettings } from "@/features/admin-settings/queries";

export const dynamic = "force-dynamic";

export default async function AdminIntegrationsPage() {
  const integrations = await getIntegrationSettings();

  return (
    <div className="space-y-3">
      <header>
        <h2 className="font-admin-display text-xl text-admin-text">Integrations</h2>
        <p className="text-admin-sm text-admin-text-muted">
          Payment and shipping adapters, webhook health, and credential readiness.
        </p>
      </header>
      <IntegrationsStatusDashboard integrations={integrations} />
    </div>
  );
}
