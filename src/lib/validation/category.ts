import { z } from "zod";

export const ParentNavSchema = z.enum([
  "Sport Nutrition",
  "Health & Wellness",
  "Snacks & Drinks",
]);

export const CategoryPatchSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    slug: z.string().trim().min(1).max(120).optional(),
    parent_nav: ParentNavSchema.optional(),
    parent_id: z.string().uuid().nullable().optional(),
    subcategories: z.array(z.string().trim().min(1).max(80)).max(40).optional(),
    listing_copy: z.string().trim().max(2000).nullable().optional(),
    seo_title: z.string().trim().max(80).nullable().optional(),
    seo_description: z.string().trim().max(180).nullable().optional(),
    is_visible: z.boolean().optional(),
    sort_order: z.number().int().min(0).max(10000).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one category field must be updated.",
  });

export const CategoryUpdateActionSchema = z.object({
  categoryId: z.string().uuid(),
  expectedUpdatedAt: z.string().datetime(),
  patch: CategoryPatchSchema,
  force: z.boolean().default(false),
});

export const CategoryCreateActionSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().min(1).max(120),
  parent_nav: ParentNavSchema,
  parent_id: z.string().uuid().nullable().default(null),
  is_visible: z.boolean().default(true),
});

export const CategoryReorderItemSchema = z.object({
  categoryId: z.string().uuid(),
  parentId: z.string().uuid().nullable(),
  sortOrder: z.number().int().min(0).max(10000),
});

export const CategoryReorderActionSchema = z.object({
  items: z.array(CategoryReorderItemSchema).min(1).max(200),
});

export type CategoryPatch = z.infer<typeof CategoryPatchSchema>;
export type CategoryUpdateActionInput = z.infer<typeof CategoryUpdateActionSchema>;
export type CategoryCreateActionInput = z.infer<typeof CategoryCreateActionSchema>;
export type CategoryReorderActionInput = z.infer<typeof CategoryReorderActionSchema>;
