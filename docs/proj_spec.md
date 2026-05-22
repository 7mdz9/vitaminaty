# proj_spec.md

**Project:** Vitaminaty — UAE multi-brand supplements e-commerce
**Document version:** v1.0
**Document type:** Master project specification (BOB v5 input)
**Tier:** 3 (large, multi-surface MVP)
**Greenfield:** Yes
**HIGH_RIGOR triggers active:** Payments · Auth/secrets/sessions · PII/PDPL · Production data paths · Cryptographic verification. (AI decisions trigger is structurally prepared but not active in MVP.)
**Status:** Final for M0 entry. Updated per milestone via `LAST_SESSION.md` and milestone-completion edits to this file.

---

## How v5 reads this file

This is the **index spec**. Each milestone section below has just enough scope, definition-of-done, cross-check, and invocation hint for v5 to execute that milestone as a single bounded task. The deep detail lives in the sub-spec files — v5 reads the sub-specs only for the milestone it's executing.

Per-session loading pattern:

1. Read `PROJECT_STATE.md` — current stack, patterns, key files.
2. Read `LAST_SESSION.md` — what happened last, what's blocked.
3. Read `THREAT_MODEL.md` — when HIGH_RIGOR fires.
4. Read **this file**, scroll to the milestone marked CURRENT.
5. Read the sub-spec files that milestone's section points to.
6. Read `CONTEXT_EXPANSION_NOTES.md` when working on M5, M6, or M8.
7. Execute. Update `LAST_SESSION.md` and `PROJECT_STATE.md` at the end of the session.

---

## 1. Problem statement

Vitaminaty needs a production e-commerce site for the UAE market that sells supplements from multiple brands. The catalog is large (~787 products), brand presentation matters, label content is the trust-builder, and the operational reality is that products will be enriched progressively by a small admin team — never all 787 at once, and never perfectly.

The system must:

- Sell only what's been explicitly enriched and published by admins.
- Never invent product information (no fake ingredients, no fake supplement facts, no fake reviews, no fake promotions, no medical claims).
- Handle UAE-only payments (Cards, Apple Pay, Tabby, Tamara, COD) via Paymob.
- Handle UAE-only delivery via iCarry (or a verified alternative).
- Comply with UAE PDPL for customer data.
- Survive the typical attack surface of a small e-commerce site.
- Be operable by a small team via an admin portal that doubles as the catalog enrichment workshop.

---

## 2. Goals

1. **Production-grade Next.js + Supabase + Vercel app** built from the design reference in `docs/reference/vitaminaty-prototype.html`.
2. **Admin-driven progressive enrichment** per `PRODUCT_CONTENT_SPEC_v1.1_ADMIN_DRIVEN.md` — 787 imported, enriched over time, published one at a time.
3. **Adapter-isolated integrations** for Paymob and iCarry, so stubs and real implementations are swappable behind a feature flag.
4. **Staged-capable from M0** via feature flags — surfaces and commerce can flip on independently as readiness gates pass.
5. **HIGH_RIGOR cross-checks** at M2, M3, M4, M5, M6, M7, M8 — payments and PII paths never ship without an explicit sign-off.
6. **Public launch as a gated event** — flipping `public_storefront_enabled + customer_signup_enabled + commerce_enabled + paymob_live_mode + icarry_live_mode + transactional_emails_enabled` together is the launch act, separate from any single milestone's completion.

---

## 3. Non-goals (MVP)

Explicitly out of scope per `DECISION_CAPTURE.md` and Phase 1 framing:

- Real AI customer support (structurally prepared per `AI_SUPPORT_FUTURE_SPEC.md`, not built)
- Real reviews system (empty state only)
- Real promo code / discount engine (UI hooks only)
- Same-day delivery (disabled by feature flag)
- Arabic content (RTL structural prep only; no translated copy)
- Mobile native apps (responsive web only)
- B2B / wholesale portal
- Warehouse automation / inventory sync
- Customer-side MFA (admin MFA only)
- GCC shipping outside UAE
- Multi-currency (AED only)
- Real Paymob/iCarry credentials in early milestones (stubs through M4)

---

## 4. Success criteria

The MVP is "ready to launch" when all of these are simultaneously true:

- [ ] M0–M8 milestones complete with HIGH_RIGOR cross-check sign-offs.
- [ ] At least 100 products published (full enrichment, all MVP fields complete).
- [ ] At least 5 brands have full brand pages (logos, descriptions, hero images).
- [ ] All 5 payment methods tested live in production with real (small) transactions.
- [ ] All shipping methods tested live in production with real shipments.
- [ ] Transactional email deliverability verified (DKIM/SPF/DMARC, inbox placement).
- [ ] Legal documents reviewed and live (Privacy Policy, T&Cs, Returns Policy, PDPL retention policy).
- [ ] Monitoring (Sentry + structured logs) operating with on-call rotation defined.
- [ ] Pre-launch readiness checklist in `PROJECT_STATE.md` §8 fully signed off.
- [ ] All feature flags in §4.2 of `DECISION_CAPTURE.md` are set to their launch positions with sign-off notes in `LAST_SESSION.md`.

Launch is then the deliberate act of flipping `public_storefront_enabled` to ON.

---

## 5. Scope

### 5.1 Surfaces

