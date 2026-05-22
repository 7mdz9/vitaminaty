export default function Home() {
  return (
    <main className="min-h-screen bg-surface-page px-5 py-7 text-text-primary">
      <section className="mx-auto flex min-h-[70vh] max-w-container flex-col justify-center gap-5">
        <p className="font-body text-caption font-semibold uppercase tracking-wider text-action">
          M0 Foundation
        </p>
        <h1 className="max-w-3xl font-display text-h1 font-bold leading-tight text-deep-maroon">
          Vitaminaty — M0 Foundation
        </h1>
        <p className="max-w-2xl font-body text-body-lg leading-relaxed text-text-secondary">
          Next.js, TypeScript, Tailwind, design tokens, and the production skeleton are ready for
          the next milestone.
        </p>
        <div className="flex flex-wrap gap-3">
          <span className="rounded-pill bg-action px-4 py-2 font-body text-body-sm font-semibold text-text-inverse shadow-card">
            Tailwind tokens active
          </span>
          <span className="rounded-pill border border-border bg-surface-card px-4 py-2 font-body text-body-sm font-semibold text-text-primary shadow-card">
            Structure-only build
          </span>
        </div>
      </section>
    </main>
  );
}
