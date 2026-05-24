"use client";

import { ImageUploadField } from "@/features/admin-products/components/ImageUploadField";
import type { ProductImageRecord, ProductRecord } from "@/types/product";

export function ImageUploader({
  productId,
  isPrimaryDefault,
  onUploaded,
}: Readonly<{
  productId: string;
  isPrimaryDefault?: boolean;
  onUploaded: (result: { ok: true; product: ProductRecord; image: ProductImageRecord }) => void;
}>) {
  return (
    <ImageUploadField
      productId={productId}
      isPrimaryDefault={isPrimaryDefault}
      onUploaded={onUploaded}
    />
  );
}
