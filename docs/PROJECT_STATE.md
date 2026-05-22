# PROJECT_STATE.md

**Project:** Vitaminaty — UAE multi-brand supplement e-commerce
**Document version:** v1.0 (seeded for M0)
**Audience:** BOB v5 reads this every session to ground itself in current state.
**Update policy:** Updated by v5 or by the developer at the end of every milestone. Never let drift.

---

## 1. What Vitaminaty is

Vitaminaty is a UAE-based multi-brand online retailer for sports nutrition, vitamins, wellness, and healthy food products. It is **not** a brand. It carries ~30 canonical brands (Scitec, Applied Nutrition, Bucked Up, Allmax, Cellucor, Now Foods, Natural Factors, etc.) sourced from authorized distributors. The catalog has 787 unique products imported from a grouped Markdown source (`docs/reference/product.md`).

The platform is admin-driven: products import with minimal data and are progressively enriched by the admin team through a purpose-built admin portal. The public site adapts to whatever data exists per product and never shows fake content.

## 2. Current milestone

**M0 — Foundation.** Repo bootstrap, stack scaffolded, Supabase project created, design tokens extracted from prototype, feature flag infrastructure, env validation, state files. No business surfaces yet.

## 3. Stack — locked

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) + TypeScript |
| Runtime | Node 20 (Vercel) |
| Database | Supabase Postgres |
| Auth | Supabase Auth (customer + admin in one system; admin MFA required) |
| Storage | Supabase Storage (product images, label images) |
| Deployment | Vercel |
| Styling | Tailwind CSS (tokens extracted from `docs/reference/vitaminaty-prototype.html`) |
| Forms | React Hook Form + Zod |
| Tests | Vitest (unit/integration) + Playwright (e2e) |
| Email | Stub provider in M0–M6, Resend from M7 |
| Rate limiting | Upstash Redis (production), in-memory (development) |
| Payments | `PaymentAdapter` interface with stub implementation; real Paymob in M5 |
| Shipping | `ShippingAdapter` interface with stub implementation; real iCarry in M6 |
| Feature flags | Database-backed (Supabase table) with env-var escape hatch |
| AI support | `SupportChatProvider` interface with null implementation; real AI in post-MVP milestone |

## 4. Established patterns (respected by every milestone)

M0 Step 1 confirmation: these patterns remain accurate. This step added only the application skeleton, placeholder modules, and root configuration; no business logic or boundary-enforcement changes were introduced.

- **Server actions first.** All mutations go through Next.js Server Actions in `src/features/{feature}/actions.ts`. No standalone REST API routes for app-internal data; `/api/` is reserved for webhooks, health, sitemap.
- **Repository layer is the only DB access point.** Service-role Supabase client lives in `src/lib/supabase/server.ts` and is imported only by `src/server/repositories/*`. Everything else uses the repository functions.
- **All money is whole-AED integers.** Type `AedAmount` in `src/lib/money/aed.ts`. No float arithmetic on money anywhere.
- **All env vars accessed through env loaders.** Server-only env goes through `src/lib/env.ts`; client-safe public env goes through `src/lib/env.public.ts`. Both are Zod-validated. Implemented in Step 2.
- **Logger with explicit redaction list.** Structured logs flow through `src/lib/logger.ts`, which exports the auditable `REDACTION_KEYS` set and redacts secrets, PII keys, JWT-like values, Supabase key-like values, and PEM blocks. Implemented in Step 3.
- **All slugs immutable once published.** Slug history table tracks old → new slug for 301 redirects.
- **Audit log entries written for every admin mutation.** Centralized through `src/server/services/audit-service.ts`.
- **Feature flags evaluated centrally.** No env-var sniffing for feature toggles outside `src/features/feature-flags/eval.ts`.
- **Adaptive product rendering follows v1.1 Cases A–G.** See `docs/PRODUCT_CONTENT_SPEC_v1.1_ADMIN_DRIVEN.md` §7.
- **PDP sections render only if data exists.** No empty placeholders, no "coming soon" labels on public side. Admin preview is the exception.
- **All cart state untrusted at checkout.** Server revalidates prices, stock, totals, VAT, delivery before order creation.
- **HIGH_RIGOR domains in play:** payments, auth, secrets, PII, production data paths. Cryptographic primitives fire on webhook verification + idempotency.

## 5. Key files (M0)

