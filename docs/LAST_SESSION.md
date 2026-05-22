# LAST_SESSION.md

**Project:** Vitaminaty
**Last updated:** 2026-05-22
**Milestone:** M1 - Data layer, Step 1
**Status:** complete

---

## What changed

- Started M1 from the M0 final-audit baseline.
- Added the root middleware authz-model comment: session refresh only; route handlers enforce access decisions.
- Hardened `requiredSecret` in `src/lib/env.ts` with `.trim()` before length validation.
- Added an env unit test covering whitespace-trimmed required secrets.
- Recorded the Supabase JWT prefix-collision bundle-scan rule in `docs/THREAT_MODEL.md` residual risk and update history.
- Updated `docs/PROJECT_STATE.md` §6 to mark the M0 verification debt items as cleared, deferred, or owned by M1 Step 2.
- Appended the M1 entry recon report to `docs/PROJECT_STATE.md`.

## Files touched

- `src/middleware.ts`
- `src/lib/env.ts`
- `tests/unit/env.test.ts`
- `docs/THREAT_MODEL.md`
- `docs/PROJECT_STATE.md`
- `docs/LAST_SESSION.md`

## Verification

- `pnpm typecheck` exited 0.
- `pnpm lint` exited 0.
- `pnpm build` exited 0.
- `pnpm test -- env` exited 0.
- `pnpm format:check` exited 0.
- Marker checks passed for `authz`, `.trim()`, `JWT prefix`, and `Recon — M1 entry`.

## Recon summary

- `supabase/migrations/0005_feature_flags.sql` and `supabase/seed/feature-flags.sql` are still prepared but not applied.
- Existing migration placeholders: `0001_initial_schema.sql`, `0002_products_brands_categories.sql`, `0003_orders_cart_payments.sql`, `0004_audit_log.sql`, `0006_support_chat.sql`, `0007_rls_policies.sql`.
- `pnpm exec supabase --version`: unavailable in current workspace.
- `pnpm exec tsx --version`: unavailable in current workspace.
- Docker CLI: unavailable in current workspace.
- `src/lib/supabase/types.generated.ts` exists.

## Current blocker

None for Step 1. Supabase CLI and Docker absence is recorded for Step 2 preparation; per prompt this does not block Step 1.

## Next action

Execute M1 Step 2. Read `docs/DB_SCHEMA.md` §2–§8 and §10 before changing migrations.

## Debug sweep — M1 Step 1

- Result: clean
- DoD commands: `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test -- env`, and `pnpm format:check` exited 0.
- Marker checks passed for `authz`, `.trim()`, `JWT prefix`, and `Recon — M1 entry`.
- Files modified during sweep: `docs/LAST_SESSION.md`

## Debug sweep — M1 Step 2

- Result: escalated
- Reason: M1 Step 2 implementation artifacts are not present on disk. `supabase/migrations/` still contains the pre-Step-2 placeholder layout including `supabase/migrations/0005_feature_flags.sql`; the expected `0001_extensions_and_enums.sql` through `0008_support_chat.sql` files are absent.
- Hard-gate command attempted: `pnpm exec supabase db reset`.
- Failure: `Command "supabase" not found`; local Supabase CLI is not installed in the workspace, and Docker was already recorded as unavailable in the M1 Step 1 recon.
- Files modified during sweep: `docs/LAST_SESSION.md`
- HIGH_RIGOR note: no migration files, package scripts, dependencies, or schema content were changed during this sweep.

## Cross-check evidence — Step 2

# CROSS-CHECK EVIDENCE — Step 2 — Schema migrations

## 1. Extensions enabled

NO EVIDENCE — gap at `supabase/migrations/0001_extensions_and_enums.sql:1`; expected file is absent.

Observed stale placeholder:

`supabase/migrations/0001_initial_schema.sql:1`

```sql
-- TODO(M1): Initial schema migration.
```

## 2. All ENUM types verbatim per §3

NO EVIDENCE — gap at `supabase/migrations/0001_extensions_and_enums.sql:1`; expected file is absent.

Missing evidence for:
- `product_status`
- `product_form`
- `goal_tag`
- `order_status`
- `payment_method`
- `payment_event_kind`
- `shipment_status`
- `image_kind`
- `audit_action`

