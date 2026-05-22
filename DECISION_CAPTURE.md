# DECISION_CAPTURE.md

**Project:** Vitaminaty
**Document version:** v1.0
**Document type:** Phase 4 — confirmed decision record
**Date captured:** 2026-05-21
**Status:** Final. Decisions here are inputs to Phase 5 spec authorship and binding on subsequent milestones unless explicitly re-opened.

---

## Purpose of this file

This file records the four architectural decisions confirmed at the end of Phase 3. Each decision was reached after candidate exploration in `SOLUTION_EXPLORATION.md`, recommended by the Spec Architect, and explicitly approved by the project owner.

When BOB v5 / Claude Code / Codex executes a milestone and asks "why is it this way?", this is the authoritative answer.

Re-opening a decision requires returning to Phase 3 with fresh candidates, not just changing this file.

---

## Decision summary table

| # | Area | Decision | Rejected alternatives |
|---|---|---|---|
| 1 | Milestone breakdown | **Candidate 1A — Standard linear, M0 through M8** | 1B vertical slice, 1C parallel tracks |
| 2 | Database design philosophy | **Candidate 2C — Hybrid relational + JSONB** | 2A mostly relational, 2B JSON-heavy |
| 3 | Admin portal architecture | **Candidate 3A — Same Next.js app with admin route group + single admin role for MVP** | 3B separate deploy, 3C hybrid domain split |
| 4 | Feature flag rollout strategy | **Full flag inventory per `SOLUTION_EXPLORATION.md` §4.2, Supabase-backed with env escape hatch, HIGH_RIGOR-gated flips** | None — no rival candidate |

---

## Decision 1 — Milestone breakdown

### What was decided

The Vitaminaty production build proceeds as nine milestones in linear order:

| # | Name | Scope summary |
|---|---|---|
| M0 | Foundation | Repo bootstrap. Next.js 15 + TypeScript + Supabase + Tailwind. Design tokens extracted from prototype. Feature flag infrastructure. Env validation (Zod). Structured logger. Adapter interfaces with stub implementations. State files seeded. CI. Vercel preview deploy. |
| M1 | Data layer | Postgres schema per Candidate 2C. RLS policies. MD import script imports all 787 products with `status='imported'`. Brand normalization runs. Category mapping table seeded. Initial admin user seeded. Catalog integrity check passes. |
| M2 | Admin portal | Supabase Auth + admin MFA enforced. Product list with v1.1 §23 filters. Product editor with field-level status display. Image upload to Supabase Storage. Publish/archive controls. Brand normalization tool. Category management. Audit log writer + viewer page. Homepage curation. |
| M3 | Public catalog read-paths | Homepage. Listing pages. Brand directory + brand landing. Category pages. Search. PDP with adaptive Cases A–G. Offers empty state. Legal pages. Reads only from published products. Cart UI exists but disabled by flag. |
| M4 | Cart & checkout (stub payments) | Client-side cart store. Cart drawer + cart page. 5-step checkout. Address capture. Shipping method selection via stub `ShippingAdapter`. Payment method selection via stub `PaymentAdapter`. Server-side cart revalidation. Order record creation. Order confirmation page. Customer account pages. |
| M5 | Paymob real integration | Real `PaymobAdapter`. Webhook handler with HMAC verification + replay protection + idempotency. Sandbox tests for all 5 payment methods. Live-mode flip per env. Full HIGH_RIGOR sweep. |
| M6 | iCarry real integration (or verified alternative) | Real `ICarryAdapter` OR alternative chosen at M6 verification per `CONTEXT_EXPANSION_NOTES.md` §4. Shipment creation on order placement. Tracking. Shipping status transitions on order record. |
| M7 | Order management + emails | Customer order history. Admin order detail with status transitions. Transactional emails (order confirmation, payment received, shipment created, shipment delivered, password reset, email verification). Resend integration. |
| M8 | Pre-launch polish | RTL structural prep. Performance (Lighthouse, image optimization, caching). Accessibility (WCAG 2.1 AA for key flows). Monitoring (Sentry, structured logs, alerting). Legal review (PDPL retention sign-off, Privacy Policy, T&Cs, Returns Policy texts). End-to-end threat model re-read. Readiness checklist sign-off. |

**Post-MVP** (not in scope of this spec): real AI support assistant, real reviews system, real promo code engine, Arabic content translation, B2B/wholesale portal, customer MFA, warehouse automation, same-day delivery enablement.

