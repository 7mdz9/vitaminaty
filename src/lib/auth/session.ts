import { env } from "@/lib/env";

export const ADMIN_SESSION_COOKIE = "vit_admin_session";
export const ADMIN_SESSION_IDLE_TIMEOUT_MS = 4 * 60 * 60 * 1000;
export const ADMIN_SESSION_ABSOLUTE_TIMEOUT_MS = 12 * 60 * 60 * 1000;

export type AdminSession = Readonly<{
  userId: string;
  email: string;
  role: string;
  issuedAt: number;
  lastSeenAt: number;
  idleExpiresAt: number;
  absoluteExpiresAt: number;
  mfaVerifiedAt: number | null;
}>;

export type CreateAdminSessionInput = Readonly<{
  userId: string;
  email: string;
  role: string;
  mfaVerifiedAt?: number | null;
  now?: number;
}>;

type SignedSessionEnvelope = Readonly<{
  payload: string;
  signature: string;
}>;

const textEncoder = new TextEncoder();

export async function createAdminSessionCookieValue(
  input: CreateAdminSessionInput,
): Promise<string> {
  const now = input.now ?? Date.now();
  const session: AdminSession = {
    userId: input.userId,
    email: input.email,
    role: input.role,
    issuedAt: now,
    lastSeenAt: now,
    idleExpiresAt: now + ADMIN_SESSION_IDLE_TIMEOUT_MS,
    absoluteExpiresAt: now + ADMIN_SESSION_ABSOLUTE_TIMEOUT_MS,
    mfaVerifiedAt: input.mfaVerifiedAt ?? now,
  };
  const payload = encodeJson(session);
  const signature = await signPayload(payload);

  return encodeJson({ payload, signature } satisfies SignedSessionEnvelope);
}

export async function readAdminSessionCookieValue(
  value: string | undefined,
  now = Date.now(),
): Promise<AdminSession | null> {
  if (!value) {
    return null;
  }

  const envelope = decodeJson<SignedSessionEnvelope>(value);

  if (!envelope?.payload || !envelope.signature) {
    return null;
  }

  const expectedSignature = await signPayload(envelope.payload);

  if (!constantTimeEqual(envelope.signature, expectedSignature)) {
    return null;
  }

  const session = decodeJson<AdminSession>(envelope.payload);

  if (!isAdminSession(session)) {
    return null;
  }

  if (now > session.idleExpiresAt || now > session.absoluteExpiresAt) {
    return null;
  }

  return session;
}

export function hasVerifiedMfa(session: AdminSession, now = Date.now()): boolean {
  return typeof session.mfaVerifiedAt === "number" && session.mfaVerifiedAt <= now;
}

export function refreshAdminSession(session: AdminSession, now = Date.now()): AdminSession {
  return {
    ...session,
    lastSeenAt: now,
    idleExpiresAt: Math.min(now + ADMIN_SESSION_IDLE_TIMEOUT_MS, session.absoluteExpiresAt),
  };
}

export function adminSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: env.VITAMINATY_APP_ENV !== "development",
    sameSite: "lax" as const,
    path: "/admin",
    maxAge: ADMIN_SESSION_IDLE_TIMEOUT_MS / 1000,
  };
}

export async function serializeRefreshedAdminSession(session: AdminSession): Promise<string> {
  const payload = encodeJson(session);
  const signature = await signPayload(payload);

  return encodeJson({ payload, signature } satisfies SignedSessionEnvelope);
}

function isAdminSession(value: unknown): value is AdminSession {
  if (!value || typeof value !== "object") {
    return false;
  }

  const session = value as Record<string, unknown>;

  return (
    typeof session.userId === "string" &&
    typeof session.email === "string" &&
    typeof session.role === "string" &&
    typeof session.issuedAt === "number" &&
    typeof session.lastSeenAt === "number" &&
    typeof session.idleExpiresAt === "number" &&
    typeof session.absoluteExpiresAt === "number" &&
    (typeof session.mfaVerifiedAt === "number" || session.mfaVerifiedAt === null)
  );
}

async function signPayload(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(env.ADMIN_SESSION_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, textEncoder.encode(payload));

  return bytesToBase64Url(new Uint8Array(signature));
}

function encodeJson(value: unknown): string {
  return bytesToBase64Url(textEncoder.encode(JSON.stringify(value)));
}

function decodeJson<T>(value: string): T | null {
  try {
    return JSON.parse(new TextDecoder().decode(base64UrlToBytes(value))) as T;
  } catch {
    return null;
  }
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let diff = 0;

  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return diff === 0;
}
