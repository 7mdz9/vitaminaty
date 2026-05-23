# M1 ADDENDUM — Migration 0012 inventory tracking

This is the executor prompt for the M1 addendum migration that lands inventory tracking. It is a single CODEX step, HIGH_RIGOR, with cross-check sweep + manual checkpoint.

Hand this prompt to CODEX in the Vitaminaty repository chat after the spec files are merged into the live `docs/` tree.

---

```
═══════════════════════════════════════════════════════════
M1 ADDENDUM — Migration 0012: inventory tracking
EXECUTOR: CODEX    EFFORT: high
MODE: BUILD        RIGOR: HIGH_RIGOR
SCOPE: wide
ROUTING NOTE: Production data path + new RLS table + schema mutation on already-imported 787 products. Default OPUS at high for schema work under spec constraints; CODEX-only constraint overrides; cross-check evidence pastes back to meta-model.
═══════════════════════════════════════════════════════════

ROLE
You are landing the M1 spec-evolution addendum migration `0012_inventory.sql` that adds inventory tracking to the Vitaminaty database. M1 has already shipped with migrations 0001–0011 applied; this is a clean additive migration that:
  - Adds two new ENUMs.
  - Mutates the existing product_variants table (drops in_stock boolean, adds stock_status enum column + trigger).
  - Creates the inventory_movements ledger table with RLS.
  - Rewrites the variants_low_stock partial index.
  - Backfills missing_stock_quantity flag on all 787 existing products.

READ FIRST (in order)
- docs/INVENTORY_SPEC.md (entire — this is the authoritative spec for everything this migration does)
- docs/DB_SCHEMA.md §3 (enums catalog), §5.2 (product_variants), §8.4 (inventory_movements), §9.10 (RLS), §10 (migration sequence)
- docs/PRODUCT_CONTENT_SPEC_v1.1_ADMIN_DRIVEN.md §5.4 (9th flag missing_stock_quantity + derivation rule), §22.1 (completion_score with 9-flag penalty)
- docs/proj_spec.md §M1 "M1 addendum migrations" subsection
- docs/PROJECT_STATE.md §2.1 (spec evolution log)
- docs/THREAT_MODEL.md §5.3 (PII / production data path); inventory data is NOT customer PII, but the migration runs against production data and the new RLS table extends the M1 security posture.
- supabase/migrations/0001_extensions_and_enums.sql through 0011_wholesale_revoke_writes.sql — to confirm the current schema state before writing 0012.
- src/server/repositories/payment-event-repository.ts, src/server/repositories/audit-log-repository.ts — the architectural pattern templates for inventory-movement-repository.ts (which lands as part of this step).

SPEC BASIS
Authoritative spec: docs/INVENTORY_SPEC.md. Every SQL statement, enum value, CHECK constraint, trigger body, RLS policy, and column name in this migration must match the spec character-for-character per I1 (spec text is sacred).

In particular, copy verbatim:
- The stock_status enum definition (INVENTORY_SPEC.md §3.2).
- The inventory_movement_reason enum definition (INVENTORY_SPEC.md §4.3) — exactly 7 values in the listed order.
- The compute_stock_status() function body and trigger declaration (INVENTORY_SPEC.md §3.3).
- The inventory_movements CREATE TABLE statement (INVENTORY_SPEC.md §4.2) including the consistency CHECK constraint that's relaxed for stock_recount.
- The RLS policy on inventory_movements (INVENTORY_SPEC.md §4.4): admin-read only; no INSERT/UPDATE/DELETE policies.

DO NOT add columns, indexes, or constraints not in the spec.
DO NOT rename columns, even when an "obviously clearer" name exists.
DO NOT enable RLS on any table other than inventory_movements.
DO NOT touch any policy on existing tables.

DOMAIN INVARIANTS

SECURITY INVARIANTS — observe in this step:
- Secrets are loaded from env or secret manager only. Never in code, never in state files, never in logs, never in commit history.
- Authn changes (login, session, token) require an explicit authz model declared in this step's documentation.
- Any new endpoint that touches user data declares its authz model in this step's prompt: who can call it, on whose data, with what role.
- PDPL/DIFC/ADGM/GDPR relevant: data residency is declared per data class (where it lives, where it can be transferred). Retention period is declared per data class.
- All database queries are parameterized. Raw SQL or template strings touching user input require manual review and explicit justification.
- Logs redact PII, secrets, and tokens. The redaction list is explicit, not a denylist of "things we remembered."
- Rate limiting applies to authentication, password reset, and any expensive endpoint by default.
- No security step is "done" until the cross-check sweep verifies these invariants and `THREAT_MODEL.md` is updated.

NOTE on PII scope: inventory data itself is not customer PII. But this migration runs against production data, touches the order foreign key surface, and adds a new RLS-gated table. The SECURITY INVARIANTS still apply because: (a) the migration runs with service-role credentials that must not leak; (b) the new inventory_movements table sits beside payment_events, shipment_events, audit_log — the existing append-only ledgers — and must follow the same append-only RLS pattern to avoid being a tampering vector for order-related audit trail.

OBJECTIVE
Outcome: a single new migration `supabase/migrations/0012_inventory.sql` that, when applied via `pnpm exec supabase db reset`:
- Creates the two new ENUMs.
- Drops `product_variants.in_stock` boolean column (along with the old `variants_low_stock_idx` that referenced it; recreate the index against `stock_status` per INVENTORY_SPEC §3.6).
- Adds `product_variants.stock_status` enum column with `NOT NULL DEFAULT 'out_of_stock'`.
- Creates the `compute_stock_status()` function and the `variants_compute_stock_status` BEFORE INSERT OR UPDATE OF trigger.
- Backfills `stock_status` on existing product variants by issuing a no-op self-update that fires the trigger (e.g., `UPDATE product_variants SET stock_quantity = stock_quantity`). **Empty-table caveat:** at the time 0012 runs, `product_variants` is expected to contain zero rows because the M1 import script (per locked decision Q4 — variants-not-mandatory-for-imported) did not create variants for the 787 imported products. Admin creates variants in M2 during enrichment. This means the backfill UPDATE is operationally a no-op on real data, and the trigger's correctness must be proved by the integration test's probe-variant assertions (see APPROACH GUIDANCE), **not** by the backfill itself. The migration must still issue the backfill UPDATE so that if any variants do exist (e.g., from a developer's test fixture), they get their stock_status populated correctly.
- Creates the new `variants_stock_status_idx` and the rewritten `variants_low_stock_idx`.
- Creates the `inventory_movements` table with all columns, CHECK constraints, and indexes per DB_SCHEMA §8.4.
- Enables RLS on `inventory_movements` and adds the single admin-read policy per DB_SCHEMA §9.10. No write policies (service-role-only writes; verified by absence of any INSERT/UPDATE/DELETE policy).
- Backfills `missing_stock_quantity=true` on the `admin_review_flags` JSONB column for every existing product (all 787). Use the jsonb concatenation pattern: `UPDATE products SET admin_review_flags = admin_review_flags || '{"missing_stock_quantity": true}'::jsonb`. The 0012 migration must be idempotent — running `db reset` twice in a row must produce the same final state.

Outcome on the application side:
- `src/server/repositories/inventory-movement-repository.ts` exists with `appendMovement`, `listMovementsForVariant`, `listMovementsForProduct`, `listMovementsForOrder`. No update/delete exports. Top-of-file Authz model comment per the M1 Step 7 pattern.
- `src/lib/supabase/types.generated.ts` regenerated to include the new enums + table.
- All M1 cross-check regression tests still pass (the 6-assertion rls-cross-checks suite plus the per-entity repository tests).

Success criteria:
- `supabase/migrations/0012_inventory.sql` exists and applies cleanly.
- `pnpm exec supabase db reset` succeeds with all 12 migrations.
- `pnpm exec supabase db reset` succeeds on a second run (idempotency).
- `pnpm exec tsx scripts/import-products-from-md.ts` succeeds and produces the same canonical counts: products=787, distinct_brand_id=44, case_pack=140, missing_price=369, needs_category_review=36.
- After import, every product has `admin_review_flags.missing_stock_quantity = true` (787 rows).
- `pnpm db:types` regenerates without error; the generated `Database` type covers `inventory_movements`, `stock_status`, `inventory_movement_reason`.
- `pnpm test -- repositories` passes (including new inventory-movement-repository tests).
- `pnpm test -- rls-cross-checks` passes (still 6 assertions, no regression).
- `pnpm typecheck && pnpm lint && pnpm build` all green.
- Bundle scan still clean (`pnpm scan:bundle-secrets`).

Stop when: all success criteria met. If any existing test fails (other than tests that legitimately reference `in_stock` and need to migrate to `stock_status`), STOP and ESCALATE — never silence a regression.

APPROACH GUIDANCE
- Author the migration as one self-contained `0012_inventory.sql` file in DDL+DML form. Order inside the file:
  1. CREATE TYPE for stock_status and inventory_movement_reason.
  2. ALTER TABLE product_variants ADD COLUMN stock_status (with the DEFAULT so the ADD doesn't fail on existing rows).
  3. CREATE OR REPLACE FUNCTION compute_stock_status().
  4. CREATE TRIGGER variants_compute_stock_status.
  5. Backfill stock_status on existing variants: `UPDATE product_variants SET stock_quantity = stock_quantity` (no-op self-update that fires the trigger).
  6. DROP INDEX IF EXISTS variants_low_stock_idx; CREATE INDEX variants_low_stock_idx ON product_variants(stock_quantity) WHERE stock_status='low_stock'.
  7. CREATE INDEX variants_stock_status_idx ON product_variants(stock_status).
  8. ALTER TABLE product_variants DROP COLUMN in_stock.
  9. CREATE TABLE inventory_movements (...).
  10. CREATE INDEX (4 indexes on inventory_movements per DB_SCHEMA §8.4).
  11. ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY.
  12. CREATE POLICY inventory_movements_admin_read.
  13. UPDATE products SET admin_review_flags = admin_review_flags || '{"missing_stock_quantity": true}'::jsonb (backfill).

- Verify in-step that the backfill produced the right state by running these queries inside the same psql session after `db reset`:
    SELECT count(*) FROM product_variants WHERE stock_status IS NULL;  -- expect 0
    SELECT count(*) FROM products WHERE NOT (admin_review_flags ? 'missing_stock_quantity');  -- expect 0 after backfill
    SELECT count(*) FROM products WHERE (admin_review_flags->>'missing_stock_quantity')::boolean = true;  -- expect 787 (all imported)

- Repository implementation:
  - Create `src/server/repositories/inventory-movement-repository.ts` following the `payment-event-repository.ts` and `audit-log-repository.ts` shape.
  - Top-of-file Authz model comment:
        // Authz model: inventory-movement-repository
        //   appendMovement({product_id, variant_id, previous_quantity, new_quantity, change_amount,
        //                   reason, change_reason_note, changed_by, order_id}):
        //     caller=server-side only (admin inventory service, checkout transaction, restoration service);
        //     uses src/server/db/supabase-admin.ts service-role;
        //     append-only mutation surface — no update/delete functions exist in this module.
        //   listMovementsForVariant / listMovementsForProduct / listMovementsForOrder:
        //     caller=authenticated admin; reads immutable inventory history.
  - Export only: appendMovement, listMovementsForVariant, listMovementsForProduct, listMovementsForOrder. No update/delete exports.

- Integration tests:
  - Add `tests/integration/repositories/inventory-movement-repository.test.ts` mirroring the shape of `payment-event-repository.test.ts`: append succeeds, list functions return ordered results, no update/delete export exists at the API surface (TypeScript should refuse to compile a `repo.update(...)` call).
  - **Probe-variant trigger test (mandatory).** Because `product_variants` is expected to be empty at backfill time (Q4: variants-not-mandatory-for-imported), the migration's backfill UPDATE does not actually exercise the `compute_stock_status` trigger on real data. The trigger must be proved correct by a dedicated test in this file. Add a `describe('compute_stock_status trigger')` block with **at least four assertions** running against a service-role-inserted probe variant on a service-role-created throwaway product:
      1. Insert variant with `stock_quantity = NULL` and any `low_stock_threshold` → assert `stock_status = 'out_of_stock'`.
      2. Update the same variant to `stock_quantity = 0` → assert `stock_status = 'out_of_stock'`.
      3. Update to `stock_quantity = 3` with `low_stock_threshold = 5` → assert `stock_status = 'low_stock'` (boundary: ≤threshold counts as low_stock).
      4. Update to `stock_quantity = 50` with `low_stock_threshold = 5` → assert `stock_status = 'in_stock'`.
      5. (Bonus, recommended) Update only `low_stock_threshold` from 5 → 100 while keeping `stock_quantity = 50` → assert `stock_status` flips to `low_stock` (proves the trigger fires on threshold-only updates per `INVENTORY_SPEC.md §3.3` semantics).

    Use `afterAll` to delete the probe variant and product. The probe data must not leak between tests.
  - Add to `tests/integration/repositories/rls-cross-checks.test.ts` if appropriate — though the existing 6 assertions still hold and the inventory table doesn't add a cross-customer isolation case (admin-only table). No mandatory addition; only add an assertion if you think there's a gap.

BOUNDARIES
- Modify only: `supabase/migrations/0012_inventory.sql` (new), `src/server/repositories/inventory-movement-repository.ts` (new), `tests/integration/repositories/inventory-movement-repository.test.ts` (new), `src/lib/supabase/types.generated.ts` (regenerated), state files.
- Do not modify migrations 0001–0011.
- Do not modify any existing repository file.
- Do not modify any existing test file other than to adapt assertions that reference the dropped `in_stock` boolean — and if you do, paste the diff in the cross-check sweep.
- Do not add stock-related business logic in the repository (the trigger does the derivation; the repo is pure CRUD on the movement log).
- Do not write any admin UI or storefront code (those are M2 and M3).
- Do not write any checkout-time decrement code (that's M4).
- DOMAIN INVARIANTS are non-negotiable.

GIT SAFETY
Before any modifications:
  git add -A && git commit -m "checkpoint before M1 addendum 0012: inventory schema" --allow-empty

HUMAN APPROVAL REQUIRED
This step is destructive under HIGH_RIGOR (ALTER TABLE on the already-imported 787-product variants table; ADD COLUMN, DROP COLUMN, DROP/CREATE INDEX; backfills running against production-shaped data). Before executing:
1. Print a summary listing:
   - New file: supabase/migrations/0012_inventory.sql
   - DROP/ALTER targets on existing product_variants: drop in_stock boolean column, add stock_status enum column, drop old variants_low_stock_idx, add new variants_low_stock_idx + variants_stock_status_idx, add compute_stock_status trigger.
   - New table: inventory_movements with its RLS policy.
   - Backfill scope: 787 product rows get missing_stock_quantity=true; ~N variant rows (count in advance via the existing variants table) get stock_status computed by self-update.
   - Confirmation that NO existing migration file is modified.
   - Confirmation that NO existing test file is modified beyond in_stock → stock_status references.
   - Confirmation that NO remote/production Supabase project is touched (this runs against local Supabase only; remote push is M5/M8 territory).
2. Wait for explicit human "approved" response.
3. Proceed only after approval.

DEFINITION OF DONE — MACHINE-CHECKABLE
All exit 0:
  - test -f supabase/migrations/0012_inventory.sql
  - test -f src/server/repositories/inventory-movement-repository.ts
  - test -f tests/integration/repositories/inventory-movement-repository.test.ts
  - pnpm exec supabase db reset                                     # all 12 migrations apply
  - pnpm exec supabase db reset                                     # idempotent second run
  - pnpm exec tsx scripts/import-products-from-md.ts                # canonical counts unchanged
  - pnpm exec tsx scripts/seed-admin-user.ts                         # idempotent re-seed for tests
  - pnpm db:types                                                    # types regenerate
  - pnpm typecheck && pnpm lint && pnpm build
  - pnpm test                                                        # full repo test suite
  - pnpm test -- repositories                                        # focused
  - pnpm test -- rls-cross-checks                                    # still 6 assertions green
  - pnpm scan:bundle-secrets                                         # OK no service-role value in bundle
  - psql "$SUPABASE_LOCAL_DB_URL" -tAc "SELECT count(*) FROM pg_type WHERE typname IN ('stock_status','inventory_movement_reason')" returns 2
  - psql "$SUPABASE_LOCAL_DB_URL" -tAc "SELECT count(*) FROM information_schema.columns WHERE table_name='product_variants' AND column_name='in_stock'" returns 0
  - psql "$SUPABASE_LOCAL_DB_URL" -tAc "SELECT count(*) FROM information_schema.columns WHERE table_name='product_variants' AND column_name='stock_status'" returns 1
  - psql "$SUPABASE_LOCAL_DB_URL" -tAc "SELECT count(*) FROM pg_trigger WHERE tgname='variants_compute_stock_status'" returns 1
  - psql "$SUPABASE_LOCAL_DB_URL" -tAc "SELECT count(*) FROM pg_indexes WHERE tablename='product_variants' AND indexname IN ('variants_low_stock_idx','variants_stock_status_idx')" returns 2
  - psql "$SUPABASE_LOCAL_DB_URL" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_name='inventory_movements' AND table_schema='public'" returns 1
  - psql "$SUPABASE_LOCAL_DB_URL" -tAc "SELECT relrowsecurity FROM pg_class WHERE relname='inventory_movements' AND relnamespace='public'::regnamespace" returns t
  - psql "$SUPABASE_LOCAL_DB_URL" -tAc "SELECT count(*) FROM pg_policies WHERE tablename='inventory_movements' AND cmd IN ('INSERT','UPDATE','DELETE')" returns 0
  - psql "$SUPABASE_LOCAL_DB_URL" -tAc "SELECT count(*) FROM pg_policies WHERE tablename='inventory_movements' AND cmd='SELECT'" returns 1
  - psql "$SUPABASE_LOCAL_DB_URL" -tAc "SELECT count(*) FROM products WHERE NOT (admin_review_flags ? 'missing_stock_quantity')" returns 0
  - psql "$SUPABASE_LOCAL_DB_URL" -tAc "SELECT count(*) FROM products WHERE (admin_review_flags->>'missing_stock_quantity')::boolean = true" returns 787
  - grep -E "^export.*update|^export.*delete" src/server/repositories/inventory-movement-repository.ts → empty
  - grep -q "Authz model: inventory-movement-repository" src/server/repositories/inventory-movement-repository.ts
  - **Probe-variant trigger verification (Notes 1+3 from the spec-evolution review — do not skip).** The inventory-movement-repository.test.ts `describe('compute_stock_status trigger')` block must contain at least 4 assertions covering NULL/0/≤threshold/>threshold and run green. Verify with:
      `pnpm test -- inventory-movement-repository --reporter verbose 2>&1 | grep -c "✓.*compute_stock_status"` returns ≥ 4
  - **Variant count + status distribution snapshot at end of migration (cross-check evidence — Notes 1+3).** After the migration applies, paste output of:
      `psql "$SUPABASE_LOCAL_DB_URL" -tAc "SELECT count(*) FROM product_variants;"`
      `psql "$SUPABASE_LOCAL_DB_URL" -c "SELECT stock_status, count(*) FROM product_variants GROUP BY stock_status ORDER BY stock_status;"`
    Expected: first query returns 0 (per Q4, no variants exist at addendum time); second query returns no rows (empty grouping). If either query returns non-zero, the breakdown must be sensible (every row's stock_status reflects its own stock_quantity vs low_stock_threshold per `INVENTORY_SPEC.md §3.3`). The migration is not allowed to leave any variant with `stock_status='out_of_stock'` purely by column default when `stock_quantity > low_stock_threshold` — the backfill UPDATE must have fired the trigger.

OUTPUT — UPDATE STATE FILES
PROJECT_STATE.md:
  - §1 Spec Compliance: M1 addendum 0012 (inventory tracking) implemented.
  - §3 patterns: "inventory_movements follows the M1 append-only ledger pattern (no UPDATE/DELETE exports in the repository, no UPDATE/DELETE RLS policies, admin SELECT only). stock_status is trigger-derived from stock_quantity + low_stock_threshold; application code MUST NOT write stock_status directly."
  - §5 Key file map: add supabase/migrations/0012_inventory.sql, src/server/repositories/inventory-movement-repository.ts, tests/integration/repositories/inventory-movement-repository.test.ts.
  - §6 Deviations: none expected — spec text was followed verbatim. If any deviation surfaces (e.g., a CHECK constraint had to be relaxed during backfill), log it explicitly.

THREAT_MODEL.md:
  - §5.3: append "M1 addendum 0012 adds inventory_movements as a new admin-read RLS-gated table following the M1 append-only ledger pattern. No customer PII; no new attack surface beyond the existing service-role admin write path."
  - §9 update history: dated row "M1 addendum 0012 of M1 spec evolution: inventory tracking schema landed; stock_status trigger-derived; inventory_movements append-only with admin-read RLS only; missing_stock_quantity flag backfilled on 787 products."

LAST_SESSION.md (overwrite): addendum summary; M1 status now "ready for M2."

HANDOFF
Print at end of response:

  HANDOFF
  files_created: [supabase/migrations/0012_inventory.sql, src/server/repositories/inventory-movement-repository.ts, tests/integration/repositories/inventory-movement-repository.test.ts]
  files_modified: [src/lib/supabase/types.generated.ts, docs/PROJECT_STATE.md, docs/THREAT_MODEL.md, docs/LAST_SESSION.md, possibly an existing test that referenced in_stock (paste the diff)]
  patterns_established: ["inventory_movements is the 4th append-only ledger in the catalog (alongside payment_events, shipment_events, audit_log)", "stock_status is trigger-derived; never written directly by application code"]
  next_step_must_read: [docs/ADMIN_PORTAL_SPEC.md §10 (M2 implements admin inventory UX); docs/INVENTORY_SPEC.md §5 (M3 implements storefront stock display); docs/INVENTORY_SPEC.md §6 (M4 implements checkout decrement; M7 implements restoration)]
  known_issues_introduced: [none expected]
  invariants_observed: [SECURITY INVARIANTS — append-only ledger discipline maintained; service-role-only writes; no PII exposure; bundle scan clean.]

ESCALATION
- Any of the 6 existing rls-cross-checks assertions fails → STOP, ESCALATE; this is the canonical M1 security regression suite.
- Backfill UPDATE on products fails because admin_review_flags is NULL on any row → STOP, ESCALATE; the M1 import script should have set it to a non-null JSONB. If NULL surfaces, fix at the source rather than coercing here.
- The compute_stock_status trigger backfill (`UPDATE product_variants SET stock_quantity = stock_quantity`) doesn't fire the trigger because of Postgres's no-op-skip optimization → STOP, ESCALATE; switch to an explicit non-no-op write like `SET stock_quantity = stock_quantity + 0` and document the workaround. Do not silently leave variants with default 'out_of_stock' that should be in_stock.
- Existing tests reference in_stock and break in a way that suggests application code still depends on it → STOP and ESCALATE with the failure list. Do not paper over by adding back a deprecated column.

FORBIDDEN
- Modifying any migration file 0001–0011.
- Writing application code that sets stock_status directly (the trigger is the single source of derivation truth).
- Adding INSERT/UPDATE/DELETE policies to inventory_movements.
- Exporting update or delete functions on inventory-movement-repository.ts.
- Pushing to remote Supabase — local only.
- Weakening any existing RLS policy or column-level grant to make the migration apply.
- Touching any code outside the file list in OUTPUT.
```

