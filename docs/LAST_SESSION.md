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

## Cross-check evidence — Step 3 (RLS)

# CROSS-CHECK EVIDENCE — Step 3 — RLS policies

## 1. `is_admin()` body verbatim per §9.1

NO EVIDENCE — gap at `supabase/migrations/0009_rls_policies.sql:1`; file is missing.

DB_SCHEMA.md §9.1 source block:

`docs/DB_SCHEMA.md:667-672`

```sql
CREATE OR REPLACE FUNCTION is_admin() RETURNS boolean AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
$$ LANGUAGE sql STABLE;
```

## 2. RLS enabled on every PII/admin-only table

NO EVIDENCE — gap at `supabase/migrations/0009_rls_policies.sql:1`; file is missing.

Requested command:

```bash
psql "$SUPABASE_LOCAL_DB_URL" -c "select relname, relrowsecurity from pg_class where relkind='r' and relnamespace='public'::regnamespace order by relname;"
```

Runtime evidence unavailable: `SUPABASE_LOCAL_DB_URL` is not set and local Supabase CLI was previously unavailable.

## 3. `wholesale_price_internal` column-level isolation

NO EVIDENCE — gap at `supabase/migrations/0009_rls_policies.sql:1`; file is missing.

DB_SCHEMA.md §9.2 source lines for expected REVOKE/GRANT:

`docs/DB_SCHEMA.md:691-696`

```sql
-- Wholesale price is never selectable by anon/customer
-- This is enforced at the application layer via repository queries
-- that explicitly exclude the column. Postgres RLS column-level security
-- is also configured:
REVOKE SELECT (wholesale_price_internal) ON products FROM anon, authenticated;
GRANT SELECT (wholesale_price_internal) ON products TO service_role;
```

Requested privilege query:

```bash
psql "$SUPABASE_LOCAL_DB_URL" -c "select grantee, privilege_type from information_schema.column_privileges where table_name='products' and column_name='wholesale_price_internal' order by grantee, privilege_type;"
```

Runtime evidence unavailable: local database not available.

## 4. products_public_read

NO EVIDENCE — gap at `supabase/migrations/0009_rls_policies.sql:1`; file is missing.

DB_SCHEMA.md §9.2 source block:

`docs/DB_SCHEMA.md:677-689`

```sql
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Public can read only published & visible products
CREATE POLICY products_public_read ON products
  FOR SELECT TO anon, authenticated
  USING (is_public_visible = true AND status = 'published');

-- Admin can read everything
CREATE POLICY products_admin_all ON products
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());
```

Expected predicate to confirm: `USING (is_public_visible = true AND status = 'published')`.

## 5. customers_self_read

NO EVIDENCE — gap at `supabase/migrations/0009_rls_policies.sql:1`; file is missing.

DB_SCHEMA.md §9.4 source block:

`docs/DB_SCHEMA.md:721-735`

```sql
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY customers_self_read ON customers
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY customers_self_update ON customers
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY customers_admin_read ON customers
  FOR SELECT TO authenticated
  USING (is_admin());
```

Expected predicate to confirm: `USING (id = auth.uid())`.

## 6. addresses_self_all

NO EVIDENCE — gap at `supabase/migrations/0009_rls_policies.sql:1`; file is missing.

DB_SCHEMA.md §9.4 source block:

`docs/DB_SCHEMA.md:738-747`

```sql
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY addresses_self_all ON addresses
  FOR ALL TO authenticated
  USING (customer_id = auth.uid())
  WITH CHECK (customer_id = auth.uid());

CREATE POLICY addresses_admin_read ON addresses
  FOR SELECT TO authenticated
  USING (is_admin());
```

Expected clauses to confirm: `USING (customer_id = auth.uid())` and `WITH CHECK (customer_id = auth.uid())`.

## 7. orders_self_read + orders_admin_all

NO EVIDENCE — gap at `supabase/migrations/0009_rls_policies.sql:1`; file is missing.

DB_SCHEMA.md §9.5 source block:

`docs/DB_SCHEMA.md:753-762`

```sql
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY orders_self_read ON orders
  FOR SELECT TO authenticated
  USING (customer_id = auth.uid());

CREATE POLICY orders_admin_all ON orders
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());
```

Expected admin invocation to confirm: `is_admin()`.

## 8. order_items via EXISTS subquery

NO EVIDENCE — gap at `supabase/migrations/0009_rls_policies.sql:1`; file is missing.

DB_SCHEMA.md §9.5 source block:

`docs/DB_SCHEMA.md:764-776`

```sql
-- order_items: same pattern, joined to order
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY order_items_self_read ON order_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM orders o WHERE o.id = order_items.order_id AND o.customer_id = auth.uid()
  ));

CREATE POLICY order_items_admin_all ON order_items
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());
```

