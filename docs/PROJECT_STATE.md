# PROJECT_STATE.md

**Project:** Vitaminaty â€” UAE multi-brand supplement e-commerce
**Document version:** v1.0 (seeded for M0)
**Audience:** BOB v5 reads this every session to ground itself in current state.
**Update policy:** Updated by v5 or by the developer at the end of every milestone. Never let drift.

---

## 1. What Vitaminaty is

Vitaminaty is a UAE-based multi-brand online retailer for sports nutrition, vitamins, wellness, and healthy food products. It is **not** a brand. The M1 seed now contains 55 canonical brand records, with 44 matched by the current catalog import (Scitec, Applied Nutrition, Bucked Up, AllMax, Cellucor, NOW Foods, Natural Factors, etc.) sourced from authorized distributors. The catalog has 787 unique products imported from a grouped Markdown source (`docs/reference/product.md`).

The platform is admin-driven: products import with minimal data and are progressively enriched by the admin team through a purpose-built admin portal. The public site adapts to whatever data exists per product and never shows fake content.

M1 schema, RLS, reference seed data, repository-facing DB client surface, non-PII repositories, PII/operational repositories, canonical RLS regression tests, and the local admin auth seed script are landed: migrations 0001-0010 create the schema tables, enums, indexes, triggers, RLS policies, and reference seed rows; `src/server/db/*` wraps Supabase access for repositories; `tests/integration/repositories/rls-cross-checks.test.ts` encodes the M1 RLS cross-checks with real signed Supabase sessions; `scripts/seed-admin-user.ts` idempotently creates the initial Auth-only admin user.

## 2. Current milestone

**M1 - Data layer: COMPLETE (shipped 2026-05-23). Next: M1 addendum migration 0012 (inventory tracking) -> then M2 - Admin portal.**

M0 is complete. M1 Step 1 housekeeping/recon is complete. M1 Step 2 schema migrations 0001-0008 are authored and applied locally. M1 Step 3 RLS policies in `0009_rls_policies.sql` are authored and applied locally. M1 Step 4 reference seed data in `0010_seed.sql` is authored and applied locally. M1 Step 5 repository-facing Supabase DB wrappers, generated schema types, and bundle secret scan are implemented. M1 Step 6 non-PII repositories are implemented. M1 Step 7 PII and operational repositories are implemented, append-only event repositories are split into dedicated files, and the canonical `rls-cross-checks.test.ts` suite passes. M1 Step 8 import script is lint-clean and recovered after meta-model-blessed brand seed expansion: 787 products import with 44 distinct matched brands. M1 Step 9 admin seed script is implemented and verified locally. M1 Final Audit recovery added `0011_wholesale_revoke_writes.sql` and a column-privilege regression assertion. M1 Final Audit rerun passed; M1 is shipped. The next pre-M2 task is the HIGH_RIGOR M1 addendum migration `0012_inventory.sql`.

### 2.1 Spec evolution log

**2026-05-23 â€” Inventory tracking added as MVP scope (spec evolution chat).**

The meta-model and human owner expanded MVP scope to include inventory tracking after the M1 Final Audit. Key outputs:

- New file: `docs/INVENTORY_SPEC.md` â€” canonical inventory tracking spec covering the schema additions, storefront display rules, checkout transaction semantics, and restoration triggers.
- Updated: `docs/ADMIN_PORTAL_SPEC.md` â€” added Â§4 dashboard expansion, Â§5.3 bulk-operation safeguards (including case_pack hard-block carveout), Â§5.4â€“5.13 admin UX enhancements (spreadsheet edit, side drawer, work queues, save & next, keyboard shortcuts, command bar, drawer image upload, optimistic concurrency, composed filters, progress indicator), Â§10 inventory editing surfaces, Â§12.1 audit-log diff view.
- Updated: `docs/DB_SCHEMA.md` â€” added `stock_status` and `inventory_movement_reason` ENUMs to Â§3 catalog, swapped `product_variants.in_stock` boolean for `stock_status` enum + trigger-computed in Â§5.2, added `inventory_movements` table to Â§8.4, added RLS to Â§9.10, documented 0011 (already shipped) + 0012 (planned) in Â§10 migration sequence.
- Updated: `docs/API_SPEC.md` â€” added six admin inventory endpoints to Â§3.1, clarified cart revalidation overall_status shape in Â§2.1, expanded placeOrder server flow in Â§2.2 to spell out the SELECT FOR UPDATE + trigger-driven stock_status + inventory_movements write inside the same transaction.
- Updated: `docs/proj_spec.md` â€” Â§3 non-goal split (only automation/sync is non-goal; tracking is MVP); Â§9 P8 row expanded; Â§M1 gains addendum migrations note; Â§M2 gains inventory editing UX scope; Â§M3 gains storefront stock display scope; Â§M4 cross-check tightened; Â§M7 gains restoration flow scope.
- Updated: `docs/PRODUCT_CONTENT_SPEC_v1.1_ADMIN_DRIVEN.md` â€” Â§5.4 adds 9th flag `missing_stock_quantity` with derivation rule; Â§22.1 completion_score formula penalty term widened (9 Ã— 5 = 45 max); Â§23.1 filter chip list adds the new flag + stock_status single-select.

