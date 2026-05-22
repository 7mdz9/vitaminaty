# ENVIRONMENT_VARIABLES.md

**Project:** Vitaminaty production codebase
**Document version:** v1.0
**Purpose:** Full inventory of every environment variable the app reads. Source of truth for `.env.example`, Vercel project env config, and CI/CD secrets. HIGH_RIGOR security trigger fires across this whole file — every entry is reviewed for handling, storage, rotation, exposure surface.

---

## 1. Loading & validation

All env vars are accessed exclusively through `src/lib/env.ts`, a Zod-validated module. Direct `process.env.X` reads outside `env.ts` are forbidden (enforced by `.eslintrc`).

`env.ts` validates at boot:
- Required variables must be present, else app fails to start.
- `NEXT_PUBLIC_*` vars are split into a separate validated object exported separately to make exposure intent explicit.
- Vars are typed (`url`, `email`, `boolean`, `enum`, etc.) — wrong types fail validation.

This pattern prevents the common `process.env.STRIPE_KEY` typo bug.

---

## 2. Variable inventory

### 2.1 Application

| Name | Required | Type | Public? | Purpose |
|---|---|---|---|---|
| `VITAMINATY_APP_URL` | Yes | URL | No | Canonical app origin, e.g. `https://vitaminaty.ae`. Used for absolute URLs in emails, webhooks, OG tags. |
| `VITAMINATY_APP_ENV` | Yes | enum `development\|staging\|production` | No | Drives env-specific behavior. |
| `NEXT_PUBLIC_APP_URL` | Yes | URL | Yes | Mirror of `VITAMINATY_APP_URL` for client-side use. |
| `NEXT_PUBLIC_APP_ENV` | Yes | enum | Yes | Mirror for client. |
| `NEXT_PUBLIC_SITE_NAME` | Yes | string | Yes | Defaults to "Vitaminaty". |

### 2.2 Supabase

| Name | Required | Type | Public? | Purpose |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | URL | Yes | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | string | Yes | Anon key for client-side queries (RLS-protected). |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | string | **No — never expose** | Bypasses RLS. Used only by `src/server/repositories/`. |
| `SUPABASE_PROJECT_REF` | Yes | string | No | Used by scripts that hit Supabase Management API. |
| `SUPABASE_DB_PASSWORD` | No | string | No | Used by `supabase` CLI for local development. |
| `SUPABASE_JWT_SECRET` | Yes | string | No | Used to verify JWTs server-side when needed. |

### 2.3 Paymob

> **Verification debt:** These env var names assume the legacy three-step Paymob Accept flow. If M5 verification confirms Paymob's Unified API is the current recommended path for new UAE merchants, the per-method `PAYMOB_INTEGRATION_ID_*` vars may collapse into a single intent secret. See `CONTEXT_EXPANSION_NOTES.md` §3 for the M5 verification checklist.

| Name | Required | Type | Public? | Purpose |
|---|---|---|---|---|
| `PAYMOB_API_KEY` | M5+ | string | No | Authentication for Paymob Accept API. |
| `PAYMOB_HMAC_SECRET` | M5+ | string | No | Webhook signature verification. |
| `PAYMOB_INTEGRATION_ID_CARDS` | M5+ | string | No | Integration ID for card payments. |
| `PAYMOB_INTEGRATION_ID_APPLE_PAY` | M5+ | string | No | Integration ID for Apple Pay. |
| `PAYMOB_INTEGRATION_ID_TABBY` | M5+ | string | No | Integration ID for Tabby BNPL. |
| `PAYMOB_INTEGRATION_ID_TAMARA` | M5+ | string | No | Integration ID for Tamara BNPL. |
| `PAYMOB_IFRAME_ID` | M5+ | string | No | Iframe ID for card capture. |
| `PAYMOB_BASE_URL` | M5+ | URL | No | Defaults to `https://accept.paymob.com/api`. |
| `PAYMOB_MODE` | Yes | enum `stub\|live` | No | M0-M4 = `stub`. M5 flips to `live` per environment. |

### 2.4 iCarry

> **Verification debt:** These env vars assume iCarry has a documented REST API with the listed auth/credential model. M6 verification may pivot to a different aggregator or direct carrier integration if iCarry's API is inadequate — in which case this section gets replaced with the chosen provider's var set. See `CONTEXT_EXPANSION_NOTES.md` §4.

