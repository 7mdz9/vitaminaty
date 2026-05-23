import { signInAdmin } from "@/features/auth/admin-session";

type AdminSignInPageProps = Readonly<{
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}>;

export default async function AdminSignInPage({ searchParams }: AdminSignInPageProps) {
  const params = searchParams ? await searchParams : {};
  const error = firstParam(params.error);
  const nextPath = firstParam(params.next) ?? "/admin";

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center px-6 py-12">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-950">Admin sign in</h1>
          <p className="mt-2 text-sm text-gray-600">Use your Vitaminaty admin account.</p>
        </div>

        {error ? (
          <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error === "forbidden"
              ? "This account does not have admin access."
              : "Email or password was not accepted."}
          </p>
        ) : null}

        <form action={signInAdmin} className="space-y-4">
          <input name="next" type="hidden" value={nextPath} />
          <label className="block space-y-1 text-sm font-medium text-gray-800">
            <span>Email</span>
            <input
              autoComplete="email"
              className="w-full rounded border border-gray-300 px-3 py-2 text-base"
              name="email"
              required
              type="email"
            />
          </label>
          <label className="block space-y-1 text-sm font-medium text-gray-800">
            <span>Password</span>
            <input
              autoComplete="current-password"
              className="w-full rounded border border-gray-300 px-3 py-2 text-base"
              name="password"
              required
              type="password"
            />
          </label>
          <button
            className="w-full rounded bg-gray-950 px-4 py-2 text-sm font-semibold text-white"
            type="submit"
          >
            Sign in
          </button>
        </form>
      </div>
    </main>
  );
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