Expected EXISTS pattern to confirm: `SELECT 1 FROM orders o WHERE o.id = order_items.order_id AND o.customer_id = auth.uid()`.

## 9. Append-only ledgers — no write policies

NO EVIDENCE — gap at `supabase/migrations/0009_rls_policies.sql:1`; file is missing.

DB_SCHEMA.md §9.6 source block:

`docs/DB_SCHEMA.md:781-795`

```sql
ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_events ENABLE ROW LEVEL SECURITY;

-- No SELECT for anon or authenticated (except admin)
CREATE POLICY payment_events_admin_read ON payment_events
  FOR SELECT TO authenticated
  USING (is_admin());

CREATE POLICY shipment_events_admin_read ON shipment_events
  FOR SELECT TO authenticated
  USING (is_admin());

-- INSERT only via service role (webhook handlers)
-- No UPDATE or DELETE policies — append-only by design.
```

DB_SCHEMA.md §9.7 source block:

`docs/DB_SCHEMA.md:801-808`

```sql
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_log_admin_read ON audit_log
  FOR SELECT TO authenticated
  USING (is_admin());

-- INSERT via service role only.
-- No UPDATE or DELETE policies.
```

Requested policy inventory query:

```bash
psql "$SUPABASE_LOCAL_DB_URL" -c "select tablename, cmd, policyname from pg_policies where schemaname='public' and tablename in ('payment_events','shipment_events','audit_log') order by tablename, cmd;"
```

Runtime evidence unavailable: local database not available.

## 10. support_conversations + support_messages

NO EVIDENCE — gap at `supabase/migrations/0009_rls_policies.sql:1`; file is missing.

DB_SCHEMA.md §9.9 source block:

`docs/DB_SCHEMA.md:831-852`

```sql
ALTER TABLE support_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;

-- Customer reads their own conversations
CREATE POLICY support_convo_self_read ON support_conversations
  FOR SELECT TO authenticated
  USING (customer_id = auth.uid());

-- Admin reads all
CREATE POLICY support_convo_admin_all ON support_conversations
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Messages follow conversation visibility
CREATE POLICY support_msg_via_convo ON support_messages
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM support_conversations c
    WHERE c.id = support_messages.conversation_id
    AND (c.customer_id = auth.uid() OR is_admin())
  ));
```

Expected support_messages clause to confirm: `AND (c.customer_id = auth.uid() OR is_admin())`.

## 11. Negative test 1 — anon CANNOT read wholesale_price_internal

NO EVIDENCE — gap at runtime negative test; `supabase/migrations/0009_rls_policies.sql` is missing and local database is unavailable.

Requested command:

```bash
psql "$SUPABASE_LOCAL_DB_URL" -c "set role anon; select wholesale_price_internal from products limit 1; reset role;"
```

Expected result:

```text
ERROR: permission denied for column wholesale_price_internal
```

Recorded result: NO EVIDENCE — not run.

## 12. Negative test 2 — customer A cannot read customer B's orders

NO EVIDENCE — gap at runtime negative test; no RLS smoke script or Step 3 handoff exists on disk, and `supabase/migrations/0009_rls_policies.sql` is missing.

Expected setup per prompt:

```text
Two test customers via supabase.auth.admin.createUser, one row in orders per customer inserted via service role, queries run through each customer's session-carrying Supabase JS client obtained from signInWithPassword or generateLink+exchange.
```

Recorded results:

```text
A's client → 0 of B's orders: NO EVIDENCE — not run.
A's client → ≥1 of A's own orders: NO EVIDENCE — not run.
```

Search result for forbidden `set_config('request.jwt.claims', ...)`-based test code: no RLS smoke code found because Step 3 artifacts are absent.

## 13. PDPL data class declarations (SECURITY INVARIANT)

THREAT_MODEL.md asset declarations:

`docs/THREAT_MODEL.md:30-40`

```md
### 2.1 Customer PII

| Asset | Sensitivity | Where it lives |
|---|---|---|
| Customer name | Medium | `customers` table (Supabase) |
| Customer email | Medium | Supabase Auth + `customers` |
| Customer phone | Medium-high (UAE phone is identifier) | `customers`, `addresses` |
| Shipping addresses | High | `addresses` table |
| Order history | Medium | `orders` + `order_items` |
| Payment instrument data | **N/A** — never touches our database. Paymob holds card vaulting. We store only `payment_method_token` references. | Paymob |
| Auth credentials | High | Supabase Auth (managed) |
```

THREAT_MODEL.md retention/residency declarations:

`docs/THREAT_MODEL.md:223-225`