- **Public site:** homepage, listing pages, brand directory, brand landing pages, category pages, search, PDPs, cart, checkout, order confirmation, customer account (orders/addresses/profile), legal pages, FAQ.
- **Admin portal:** dashboard, product list + editor (with field-level status tracking), brand management, category management, order management, homepage curation, audit log, feature flag toggles, integration status, admin user management, support conversation viewer (Phase 2).
- **Webhook receivers:** `/api/webhooks/paymob`, `/api/webhooks/icarry`.
- **Operational:** `/api/health`, `/api/sitemap.xml`, scheduled jobs (shipping poll, payment reconciliation).

### 5.2 Personas

- **Customer (UAE resident, English-speaking).** Browses, compares, adds to cart, checks out, tracks orders, manages account.
- **Admin operator (1-3 people initially).** Imports catalog, enriches products, manages orders end-to-end, configures the system.
- **External webhook senders.** Paymob and iCarry call back. No human-facing UX.

---

## 6. Codebase context

Required reading before starting any milestone:

| Document | Purpose |
|---|---|
| `PROJECT_STRUCTURE.md` | File tree, module boundaries, naming conventions, prototype location |
| `ENVIRONMENT_VARIABLES.md` | Env var inventory, Zod validation, scoping |
| `THREAT_MODEL.md` | Attacker classes, trust zones, controls per surface, cross-check requirements |
| `CONTEXT_EXPANSION_NOTES.md` | Acknowledged unknowns, verification debt for M5/M6/M8 |
| `DECISION_CAPTURE.md` | The four architectural decisions and why |
| `PRODUCT_CONTENT_SPEC_v1.1_ADMIN_DRIVEN.md` | The content model, statuses, publish gates, adaptive rendering |
| `ARCHITECTURE.md` | System architecture, layer model, request lifecycles, adapter pattern |
| `DB_SCHEMA.md` | Full Postgres schema with RLS |
| `API_SPEC.md` | Server action and webhook contracts |
| `ADMIN_PORTAL_SPEC.md` | Admin portal UX and data flows |
| `PAYMENT_SPEC.md` | Paymob integration spec (M5) |
| `DELIVERY_SPEC.md` | iCarry integration spec (M6) |
| `AI_SUPPORT_FUTURE_SPEC.md` | Future AI support spec; MVP scaffolding only |
| `PROJECT_STATE.md` | Living operational state — read every session |
| `LAST_SESSION.md` | Living session-handoff document |

Reference materials at `docs/reference/`:

- `vitaminaty-prototype.html` — full UX/design reference (6,617 lines), not a codebase
- `product.md` — source catalog (817 source rows → 787 unique products)
- `PRODUCT_CONTENT_SPEC.md` (v1.0) — historical, superseded by v1.1

---

## 7. Architecture sketch

See `ARCHITECTURE.md` for the full picture. One-paragraph summary:

Single Next.js 15 App Router application deployed on Vercel, backed by a single Supabase project (Postgres + Auth + Storage). Public, admin, and webhook surfaces share the codebase. Four-layer module organization (Routes/UI → Features → Services → Data access & lib utilities) enforced by ESLint import rules. External integrations (Paymob, iCarry, future AI) accessed via adapter interfaces with stubs from day one and real implementations slotted in at dedicated milestones. Feature flags gate every commerce-affecting surface; HIGH_RIGOR-gated flags stay off until cross-checks sign off. RLS at Postgres provides defense-in-depth on top of server-side `requireAdmin()` / `requireCustomer()` checks.

---

## 8. Milestone specifications

Each milestone below is a complete BOB v5 invocation. Read the milestone's section + the sub-specs it points to. Execute. Update `LAST_SESSION.md` at the end.

---

### M0 — Foundation

**Status:** [ ] not started · [ ] in progress · [ ] complete
**HIGH_RIGOR posture:** Foundational. Env hygiene, secret handling, ESLint security rules. No business logic yet.

**Scope:**

- Initialize Next.js 15 + TypeScript + App Router project on Node 22 (amended from Node 20 — Node 22 is current Active LTS as of 2026-05; spec written when 20 was most recent LTS).
- Configure Tailwind CSS with design tokens extracted from `docs/reference/vitaminaty-prototype.html`.
- Install Supabase JS client and create the Supabase project (env-specific).
- Configure environment variables and Zod validation per `ENVIRONMENT_VARIABLES.md`.
- Build the four-layer directory structure per `PROJECT_STRUCTURE.md`.
- Set up ESLint with import-boundary rules to enforce the layer model.
- Set up Prettier, EditorConfig.
- Create the file-tree skeleton (empty files for all major modules to lock in conventions).
- Build the structured logger (`src/lib/logger.ts`).
- Build the rate-limit utility (`src/lib/rate-limit.ts`).
- Build the money primitive (`src/lib/money/`) — AED whole-integer arithmetic, VAT computation.
- Build the validation library (`src/lib/validation/`) with Zod schemas.
- Build the `PaymentAdapter`, `ShippingAdapter`, `SupportChatProvider` interfaces and their stub implementations.
- Build the feature-flag infrastructure: `src/features/feature-flags/` with `flags.ts`, `eval.ts`, and the (empty) admin-actions placeholder.
- Build the `ChatBubble` placeholder component (hidden by default flag).
- Seed all state files (`PROJECT_STATE.md`, `LAST_SESSION.md`, `THREAT_MODEL.md`) — already done; verify they exist.
- Configure CI baseline (GitHub Actions): typecheck, lint, format-check on every PR.
- Deploy to Vercel preview environment. Verify env vars wire correctly. Verify `/api/health` returns 200.

