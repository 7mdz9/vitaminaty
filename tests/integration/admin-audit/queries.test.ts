import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  listEntriesForAdmin: vi.fn(),
}));

vi.mock("@/lib/auth/policies", () => ({
  requireAdmin: mocks.requireAdmin,
}));

vi.mock("@/server/repositories/audit-log-repository", () => ({
  listEntriesForAdmin: mocks.listEntriesForAdmin,
}));

describe("admin audit queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({
      userId: "00000000-0000-4000-8000-000000000100",
      email: "admin@example.test",
      role: "admin",
    });
    mocks.listEntriesForAdmin.mockResolvedValue({
      entries: [],
      total: 0,
      page: 2,
      pageSize: 50,
      pageCount: 1,
    });
  });

  it("parses URL filters into repository filters and requires admin", async () => {
    const { getAuditLogList, parseAuditLogSearchParams } = await import(
      "@/features/admin-audit/queries"
    );
    const parsed = parseAuditLogSearchParams({
      actor: "admin@example.test",
      action: "order_status_change",
      entity_type: "order",
      entity_id: "00000000-0000-4000-8000-000000000010",
      date_from: "2026-05-24",
      date_to: "2026-05-25",
      page: 2,
    });

    await getAuditLogList(parsed);

    expect(mocks.requireAdmin).toHaveBeenCalledTimes(1);
    expect(mocks.listEntriesForAdmin).toHaveBeenCalledWith({
      actor: "admin@example.test",
      action: "order_status_change",
      entityType: "order",
      entityId: "00000000-0000-4000-8000-000000000010",
      dateFrom: "2026-05-24T00:00:00.000Z",
      dateTo: "2026-05-25T23:59:59.999Z",
      page: 2,
      pageSize: 50,
    });
  });
});
