import "server-only";

import { createHash } from "node:crypto";
import { generateSlug } from "@/lib/slug";
import type { ProductImageKind } from "@/types/product";

export const PRODUCT_IMAGE_BUCKET = "product-images";
export const MAX_PRODUCT_IMAGE_BYTES = 10 * 1024 * 1024;
export const PRODUCT_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type ProductImageMimeType = (typeof PRODUCT_IMAGE_MIME_TYPES)[number];

export type PreparedProductImageUpload = Readonly<{
  bytes: Buffer;
  contentType: ProductImageMimeType;
  extension: "jpg" | "png" | "webp";
  originalName: string;
  size: number;
  storagePath: string;
}>;

export async function prepareProductImageUpload({
  file,
  brandSlug,
  productSlug,
  kind,
}: Readonly<{
  file: File;
  brandSlug: string | null;
  productSlug: string;
  kind: ProductImageKind;
}>): Promise<PreparedProductImageUpload> {
  const contentType = validateProductImageFile(file);
  const bytes = Buffer.from(await file.arrayBuffer());
  const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
  const extension = extensionForContentType(contentType);
  const safeBrandSlug = generateSlug(brandSlug ?? "unbranded") || "unbranded";
  const safeProductSlug = generateSlug(productSlug) || "product";

  return {
    bytes,
    contentType,
    extension,
    originalName: file.name,
    size: file.size,
    storagePath: `products/${safeBrandSlug}/${safeProductSlug}/${kind}-${hash}.${extension}`,
  };
}

export function validateProductImageFile(file: File): ProductImageMimeType {
  if (file.size <= 0) {
    throw new Error("Image file is empty.");
  }

  if (file.size > MAX_PRODUCT_IMAGE_BYTES) {
    throw new Error("Image file must be 10 MB or smaller.");
  }

  if (!PRODUCT_IMAGE_MIME_TYPES.includes(file.type as ProductImageMimeType)) {
    throw new Error("Image must be a JPEG, PNG, or WebP file.");
  }

  return file.type as ProductImageMimeType;
}

function extensionForContentType(contentType: ProductImageMimeType): PreparedProductImageUpload["extension"] {
  switch (contentType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
  }
}
