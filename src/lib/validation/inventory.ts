import { z } from "zod";

export const InventoryMovementReasonSchema = z.enum([
  "manual_adjustment",
  "order_placed",
  "order_cancelled",
  "payment_failed",
  "refund_returned",
  "stock_recount",
  "import_update",
]);

const NoteSchema = z.string().trim().max(500).nullable().optional();

export const SetVariantStockActionSchema = z.object({
  variantId: z.string().uuid(),
  expectedUpdatedAt: z.string().datetime(),
  newQuantity: z.number().int().min(0),
  changeReasonNote: NoteSchema,
  force: z.boolean().default(false),
});

export const AdjustVariantStockActionSchema = z.object({
  variantId: z.string().uuid(),
  expectedUpdatedAt: z.string().datetime(),
  delta: z
    .number()
    .int()
    .min(-100000)
    .max(100000)
    .refine((value) => value !== 0, {
      message: "Delta must not be zero.",
    }),
  changeReasonNote: NoteSchema,
  force: z.boolean().default(false),
});

export const RecountVariantStockActionSchema = z.object({
  variantId: z.string().uuid(),
  expectedUpdatedAt: z.string().datetime(),
  newQuantity: z.number().int().min(0),
  changeAmount: z.number().int().min(-100000).max(100000).optional(),
  changeReasonNote: NoteSchema,
  force: z.boolean().default(false),
});

export const SetVariantLowStockThresholdActionSchema = z.object({
  variantId: z.string().uuid(),
  expectedUpdatedAt: z.string().datetime(),
  lowStockThreshold: z.number().int().min(0).max(100000),
  changeReasonNote: NoteSchema,
  force: z.boolean().default(false),
});

export const BulkAdjustVariantStockActionSchema = z.object({
  adjustments: z
    .array(
      z.object({
        variantId: z.string().uuid(),
        expectedUpdatedAt: z.string().datetime(),
        delta: z
          .number()
          .int()
          .min(-100000)
          .max(100000)
          .refine((value) => value !== 0, {
            message: "Delta must not be zero.",
          }),
      }),
    )
    .min(1)
    .max(200),
  changeReasonNote: NoteSchema,
});

export const GetInventoryHistoryActionSchema = z
  .object({
    productId: z.string().uuid().optional(),
    variantId: z.string().uuid().optional(),
    orderId: z.string().uuid().optional(),
    reason: InventoryMovementReasonSchema.optional(),
    actorUserId: z.string().uuid().optional(),
    start: z.string().datetime().optional(),
    end: z.string().datetime().optional(),
  })
  .refine(
    (value) =>
      Boolean(
        value.productId ||
        value.variantId ||
        value.orderId ||
        value.reason ||
        value.actorUserId ||
        (value.start && value.end),
      ),
    {
      message: "At least one inventory history filter is required.",
    },
  )
  .refine((value) => (!value.start && !value.end) || Boolean(value.start && value.end), {
    message: "Both start and end are required for date-range inventory history.",
  });

export const CreateProductVariantActionSchema = z.object({
  productId: z.string().uuid(),
  flavor: z.string().trim().max(120).nullable().optional(),
  size: z.string().trim().min(1).max(120),
  sku: z.string().trim().max(120).nullable().optional(),
  barcode: z.string().trim().max(120).nullable().optional(),
  priceAed: z.number().int().positive(),
  stockQuantity: z.number().int().min(0),
  lowStockThreshold: z.number().int().min(0).max(100000).default(5),
  weightGrams: z.number().int().positive().nullable().optional(),
});

export const ArchiveProductVariantActionSchema = z.object({
  variantId: z.string().uuid(),
  expectedUpdatedAt: z.string().datetime(),
  changeReasonNote: NoteSchema,
});

export type SetVariantStockActionInput = z.input<typeof SetVariantStockActionSchema>;
export type AdjustVariantStockActionInput = z.input<typeof AdjustVariantStockActionSchema>;
export type RecountVariantStockActionInput = z.input<typeof RecountVariantStockActionSchema>;
export type SetVariantLowStockThresholdActionInput = z.input<
  typeof SetVariantLowStockThresholdActionSchema
>;
export type BulkAdjustVariantStockActionInput = z.input<typeof BulkAdjustVariantStockActionSchema>;
export type GetInventoryHistoryActionInput = z.input<typeof GetInventoryHistoryActionSchema>;
export type CreateProductVariantActionInput = z.input<typeof CreateProductVariantActionSchema>;
export type ArchiveProductVariantActionInput = z.input<typeof ArchiveProductVariantActionSchema>;
