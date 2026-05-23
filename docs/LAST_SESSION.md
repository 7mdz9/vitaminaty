# LAST_SESSION.md

## M1 Final Audit Recovery - wholesale revoke + cleanup

Date: 2026-05-23

Objective completed: the four Final Audit recovery findings are closed, with one explicit PostgreSQL privilege nuance recorded below.

### Files created

- `supabase/migrations/0011_wholesale_revoke_writes.sql`

### Files modified

- `tests/integration/repositories/rls-cross-checks.test.ts`
- `docs/PROJECT_STATE.md`
- `docs/THREAT_MODEL.md`
- `docs/LAST_SESSION.md`

### Migration

`0011_wholesale_revoke_writes.sql` was added after 0009/0010. It does not touch 0009, does not alter product columns, and does not change any RLS policy.

```sql
REVOKE INSERT (wholesale_price_internal) ON TABLE products FROM anon, authenticated;
REVOKE UPDATE (wholesale_price_internal) ON TABLE products FROM anon, authenticated;
REVOKE REFERENCES (wholesale_price_internal) ON TABLE products FROM anon, authenticated;
REVOKE INSERT, UPDATE, REFERENCES ON TABLE products FROM anon, authenticated;
```

The final table-level revoke is required because PostgreSQL table-level write/reference grants imply column-level privileges in `information_schema.column_privileges`.

### Regression test

`tests/integration/repositories/rls-cross-checks.test.ts` now has 6 assertions. The added assertion is:

```text
has no wholesale_price_internal column grants for anon or authenticated roles
```

The assertion queries `information_schema.column_privileges` via local Docker Postgres and expects zero rows for `grantee in ('anon', 'authenticated')`.

### Support/customer repository verification

Verified by source inspection:

```text
support-chat-repository.ts:
  support_conversations read path: listCurrentCustomerSupportConversations()
  support_messages read path: listCurrentCustomerSupportMessages()

support-chat-admin-repository.ts:
  support_conversations write/update path: createSupportConversationForAdmin(), updateSupportConversationForAdmin()
  support_messages write/read path: insertSupportMessageForAdmin(), listSupportMessagesForAdmin()

customer-admin-repository.ts:
  customers service-role/admin path: listCustomersForAdmin(), findCustomerByIdForAdmin(), upsertCustomerForAdmin(), updateCustomerForAdmin()
```

`PROJECT_STATE.md` §5 now documents those actual scopes, including the new `0011_wholesale_revoke_writes.sql` migration.

### State updates

`PROJECT_STATE.md` updates:

```text
- added missing_price=369 drift deviation for Step 8 count envelope
- documented support-chat repository coverage for support_conversations + support_messages
- documented customer-admin-repository scope
- added durable Step 2 / Step 3 / Step 5 / Step 7 cross-check verdict line in §3 patterns
- documented wholesale column write isolation pattern and 0011 migration
```

`THREAT_MODEL.md` §9 update:

```text
M1 Final Audit recovery: column-level write grants on wholesale_price_internal revoked from anon and authenticated via 0011_wholesale_revoke_writes.sql; defense-in-depth restored to match DB_SCHEMA §9.2 intent; column-revoke regression test added.
```

### Verification

```text
test -f supabase/migrations/0011_wholesale_revoke_writes.sql: PASS

pnpm exec supabase db reset: PASS
  Applying migration 0011_wholesale_revoke_writes.sql...
  Finished supabase db reset on branch main.

Full column_privileges query:
  grantee      privilege_type
  postgres     INSERT
  postgres     REFERENCES
  postgres     SELECT
  postgres     UPDATE
  service_role INSERT
  service_role REFERENCES
  service_role SELECT
  service_role UPDATE

Focused anon/authenticated query:
  select grantee, privilege_type
  from information_schema.column_privileges
  where table_name='products'
    and column_name='wholesale_price_internal'
    and grantee in ('anon','authenticated')
  order by grantee, privilege_type;
  (0 rows)

pnpm exec tsx scripts/import-products-from-md.ts: PASS
  products=787
  distinctBrands=44
  casePack=140
  missingPrice=369
  needsCategoryReview=36
  nonImported=0
  publicVisible=0
  publicVisibleCasePack=0
  rowsMissingFieldStatusKeys=0
  rowsMissingReviewFlagKeys=0

pnpm exec tsx scripts/seed-admin-user.ts: PASS

pnpm test -- rls-cross-checks --reporter verbose: PASS
  Test Files  1 passed
  Tests       6 passed

pnpm typecheck: PASS
pnpm lint: PASS
pnpm build: PASS
```

