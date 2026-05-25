import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getAdminCatalogSnapshot: vi.fn(),
  listRecentlyUpdatedProductsForDashboard: vi.fn(),
  countAdminProductActivity: vi.fn(),
  listEntries: vi.fn(),
  listFeatureFlags: vi.fn(),
  listOrdersForAdmin: vi.fn(),
  getPaymentIntegrationEventStats: vi.fn(),
  getShipmentIntegrationEventStats: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  env: {
    PAYMOB_MODE: "stub",
    ICARRY_MODE: "stub",
    EMAIL_PROVIDER: "stub",
  },
}));

vi.mock("@/lib/auth/policies", () => ({
  requireAdmin: mocks.requireAdmin,
}));

vi.mock("@/server/repositories/admin-dashboard-repository", () => ({
  getAdminCatalogSnapshot: mocks.getAdminCatalogSnapshot,
  listRecentlyUpdatedProductsForDashboard: mocks.listRecentlyUpdatedProductsForDashboard,
  countAdminProductActivity: mocks.countAdminProductActivity,
}));

vi.mock("@/server/repositories/audit-log-repository", () => ({
  listEntries: mocks.listEntries,
}));

vi.mock("@/server/repositories/feature-flag-repository", () => ({
  listFeatureFlags: mocks.listFeatureFlags,
}));

vi.mock("@/server/repositories/order-admin-repository", () => ({
  listOrdersForAdmin: mocks.listOrdersForAdmin,
}));

vi.mock("@/server/repositories/payment-event-repository", () => ({
  getPaymentIntegrationEventStats: mocks.getPaymentIntegrationEventStats,
}));

vi.mock("@/server/repositories/shipment-event-repository", () => ({
  getShipmentIntegrationEventStats: mocks.getShipmentIntegrationEventStats,
}));

describe("admin dashboard query", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({
      userId: "00000000-0000-4000-8000-000000000100",
      email: "admin@example.test",
      role: "admin",
    });
    mocks.getAdminCatalogSnapshot.mockResolvedValue({
      totalProducts: 787,
      publishedProducts: 12,
      missingPrice: 369,
      missingImage: 700,
      missingStockQuantity: 787,
      outOfStock: 3,
      lowStock: 7,
      readyToPublish: 4,
      averageCompletionScore: 32,
      outOfStockPublished: 2,
    });
    mocks.listRecentlyUpdatedProductsForDashboard.mockResolvedValue([]);
    mocks.countAdminProductActivity.mockResolvedValueOnce(8).mockResolvedValueOnce(2);
    mocks.listEntries.mockResolvedValue([]);
    mocks.listFeatureFlags.mockResolvedValue([
      {
        key: "maintenance_mode",
        enabled: false,
        description: null,
        category: "operational",
        updated_at: "2026-05-25T09:00:00.000Z",
        updated_by: null,
      },
    ]);
    mocks.listOrdersForAdmin.mockResolvedValue([]);
    mocks.getPaymentIntegrationEventStats.mockResolvedValue({
      lastSuccessfulWebhookAt: null,
      failureCount24h: 1,
    });
    mocks.getShipmentIntegrationEventStats.mockResolvedValue({
      lastSuccessfulWebhookAt: "2026-05-25T08:30:00.000Z",
      failureCount24h: 0,
    });
  });

  it("requires admin and composes catalog, ops, flags, and current-admin progress", async () => {
    const { getAdminDashboardData } = await import("@/features/admin-dashboard/queries");
    const data = await getAdminDashboardData();

    expect(mocks.requireAdmin).toHaveBeenCalledTimes(1);
    expect(mocks.getPaymentIntegrationEventStats).toHaveBeenCalledWith("stub");
    expect(mocks.getShipmentIntegrationEventStats).toHaveBeenCalledWith("stub");
    expect(mocks.countAdminProductActivity).toHaveBeenCalledTimes(2);
    expect(data).toMatchObject({
      catalog: { totalProducts: 787, outOfStockPublished: 2 },
      operations: {
        paymentFailureCount24h: 1,
        shipmentFailureCount24h: 0,
        outOfStockPublished: 2,
      },
      systemHealth: {
        paymobMode: "stub",
        icarryMode: "stub",
        emailMode: "stub",
      },
      progress: {
        today: 8,
        lastHour: 2,
      },
    });
  });
});
