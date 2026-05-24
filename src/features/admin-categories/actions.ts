"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/policies";
import { isAppError } from "@/lib/errors";
import { record } from "@/features/audit-log/record";
import {
  CategoryCreateActionSchema,
  CategoryReorderActionSchema,
  CategoryUpdateActionSchema,
  type CategoryCreateActionInput,
  type CategoryPatch,
  type CategoryReorderActionInput,
  type CategoryUpdateActionInput,
} from "@/lib/validation/category";
import {
  createCategory as createCategoryForAdmin,
  findCategoryByIdForAdmin,
  reorderCategoriesForAdmin,
  updateCategory as updateCategoryForAdmin,
  updateCategoryIfFresh,
} from "@/server/repositories/category-repository";
import type { AuditFieldChange } from "@/lib/audit/diff-types";
import type { CategoryRecord } from "@/types/category";

export type AdminCategoryActionResult =
  | {
      ok: true;
      category: CategoryRecord;
    }
  | {
      ok: false;
      code: "not_found" | "stale_data" | "validation_error" | "authorization_error" | "unknown";
      message: string;
      current?: CategoryRecord | null;
    };

export type AdminCategoryReorderResult =
  | {
      ok: true;
      changedCategoryIds: string[];
    }
  | {
      ok: false;
      code: "validation_error" | "authorization_error" | "unknown";
      message: string;
    };

type AdminCategoryActionErrorResult = Extract<AdminCategoryActionResult, { ok: false }>;

export async function updateCategory(
  input: CategoryUpdateActionInput,
): Promise<AdminCategoryActionResult> {
  try {
    const admin = await requireAdmin();
    const parsed = CategoryUpdateActionSchema.parse(input);
    const before = await findCategoryByIdForAdmin(parsed.categoryId);

    if (!before) {
      return {
        ok: false,
        code: "not_found",
        message: "Category not found.",
      };
    }

    const updated = parsed.force
      ? await updateCategoryForAdmin(before.id, normalizePatch(parsed.patch))
      : await updateCategoryIfFresh(before.id, parsed.expectedUpdatedAt, normalizePatch(parsed.patch));

    if (!updated) {
      return {
        ok: false,
        code: "stale_data",
        message: "This category changed after the editor loaded.",
        current: await findCategoryByIdForAdmin(before.id),
      };
    }

    await record({
      actor: { userId: admin.userId, email: admin.email },
      entityId: updated.id,
      diff: {
        version: 1,
        action: "update",
        entity_type: "category",
        category_id: updated.id,
        changes: buildCategoryChanges(before, updated, parsed.patch),
      },
    });

    revalidateCategoryPaths(updated.id);

    return {
      ok: true,
      category: updated,
    };
  } catch (error) {
    return mapCategoryActionError(error);
  }
}

export async function createCategory(
  input: CategoryCreateActionInput,
): Promise<AdminCategoryActionResult> {
  try {
    const admin = await requireAdmin();
    const parsed = CategoryCreateActionSchema.parse(input);
    const category = await createCategoryForAdmin(parsed);

    await record({
      actor: { userId: admin.userId, email: admin.email },
      entityId: category.id,
      diff: {
        version: 1,
        action: "create",
        entity_type: "category",
        category_id: category.id,
        changes: [
          { field: "name", before: null, after: category.name },
          { field: "slug", before: null, after: category.slug },
          { field: "parent_nav", before: null, after: category.parent_nav },
          { field: "parent_id", before: null, after: category.parent_id },
          { field: "is_visible", before: null, after: category.is_visible },
        ],
      },
    });

    revalidateCategoryPaths(category.id);

    return {
      ok: true,
      category,
    };
  } catch (error) {
    return mapCategoryActionError(error);
  }
}

export async function reorderCategories(
  input: CategoryReorderActionInput,
): Promise<AdminCategoryReorderResult> {
  try {
    const admin = await requireAdmin();
    const parsed = CategoryReorderActionSchema.parse(input);
    const changes = await reorderCategoriesForAdmin(parsed.items);

    await record({
      actor: { userId: admin.userId, email: admin.email },
      diff: {
        version: 1,
        action: "update",
        entity_type: "category",
        changes: [
          {
            field: "sort_order_by_category_id",
            before: Object.fromEntries(
              changes.map((change) => [change.category_id, change.before_sort_order]),
            ),
            after: Object.fromEntries(
              changes.map((change) => [change.category_id, change.after_sort_order]),
            ),
          },
          {
            field: "parent_id_by_category_id",
            before: Object.fromEntries(
              changes.map((change) => [change.category_id, change.before_parent_id]),
            ),
            after: Object.fromEntries(
              changes.map((change) => [change.category_id, change.after_parent_id]),
            ),
          },
        ],
      },
    });

    revalidatePath("/admin/categories");
    revalidatePath("/admin/products");

    return {
      ok: true,
      changedCategoryIds: changes.map((change) => change.category_id),
    };
  } catch (error) {
    const mapped = mapCategoryActionError(error);
    return {
      ok: false,
      code:
        mapped.code === "authorization_error" || mapped.code === "validation_error"
          ? mapped.code
          : "unknown",
      message: mapped.message,
    };
  }
}

function normalizePatch(patch: CategoryPatch): CategoryPatch {
  return Object.fromEntries(
    Object.entries(patch).map(([key, value]) => [
      key,
      typeof value === "string" ? value.trim() || null : value,
    ]),
  ) as CategoryPatch;
}

function buildCategoryChanges(
  before: CategoryRecord,
  after: CategoryRecord,
  patch: CategoryPatch,
): AuditFieldChange[] {
  const changes: AuditFieldChange[] = [];

  for (const field of Object.keys(patch) as Array<keyof CategoryPatch>) {
    if (JSON.stringify(before[field]) !== JSON.stringify(after[field])) {
      changes.push({
        field,
        before: before[field] ?? null,
        after: after[field] ?? null,
      });
    }
  }

  return changes;
}

function revalidateCategoryPaths(categoryId: string) {
  revalidatePath("/admin/categories");
  revalidatePath(`/admin/categories/${categoryId}`);
  revalidatePath("/admin/products");
}

function mapCategoryActionError(error: unknown): AdminCategoryActionErrorResult {
  if (isAppError(error)) {
    return {
      ok: false,
      code: error.code === "authorization_error" ? "authorization_error" : "validation_error",
      message: error.message,
    };
  }

  return {
    ok: false,
    code: "unknown",
    message: error instanceof Error ? error.message : "Unknown category action error.",
  };
}