### Note on the full column_privileges query

The recovery objective was to revoke all `wholesale_price_internal` privileges from anon and authenticated. That is now verified by the focused `(0 rows)` query and locked by the RLS regression test.

The full unfiltered `column_privileges` query still shows `postgres` and `service_role` write/reference privileges. Keeping `service_role` write access is required because `scripts/import-products-from-md.ts` imports `wholesale_price_internal`, and admin/import repositories are service-role paths. Revoking service-role write privileges would break the Step 8 import invariant.

## HANDOFF

files_created: [`supabase/migrations/0011_wholesale_revoke_writes.sql`]

files_modified: [`tests/integration/repositories/rls-cross-checks.test.ts`, `docs/PROJECT_STATE.md`, `docs/THREAT_MODEL.md`, `docs/LAST_SESSION.md`]

patterns_established: [`Wholesale column grants are checked against anon/authenticated explicitly`, `0011 completes 0009 wholesale defense-in-depth without changing RLS policies`, `PROJECT_STATE.md carries durable M1 cross-check verdicts so LAST_SESSION overwrites do not erase them`]

next_step_must_read: [Final Audit prompt]

known_issues_introduced: [none]

invariants_observed: [no 0009 RLS policy changed; product column structure unchanged; anon/authenticated have zero wholesale column privileges; service-role import/admin path preserved]

M1 status: ready for Final Audit re-run.

## Final Audit Re-run Evidence — after 0011 recovery

Date: 2026-05-23

Fresh prep sequence was re-run after `0011_wholesale_revoke_writes.sql`.

```text
git log --oneline 04b14d6..HEAD: PASS
pnpm exec supabase db reset: PASS
  Applying migration 0011_wholesale_revoke_writes.sql...
pnpm exec tsx scripts/import-products-from-md.ts: PASS
pnpm exec tsx scripts/seed-admin-user.ts: PASS
pnpm db:types: PASS
pnpm typecheck: PASS
pnpm lint: PASS
pnpm build: PASS
pnpm test: PASS
  Test Files  13 passed (13)
  Tests       69 passed (69)
pnpm test -- rls-cross-checks --reporter verbose: PASS
  Test Files  1 passed (1)
  Tests       6 passed (6)
pnpm scan:bundle-secrets: PASS
  OK no service-role value in bundle
```

RLS cross-check assertion list:

```text
✓ denies anon reads of wholesale_price_internal from products
✓ has no wholesale_price_internal column grants for anon or authenticated roles
✓ allows customer A to read own order and returns zero rows for customer B order
✓ returns zero customer rows to anon
✓ allows customer A to update own address and returns zero rows for customer B address update
✓ appends payment events with service role and denies admin-session updates under RLS
```

Import count evidence:

```text
products=787
distinct_brand_id=44
case_pack=140
missing_price=369
needs_category_review=36
```

Wholesale column privilege evidence:

```text
select grantee, privilege_type
from information_schema.column_privileges
where table_name='products'
  and column_name='wholesale_price_internal'
order by grantee, privilege_type;

   grantee    | privilege_type
--------------+----------------
 postgres     | INSERT
 postgres     | REFERENCES
 postgres     | SELECT
 postgres     | UPDATE
 service_role | INSERT
 service_role | REFERENCES
 service_role | SELECT
 service_role | UPDATE
(8 rows)
```

