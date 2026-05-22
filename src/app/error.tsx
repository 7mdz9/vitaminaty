"use client";

// TODO(M8): Root error boundary with production-safe reporting and recovery UI.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen bg-surface-page p-5 text-text-primary">
      <h1 className="font-display text-h3">Something went wrong</h1>
      <p className="mt-3 text-text-secondary">{error.message}</p>
      <button
        className="mt-5 rounded-sm bg-action px-4 py-2 text-text-inverse"
        onClick={reset}
        type="button"
      >
        Try again
      </button>
    </main>
  );
}
