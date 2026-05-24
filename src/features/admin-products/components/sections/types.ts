import type { AdminProductReferenceOption } from "@/server/repositories/product-admin-repository";
import type {
  ProductGoalTagRecord,
  ProductImageRecord,
  ProductRecord,
  ProductVariantRecord,
} from "@/types/product";
import type { AdminProductInlinePatch } from "@/lib/validation/product";

export type ProductEditorSectionProps = Readonly<{
  product: ProductRecord;
  variants: ProductVariantRecord[];
  images: ProductImageRecord[];
  goalTags: ProductGoalTagRecord[];
  brands: AdminProductReferenceOption[];
  categories: AdminProductReferenceOption[];
  onSave: (patch: AdminProductInlinePatch) => void | Promise<void>;
  saving: boolean;
}>;