Migration routing: the addendum migration `0012_inventory.sql` lands at the end of the M1 series before M2 begins. It is HIGH_RIGOR (production data path + schema mutation on the already-imported 787 products + new RLS on a new table) and runs CODEX-only per the project's executor constraint. The CODEX prompt for the 0012 addendum is at `docs/M1_ADDENDUM_0012_PROMPT.md`.

**Open product decisions resolved in this round** (all locked, all referenced in `INVENTORY_SPEC.md Â§2`):
- Q1a/Q1b: hard decrement at order creation; no reservation timeout at MVP.
- Q2: low-stock badge only on storefront; no exact counts to public.
- Q3: backorders dropped at MVP; `stock_status` is 3-value enum.
- Q4: variants mandatory for `status='published'`; not for imported.
- Q5: single-step manual stock adjustment with audit + movement log.
- Q6: pre-publish stock is real, not phantom.
- Q7: `missing_stock_quantity` as 9th admin_review_flag; backfilled in 0012.
- Q8: `in_stock` boolean dropped; `stock_status` enum replaces it.
- Q9: `inventory_movements` write inside same transaction as order creation.
- Q10: reason enum has both `manual_adjustment` (general) and `stock_recount` (counted-discrepancy workflow); plus `payment_failed` distinct from `order_cancelled`.
- Q11: low_stock_threshold is per-variant (confirmed; schema already had it).
- Q12: bulk publish review-flag override is soft for most flags; **hard-block carveout for `case_pack=true`** (per PRODUCT_CONTENT_SPEC Â§18.2).
- Q13: `inventory_movements.order_id` FK uses `ON DELETE SET NULL` (preserves immutable history); table is append-only with no UPDATE/DELETE RLS policies (matches `payment_events`/`shipment_events`/`audit_log`).
- Q14: `stock_status` is stored with a trigger that fires on INSERT/UPDATE of `stock_quantity` or `low_stock_threshold`; indexed for storefront and admin queue queries.

## 3. Stack â€” locked

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) + TypeScript |
| Runtime | Node 22 (Vercel) |
| Database | Supabase Postgres |
| Auth | Supabase Auth (customer + admin in one system; admin MFA required) |
| Storage | Supabase Storage (product images, label images) |
| Deployment | Vercel |
| Styling | Tailwind CSS (tokens extracted from `docs/reference/vitaminaty-prototype.html`) |
| Forms | React Hook Form + Zod |
| Tests | Vitest (unit/integration) + Playwright (e2e) |
| Email | Stub provider in M0â€“M6, Resend from M7 |
| Rate limiting | Upstash Redis (production), in-memory (development) |
| Payments | `PaymentAdapter` interface with stub implementation; real Paymob in M5 |
| Shipping | `ShippingAdapter` interface with stub implementation; real iCarry in M6 |
| Feature flags | Database-backed (Supabase table) with env-var escape hatch |
| AI support | `SupportChatProvider` interface with null implementation; real AI in post-MVP milestone |

## 4. Established patterns (respected by every milestone)

M0 Step 1 confirmation: these patterns remain accurate. This step added only the application skeleton, placeholder modules, and root configuration; no business logic or boundary-enforcement changes were introduced.