**Files touched:**
- Project root: `package.json`, `tsconfig.json`, `next.config.mjs`, `tailwind.config.ts`, `.eslintrc.json`, `.prettierrc`, `.gitignore`, `vercel.json`
- `src/lib/*`, `src/features/feature-flags/*`, `src/features/support-chat/*`, `src/components/chat/*`
- `.github/workflows/ci.yml`

**Cross-check (HIGH_RIGOR):**
- Env vars validated server-side at boot; build fails if any required var is missing.
- No secrets in client bundles (verified via Next.js build output inspection).
- ESLint catches forbidden imports (Layer 4 importing Layer 1, etc.).
- Adapter stubs do not call any external services.

**Definition of done:**
- [ ] `pnpm dev` starts the app cleanly.
- [ ] `pnpm typecheck && pnpm lint && pnpm test` all pass.
- [ ] Vercel preview deploys successfully.
- [ ] `/api/health` returns 200.
- [ ] All adapter interfaces and stubs exist and unit-test cleanly.
- [ ] Feature flag table migration prepared (applied in M1).
- [ ] `PROJECT_STATE.md` and `LAST_SESSION.md` updated.

**v5 invocation hint:**
> "Execute M0 of `proj_spec.md`. Read `PROJECT_STRUCTURE.md`, `ENVIRONMENT_VARIABLES.md`, and `ARCHITECTURE.md` first. No business logic — just the bones. Use Tailwind tokens from the prototype's `:root` variables. End the session by updating `LAST_SESSION.md` with what shipped and what's next for M1."

---

### M1 — Data layer

**Status:** [ ] not started · [ ] in progress · [ ] complete
**HIGH_RIGOR posture:** RLS posture for PII tables. `wholesale_price_internal` column-level isolation.

**Scope:**

- Author and apply migrations 0001–0010 per `DB_SCHEMA.md` §10.
- Seed reference data: `categories` (16 rows), `goals` (5 rows), `md_category_mapping` (15 rows), `feature_flags` (all flags from `DECISION_CAPTURE.md` §4.2 with default values).
- Seed the initial admin user (via Supabase Auth + `app_metadata.role='admin'`).
- Implement `scripts/import-products-from-md.ts` — parses `docs/reference/product.md`, normalizes data, inserts 787 products with `status='imported'`, populates `fields_status` and `admin_review_flags` per v1.1 §5.
- Run the import. Verify exactly 787 unique products land. Verify brand-normalization heuristics map the 52 raw spellings to canonical brand records. Verify the 140 case-pack rows are flagged. Verify the 360 unpriced rows are flagged. Verify the 36 "Uncategorized" rows are mapped.
- Implement `src/server/repositories/*` for products, variants, images, goal_tags, brands, categories, customers, addresses, orders, payment_events, shipment_events, audit_log, feature_flags, support_conversations.
- Each repository: parameterized queries, no string concatenation, RLS-friendly (use anon client for public reads, service-role client only inside `src/server/`).
- Generate TypeScript types from Supabase (`pnpm db:types`).
- Write integration tests for each repository against a test Supabase project.

**Files touched:**
- `supabase/migrations/0001_*.sql` through `0010_*.sql`
- `scripts/import-products-from-md.ts`
- `src/server/repositories/*.ts`
- `src/server/db/supabase-server.ts`, `src/server/db/supabase-admin.ts`
- `src/types/database.ts` (generated)
- `tests/integration/repositories/*.test.ts`

**Cross-check (HIGH_RIGOR):**
- RLS enabled on every table that holds PII (`customers`, `addresses`, `orders`, `order_items`, `payment_events`, `shipment_events`, `audit_log`, `support_*`).
- `is_admin()` SQL function verified.
- `wholesale_price_internal` column REVOKE confirmed for `anon` and `authenticated` roles.
- Verify by attempting to SELECT `wholesale_price_internal` as `anon` — should fail.
- Verify by attempting to SELECT another customer's order as a logged-in customer — should return zero rows.
- Audit log is INSERT-only via service role; no UPDATE/DELETE policies.
- Payment events and shipment events are INSERT-only.

**Definition of done:**
- [ ] All migrations applied cleanly.
- [ ] 787 products imported with correct statuses and flags.
- [ ] Brand normalization mapped ~52 raw spellings to ~30 canonical brands.
- [ ] Repository test suite passes (every read and write tested).
- [ ] RLS cross-check tests pass (positive AND negative cases).
- [ ] Generated DB types compile cleanly into the codebase.
- [ ] `PROJECT_STATE.md` updated with the schema reality.

**v5 invocation hint:**
> "Execute M1 of `proj_spec.md`. Read `DB_SCHEMA.md` for the schema and `PRODUCT_CONTENT_SPEC_v1.1_ADMIN_DRIVEN.md` for import rules. The import script is the heart of this milestone. After import, run the RLS cross-check tests (positive + negative). End by updating `LAST_SESSION.md` and `PROJECT_STATE.md`."

---

### M2 — Admin portal

**Status:** [ ] not started · [ ] in progress · [ ] complete
**HIGH_RIGOR posture:** Admin auth + MFA enforcement. Every mutation audit-logged. RBAC checks server-side. Three defense layers per `DECISION_CAPTURE.md` §3.