### Reason for the decision

1. **Single-thread execution.** BOB v5 + Claude Code / Codex executes serially. Parallel tracks (1C) are theoretical for a single-developer + AI-agent project.
2. **No throwaway scaffolding.** Vertical-slice (1B) would build minimal versions of multiple subsystems in M1 that get rewritten in M2-M3. Linear avoids this churn.
3. **Clean v5 invocations.** Each milestone has stable inputs from the prior milestone, tight scope, well-bounded definition of done.
4. **HIGH_RIGOR boundaries align with the milestones.** Cross-check sweeps land at M2 (admin auth), M3 (public RLS), M4 (cart/checkout server authority), M5 (Paymob HMAC + adversarial tests), M6 (iCarry webhooks), M7 (order transitions + email content), M8 (pre-launch full re-read). Each cross-check is self-contained.
5. **Working end-to-end flow at M4.** Even though M5 (real payments) hasn't shipped, the stub `PaymentAdapter` lets M4 produce an end-to-end demonstrable flow. The owner can click through a real shop at M4 with stub money.

### Rejected alternatives

- **Candidate 1B — Vertical slice.** Rejected because M1 would touch 5+ subsystems thinly, accumulate technical debt, and force rework in M2-M3. Vertical-slice patterns fit design-iteration prototypes; this project is a production build where each subsystem must hit a production-quality bar from the start.
- **Candidate 1C — Parallel tracks.** Rejected because the execution model is single-threaded. Track-handoff overhead (admin's data assumptions vs public's expectations) adds spec complexity without compensating execution speedup.

### Execution refinement (preserved from Phase 3)

M5 and M6 may be split internally during execution if v5 finds either too large for a single invocation:

- M5.1 Paymob sandbox integration (adapter + sandbox tests pass)
- M5.2 Paymob live cutover (production credentials + live test transaction + monitoring)
- M6.1 iCarry sandbox/integration
- M6.2 iCarry live cutover

This is an execution-time decision the v5 invocation can make. The master spec defines M5 and M6 as single milestones each with two phases.

### Impact on `proj_spec.md`

- This sequence is the canonical milestone list in the master spec.
- Each milestone gets its own section with: scope, dependencies, definition of done, HIGH_RIGOR posture, cross-check requirements, files touched, v5 invocation hint.
- Post-MVP items are listed in priority order but not detailed.

### Assumptions and future migration paths

- **Assumption:** the owner accepts that M5 ships before any live commerce can occur. The `commerce_enabled` feature flag stays off until M5 sign-off.
- **Assumption:** if M6 verification at `CONTEXT_EXPANSION_NOTES.md` §4 surfaces that iCarry's API is inadequate, the engineer pivots to a documented alternative (direct Aramex / Emirates Post / Shipox / Postaplus) without changing the `ShippingAdapter` interface. The milestone retains scope but the concrete adapter implementation differs.
- **Future migration:** if catalog growth or business demands require parallelization, the milestone sequence can be re-planned after MVP. The boundaries (data layer / admin / public / commerce / payments / delivery / orders / polish) remain natural seams.

---

## Decision 2 — Database design philosophy

### What was decided

**Candidate 2C — Hybrid relational + JSONB.**

**Relational columns** for any field that participates in WHERE / ORDER BY / JOIN / index / RLS condition / aggregate:
- `id`, `slug`, `name`, `name_raw`, `brand_id`, `category_id`, `source_category`, `source_row`, `source_notes`, `form`, `retail_price_aed`, `wholesale_price_internal`, `status`, `is_public_visible`, `is_add_to_cart_enabled`, `is_checkout_enabled`, `completion_score`, `featured_score`, `created_at`, `updated_at`, `published_at`

**JSONB columns** for content payloads read together for display but never filtered:
- `content` — `description`, `benefits[]`, `directions_of_use`, `storage_instructions`, `warnings`, `seo_title`, `seo_description`, `often_bought_with_ids[]`
- `label_data` — `nutrition_panel` (structured object per v1.1 §9), `ingredients`, `allergens[]`, `manufacturing_facility_warnings`
- `fields_status` — the per-field status object per v1.1 §5.1
- `admin_review_flags` — the boolean flag object per v1.1 §5.4