Focused anon/authenticated evidence:

```text
select grantee, privilege_type
from information_schema.column_privileges
where table_name='products'
  and column_name='wholesale_price_internal'
  and grantee in ('anon','authenticated')
order by grantee, privilege_type;

 grantee | privilege_type
---------+----------------
(0 rows)
```

Verdict line: PRINTED — awaiting meta-model Final Audit.

HANDOFF
files_created: []
files_modified: [docs/LAST_SESSION.md]
commands_run: [git log --oneline 04b14d6..HEAD, pnpm exec supabase db reset, pnpm exec tsx scripts/import-products-from-md.ts, pnpm exec tsx scripts/seed-admin-user.ts, pnpm db:types, pnpm typecheck, pnpm lint, pnpm build, pnpm test, pnpm test -- rls-cross-checks --reporter verbose, pnpm scan:bundle-secrets, SQL evidence via docker exec psql]
known_issues_introduced: [none]
invariants_observed: [0011 applied cleanly; anon/authenticated have zero wholesale column privileges; service-role import/admin path preserved; rls-cross-checks now has 6 passing assertions]

## Final Audit Re-run Evidence - 2026-05-23 fresh rerun

Date: 2026-05-23

Scope: M1 Final Audit re-run after `0011_wholesale_revoke_writes.sql`.

### Prep sequence exit evidence

```text
git log --oneline 04b14d6..HEAD: exit 0
  b8f78ac checkpoint before M1 step 6: non-PII repositories
  4fb7b9e post-step sweep for M1 step 5
  213220c checkpoint before M1 step 5: src/server/db/* wrappers
  1fac6ca checkpoint before M1 step 4: seed 0010
  7a01b5a checkpoint before M1 step 3: RLS policies 0009
  8779035 checkpoint before M1 step 2: schema migrations 0001-0008
  090377e checkpoint before M1 step 1: housekeeping + recon
  b9147bb M1 step 5 sweep: record escalation
  b1fe5d8 M1 step 4 sweep: record escalation
  9ba408f docs(m1): refresh state after blocked steps 2-3
  ac34245 M1 step 3 sweep: record escalation
  1e128f6 M1 step 2 sweep: record escalation
  285ebc2 M1 step 1 sweep: record clean verification
  aeb7a40 M1 step 1: clear M0 debt and record data-layer recon

pnpm exec supabase db reset: exit 0
  Applying migration 0011_wholesale_revoke_writes.sql...
  Finished supabase db reset on branch main.

pnpm exec tsx scripts/import-products-from-md.ts: exit 0
  {"event":"import-products.verified","products":787,"distinctBrands":44,"casePack":140,"missingPrice":369,"needsCategoryReview":36,"nonImported":0,"publicVisible":0,"publicVisibleCasePack":0,"rowsMissingFieldStatusKeys":0,"rowsMissingReviewFlagKeys":0}

pnpm exec tsx scripts/seed-admin-user.ts: exit 0
  {"event":"seed-admin-user.completed","email_hash":"a5f52d14c3fc8186621560096e5d59e6244a40efd78c497223a37d64a98103e3","role":"admin","created":true,"role_updated":false}

pnpm db:types: exit 0
  Connecting to db 5432

pnpm typecheck: exit 0
pnpm lint: exit 0
pnpm build: exit 0

pnpm test: exit 0
  Test Files  13 passed (13)
  Tests       69 passed (69)

pnpm test -- rls-cross-checks --reporter verbose: exit 0
  Test Files  1 passed (1)
  Tests       6 passed (6)

pnpm scan:bundle-secrets: exit 0
  OK no service-role value in bundle
```

### Product count evidence