- **Server actions first.** All mutations go through Next.js Server Actions in `src/features/{feature}/actions.ts`. No standalone REST API routes for app-internal data; `/api/` is reserved for webhooks, health, sitemap.
- **Repository layer is the only DB access point.** Service-role Supabase access is repository-only. M0 `src/lib/supabase/server.ts` remains restricted; M1 repository-facing service-role access is `src/server/db/supabase-admin.ts`. Everything else uses repository functions.
- **Repository-facing DB clients.** Repository-facing DB clients live at `src/server/db/supabase-admin.ts` (service-role) and `src/server/db/supabase-server.ts` (per-request anon with cookie context). M0 `src/lib/supabase/*` clients remain as underlying implementation.
- **Repository admin/public split.** Repositories live at `src/server/repositories/`. Admin-scoped reads and writes for an entity live in a sibling `*-admin-repository.ts` file (for example, `product-admin-repository.ts`, `brand-admin-repository.ts`). The plain `*-repository.ts` files contain only public/customer-facing reads. Directory-level greps discriminate admin vs public paths by file suffix. `wholesale_price_internal` may appear only inside `*-admin-repository.ts` files. Variants/images/goal_tags/slug_history are grouped under `product-repository.ts` (public sub-exports) and `product-admin-repository.ts` (admin sub-exports); no separate file per child table.
- **PII repository split.** Customer-facing `customer-repository.ts`, `order-repository.ts`, and `support-chat-repository.ts` use RLS-enforced anon/session clients. Service-role paths for bootstrap, checkout/admin writes, and support inserts live in `customer-admin-repository.ts`, `order-admin-repository.ts`, and `support-chat-admin-repository.ts`.
- **Append-only event repositories.** Append-only ledgers live in dedicated files: `payment-event-repository.ts`, `shipment-event-repository.ts`, and `audit-log-repository.ts`. Each declares a top-of-file Authz model comment and exposes append plus admin read functions, with no update/delete exports.
- **Canonical RLS regression suite.** `tests/integration/repositories/rls-cross-checks.test.ts` encodes the M1 RLS cross-checks. It uses `createTestCustomerWithSession()` from `tests/fixtures/customers.ts` so every `auth.uid()` assertion runs through a real signed Supabase session, never `set_config('request.jwt.claims', ...)`. It re-seeds the admin user idempotently at suite start so the test survives `supabase db reset`.
- **Bundle secret scan.** Bundle secret scan is implemented at `scripts/scan-bundle-secrets.sh`. It reads the live 130+ char prefix of `SUPABASE_SERVICE_ROLE_KEY` from `.env.local` and greps `.next/` for that VALUE prefix. Scanning for the env-var NAME is forbidden (false positive - name appears legitimately via env.ts Zod refs).
- **Local-only Supabase scripts load from CLI status.** One-shot scripts that must never hit remote Supabase read local credentials from `pnpm exec supabase status -o env` at runtime and refuse non-local URLs, rather than trusting possibly stale `.env.local` Supabase values.
- **All money is whole-AED integers.** Type `AedAmount` in `src/lib/money/aed.ts`. No float arithmetic on money anywhere.
- **Money math via `src/lib/money/aed.ts`.** AED values use a branded whole-integer type, with VAT-inclusive breakdown in `src/lib/money/vat.ts`.
- **All env vars accessed through env loaders.** Server-only env goes through `src/lib/env.ts`; client-safe public env goes through `src/lib/env.public.ts`. Both are Zod-validated. Implemented in Step 2.
- **Logger with explicit redaction list.** Structured logs flow through `src/lib/logger.ts`, which exports the auditable `REDACTION_KEYS` set and redacts secrets, PII keys, JWT-like values, Supabase key-like values, and PEM blocks. Implemented in Step 3.
- **Adapter pattern.** Payment, shipping, and support chat each expose stable interfaces plus stub/null implementations and selector functions. Implemented in Step 5.
- **All slugs immutable once published.** Slug history table tracks old â†’ new slug for 301 redirects.
- **Audit log entries written for every admin mutation.** Centralized through `src/server/services/audit-service.ts`.
- **Feature flags evaluated centrally.** No env-var sniffing for feature toggles outside `src/features/feature-flags/eval.ts`. Implemented in Step 6 with `FF_*` env override, repository lookup, then default fallback.
- **Database schema authored verbatim from DB_SCHEMA.md.** Migrations under `supabase/migrations/` follow `docs/DB_SCHEMA.md` Section 10 4-digit numeric order.
- **Reference data in migrations.** M1 reference data lives in `supabase/migrations/0010_seed.sql` with `ON CONFLICT` idempotency. The prepared `supabase/seed/feature-flags.sql` remains as a cited source, but reset/apply is driven by the migration.
- **M1 RLS-active pattern.** RLS is active on every public M1 table; `is_admin()` is the single DB role-check predicate for admin policies.
- **M1 RLS prose-derived policies.** Policies for `product_variants`, `product_images`, `product_goal_tags`, `slug_history`, `categories`, `goals`, and `md_category_mapping` are authored from DB_SCHEMA.md Section 9 prose and require Step 3 cross-check blessing.
- **Goals and md_category_mapping public read.** Goals and md_category_mapping have unrestricted public read (`USING (true)`) because they are non-sensitive reference data with no visibility flag. Future schema changes that add sensitive columns to these tables must add column-level REVOKEs or replace the policy.
- **Slug history public read.** `slug_history` public read is gated on parent product being currently published. Unpublishing a product makes its slug history invisible to anon. M3 slug-redirect logic must be aware of this.
- **M1 wholesale column isolation.** `products.wholesale_price_internal` uses column-subset SELECT grants for anon/authenticated plus service-role-only access to the wholesale column; local psql reports denied reads as table-level permission denial, while Supabase/Postgres enforcement still prevents access.
- **M1 Final Audit recovery cross-check verdicts.** Step 2 schema migrations: clean after `supabase db reset`; Step 3 RLS policies: clean with documented wholesale denial wording; Step 5 DB wrappers/bundle scan: clean value-prefix scan; Step 7 recovery: clean canonical `rls-cross-checks.test.ts` suite with real signed sessions.
- **Wholesale column write isolation.** `0011_wholesale_revoke_writes.sql` revokes anon/authenticated table-level write/reference grants on `products` plus column-level INSERT/UPDATE/REFERENCES on `wholesale_price_internal`; service-role repositories retain import/admin write access.
- **Adaptive product rendering follows v1.1 Cases Aâ€“G.** See `docs/PRODUCT_CONTENT_SPEC_v1.1_ADMIN_DRIVEN.md` Â§7.
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
| `.github/workflows/ci.yml` | GitHub Actions CI pipeline for typecheck, lint, format-check, build, and tests. |
| `vercel.json` | Vercel Next.js project config pinned to `fra1` region. |
| `next.config.ts` | Minimal Next.js config with default security posture preserved and build-time env validation. |
| `postcss.config.mjs` | Tailwind CSS + Autoprefixer PostCSS config. |
| `tailwind.config.ts` | Tailwind theme extensions mirroring prototype design tokens. |
| `tsconfig.json` | Strict TypeScript config with `@/*` path alias. |
| `next-env.d.ts` | Conventional Next.js type references for local typechecking. |
| `src/app/layout.tsx` | Root App Router layout. |
| `src/app/(public)/layout.tsx` | Public route-group wrapper with server-evaluated support chat visibility. |
| `src/app/page.tsx` | M0 placeholder homepage proving Tailwind tokens are active. |
| `src/app/globals.css` | Tailwind base plus verbatim prototype `:root` custom properties. |
| `src/app/not-found.tsx` | Placeholder 404 boundary. |
| `src/app/error.tsx` | Placeholder root error boundary. |
| `src/lib/env.ts` | Type-safe, Zod-validated server env access with structured multi-error reporting. |
| `src/lib/env.public.ts` | Client-safe `NEXT_PUBLIC_*` env split. |
| `src/lib/supabase/server.ts` | Service-role Supabase client. Server-only and repository-only by ESLint boundary. |
| `src/lib/supabase/client.ts` | Anon Supabase browser client for client-side, RLS-enforced use. |
| `src/lib/supabase/middleware.ts` | Supabase SSR session refresh helper. |
| `src/server/db/supabase-admin.ts` | M1 repository-facing service-role Supabase client wrapper. |
| `src/server/db/supabase-server.ts` | M1 repository-facing per-request anon Supabase client with cookie context and RLS enforcement. |
| `src/lib/supabase/types.generated.ts` | Generated Supabase TypeScript schema types from local migrations. |
| `scripts/scan-bundle-secrets.sh` | Client bundle scan for the live service-role key VALUE prefix, never the env-var name. |
| `scripts/seed-admin-user.ts` | M1 Step 9 local-only Auth admin seed script; idempotent and password never logged. |
| `scripts/README.md` | Operator notes for one-shot scripts, including admin seed env requirements and M2 MFA handoff. |
| `src/middleware.ts` | Next.js middleware wiring session refresh outside `/_next/*` and `/api/health`. |
| `src/app/api/health/route.ts` | Unauthenticated healthcheck returning status, git SHA, app env, and timestamp. |
| `tests/unit/env.test.ts` | Env validation tests for missing required vars, enum validation, and public/server split. |
| `src/lib/rate-limit.ts` | RateLimiter interface with in-memory implementation and Upstash stub. |
| `src/lib/errors.ts` | Stable application error classes and `isAppError` helper. |
| `src/lib/slug.ts` | Product slug generation and pure collision suffix helpers. |
| `src/lib/idempotency.ts` | M4 stub locking the idempotency-key derivation convention. |
| `src/lib/crypto.ts` | M5 stub locking HMAC and hashing helper signatures. |
| `src/lib/money/aed.ts` | Branded whole-integer AED type and arithmetic helpers. |
| `src/lib/money/vat.ts` | VAT-inclusive 5% net/VAT breakdown using banker's rounding. |
| `src/lib/money/format.ts` | AED display formatting helper. |
| `src/lib/logger.ts` | Structured logger with explicit secret and PII redaction. |
| `src/lib/__tests__/logger.test.ts` | Logger redaction, level filtering, and request-context tests. |
| `src/lib/__tests__/money.test.ts` | AED money and VAT primitive tests. |
| `src/lib/__tests__/slug.test.ts` | Product slug generation and collision suffix tests. |
| `src/lib/__tests__/errors-rate-limit.test.ts` | App error and rate limiter tests. |
| `src/lib/__tests__/stubs.test.ts` | Idempotency and crypto future-stub tests. |
| `src/lib/validation/product.ts` | Zod schemas for product create/update and field-status updates. |
| `src/lib/validation/order.ts` | Zod schemas for order creation and status transitions. |
| `src/lib/validation/address.ts` | Zod schema for UAE addresses and phone format. |
| `src/lib/validation/webhook-payloads.ts` | M5/M6 webhook payload schema placeholders. |
| `src/lib/__tests__/validation.test.ts` | Validation schema tests. |
| `src/lib/__tests__/adapters.test.ts` | Payment, shipping, and support-chat adapter stub tests. |
| `src/types/product.ts` | Product, variant, image, goal-tag, slug-history, field-status, content, and label-data shared types. |
| `src/types/brand.ts` | Brand shared type. |
| `src/types/category.ts` | Category, goal, and MD category mapping shared types. |
| `src/types/order.ts` | Order and order-item shared types. |
| `src/types/cart.ts` | Cart line and revalidation shared types. |
| `src/types/address.ts` | UAE address shared types. |
| `src/types/customer.ts` | Customer shared type. |
| `src/types/admin.ts` | Admin user shared type skeleton. |
| `src/types/payment.ts` | Payment method, status, and event shared types. |
| `src/types/shipment.ts` | Shipment status and record shared types. |
| `src/types/audit-log.ts` | Audit log shared type. |
| `src/types/feature-flag.ts` | Feature flag shared type. |
| `src/types/support-chat.ts` | Support chat conversation/message shared types. |
| `src/features/feature-flags/flags.ts` | Decision 4 feature flag definitions and defaults. |
| `src/features/feature-flags/eval.ts` | Runtime flag evaluation with `FF_*` override, repository lookup, and default fallback. |
| `src/features/feature-flags/admin-actions.ts` | TODO(M2) placeholder for admin flag-toggle server actions. |
| `src/features/feature-flags/__tests__/eval.test.ts` | Feature flag inventory and precedence tests. |
| `src/server/repositories/product-repository.ts` | M1 public product repository reads, including variants/images/goal_tags/slug_history public sub-exports. |
| `src/server/repositories/product-admin-repository.ts` | M1 admin product reads/writes, wholesale column access, and Step 8 bulk import upsert path. |
| `src/server/repositories/brand-repository.ts` | M1 public brand repository reads. |
| `src/server/repositories/brand-admin-repository.ts` | M1 admin brand mutations. |
| `src/server/repositories/category-repository.ts` | M1 category and MD category mapping repository reads plus small admin category update surface. |
| `src/server/repositories/goal-repository.ts` | M1 goal reference repository reads. |
| `src/server/repositories/feature-flag-repository.ts` | M1 feature flag repository backed by Supabase with public reads and admin update helper. |
| `tests/integration/repositories/non-pii-repositories.test.ts` | M1 Step 6 local Supabase integration tests for non-PII repositories. |
| `src/server/repositories/customer-repository.ts` | M1 Step 7 RLS-enforced customer profile and address reads/writes. |
| `src/server/repositories/customer-admin-repository.ts` | M1 Step 7 service-role customer bootstrap/admin helpers for listing, finding, upserting, and updating `customers` rows. |
| `src/server/repositories/order-repository.ts` | M1 Step 7 RLS-enforced customer order and order-item reads. |
| `src/server/repositories/order-admin-repository.ts` | M1 Step 7 service-role order and order item helpers. |
| `src/server/repositories/payment-event-repository.ts` | M1 Step 7 recovery append-only payment event append/read helpers. |
| `src/server/repositories/shipment-event-repository.ts` | M1 Step 7 recovery append-only shipment event append/read helpers. |
| `src/server/repositories/audit-log-repository.ts` | M1 Step 7 recovery append-only audit append/read helpers. |
| `src/server/repositories/support-chat-repository.ts` | M1 Step 7 RLS-enforced customer reads for `support_conversations` and `support_messages`. |
| `src/server/repositories/support-chat-admin-repository.ts` | M1 Step 7 service-role writes/reads for `support_conversations` and `support_messages`. |
| `src/server/repositories/admin-repository.ts` | M1 Step 7 Supabase Auth admin role helper surface. |
| `tests/integration/repositories/pii-repositories.test.ts` | M1 Step 7 local Supabase integration tests for PII RLS and service-role operational paths. |
| `tests/integration/repositories/rls-cross-checks.test.ts` | M1 Step 7 recovery canonical RLS cross-check suite with five assertions and paired sanity checks. |
| `tests/fixtures/customers.ts` | M1 Step 7 recovery real Supabase Auth customer session fixture for RLS tests. |
| `src/components/chat/ChatBubble.tsx` | Client support chat placeholder bubble controlled by server-evaluated visibility prop. |
| `src/lib/paymob/types.ts` | Paymob adapter domain types. |
| `src/lib/paymob/adapter.ts` | `PaymentAdapter` interface. |
| `src/lib/paymob/stub-adapter.ts` | Stub payment adapter for M0â€“M4. |
| `src/lib/paymob/index.ts` | Payment adapter selector. |
| `src/lib/icarry/types.ts` | iCarry adapter domain types. |
| `src/lib/icarry/adapter.ts` | `ShippingAdapter` interface. |
| `src/lib/icarry/stub-adapter.ts` | Stub shipping adapter for M0â€“M5. |
| `src/lib/icarry/index.ts` | Shipping adapter selector. |
| `src/features/support-chat/provider.ts` | `SupportChatProvider` interface. |
| `src/features/support-chat/null-provider.ts` | Null support chat provider. |
| `src/features/support-chat/safety-boundaries.ts` | Support chat safety scope and refusal text constants. |
| `src/features/support-chat/index.ts` | Support chat provider selector. |
| `supabase/migrations/0001_extensions_and_enums.sql` | M1 Step 2 extensions and enum types migration. |
| `supabase/migrations/0002_reference_tables.sql` | M1 Step 2 brands, categories, md_category_mapping, and goals migration. |
| `supabase/migrations/0003_products.sql` | M1 Step 2 products, variants, images, goal tags, slug history, and update trigger migration. |
| `supabase/migrations/0004_customers_addresses.sql` | M1 Step 2 customers and addresses migration. |
| `supabase/migrations/0005_orders.sql` | M1 Step 2 orders and order_items migration. |
| `supabase/migrations/0006_events.sql` | M1 Step 2 payment_events and shipment_events migration. |
| `supabase/migrations/0007_operations.sql` | M1 Step 2 audit_log and feature_flags migration. |
| `supabase/migrations/0008_support_chat.sql` | M1 Step 2 support_conversations and support_messages migration. |
| `supabase/migrations/0009_rls_policies.sql` | M1 Step 3 RLS policies, `is_admin()`, append-only ledger read policies, and wholesale column isolation migration. |
| `supabase/migrations/0010_seed.sql` | M1 Step 4 categories, goals, MD category mapping, brands, and feature flag seed migration. |
| `supabase/migrations/0011_wholesale_revoke_writes.sql` | M1 Final Audit recovery migration revoking anon/authenticated write/reference privileges on `products.wholesale_price_internal` and table-level product writes. |
| `supabase/seed/feature-flags.sql` | Prepared default feature flag seed source; inlined into `0010_seed.sql` for migration-driven resets. |
| `docs/PROJECT_STATE.md` | This file. |
| `docs/LAST_SESSION.md` | What just happened. |
| `docs/THREAT_MODEL.md` | Security threat model. |
| `docs/reference/vitaminaty-prototype.html` | Design source-of-truth prototype. |
| `docs/reference/product.md` | Grouped catalog import source. |

