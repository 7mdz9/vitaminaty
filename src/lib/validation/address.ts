import { z } from "zod";

export const UaeEmirateSchema = z.enum([
  "Abu Dhabi",
  "Dubai",
  "Sharjah",
  "Ajman",
  "Umm Al Quwain",
  "Ras Al Khaimah",
  "Fujairah",
]);

export const UaePhoneSchema = z
  .string()
  .regex(/^\+9715\d{8}$/, "Phone must use UAE +9715XXXXXXXX format.");

export const UaeAddressSchema = z.object({
  recipient_name: z.string().trim().min(1),
  phone_e164: UaePhoneSchema,
  line1: z.string().trim().min(1),
  line2: z.string().trim().min(1).optional(),
  city: z.string().trim().min(1),
  emirate: UaeEmirateSchema,
  country_code: z.literal("AE").default("AE"),
});

export type UaeAddressInput = z.infer<typeof UaeAddressSchema>;