**Relational child tables** kept relational:
- `product_variants` (joins with stock, indexes on variant)
- `product_images` (joins, ordering)
- `product_goal_tags` (junction table for goal filtering)
- `brands`, `categories`, `goals`
- `customers`, `addresses`, `orders`, `order_items`
- `payment_events`, `shipment_events`
- `audit_log`, `feature_flags`, `slug_history`
- `support_conversations` (Phase 2 AI)

### Reason for the decision

1. **Query shape match.** PDP reads need everything in one shot — JSONB delivers that. Listing and filtering need indexed columns — relational delivers that. The hybrid serves both natural query patterns.
2. **Field-level status is naturally JSON.** v1.1 §5 defines a 14-key object. Modeling as 14 columns is bloat; modeling as a separate table is over-normalization. A JSONB column with a GIN index lets queries like "all products with `fields_status.image='missing'`" stay fast (~ms at our scale).
3. **Type safety where it matters.** Relational columns get strong Postgres type enforcement + auto-generated TypeScript types from Supabase. JSONB columns get hand-written TypeScript interfaces parsed/validated at the repository boundary. This pattern is documented and well-supported.
4. **Variants stay relational.** They have FKs, stock fields that update independently, indexes for low-stock queries. JSON arrays would be wrong.
5. **Future scalability.** Postgres handles JSONB at ~10x current catalog scale (5,000-10,000 products) without strain. Relational indexes carry the hot paths.

### Rejected alternatives

- **Candidate 2A — Mostly relational.** Rejected because supplement panel and field statuses force awkward normalization (separate tables per JSON structure). Schema becomes 40-60 columns wide. PDP queries need 5+ joins. Iteration is slow — every new field requires a migration. Not worth the tradeoff for our flexibility needs.
- **Candidate 2B — JSON-heavy.** Rejected because search and filter performance degrades, type safety degrades, RLS conditions on JSON paths feel wrong, generated types are useless for the JSON column, and variant uniqueness constraints become impossible inside JSON arrays. Phase 2 features like "products with at least 25g protein per serving" make JSON-only definitively wrong.

### Impact on `proj_spec.md` and supporting files

- M1 (Data layer) defines the schema per this decision.
- `DB_SCHEMA.md` is the source-of-truth schema document with all tables, columns, RLS policies, indexes.
- `src/server/repositories/*` is the only access point to the database. It handles JSON parsing and validation at the boundary using Zod schemas defined in `src/lib/validation/`.
- `src/types/product.ts` defines both relational record shapes and JSON content interfaces.

### Assumptions and future migration paths

- **Assumption:** the catalog stays in the same Supabase Postgres instance through MVP. Scaling beyond ~50,000 products may justify partitioning, materialized views, or a separate search engine (Meilisearch / Algolia).
- **Future migration:** if Phase 2 introduces typo-tolerant search, the search engine sits outside Postgres as a read-side projection from `products`. No schema change required.

---

## Decision 3 — Admin portal architecture

### What was decided

**Candidate 3A — Same Next.js app with admin route group + single `admin` role for MVP.**

- The admin portal lives in `src/app/admin/*` within the same Next.js application as the public site.
- Authentication via Supabase Auth with role differentiation by `auth.users.app_metadata.role === 'admin'`.
- **Admin MFA enforcement required** — TOTP enrollment forced on first admin signin; cannot proceed past first signin without MFA.
- **Three defense layers** on every admin action:
  1. Server-side `requireAdmin()` helper called by every admin server action.
  2. RLS policies at the database layer that double-check role for admin-only writes.
  3. Audit log entry written for every admin mutation.
- Single `admin` role for MVP. Multi-role (`viewer`, `catalog_editor`, `publisher`, `admin`) documented as Phase 2 migration path.

### Reason for the decision

1. **Single developer + AI agent execution model.** Two apps means two builds, two deploys, two CI pipelines — friction that doesn't pay off at this team size.
2. **Three protection layers are sufficient.** Server-side authz check + RLS at the DB + MFA on signin. Three layers of defense in depth. The same-domain "weakness" of 3A is theoretical at this scale.
3. **Matches the already-authored `PROJECT_STRUCTURE.md`.** No rework.
4. **Vercel cost stays within one plan tier.** Separate apps may push into higher-cost tiers.
5. **Future migration is mechanical, not a redesign.** If business demand later requires stronger isolation (admin team > 10 people, compliance demands, etc.), the admin can be extracted to its own deploy. Because admin code lives in `src/app/admin/*` and `src/features/admin-*/`, extraction is a packaging change, not a schema or logic change.