Observed stale placeholder:

`supabase/migrations/0001_initial_schema.sql:1`

```sql
-- TODO(M1): Initial schema migration.
```

## 3. `products` table integrity

NO EVIDENCE — gap at `supabase/migrations/0003_products.sql:1`; expected file is absent.

Observed stale placeholder:

`supabase/migrations/0002_products_brands_categories.sql:1`

```sql
-- TODO(M1): Products, brands, and categories migration.
```

No evidence found for `CREATE TABLE products`, `wholesale_price_internal`, `slug text NOT NULL UNIQUE`, table CHECK constraints, or absence of RLS in the expected Step 2 file.

## 4. `customers` table

NO EVIDENCE — gap at `supabase/migrations/0004_customers_addresses.sql:1`; expected file is absent.

No evidence found for `CREATE TABLE customers`, `REFERENCES auth.users(id) ON DELETE CASCADE`, or `deleted_at`.

## 5. `addresses` table

NO EVIDENCE — gap at `supabase/migrations/0004_customers_addresses.sql:1`; expected file is absent.

No evidence found for `CREATE TABLE addresses`, `customer_id` FK, or `addresses_one_default_per_customer`.

## 6. `orders` table

NO EVIDENCE — gap at `supabase/migrations/0005_orders.sql:1`; expected file is absent.

Observed stale placeholder:

`supabase/migrations/0003_orders_cart_payments.sql:1`

```sql
-- TODO(M1): Orders, cart, and payments migration.
```

No evidence found for `ship_to jsonb NOT NULL`, frozen-total CHECK constraints, `idempotency_key text NOT NULL UNIQUE`, or `reference text NOT NULL UNIQUE`.

## 7. `order_items` table

NO EVIDENCE — gap at `supabase/migrations/0005_orders.sql:1`; expected file is absent.

Observed stale placeholder:

`supabase/migrations/0003_orders_cart_payments.sql:1`

```sql
-- TODO(M1): Orders, cart, and payments migration.
```

No evidence found for `CHECK (quantity > 0)` or `CHECK (line_total_aed >= 0)`.

## 8. `payment_events` append-only shape

NO EVIDENCE — gap at `supabase/migrations/0006_events.sql:1`; expected file is absent.

No evidence found for `CREATE TABLE payment_events`, `UNIQUE(provider, provider_transaction_id, kind)`, `raw_payload jsonb NOT NULL`, `signature_received text`, or `recorded_at timestamptz NOT NULL DEFAULT now()`.

No 0006 events migration exists to inspect for policy absence. Observed stale file with same number:

`supabase/migrations/0006_support_chat.sql:1`

```sql
-- TODO(P1): Support chat migration.
```

## 9. `shipment_events`

NO EVIDENCE — gap at `supabase/migrations/0006_events.sql:1`; expected file is absent.

No evidence found for `CREATE TABLE shipment_events` or append-only event shape.

Observed stale file with same number:

`supabase/migrations/0006_support_chat.sql:1`

```sql
-- TODO(P1): Support chat migration.
```

## 10. `audit_log`

NO EVIDENCE — gap at `supabase/migrations/0007_operations.sql:1`; expected file is absent.

Observed stale placeholder:

`supabase/migrations/0004_audit_log.sql:1`

```sql
-- TODO(M1): Audit log migration.
```

No evidence found for `actor_user_id REFERENCES auth.users(id)`, `actor_email`, `diff jsonb`, or the three expected indexes.

## 11. `feature_flags`

NO EVIDENCE — gap at `supabase/migrations/0007_operations.sql:1`; expected file is absent.

Stale pre-Step-2 feature flag migration still exists at `supabase/migrations/0005_feature_flags.sql`. Verbatim evidence:

`supabase/migrations/0005_feature_flags.sql:1-12`

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
```

Additional stale RLS/policy/seed content present in the same file:

`supabase/migrations/0005_feature_flags.sql:14-30`

```sql
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
```

`supabase/migrations/0005_feature_flags.sql:32-57`

```sql
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

## 12. No RLS enabled in 0001–0008

NO EVIDENCE — gap at local database query; `SUPABASE_LOCAL_DB_URL` is not set and local Supabase was not available.

