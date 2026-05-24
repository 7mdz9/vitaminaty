import { z } from "zod";
import { OrderStatusSchema } from "@/lib/validation/order";

export const AdminOrderListSearchParamsSchema = z.object({
  status: OrderStatusSchema.optional(),
  payment_method: z.enum(["card", "apple_pay", "tabby", "tamara", "cod"]).optional(),
  customer: z.string().trim().optional(),
  q: z.string().trim().optional(),
  date_from: z.string().trim().optional(),
  date_to: z.string().trim().optional(),
});

export const AdminOrderStatusTransitionActionSchema = z.object({
  orderId: z.string().uuid(),
  expectedUpdatedAt: z.string().min(1),
  toStatus: OrderStatusSchema,
  reason: z.string().trim().min(1).max(500),
  trackingNumber: z.string().trim().max(120).optional().nullable(),
  trackingUrl: z.string().trim().url().max(500).optional().nullable(),
  notifyCustomer: z.boolean().default(true),
});

export const AdminOrderRefundActionSchema = z.object({
  orderId: z.string().uuid(),
  expectedUpdatedAt: z.string().min(1),
  refundKind: z.enum(["full", "partial"]),
  amountAed: z.number().int().positive(),
  reason: z.string().trim().min(1).max(500),
  notifyCustomer: z.boolean().default(true),
});

export type AdminOrderListSearchParams = z.input<typeof AdminOrderListSearchParamsSchema>;
export type AdminOrderStatusTransitionActionInput = z.input<
  typeof AdminOrderStatusTransitionActionSchema
>;
export type AdminOrderRefundActionInput = z.input<typeof AdminOrderRefundActionSchema>;
