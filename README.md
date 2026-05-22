# Vitaminaty

Vitaminaty is a UAE multi-brand supplement e-commerce platform built with Next.js 15, TypeScript, Supabase, and Tailwind CSS.

## Getting Started

### Prerequisites

- Node.js 20
- pnpm 9
- A Supabase project created per the M0 preflight H2 instructions

### Local Setup

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Fill `.env.local` with the Supabase and application values from your project before running the app. The env loader is shape-only: local builds need valid formats and required values, but it does not make network/liveness calls.

The development server runs at:

```text
http://localhost:3000
```

## Quality Gates

Run the same checks that CI runs:

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm build
pnpm test
```

## Deploying

Vercel preview deployment is prepared through `vercel.json` and the GitHub Actions CI workflow. Human setup is still required for the actual Vercel project creation and environment variables. Follow Preflight H3 / `docs/proj_spec.md` section 12 before enabling preview deployment.