```text
select count(*) from products;
 count
-------
   787

select count(distinct brand_id) from products where brand_id is not null;
 count
-------
    44

select count(*) from products where (admin_review_flags->>'case_pack')::boolean;
 count
-------
   140

select count(*) from products where (admin_review_flags->>'missing_price')::boolean;
 count
-------
   369

select count(*) from products where (admin_review_flags->>'needs_category_review')::boolean;
 count
-------
    36

select count(*) from products where status <> 'imported';
 count
-------
     0

select count(*) from products where is_public_visible = true;
 count
-------
     0

select count(*) from products where (admin_review_flags->>'case_pack')::boolean and is_public_visible = true;
 count
-------
     0

select count(*) from products where brand_id is null;
 count
-------
    18

select count(*) from products where brand_raw is not null;
 count
-------
   787
```

### RLS and privilege evidence

```text
select relname, relrowsecurity
from pg_class
where relkind='r' and relnamespace='public'::regnamespace
order by relname;

        relname        | relrowsecurity
-----------------------+----------------
 addresses             | t
 audit_log             | t
 brands                | t
 categories            | t
 customers             | t
 feature_flags         | t
 goals                 | t
 md_category_mapping   | t
 order_items           | t
 orders                | t
 payment_events        | t
 product_goal_tags     | t
 product_images        | t
 product_variants      | t
 products              | t
 shipment_events       | t
 slug_history          | t
 support_conversations | t
 support_messages      | t
(19 rows)

select count(*) from pg_proc where proname='is_admin';
1

select grantee, privilege_type
from information_schema.column_privileges
where table_name='products'
  and column_name='wholesale_price_internal'
order by grantee, privilege_type;

   grantee    | privilege_type
--------------+----------------
 postgres     | INSERT
 postgres     | REFERENCES
 postgres     | SELECT
 postgres     | UPDATE
 service_role | INSERT
 service_role | REFERENCES
 service_role | SELECT
 service_role | UPDATE
(8 rows)

select grantee, privilege_type
from information_schema.column_privileges
where table_name='products'
  and column_name='wholesale_price_internal'
  and grantee in ('anon','authenticated')
order by grantee, privilege_type;

 grantee | privilege_type
---------+----------------
(0 rows)

select tablename, cmd, policyname
from pg_policies
where schemaname='public'
  and tablename in ('payment_events','shipment_events','audit_log')
order by tablename, cmd;

    tablename    |  cmd   |         policyname
-----------------+--------+----------------------------
 audit_log       | SELECT | audit_log_admin_read
 payment_events  | SELECT | payment_events_admin_read
 shipment_events | SELECT | shipment_events_admin_read
(3 rows)
```

### RLS cross-check assertion outcomes

```text
PASS tests/integration/repositories/rls-cross-checks.test.ts > M1 RLS cross-checks > denies anon reads of wholesale_price_internal from products
PASS tests/integration/repositories/rls-cross-checks.test.ts > M1 RLS cross-checks > has no wholesale_price_internal column grants for anon or authenticated roles
PASS tests/integration/repositories/rls-cross-checks.test.ts > M1 RLS cross-checks > allows customer A to read own order and returns zero rows for customer B order
PASS tests/integration/repositories/rls-cross-checks.test.ts > M1 RLS cross-checks > returns zero customer rows to anon
PASS tests/integration/repositories/rls-cross-checks.test.ts > M1 RLS cross-checks > allows customer A to update own address and returns zero rows for customer B address update
PASS tests/integration/repositories/rls-cross-checks.test.ts > M1 RLS cross-checks > appends payment events with service role and denies admin-session updates under RLS
```

### Architecture grep evidence

