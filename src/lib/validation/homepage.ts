import { z } from "zod";

const uuidArray = z.array(z.string().uuid());

const goalTagSchema = z.enum([
  "build_muscle",
  "boost_energy",
  "recovery",
  "weight_management",
  "endurance",
]);

const optionalUrlPath = z
  .string()
  .trim()
  .max(300)
  .refine((value) => value === "" || value.startsWith("/") || /^https?:\/\//i.test(value), {
    message: "Link must be a site path or an http(s) URL.",
  });

export const HomepageConfigUpdateActionSchema = z
  .object({
    configId: z.string().uuid(),
    expectedUpdatedAt: z.string().datetime({ offset: true }),
    heroTitle: z.string().trim().min(1).max(120),
    heroSubtitle: z.string().trim().min(1).max(240),
    heroCtaLabel: z.string().trim().min(1).max(40),
    heroCtaHref: optionalUrlPath,
    promoBannerText: z.string().trim().max(160).optional(),
    promoBannerHref: optionalUrlPath.optional(),
    promoStartsAt: z.string().datetime({ offset: true }).optional(),
    promoEndsAt: z.string().datetime({ offset: true }).optional(),
    newArrivalProductIds: uuidArray.max(4),
    bestsellerProductIds: uuidArray.max(4),
    featuredBrandIds: uuidArray.max(2),
    goalOrder: z.array(goalTagSchema).max(5),
  })
  .superRefine((value, context) => {
    const uniqueGoalCount = new Set(value.goalOrder).size;

    if (uniqueGoalCount !== value.goalOrder.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Goal order cannot contain duplicates.",
        path: ["goalOrder"],
      });
    }

    if (value.promoStartsAt && value.promoEndsAt) {
      const startsAt = new Date(value.promoStartsAt).getTime();
      const endsAt = new Date(value.promoEndsAt).getTime();

      if (endsAt <= startsAt) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Promo end must be after promo start.",
          path: ["promoEndsAt"],
        });
      }
    }
  });

export type HomepageConfigUpdateActionInput = z.input<typeof HomepageConfigUpdateActionSchema>;
export type HomepageConfigUpdateActionData = z.output<typeof HomepageConfigUpdateActionSchema>;
