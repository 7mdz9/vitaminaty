"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_ABSOLUTE_TIMEOUT_MS,
  ADMIN_SESSION_IDLE_TIMEOUT_MS,
  adminSessionCookieOptions,
  type AdminSession,
  createAdminSessionCookieValue,
  readAdminSessionCookieValue,
  serializeRefreshedAdminSession,
} from "@/lib/auth/session";
import { env } from "@/lib/env";
import {
  beginTotpChallenge,
  createAdminSupabaseAuthClient,
  createRecoveryCodesForVerifiedMfa,
  hasVerifiedTotpFactor,
  verifyTotpChallenge,
  verifyTotpEnrollment,
} from "@/lib/auth/mfa";
import { requireAdminPendingMfa } from "@/lib/auth/policies";

const RECOVERY_CODES_COOKIE = "vit_admin_recovery_codes_once";

export async function signInAdmin(formData: FormData): Promise<never> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const nextPath = normalizeAdminNextPath(String(formData.get("next") ?? "/admin"));
  const supabase = await createAdminSupabaseAuthClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    redirect(`/admin/sign-in?error=invalid_credentials&next=${encodeURIComponent(nextPath)}`);
  }

  if (data.user.app_metadata?.role !== "admin") {
    await supabase.auth.signOut();
    redirect("/admin/sign-in?error=forbidden");
  }

  const mfaRequired = (await hasVerifiedTotpFactor(supabase)) ? "verify" : "enroll";
  const cookieStore = await cookies();
  const cookieValue = await createAdminSessionCookieValue({
    userId: data.user.id,
    email: data.user.email ?? email,
    role: "admin",
    mfaVerifiedAt: null,
    mfaRequired,
  });

  cookieStore.set(ADMIN_SESSION_COOKIE, cookieValue, adminSessionCookieOptions());
  redirect(nextPath);
}

export async function verifyMfaEnrollmentAction(formData: FormData): Promise<never> {
  const admin = await requireAdminPendingMfa();
  const factorId = String(formData.get("factorId") ?? "");
  const code = String(formData.get("code") ?? "");

  await verifyTotpEnrollment({ factorId, code });

  const { recoveryCodes } = await createRecoveryCodesForVerifiedMfa({
    actor: { userId: admin.userId, email: admin.email },
    userId: admin.userId,
    factorId,
  });

  await setVerifiedAdminSession(admin.userId, admin.email);
  const cookieStore = await cookies();
  cookieStore.set(RECOVERY_CODES_COOKIE, encodeRecoveryCodes(recoveryCodes), {
    httpOnly: true,
    secure: env.VITAMINATY_APP_ENV !== "development",
    sameSite: "lax",
    path: "/admin/mfa/enroll",
    maxAge: 10 * 60,
  });
  redirect("/admin/mfa/enroll?recovery=1");
}

export async function confirmMfaRecoveryCodesAction(formData: FormData): Promise<never> {
  const acknowledged = formData.get("acknowledged") === "on";

  if (!acknowledged) {
    redirect("/admin/mfa/enroll?recovery=1&error=acknowledgement_required");
  }

  const cookieStore = await cookies();
  cookieStore.delete(RECOVERY_CODES_COOKIE);
  redirect("/admin");
}

export async function startMfaChallengeAction(): Promise<never> {
  await requireAdminPendingMfa();
  const challenge = await beginTotpChallenge();
  redirect(
    `/admin/mfa/verify?factorId=${encodeURIComponent(challenge.factorId)}&challengeId=${encodeURIComponent(challenge.challengeId)}`,
  );
}

export async function verifyMfaChallengeAction(formData: FormData): Promise<never> {
  const admin = await requireAdminPendingMfa();
  const factorId = String(formData.get("factorId") ?? "");
  const challengeId = String(formData.get("challengeId") ?? "");
  const code = String(formData.get("code") ?? "");

  await verifyTotpChallenge({ factorId, challengeId, code });
  await setVerifiedAdminSession(admin.userId, admin.email);
  redirect("/admin");
}

export async function readPendingRecoveryCodes(): Promise<string[] | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(RECOVERY_CODES_COOKIE)?.value;

  return decodeRecoveryCodes(value);
}

function normalizeAdminNextPath(value: string): string {
  if (!value.startsWith("/admin") || value.startsWith("/admin/sign-in")) {
    return "/admin";
  }

  return value;
}

async function setVerifiedAdminSession(userId: string, email: string): Promise<void> {
  const cookieStore = await cookies();
  const currentSession = await readAdminSessionCookieValue(
    cookieStore.get(ADMIN_SESSION_COOKIE)?.value,
  );
  const verifiedAt = Date.now();
  const session: AdminSession =
    currentSession ??
    ({
      userId,
      email,
      role: "admin",
      issuedAt: verifiedAt,
      lastSeenAt: verifiedAt,
      idleExpiresAt: verifiedAt + ADMIN_SESSION_IDLE_TIMEOUT_MS,
      absoluteExpiresAt: verifiedAt + ADMIN_SESSION_ABSOLUTE_TIMEOUT_MS,
      mfaVerifiedAt: verifiedAt,
      mfaRequired: null,
    } satisfies AdminSession);
  const cookieValue = await serializeRefreshedAdminSession({
    ...session,
    mfaVerifiedAt: verifiedAt,
    mfaRequired: null,
  });

  cookieStore.set(ADMIN_SESSION_COOKIE, cookieValue, adminSessionCookieOptions());
}

function encodeRecoveryCodes(codes: string[]): string {
  return Buffer.from(JSON.stringify(codes), "utf8").toString("base64url");
}

function decodeRecoveryCodes(value: string | undefined): string[] | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as unknown;

    return Array.isArray(parsed) && parsed.every((code) => typeof code === "string")
      ? parsed
      : null;
  } catch {
    return null;
  }
}