---

## After CODEX returns

The post-step sweep is a standard CODEX VERIFY pass against the DoD commands. The HIGH_RIGOR cross-check sweep is an evidence-extraction pass per the M1 framework pattern — CODEX produces a structured report covering:

1. Verbatim paste of `0012_inventory.sql`.
2. Verbatim paste of `inventory-movement-repository.ts` (especially the Authz model comment and exported function list).
3. Verbatim paste of the `describe('compute_stock_status trigger')` block from `inventory-movement-repository.test.ts` plus its test output (all probe-variant assertions green).
4. Output of the psql DoD queries above, **including the variant count + stock_status distribution snapshot** that proves the backfill ran or correctly no-op'd on an empty table.
5. Output of `pnpm test` showing the full suite green (now including the new probe-variant tests).
6. Output of `grep -rn "in_stock" src/` confirming no application code still references the dropped column.
7. Output of `pnpm scan:bundle-secrets`.

Paste the report into the meta-model chat for review. The meta-model grades PASS / FAIL / PASS WITH DEFERRED ITEMS. On PASS, write the M1-addendum-shipped entry to LAST_SESSION.md and update PROJECT_STATE.md §2 to read "Next milestone: M2 — Admin portal."

After the addendum ships, M2 kickoff proceeds against the now-complete M1 schema reality.

---

_End of M1_ADDENDUM_0012_PROMPT.md_
