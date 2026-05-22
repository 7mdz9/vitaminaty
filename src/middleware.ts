import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// authz model: session refresh only; route-level handlers enforce access decisions.
export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/|api/health).*)"],
};