| Name | Required | Type | Public? | Purpose |
|---|---|---|---|---|
| `ICARRY_API_KEY` | M6+ | string | No | iCarry API token. |
| `ICARRY_ACCOUNT_ID` | M6+ | string | No | iCarry account identifier. |
| `ICARRY_BASE_URL` | M6+ | URL | No | iCarry API base. |
| `ICARRY_WEBHOOK_SECRET` | M6+ | string | No | Webhook signature verification. |
| `ICARRY_MODE` | Yes | enum `stub\|live` | No | M0-M5 = `stub`. M6 flips. |
| `ICARRY_ORIGIN_ADDRESS_ID` | M6+ | string | No | Vitaminaty warehouse pickup address ID at iCarry. |

### 2.5 Email (transactional)

| Name | Required | Type | Public? | Purpose |
|---|---|---|---|---|
| `EMAIL_PROVIDER` | Yes | enum `resend\|stub` | No | M0 default is `stub` — logs emails to console. M7 flips to `resend`. |
| `RESEND_API_KEY` | M7+ | string | No | Resend.com API key. |
| `EMAIL_FROM_ADDRESS` | Yes | email | No | `orders@vitaminaty.ae` or similar. |
| `EMAIL_FROM_NAME` | Yes | string | No | "Vitaminaty". |
| `EMAIL_REPLY_TO` | Yes | email | No | `support@vitaminaty.ae`. |

### 2.6 Admin & auth

| Name | Required | Type | Public? | Purpose |
|---|---|---|---|---|
| `ADMIN_SESSION_SECRET` | Yes | string (32+ bytes) | No | Used to sign admin session cookies if/when we extend beyond Supabase Auth. |
| `INITIAL_ADMIN_EMAIL` | M0 | email | No | Seed admin user created during initial setup. |
| `MFA_ISSUER_NAME` | Yes | string | No | TOTP issuer label shown in authenticator apps. Defaults to "Vitaminaty Admin". |

### 2.7 Feature flags & operations

| Name | Required | Type | Public? | Purpose |
|---|---|---|---|---|
| `FEATURE_FLAGS_PROVIDER` | Yes | enum `database\|env` | No | M0 ships with `database` provider — flags stored in Supabase. `env` is escape hatch. |
| `MAINTENANCE_MODE` | No | boolean | No | When `true`, public surfaces return 503 with maintenance page; admin remains accessible. |
| `LOG_LEVEL` | No | enum `debug\|info\|warn\|error` | No | Defaults to `info`. |
| `SENTRY_DSN` | No | URL | No | Optional error reporting (Phase 2). |

### 2.8 Rate limiting

| Name | Required | Type | Public? | Purpose |
|---|---|---|---|---|
| `RATE_LIMIT_BACKEND` | Yes | enum `memory\|upstash` | No | M0 ships `memory` for dev. Production uses `upstash`. |
| `UPSTASH_REDIS_REST_URL` | Production | URL | No | Required if `RATE_LIMIT_BACKEND=upstash`. |
| `UPSTASH_REDIS_REST_TOKEN` | Production | string | No | Required if `RATE_LIMIT_BACKEND=upstash`. |

### 2.9 Cryptographic

| Name | Required | Type | Public? | Purpose |
|---|---|---|---|---|
| `IDEMPOTENCY_HMAC_SECRET` | Yes | string (32+ bytes) | No | Used to derive idempotency keys server-side. |
| `WEBHOOK_REPLAY_WINDOW_SECONDS` | No | integer | No | Defaults to 300. Webhook timestamps older than this are rejected. |

### 2.10 AI support (future — present but null/stub in MVP)

| Name | Required | Type | Public? | Purpose |
|---|---|---|---|---|
| `SUPPORT_CHAT_PROVIDER` | Yes | enum `null\|anthropic` | No | M0 default `null`. Future milestone flips to `anthropic`. |
| `ANTHROPIC_API_KEY` | Future | string | No | Required when `SUPPORT_CHAT_PROVIDER=anthropic`. |

---

## 3. Secret rotation & storage policy

### 3.1 Storage

- Local dev: `.env.local` (gitignored).
- Vercel: Project Settings → Environment Variables, per-environment (Production / Preview / Development).
- CI: GitHub Actions repository secrets where applicable.
- **Never** stored in git, in logs, in error traces, in client bundles, or in browser localStorage.