**Scope:**

Build the admin portal per `ADMIN_PORTAL_SPEC.md`. Specifically:

- Supabase Auth signin flow at `/admin/sign-in` with MFA enforcement (TOTP enrollment on first login).
- `requireAdmin()` policy helper in `src/lib/auth/policies.ts` — called by every admin server action.
- Admin layout at `src/app/admin/layout.tsx` with sidebar nav, session timeout banner, MFA-status indicator.
- Dashboard (`/admin`) with the 5 widgets from `ADMIN_PORTAL_SPEC.md` §4.
- Product list (`/admin/products`) with filters, sort, pagination, bulk actions per spec §5.
- Product editor (`/admin/products/[id]`) with three-column layout, sections A–I, field-level status display per spec §6.
- Image upload to Supabase Storage with auto-thumbnail generation.
- Brand list + editor + brand-normalization tool per spec §7.
- Category management per spec §8.
- Order management at `/admin/orders` (functional but populated only after M4+).
- Homepage curation at `/admin/homepage`.
- Audit log viewer at `/admin/audit-log`.
- Feature flag toggle UI at `/admin/settings/feature-flags` with HIGH_RIGOR-gated confirmation (MFA re-verify + typed phrase for `commerce_enabled`, `paymob_live_mode`, etc.).
- Admin user management at `/admin/settings/users`.
- Every admin server action writes an `audit_log` entry via `src/server/services/audit-service.ts`.

**Files touched:**
- `src/app/admin/**`
- `src/features/admin-products/*`, `src/features/admin-brands/*`, `src/features/admin-categories/*`, `src/features/admin-orders/*`, `src/features/admin-homepage/*`, `src/features/admin-audit/*`, `src/features/admin-settings/*`
- `src/server/services/audit-service.ts`, `src/server/services/admin-auth-service.ts`, `src/server/services/product-service.ts`, `src/server/services/brand-service.ts`, `src/server/services/category-service.ts`, `src/server/services/image-service.ts`
- `src/lib/auth/policies.ts`
- `src/components/admin/**`

**Cross-check (HIGH_RIGOR):**
- Attempt to access `/admin/*` without auth → redirect to signin.
- Attempt to access `/admin/*` as a non-admin customer → 403.
- Attempt to access without MFA-verified session → redirect to MFA verification.
- Attempt to call admin server actions directly via curl/fetch with a customer JWT → 403.
- Verify every admin mutation appears in audit_log.
- Verify HIGH_RIGOR-gated flag toggle requires MFA re-verification.
- Verify session timeout works (4h idle, 12h absolute).
- Verify no admin route ships to client bundle without auth check.

**Definition of done:**
- [ ] Admin can sign in with MFA enforcement.
- [ ] Admin can edit a product end-to-end, including upload images and publish.
- [ ] Field-level status updates auto-recompute completion_score and status transitions.
- [ ] Brand normalization tool maps the remaining raw spellings.
- [ ] Audit log records every mutation.
- [ ] Feature flag UI works with HIGH_RIGOR-gated confirmations.
- [ ] Cross-check checklist all green.
- [ ] HIGH_RIGOR cross-check by the alternate executor (if Opus built it, Codex reviews; vice versa).

**v5 invocation hint:**
> "Execute M2 of `proj_spec.md`. Read `ADMIN_PORTAL_SPEC.md` thoroughly. This milestone is large — consider splitting into M2.1 (auth + product list + editor) and M2.2 (everything else) during execution. Every server action calls `requireAdmin()`. Every mutation writes an audit_log row. End the session by requesting a HIGH_RIGOR cross-check from the alternate executor."

---

### M3 — Public catalog read-paths

**Status:** [ ] not started · [ ] in progress · [ ] complete
**HIGH_RIGOR posture:** RLS for public reads. `wholesale_price_internal` never leaks. Customer PII not exposed in any public-facing path.

**Scope:**

Build the read-only public site per the prototype design at `docs/reference/vitaminaty-prototype.html`:

- Homepage (`/`) with hero, promo banner, goal pills, featured rails, brand strip, value props, FAQ, footer.
- Listing pages — by category (`/category/[slug]`), by brand (`/brand/[slug]`), by goal (`/goal/[tag]`), search (`/search?q=...`).
- Brand directory (`/brands`) with heavy/medium/light brand tiers per v1.1 §11.
- PDP (`/products/[slug]`) with full adaptive rendering per v1.1 §6 (Cases A–G).
- Legal pages: Privacy Policy, T&Cs, Returns Policy, About, FAQ, Contact.
- Site footer with brand, support, legal, contact links.
- 404 page.

All public reads use the anon Supabase client + RLS to enforce visibility.

**Cart UI exists but disabled by `cart_visible` flag.** Public site visible only when `public_storefront_enabled` flag is on (otherwise 503 maintenance page).

**Files touched:**
- `src/app/(public)/**`
- `src/features/products/*` (read-side: queries, server components)
- `src/features/brands/*`, `src/features/categories/*`, `src/features/search/*`, `src/features/homepage/*`
- `src/components/product/**`, `src/components/listing/**`, `src/components/brand/**`, `src/components/home/**`
- `src/server/services/product-service.ts` (read-side; expanded from M2)

