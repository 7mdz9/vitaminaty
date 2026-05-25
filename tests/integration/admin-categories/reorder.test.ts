import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CategoryRecord } from "@/types/category";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  createCategory: vi.fn(),
  findCategoryByIdForAdmin: vi.fn(),
  reorderCategoriesForAdmin: vi.fn(),
  updateCategory: vi.fn(),
  updateCategoryIfFresh: vi.fn(),
  record: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/policies", () => ({
  requireAdmin: mocks.requireAdmin,
}));

vi.mock("@/server/repositories/category-repository", () => ({
  createCategory: mocks.createCategory,
  findCategoryByIdForAdmin: mocks.findCategoryByIdForAdmin,
  reorderCategoriesForAdmin: mocks.reorderCategoriesForAdmin,
  updateCategory: mocks.updateCategory,
  updateCategoryIfFresh: mocks.updateCategoryIfFresh,
}));

vi.mock("@/features/audit-log/record", () => ({
  record: mocks.record,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

describe("admin category actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({
      userId: "00000000-0000-4000-8000-000000000100",
      email: "admin@example.test",
      role: "admin",
    });
  });

  it("updates a category with optimistic concurrency and writes audit", async () => {
    const before = categoryFactory({ listing_copy: "Old copy" });
    const after = categoryFactory({ listing_copy: "New copy" });
    mocks.findCategoryByIdForAdmin.mockResolvedValueOnce(before);
    mocks.updateCategoryIfFresh.mockResolvedValueOnce(after);

    const { updateCategory } = await import("@/features/admin-categories/actions");
    const result = await updateCategory({
      categoryId: before.id,
      expectedUpdatedAt: before.updated_at,
      force: false,
      patch: { listing_copy: "New copy" },
    });

    expect(result).toMatchObject({ ok: true, category: { listing_copy: "New copy" } });
    expect(mocks.record).toHaveBeenCalledWith(
      expect.objectContaining({
        diff: expect.objectContaining({
          action: "update",
          entity_type: "category",
          category_id: before.id,
          changes: [{ field: "listing_copy", before: "Old copy", after: "New copy" }],
        }),
      }),
    );
  });

  it("returns stale_data without auditing when expected_updated_at misses", async () => {
    const before = categoryFactory({ updated_at: "2026-05-24T14:00:00.000Z" });
    const current = categoryFactory({ updated_at: "2026-05-24T14:05:00.000Z" });
    mocks.findCategoryByIdForAdmin.mockResolvedValueOnce(before).mockResolvedValueOnce(current);
    mocks.updateCategoryIfFresh.mockResolvedValueOnce(null);

    const { updateCategory } = await import("@/features/admin-categories/actions");
    const result = await updateCategory({
      categoryId: before.id,
      expectedUpdatedAt: before.updated_at,
      force: false,
      patch: { name: "Updated" },
    });

    expect(result).toMatchObject({
      ok: false,
      error: "stale_data",
      current: { updated_at: current.updated_at },
    });
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it("reorders categories through one repository contract and writes one audit row", async () => {
    const firstId = "00000000-0000-4000-8000-000000000001";
    const secondId = "00000000-0000-4000-8000-000000000002";
    mocks.reorderCategoriesForAdmin.mockResolvedValueOnce([
      {
        category_id: firstId,
        before_parent_id: null,
        after_parent_id: null,
        before_sort_order: 10,
        after_sort_order: 20,
      },
      {
        category_id: secondId,
        before_parent_id: null,
        after_parent_id: firstId,
        before_sort_order: 20,
        after_sort_order: 10,
      },
    ]);

    const { reorderCategories } = await import("@/features/admin-categories/actions");
    const result = await reorderCategories({
      items: [
        { categoryId: firstId, parentId: null, sortOrder: 20 },
        { categoryId: secondId, parentId: firstId, sortOrder: 10 },
      ],
    });

    expect(result).toMatchObject({
      ok: true,
      changedCategoryIds: [firstId, secondId],
    });
    expect(mocks.record).toHaveBeenCalledTimes(1);
    expect(mocks.record).toHaveBeenCalledWith(
      expect.objectContaining({
        diff: expect.objectContaining({
          action: "update",
          entity_type: "category",
          changes: expect.arrayContaining([
            expect.objectContaining({ field: "sort_order_by_category_id" }),
            expect.objectContaining({ field: "parent_id_by_category_id" }),
          ]),
        }),
      }),
    );
  });
});

function categoryFactory(overrides: Partial<CategoryRecord> = {}): CategoryRecord {
  return {
    id: "00000000-0000-4000-8000-000000000010",
    name: "Proteins",
    slug: "proteins",
    parent_nav: "Sport Nutrition",
    parent_id: null,
    subcategories: [],
    supported_goals: [],
    listing_copy: null,
    seo_title: null,
    seo_description: null,
    is_visible: true,
    sort_order: 10,
    created_at: "2026-05-24T14:00:00.000Z",
    updated_at: "2026-05-24T14:00:00.000Z",
    ...overrides,
  };
}
