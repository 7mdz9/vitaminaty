"use server";

import { readFile } from "node:fs/promises";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/policies";
import { isAppError } from "@/lib/errors";
import { beginTotpChallenge, verifyTotpChallenge } from "@/lib/auth/mfa";
import { record } from "@/features/audit-log/record";
import { clearFeatureFlagCache } from "@/features/feature-flags/eval";
import { getHighRigorFeatureFlagGate, hasHighRigorSignoff } from "@/features/feature-flags/gates";
import {
  FeatureFlagToggleActionSchema,
  type FeatureFlagToggleActionInput,
} from "@/lib/validation/feature-flag";
import {
  getFeatureFlag,
  updateFeatureFlagForAdminIfFresh,
} from "@/server/repositories/feature-flag-repository";
import type { FeatureFlagRecord } from "@/types/feature-flag";

export type FeatureFlagMfaChallengeResult =
  | {
      ok: true;
      factorId: string;
      challengeId: string;
    }
  | {
      ok: false;
      code: "authorization_error" | "validation_error" | "unknown";
      message: string;
    };

export type FeatureFlagToggleResult =
  | {
      ok: true;
      flag: FeatureFlagRecord;
    }
  | {
      ok: false;
      code:
        | "not_found"
        | "locked"
        | "mfa_required"
        | "confirmation_required"
        | "stale_data"
        | "validation_error"
        | "authorization_error"
        | "unknown";
      message: string;
      current?: FeatureFlagRecord | null;
      requiredPhrase?: string;
    };

type FeatureFlagToggleErrorResult = Extract<FeatureFlagToggleResult, { ok: false }>;

export async function beginFeatureFlagMfaChallenge(): Promise<FeatureFlagMfaChallengeResult> {
  try {
    await requireAdmin();
    const challenge = await beginTotpChallenge();

    return {
      ok: true,
      factorId: challenge.factorId,
      challengeId: challenge.challengeId,
    };
  } catch (error) {
    return mapChallengeError(error);
  }
}

export async function toggleFeatureFlag(
  input: FeatureFlagToggleActionInput,
): Promise<FeatureFlagToggleResult> {
  try {
    const admin = await requireAdmin();
    const parsed = FeatureFlagToggleActionSchema.parse(input);
    const before = await getFeatureFlag(parsed.key);

    if (!before) {
      return {
        ok: false,
        code: "not_found",
        message: "Feature flag not found.",
      };
    }

    if (before.enabled === parsed.enabled) {
      return {
        ok: true,
        flag: before,
      };
    }

    const gate = getHighRigorFeatureFlagGate(parsed.key);

    if (gate) {
      const lastSessionText = await readLastSessionText();

      if (!hasHighRigorSignoff(gate, lastSessionText)) {
        return {
          ok: false,
          code: "locked",
          message: `${parsed.key} is locked until ${gate.signoffLabel} is recorded in LAST_SESSION.md.`,
        };
      }

      if (!parsed.mfa) {
        return {
          ok: false,
          code: "mfa_required",
          message: "MFA re-verification is required for this HIGH_RIGOR flag.",
        };
      }

      if (parsed.enabled && gate.enablePhrase && parsed.confirmationPhrase !== gate.enablePhrase) {
        return {
          ok: false,
          code: "confirmation_required",
          message: `Type ${gate.enablePhrase} to enable this flag.`,
          requiredPhrase: gate.enablePhrase,
        };
      }

      await verifyTotpChallenge(parsed.mfa);
    }

    const updated = await updateFeatureFlagForAdminIfFresh(parsed.key, parsed.expectedUpdatedAt, {
      enabled: parsed.enabled,
      updated_at: new Date().toISOString(),
      updated_by: admin.userId,
    });

    if (!updated) {
      return {
        ok: false,
        code: "stale_data",
        message: "This feature flag changed after the settings page loaded.",
        current: await getFeatureFlag(parsed.key),
      };
    }

    await record({
      actor: { userId: admin.userId, email: admin.email },
      diff: {
        version: 1,
        action: "flag_toggle",
        entity_type: "feature_flag",
        feature_flag_key: updated.key,
        changes: [
          { field: "enabled", before: before.enabled, after: updated.enabled },
          { field: "gate", before: null, after: gate?.signoffLabel ?? null },
        ],
      },
    });

    clearFeatureFlagCache();
    revalidatePath("/admin/settings/feature-flags");

    return {
      ok: true,
      flag: updated,
    };
  } catch (error) {
    return mapToggleError(error);
  }
}

async function readLastSessionText(): Promise<string> {
  try {
    return await readFile("docs/LAST_SESSION.md", "utf8");
  } catch {
    return "";
  }
}

function mapChallengeError(error: unknown): Extract<FeatureFlagMfaChallengeResult, { ok: false }> {
  if (isAppError(error)) {
    return {
      ok: false,
      code: error.code === "authorization_error" ? "authorization_error" : "validation_error",
      message: error.message,
    };
  }

  return {
    ok: false,
    code: "unknown",
    message: error instanceof Error ? error.message : "Unknown MFA challenge error.",
  };
}

function mapToggleError(error: unknown): FeatureFlagToggleErrorResult {
  if (isAppError(error)) {
    return {
      ok: false,
      code: error.code === "authorization_error" ? "authorization_error" : "validation_error",
      message: error.message,
    };
  }

  return {
    ok: false,
    code: "unknown",
    message: error instanceof Error ? error.message : "Unknown feature flag action error.",
  };
}
