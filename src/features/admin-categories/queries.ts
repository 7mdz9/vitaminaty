import "server-only";

import { requireAdmin } from "@/lib/auth/policies";
import {
  findCategoryByIdForAdmin,
  listCategoryListItemsForAdmin,
  type AdminCategoryListItem,
} from "@/server/repositories/category-repository";
import type { CategoryRecord } from "@/types/category";

export async function getCategoryList(): Promise<AdminCategoryListItem[]> {
  await requireAdmin();
  return listCategoryListItemsForAdmin();
}

export async function getCategory(categoryId: string): Promise<CategoryRecord | null> {
  await requireAdmin();
  return findCategoryByIdForAdmin(categoryId);
}
