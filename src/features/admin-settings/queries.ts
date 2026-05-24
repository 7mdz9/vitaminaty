import "server-only";

import { requireAdmin } from "@/lib/auth/policies";
import { env } from "@/lib/env";
import { listAuthAdmins, type AuthAdminUserSummary } from "@/server/repositories/admin-repository";
import { getPaymentIntegrationEventStats } from "@/server/repositories/payment-event-repository";
import { getShipmentIntegrationEventStats } from "@/server/repositories/shipment-event-repository";

export type IntegrationCredentialSummary = Readonly<{
  label: string;
  configured: boolean;
  maskedValue: string;
}>;

export type IntegrationStatus = Readonly<{
  id: "paymob" | "icarry";
  name: string;
  mode: "stub" | "live";
  adapterStatus: "available" | "pending";
  lastSuccessfulWebhookAt: string | null;
  webhookFailureCount24h: number;
  testTransactionAvailable: boolean;
  credentials: IntegrationCredentialSummary[];
}>;

export async function getIntegrationSettings(): Promise<IntegrationStatus[]> {
  await requireAdmin();

  const [paymentStats, shipmentStats] = await Promise.all([
    getPaymentIntegrationEventStats(env.PAYMOB_MODE === "live" ? "paymob" : "stub"),
    getShipmentIntegrationEventStats(env.ICARRY_MODE === "live" ? "icarry" : "stub"),
  ]);

  return [
    {
      id: "paymob",
      name: "Paymob",
      mode: env.PAYMOB_MODE,
      adapterStatus: env.PAYMOB_MODE === "stub" ? "available" : "pending",
      lastSuccessfulWebhookAt: paymentStats.lastSuccessfulWebhookAt,
      webhookFailureCount24h: paymentStats.failureCount24h,
      testTransactionAvailable: false,
      credentials: [
        credential("API key", env.PAYMOB_API_KEY),
        credential("HMAC secret", env.PAYMOB_HMAC_SECRET),
        credential("Cards integration", env.PAYMOB_INTEGRATION_ID_CARDS),
        credential("Apple Pay integration", env.PAYMOB_INTEGRATION_ID_APPLE_PAY),
        credential("Tabby integration", env.PAYMOB_INTEGRATION_ID_TABBY),
        credential("Tamara integration", env.PAYMOB_INTEGRATION_ID_TAMARA),
        credential("Iframe", env.PAYMOB_IFRAME_ID),
      ],
    },
    {
      id: "icarry",
      name: "iCarry",
      mode: env.ICARRY_MODE,
      adapterStatus: env.ICARRY_MODE === "stub" ? "available" : "pending",
      lastSuccessfulWebhookAt: shipmentStats.lastSuccessfulWebhookAt,
      webhookFailureCount24h: shipmentStats.failureCount24h,
      testTransactionAvailable: false,
      credentials: [
        credential("API key", env.ICARRY_API_KEY),
        credential("Account", env.ICARRY_ACCOUNT_ID),
        credential("Webhook secret", env.ICARRY_WEBHOOK_SECRET),
        credential("Origin address", env.ICARRY_ORIGIN_ADDRESS_ID),
      ],
    },
  ];
}

export async function getAdminUsers(): Promise<AuthAdminUserSummary[]> {
  await requireAdmin();
  return listAuthAdmins();
}

function credential(label: string, value: string | undefined): IntegrationCredentialSummary {
  return {
    label,
    configured: Boolean(value),
    maskedValue: maskSecret(value),
  };
}

function maskSecret(value: string | undefined): string {
  if (!value) {
    return "Not configured";
  }

  const suffix = value.slice(-4);
  return `****${suffix}`;
}
