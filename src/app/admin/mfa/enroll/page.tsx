import { redirect } from "next/navigation";
import {
  confirmMfaRecoveryCodesAction,
  readPendingRecoveryCodes,
  verifyMfaEnrollmentAction,
} from "@/features/auth/admin-session";
import { beginTotpEnrollment } from "@/lib/auth/mfa";
import { requireAdminPendingMfa } from "@/lib/auth/policies";

type AdminMfaEnrollPageProps = Readonly<{
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}>;

export default async function AdminMfaEnrollPage({ searchParams }: AdminMfaEnrollPageProps) {
  const params = searchParams ? await searchParams : {};
  const recoveryCodes = await readPendingRecoveryCodes();

  if (recoveryCodes) {
    return <RecoveryCodesView codes={recoveryCodes} error={firstParam(params.error)} />;
  }

  const admin = await requireAdminPendingMfa();

  if (admin.mfaRequired === "verify") {
    redirect("/admin/mfa/verify");
  }

  const enrollment = await beginTotpEnrollment();

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-xl flex-col justify-center px-6 py-12">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-950">Set up MFA</h1>
          <p className="mt-2 text-sm text-gray-600">
            Scan the QR code with your authenticator app, then enter the 6-digit code.
          </p>
        </div>

        <div className="rounded border border-gray-200 bg-white p-4">
          <img alt="TOTP QR code" className="mx-auto size-56" src={enrollment.qrCode} />
          <p className="mt-4 break-all rounded bg-gray-50 p-3 text-xs text-gray-700">
            {enrollment.secret}
          </p>
        </div>

        <form action={verifyMfaEnrollmentAction} className="space-y-4">
          <input name="factorId" type="hidden" value={enrollment.factorId} />
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
            Verify and show recovery codes
          </button>
        </form>
      </div>
    </main>
  );
}

function RecoveryCodesView({ codes, error }: Readonly<{ codes: string[]; error?: string }>) {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-xl flex-col justify-center px-6 py-12">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-950">Save recovery codes</h1>
          <p className="mt-2 text-sm text-gray-600">
            These codes are shown once. Store them before continuing.
          </p>
        </div>

        {error === "acknowledgement_required" ? (
          <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            Confirm you saved the recovery codes before continuing.
          </p>
        ) : null}

        <ol className="grid gap-2 rounded border border-gray-200 bg-white p-4 text-sm font-mono">
          {codes.map((code) => (
            <li key={code}>{code}</li>
          ))}
        </ol>

        <form action={confirmMfaRecoveryCodesAction} className="space-y-4">
          <label className="flex gap-2 text-sm text-gray-800">
            <input name="acknowledged" required type="checkbox" />
            <span>I saved these recovery codes.</span>
          </label>
          <button
            className="w-full rounded bg-gray-950 px-4 py-2 text-sm font-semibold text-white"
            type="submit"
          >
            Continue to admin
          </button>
        </form>
      </div>
    </main>
  );
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