```md
- **Retention (recommended policy — pending legal/accounting confirmation at M8):** Order data retained **minimum 5 years for VAT/accounting (UAE Federal Decree-Law No. 28 of 2022)**; **7 years recommended pending legal review**. Inactive customer accounts (no signin or order in **24 months**) flagged for review and may be purged after admin approval. Marketing consent records retained while customer exists; withdrawal events retained 5+ years as compliance proof. Audit log retained indefinitely (append-only). Payment events retained 5+ years for reconciliation. Customer deletion under PDPL Article 16: PII fields zeroed but order line items retained (customer_id nulled, `deleted_at` timestamp set). See `CONTEXT_EXPANSION_NOTES.md` §5 for full retention policy and the M8 legal-review checklist.
- **Access & erasure.** Customer can export their data via account → "Download my data" (returns JSON of their PII + order history). Customer can request deletion via support; deletion zeroes PII fields but retains order line items (anonymized) for accounting.
- **Cross-border transfer.** Supabase region must be EU or UAE-compatible (Supabase offers `eu-central-1`, `eu-west-2`, etc. — pick `eu-central-1` for proximity + PDPL adequacy). Vercel deploys to edge but customer PII flows route through `iad1` or `fra1` region — preference `fra1` (Frankfurt) for PDPL-friendly residency.
```

## 14. THREAT_MODEL §7 cross-check requirements honored

THREAT_MODEL.md relevant cross-check lines:

`docs/THREAT_MODEL.md:252-253`

```md
- **M2 — Admin portal.** Cross-check MFA enrollment, admin authz checks on every server action, audit log writes, bulk-action confirmations.
- **M3 — Public catalog.** Cross-check RLS policies for `products`, `brands`, `categories`. Confirm `wholesale_price_internal` is never selected by any public query.
```

Confirm Step 3 front-loaded the M3 prerequisites: NO EVIDENCE — gap; `supabase/migrations/0009_rls_policies.sql` is missing and negative tests were not run.

## 15. Interpretive policies (from §9 prose, not explicit SQL)

NO EVIDENCE — gap at `supabase/migrations/0009_rls_policies.sql:1`; file is missing.

DB_SCHEMA.md prose licensing expected interpretive policies:

`docs/DB_SCHEMA.md:699`

```md
Similar policies for `product_variants`, `product_images`, `product_goal_tags`, `slug_history` — public reads gated on parent product visibility; admin all-access.
```

`docs/DB_SCHEMA.md:715`

```sql
-- Categories: similar pattern with is_visible
```

Prompt-required additional interpretation:

```text
For `goals` and `md_category_mapping`: reference data with no `is_visible` column — public SELECT allowed for anon+authenticated; admin all-access.
```

Policy SQL evidence for each interpretive table: NO EVIDENCE — gap, file missing.

## 16. Migration 0009 idempotency

NO EVIDENCE — gap at `pnpm exec supabase db reset`; not run twice successfully.

Current prerequisite evidence:

```text
supabase/migrations/0009_rls_policies.sql is missing.
Local Supabase CLI previously failed with Command "supabase" not found.
```

Requested consecutive reset exit codes:

```text
first db reset: NO EVIDENCE — not run.
second db reset: NO EVIDENCE — not run.
```

## Meta-model cross-check instructions

- Verify each item against DB_SCHEMA.md §9 and THREAT_MODEL.md §5.3–§5.4, §5.10, §7.
- Confidence [HIGH/MEDIUM/LOW]; severity [BLOCKER/MAJOR/MINOR].
- Item 15 needs the meta-model's explicit blessing on each interpretive policy.
- Gaps → fix before Step 4 or log in PROJECT_STATE.md §6 Deviations.

Verdict: PRINTED — awaiting meta-model review.

## State refresh — M1 Steps 1-3 boundary

- Result: refreshed to actual disk state, not desired future state.
- `docs/PROJECT_STATE.md` now records M1 Step 1 complete and M1 Steps 2-3 blocked/escalated.
- Migration and RLS patterns are recorded as NOT YET ESTABLISHED because the expected Step 2 files and `supabase/migrations/0009_rls_policies.sql` are absent.
- `docs/PROJECT_STATE.md` §5 includes the expected `0001`-`0009` M1 migration paths marked `MISSING` where absent, while preserving the current stale file map for actual disk reality.
- `docs/PROJECT_STATE.md` §6 keeps items #2, #3, and #5 cleared, item #4 deferred to M3, and item #1 still open/owned by M1 Step 2.
- `docs/THREAT_MODEL.md` §9 now has dated rows for the Step 2 and Step 3 blocked/evidence states.
- Files modified during refresh: `docs/PROJECT_STATE.md`, `docs/LAST_SESSION.md`, `docs/THREAT_MODEL.md`.
