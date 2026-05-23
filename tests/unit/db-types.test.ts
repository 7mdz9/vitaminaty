import { describe, expectTypeOf, it } from "vitest";
import type { supabaseAdmin } from "@/server/db/supabase-admin";
import type { createSupabaseServerClient } from "@/server/db/supabase-server";
import type { Database } from "@/lib/supabase/types.generated";

type PublicTables = Database["public"]["Tables"];

describe("repository-facing Supabase DB surface", () => {
  it("typechecks the admin and per-request server client modules", () => {
    expectTypeOf<typeof supabaseAdmin>().not.toBeAny();
    expectTypeOf<typeof createSupabaseServerClient>().not.toBeAny();
  });

  it("covers the M1 database tables used by repositories", () => {
    expectTypeOf<PublicTables["customers"]>().not.toBeAny();
    expectTypeOf<PublicTables["orders"]>().not.toBeAny();
    expectTypeOf<PublicTables["products"]>().not.toBeAny();
    expectTypeOf<PublicTables["payment_events"]>().not.toBeAny();
  });
});
