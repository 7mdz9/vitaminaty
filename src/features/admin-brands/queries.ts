import "server-only";

import { requireAdmin } from "@/lib/auth/policies";
import {
  findBrandByIdForAdmin,
  listBrandListItemsForAdmin,
  listOrphanCanonicalBrandsForAdmin,
  listUnmatchedBrandRawsForAdmin,
  type AdminBrandListItem,
  type AdminUnmatchedBrandRaw,
} from "@/server/repositories/brand-admin-repository";
import type { BrandRecord } from "@/types/brand";

export async function getBrandList(): Promise<AdminBrandListItem[]> {
  await requireAdmin();
  return listBrandListItemsForAdmin();
}

export async function getBrand(brandId: string): Promise<BrandRecord | null> {
  await requireAdmin();
  return findBrandByIdForAdmin(brandId);
}

export async function getUnmatchedBrandRaws(): Promise<AdminUnmatchedBrandRaw[]> {
  await requireAdmin();
  return listUnmatchedBrandRawsForAdmin();
}

export async function getOrphanCanonicalBrands(): Promise<BrandRecord[]> {
  await requireAdmin();
  return listOrphanCanonicalBrandsForAdmin();
}
