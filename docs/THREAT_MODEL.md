# THREAT_MODEL.md

**Project:** Vitaminaty
**Document version:** v1.0
**Audience:** v5 reads this for any HIGH_RIGOR security-adjacent work (payments, auth, PII, secrets, webhooks).
**Update policy:** Reviewed at M5 (payments), M6 (delivery), M7 (orders), M8 (pre-launch).

---

## 1. Scope of this threat model

This document defines the security stance for the Vitaminaty production application. It covers:

- The asset inventory (what we protect)
- The attacker model (who might come after us)
- The trust zones (which boundaries data crosses)
- Per-surface controls (what we do at each boundary)
- The known unknowns (what we accept as residual risk)

It does **not** cover:

- Physical security of the warehouse (out of scope — handled by iCarry / shop ops)
- Endpoint security of the admin team's devices (handled by admin discipline + MFA enforcement)
- Threats inherent to Paymob and iCarry themselves (we trust them as vendors but verify their webhooks cryptographically)

---

## 2. Assets

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

### 2.2 Business assets

| Asset | Sensitivity | Where it lives |
|---|---|---|
| Wholesale prices | High — competitor-sensitive | `products.wholesale_price_internal` (RLS-locked to admin only) |
| Supplier list | Medium | `brands` table relationship to admin notes |
| Admin user list | High | Supabase Auth `app_metadata.role='admin'` |
| Audit log | High — tampering would mask bad acts | `audit_log` table (append-only) |

### 2.3 Operational secrets

| Asset | Sensitivity | Where it lives |
|---|---|---|
| Supabase service role key | **Critical** — full DB access | Vercel env, never in repo |
| Paymob API key | **Critical** | Vercel env |
| Paymob HMAC secret | **Critical** — webhook forgery prevention | Vercel env |
| iCarry API key | High | Vercel env |
| iCarry webhook secret | High | Vercel env |
| HMAC secrets (idempotency, sessions) | High | Vercel env |

---

## 3. Attacker model

We design against four realistic attacker classes:

### 3.1 Opportunistic scripted attacker

Mass scanning for misconfigurations: exposed `.env` files, default credentials, unauthenticated endpoints, SQL injection probes, common WAF-bypassable patterns.

**Likelihood: very high. Sophistication: low. Impact if successful: medium.**

### 3.2 Credential stuffer

Tries leaked password databases against customer accounts. Targets account takeover for order fraud (place order with stolen card, change shipping address mid-flight, intercept delivery).

**Likelihood: high. Sophistication: low. Impact: high (customer harm + chargebacks).**

### 3.3 Hostile customer / abuse actor

Real signed-in user trying to exploit business logic: price manipulation via cart tampering, double-redeeming offers, exploiting refund flows, escalating their own role, accessing other customers' data.

**Likelihood: medium. Sophistication: medium. Impact: medium-high.**

### 3.4 Targeted attacker

Researches Vitaminaty specifically. Attempts admin portal compromise via phishing the admin team, looks for exposed service role keys in client bundles, attempts webhook forgery against Paymob/iCarry endpoints.

**Likelihood: low for MVP launch, rises as the business grows. Sophistication: high. Impact: critical.**

---

## 4. Trust zones

