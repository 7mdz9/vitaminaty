import { verifyMfaChallengeAction } from "@/features/auth/admin-session";
import { beginTotpChallenge } from "@/lib/auth/mfa";
import { requireAdminPendingMfa } from "@/lib/auth/policies";

export default async function AdminMfaVerifyPage() {
  await requireAdminPendingMfa();
  const challenge = await beginTotpChallenge();

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center px-6 py-12">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-950">Verify MFA</h1>
          <p className="mt-2 text-sm text-gray-600">
            Enter the 6-digit code from your authenticator app.
          </p>
        </div>

        <form action={verifyMfaChallengeAction} className="space-y-4">
          <input name="factorId" type="hidden" value={challenge.factorId} />
          <input name="challengeId" type="hidden" value={challenge.challengeId} />
          <label className="block space-y-1 text-sm font-medium text-gray-800">
            <span>Authenticator code</span>
            <input
              autoComplete="one-time-code"
              className="w-full rounded border border-gray-300 px-3 py-2 text-base"
              inputMode="numeric"
              maxLength={6}
              minLength={6}
              name="code"
              pattern="[0-9]{6}"
              required
            />
          </label>
          <button
            className="w-full rounded bg-gray-950 px-4 py-2 text-sm font-semibold text-white"
            type="submit"
          >
            Verify
          </button>
        </form>
      </div>
    </main>
  );
}