### Rejected alternatives

- **Candidate 3B — Separate deploys.** Rejected for MVP because the two-repo overhead (type sharing, component reuse, two CI pipelines, two deploys per release) costs more than the security gain at this scale. Keeping it as a documented future migration path preserves the option.
- **Candidate 3C — Hybrid monorepo with domain split.** Rejected because middleware-based routing rules add subtle failure modes without significantly improving security over 3A. The runtime is shared anyway.

### Impact on `proj_spec.md` and supporting files

- Admin portal is built within the same Next.js app per `PROJECT_STRUCTURE.md`.
- M2 builds admin auth + MFA + product editor + image upload + audit log.
- `ADMIN_PORTAL_SPEC.md` documents the same-app architecture, the role model (single role for MVP), the migration path to 3B, and the future multi-role schema migration.
- Every admin server action calls `requireAdmin()` from `src/lib/auth/policies.ts`. This is enforced by code review and a runtime check at the action handler boundary.

### Assumptions and future migration paths

- **Assumption:** the admin team starts at 1-3 people. Trusted operators. Single role suffices.
- **Future migration to multi-role:** add `roles` JSON column to `auth.users.app_metadata`. Define role constants in `src/features/auth/rbac.ts`. Replace `requireAdmin()` with `requireRole(role)` calls. RLS policies updated to check role membership. Phase 2 deliverable.
- **Future migration to separate deploy (3B):** extract `src/app/admin/*` and `src/features/admin-*/` to a new repo. Share types via `@vitaminaty/types` workspace package. Set up separate Vercel project. Configure DNS for `admin.vitaminaty.ae`. Update env vars to route admin Supabase calls through a separate URL pool if needed. Done. Mechanical work.

---

## Decision 4 — Feature flag rollout strategy

### What was decided

Three tiers of feature flags, stored in a Supabase table with env-var escape hatch, evaluated server-side only.

#### Surface-level flags (gate entire surfaces)

| Flag | Default | Flips when |
|---|---|---|
| `public_storefront_enabled` | `false` | M3 complete + sign-off |
| `admin_portal_enabled` | `true` | M0 (admins need access from day one) |
| `commerce_enabled` | `false` | M5 complete + Paymob test transactions pass |
| `customer_signup_enabled` | `false` | M3 or M4 (per soft-launch decision) |
| `support_chat_enabled` | `false` (default true if placeholder shown) | M0 / decision at M8 |

#### Feature-level flags (gate specific behaviors)

| Flag | Default | Flips when |
|---|---|---|
| `cart_visible` | `false` | M4 complete |
| `checkout_enabled` | `false` | M4 complete + M5 paymob staging |
| `paymob_live_mode` | `false` | M5 complete + Paymob live test passes |
| `icarry_live_mode` | `false` | M6 complete |
| `transactional_emails_enabled` | `false` | M7 complete |
| `notify_me_enabled` | `false` | Phase 2 |
| `reviews_enabled` | `false` | Phase 2 |
| `promo_codes_enabled` | `false` | Phase 2 |
| `wishlist_enabled` | `false` | Phase 2 |
| `arabic_rtl_enabled` | `false` | Phase 2 |
| `same_day_delivery_enabled` | `false` | Phase 2 |
| `customer_mfa_enabled` | `false` | Phase 2 |

#### Operational flags (admin operability)

| Flag | Default | Flips when |
|---|---|---|
| `maintenance_mode` | `false` | Manual — incidents only |
| `read_only_mode` | `false` | Manual — incidents only |
| `feature_flag_admin_ui` | `true` | M0 |

#### HIGH_RIGOR-gated flips

These flags must not flip on until the corresponding HIGH_RIGOR cross-check completes:

| Flag | Gating cross-check |
|---|---|
| `commerce_enabled` | M4 (server-side totals + idempotency) AND M5 (Paymob HMAC + webhook idempotency) |
| `paymob_live_mode` | M5 full HIGH_RIGOR sweep — adversarial tests pass, sandbox + live test transactions pass |
| `icarry_live_mode` | M6 cross-check |
| `transactional_emails_enabled` | M7 cross-check (no PII over-disclosure) |
| `customer_signup_enabled` | M3 cross-check (PII handling, RLS for customer data) |
| `public_storefront_enabled` | M3 cross-check (RLS for product reads, wholesale price isolation) |

