"use server";

import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import {
  ADMIN_SESSION_COOKIE,
  adminSessionCookieOptions,
  createAdminSessionCookieValue,
} from "@/lib/auth/session";
import type { Database } from "@/lib/supabase/types.generated";

export async function signInAdmin(formData: FormData): Promise<never> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const nextPath = normalizeAdminNextPath(String(formData.get("next") ?? "/admin"));
  const supabase = createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    redirect(`/admin/sign-in?error=invalid_credentials&next=${encodeURIComponent(nextPath)}`);
  }

  if (data.user.app_metadata?.role !== "admin") {
    await supabase.auth.signOut();
    redirect("/admin/sign-in?error=forbidden");
  }

  const cookieStore = await cookies();
  const cookieValue = await createAdminSessionCookieValue({
    userId: data.user.id,
    email: data.user.email ?? email,
    role: "admin",
    mfaVerifiedAt: null,
  });

  cookieStore.set(ADMIN_SESSION_COOKIE, cookieValue, adminSessionCookieOptions());
  redirect(nextPath);
}

function normalizeAdminNextPath(value: string): string {
  if (!value.startsWith("/admin") || value.startsWith("/admin/sign-in")) {
    return "/admin";
  }

  return value;
}
