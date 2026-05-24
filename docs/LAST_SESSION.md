# LAST_SESSION.md

## M2 Step 1b - audit-service landed

Date: 2026-05-24

Objective completed: the admin audit-service baseline is implemented locally, using the approved `DB_SCHEMA.md §8.1.1` seven-shape `audit_log.diff` contract.

### Files created

- `src/lib/audit/diff-types.ts`
- `src/server/services/audit-service.ts`
- `src/features/audit-log/record.ts`
- `tests/integration/services/audit-service.test.ts`

### Files modified

- `docs/DB_SCHEMA.md`
- `docs/PROJECT_STATE.md`
- `docs/LAST_SESSION.md`

### Implementation notes

- `DB_SCHEMA.md §8.1.1` documents seven versioned JSONB diff shape families:
  1. single-product update
  2. variant stock change
  3. bulk operation
  4. bulk publish with overrides
  5. stale-data save override
  6. order status change
  7. refund
- `src/lib/audit/diff-types.ts` mirrors the approved `§8.1.1` fields and action discriminators.
- `src/server/services/audit-service.ts` reads request IP and user agent through `headers()`, composes the audit row, and appends through `audit-log-repository.ts`.
- `src/features/audit-log/record.ts` exposes the feature-module-facing record helper.
- Write-time PII behavior follows the approved invariant: audit rows store raw values for forensic/compliance use; redaction happens in the Step 12 renderer. Secrets, credentials, tokens, and password material must not be written to `audit_log.diff`.

### Verification

```text
pnpm exec supabase db reset: PASS through 0013
pnpm typecheck: PASS
pnpm lint: PASS
pnpm build: PASS
pnpm test -- audit-service --reporter verbose: PASS (2 tests)
pnpm test: PASS (17 files, 85 tests)
pnpm scan:bundle-secrets: PASS (OK no service-role value in bundle)
```

SQL evidence:

```text
SELECT count(*) FROM pg_policies
WHERE tablename='audit_log'
AND cmd IN ('INSERT','UPDATE','DELETE');
-- 0
```

PII logging boundary evidence:

```text
rg -n "logger\.(info|error|warn|debug)\([^,]*(email|phone_e164|full_name)" src/server/services/audit-service.ts src/features/audit-log
-- no matches
```

### HANDOFF

files_created: [`src/lib/audit/diff-types.ts`, `src/server/services/audit-service.ts`, `src/features/audit-log/record.ts`, `tests/integration/services/audit-service.test.ts`]

files_modified: [`docs/DB_SCHEMA.md`, `docs/PROJECT_STATE.md`, `docs/LAST_SESSION.md`]

patterns_established: [`audit_log.diff has seven approved JSONB shape families`, `audit-service is the admin mutation audit write orchestrator`, `PII redaction is render-time only; audit rows store raw values`, `audit_log remains append-only through RLS with service-role-only writes`]

next_step_must_read: [`docs/ADMIN_PORTAL_SPEC.md §2`, `docs/THREAT_MODEL.md §5.4`, `docs/DB_SCHEMA.md §8.1.1`]

known_issues_introduced: [none]

invariants_observed: [SECURITY INVARIANTS - audit writes use service-role repository only; no INSERT/UPDATE/DELETE RLS policies on audit_log; no PII logging at audit-service boundary; bundle scan clean.]