## 6. Known issues / open questions

Verification debt carried into M1 from the M0 final audit:
- CLEARED IN M1 STEP 4: `feature_flags` table DDL folded into `supabase/migrations/0007_operations.sql`; stale `supabase/migrations/0005_feature_flags.sql` removed; feature flag defaults inlined into `supabase/migrations/0010_seed.sql`.
- CLEARED IN M1 STEP 1: `src/middleware.ts` (root file) needs a one-line authz comment (Step 2 cross-check carry-forward).
- CLEARED IN M1 STEP 1: `requiredSecret` in `src/lib/env.ts` hardened with `.trim()` to protect against accidental whitespace in pasted secrets.
- DEFERRED TO M3: Middleware matcher in `src/middleware.ts` should be optimized to exclude static asset paths.
- CLEARED IN M1 STEP 1: Bundle secret scans must use prefixes â‰¥130 chars when scanning for Supabase JWT-shaped secrets (anon and service_role share header prefix until char position ~110). 8-char prefix scans are useless for JWTs. Forensic dive during M0 Final Audit confirmed: original 8-char hit was prefix collision with the public anon key, no actual leak. Documented in `THREAT_MODEL.md` for M5 webhook verification work.
- DEVIATION FOR STEP 3 CROSS-CHECK: DB_SCHEMA.md Section 9 authorizes `REVOKE SELECT (wholesale_price_internal)`, but Postgres table-level SELECT grants are additive and cannot be subtractively denied per column. `0009_rls_policies.sql` therefore revokes table SELECT on `products` from anon/authenticated and grants SELECT back on every non-wholesale column. The negative test denies access, but local psql reports `permission denied for table products` rather than `permission denied for column wholesale_price_internal`.
- CLEARED AFTER M1 FINAL AUDIT RECOVERY STEP C: M1 Step 8 brand coverage recovered. The original §12.2 30-brand seed matched only 19 distinct `brand_id` values. 25 additional canonical brands were added under meta-model blessing on 2026-05-23. Final import count: 787 products, 55 seeded brands, 44 distinct matched brands, 18 `brand_id IS NULL` rows.
- DEVIATION FOR M1 STEP 8 BRAND SEED: 11 §12.2 canonical brands (`Dymatize`, `EAS`, `GAT Sport`, `Hi-Tech Pharmaceuticals`, `Hydroxycut`, `iSatori`, `MuscleMeds`, `Mutant`, `QNT`, `SuperHuman`, `USPlabs`) are seeded but have zero matching products in the current catalog snapshot. They are retained in seed for future M2 admin inventory additions.
- DEVIATION FOR M1 STEP 8 SOURCE QUALITY: Source MD contains product rows with `brand_raw` values that are flavor/product-type strings or ambiguous pseudo-brands (`SKITTLES`, `MILKY CHOCOLATE`, `MACA COFFEE`, `MICRO GROUND COFFEE`, `PREMIUM NUTRITION`, `RC`, etc.). These remain `brand_id=NULL` with `needs_brand_review=true` for M2 admin resolution.
- DEVIATION FOR M1 STEP 8 COUNT DRIFT: `missing_price=369` is within the Step 8 DoD ±10 envelope but outside the original spec's ±5 expected-shift envelope around ~360. The import treats source `N/A` values and one non-integer price as missing to preserve integer-AED schema safety; PRODUCT_CONTENT_SPEC §3 records this as the canonical post-import count.
- CLEARED AFTER M1 FINAL AUDIT RECOVERY STEP A: `scripts/import-products-from-md.ts` no longer reads or mutates `process.env`; repo-wide `pnpm lint` passes. Step 9 admin seed idempotency re-verified after the lint unblock.
- CLEARED AFTER M1 FINAL AUDIT RECOVERY STEP 7: Append-only payment and shipment event helpers were split from `order-admin-repository.ts` into dedicated event repository files; `audit-log-repository.ts` now uses the required append/read naming with no update/delete exports; `tests/integration/repositories/rls-cross-checks.test.ts` now encodes the five M1 RLS assertions with paired sanity checks and real signed Supabase sessions.
- CLEARED AFTER M1 FINAL AUDIT RECOVERY COLUMN REVOKE: `0011_wholesale_revoke_writes.sql` removes anon/authenticated write/reference grants from `products` and `wholesale_price_internal`; `rls-cross-checks.test.ts` now asserts anon/authenticated have zero column privileges for `wholesale_price_internal`.
- Vercel env matrix UI has a "wipe-on-edit" bug when editing per-environment values one at a time. Workaround: use Import .env with one file per environment, or use vercel CLI. Worth a runbook entry when M5 production env setup happens.

