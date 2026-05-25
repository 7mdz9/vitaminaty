import "server-only";

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env, publicEnv } from "@/lib/env";
import { AuthorizationError, ValidationError } from "@/lib/errors";
import { hmacSha256Hex, randomBase64Url } from "@/lib/crypto";
import type { Database } from "@/lib/supabase/types.generated";
import { record, type AuditActor } from "@/server/services/audit-service";
import { replaceRecoveryCodes } from "@/server/repositories/admin-mfa-recovery-repository";

export type TotpEnrollment = Readonly<{
  factorId: string;
  qrCode: string;
  secret: string;
}>;

export type TotpChallenge = Readonly<{
  factorId: string;
  challengeId: string;
}>;

export type RecoveryCodeResult = Readonly<{
  recoveryCodes: string[];
  recoveryCodeHashes: string[];
}>;

type SupabaseAuthClient = Awaited<ReturnType<typeof createAdminSupabaseAuthClient>>;
type RecoveryCodeClient = Parameters<typeof replaceRecoveryCodes>[2];

export async function createAdminSupabaseAuthClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Components cannot set cookies; middleware refreshes auth cookies separately.
          }
        },
      },
    },
  );
}

export async function hasVerifiedTotpFactor(supabase?: SupabaseAuthClient): Promise<boolean> {
  const client = supabase ?? (await createAdminSupabaseAuthClient());

  return (await listVerifiedTotpFactors(client)).length > 0;
}

export async function beginTotpEnrollment(supabase?: SupabaseAuthClient): Promise<TotpEnrollment> {
  const client = supabase ?? (await createAdminSupabaseAuthClient());
  const { data, error } = await client.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: env.MFA_ISSUER_NAME,
  });

  if (error || !data) {
    throw new AuthorizationError({
      code: "admin_mfa_enrollment_failed",
      message: error?.message ?? "Could not start MFA enrollment.",
    });
  }

  const totp = data.totp;

  if (!totp?.qr_code || !totp.secret) {
    throw new AuthorizationError({
      code: "admin_mfa_enrollment_failed",
      message: "Supabase did not return a TOTP QR code and secret.",
    });
  }

  return {
    factorId: data.id,
    qrCode: totp.qr_code,
    secret: totp.secret,
  };
}

export async function verifyTotpEnrollment(input: {
  factorId: string;
  code: string;
  supabase?: SupabaseAuthClient;
}): Promise<void> {
  const supabase = input.supabase ?? (await createAdminSupabaseAuthClient());
  const code = normalizeMfaCode(input.code);
  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
    factorId: input.factorId,
  });

  if (challengeError || !challenge?.id) {
    throw new AuthorizationError({
      code: "admin_mfa_challenge_failed",
      message: challengeError?.message ?? "Could not create MFA challenge.",
    });
  }

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId: input.factorId,
    challengeId: challenge.id,
    code,
  });

  if (verifyError) {
    throw new AuthorizationError({
      code: "admin_mfa_verification_failed",
      message: "MFA code was not accepted.",
    });
  }
}

export async function beginTotpChallenge(supabase?: SupabaseAuthClient): Promise<TotpChallenge> {
  const client = supabase ?? (await createAdminSupabaseAuthClient());
  const factor = (await listVerifiedTotpFactors(client))[0];

  if (!factor) {
    throw new AuthorizationError({
      code: "admin_mfa_factor_required",
      message: "Admin MFA factor is required.",
    });
  }

  const { data, error } = await client.auth.mfa.challenge({ factorId: factor.id });

  if (error || !data?.id) {
    throw new AuthorizationError({
      code: "admin_mfa_challenge_failed",
      message: error?.message ?? "Could not create MFA challenge.",
    });
  }

  return { factorId: factor.id, challengeId: data.id };
}

export async function verifyTotpChallenge(input: {
  factorId: string;
  challengeId: string;
  code: string;
  supabase?: SupabaseAuthClient;
}): Promise<void> {
  const supabase = input.supabase ?? (await createAdminSupabaseAuthClient());
  const code = normalizeMfaCode(input.code);
  const { error } = await supabase.auth.mfa.verify({
    factorId: input.factorId,
    challengeId: input.challengeId,
    code,
  });

  if (error) {
    throw new AuthorizationError({
      code: "admin_mfa_verification_failed",
      message: "MFA code was not accepted.",
    });
  }
}

export async function createRecoveryCodesForVerifiedMfa(input: {
  actor: AuditActor;
  userId: string;
  factorId: string;
  client?: RecoveryCodeClient;
}): Promise<RecoveryCodeResult> {
  const recoveryCodes = generateRecoveryCodes();
  const recoveryCodeHashes = recoveryCodes.map(hashRecoveryCode);
  await replaceRecoveryCodes(input.userId, recoveryCodeHashes, input.client);
  await record(
    {
      actor: input.actor,
      diff: {
        version: 1,
        action: "mfa_enrolled",
        entity_type: "admin_user",
        user_id: input.userId,
        factor_type: "totp",
        factor_id: input.factorId,
        recovery_codes_count: recoveryCodes.length,
      },
    },
    input.client,
  );

  return { recoveryCodes, recoveryCodeHashes };
}

export function hashRecoveryCode(code: string): string {
  return hmacSha256Hex({
    secret: env.ADMIN_SESSION_SECRET,
    payload: `admin-mfa-recovery:${code}`,
  });
}

export function generateRecoveryCodes(count = 10): string[] {
  return Array.from({ length: count }, () => randomBase64Url(12).toUpperCase());
}

async function listVerifiedTotpFactors(supabase: SupabaseAuthClient): Promise<MfaFactor[]> {
  const { data, error } = await supabase.auth.mfa.listFactors();

  if (error) {
    throw new AuthorizationError({
      code: "admin_mfa_factor_query_failed",
      message: error.message,
    });
  }

  return extractTotpFactors(data).filter((factor) => factor.status === "verified");
}

function normalizeMfaCode(value: string): string {
  const code = value.trim();

  if (!/^\d{6}$/.test(code)) {
    throw new ValidationError({
      code: "invalid_mfa_code",
      message: "MFA code must be 6 digits.",
    });
  }

  return code;
}

type MfaFactor = Readonly<{
  id: string;
  status?: string;
}>;

function extractTotpFactors(value: unknown): MfaFactor[] {
  const factors = value as { totp?: unknown };

  if (!Array.isArray(factors.totp)) {
    return [];
  }

  return factors.totp.flatMap((factor) => {
    if (!factor || typeof factor !== "object") {
      return [];
    }

    const recordValue = factor as Record<string, unknown>;

    return typeof recordValue.id === "string"
      ? [{ id: recordValue.id, status: asString(recordValue.status) }]
      : [];
  });
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