```text
rg -n -F "select('*')" src/server/repositories
  empty

rg -n "wholesale_price_internal" src/server/repositories
  src/server/repositories\product-admin-repository.ts:45:  "wholesale_price_internal",

rg -n "^export.*update|^export.*delete" src/server/repositories/payment-event-repository.ts src/server/repositories/shipment-event-repository.ts src/server/repositories/audit-log-repository.ts
  empty

rg -n "set_config\(|request\.jwt\.claims" tests src/server
  empty

rg -n "insertPaymentEventForAdmin|insertShipmentEventForAdmin|insertAuditLog|listPaymentEventsForOrderForAdmin|listShipmentEventsForOrderForAdmin|listAuditLogForAdmin|listAuditLogForEntityForAdmin" src tests scripts
  empty

rg -n "Authz model:" src/server/repositories/
  src/server/repositories/shipment-event-repository.ts:1:// Authz model: shipment-event-repository
  src/server/repositories/audit-log-repository.ts:1:// Authz model: audit-log-repository
  src/server/repositories/payment-event-repository.ts:1:// Authz model: payment-event-repository
```

### Append-only repo Authz comments

```ts
// Authz model: payment-event-repository
//   appendEvent({provider, provider_transaction_id, kind, raw_payload, signature_received}):
//     caller=server-side only (Paymob/stub webhook or checkout boundary, never customer);
//     uses src/server/db/supabase-admin.ts service-role by default;
//     idempotency enforced by UNIQUE(provider, provider_transaction_id, kind);
//     append-only mutation surface -- no update/delete functions exist in this module.
//   listEventsForOrder(orderId): caller=authenticated admin; reads payment history for one order.

// Authz model: shipment-event-repository
//   appendEvent({provider, provider_shipment_id, status, raw_payload}):
//     caller=server-side only (iCarry/manual/stub shipping boundary, never customer);
//     uses src/server/db/supabase-admin.ts service-role by default;
//     shipment history is append-only; no update/delete functions exist in this module.
//   listEventsForOrder(orderId): caller=authenticated admin; reads shipment history for one order.

// Authz model: audit-log-repository
//   appendEntry({actor_user_id, action, entity_type, entity_id, diff}):
//     caller=server-side only (admin mutation/service boundary);
//     uses src/server/db/supabase-admin.ts service-role by default;
//     append-only mutation surface -- no update/delete functions exist in this module.
//   listEntries/listEntriesForEntity: caller=authenticated admin; reads immutable audit history.
```

### State/spec evidence references