## 7. What is intentionally not built yet (and which milestone owns it)

| Surface | Milestone |
|---|---|
| Database schema | M1 |
| Feature flag table migration | Prepared in M0 Step 6; applied in M1 |
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

## 8. Public launch readiness checklist (from the spec â€” gate on all)

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

## 9. HIGH_RIGOR Surface

| Surface | Status |
|---|---|
| Production data paths | yes - schema, RLS, seed, DB wrappers, non-PII repositories, and PII/operational repositories landed |
| PII | yes - customers/addresses/orders tables created, RLS active, and repository tests cover owner isolation |
| RLS enforcement | active as of M1 Step 3 |
| Seed data | active as of M1 Step 4 |
| Non-PII repositories | active as of M1 Step 6; admin/public suffix split enforced by checks |
| PII repositories | active as of M1 Step 7 recovery; canonical RLS tests use real signed Supabase sessions and local service-role setup |
| Admin Auth seed | active as of M1 Step 9; Auth-only admin user uses `app_metadata.role='admin'` and no `customers` row |

## Recon — M1 entry — 2026-05-22

### supabase/migrations/ listing with first 5 lines

#### 0001_initial_schema.sql

```sql
-- TODO(M1): Initial schema migration.
```

#### 0002_products_brands_categories.sql