```
┌───────────────────────────────────────────────────────────────────────┐
│  ZONE 0 — Internet (untrusted)                                        │
│    Public visitors, scripted attackers, anyone with a URL             │
└────────────────┬──────────────────────────────────────────────────────┘
                 │ HTTPS / TLS
                 ▼
┌───────────────────────────────────────────────────────────────────────┐
│  ZONE 1 — Authenticated customer (low trust)                          │
│    Signed in via Supabase Auth. Email-verified (M7+).                 │
│    Can act on their own data only.                                    │
└────────────────┬──────────────────────────────────────────────────────┘
                 │ Session cookie (HttpOnly, Secure, SameSite=Lax)
                 ▼
┌───────────────────────────────────────────────────────────────────────┐
│  ZONE 2 — Application server (Next.js on Vercel)                      │
│    Holds session, runs server actions, enforces authz.                │
│    Has anon Supabase key + (when needed) service role key.            │
└────────────────┬──────────────────────────────────────────────────────┘
                 │ Postgres connection (Supabase)
                 ▼
┌───────────────────────────────────────────────────────────────────────┐
│  ZONE 3 — Database (RLS-enforced)                                     │
│    Postgres with row-level security. Service role bypasses RLS.       │
│    Customer queries always go through anon key + RLS.                 │
└───────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────┐
│  ZONE A — Admin (high trust, MFA-required)                            │
│    Signed in via Supabase Auth with role='admin' + verified MFA.      │
│    Can mutate any product, brand, category, order, audit log entry.   │
│    All mutations audit-logged.                                        │
└───────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────┐
│  ZONE W — External webhook senders                                    │
│    Paymob and iCarry call us. Signature-verified before any effect.   │
│    Failed signature = log + 400 (no body, no DB write).               │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 5. Controls per surface

### 5.1 Public storefront (Zone 0 → Zone 2)

- All HTTP traffic redirects to HTTPS at Vercel edge.
- HSTS header with `max-age=31536000; includeSubDomains; preload`.
- CSP header with strict default-src 'self', tight allowlists for fonts, images, payment iframe sources (Paymob's iframe domain).
- No service role key in any client bundle (ESLint rule + bundle analyzer check in CI).
- Rate limit on `/api/*` and on auth-touching server actions (10 requests / 60 seconds per IP for unauthenticated, 30 / 60 seconds for authenticated).
- No PII rendered in URLs (order URLs use random UUIDs, not sequential IDs).

### 5.2 Customer auth (Zone 0 → Zone 1)

- Supabase Auth handles signup, signin, password hashing (bcrypt-equivalent).
- Email verification required before order placement.
- Password reset via emailed token, single-use, expires in 30 minutes.
- Session cookies: HttpOnly, Secure, SameSite=Lax, 30-day expiry, refreshed on activity.
- Account lockout: 5 failed signins in 15 minutes locks the account for 1 hour, with email alert to the customer.
- Sign-in attempts logged in `auth_event_log` (Supabase Auth handles this natively).

### 5.3 Customer data access (Zone 1 → Zone 3)

- RLS policies on every table containing customer data.
- `customers`, `addresses`, `orders`, `order_items` policies: rows visible only when `auth.uid() = customer_id`.
- Anon key (used in client) cannot bypass RLS. Service role key (used server-side) can, and is only invoked in `src/server/repositories/*`.
- Server-side mutations validate `customer_id` against `auth.uid()` before any write.

### 5.4 Admin portal (Zone A)

- Admin signin via Supabase Auth with role check (`app_metadata.role === 'admin'`).
- **MFA required.** Admin user must enroll a TOTP authenticator on first signin. Cannot proceed past first signin without MFA enrollment.
- Admin session: separate cookie name (`vit_admin_session`), 4-hour idle timeout, 12-hour absolute timeout.
- Admin actions all flow through server actions that double-check role server-side (`requireAdmin()` helper) even though the route is `/admin/*`. Never trust the route prefix alone.
- Every admin mutation writes an `audit_log` row with: timestamp, admin user ID, action type, entity type, entity ID, before/after diff (JSON, redacted for secrets), IP, user agent.
- Bulk operations (>20 entities) require explicit double-confirmation in UI.
- Admin IP-allowlist supported via env var `ADMIN_IP_ALLOWLIST` (CIDR list); empty = unrestricted (default in M2; consider locking in M8 pre-launch).

### 5.5 Paymob webhooks (Zone W → Zone 2)

- Endpoint: `POST /api/webhooks/paymob`.
- Method: signature verification using `PAYMOB_HMAC_SECRET` before any side effect.
- Timestamp check: webhook payload's timestamp must be within `WEBHOOK_REPLAY_WINDOW_SECONDS` (default 300s) of now. Otherwise rejected as replay.
- Idempotency: webhook events keyed by Paymob's transaction ID. Re-delivery of the same event is a no-op (recorded but not double-applied).
- Failures: bad signature → log + 400, no body. Bad timestamp → log + 400. Unknown event → log + 200 (so Paymob stops retrying), no DB effect.
- All successful processing writes to `payment_events` (append-only) before mutating order state.

### 5.6 iCarry webhooks (Zone W → Zone 2)

- Same pattern as Paymob: `ICARRY_WEBHOOK_SECRET` HMAC verification, replay window, idempotency by iCarry shipment event ID, append-only `shipment_events` table.

### 5.7 Cart manipulation

The client cart is **not trusted** for any commerce-affecting data.

- Cart contents arrive at checkout as a list of `{product_id, variant_id?, quantity}`.
- Server validates each line: product exists, is published, variant matches if specified, requested quantity <= available stock.
- Server fetches current `price_aed` from the database — **never accepts price from the client**.
- Server computes subtotal, VAT, delivery, total — never accepts totals from the client.
- Server-recomputed total goes into `orders.total_aed`. If the client-displayed total differed (e.g., price changed between page-load and checkout), the checkout flow shows the customer the new total before order finalization.

### 5.8 Idempotency

All write-side server actions that affect orders or payments require an idempotency key:

- Order creation: idempotency key = HMAC(server_secret + customer_id + cart_hash + intent_timestamp).
- Payment intent creation: idempotency key = HMAC(server_secret + order_id + payment_method).
- Replays return the same result without side effects.

### 5.9 Secrets handling

See `docs/ENVIRONMENT_VARIABLES.md` §3 for full secret rotation policy. Key controls:

- All secrets in Vercel env, never in repo.
- Service role key never in any file under `src/components/`, `src/app/(public)/`, `src/app/(auth)/`. Enforced by ESLint import restrictions.
- Logger redacts known secret-named keys (`PAYMOB_HMAC_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, etc.) from any log line.

### 5.10 PII handling — UAE PDPL alignment

UAE Federal Decree-Law No. 45 of 2021 (Personal Data Protection Law, "PDPL") applies. Controls:

- **Lawful basis recorded.** Customer signup captures consent: T&Cs, privacy policy, optional marketing consent (separate checkbox).
- **Purpose limitation.** PII collected (name, email, phone, address) is used for: account management, order fulfillment, customer support, transactional emails. Marketing use requires the separate consent checkbox.
- **Data minimization.** No DOB, no government ID numbers, no payment instrument numbers (Paymob holds those).
- **Retention (recommended policy — pending legal/accounting confirmation at M8):** Order data retained **minimum 5 years for VAT/accounting (UAE Federal Decree-Law No. 28 of 2022)**; **7 years recommended pending legal review**. Inactive customer accounts (no signin or order in **24 months**) flagged for review and may be purged after admin approval. Marketing consent records retained while customer exists; withdrawal events retained 5+ years as compliance proof. Audit log retained indefinitely (append-only). Payment events retained 5+ years for reconciliation. Customer deletion under PDPL Article 16: PII fields zeroed but order line items retained (customer_id nulled, `deleted_at` timestamp set). See `CONTEXT_EXPANSION_NOTES.md` §5 for full retention policy and the M8 legal-review checklist.
- **Access & erasure.** Customer can export their data via account → "Download my data" (returns JSON of their PII + order history). Customer can request deletion via support; deletion zeroes PII fields but retains order line items (anonymized) for accounting.
- **Cross-border transfer.** Supabase region must be EU or UAE-compatible (Supabase offers `eu-central-1`, `eu-west-2`, etc. — pick `eu-central-1` for proximity + PDPL adequacy). Vercel deploys to edge but customer PII flows route through `iad1` or `fra1` region — preference `fra1` (Frankfurt) for PDPL-friendly residency.
- **Breach notification.** If a personal data breach occurs, notify the UAE Data Office **per current PDPL implementing regulations — exact timing to be verified at M8** (draft regulations referenced 72 hours; final implementing regulations must be re-checked before launch).

---

## 6. Known threats accepted as residual risk

| Threat | Mitigation | Why accepting residual |
|---|---|---|
| Admin device compromise via phishing | MFA, IP allowlist option, audit log | Cannot fully prevent; rely on detection (audit log review) |
| Paymob outage during checkout | Stub fallback impossible (real money); show "payment temporarily unavailable, try again" + log | Vendor dependency |
| Race condition: same item ordered by two customers when stock = 1 | Stock decrement happens in transaction; whoever commits first wins; loser gets out-of-stock error | Acceptable race window for MVP; warehouse integration in Phase 2 will tighten |
| Returning customer's saved address used by someone else who compromises the account | MFA not required for customers (only admin); rely on email-verified password + account lockout | Customer MFA in Phase 2 |
| Brute force of order confirmation URLs | Order IDs are UUIDs (128 bits, unpredictable) | UUID entropy sufficient |
| Webhook from forged source | HMAC signature verification + timestamp window | Adequate |
| Supabase service role key leak | Strict ESLint rules, no client imports, rotation every 90 days | Defense in depth via RLS still protects most paths |
| PDPL retention defaults applied before legal sign-off | Defaults in `THREAT_MODEL.md` §5.10 are recommended policy; M8 milestone includes mandatory UAE legal counsel review before launch | Required gate before commerce launch; tracked in `CONTEXT_EXPANSION_NOTES.md` §5 |
| Paymob/iCarry hypothesis-based interface design | Adapter pattern isolates concrete impl from spec; M5/M6 verify against live docs and revise if needed | See `CONTEXT_EXPANSION_NOTES.md` §3, §4 |

---

## 7. Cross-check requirements per milestone

The following milestones invoke a HIGH_RIGOR cross-check sweep (v5 invariant — the other executor reviews):

- **M0 — Foundation.** Cross-check env validation, secret handling, ESLint security rules, structured logger redaction. Env validation, secret handling boundaries, and ESLint security rules implemented in Step 2; awaiting cross-check sweep. Structured logger redaction remains Step 3 scope.
- **M2 — Admin portal.** Cross-check MFA enrollment, admin authz checks on every server action, audit log writes, bulk-action confirmations.
- **M3 — Public catalog.** Cross-check RLS policies for `products`, `brands`, `categories`. Confirm `wholesale_price_internal` is never selected by any public query.
- **M4 — Cart & checkout.** Cross-check server-side cart revalidation, totals recomputation, idempotency key generation, no client-trusted prices.
- **M5 — Paymob.** Full HIGH_RIGOR cross-check sweep. Webhook signature verification, replay protection, idempotent event processing, secret handling, test transaction plan.
- **M6 — iCarry.** Same as M5 for shipping events.
- **M7 — Orders + email.** Cross-check email content (no PII over-disclosure), order status transition guards.
- **M8 — Pre-launch.** End-to-end threat model re-read against final implementation. Document any drift.

---

## 8. Audit & monitoring

- **Audit log table** captures every admin mutation (see §5.4). Append-only via RLS — even admins cannot delete or modify audit rows. The Supabase service role technically can, but doing so leaves traces in Postgres WAL.
- **Auth events** captured by Supabase Auth natively. Admin team should review weekly.
- **Failed webhook signatures** logged. >10 failures in 5 minutes triggers alert (Phase 2 monitoring).
- **Sentry** wired for unhandled exceptions in production (M8). PII redacted in `beforeSend`.

---

## 9. Update history

| Date | Version | Change |
|---|---|---|
| 2026-05-22 | 1.0.1 | Step 2 of M0: env loader + Supabase clients + ESLint import boundaries implemented. |
| 2026-05-21 | 1.0 | Initial seed for M0. |

---

_End of `THREAT_MODEL.md` v1.0.1._
