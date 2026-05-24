import { z } from "zod";
import { FeatureFlagMfaChallengeSchema } from "@/lib/validation/feature-flag";

export const AdminSettingsMfaActionSchema = z.object({
  mfa: FeatureFlagMfaChallengeSchema,
});

export const AdminInviteActionSchema = AdminSettingsMfaActionSchema.extend({
  email: z.string().trim().toLowerCase().email(),
});

export const AdminUserTargetActionSchema = AdminSettingsMfaActionSchema.extend({
  userId: z.string().uuid(),
});

export type AdminInviteActionInput = z.input<typeof AdminInviteActionSchema>;
export type AdminUserTargetActionInput = z.input<typeof AdminUserTargetActionSchema>;
