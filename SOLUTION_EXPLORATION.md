# SOLUTION_EXPLORATION.md

**Project:** Vitaminaty
**Document version:** v1.0
**Document type:** Phase 3 architecture exploration — candidates, tradeoffs, recommendations
**Audience:** Project owner (to read and decide) + BOB v5 (to consume after decisions are captured in Phase 4)
**Scope:** Four open architectural decisions: milestone breakdown, database design philosophy, admin portal architecture, feature flag rollout strategy.

---

## How to read this document

For each of the four areas:

1. **Context** — what's being decided and why it matters.
2. **Candidates** — 2-3 real options.
3. **Per-candidate analysis** — pros, cons, risks, complexity.
4. **Recommendation** — my pick with reasoning.
5. **Impact on `proj_spec.md`** — what changes in the master spec depending on the decision.

At the end, a one-page **decision worksheet** lists all four picks with checkboxes. Your job in Phase 4 is to confirm, correct, or override each one.

---

# AREA 1 — MILESTONE BREAKDOWN

## 1.1 Context

The spec must be broken into milestones that each become a clean BOB v5 / Codex invocation. Per Part 1 Tier 3 guidance: "Do not produce a single monolithic spec v5 has to digest at once."

Constraints that bound the sequencing:

- **Staged-capable infrastructure from M0** (your locked decision) — feature flags exist from day one.
- **Adapter pattern for Paymob and iCarry** — interfaces in M0, stubs available immediately, real integration in dedicated milestones.
- **Admin-driven catalog** — product import and admin portal must precede public catalog because the public site reads what the admin publishes.
- **HIGH_RIGOR domains** (payments, auth, PII, production data paths) must land at well-bounded milestones to allow proper cross-checks.
- **Adaptive rendering (Cases A–G)** is core to the public site and depends on field-level status from M2.
- **Public launch only when the readiness checklist passes** — not tied to any specific milestone.

## 1.2 Candidates

### Candidate 1A — Standard linear (foundation → data → admin → public → commerce → integrations → orders → polish)

**Sequence:**
- **M0** Foundation (repo, stack, Supabase project, design tokens, feature flags, env, state files, adapter interfaces with stubs)
- **M1** Data layer (DB schema, RLS, migrations, MD import script, brand normalization, category mapping, 787 products land)
- **M2** Admin portal (auth + MFA, product list, product editor, image upload, publish controls, brand/category management, audit log)
- **M3** Public catalog read-paths (homepage, listing, brand, category, search, PDP with adaptive Cases A–G, all wired to real DB)
- **M4** Cart & checkout (sessions, cart, address capture, server-side revalidation, order creation against stub `PaymentAdapter`)
- **M5** Paymob real integration (HIGH_RIGOR — webhook handlers, signature verification, idempotency, sandbox tests, live cutover)
- **M6** iCarry real integration (shipment creation, tracking, webhooks)
- **M7** Order management (order history for customers, admin order admin, transactional emails)
- **M8** Pre-launch polish (RTL, perf, a11y, monitoring, legal/PDPL review, security cross-check)
- **Post-MVP** AI support, reviews, promo engine, Arabic content, B2B

**Logical dependencies:**
M0 → M1 → M2 → M3 → M4 → M5 → M6 → M7 → M8
(M5 and M6 are parallelizable after M4 — same engineer can do one then the other, or split if two work streams exist)

### Candidate 1B — Vertical slice (deliver a minimal working flow end-to-end first, then expand)

**Sequence:**
- **M0** Foundation
- **M1** Thin vertical slice: minimal DB schema (products table only), import a 10-product subset, build minimal admin (publish only), minimal public (1 listing page + PDP), minimal cart, minimal stub checkout — entire flow works end-to-end for 10 products.
- **M2** Expand the data layer (full schema, full import, brand normalization, category mapping)
- **M3** Expand admin portal to full v1.1 §23 surface
- **M4** Expand public site (search, filters, brand directory, all Cases A–G)
- **M5** Full checkout (sessions, address capture, server-side revalidation, real order records)
- **M6** Paymob real integration
- **M7** iCarry real integration
- **M8** Orders + emails + polish

**Logical dependencies:**
M0 → M1 (minimal vertical slice) → M2/M3 expand in parallel → M4 → M5/M6 → M7 → M8

### Candidate 1C — Parallel tracks (admin and public tracks split after M1)

**Sequence:**
- **M0** Foundation
- **M1** Data layer (DB schema, RLS, MD import, 787 products)
- **Track A (admin):** M2a admin auth + product editor → M3a admin orders + audit log
- **Track B (public):** M2b public catalog read-paths (using initially-imported product data, no edits needed) → M3b cart + checkout
- **Both tracks converge:** M4 Paymob, M5 iCarry, M6 orders+emails, M7 polish

**Logical dependencies:**
M0 → M1 → (M2a || M2b) → (M3a || M3b) → converge M4..M7

## 1.3 Per-candidate analysis

### Candidate 1A — Standard linear

