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

export const ProductFieldStatusUpdateSchema = z.object({
  product_id: z.string().uuid(),
  field: ProductFieldStatusKeySchema,
  status: FieldStatusSchema,
});

export type ProductCreateInput = z.infer<typeof ProductCreateInputSchema>;
export type ProductUpdateInput = z.infer<typeof ProductUpdateInputSchema>;
export type ProductFieldStatusUpdate = z.infer<typeof ProductFieldStatusUpdateSchema>;