Command requested:

```bash
psql "$SUPABASE_LOCAL_DB_URL" -c "select relname, relrowsecurity from pg_class where relkind='r' and relnamespace='public'::regnamespace order by relname;"
```

Observed output:

```text
SUPABASE_LOCAL_DB_URL not set
psql_exit=
```

Static file evidence shows stale RLS is present in the old feature flags migration:

`supabase/migrations/0005_feature_flags.sql:14`

```sql
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
```

## 13. Migration file inventory

Command equivalent: `ls supabase/migrations/`

Observed output:

```text
0001_initial_schema.sql
0002_products_brands_categories.sql
0003_orders_cart_payments.sql
0004_audit_log.sql
0005_feature_flags.sql
0006_support_chat.sql
0007_rls_policies.sql
```

NO EVIDENCE — gap against expected 8 Step 2 files. Expected files are absent:

```text
0001_extensions_and_enums.sql
0002_reference_tables.sql
0003_products.sql
0004_customers_addresses.sql
0005_orders.sql
0006_events.sql
0007_operations.sql
0008_support_chat.sql
```

## 14. Idempotency

NO EVIDENCE — gap at `pnpm exec supabase db reset`; not run twice successfully.

Prior observed hard-gate output from M1 Step 2 sweep:

```text
undefined
 ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL  Command "supabase" not found
'supabase' is not recognized as an internal or external command,
operable program or batch file.
```

Exit code:

```text
first db reset: 1
second db reset: NO EVIDENCE — not run because first hard gate failed and current task is read-only.
```

## 15. PDPL residency posture (informational)

`docs/THREAT_MODEL.md:223-225`

```md
- **Retention (recommended policy — pending legal/accounting confirmation at M8):** Order data retained **minimum 5 years for VAT/accounting (UAE Federal Decree-Law No. 28 of 2022)**; **7 years recommended pending legal review**. Inactive customer accounts (no signin or order in **24 months**) flagged for review and may be purged after admin approval. Marketing consent records retained while customer exists; withdrawal events retained 5+ years as compliance proof. Audit log retained indefinitely (append-only). Payment events retained 5+ years for reconciliation. Customer deletion under PDPL Article 16: PII fields zeroed but order line items retained (customer_id nulled, `deleted_at` timestamp set). See `CONTEXT_EXPANSION_NOTES.md` §5 for full retention policy and the M8 legal-review checklist.
- **Access & erasure.** Customer can export their data via account → "Download my data" (returns JSON of their PII + order history). Customer can request deletion via support; deletion zeroes PII fields but retains order line items (anonymized) for accounting.
- **Cross-border transfer.** Supabase region must be EU or UAE-compatible (Supabase offers `eu-central-1`, `eu-west-2`, etc. — pick `eu-central-1` for proximity + PDPL adequacy). Vercel deploys to edge but customer PII flows route through `iad1` or `fra1` region — preference `fra1` (Frankfurt) for PDPL-friendly residency.
```

## Meta-model cross-check instructions

- Verify items 1–15 against docs/DB_SCHEMA.md and docs/THREAT_MODEL.md.
- Confidence [HIGH | MEDIUM | LOW]. Severity [BLOCKER | MAJOR | MINOR].
- If gaps found, decide: fix before Step 3 (recommended) or log in PROJECT_STATE.md §6 Deviations.

Verdict line: PRINTED — awaiting meta-model review.

## Debug sweep — M1 Step 3

- Result: escalated
- Reason: M1 Step 3 RLS implementation artifacts are not present on disk. `supabase/migrations/0009_rls_policies.sql` is missing.
- Prerequisite blocker: M1 Step 2 is still escalated. `supabase/migrations/` still contains the pre-Step-2 placeholder layout, including stale `supabase/migrations/0005_feature_flags.sql`; the expected `0001_extensions_and_enums.sql` through `0008_support_chat.sql` files are absent.
- Hard-gate status: negative tests were not run because the RLS migration and the underlying Step 2 schema are absent, and local Supabase CLI previously failed with `Command "supabase" not found`.
- Files modified during sweep: `docs/LAST_SESSION.md`
- HIGH_RIGOR note: no RLS policy, migration, schema, package, or test files were changed during this sweep.