### 3.2 Rotation cadence

| Category | Rotation cadence | Triggered immediately on |
|---|---|---|
| Supabase service role key | Every 90 days | Admin user departure with key access; suspected leak |
| Paymob secrets | Every 180 days | Admin departure; suspected leak |
| iCarry secrets | Every 180 days | Admin departure; suspected leak |
| HMAC secrets (idempotency, sessions) | Every 365 days | Admin departure; suspected leak |
| Anthropic key (future) | Every 90 days | Departure; suspected leak |

### 3.3 Exposure surface audit

| Variable | Can it appear in... | Mitigation |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Client bundle? | Never imported from any client file. ESLint rule blocks. |
| `PAYMOB_HMAC_SECRET` | Client bundle? | Never imported from any client file. Webhook handlers only. |
| Any secret | Server logs? | Logger redacts known secret keys by name. |
| Any secret | Error reports? | Sentry (when used) configured with `beforeSend` to redact env keys. |
| Any secret | Database? | Never written to DB. Configuration values stored in DB are non-secret only. |

---

## 4. Initial `.env.example` template

This is the canonical template that ships with the repo from M0. Real values are filled into `.env.local` for development and into Vercel for deployment.

```bash
# ─── Application ───
VITAMINATY_APP_URL=http://localhost:3000
VITAMINATY_APP_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_ENV=development
NEXT_PUBLIC_SITE_NAME=Vitaminaty

# ─── Supabase ───
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_PROJECT_REF=
SUPABASE_DB_PASSWORD=
SUPABASE_JWT_SECRET=

# ─── Paymob (stub mode in early milestones) ───
PAYMOB_MODE=stub
PAYMOB_API_KEY=
PAYMOB_HMAC_SECRET=
PAYMOB_INTEGRATION_ID_CARDS=
PAYMOB_INTEGRATION_ID_APPLE_PAY=
PAYMOB_INTEGRATION_ID_TABBY=
PAYMOB_INTEGRATION_ID_TAMARA=
PAYMOB_IFRAME_ID=
PAYMOB_BASE_URL=https://accept.paymob.com/api

# ─── iCarry (stub mode in early milestones) ───
ICARRY_MODE=stub
ICARRY_API_KEY=
ICARRY_ACCOUNT_ID=
ICARRY_BASE_URL=
ICARRY_WEBHOOK_SECRET=
ICARRY_ORIGIN_ADDRESS_ID=

# ─── Email ───
EMAIL_PROVIDER=stub
RESEND_API_KEY=
EMAIL_FROM_ADDRESS=orders@vitaminaty.ae
EMAIL_FROM_NAME=Vitaminaty
EMAIL_REPLY_TO=support@vitaminaty.ae

# ─── Admin & auth ───
ADMIN_SESSION_SECRET=
INITIAL_ADMIN_EMAIL=
MFA_ISSUER_NAME=Vitaminaty Admin

# ─── Feature flags & operations ───
FEATURE_FLAGS_PROVIDER=database
MAINTENANCE_MODE=false
LOG_LEVEL=info
SENTRY_DSN=

# ─── Rate limiting ───
RATE_LIMIT_BACKEND=memory
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# ─── Cryptographic ───
IDEMPOTENCY_HMAC_SECRET=
WEBHOOK_REPLAY_WINDOW_SECONDS=300

# ─── AI support (null in MVP) ───
SUPPORT_CHAT_PROVIDER=null
ANTHROPIC_API_KEY=
```

---

## 5. Environment-specific differences

| Variable | development | staging (preview) | production |
|---|---|---|---|
| `VITAMINATY_APP_ENV` | `development` | `staging` | `production` |
| `PAYMOB_MODE` | `stub` | `stub` then `live` after M5 | `live` after M5 sign-off |
| `ICARRY_MODE` | `stub` | `stub` then `live` after M6 | `live` after M6 sign-off |
| `EMAIL_PROVIDER` | `stub` | `stub` then `resend` | `resend` |
| `RATE_LIMIT_BACKEND` | `memory` | `upstash` | `upstash` |
| `LOG_LEVEL` | `debug` | `info` | `info` |
| `SUPPORT_CHAT_PROVIDER` | `null` | `null` (until future milestone) | `null` (until future milestone) |

---

_End of `ENVIRONMENT_VARIABLES.md` (v1.0)._
