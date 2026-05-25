import "server-only";

import { requireAdmin } from "@/lib/auth/policies";
import {
  getHomepageConfigForAdmin,
  listHomepageBrandOptionsForAdmin,
  listHomepageBrandsByIdsForAdmin,
  listHomepageProductOptionsForAdmin,
  listHomepageProductsByIdsForAdmin,
} from "@/server/repositories/homepage-config-admin-repository";
import { listGoals } from "@/server/repositories/goal-repository";
import type { GoalRecord } from "@/types/category";
import type {
  HomepageConfigRecord,
  HomepageCurationBrand,
  HomepageCurationProduct,
} from "@/types/homepage";

export type HomepageCurationData = Readonly<{
  config: HomepageConfigRecord;
  products: HomepageCurationProduct[];
  brands: HomepageCurationBrand[];
  selectedNewArrivals: HomepageCurationProduct[];
  selectedBestsellers: HomepageCurationProduct[];
  selectedBrands: HomepageCurationBrand[];
  goals: GoalRecord[];
}>;

export async function getHomepageCurationData(): Promise<HomepageCurationData> {
  await requireAdmin();

  const config = await getHomepageConfigForAdmin();
  const [products, brands, selectedNewArrivals, selectedBestsellers, selectedBrands, goals] =
    await Promise.all([
      listHomepageProductOptionsForAdmin(),
      listHomepageBrandOptionsForAdmin(),
      listHomepageProductsByIdsForAdmin(config.new_arrival_product_ids),
      listHomepageProductsByIdsForAdmin(config.bestseller_product_ids),
      listHomepageBrandsByIdsForAdmin(config.featured_brand_ids),
      listGoals(),
    ]);

  return {
    config,
    products: mergeProducts(products, selectedNewArrivals, selectedBestsellers),
    brands: mergeBrands(brands, selectedBrands),
    selectedNewArrivals,
    selectedBestsellers,
    selectedBrands,
    goals,
  };
}

function mergeProducts(
  products: HomepageCurationProduct[],
  ...selectedGroups: HomepageCurationProduct[][]
): HomepageCurationProduct[] {
  const map = new Map(products.map((product) => [product.id, product]));

  for (const selected of selectedGroups.flat()) {
    map.set(selected.id, selected);
  }

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function mergeBrands(
  brands: HomepageCurationBrand[],
  selected: HomepageCurationBrand[],
): HomepageCurationBrand[] {
  const map = new Map(brands.map((brand) => [brand.id, brand]));

  for (const brand of selected) {
    map.set(brand.id, brand);
  }

  return Array.from(map.values()).sort((a, b) => a.displayName.localeCompare(b.displayName));
}
