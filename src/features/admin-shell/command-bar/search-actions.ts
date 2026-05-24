"use server";

import { requireAdmin } from "@/lib/auth/policies";
import {
  listAllProductsForAdmin,
  listBrandOptionsForAdmin,
  listCategoryOptionsForAdmin,
} from "@/server/repositories/product-admin-repository";

export type AdminCommandItem = Readonly<{
  id: string;
  kind: "product" | "brand" | "category" | "queue" | "route";
  label: string;
  description: string;
  href: string;
}>;

const queueItems: AdminCommandItem[] = [
  command("queue:missing-price", "queue", "Missing price", "Product queue", "/admin/queues/missing-price"),
  command("queue:missing-image", "queue", "Missing image", "Product queue", "/admin/queues/missing-image"),
  command(
    "queue:missing-stock-quantity",
    "queue",
    "Missing stock quantity",
    "Product queue",
    "/admin/queues/missing-stock-quantity",
  ),
  command(
    "queue:needs-brand-review",
    "queue",
    "Needs brand review",
    "Product queue",
    "/admin/queues/needs-brand-review",
  ),
  command(
    "queue:needs-category-review",
    "queue",
    "Needs category review",
    "Product queue",
    "/admin/queues/needs-category-review",
  ),
  command("queue:needs-label-data", "queue", "Needs label data", "Product queue", "/admin/queues/needs-label-data"),
  command("queue:ready-to-publish", "queue", "Ready to publish", "Product queue", "/admin/queues/ready-to-publish"),
  command("queue:out-of-stock", "queue", "Out of stock", "Product queue", "/admin/queues/out-of-stock"),
  command("queue:low-stock", "queue", "Low stock", "Product queue", "/admin/queues/low-stock"),
];

const routeItems: AdminCommandItem[] = [
  command("route:dashboard", "route", "Dashboard", "Admin route", "/admin"),
  command("route:products", "route", "Products", "Admin route", "/admin/products"),
  command("route:brands", "route", "Brands", "Admin route", "/admin/brands"),
  command("route:categories", "route", "Categories", "Admin route", "/admin/categories"),
  command("route:audit-log", "route", "Audit log", "Admin route", "/admin/audit-log"),
];

export async function getAdminCommandItems(): Promise<{
  items: AdminCommandItem[];
  totalCount: number;
  decision: "client";
}> {
  await requireAdmin();
  const [products, brands, categories] = await Promise.all([
    listAllProductsForAdmin(),
    listBrandOptionsForAdmin(),
    listCategoryOptionsForAdmin(),
  ]);
  const items = [
    ...routeItems,
    ...queueItems,
    ...products.map((product) =>
      command(`product:${product.id}`, "product", product.name, product.slug, `/admin/products/${product.id}`),
    ),
    ...brands.map((brand) => command(`brand:${brand.id}`, "brand", brand.label, brand.slug, `/admin/brands/${brand.id}`)),
    ...categories.map((category) =>
      command(`category:${category.id}`, "category", category.label, category.slug, "/admin/categories"),
    ),
  ];

  return {
    items,
    totalCount: items.length,
    decision: "client",
  };
}

function command(
  id: string,
  kind: AdminCommandItem["kind"],
  label: string,
  description: string,
  href: string,
): AdminCommandItem {
  return { id, kind, label, description, href };
}
