import { z } from "zod";

export const BrandTierSchema = z.enum(["heavy", "medium", "light"]);

export const AdminBrandPatchSchema = z
  .object({
    display_name: z.string().trim().min(1).max(120).optional(),
    slug: z.string().trim().min(1).max(120).optional(),
    country_of_origin: z.string().trim().max(80).nullable().optional(),
    short_description: z.string().trim().max(240).nullable().optional(),
    long_description: z.string().trim().max(2000).nullable().optional(),
    is_visible_on_directory: z.boolean().optional(),
    is_featured_homepage_brand: z.boolean().optional(),
    brand_tier: BrandTierSchema.nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one brand field must be updated.",
  });

export const AdminBrandUpdateActionSchema = z.object({
  brandId: z.string().uuid(),
  expectedUpdatedAt: z.string().datetime(),
  patch: AdminBrandPatchSchema,
  force: z.boolean().default(false),
});

export const AdminBrandCreateActionSchema = z.object({
  displayName: z.string().trim().min(1).max(120),
  slug: z.string().trim().min(1).max(120).optional(),
  alias: z.string().trim().min(1).max(120).optional(),
});

export const AdminBrandAliasActionSchema = z.object({
  brandId: z.string().uuid(),
  alias: z.string().trim().min(1).max(120),
});

export const AdminBrandImageKindSchema = z.enum(["logo", "hero"]);

export const AdminBrandImageUploadMetadataSchema = z.object({
  brandId: z.string().uuid(),
  kind: AdminBrandImageKindSchema,
});

export type AdminBrandPatch = z.infer<typeof AdminBrandPatchSchema>;
export type AdminBrandUpdateActionInput = z.infer<typeof AdminBrandUpdateActionSchema>;
export type AdminBrandCreateActionInput = z.infer<typeof AdminBrandCreateActionSchema>;
export type AdminBrandAliasActionInput = z.infer<typeof AdminBrandAliasActionSchema>;
export type AdminBrandImageUploadMetadata = z.infer<typeof AdminBrandImageUploadMetadataSchema>;