**Cross-check (HIGH_RIGOR):**
- Verify SELECT on `products` as `anon` returns ONLY rows where `is_public_visible=true AND status='published'`.
- Verify `wholesale_price_internal` is never selected on public paths (grep server services for the column name).
- Verify no PDP renders a `draft`-status field's content.
- Verify PDP adaptive rendering hides empty sections — no "no information available" placeholders that look like missing content.
- Lighthouse performance > 80 on homepage and PDP.
- WCAG 2.1 AA pass on homepage and PDP key flows.

**Definition of done:**
- [ ] Homepage renders the prototype design with real DB data.
- [ ] PDP renders correctly for all of Cases A–G with appropriate adaptive hiding.
- [ ] Search and filters return correct results.
- [ ] Brand and category pages populated correctly.
- [ ] `wholesale_price_internal` confirmed never selected publicly.
- [ ] All legal pages live with placeholder text (final text added at M8 after legal review).
- [ ] HIGH_RIGOR cross-check by alternate executor.

**v5 invocation hint:**
> "Execute M3 of `proj_spec.md`. Read the prototype at `docs/reference/vitaminaty-prototype.html` for visual reference (it's not a codebase — translate the designs into React components). Read v1.1 §6 for adaptive rendering Cases A–G. Cart UI exists but stays hidden behind the `cart_visible` flag. End with cross-check on the RLS posture for public reads."

---

### M4 — Cart & checkout (stub payments)

**Status:** [ ] not started · [ ] in progress · [ ] complete
**HIGH_RIGOR posture:** **High.** Server-side totals authority, idempotency, no client-trusted prices, frozen address snapshots, audit logging.

**Scope:**

- Client-side cart store at `src/features/cart/client-cart-store.ts` (Decision C2 — per `LAST_SESSION.md` from Phase 1.5).
- Cart drawer component and `/cart` page.
- 5-step checkout flow at `/checkout`: cart review → shipping address → shipping method → payment method → review & place.
- Server-side cart revalidation (`cart.revalidateCart` action per `API_SPEC.md` §2.1).
- `checkout.placeOrder` server action per `API_SPEC.md` §2.2 with full server-side totals computation.
- Stub `PaymentAdapter` and `ShippingAdapter` produce realistic responses.
- Order creation: writes to `orders` + `order_items`, decrements stock atomically, writes audit_log.
- Order confirmation page (`/order-confirmation/[orderId]`).
- Customer auth flows: `/sign-up`, `/sign-in`, `/forgot-password`, `/verify-email`.
- Customer account: `/account` (profile), `/account/orders`, `/account/orders/[id]`, `/account/addresses`.
- PDPL flows: data export request, account deletion request.
- All cart/checkout surfaces gated by `commerce_enabled` flag (OFF by default — admin sets to true only after M5 cross-check).

**Files touched:**
- `src/features/cart/*`, `src/features/checkout/*`, `src/features/account/*`, `src/features/auth/*`
- `src/server/services/checkout-service.ts`, `src/server/services/cart-service.ts`, `src/server/services/account-service.ts`
- `src/app/(public)/cart/*`, `src/app/(public)/checkout/**`, `src/app/(public)/account/**`, `src/app/(auth)/**`
- `src/lib/money/totals.ts`, `src/lib/money/vat.ts`

**Cross-check (HIGH_RIGOR):**

This is the first big HIGH_RIGOR cross-check. Verify all of:

- **Server-side totals authority:** simulate a client sending a tampered `client_displayed_total_aed` lower than the server's recomputed total — must return `price_changed` error.
- **Stock revalidation:** simulate two simultaneous checkouts of the last unit — only one should succeed.
- **Idempotency:** call `placeOrder` twice with the same idempotency_key — second call returns the same result without creating a duplicate order.
- **Frozen address snapshot:** modify the customer's address after checkout; the order's `ship_to` JSONB remains the original.
- **Audit log entries:** every order creation has an audit_log row.
- **Stock decrement atomicity:** order creation + stock decrement happen in one transaction; failure rolls back both.
- **`commerce_enabled` flag:** when OFF, `/cart` and `/checkout` return 404, server actions return `feature_disabled`.
- **VAT math:** AED 100 inclusive should compute as AED 4.76 VAT + AED 95.24 net (or per UAE 5% inclusive formula — verify in `src/lib/money/vat.ts` tests).

**Definition of done:**
- [ ] Cart and checkout flow work end-to-end against stub payments and stub shipping.
- [ ] All HIGH_RIGOR cross-checks pass.
- [ ] Customer can place a (fake) order, see it in their account, see it in the admin order list.
- [ ] PDPL data export and account deletion both work.
- [ ] `cart_visible` flag enables/disables cart UI without breaking the rest of the site.

**v5 invocation hint:**
> "Execute M4 of `proj_spec.md`. Read `API_SPEC.md` §2 and `PAYMENT_SPEC.md` §2 for the adapter contracts. The stub `PaymentAdapter` is sufficient for this milestone — no Paymob calls yet. Pay extreme attention to the server-side totals authority — the HIGH_RIGOR cross-check tests this specifically. End with alternate-executor HIGH_RIGOR cross-check."

---

### M5 — Paymob real integration

**Status:** [ ] not started · [ ] in progress · [ ] complete
**HIGH_RIGOR posture:** **Maximum.** Money handling, cryptographic verification, secret handling, adversarial tests.

**Scope:**