| Path | Purpose |
|---|---|
| `package.json` | Foundation scripts and Next.js 15 / React 19 / Tailwind dependency set. |
| `pnpm-lock.yaml` | Locked dependency graph for the M0 foundation. |
| `.gitignore` | Keeps local env files, build outputs, and generated artifacts out of Git. |
| `.editorconfig` | Shared editor defaults. |
| `.prettierrc` | Prettier formatting policy. |
| `.prettierignore` | Prevents broad spec/reference formatting churn during M0. |
| `.eslintrc.json` | Next.js + TypeScript lint config with Step 2 import-boundary and direct-env-read restrictions. |
| `next.config.ts` | Minimal Next.js config with default security posture preserved and build-time env validation. |
| `postcss.config.mjs` | Tailwind CSS + Autoprefixer PostCSS config. |
| `tailwind.config.ts` | Tailwind theme extensions mirroring prototype design tokens. |
| `tsconfig.json` | Strict TypeScript config with `@/*` path alias. |
| `next-env.d.ts` | Conventional Next.js type references for local typechecking. |
| `src/app/layout.tsx` | Root App Router layout. |
| `src/app/page.tsx` | M0 placeholder homepage proving Tailwind tokens are active. |
| `src/app/globals.css` | Tailwind base plus verbatim prototype `:root` custom properties. |
| `src/app/not-found.tsx` | Placeholder 404 boundary. |
| `src/app/error.tsx` | Placeholder root error boundary. |
| `src/lib/env.ts` | Type-safe, Zod-validated server env access with structured multi-error reporting. |
| `src/lib/env.public.ts` | Client-safe `NEXT_PUBLIC_*` env split. |
| `src/lib/supabase/server.ts` | Service-role Supabase client. Server-only and repository-only by ESLint boundary. |
| `src/lib/supabase/client.ts` | Anon Supabase browser client for client-side, RLS-enforced use. |
| `src/lib/supabase/middleware.ts` | Supabase SSR session refresh helper. |
| `src/middleware.ts` | Next.js middleware wiring session refresh outside `/_next/*` and `/api/health`. |
| `tests/unit/env.test.ts` | Env validation tests for missing required vars, enum validation, and public/server split. |
| `src/lib/money/aed.ts` | TODO(M3) placeholder for AED integer money primitives. |
| `src/lib/money/vat.ts` | TODO(M3) placeholder for VAT calculation primitives. |
| `src/lib/logger.ts` | Structured logger with explicit secret and PII redaction. |
| `src/lib/__tests__/logger.test.ts` | Logger redaction, level filtering, and request-context tests. |
| `src/features/feature-flags/flags.ts` | TODO(M2) placeholder for feature flag definitions. |
| `src/features/feature-flags/eval.ts` | TODO(M2) placeholder for runtime feature flag evaluation. |
| `src/lib/paymob/adapter.ts` | TODO(M5) placeholder for `PaymentAdapter` interface. |
| `src/lib/paymob/stub-adapter.ts` | TODO(M5) placeholder for stub Paymob implementation for M0–M4. |
| `src/lib/icarry/adapter.ts` | TODO(M6) placeholder for `ShippingAdapter` interface. |
| `src/lib/icarry/stub-adapter.ts` | TODO(M6) placeholder for stub iCarry implementation for M0–M5. |
| `src/features/support-chat/provider.ts` | TODO(P1) placeholder for `SupportChatProvider` interface. |
| `src/features/support-chat/null-provider.ts` | TODO(P1) placeholder for null support chat implementation. |
| `docs/PROJECT_STATE.md` | This file. |
| `docs/LAST_SESSION.md` | What just happened. |
| `docs/THREAT_MODEL.md` | Security threat model. |
| `docs/reference/vitaminaty-prototype.html` | Design source-of-truth prototype. |
| `docs/reference/product.md` | Grouped catalog import source. |

## 6. Known issues / open questions

None yet. Will accumulate as milestones progress.

## 7. What is intentionally not built yet (and which milestone owns it)

| Surface | Milestone |
|---|---|
| Database schema | M1 |
| MD catalog import script | M1 |
| Admin portal (auth, product editor, image uploader) | M2 |
| Public catalog pages (listing, brand, search, PDP) | M3 |
| Cart & checkout (stubbed payments) | M4 |
| Paymob real integration | M5 |
| iCarry real integration | M6 |
| Order management + email transactionals | M7 |
| Soft-launch polish (RTL, perf, a11y, monitoring) | M8 |
| Real AI support assistant | Post-MVP |
| Real reviews system | Post-MVP |
| Real promo code engine | Post-MVP |
| Arabic content translation | Post-MVP |
| B2B / wholesale portal | Post-MVP |

## 8. Public launch readiness checklist (from the spec — gate on all)

- [ ] Public catalog works (M3 complete)
- [ ] Admin product publishing works (M2 complete)
- [ ] Cart works (M4 complete)
- [ ] Checkout works (M4 complete)
- [ ] Paymob real integration tested (M5 complete)
- [ ] iCarry workflow tested or safely stubbed (M6 complete or accepted-stub)
- [ ] Order records work (M7 complete)
- [ ] Admin order management works (M7 complete)
- [ ] Transactional emails work (M7 complete)
- [ ] HIGH_RIGOR cross-check passed for payments, auth, PII (M5, M2, M3 cross-checks)
- [ ] Threat model reviewed against final implementation (M8)

Until every box ticks, the production deploy keeps the `commerce_enabled` feature flag off (or the site stays in private/staging mode).

---

_End of `PROJECT_STATE.md` v1.0. Last updated: 2026-05-22 by Step 3._
