import { cookies } from "next/headers";
import { AuthorizationError } from "@/lib/errors";
import {
  ADMIN_SESSION_COOKIE,
  hasVerifiedMfa,
  readAdminSessionCookieValue,
  type AdminSession,
} from "@/lib/auth/session";

export type RequiredAdmin = Readonly<{
  userId: string;
  email: string;
  role: "admin";
}>;

export async function requireAdmin(): Promise<RequiredAdmin> {
  const session = await readSessionFromCookie();

  assertAdminRole(session);

  if (!hasVerifiedMfa(session)) {
    throw new AuthorizationError({
      code: "admin_mfa_required",
      message: "Admin MFA verification is required.",
      statusCode: 403,
    });
  }

  return {
    userId: session.userId,
    email: session.email,
    role: "admin",
  };
}

export async function requireAdminPendingMfa(): Promise<RequiredAdmin> {
  const session = await readSessionFromCookie();

  assertAdminRole(session);

  return {
    userId: session.userId,
    email: session.email,
    role: "admin",
  };
}

async function readSessionFromCookie(): Promise<AdminSession> {
  const cookieStore = await cookies();
  const session = await readAdminSessionCookieValue(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);

  if (!session) {
    throw new AuthorizationError({
      code: "admin_session_required",
      message: "Admin session is required.",
      statusCode: 401,
    });
  }

  return session;
}

function assertAdminRole(session: AdminSession): asserts session is AdminSession & { role: "admin" } {
  if (session.role !== "admin") {
    throw new AuthorizationError({
      code: "admin_role_required",
      message: "Admin role is required.",
      statusCode: 403,
    });
  }
}