| Dimension | Assessment |
|---|---|
| **Pros** | Clean dependencies, no rework. Each milestone has stable inputs from the prior one. Easiest to specify because each milestone is well-bounded. Plays well with single-track or staged deployment. HIGH_RIGOR cross-checks land naturally at the right milestones. |
| **Cons** | No working end-to-end flow until ~M4-M5. Owner has to wait several milestones before "click around a real shopping flow" is possible. Risk of late-discovered architectural issues. |
| **Risks** | Low. The only real risk is that some assumption in M0-M2 turns out wrong and propagates through M3+; but the spec's interface designs (`PaymentAdapter`, etc.) isolate the biggest variance points. |
| **Complexity** | Medium. ~9 milestones, each cleanly scoped. v5 can run each as one invocation. |

### Candidate 1B — Vertical slice

| Dimension | Assessment |
|---|---|
| **Pros** | Working end-to-end flow exists from M1. Easier to demo and validate UX early. Catches integration issues sooner. |
| **Cons** | M1 is a much larger milestone — touches 5+ subsystems thinly. Risk of v5 timing out or losing the plot. Throwaway scaffolding (10-product import, minimal admin) needs replacement in M2-M3, which is rework. Less clean per-milestone HIGH_RIGOR boundary. |
| **Risks** | Medium-high. The "minimal" of each subsystem accumulates technical debt. By M3 you're rewriting code that worked. Vertical-slice patterns work well for design-iteration prototypes but poorly for production codebases where each subsystem has its own production-quality bar. |
| **Complexity** | High. M1 alone is 3-4 milestones worth of work in disguise. |

### Candidate 1C — Parallel tracks

| Dimension | Assessment |
|---|---|
| **Pros** | Faster wall-clock delivery *if* two engineers / two v5 sessions run in parallel. |
| **Cons** | This is a single-developer + AI-agent project. Parallel tracks don't help when there's one execution thread. Even with parallel sessions, the integration points (admin's product mutations → public's reads) create coordination overhead. Spec authorship is harder because you have to define track-handoffs. |
| **Risks** | Medium. Track-divergence is real — admin's data model assumptions may drift from public's expectations. |
| **Complexity** | High for spec authorship; medium for execution if parallelism is real. |

## 1.4 Recommendation: Candidate 1A — Standard linear, with one refinement

**Recommend 1A.** Reasoning:

1. **Matches the execution model.** BOB v5 + Claude Code / Codex is a single-thread execution model. Parallelism (1C) is theoretical. Vertical-slice (1B) churns code.
2. **Clean v5 invocations.** Each milestone has a tight scope. v5 reads one milestone's spec section, executes, returns. Done. No "minimal" anything that needs upgrading later.
3. **HIGH_RIGOR boundaries align.** Cross-check sweeps (per `THREAT_MODEL.md` §7) land at M2 (admin auth), M3 (public RLS), M4 (cart/checkout), M5 (Paymob), M6 (iCarry), M7 (orders), M8 (pre-launch). Each is a self-contained cross-check.
4. **Staged-capable infra is M0** — exactly where it should be. Doesn't depend on milestone order.
5. **The "wait for end-to-end" downside is acceptable** because the stub adapters mean checkout flow works end-to-end at M4 already — just with a fake payment provider. M5 swaps the stub for real Paymob. The owner can demo a working shop at M4 using stub payments.

**Refinement: split M5 and M6 into sub-milestones if needed.**

M5 (Paymob) and M6 (iCarry) are each large enough that they may benefit from internal splits during execution:
- **M5.1** Paymob sandbox integration (read docs, build adapter, sandbox tests pass)
- **M5.2** Paymob live cutover (production credentials, live test transaction, monitoring)

Same for M6. This is an execution-time decision the v5 invocation can make; the master spec defines M5 as one milestone with two phases.

## 1.5 Final proposed milestone sequence

