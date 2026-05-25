import "server-only";

import { requireAdmin } from "@/lib/auth/policies";
import { env } from "@/lib/env";
import { listEntries } from "@/server/repositories/audit-log-repository";
import {
  countAdminProductActivity,
  getAdminCatalogSnapshot,
  listRecentlyUpdatedProductsForDashboard,
  type AdminCatalogSnapshot,
  type AdminProductActivityProgress,
  type AdminRecentProduct,
} from "@/server/repositories/admin-dashboard-repository";
import { listFeatureFlags } from "@/server/repositories/feature-flag-repository";
import { listOrdersForAdmin } from "@/server/repositories/order-admin-repository";
import { getPaymentIntegrationEventStats } from "@/server/repositories/payment-event-repository";
import { getShipmentIntegrationEventStats } from "@/server/repositories/shipment-event-repository";
import type { AuditLogRecord } from "@/types/audit-log";
import type { FeatureFlagRecord } from "@/types/feature-flag";
import type { OrderRecord } from "@/types/order";

export type AdminDashboardData = Readonly<{
  catalog: AdminCatalogSnapshot;
  recentOrders: OrderRecord[];
  recentProducts: AdminRecentProduct[];
  recentActivity: AuditLogRecord[];
  featureFlags: FeatureFlagRecord[];
  operations: {
    paymentFailureCount24h: number;
    shipmentFailureCount24h: number;
    outOfStockPublished: number;
  };
  systemHealth: {
    paymobMode: "stub" | "live";
    icarryMode: "stub" | "live";
    emailMode: "stub" | "resend";
    lastPaymentWebhookAt: string | null;
    lastShipmentWebhookAt: string | null;
  };
  progress: AdminProductActivityProgress;
}>;

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  const admin = await requireAdmin();
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const lastHour = new Date(now.getTime() - 60 * 60 * 1000);

  const paymentProvider = env.PAYMOB_MODE === "live" ? "paymob" : "stub";
  const shipmentProvider = env.ICARRY_MODE === "live" ? "icarry" : "stub";

  const [
    catalog,
    recentOrders,
    recentProducts,
    recentActivity,
    featureFlags,
    paymentStats,
    shipmentStats,
    progressToday,
    progressLastHour,
  ] = await Promise.all([
    getAdminCatalogSnapshot(),
    listOrdersForAdmin({ limit: 10 }),
    listRecentlyUpdatedProductsForDashboard(10),
    listEntries(10),
    listFeatureFlags(),
    getPaymentIntegrationEventStats(paymentProvider),
    getShipmentIntegrationEventStats(shipmentProvider),
    countAdminProductActivity(admin.userId, todayStart.toISOString()),
    countAdminProductActivity(admin.userId, lastHour.toISOString()),
  ]);

  return {
    catalog,
    recentOrders,
    recentProducts,
    recentActivity,
    featureFlags,
    operations: {
      paymentFailureCount24h: paymentStats.failureCount24h,
      shipmentFailureCount24h: shipmentStats.failureCount24h,
      outOfStockPublished: catalog.outOfStockPublished,
    },
    systemHealth: {
      paymobMode: env.PAYMOB_MODE,
      icarryMode: env.ICARRY_MODE,
      emailMode: env.EMAIL_PROVIDER,
      lastPaymentWebhookAt: paymentStats.lastSuccessfulWebhookAt,
      lastShipmentWebhookAt: shipmentStats.lastSuccessfulWebhookAt,
    },
    progress: {
      today: progressToday,
      lastHour: progressLastHour,
    },
  };
}
