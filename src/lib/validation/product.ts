import { z } from "zod";

export const ProductStatusSchema = z.enum([
  "imported",
  "draft",
  "partial",
  "ready_to_publish",
  "published",
  "hidden",
  "archived",
]);

export const FieldStatusSchema = z.enum([
  "complete",
  "verified",
  "draft",
  "missing",
  "needs_review",
  "not_applicable",
]);

export const ProductFieldStatusKeySchema = z.enum([
  "name",
  "brand",
  "category",
  "form",
  "retail_price",
  "description",
  "benefits",
  "image",
  "nutrition_panel",
  "ingredients",
  "allergens",
  "directions",
  "warnings",
  "storage",
  "seo_title",
  "seo_description",
  "often_bought_with",
]);

export const ProductFieldsStatusSchema = z.record(ProductFieldStatusKeySchema, FieldStatusSchema);

export const ProductCreateInputSchema = z.object({
  name: z.string().trim().min(1),
  name_raw: z.string().trim().min(1),
  slug: z.string().trim().min(1).max(100),
  brand_id: z.string().uuid().nullable().optional(),
  brand_raw: z.string().trim().min(1).nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
  source_category: z.string().trim().min(1).nullable().optional(),
  form: z
    .enum(["powder", "capsules", "tablets", "softgels", "bars", "gummies", "liquid", "rtd", "food"])
    .nullable()
    .optional(),
  source_file: z.string().trim().min(1).default("product.md"),
  source_row: z.array(z.number().int().positive()).default([]),
  source_notes: z.string().nullable().optional(),
  retail_price_aed: z.number().int().positive().nullable().optional(),
  compare_at_price_aed: z.number().int().positive().nullable().optional(),
  status: ProductStatusSchema.default("imported"),
  fields_status: ProductFieldsStatusSchema,
});

export const ProductUpdateInputSchema = ProductCreateInputSchema.partial().extend({
  id: z.string().uuid(),
});

export const AdminProductReviewFlagSchema = z.enum([
  "missing_price",
  "missing_image",
  "missing_stock_quantity",
  "case_pack",
  "duplicate_suspected",
  "multiple_price_pairs",
  "needs_category_review",
  "needs_brand_review",
  "needs_label_data",
]);

export const AdminProductSortSchema = z.enum([
  "newest_imported",
  "lowest_completion",
  "recently_updated",
  "alphabetical",
]);

export const AdminProductListFiltersSchema = z.object({
  status: ProductStatusSchema.or(z.literal("all")).optional(),
  reviewFlags: z.array(AdminProductReviewFlagSchema).default([]),
  stockStatus: z.enum(["all", "in_stock", "low_stock", "out_of_stock"]).default("all"),
  brandId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  search: z.string().trim().max(120).optional(),
  completionMin: z.number().int().min(0).max(100).optional(),
  completionMax: z.number().int().min(0).max(100).optional(),
});

export const AdminProductListInputSchema = z.object({
  filters: AdminProductListFiltersSchema.default({}),
  sort: AdminProductSortSchema.default("recently_updated"),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(10).max(100).default(50),
});

const NullableUuidSchema = z.string().uuid().nullable();

export const AdminProductInlinePatchSchema = z
  .object({
    retail_price_aed: z.number().int().positive().nullable().optional(),
    brand_id: NullableUuidSchema.optional(),
    category_id: NullableUuidSchema.optional(),
    status: ProductStatusSchema.optional(),
    is_public_visible: z.boolean().optional(),
    admin_review_flags: z.record(AdminProductReviewFlagSchema, z.boolean()).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one product field must be updated.",
  });

export const AdminProductUpdateActionSchema = z.object({
  productId: z.string().uuid(),
  expectedUpdatedAt: z.string().datetime(),
  patch: AdminProductInlinePatchSchema,
  force: z.boolean().default(false),
});

export const AdminProductBatchUpdateActionSchema = z.object({
  updates: z.array(AdminProductUpdateActionSchema).min(1).max(100),
});

export const ProductFieldStatusUpdateSchema = z.object({
  product_id: z.string().uuid(),
  field: ProductFieldStatusKeySchema,
  status: FieldStatusSchema,
});

export type ProductCreateInput = z.infer<typeof ProductCreateInputSchema>;
export type ProductUpdateInput = z.infer<typeof ProductUpdateInputSchema>;
export type ProductFieldStatusUpdate = z.infer<typeof ProductFieldStatusUpdateSchema>;
export type AdminProductListInput = z.infer<typeof AdminProductListInputSchema>;
export type AdminProductInlinePatch = z.infer<typeof AdminProductInlinePatchSchema>;
export type AdminProductUpdateActionInput = z.infer<typeof AdminProductUpdateActionSchema>;
export type AdminProductBatchUpdateActionInput = z.infer<
  typeof AdminProductBatchUpdateActionSchema
>;
