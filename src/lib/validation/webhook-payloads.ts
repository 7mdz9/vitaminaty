import { z } from "zod";

// TODO(M5): Replace with Paymob webhook payload schemas after live API docs verification.
export const PaymobWebhookEventSchema = z.object({}).passthrough();

// TODO(M6): Replace with iCarry webhook payload schemas after live API docs verification.
export const ICarryWebhookEventSchema = z.object({}).passthrough();

export type PaymobWebhookEvent = z.infer<typeof PaymobWebhookEventSchema>;
export type ICarryWebhookEvent = z.infer<typeof ICarryWebhookEventSchema>;