```text
docs/PROJECT_STATE.md:20:**M1 - Data layer: Final Audit recovery complete; ready for M1 Final Audit rerun.**
docs/PROJECT_STATE.md:53:- **Append-only event repositories.** Append-only ledgers live in dedicated files: `payment-event-repository.ts`, `shipment-event-repository.ts`, and `audit-log-repository.ts`. Each declares a top-of-file Authz model comment and exposes append plus admin read functions, with no update/delete exports.
docs/PROJECT_STATE.md:54:- **Canonical RLS regression suite.** `tests/integration/repositories/rls-cross-checks.test.ts` encodes the M1 RLS cross-checks. It uses `createTestCustomerWithSession()` from `tests/fixtures/customers.ts` so every `auth.uid()` assertion runs through a real signed Supabase session, never `set_config('request.jwt.claims', ...)`. It re-seeds the admin user idempotently at suite start so the test survives `supabase db reset`.
docs/PROJECT_STATE.md:72:- **M1 Final Audit recovery cross-check verdicts.** Step 2 schema migrations: clean after `supabase db reset`; Step 3 RLS policies: clean with documented wholesale denial wording; Step 5 DB wrappers/bundle scan: clean value-prefix scan; Step 7 recovery: clean canonical `rls-cross-checks.test.ts` suite with real signed sessions.
docs/PROJECT_STATE.md:73:- **Wholesale column write isolation.** `0011_wholesale_revoke_writes.sql` revokes anon/authenticated table-level write/reference grants on `products` plus column-level INSERT/UPDATE/REFERENCES on `wholesale_price_internal`; service-role repositories retain import/admin write access.
docs/PROJECT_STATE.md:215:- CLEARED AFTER M1 FINAL AUDIT RECOVERY STEP C: M1 Step 8 brand coverage recovered. The original §12.2 30-brand seed matched only 19 distinct `brand_id` values. 25 additional canonical brands were added under meta-model blessing on 2026-05-23. Final import count: 787 products, 55 seeded brands, 44 distinct matched brands, 18 `brand_id IS NULL` rows.
docs/PROJECT_STATE.md:218:- DEVIATION FOR M1 STEP 8 COUNT DRIFT: `missing_price=369` is within the Step 8 DoD ±10 envelope but outside the original spec's ±5 expected-shift envelope around ~360. The import treats source `N/A` values and one non-integer price as missing to preserve integer-AED schema safety; PRODUCT_CONTENT_SPEC §3 records this as the canonical post-import count.
docs/PROJECT_STATE.md:221:- CLEARED AFTER M1 FINAL AUDIT RECOVERY COLUMN REVOKE: `0011_wholesale_revoke_writes.sql` removes anon/authenticated write/reference grants from `products` and `wholesale_price_internal`; `rls-cross-checks.test.ts` now asserts anon/authenticated have zero column privileges for `wholesale_price_internal`.

docs/PRODUCT_CONTENT_SPEC_v1.1_ADMIN_DRIVEN.md:77:| Unique products after dedupe | **787** |
docs/PRODUCT_CONTENT_SPEC_v1.1_ADMIN_DRIVEN.md:82:| Canonical brands matched by current import | **44** |
docs/PRODUCT_CONTENT_SPEC_v1.1_ADMIN_DRIVEN.md:84:| Products flagged `case_pack` (hidden from public) | **140** |
docs/PRODUCT_CONTENT_SPEC_v1.1_ADMIN_DRIVEN.md:85:| Products with missing prices (`N/A` or non-integer price in source) | **369** |
docs/PRODUCT_CONTENT_SPEC_v1.1_ADMIN_DRIVEN.md:86:| Products needing category review after MD -> public mapping | **36** (the "Uncategorized" + ambiguous rows) |
docs/PRODUCT_CONTENT_SPEC_v1.1_ADMIN_DRIVEN.md:443:### §12.2 Canonical brand map (seed at M1; updated 2026-05-23 after Step 8 brand coverage recovery)

docs/THREAT_MODEL.md:166:- Verified at M1 Step 7 recovery via `tests/integration/repositories/rls-cross-checks.test.ts` (5 assertions plus paired sanity assertions, using real signed Supabase sessions and no `set_config` JWT simulation).
docs/THREAT_MODEL.md:217:- Verified at M1 Step 5: bundle scan implemented as `scripts/scan-bundle-secrets.sh`, reads 130+ char prefix of the live `SUPABASE_SERVICE_ROLE_KEY` VALUE from `.env.local`, returns zero matches in `.next/`.
docs/THREAT_MODEL.md:278:| 2026-05-23 | 1.0.16 | M1 Final Audit recovery: column-level write grants on `wholesale_price_internal` revoked from anon and authenticated via `0011_wholesale_revoke_writes.sql`; defense-in-depth restored to match DB_SCHEMA §9.2 intent; column-revoke regression test added. |
```

Verdict line: PRINTED - awaiting meta-model Final Audit.

HANDOFF
files_created: []
files_modified: [docs/LAST_SESSION.md]
commands_run: [docker ps, pnpm exec supabase status, git status --short, git log --oneline 04b14d6..HEAD, pnpm exec supabase db reset, pnpm exec tsx scripts/import-products-from-md.ts, pnpm exec tsx scripts/seed-admin-user.ts, pnpm db:types, pnpm typecheck, pnpm lint, pnpm build, pnpm test, pnpm test -- rls-cross-checks --reporter verbose, pnpm scan:bundle-secrets, SQL evidence via docker exec psql, rg evidence checks]
known_issues_introduced: [none]
invariants_observed: [0011 applied cleanly; anon/authenticated have zero wholesale column privileges; service-role import/admin path preserved; all RLS cross-check assertions pass; no set_config/request.jwt.claims usage found]