| # | Name | Scope summary | HIGH_RIGOR | Owner |
|---|---|---|---|---|
| M0 | Foundation | Repo bootstrap, Next.js + TypeScript + Supabase + Tailwind setup, design tokens from prototype, feature flags table + eval, env validation (Zod), structured logger, adapter interfaces (`PaymentAdapter`, `ShippingAdapter`, `SupportChatProvider`) + stub implementations, all state files seeded, CI baseline, deploy to Vercel preview. **No business logic.** | Env hygiene, secret handling, foundational ESLint security rules | Engineer |
| M1 | Data layer | Postgres schema (products, brands, categories, variants, customers, addresses, orders, cart, payment_events, shipment_events, audit_log, feature_flags, support_conversations, slug_history). RLS policies. MD import script imports all 787 products with `status='imported'`. Brand normalization runs. Category mapping table seeded. Initial admin user seeded. Catalog integrity check passes. **No UI yet.** | RLS posture (PII tables), wholesale price isolation | Engineer |
| M2 | Admin portal | Admin signin (Supabase Auth + MFA enforced). Product list with all v1.1 §23 filters. Product editor with field-level status display, image upload to Supabase Storage, publish/archive controls. Brand normalization tool. Category management. Audit log writer + read-only viewer page. Homepage curation (rails, featured brands). **Admin can publish products manually but they don't show publicly yet (commerce flag still off).** | Admin auth + MFA, every mutation audit-logged, RBAC checks server-side | Engineer + HIGH_RIGOR cross-check |
| M3 | Public catalog read-paths | Homepage, listing pages, brand directory, brand landing, category pages, search, PDP with full Cases A–G adaptive rendering, offers empty state, legal pages. **Reads only from published products. Cart UI exists but disabled by flag.** | RLS for public reads, `wholesale_price_internal` never selected publicly | Engineer + HIGH_RIGOR cross-check |
| M4 | Cart & checkout (stub payments) | Client-side cart store, cart drawer, cart page, checkout 5-step flow, address capture, shipping method selection (against stub `ShippingAdapter`), payment method selection (against stub `PaymentAdapter`), server-side cart revalidation, order record creation, order confirmation page, customer account pages (orders list, order detail, address book). | Server-side totals authority, idempotency, no client-trusted prices | Engineer + HIGH_RIGOR cross-check |
| M5 | Paymob real integration | Real `PaymobAdapter` implementation. Webhook handler at `/api/webhooks/paymob` with HMAC verification + replay protection + idempotency. Sandbox test transactions for all 5 payment methods. Live-mode flip per environment via feature flag. Reconciliation job (Phase 2 trigger). | Full HIGH_RIGOR sweep — money handling, cryptographic verification, secret handling, adversarial tests | Engineer + HIGH_RIGOR cross-check + Phase 2 verification per `CONTEXT_EXPANSION_NOTES.md` §3 |
| M6 | iCarry real integration (or alternative) | Real `ICarryAdapter` (or alternative chosen at M6 verification). Shipment creation on order placement. Tracking polling or webhook handler. Shipping status transitions on order record. | HIGH_RIGOR for webhook verification, secret handling | Engineer + HIGH_RIGOR cross-check + Phase 2 verification per `CONTEXT_EXPANSION_NOTES.md` §4 |
| M7 | Order management + emails | Customer order history (already wired in M4 against stub orders; now wired against real orders). Admin order detail page with status transitions. Transactional emails: order confirmation, payment received, shipment created, shipment delivered, password reset, email verification. Resend integration. | Email content review (no PII over-disclosure), order status transition guards | Engineer + HIGH_RIGOR cross-check |
| M8 | Pre-launch polish | RTL preparation (structural; not content translation). Performance: Lighthouse scores, image optimization, edge caching strategy. Accessibility: WCAG 2.1 AA pass for key flows. Monitoring: Sentry integration, structured logs, alerting. Legal review: PDPL retention sign-off, Privacy Policy, T&Cs, Returns Policy texts. End-to-end threat model re-read. Pre-launch readiness checklist sign-off. | End-to-end HIGH_RIGOR re-read | Engineer + legal counsel + final cross-check |
| Post-MVP | Various | Real AI support assistant. Real reviews system. Real promo code engine. Arabic content translation. B2B/wholesale portal. Customer MFA. Warehouse integration. Same-day delivery enablement. | TBD per milestone | Future |

## 1.6 Impact on `proj_spec.md`

- The master spec uses this sequence as the canonical milestone list.
- Each milestone gets its own section in the spec with: scope, dependencies, definition of done, HIGH_RIGOR posture, cross-check requirements, files touched, v5 invocation hint.
- The post-MVP section lists future milestones in priority order but does not specify them in detail.

---

# AREA 2 — DATABASE DESIGN PHILOSOPHY

## 2.1 Context

The v1.1 product model has unusual demands:

- **Field-level status per product** (`fields_status` object with ~14 fields, each with its own enum status).
- **Admin review flags** (8 boolean flags per product).
- **Adaptive rendering** based on which fields have content.
- **Completion score** computed from field statuses.
- **Variants** modeled as separate rows per (product × flavor × size).
- **Search and filtering** by category, goal tags, form, price, brand.
- **RLS** for wholesale price isolation, admin-only fields, customer-only access to their orders.
- **Future scalability** to ~5,000-10,000 products if catalog grows.
- **Ease of development in Supabase** — Postgres-flavored SQL, generated TypeScript types from schema.

Three valid philosophies:

## 2.2 Candidates

### Candidate 2A — Mostly relational

Schema:
- `products` table with discrete columns for every business field (`name`, `slug`, `category_id`, `brand_id`, `retail_price`, `description`, `ingredients`, etc.).
- Variant child table `product_variants` (per-flavor-per-size rows).
- Field-status modeled as a sibling table `product_field_status` with rows like `(product_id, field_name, status)`.
- Admin review flags as discrete boolean columns on `products`.
- Goal tags as a junction table `product_goal_tags`.
- Categories as a separate `categories` table linked by FK.
- Brands as a separate `brands` table.
- Images in a separate `product_images` table linked to product or variant.

Indexes: primary key + `slug` unique + `category_id` + `brand_id` + `(status, is_public_visible)` composite.

