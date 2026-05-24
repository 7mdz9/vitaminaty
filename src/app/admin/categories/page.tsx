import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CategoryTree } from "@/features/admin-categories/components/CategoryTree";
import { getCategoryList } from "@/features/admin-categories/queries";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  const categories = await getCategoryList();

  return (
    <div className="space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-admin-display text-xl text-admin-text">Categories</h2>
          <p className="text-admin-sm text-admin-text-muted">
            {categories.length} categories · {categories.filter((category) => category.is_visible).length} visible
          </p>
        </div>
        <Button render={<Link href="/admin/categories/new" />} size="sm">
          <Plus className="size-4" />
          New category
        </Button>
      </header>
      <CategoryTree categories={categories} />
    </div>
  );
}
