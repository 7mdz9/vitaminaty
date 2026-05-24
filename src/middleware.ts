import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import {
  ADMIN_SESSION_COOKIE,
  adminSessionCookieOptions,
  hasVerifiedMfa,
  readAdminSessionCookieValue,
  refreshAdminSession,
  serializeRefreshedAdminSession,
} from "@/lib/auth/session";
import { updateSession } from "@/lib/supabase/middleware";

// authz model: session refresh only; route-level handlers enforce access decisions.
export async function middleware(request: NextRequest) {
  const response = await updateSession(request);

  if (!request.nextUrl.pathname.startsWith("/admin")) {
    return response;
  }

  if (request.nextUrl.pathname === "/admin/sign-in") {
    return response;
  }

  if (!isIpAllowed(getClientIp(request), env.ADMIN_IP_ALLOWLIST)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const session = await readAdminSessionCookieValue(
    request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
  );

  if (!session) {
    const signInUrl = new URL("/admin/sign-in", request.url);
    signInUrl.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(signInUrl);
  }

  if (session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const mfaPath = expectedMfaPath(session.mfaRequired);

  if (!hasVerifiedMfa(session) && request.nextUrl.pathname !== mfaPath) {
    return NextResponse.redirect(new URL(mfaPath, request.url));
  }

  const refreshedSession = refreshAdminSession(session);
  response.cookies.set(
    ADMIN_SESSION_COOKIE,
    await serializeRefreshedAdminSession(refreshedSession),
    adminSessionCookieOptions(),
  );

  return response;
}

function expectedMfaPath(required: "enroll" | "verify" | null | undefined): string {
  return required === "verify" ? "/admin/mfa/verify" : "/admin/mfa/enroll";
}

export const config = {
  matcher: ["/((?!_next/|api/health).*)"],
};

function getClientIp(request: NextRequest): string | null {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();

  return forwardedFor || request.headers.get("x-real-ip") || null;
}

function isIpAllowed(ip: string | null, allowlist: string): boolean {
  const entries = allowlist
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (entries.length === 0) {
    return true;
  }

  if (!ip) {
    return false;
  }

  return entries.some((entry) => matchesAllowlistEntry(ip, entry));
}

function matchesAllowlistEntry(ip: string, entry: string): boolean {
  if (!entry.includes("/")) {
    return ip === entry;
  }

  const [network, prefixRaw] = entry.split("/");
  const prefix = Number(prefixRaw);
  const ipNumber = ipv4ToNumber(ip);
  const networkNumber = ipv4ToNumber(network);

  if (ipNumber === null || networkNumber === null || !Number.isInteger(prefix)) {
    return false;
  }

  if (prefix < 0 || prefix > 32) {
    return false;
  }

  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;

  return (ipNumber & mask) === (networkNumber & mask);
}

function ipv4ToNumber(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const parts = value.split(".").map((part) => Number(part));

  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return null;
  }

  return (
    ((parts[0] << 24) >>> 0) +
    ((parts[1] << 16) >>> 0) +
    ((parts[2] << 8) >>> 0) +
    parts[3]
  );
}