Implement Paymob integration per `PAYMENT_SPEC.md`. The M5 engineer's first task is to verify the hypotheses in `CONTEXT_EXPANSION_NOTES.md` §3 against current Paymob documentation.

Then implement:

- Real `PaymobAdapter` in `src/lib/paymob/paymob-adapter.ts` conforming to the M0 interface.
- Webhook handler at `/api/webhooks/paymob` with HMAC verification, replay protection, idempotency.
- All 5 payment methods: Cards, Apple Pay, Tabby, Tamara, COD.
- Sandbox test transactions for each method.
- PCI never-store guard at the payment_events insertion boundary.
- Adversarial test suite per `PAYMENT_SPEC.md` §7.
- Admin reconciliation viewer (shows payment_events linked to orders).
- Update `PAYMENT_SPEC.md` markers from 🟡 to ✅ as hypotheses are confirmed.
- Update `CONTEXT_EXPANSION_NOTES.md` §3 with verification notes.

**Execution split (optional):**
- M5.1: Sandbox integration (adapter + sandbox tests pass).
- M5.2: Live cutover (production credentials + live test transaction + monitoring).

**Files touched:**
- `src/lib/paymob/*` (paymob-adapter.ts replaces stub usage)
- `src/app/api/webhooks/paymob/route.ts`
- `src/server/services/payment-service.ts`
- `src/features/admin-orders/*` (reconciliation viewer)
- `tests/integration/webhooks/paymob.test.ts`, `tests/integration/webhooks/paymob.adversarial.test.ts`
- `PAYMENT_SPEC.md`, `CONTEXT_EXPANSION_NOTES.md` (updated)

**Cross-check (HIGH_RIGOR — full sweep):**
- HMAC signature verification with current algorithm + field order (verified live).
- Timing-safe comparison (`crypto.timingSafeEqual`) always used.
- Replay window enforced; test with stale timestamp.
- Idempotency via unique constraint enforced; test with replayed webhook.
- All 5 payment methods tested in sandbox end-to-end.
- All adversarial tests pass.
- PCI never-store guard active (test with crafted payload containing fake card data — verify stripped before insert).
- Secrets never logged.
- Webhook errors trigger alerting (>10 bad signatures in 5 min).
- `paymob_live_mode` flag remains OFF; flipping is a separate sign-off step.

**Definition of done:**
- [ ] All hypothesis markers in `PAYMENT_SPEC.md` either ✅ verified or replaced with actuals.
- [ ] Sandbox test matrix complete (all 5 methods, success + failure cases).
- [ ] Adversarial test suite all green.
- [ ] Reconciliation viewer working.
- [ ] PCI guard verified.
- [ ] HIGH_RIGOR cross-check by alternate executor — written sign-off in `LAST_SESSION.md`.
- [ ] Engineer recommends to admin team whether to flip `paymob_live_mode` — flip is admin's deliberate act.

**v5 invocation hint:**
> "Execute M5 of `proj_spec.md`. **First task:** read live Paymob docs and verify every 🟡 hypothesis in `PAYMENT_SPEC.md`. Update the spec with actuals before writing code. Read `CONTEXT_EXPANSION_NOTES.md` §3 for the verification checklist. Read `THREAT_MODEL.md` §5.5–§5.7 for the security controls. This is the highest HIGH_RIGOR milestone — adversarial tests are non-negotiable. End with a written sign-off in `LAST_SESSION.md`."

---

### M6 — iCarry real integration (or verified alternative)

**Status:** [ ] not started · [ ] in progress · [ ] complete
**HIGH_RIGOR posture:** Webhook signature verification, secret handling, PII handling in shipment records.

**Scope:**

Implement shipping integration per `DELIVERY_SPEC.md`. The M6 engineer's first task is to evaluate iCarry against the verification checklist in `CONTEXT_EXPANSION_NOTES.md` §4 and choose:

- **Path A:** Implement against iCarry's API.
- **Path B1:** Manual portal workflow (no API integration; admin enters shipments manually).
- **Path B2:** Pivot to an alternative aggregator (Shipox, Postaplus, Aramex direct, Emirates Post direct).

The `ShippingAdapter` interface is unchanged across all paths.

Then implement:

- Real adapter per chosen path in `src/lib/icarry/icarry-adapter.ts`.
- Webhook handler at `/api/webhooks/icarry` (or polling job at `src/server/services/shipping-poll-job.ts` if no webhooks).
- Status translation map.
- Order state transitions on shipment events.
- COD handling end-to-end.
- Adversarial test suite (same pattern as Paymob).
- Update `DELIVERY_SPEC.md` markers from 🟡 to ✅.
- Update `CONTEXT_EXPANSION_NOTES.md` §4 with verification notes and chosen path.

**Files touched:**
- `src/lib/icarry/*`
- `src/app/api/webhooks/icarry/route.ts` (if Path A with webhooks)
- `src/app/api/cron/poll-shipments/route.ts` (if polling)
- `src/server/services/shipping-service.ts`
- `tests/integration/webhooks/icarry.test.ts`, `tests/integration/webhooks/icarry.adversarial.test.ts`
- `vercel.json` (cron config if polling)
- `DELIVERY_SPEC.md`, `CONTEXT_EXPANSION_NOTES.md` (updated)

