import { z } from "zod";
import { FEATURE_FLAGS, type FeatureFlagKey } from "@/features/feature-flags/flags";

const featureFlagKeys = Object.keys(FEATURE_FLAGS) as [FeatureFlagKey, ...FeatureFlagKey[]];

export const FeatureFlagKeySchema = z.enum(featureFlagKeys);

export const FeatureFlagMfaChallengeSchema = z.object({
  factorId: z.string().trim().min(1),
  challengeId: z.string().trim().min(1),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "MFA code must be 6 digits."),
});

export const FeatureFlagToggleActionSchema = z.object({
  key: FeatureFlagKeySchema,
  enabled: z.boolean(),
  expectedUpdatedAt: z.string().trim().min(1),
  confirmationPhrase: z.string().trim().optional(),
  mfa: FeatureFlagMfaChallengeSchema.optional(),
});

export type FeatureFlagToggleActionInput = z.input<typeof FeatureFlagToggleActionSchema>;
