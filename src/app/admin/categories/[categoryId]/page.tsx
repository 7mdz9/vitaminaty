import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CategoryEditorForm } from "@/features/admin-categories/components/CategoryEditorForm";
import { getCategory, getCategoryList } from "@/features/admin-categories/queries";

export const dynamic = "force-dynamic";

export default async function AdminCategoryEditorPage({
  params,
}: Readonly<{
  params: Promise<{ categoryId: string }>;
}>) {
  const { categoryId } = await params;
  const categories = await getCategoryList();
  const category = categoryId === "new" ? null : await getCategory(categoryId);

  if (categoryId !== "new" && !category) {
    notFound();
  }

  return (
    <div className="space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button render={<Link href="/admin/categories" />} size="icon" variant="ghost">
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h2 className="font-admin-display text-xl text-admin-text">
              {category?.name ?? "New category"}
            </h2>
            <p className="text-admin-sm text-admin-text-muted">
              {category?.slug ?? "Create a category"}
            </p>
          </div>
        </div>
      </header>
      <CategoryEditorForm category={category} categories={categories} />
    </div>
  );
}
