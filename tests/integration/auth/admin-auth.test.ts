import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/middleware", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");

  return {
    updateSession: () => actual.NextResponse.next(),
  };
});

describe("admin auth middleware", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("redirects unauthenticated admin requests to sign-in", async () => {
    const { middleware } = await import("@/middleware");
    const response = await middleware(createRequest("/admin/products"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/admin/sign-in");
  });

  it("returns 403 for authenticated non-admin sessions", async () => {
    const { middleware } = await import("@/middleware");
    const cookie = await createSessionCookie("customer");
    const response = await middleware(createRequest("/admin/products", cookie));

    expect(response.status).toBe(403);
  });

  it("allows authenticated admin sessions and refreshes vit_admin_session", async () => {
    const { middleware } = await import("@/middleware");
    const cookie = await createSessionCookie("admin");
    const response = await middleware(createRequest("/admin/products", cookie));

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("vit_admin_session=");
  });

  it("blocks admin requests outside ADMIN_IP_ALLOWLIST", async () => {
    vi.stubEnv("ADMIN_IP_ALLOWLIST", "203.0.113.0/24");
    const { middleware } = await import("@/middleware");
    const cookie = await createSessionCookie("admin");
    const response = await middleware(
      createRequest("/admin/products", cookie, { "x-forwarded-for": "198.51.100.10" }),
    );

    expect(response.status).toBe(403);
  });

  it("allows admin requests inside ADMIN_IP_ALLOWLIST", async () => {
    vi.stubEnv("ADMIN_IP_ALLOWLIST", "203.0.113.0/24");
    const { middleware } = await import("@/middleware");
    const cookie = await createSessionCookie("admin");
    const response = await middleware(
      createRequest("/admin/products", cookie, { "x-forwarded-for": "203.0.113.42" }),
    );

    expect(response.status).toBe(200);
  });
});

async function createSessionCookie(role: string): Promise<string> {
  const { createAdminSessionCookieValue } = await import("@/lib/auth/session");

  return createAdminSessionCookieValue({
    userId: "auth-test-user",
    email: `${role}@example.test`,
    role,
    mfaVerifiedAt: Date.now(),
  });
}

function createRequest(
  path: string,
  adminCookie?: string,
  headers: Record<string, string> = {},
): NextRequest {
  const requestHeaders = new Headers(headers);

  if (adminCookie) {
    requestHeaders.set("cookie", `vit_admin_session=${adminCookie}`);
  }

  return new NextRequest(new URL(path, "http://localhost:3000"), {
    headers: requestHeaders,
  });
}
