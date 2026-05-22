import { NextResponse } from "next/server";
import { env } from "@/lib/env";

/**
 * Authz model: no auth required. This endpoint exposes only coarse service
 * health, deployment identity, app environment, and response time.
 */
export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      version: env.VERCEL_GIT_COMMIT_SHA ?? "local-dev",
      env: env.VITAMINATY_APP_ENV,
      timestamp: new Date().toISOString(),
    },
    { status: 200 },
  );
}
