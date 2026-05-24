import { notFound } from "next/navigation";
import { ProductEditor } from "@/features/admin-products/components/ProductEditor";
import { getProductEditor } from "@/features/admin-products/queries";

export const dynamic = "force-dynamic";

export default async function AdminProductEditorPage({
  params,
}: Readonly<{
  params: Promise<{ productId: string }>;
}>) {
  const { productId } = await params;
  const { editor, brands, categories } = await getProductEditor(productId);

  if (!editor) {
    notFound();
  }

  return (
    <ProductEditor
      brands={brands}
      categories={categories}
      goalTags={editor.goalTags}
      images={editor.images}
      product={editor.product}
      variants={editor.variants}
    />
  );
}