#### Storage and evaluation

- Stored in Supabase table `feature_flags(key, enabled, description, updated_at, updated_by)`.
- Evaluated through `src/features/feature-flags/eval.ts` with this precedence:
  1. Env override (`FF_{KEY}=true|false`) — escape hatch for incidents.
  2. Database value — default operational mode.
- Server-side evaluation only. Client components receive boolean props, not flag keys.

### Reason for the decision

1. **Staged-capable infrastructure is already locked.** This strategy operationalizes it.
2. **Defaults always favor safety.** Every commerce-affecting flag defaults `false`. Flipping a flag is a deliberate act with sign-off.
3. **Cross-check ties to flag flips, not to milestone completion alone.** A milestone can be "complete" with code merged but the flag stays off until the cross-check signs off. Prevents an enthusiastic merge from accidentally exposing untested commerce paths.
4. **Public launch is independent of milestone completion.** Flipping `public_storefront_enabled` is the explicit launch decision, separate from "M3 done." The owner controls the launch moment.
5. **Env escape hatch.** During an incident, an env var can override a database flag without requiring database access.

### Rejected alternatives

None. No rival candidate makes sense for this. The flag set follows directly from the milestone structure and the staged-capable decision.

### Impact on `proj_spec.md` and supporting files

- M0 includes `feature_flags` table + `eval.ts` + admin UI for toggling flags.
- Every subsequent milestone's "definition of done" includes "the corresponding flag(s) can be turned on without breaking the site" — but the actual flip is a separate manual step.
- `PROJECT_STATE.md` §8 launch readiness checklist is restated in terms of flag flips (which flags need to be on for launch).
- `THREAT_MODEL.md` §7 cross-check requirements are tied explicitly to flag flips.

### Assumptions and future migration paths

- **Assumption:** the admin team operates the flag toggles via the admin UI. The env escape hatch is for break-glass scenarios.
- **Future migration:** if the project scales to require per-user / per-segment flag targeting (A/B tests, beta cohorts), the flag table can extend with a `conditions` JSONB column and `eval.ts` can grow to evaluate predicates. Not needed for MVP.

---

## Cross-cutting assumptions captured

These assumptions affect multiple decisions and should be flagged for the master spec:

1. **Single-developer + AI-agent execution.** All decisions assume this model. If team scales to multiple parallel engineers, several decisions (especially admin portal architecture and milestone parallelization) may revisit.
2. **Catalog scale ~787 products at MVP, ~5,000-10,000 in 18 months.** All schema and query decisions assume this scale.
3. **Single Supabase project for all environments (separate projects per environment, but single project per environment).** No multi-tenant fan-out, no per-region database. Acceptable for UAE-only launch.
4. **Vercel as the deploy target.** All edge-related decisions (image optimization, ISR caching strategy, middleware) assume Vercel.
5. **Paymob is the payment gateway commitment.** Migration to a different gateway is possible because of the adapter pattern, but no architecture decision in this spec contemplates it as likely.
6. **iCarry is the working assumption for shipping** with the documented fallback (`CONTEXT_EXPANSION_NOTES.md` §4) if M6 verification surfaces an inadequate API.
7. **UAE PDPL retention policies in `THREAT_MODEL.md` are recommended-pending-legal-review**, not final. M8 includes the legal sign-off step.
8. **AI customer support is post-MVP**, structurally prepared via `SupportChatProvider` interface and null implementation. No AI implementation in this spec.

---

## Decision authority

| Decision | Authority | Re-open process |
|---|---|---|
| Milestone sequence | Project owner | Return to Phase 3 with new candidate sequencing |
| Database schema philosophy | Project owner | Return to Phase 3 (this is a foundational decision; do not change after M1 ships) |
| Admin portal architecture | Project owner | After MVP, decision can be revisited under Phase 2 planning |
| Feature flag strategy | Project owner | Flag inventory can extend per milestone without re-opening the strategy |

---

## Update log

| Date | Author | Change |
|---|---|---|
| 2026-05-21 | Spec Architect | Initial decision capture after Phase 3 approval. |

---

_End of `DECISION_CAPTURE.md` v1.0. Inputs locked for Phase 5 spec authorship._
