# LAST_SESSION.md

**Project:** Vitaminaty
**Last updated:** 2026-05-22
**Milestone:** M1 - Data layer
**Step:** Step 3 - RLS policies 0009
**Status:** complete

---

## What succeeded

- Added `supabase/migrations/0009_rls_policies.sql`.
- Created `is_admin()` from `docs/DB_SCHEMA.md` Section 9.1.
- Enabled RLS on all 19 public M1 tables.
- Added explicit DB_SCHEMA.md Section 9 policies plus prose-derived policies for product child tables, categories, goals, and `md_category_mapping`.
- Kept `payment_events`, `shipment_events`, and `audit_log` append-only from client roles: each has admin SELECT only and no INSERT/UPDATE/DELETE policies.
- Applied wholesale column isolation for `products.wholesale_price_internal`.
- Used a transient real-session Supabase JS smoke test for customer order isolation, then deleted the script so TypeScript/lint scopes stay clean.

## Files touched

- `supabase/migrations/0009_rls_policies.sql`
- `docs/PROJECT_STATE.md`
- `docs/THREAT_MODEL.md`
- `docs/LAST_SESSION.md`

## Verification

- `pnpm typecheck` passed.
- `pnpm lint` passed.
- `pnpm build` passed.
- `pnpm exec supabase db reset` passed.
- `pnpm exec supabase db reset` idempotency gate passed twice in a row: exit codes `0`, `0`.
- `is_admin()` count returned `1`.
- Public tables with RLS enabled returned `19`.
- `products_public_read` policy count returned `1`.
- `anon` SELECT privilege on `products.wholesale_price_internal` returned `0`.
- INSERT/UPDATE/DELETE policies on `payment_events`, `shipment_events`, and `audit_log` returned `0`.
- Negative test 1: `set role anon; select wholesale_price_internal from products limit 1; reset role;` failed with permission denied. Postgres reported `permission denied for table products` because the implementation uses column-subset SELECT grants to enforce wholesale isolation.
- Negative test 2: real Supabase JS session for customer A saw `0` of customer B's orders and `1` of its own seeded orders.

## Notes

- The expected psql wording in the Step 3 prompt was `permission denied for column wholesale_price_internal`. Local Postgres does not produce that wording for a secure column-subset SELECT grant model; it reports table-level permission denial when a denied column is selected. This deviation is recorded in `docs/PROJECT_STATE.md` for cross-check.
- The transient smoke test did not use `set_config('request.jwt.claims', ...)`; it used `auth.admin.createUser`, `signInWithPassword`, and session-carrying Supabase JS clients.
- Local PostgREST needed a container restart after reset before the real-session smoke test saw the fresh schema cache.

## Intended next step

Execute M1 Step 4 seed data. Read `docs/PRODUCT_CONTENT_SPEC_v1.1_ADMIN_DRIVEN.md` Sections 12.2, 13.1, 13.3, and 15, plus `docs/DECISION_CAPTURE.md` Section 4.
