import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findProductEditorDataForAdmin: vi.fn(),
  listBrandOptionsForAdmin: vi.fn(),
  listCategoryOptionsForAdmin: vi.fn(),
}));

vi.mock("@/lib/auth/policies", () => ({
  requireAdmin: mocks.requireAdmin,
}));

vi.mock("@/server/repositories/product-admin-repository", () => ({
  findProductEditorDataForAdmin: mocks.findProductEditorDataForAdmin,
  listBrandOptionsForAdmin: mocks.listBrandOptionsForAdmin,
  listCategoryOptionsForAdmin: mocks.listCategoryOptionsForAdmin,
}));

describe("admin product editor query", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({
      userId: "00000000-0000-4000-8000-000000000100",
      email: "admin@example.test",
      role: "admin",
    });
    mocks.listBrandOptionsForAdmin.mockResolvedValue([
      { id: "brand-id", label: "Brand", slug: "brand" },
    ]);
    mocks.listCategoryOptionsForAdmin.mockResolvedValue([
      { id: "category-id", label: "Category", slug: "category" },
    ]);
  });

  it("requires admin and returns editor data plus reference options", async () => {
    mocks.findProductEditorDataForAdmin.mockResolvedValue({
      product: { id: "product-id" },
      variants: [],
      images: [],
      goalTags: [],
    });

    const { getProductEditor } = await import("@/features/admin-products/queries");
    const result = await getProductEditor("product-id");

    expect(mocks.requireAdmin).toHaveBeenCalledTimes(1);
    expect(mocks.findProductEditorDataForAdmin).toHaveBeenCalledWith("product-id");
    expect(result).toMatchObject({
      editor: { product: { id: "product-id" } },
      brands: [{ id: "brand-id" }],
      categories: [{ id: "category-id" }],
    });
  });

  it("keeps null editor result for the route to convert into notFound", async () => {
    mocks.findProductEditorDataForAdmin.mockResolvedValue(null);

    const { getProductEditor } = await import("@/features/admin-products/queries");
    const result = await getProductEditor("missing-product-id");

    expect(result.editor).toBeNull();
  });
});