Queries:
```sql
-- Public product listing for a category
SELECT p.id, p.slug, p.name, p.retail_price, b.name AS brand_name, pi.url AS thumbnail
FROM products p
JOIN brands b ON b.id = p.brand_id
LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_thumbnail = true
WHERE p.category_id = $1 AND p.is_public_visible = true
ORDER BY p.featured_score DESC, p.published_at DESC
LIMIT 24;
```

### Candidate 2B — JSON-heavy

Schema:
- `products` table with a small set of indexed columns (`id`, `slug`, `category_id`, `brand_id`, `retail_price`, `is_public_visible`, `status`) plus one large `content jsonb` column holding everything else (name, description, ingredients, supplement_facts, allergens, directions, warnings, variants, images, field_status, admin_flags, etc.).
- Variants stored as an array inside `content.variants`.
- Field statuses stored as `content.fields_status` object.

Queries:
```sql
SELECT id, slug, content->>'name' AS name, retail_price, content->'thumbnail' AS thumb
FROM products
WHERE category_id = $1 AND is_public_visible = true
ORDER BY (content->>'featured_score')::int DESC
LIMIT 24;
```

### Candidate 2C — Hybrid relational + JSONB

Schema:
- Relational columns for everything used in indexes, filters, joins, RLS conditions, or aggregates:
  - `id`, `slug`, `name`, `brand_id`, `category_id`, `retail_price`, `wholesale_price_internal`, `status`, `is_public_visible`, `is_add_to_cart_enabled`, `completion_score`, `published_at`, `created_at`, `updated_at`
- JSONB column `content` for fields that are read together on the PDP but never filtered:
  - `description`, `benefits[]`, `directions_of_use`, `storage_instructions`, `warnings`, `seo_title`, `seo_description`, `often_bought_with_ids[]`
- JSONB column `label_data` for label-derived structured data:
  - `nutrition_panel` (the §9 structured object), `ingredients`, `allergens[]`, `manufacturing_facility_warnings`
- JSONB column `fields_status` for the per-field status tracking:
  - `{name: 'complete', brand: 'complete', supplement_facts: 'missing', ...}`
- JSONB column `admin_review_flags`:
  - `{missing_price: false, missing_image: true, case_pack: false, ...}`
- Relational child tables where queries demand it:
  - `product_variants` (relational — needs joins, FKs, indexes for stock)
  - `product_images` (relational — needs joins, ordering)
  - `product_goal_tags` (junction — needed for goal filtering)

Queries:
```sql
SELECT id, slug, name, retail_price,
       (SELECT url FROM product_images WHERE product_id = p.id AND is_primary = true LIMIT 1) AS thumb
FROM products p
WHERE category_id = $1 AND is_public_visible = true
ORDER BY completion_score DESC, published_at DESC
LIMIT 24;

-- PDP load: one query gets everything for rendering
SELECT p.*, b.display_name AS brand_name,
       (SELECT json_agg(v.*) FROM product_variants v WHERE v.product_id = p.id) AS variants,
       (SELECT json_agg(i.*) FROM product_images i WHERE i.product_id = p.id) AS images
FROM products p
JOIN brands b ON b.id = p.brand_id
WHERE p.slug = $1 AND p.is_public_visible = true;
```

## 2.3 Per-candidate analysis

### Candidate 2A — Mostly relational

| Dimension | Assessment |
|---|---|
| **Pros** | Maximally queryable. Every field can be filtered, indexed, aggregated. Strongest schema enforcement (every field has a column type). Best generated TypeScript types from Supabase. Easiest for SQL-experienced developers. |
| **Cons** | Schema becomes wide (~40-60 columns on `products`). Every new field requires a migration. JSON-shaped data (supplement panel, fields_status) forces awkward normalization (a separate table per JSON structure, costly joins). |
| **Risks** | Slow iteration when adding fields. Migrations pile up. Joins multiply for PDP loads (5+ joins per PDP query). |
| **Complexity** | Medium-high. Lots of tables, but each table is simple. |
| **Supabase fit** | Excellent — Supabase loves relational. RLS policies write cleanly. |
| **Adaptive rendering fit** | Awkward — need to query `product_field_status` separately or join it. |

### Candidate 2B — JSON-heavy

