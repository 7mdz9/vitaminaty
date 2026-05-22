import { z } from "zod";
import { UaeAddressSchema } from "@/lib/validation/address";

export const OrderStatusSchema = z.enum([
  "pending_payment",
  "paid",
  "preparing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
  "failed",
]);

export const OrderCreateInputSchema = z.object({
  customer_id: z.string().uuid().nullable().optional(),
  ship_to: UaeAddressSchema,
  items: z
    .array(
      z.object({
        product_id: z.string().uuid(),
        variant_id: z.string().uuid().optional(),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1),
  payment_method: z.enum(["cards", "apple_pay", "tabby", "tamara", "cod"]),
  shipping_method: z.enum(["standard", "express", "same_day"]),
  idempotency_key: z.string().trim().min(1),
});

export const OrderStatusTransitionSchema = z.object({
  order_id: z.string().uuid(),
  from: OrderStatusSchema,
  to: OrderStatusSchema,
  reason: z.string().trim().min(1).optional(),
});

export type OrderCreateInput = z.infer<typeof OrderCreateInputSchema>;
export type OrderStatusTransition = z.infer<typeof OrderStatusTransitionSchema>;