```sql
-- TODO(M1): Products, brands, and categories migration.
```

#### 0003_orders_cart_payments.sql

```sql
-- TODO(M1): Orders, cart, and payments migration.
```

#### 0004_audit_log.sql

```sql
-- TODO(M1): Audit log migration.
```

#### 0005_feature_flags.sql

```sql
-- M0 Step 6 prepares this migration only. Do not apply until M1.
-- Feature flags per DB_SCHEMA.md section 8.2 and DECISION_CAPTURE.md Decision 4.

CREATE TABLE IF NOT EXISTS feature_flags (
  key text PRIMARY KEY,
```

#### 0006_support_chat.sql

```sql
-- TODO(P1): Support chat migration.
```

#### 0007_rls_policies.sql

```sql
-- TODO(M1): RLS policies migration.
```

### supabase/migrations/0005_feature_flags.sql

```sql
-- M0 Step 6 prepares this migration only. Do not apply until M1.
-- Feature flags per DB_SCHEMA.md section 8.2 and DECISION_CAPTURE.md Decision 4.

CREATE TABLE IF NOT EXISTS feature_flags (
  key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  description text,
  category text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id),
  CHECK (category IN ('surface', 'feature', 'operational'))
);

ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION is_admin() RETURNS boolean AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
$$ LANGUAGE sql STABLE;

CREATE POLICY feature_flags_read ON feature_flags
  FOR SELECT TO authenticated, anon
  USING (true);

CREATE POLICY feature_flags_admin_write ON feature_flags
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

INSERT INTO feature_flags (key, enabled, description, category) VALUES
  ('public_storefront_enabled', false, 'Gate the public storefront until M3 sign-off.', 'surface'),
  ('admin_portal_enabled', true, 'Gate the admin portal surface.', 'surface'),
  ('commerce_enabled', false, 'Gate commerce paths until M5 payment sign-off.', 'surface'),
  ('customer_signup_enabled', false, 'Gate customer self-signup.', 'surface'),
  ('support_chat_enabled', false, 'Gate the support chat placeholder bubble.', 'surface'),
  ('cart_visible', false, 'Gate cart visibility.', 'feature'),
  ('checkout_enabled', false, 'Gate checkout entry points.', 'feature'),
  ('paymob_live_mode', false, 'Gate live Paymob processing.', 'feature'),
  ('icarry_live_mode', false, 'Gate live iCarry processing.', 'feature'),
  ('transactional_emails_enabled', false, 'Gate transactional email sends.', 'feature'),
  ('notify_me_enabled', false, 'Gate notify-me flows.', 'feature'),
  ('reviews_enabled', false, 'Gate reviews.', 'feature'),
  ('promo_codes_enabled', false, 'Gate promo codes.', 'feature'),
  ('wishlist_enabled', false, 'Gate wishlist.', 'feature'),
  ('arabic_rtl_enabled', false, 'Gate Arabic RTL surfaces.', 'feature'),
  ('same_day_delivery_enabled', false, 'Gate same-day delivery.', 'feature'),
  ('customer_mfa_enabled', false, 'Gate customer MFA.', 'feature'),
  ('maintenance_mode', false, 'Incident-only maintenance mode.', 'operational'),
  ('read_only_mode', false, 'Incident-only read-only mode.', 'operational'),
  ('feature_flag_admin_ui', true, 'Gate the admin feature-flag UI.', 'operational')
ON CONFLICT (key) DO UPDATE SET
  enabled = EXCLUDED.enabled,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  updated_at = now();
```