**Cross-check (HIGH_RIGOR):**
- HMAC signature verification (if webhooks).
- Status mapping table covers all provider statuses.
- COD flow tested end-to-end (order created in `preparing`, shipment includes COD payload).
- Adversarial tests pass.
- Shipment PII redacted in logs.
- `icarry_live_mode` flag remains OFF; flip is a separate sign-off.

**Definition of done:**
- [ ] Path chosen and documented.
- [ ] Adapter implemented and integration tests pass.
- [ ] Order placement triggers shipment creation.
- [ ] Tracking number + URL show on customer order view.
- [ ] All hypothesis markers updated.
- [ ] HIGH_RIGOR cross-check by alternate executor.

**v5 invocation hint:**
> "Execute M6 of `proj_spec.md`. **First task:** evaluate iCarry per `CONTEXT_EXPANSION_NOTES.md` §4 decision tree. Document the chosen path. Read `DELIVERY_SPEC.md` thoroughly. The interface contract stays the same regardless of path. End with cross-check sign-off."

---

### M7 — Order management + transactional emails

**Status:** [ ] not started · [ ] in progress · [ ] complete
**HIGH_RIGOR posture:** Email content review (no PII over-disclosure). Order status transition guards.

**Scope:**

- Customer order history (already shipped in M4 against stub orders; verify against real orders).
- Admin order detail page with manual status transitions per `ADMIN_PORTAL_SPEC.md` §9.
- Transactional emails:
  - Order confirmation (sent on `orders.status = 'paid'`)
  - Payment received (combined into order confirmation or separate per design call)
  - Shipment created (sent when `tracking_number` set)
  - Shipment out for delivery
  - Shipment delivered
  - Payment failed
  - Refund issued
  - Password reset (via Supabase Auth UI hooks)
  - Email verification
  - Account deletion confirmation
- Resend integration (`src/lib/email/resend-adapter.ts`).
- Email templates with brand identity (logo, color, footer, unsubscribe for marketing only).
- `transactional_emails_enabled` flag — when OFF, emails log to console only.

**Files touched:**
- `src/lib/email/*` (resend-adapter, stub-adapter, templates)
- `src/server/services/email-service.ts`
- `src/features/admin-orders/*` (status transition UI)
- `src/features/account/*` (verify order history works)
- Email templates in `src/lib/email/templates/*.tsx` (React Email or similar)

**Cross-check (HIGH_RIGOR):**
- No PII over-disclosure: order confirmation email includes the customer's own data only; never another customer's data.
- No payment-method details beyond last-4 in emails.
- Unsubscribe link only on marketing emails, not transactional.
- DKIM/SPF/DMARC configured for the sending domain.
- Inbox-placement test (Gmail, iCloud, Outlook).
- Status transition guards: can't go from `pending_payment` → `delivered` directly.
- `transactional_emails_enabled` flag respected.

**Definition of done:**
- [ ] All transactional emails fire on the right events.
- [ ] Inbox placement verified in major providers.
- [ ] Admin can manually transition order status.
- [ ] HIGH_RIGOR cross-check by alternate executor.

**v5 invocation hint:**
> "Execute M7 of `proj_spec.md`. Build email templates per Vitaminaty brand identity from the prototype. Use Resend. Test inbox placement before declaring done."

---

### M8 — Pre-launch polish

**Status:** [ ] not started · [ ] in progress · [ ] complete
**HIGH_RIGOR posture:** End-to-end re-read of THREAT_MODEL.md. Legal sign-off on PDPL retention.

**Scope:**

- RTL structural prep: language toggle hooked up, but Arabic copy not added (placeholder).
- Performance pass: Lighthouse > 85 on homepage, PDP, listing, checkout; image optimization (Next/Image with Supabase storage URLs); ISR / edge caching strategy documented.
- Accessibility pass: WCAG 2.1 AA on customer-critical flows (homepage, PDP, cart, checkout, account, signup, signin).
- Monitoring: Sentry integration, structured log routing to Vercel + (optional) external aggregator, alerting on payment webhook failures > 10 in 5 min, error rate thresholds.
- Legal review: PDPL retention policies confirmed by legal counsel (replacing the "pending review" markers in `THREAT_MODEL.md` §5.10 and `CONTEXT_EXPANSION_NOTES.md` §5). Privacy Policy, T&Cs, Returns Policy texts finalized.
- End-to-end threat model re-read. Pen-test if budget allows.
- Pre-launch readiness checklist in `PROJECT_STATE.md` §8 signed off section by section.

**Files touched:**
- `src/middleware.ts` (RTL routing prep)
- `next.config.mjs` (image domains, caching headers)
- `src/lib/monitoring/*`
- Legal page texts (`src/app/(public)/legal/**`)
- `PROJECT_STATE.md` §8 (checklist sign-off)
- `THREAT_MODEL.md` §5.10 (retention finalized)
- `CONTEXT_EXPANSION_NOTES.md` §5 (retention finalized)

**Cross-check (HIGH_RIGOR — comprehensive):**
Run the full `THREAT_MODEL.md` §7 cross-check sweep. Every domain reviewed.

**Definition of done:**
- [ ] Lighthouse scores ≥ 85 on key pages.
- [ ] WCAG 2.1 AA on critical flows.
- [ ] Monitoring + alerting live.
- [ ] Legal sign-off on retention policy.
- [ ] Privacy Policy, T&Cs, Returns Policy texts approved.
- [ ] Threat model re-read complete; no open critical issues.
- [ ] Pre-launch checklist all green.
- [ ] Admin team ready to flip the launch flags.