| Dimension | Assessment |
|---|---|
| **Pros** | Fast iteration — add a field by adding a JSON key. Single-row PDP read. Easy to dump/restore product data. Variant arrays stay with their parent. |
| **Cons** | **Worst search/filter performance**. Indexing JSON paths is possible but ugly. Type safety degrades (Postgres doesn't know `content.retail_price` is int). RLS conditions on JSON fields work but feel wrong. Generated types are useless for the JSON column. Variant uniqueness constraints impossible inside JSON arrays. |
| **Risks** | High. Filtering by goal tag requires `content->'goal_tags' ? 'Build Muscle'` — works but slow at scale. Aggregate queries become unwieldy. Once you need "products with at least 25g protein per serving" (Phase 2 feature), JSON-only is wrong. |
| **Complexity** | Low initial; high long-term. |
| **Supabase fit** | Works but fights the platform's strengths. |
| **Adaptive rendering fit** | Excellent — one fetch, then JS picks what to render. |

### Candidate 2C — Hybrid relational + JSONB

| Dimension | Assessment |
|---|---|
| **Pros** | Best of both. Filter/sort/join columns stay relational, indexed, type-safe. Content payloads (description, label data) stay in JSON where their shape can evolve without migrations. Variant table relational (needed for stock joins). Field status as a single JSON column — query as `WHERE fields_status->>'description' = 'complete'` works, indexable. |
| **Cons** | Two storage patterns to learn (mitigated by docs). Slight cognitive overhead deciding "column vs json field." |
| **Risks** | Low — the boundaries are predictable: anything that participates in WHERE/ORDER BY/JOIN is a column; anything that just gets returned for display is JSON. |
| **Complexity** | Medium. ~10-12 relational tables + 2-3 JSONB fields on `products`. |
| **Supabase fit** | Excellent — Postgres handles JSONB beautifully, GIN indexes on JSON paths are fast, generated types work for relational columns, JSON columns get typed manually. |
| **Adaptive rendering fit** | Excellent — `fields_status` is one JSON column that lives next to the product and reads in one fetch. |

## 2.4 Recommendation: Candidate 2C — Hybrid relational + JSONB

**Recommend 2C.** Reasoning:

1. **The hybrid model fits the actual query shape.** PDP reads need everything in one shot — JSONB makes that one query. Listing/filtering needs indexed columns — relational gives that. Both, cleanly.
2. **Field-level status is naturally JSON.** v1.1 §5 defines `fields_status` as a 14-key object. Modeling it as 14 columns or as a separate table is overengineered. As a JSONB column with a GIN index, queries like "all products with `fields_status.image='missing'`" stay fast.
3. **Variants stay relational.** They have FKs, stock fields that update independently, and their own indexes. JSON arrays would be wrong here.
4. **Generated TypeScript types still work.** Supabase generates types for the relational columns; we write a TypeScript interface for the JSONB shapes and parse at the repository layer. The repository pattern (from `PROJECT_STRUCTURE.md`) is the right place for this.
5. **Future scalability is fine.** Postgres handles JSONB at ~10x current catalog scale (5,000-10,000 products) without strain. The relational indexes carry the hot paths.

## 2.5 Concrete schema for Candidate 2C (preview — full version in DB_SCHEMA.md authored in Phase 5)

```
products
├── id uuid PK
├── slug text UNIQUE NOT NULL
├── name text NOT NULL          -- normalized display name
├── name_raw text NOT NULL       -- exact_excel_name preserved
├── brand_id uuid FK → brands
├── category_id uuid FK → categories (NULL allowed for Uncategorized)
├── source_category text         -- MD source category
├── source_row int[]             -- MD source row indices
├── source_notes text            -- MD notes column
├── form text                    -- enum: Powder|Capsule|...|null
├── retail_price_aed int         -- whole AED; NULL allowed
├── wholesale_price_internal int -- never exposed publicly
├── status text NOT NULL         -- enum: imported|draft|partial|...
├── is_public_visible bool DEFAULT false
├── is_add_to_cart_enabled bool DEFAULT false
├── is_checkout_enabled bool DEFAULT false
├── completion_score int DEFAULT 0
├── featured_score int DEFAULT 0
├── content jsonb DEFAULT '{}'   -- description, benefits[], directions, warnings, seo_*, etc.
├── label_data jsonb DEFAULT '{}' -- nutrition_panel, ingredients, allergens[], etc.
├── fields_status jsonb NOT NULL  -- per-field status
├── admin_review_flags jsonb NOT NULL
├── created_at timestamptz
├── updated_at timestamptz
└── published_at timestamptz

product_variants
├── id uuid PK
├── product_id uuid FK → products
├── flavor text
├── size text NOT NULL
├── sku text
├── barcode text
├── price_aed int NOT NULL
├── in_stock bool DEFAULT true
├── stock_quantity int
├── weight_grams int
└── ...

product_images
├── id uuid PK
├── product_id uuid FK → products
├── variant_id uuid FK → product_variants (nullable)
├── url text NOT NULL            -- Supabase Storage URL
├── alt_text text
├── kind text                    -- front|label-nutrition|label-ingredients|angle|...
├── sort_order int
└── ...

product_goal_tags
├── product_id uuid FK → products
├── goal text NOT NULL            -- one of 5 Plan v2 goals
└── PRIMARY KEY (product_id, goal)

brands, categories, customers, addresses, orders, order_items,
cart_sessions (optional), payment_events, shipment_events,
audit_log, feature_flags, support_conversations, slug_history
```

Full schema in M1's `DB_SCHEMA.md`.

## 2.6 Impact on `proj_spec.md`

- M1 (Data layer) milestone defines the schema per Candidate 2C.
- `DB_SCHEMA.md` becomes the authoritative source-of-truth schema document (authored alongside `proj_spec.md`).
- Repository layer (`src/server/repositories/*`) is the only access point — handles JSON parsing/validation at the boundary, returns strongly-typed records to services.
- `src/types/product.ts` defines both the relational shape and the JSON-shape interfaces.

---

# AREA 3 — ADMIN PORTAL ARCHITECTURE

## 3.1 Context

The admin portal is the central tool for catalog operations. Per v1.1 §23 it has 12 functional areas: import, product list, product editor, brand management, category management, homepage curation, offers, reviews moderation (Phase 2), SEO, bulk operations, audit log, roles.

Three architectural questions to answer together:

- Where does it live? (Same app vs separate deploy.)
- What's the auth model? (Already locked: Supabase Auth + role + MFA.)
- How granular are roles? (One admin role vs multiple.)

## 3.2 Candidates

### Candidate 3A — Same Next.js app, admin route group

The same Next.js application serves both public and admin surfaces. Public at `/`, admin at `/admin`. Both connect to the same Supabase database. Authentication via Supabase Auth differentiates by `app_metadata.role`.

**Structure:**
- `src/app/(public)/...` — public visitor routes
- `src/app/admin/...` — admin routes, gated by `requireAdmin()` server helper
- `src/app/(auth)/...` — customer auth (signup/signin/reset)
- `src/app/admin/sign-in/...` — admin signin (MFA-enforced)
- One deploy to Vercel, one domain.

### Candidate 3B — Separate Next.js app, separate deploy

Two repos (or one monorepo with two packages). Public app deployed to `vitaminaty.ae`; admin app deployed to `admin.vitaminaty.ae`. Each is its own Next.js project with its own dependencies. Shared types live in a published `@vitaminaty/types` package or a shared workspace folder.

### Candidate 3C — Hybrid: same monorepo, separate runtime targets

One Next.js app, but admin and public routes are split at the middleware level: requests to `admin.vitaminaty.ae` route only to `/admin/*`, requests to `vitaminaty.ae` route only to `/`. Same codebase, deployed once, different domain → different exposed surface.

## 3.3 Per-candidate analysis

### Candidate 3A — Same app

| Dimension | Assessment |
|---|---|
| **Pros** | Simplest. One deploy, one CI, one build. Shared components without packaging overhead. Shared types directly. Database access patterns shared. Lowest cognitive load for a single-developer + AI-agent project. Easiest for v5 to navigate. |
| **Cons** | Larger bundle on the public side (though Next.js code-splitting mitigates this for App Router — admin routes don't ship to public bundles). Admin and public share the same domain origin, so cookies aren't cross-domain. Security posture: admin is one auth check away from public; a misconfigured route is a foot-gun. |
| **Risks** | The "one auth check" risk is real but mitigated by: (1) every admin server action calls `requireAdmin()` regardless of route prefix, (2) RLS at the DB layer is defense in depth, (3) admin MFA enforcement. Three layers of protection. |
| **Complexity** | Low. |
| **Spec impact** | Smallest. Matches the `PROJECT_STRUCTURE.md` already authored. |
| **Public launch impact** | Admin and public launch together (or admin behind a flag on the same deploy). Clean. |

### Candidate 3B — Separate apps

| Dimension | Assessment |
|---|---|
| **Pros** | Strongest security isolation — separate domains, separate bundles, separate deploys. Admin can be IP-allowlisted at the Vercel level. Bundle size for public stays minimal. |
| **Cons** | Two repos to maintain. Type sharing requires a published package or yarn/pnpm workspace, which adds complexity. Component reuse across the two apps requires extraction. Two CI pipelines. Two deploys per release. Higher coordination cost. v5 invocations have to specify which app they're touching. |
| **Risks** | Type drift between admin and public apps if shared package isn't disciplined. Forgotten redeployments. |
| **Complexity** | High. |
| **Spec impact** | Significant rewrite of `PROJECT_STRUCTURE.md`. |
| **Public launch impact** | Admin and public can launch independently — useful flexibility. |

### Candidate 3C — Hybrid monorepo with domain split

| Dimension | Assessment |
|---|---|
| **Pros** | One codebase. Domain-level separation (admin.vitaminaty.ae vs vitaminaty.ae) gives some isolation without two deploys. Vercel handles multi-domain routing natively. |
| **Cons** | Configuration complexity at the edge. Middleware rules to gate `/admin` access from the public domain (and vice versa) add subtle failure modes. Not significantly more secure than 3A because the runtime is shared anyway. |
| **Risks** | Medium — middleware bugs at the routing layer are easy to introduce. |
| **Complexity** | Medium. |
| **Spec impact** | Moderate — `PROJECT_STRUCTURE.md` gets a middleware section. |
| **Public launch impact** | Mostly transparent. |

## 3.4 Sub-decision: role granularity

For all three architecture candidates, what roles exist?

- **Single `admin` role.** Everyone with admin access can do everything. Simple.
- **Multi-role.** `viewer`, `catalog_editor`, `publisher`, `admin`. Granular.

For an MVP with a small shop ops team (likely 1-3 people), single role is appropriate. Multi-role becomes valuable when the team grows past 5 and you want junior catalog editors who can't accidentally publish or delete.

**Sub-recommendation:** Start with single `admin` role + document the migration path to multi-role in `ADMIN_PORTAL_SPEC.md`. Multi-role is a Phase 2 schema migration.

## 3.5 Recommendation: Candidate 3A — Same app, admin route group, single admin role for MVP

**Recommend 3A.** Reasoning:

1. **Matches the team and execution model.** Single developer + AI agent. Two apps = two builds = two deploys = more friction.
2. **Three layers of protection are sufficient.** Server-side `requireAdmin()`, RLS, admin MFA. The same-domain "weakness" is theoretical for this scale — and we can promote to 3B later as a deliberate evolution.
3. **`PROJECT_STRUCTURE.md` is already designed for 3A.** No rework.
4. **Vercel cost — same plan covers it.** Separate apps may need higher-tier plans.
5. **MFA on admin signin is the single most important security control** — and that's the same in all three candidates.

**Future migration path** (documented but not done now): if/when the business demands stronger isolation (e.g., the admin team has 10+ people, or compliance demands separation), the admin can be extracted to a separate deploy. Because the code lives in `src/app/admin/*` and `src/features/admin-*/`, the extraction is mechanical, not a redesign.

## 3.6 Impact on `proj_spec.md`

- Admin portal is built within the same Next.js app per `PROJECT_STRUCTURE.md`.
- M2 builds admin auth + MFA + product editor + image upload + audit log.
- `ADMIN_PORTAL_SPEC.md` (authored in Phase 5) documents the same-app architecture and the future migration path to 3B if ever needed.
- Single `admin` role for MVP; multi-role flagged as Phase 2.

---

# AREA 4 — FEATURE FLAG ROLLOUT STRATEGY

## 4.1 Context

Staged-capable infrastructure means feature flags exist from M0. This area defines:

- Which flags exist on day one.
- What each flag protects.
- When each can flip from `off` to `on`.
- Which flags must stay off until HIGH_RIGOR checks pass.
- How flags interact with the public launch readiness checklist.

## 4.2 Flag inventory

### 4.2.1 Surface-level flags (gate entire surfaces)

| Flag | Default | What it gates | Flips on when |
|---|---|---|---|
| `public_storefront_enabled` | `false` | Whether `/` and all `(public)/*` routes serve content vs return 503 maintenance page (with the exception of `/admin/*`). | M3 complete + sign-off |
| `admin_portal_enabled` | `true` | Whether `/admin/*` is accessible. (Default true so admins can work from day one.) | M0 |
| `commerce_enabled` | `false` | Whether cart and checkout UI render at all on the public site. When off: product cards show price but no Add-to-Cart button; cart drawer hidden; `/cart`, `/checkout`, `/order-confirmation` routes 404. | M5 complete + Paymob test transactions pass |
| `customer_signup_enabled` | `false` | Whether customer signup is accepted. Useful for soft launches that want browse-only. | M3 or M4 (whenever public soft launch decided) |
| `support_chat_enabled` | `false` | Whether the chat bubble renders. When off, hidden entirely. | M0 (default true if showing placeholder) / decision at M8 |

### 4.2.2 Feature-level flags (gate specific behaviors)

| Flag | Default | What it gates | Flips on when |
|---|---|---|---|
| `cart_visible` | `false` | Cart UI in header. Independent of `commerce_enabled` so you can soft-launch cart for testing before checkout. | M4 complete |
| `checkout_enabled` | `false` | Full checkout flow accessible. | M4 complete + M5 paymob staging |
| `paymob_live_mode` | `false` | Whether `PAYMOB_MODE=live` is enforced. When off, stub adapter is used regardless of env. | M5 complete + Paymob live test passes |
| `icarry_live_mode` | `false` | Same for iCarry. | M6 complete |
| `transactional_emails_enabled` | `false` | Whether the email service actually sends emails (vs logging to console). | M7 complete |
| `notify_me_enabled` | `false` | "Notify me when back in stock" CTA on OOS products. | Phase 2 |
| `reviews_enabled` | `false` | Reviews UI on PDP (empty state shows when off). | Phase 2 |
| `promo_codes_enabled` | `false` | Promo code apply button in cart. | Phase 2 |
| `wishlist_enabled` | `false` | Wishlist add-to button + account wishlist page. | Phase 2 |
| `arabic_rtl_enabled` | `false` | Language toggle to Arabic, RTL flip. | Phase 2 |
| `same_day_delivery_enabled` | `false` | Same-day shipping option in checkout (disabled in v1.1 prototype). | Phase 2 |
| `customer_mfa_enabled` | `false` | Customer-side MFA enrollment option. | Phase 2 |

### 4.2.3 Operational flags (admin operability)

| Flag | Default | What it gates | Flips on when |
|---|---|---|---|
| `maintenance_mode` | `false` | All public routes return 503 maintenance page. Admin unaffected. | Manual — incidents only |
| `read_only_mode` | `false` | All public mutations (add to cart, checkout, signup) disabled. Admin unaffected. | Manual — incidents only |
| `feature_flag_admin_ui` | `true` | Whether admins can toggle feature flags via the admin UI (vs only via direct DB / env). | M0 |

## 4.3 Flag storage & evaluation

Per `PROJECT_STATE.md`, feature flags are stored in a Supabase table (`feature_flags`), with an env-var escape hatch:

```sql
CREATE TABLE feature_flags (
  key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  description text,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users
);
```

Evaluation function:
```typescript
// src/features/feature-flags/eval.ts
export async function isEnabled(key: FlagKey): Promise<boolean> {
  // 1. Env override (escape hatch)
  const envOverride = process.env[`FF_${key.toUpperCase()}`];
  if (envOverride === 'true') return true;
  if (envOverride === 'false') return false;
  // 2. Database value (default)
  const row = await flagRepo.get(key);
  return row?.enabled ?? false;
}
```

Server-side evaluation only (no client-side flag SDK). The result is passed via props or read in Server Components. Client components receive boolean props, not flag keys.

## 4.4 HIGH_RIGOR-gated flags

These flags **must not flip on** until the corresponding HIGH_RIGOR cross-check completes:

| Flag | Gating cross-check |
|---|---|
| `commerce_enabled` | M4 cross-check (server-side totals + idempotency) AND M5 cross-check (Paymob HMAC + webhook idempotency) |
| `paymob_live_mode` | M5 full HIGH_RIGOR sweep — adversarial tests pass, sandbox transactions pass, live test transaction passes |
| `icarry_live_mode` | M6 cross-check |
| `transactional_emails_enabled` | M7 cross-check (no PII over-disclosure in email content) |
| `customer_signup_enabled` | M3 cross-check (PII handling on signup, RLS for customer data) |
| `public_storefront_enabled` | M3 cross-check (RLS for product reads, wholesale price isolation) |

Spec rule: each HIGH_RIGOR cross-check explicitly produces a sign-off note in `LAST_SESSION.md` saying "flag X is now safe to flip." The admin team flips it in the admin UI when ready.

## 4.5 Recommendation

The above flag inventory and rollout sequence is the recommendation. No alternative candidates make sense — staged-capable infra is already locked, and the flag set follows directly from the milestone structure.

**Key invariants this strategy enforces:**

1. **No commerce surface exposes until M5 sign-off** — `commerce_enabled` is the master gate.
2. **No real payments without HIGH_RIGOR cross-check** — `paymob_live_mode` gates by sign-off, not by milestone completion alone.
3. **Public launch is independent of milestone completion** — flipping `public_storefront_enabled` is the explicit launch decision, separate from "M3 is done."
4. **Defaults always favor safety** — every commerce-affecting flag defaults to `false`. Flipping a flag is a deliberate act with a sign-off.

## 4.6 Impact on `proj_spec.md`

- M0 includes `feature_flags` table + `eval.ts` + admin UI for toggling flags.
- Every subsequent milestone's "definition of done" includes "the corresponding flag(s) can be turned on without breaking the site" — but the actual flip is a separate manual step.
- Public launch checklist (`PROJECT_STATE.md` §8) is rewritten in terms of "which flags need to be on for launch":
  - `public_storefront_enabled` ON
  - `customer_signup_enabled` ON
  - `commerce_enabled` ON
  - `paymob_live_mode` ON
  - `icarry_live_mode` ON (or accepted as stub if M6 pivots)
  - `transactional_emails_enabled` ON
- `THREAT_MODEL.md` §7 already references the cross-check requirements; the spec ties these to flag flips explicitly.

---

# DECISION WORKSHEET — Phase 4 input

Confirm, correct, or override each decision below. After your response, I produce Phase 4 (decision capture) and then Phase 5 (`proj_spec.md` authorship).

| # | Decision area | My recommendation | Your decision |
|---|---|---|---|
| 1 | Milestone breakdown | **Candidate 1A — Standard linear**, M0 through M8, with M5/M6 internally splittable during execution. Sequence: Foundation → Data → Admin → Public → Cart/Checkout (stub) → Paymob → iCarry → Orders → Polish. | [ ] confirm / [ ] modify |
| 2 | Database design philosophy | **Candidate 2C — Hybrid relational + JSONB**. Relational columns for indexed/filtered/joined fields; JSONB for `content`, `label_data`, `fields_status`, `admin_review_flags`. Variants and images stay as separate relational tables. | [ ] confirm / [ ] modify |
| 3 | Admin portal architecture | **Candidate 3A — Same Next.js app, admin route group**, single `admin` role for MVP, multi-role documented as Phase 2 migration path. | [ ] confirm / [ ] modify |
| 4 | Feature flag rollout strategy | **Surface flags + feature flags + operational flags as inventoried in §4.2**, stored in Supabase table with env escape hatch, HIGH_RIGOR-gated flips per §4.4. | [ ] confirm / [ ] modify |

After Phase 4 captures your decisions, Phase 5 authors `proj_spec.md` plus the per-area sub-spec files (`DB_SCHEMA.md`, `API_SPEC.md`, `PAYMENT_SPEC.md`, `DELIVERY_SPEC.md`, `ADMIN_PORTAL_SPEC.md`, `ARCHITECTURE.md`, `AI_SUPPORT_FUTURE_SPEC.md`).

---

_End of `SOLUTION_EXPLORATION.md` v1.0._
