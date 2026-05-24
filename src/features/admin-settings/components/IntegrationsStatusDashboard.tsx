import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { IntegrationStatus } from "@/features/admin-settings/queries";

export function IntegrationsStatusDashboard({
  integrations,
}: Readonly<{ integrations: IntegrationStatus[] }>) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {integrations.map((integration) => (
        <section
          className="overflow-hidden rounded-admin-md border border-admin-border bg-admin-surface"
          key={integration.id}
        >
          <header className="flex items-start justify-between gap-3 border-b border-admin-border p-3">
            <div>
              <h3 className="font-admin-display text-lg text-admin-text">{integration.name}</h3>
              <p className="text-admin-sm text-admin-text-muted">
                Last successful webhook: {formatDateTime(integration.lastSuccessfulWebhookAt)}
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-1.5">
              <Badge variant={integration.mode === "live" ? "destructive" : "outline"}>
                {integration.mode}
              </Badge>
              <Badge variant={integration.adapterStatus === "available" ? "default" : "secondary"}>
                {integration.adapterStatus}
              </Badge>
            </div>
          </header>

          <div className="grid gap-3 p-3">
            <div className="grid grid-cols-2 gap-2 text-admin-sm">
              <div className="rounded-admin-md border border-admin-border bg-admin-surface-muted p-3">
                <div className="text-admin-caption text-admin-text-muted">Failures, 24h</div>
                <div className="mt-1 text-xl font-semibold tabular-nums text-admin-text">
                  {integration.webhookFailureCount24h}
                </div>
              </div>
              <div className="rounded-admin-md border border-admin-border bg-admin-surface-muted p-3">
                <div className="text-admin-caption text-admin-text-muted">Test transaction</div>
                <Button
                  className="mt-2"
                  disabled={!integration.testTransactionAvailable}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Sandbox only
                </Button>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow className="h-8">
                  <TableHead>Credential</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Masked</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {integration.credentials.map((credential) => (
                  <TableRow className="h-9" key={credential.label}>
                    <TableCell>{credential.label}</TableCell>
                    <TableCell>
                      <Badge variant={credential.configured ? "default" : "outline"}>
                        {credential.configured ? "Configured" : "Missing"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-admin-sm">
                      {credential.maskedValue}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      ))}
    </div>
  );
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "None";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-AE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