**v5 invocation hint:**
> "Execute M8 of `proj_spec.md`. This is the comprehensive pre-launch milestone. Read `THREAT_MODEL.md` fully and run the §7 cross-check sweep. Coordinate with legal counsel for retention sign-off (this requires human, not v5). End by updating `PROJECT_STATE.md` §8 with the readiness checklist results."

---

## 9. Post-MVP milestones (priority order, not detailed)

| # | Name | Pre-requisites |
|---|---|---|
| P1 | Real AI customer support assistant | `AI_SUPPORT_FUTURE_SPEC.md` decision gates §10 met |
| P2 | Real reviews system | Operational stability post-launch |
| P3 | Promo code engine | Revenue justifies the build |
| P4 | Arabic content translation | Bilingual copywriter hired |
| P5 | Customer-side MFA | Higher-risk customer base materializes |
| P6 | Same-day delivery enablement | iCarry capability confirmed + ops ready |
| P7 | B2B/wholesale portal | Wholesale customer base materializes |
| P8 | Warehouse automation / inventory sync | Catalog scale demands it |

---

## 10. HIGH_RIGOR domain references

Per Spec Architect v5 triggers, the following are treated as HIGH_RIGOR:

| Domain | Where it's specified | When it ships |
|---|---|---|
| Payments | `PAYMENT_SPEC.md` | M5 (real); M0–M4 stub |
| Auth/secrets/sessions | `THREAT_MODEL.md` §5.4 + `ENVIRONMENT_VARIABLES.md` | M0 (env), M2 (admin auth), M4 (customer auth) |
| PII/PDPL | `THREAT_MODEL.md` §5.10 + this spec M8 | M1 (RLS), M4 (PII paths), M8 (retention sign-off) |
| Production data paths | `ARCHITECTURE.md` + each milestone's cross-check | M2–M8 cumulatively |
| Cryptographic verification | `PAYMENT_SPEC.md` §5.2 + `DELIVERY_SPEC.md` §7 | M5, M6 |
| AI decisions | `AI_SUPPORT_FUTURE_SPEC.md` | Post-MVP only; not active in MVP |

---

## 11. Open questions & acknowledged unknowns

See `CONTEXT_EXPANSION_NOTES.md` for the living checklist. Key categories:

1. **Paymob verification debt (M5 first task).** Auth flow (legacy two-step vs Unified API), HMAC algorithm and field order, exact event types, webhook header names.
2. **iCarry verification debt (M6 first task).** API quality + capability — whether to use directly, manual workflow, or pivot to alternative.
3. **UAE PDPL retention specifics (M8 legal review).** 5 years minimum / 7 years recommended is a placeholder pending legal counsel sign-off.

Each is routed to the milestone where it becomes actionable.

---

## 12. Out-of-band dependencies (human-required)

Tasks that v5 cannot execute alone:

- **Supabase project creation** (one-time, M0 — human creates project, supplies env vars)
- **Vercel project creation + DNS** (one-time, M0)
- **Paymob account creation + sandbox + live credentials** (M5)
- **iCarry account creation + credentials** OR alternative-aggregator account (M6)
- **Resend account + DKIM/SPF/DMARC DNS records** (M7)
- **Legal counsel review of PDPL retention** (M8)
- **Legal counsel review of Privacy Policy, T&Cs, Returns Policy texts** (M8)
- **Admin team MFA enrollment** (M2, per admin)
- **Live test transactions** (M5, M6 — real money in small amounts)

The engineer/owner coordinates these. v5 cannot.

---

## 13. Update protocol

This file is updated:

- **At the end of every milestone** — the milestone's status line flips to "complete," and any deviations from this spec are noted inline.
- **When a new architectural decision is made** mid-milestone — document via `DECISION_CAPTURE.md` addendum, then update relevant sections here.
- **When verification debt resolves** — sub-specs update their 🟡 markers to ✅; this file references them.

Updates always include a corresponding entry in `LAST_SESSION.md`.

---

## 14. Sign-off

| Phase | Status | Date | Notes |
|---|---|---|---|
| Phase 0 — Scope detection | ✅ Complete | 2026-05-21 | Tier 3, greenfield, 5 of 6 HIGH_RIGOR triggers active |
| Phase 1 — Framing | ✅ Complete | 2026-05-21 | Production build, admin-central, adapter-isolated integrations |
| Phase 1.5 — Stack & structure | ✅ Complete | 2026-05-21 | Next.js 15 + Supabase Auth + client cart (C2) + null support provider |
| Phase 2 — Context expansion | ✅ Complete | 2026-05-21 | CONTEXT_EXPANSION_NOTES.md as living checklist; verification debt routed |
| Phase 3 — Solution exploration | ✅ Complete | 2026-05-21 | Four candidates analyzed, recommendations confirmed |
| Phase 4 — Decision capture | ✅ Complete | 2026-05-21 | Four decisions locked in DECISION_CAPTURE.md |
| Phase 5 — Spec authorship | ✅ Complete | 2026-05-21 | This document + 7 sub-specs |
| Phase 6 — Self-audit | Pending | — | Run before M0 starts |
| M0 — Foundation | Not started | — | Ready to begin |

---

_End of `proj_spec.md` v1.0. BOB v5 may now consume this file as the master input for Vitaminaty production build._
