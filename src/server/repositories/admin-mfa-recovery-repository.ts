// Authz model: admin-mfa-recovery-repository
//   replaceRecoveryCodes(userId, hashes): caller=server-side admin MFA enrollment only;
//     uses service-role access because recovery codes are never directly readable by admins.
//   listRecoveryCodeHashes(userId): caller=integration tests and future recovery flow only.
//   No plaintext recovery codes are accepted or returned by this module.
import "server-only";

import { supabaseAdmin } from "@/server/db/supabase-admin";

type AdminClient = Pick<typeof supabaseAdmin, "from">;

export async function replaceRecoveryCodes(
  userId: string,
  hashes: string[],
  client: AdminClient = supabaseAdmin,
): Promise<void> {
  const { error: deleteError } = await client
    .from("admin_mfa_recovery_codes")
    .delete()
    .eq("user_id", userId);

  if (deleteError) {
    throw new Error(`Admin MFA recovery code cleanup failed: ${deleteError.message}`);
  }

  const { error: insertError } = await client.from("admin_mfa_recovery_codes").insert(
    hashes.map((codeHash) => ({
      user_id: userId,
      code_hash: codeHash,
    })),
  );

  if (insertError) {
    throw new Error(`Admin MFA recovery code insert failed: ${insertError.message}`);
  }
}

export async function listRecoveryCodeHashes(
  userId: string,
  client: AdminClient = supabaseAdmin,
): Promise<string[]> {
  const { data, error } = await client
    .from("admin_mfa_recovery_codes")
    .select("code_hash")
    .eq("user_id", userId)
    .is("used_at", null)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Admin MFA recovery code query failed: ${error.message}`);
  }

  return data.map((row) => row.code_hash);
}