### supabase/seed/feature-flags.sql

```sql
-- Default feature flag values per DECISION_CAPTURE.md Decision 4.
-- M0 Step 6 prepares this seed file only. Do not apply until M1.

INSERT INTO feature_flags (key, enabled, description, category) VALUES
  ('public_storefront_enabled', false, 'Gate the public storefront until M3 sign-off.', 'surface'),
  ('admin_portal_enabled', true, 'Gate the admin portal surface.', 'surface'),
  ('commerce_enabled', false, 'Gate commerce paths until M5 payment sign-off.', 'surface'),
  ('customer_signup_enabled', false, 'Gate customer self-signup.', 'surface'),
  ('support_chat_enabled', false, 'Gate the support chat placeholder bubble.', 'surface'),
  ('cart_visible', false, 'Gate cart visibility.', 'feature'),
  ('checkout_enabled', false, 'Gate checkout entry points.', 'feature'),
  ('paymob_live_mode', false, 'Gate live Paymob processing.', 'feature'),
  ('icarry_live_mode', false, 'Gate live iCarry processing.', 'feature'),
  ('transactional_emails_enabled', false, 'Gate transactional email sends.', 'feature'),
  ('notify_me_enabled', false, 'Gate notify-me flows.', 'feature'),
  ('reviews_enabled', false, 'Gate reviews.', 'feature'),
  ('promo_codes_enabled', false, 'Gate promo codes.', 'feature'),
  ('wishlist_enabled', false, 'Gate wishlist.', 'feature'),
  ('arabic_rtl_enabled', false, 'Gate Arabic RTL surfaces.', 'feature'),
  ('same_day_delivery_enabled', false, 'Gate same-day delivery.', 'feature'),
  ('customer_mfa_enabled', false, 'Gate customer MFA.', 'feature'),
  ('maintenance_mode', false, 'Incident-only maintenance mode.', 'operational'),
  ('read_only_mode', false, 'Incident-only read-only mode.', 'operational'),
  ('feature_flag_admin_ui', true, 'Gate the admin feature-flag UI.', 'operational')
ON CONFLICT (key) DO UPDATE SET
  enabled = EXCLUDED.enabled,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  updated_at = now();
```

### package.json scripts

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint .",
  "typecheck": "tsc --noEmit",
  "format": "prettier --write .",
  "format:check": "prettier --check .",
  "test": "vitest run"
}
```

### Tooling state

- `pnpm exec supabase --version`: absent (`Command "supabase" not found`; exit 1).
- `pnpm exec tsx --version`: absent (`Command "tsx" not found`; exit 1).
- `which docker`: absent (`which` is unavailable in this PowerShell session; `docker` also not found by command lookup).
- `docker --version`: absent (`docker` command not found; exit 1).
- `src/lib/supabase/types.generated.ts`: exists today.

---

_End of `PROJECT_STATE.md` v1.0. Last updated: 2026-05-23 by M1 Final Audit recovery._

