# ARCHITECTURE.md

**Project:** Vitaminaty
**Document version:** v1.0
**Document type:** System architecture overview
**Audience:** BOB v5 / Claude Code / Codex / human reviewers
**Relationship to other docs:** This is the high-altitude map. For details on schemas, payments, delivery, admin portal, AI support, see the per-area spec files referenced inline.

---

## 1. The system at a glance

Vitaminaty is a single Next.js application deployed on Vercel, backed by a single Supabase project (Postgres + Auth + Storage). It serves three audiences from one codebase:

1. **Public customers** — browse, search, add to cart, check out, place orders, manage their account.
2. **Admin operators** — import the catalog, enrich products, manage orders, configure integrations.
3. **External webhook senders** — Paymob and iCarry call us back with payment and shipment events.

External integrations are reached through adapter interfaces (`PaymentAdapter`, `ShippingAdapter`, `SupportChatProvider`), each with a stub implementation present from day one. Real implementations slot in at dedicated milestones.

```
┌──────────────────────────────────────────────────────────────────────┐
│                              VERCEL EDGE                              │
│                  HTTPS · HSTS · CSP · Static asset CDN               │
└─────────────────┬─────────────────────────────┬──────────────────────┘
                  │                             │
                  ▼                             ▼
   ┌──────────────────────────┐   ┌────────────────────────────┐
   │  Next.js App Router      │   │  Static assets (public/)   │
   │  (single deploy)         │   │  Fonts, images, manifest   │
   │                          │   └────────────────────────────┘
   │  ┌────────────────────┐  │
   │  │ Public routes      │  │   ┌────────────────────────────┐
   │  │ (public)/...       │──┼──▶│  Supabase Auth (customer)  │
   │  └────────────────────┘  │   └────────────────────────────┘
   │  ┌────────────────────┐  │
   │  │ Customer auth      │  │
   │  │ (auth)/...         │  │
   │  └────────────────────┘  │
   │  ┌────────────────────┐  │   ┌────────────────────────────┐
   │  │ Admin portal       │──┼──▶│  Supabase Auth + MFA       │
   │  │ /admin/...         │  │   └────────────────────────────┘
   │  └────────────────────┘  │
   │  ┌────────────────────┐  │   ┌────────────────────────────┐
   │  │ Webhook handlers   │◀─┼───│  Paymob (signed HMAC)      │
   │  │ /api/webhooks/...  │  │   │  iCarry  (signed HMAC)     │
   │  └────────────────────┘  │   └────────────────────────────┘
   │  ┌────────────────────┐  │
   │  │ Server actions     │  │
   │  │ (mutations)        │  │
   │  └────────────────────┘  │
   └────────┬─────────────────┘
            │
            ▼
   ┌──────────────────────────────────────────────────────────┐
   │                       SUPABASE                            │
   │  ┌────────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │
   │  │  Postgres  │  │   Auth   │  │ Storage  │  │ Edge   │ │
   │  │  + RLS     │  │  + MFA   │  │ (images) │  │ Funcs  │ │
   │  └────────────┘  └──────────┘  └──────────┘  └────────┘ │
   └──────────────────────────────────────────────────────────┘

   ┌──────────────────────────────────────────────────────────┐
   │              EXTERNAL                                     │
   │  Paymob (payments)  ·  iCarry (delivery)  ·  Resend       │
   │  Anthropic (future AI)  ·  Upstash Redis (rate limit)     │
   └──────────────────────────────────────────────────────────┘
```

---

## 2. Layer model

The codebase is organized in four logical layers. Each layer has a clear responsibility and explicit import direction (lower layers don't import from higher layers).

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 4 — Routes & UI                                       │
│  src/app/**/page.tsx, layout.tsx                             │
│  src/components/**                                           │
│  • Server Components render the page                         │
│  • Client Components handle interactivity                    │
│  • UI is dumb — receives props, calls actions                │
└────────────────┬────────────────────────────────────────────┘
                 │ calls
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 3 — Feature modules (actions & queries)               │
│  src/features/**/actions.ts                                  │
│  src/features/**/queries.ts                                  │
│  • Unit of milestone work                                    │
│  • Server actions for mutations                              │
│  • Server-side queries for reads (cache-friendly)            │
│  • Orchestrates layer 2 services                             │
└────────────────┬────────────────────────────────────────────┘
                 │ calls
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 2 — Services (business logic)                         │
│  src/server/services/**                                      │
│  • Authoritative business rules                              │
│  • Money math, totals computation, VAT                       │
│  • Status transitions, idempotency                           │
│  • Orchestrates layer 1 repositories + lib utilities        │
└────────────────┬────────────────────────────────────────────┘
                 │ calls
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 1 — Data access & utilities                           │
│  src/server/repositories/**  (DB access)                     │
│  src/lib/**  (env, supabase clients, money primitives,       │
│              paymob/icarry adapters, validation, crypto,    │
│              logger, email, images)                          │
│  • Only layer that touches the database directly             │
│  • Only layer that touches external integrations             │
│  • Pure, testable, replaceable                               │
└─────────────────────────────────────────────────────────────┘
```

**Allowed import directions:**
- Layer 4 → Layer 3 only (UI calls server actions/queries)
- Layer 3 → Layer 2 (features orchestrate services)
- Layer 3 → Layer 1 utilities (features use validation, money, logger)
- Layer 2 → Layer 1 (services use repositories and adapters)
- Layer 1 → none of the above

**Forbidden:**
- Layer 4 importing from Layer 1 or 2 (would skip business logic)
- Layer 1 importing from Layer 2, 3, or 4 (would couple data access to UI)
- Cross-feature imports from feature internals (use shared types in `src/types/`)

ESLint rules enforce these boundaries (added in M0).

---

## 3. Request lifecycle — public PDP read

A reader-friendly trace of a typical request:

```
1. Browser → GET /products/applied-nutrition-critical-whey-2270g
2. Vercel edge → Next.js server (Frankfurt region)
3. Next.js routes to src/app/(public)/products/[slug]/page.tsx (Server Component)
4. Server Component calls src/features/products/queries.ts → getProductBySlug(slug)
5. queries.ts calls src/server/services/product-service.ts → getPublicProduct(slug)
6. product-service.ts:
   a. Calls product-repository.getBySlug(slug)
      - Uses anon supabase client + RLS (filters to is_public_visible=true)
      - Returns { product, brand, category, variants[], images[], goal_tags[] }
   b. Computes the "render mode" (Cases A-G per v1.1) from field statuses
   c. Returns shaped { product, renderMode }
7. Server Component renders PDP based on renderMode:
   - Always renders: header, brand line, name, price, image-or-placeholder, stock, cart controls, trust block, FAQ, reviews-empty-state
   - Conditionally renders: about, benefits, directions, nutrition_panel, ingredients, allergens, storage, warnings, about-brand, often-bought-with, you-may-also-like
8. HTML streams back to browser
9. Client hydrates only the interactive parts (variant selector, quantity stepper, add-to-cart button)
```

No layer reaches across boundaries. Every step has a single responsibility.

---

## 4. Request lifecycle — checkout flow

A more complex trace involving HIGH_RIGOR steps:

```
1. Customer clicks "Place Order" on /checkout
2. Client serializes cart (product_id, variant_id, quantity per line) + chosen
   shipping method + chosen payment method + idempotency key (HMAC-derived)
3. Client calls createOrder server action via Next.js form action
4. Server action receives the payload:
   src/features/checkout/actions.ts → createOrder({cart, shipping, payment, idempotency_key})
5. Action calls src/server/services/checkout-service.ts → placeOrder(input)
6. Service flow:
   a. Verify idempotency key — if seen before, return cached result, no side effects
   b. Validate session — fetch customer from auth, require email-verified
   c. Re-fetch every product/variant from DB by ID
   d. Validate each variant: exists, is_public_visible, in_stock, requested
      quantity <= available
   e. Authoritative totals: 
      - subtotal = sum(variant.price_aed * quantity) from DB, not client
      - shipping_cost = ShippingAdapter.getQuote(...) → AED 0 if subtotal>=200 std
      - vat_amount = computed via lib/money/vat.ts (5% inclusive)
      - total = subtotal + shipping_cost
   f. Compare with client-displayed total. If they differ (e.g., price changed
      between page-load and checkout), return mismatch error with new total —
      client shows confirmation dialog with new total
   g. Create order in DB:
      - INSERT into orders (status='pending_payment', frozen snapshot of address,
        line items, totals)
      - Decrement stock on variants (within same transaction)
      - Write audit_log entry
   h. Call PaymentAdapter.createIntent(order_id, total, method)
      - Returns {intent_id, redirect_url or iframe_token}
   i. Return { order_id, payment_intent } to action
7. Action returns to client
8. Client redirects to Paymob iframe / hosted page / Tabby / Tamara per method
9. Customer completes payment off-site (Paymob holds card data)
10. Paymob fires webhook → /api/webhooks/paymob
11. Webhook handler:
    a. Verify HMAC signature (PAYMOB_HMAC_SECRET)
    b. Verify timestamp within replay window
    c. Idempotency check by Paymob transaction ID
    d. Append to payment_events (immutable)
    e. Update order status (pending_payment → paid)
    f. Trigger order confirmation email (M7+)
    g. Trigger shipment creation via ShippingAdapter (M6+)
    h. Return 200 to Paymob
12. Customer redirected back to /order-confirmation/[orderId]
```

Every HIGH_RIGOR concern is addressed at a specific step: idempotency at 6a, server-side totals at 6e, frozen address snapshot at 6g, audit log at 6g, HMAC verification at 11a, replay protection at 11b, event idempotency at 11c, append-only ledger at 11d.

---

## 5. Trust zones revisited (cross-link to THREAT_MODEL.md)

See `THREAT_MODEL.md` §4 for the full diagram. Architecture-level summary:

| Zone | Trust level | Code that runs in this zone |
|---|---|---|
| Zone 0 — Internet | None | Browser, scripts, scrapers |
| Zone 1 — Customer | Low | Customer-session-scoped server actions |
| Zone 2 — App server | Medium | Next.js server runtime on Vercel |
| Zone 3 — Database | High (RLS-enforced) | Postgres |
| Zone A — Admin (MFA) | Highest | Admin server actions, audit log writers |
| Zone W — Webhooks | Trust on signature | `/api/webhooks/paymob`, `/api/webhooks/icarry` |

Every server action and webhook handler explicitly identifies which zone it runs in and what authentication/verification it requires. The `requireAdmin()`, `requireCustomer()`, `requireWebhookSignature()` helpers in `src/lib/auth/policies.ts` enforce these checks.

---

## 6. Data flow — admin-driven progressive enrichment

This is the heartbeat of the system per `PRODUCT_CONTENT_SPEC_v1.1_ADMIN_DRIVEN.md`.

```
┌──────────────────────────────────────────────────────────────────┐
│  product.md (817 source rows → 787 unique products)               │
│  docs/reference/product.md                                         │
└────────────────────────┬─────────────────────────────────────────┘
                         │ scripts/import-products-from-md.ts (M1)
                         ▼
┌──────────────────────────────────────────────────────────────────┐
│  products table (Supabase Postgres)                               │
│  All 787 products land with status='imported'                     │
│  Field statuses computed: name=complete, brand=complete OR        │
│    needs_review, price=complete OR missing, all others=missing    │
│  Admin review flags: case_pack flagged for 140 rows,              │
│    missing_price for 360 rows, needs_category_review for 36       │
│  is_public_visible=false on every product                         │
└────────────────────────┬─────────────────────────────────────────┘
                         │ admin team via /admin/products
                         ▼
┌──────────────────────────────────────────────────────────────────┐
│  Progressive enrichment over time (M2 onward)                     │
│  • Set canonical brand if needs_review                            │
│  • Map category to public taxonomy if needs_review                │
│  • Set price if missing                                           │
│  • Upload images                                                  │
│  • Assign goal tags                                               │
│  • Write description (drafted or manual)                          │
│  • Enter nutrition panel from physical label                      │
│  • Enter ingredients verbatim                                     │
│  • Set allergens                                                  │
│  • Enter directions of use                                        │
│  • Enter warnings                                                 │
│  • Set SEO title and description                                  │
│  • completion_score recomputed on every save                      │
│  • Status auto-progresses: imported → draft → partial →           │
│    ready_to_publish (when MVP fields complete)                    │
└────────────────────────┬─────────────────────────────────────────┘
                         │ admin clicks "Publish" on individual product
                         ▼
┌──────────────────────────────────────────────────────────────────┐
│  Public visibility unlocked for that product                      │
│  is_public_visible = true                                         │
│  status = published                                                │
│  Adaptive PDP renders Case D (or E if full enrichment done)      │
└──────────────────────────────────────────────────────────────────┘
```

The public site **never** shows a product that admin hasn't explicitly published. Missing fields hide their sections. Fake data never appears.

---

## 7. Feature flag wiring

Per `DECISION_CAPTURE.md` §4, flags live in a Supabase table and are evaluated server-side only. Architectural placement:

```
src/features/feature-flags/
├── flags.ts        — Flag constants and types (compile-time enum)
├── eval.ts         — isEnabled(key) function with env override + DB lookup
└── admin-actions.ts — Server actions for admins to toggle flags

Usage pattern in Server Components:
─────────────────────────────────────
import { isEnabled } from '@/features/feature-flags/eval';

export default async function CartPage() {
  if (!await isEnabled('commerce_enabled')) {
    notFound(); // or redirect to home with message
  }
  // ... rest of page
}
```

Client components receive flag results as props. No client-side flag SDK.

---

## 8. Adapter pattern — Paymob, iCarry, Support Chat

All external integrations follow the same pattern:

```typescript
// 1. Interface in src/lib/{name}/adapter.ts
export interface PaymentAdapter {
  createIntent(order: Order, method: PaymentMethod): Promise<PaymentIntent>;
  verifyWebhook(rawBody: string, signature: string): Promise<VerifiedEvent>;
  refund(payment: Payment, amount: AedAmount): Promise<RefundResult>;
}

// 2. Stub implementation in src/lib/{name}/stub-adapter.ts
export class StubPaymentAdapter implements PaymentAdapter {
  async createIntent(order, method) {
    // Returns a fake intent with predictable IDs.
    // Marks the order as "stub_pending" for visibility.
    return { intent_id: `stub_${order.id}`, ... };
  }
  // ... other methods stubbed similarly
}

// 3. Real implementation in src/lib/{name}/{name}-adapter.ts (built at M5/M6)
export class PaymobAdapter implements PaymentAdapter { /* ... */ }

// 4. Adapter selection in src/lib/{name}/index.ts
export function getPaymentAdapter(): PaymentAdapter {
  if (env.PAYMOB_MODE === 'live') return new PaymobAdapter(...);
  return new StubPaymentAdapter();
}
```

Everywhere else in the codebase imports `getPaymentAdapter()`, never specific implementations. This means:

- M0-M4 can build the full checkout flow against the stub.
- M5 swaps in the real adapter without touching feature code.
- Phase 2 gateway switch (if ever) is a single file change.

Same pattern for `ShippingAdapter` (`src/lib/icarry/`) and `SupportChatProvider` (`src/features/support-chat/`).

---

## 9. State files lifecycle

`PROJECT_STATE.md`, `LAST_SESSION.md`, `THREAT_MODEL.md` are not docs in the traditional sense — they're **operational state** that v5 reads every session and updates after every milestone.

```
┌────────────────────────────────────────────────────────────────┐
│  At session start, v5 reads:                                    │
│  • PROJECT_STATE.md  — current stack, patterns, key files      │
│  • LAST_SESSION.md   — what happened last, what's the blocker  │
│  • THREAT_MODEL.md   — when HIGH_RIGOR fires                   │
│  • The spec section for the current milestone                  │
│  • CONTEXT_EXPANSION_NOTES.md — when working on M5/M6/M8       │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│  v5 executes the milestone                                      │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│  At session end, v5 (or engineer) updates:                      │
│  • PROJECT_STATE.md — new patterns, new files, new known issues │
│  • LAST_SESSION.md — overwrite with what just happened          │
│  • THREAT_MODEL.md — when HIGH_RIGOR cross-check was completed  │
│  • CONTEXT_EXPANSION_NOTES.md — verified hypotheses (M5/M6/M8)  │
└────────────────────────────────────────────────────────────────┘
```

Never let these drift. They're the only way v5 maintains continuity across milestones.

---

## 10. What's NOT in the architecture (intentional non-goals)

- **No microservices.** One Next.js app, one Supabase project. Microservices are not justified for this scale.
- **No separate API service.** Server actions handle internal mutations; `/api/webhooks/*` and `/api/health` are the only HTTP API surfaces.
- **No client-side data fetching library (React Query, SWR, etc.).** Server Components handle reads; mutations go through server actions. Client cache where needed is component-local state.
- **No state management library (Redux, Zustand, MobX) for global state.** The only client-side global state is the cart, which lives in a small dedicated module (`src/features/cart/client-cart-store.ts`).
- **No GraphQL layer.** Server actions + repository queries cover all mutation and read shapes.
- **No headless CMS.** Homepage curation lives in admin pages and writes to specific DB rows.
- **No payment processor #2.** Single gateway (Paymob) at MVP. Adapter pattern enables future addition.
- **No multi-region deploy.** UAE-only launch. Vercel Frankfurt region serves UAE adequately.

---

## 11. Cross-references

| Concern | Where it's specified |
|---|---|
| Stack and conventions | `PROJECT_STRUCTURE.md` |
| Env vars | `ENVIRONMENT_VARIABLES.md` |
| Database schema | `DB_SCHEMA.md` |
| Server actions + webhook contracts | `API_SPEC.md` |
| Admin portal | `ADMIN_PORTAL_SPEC.md` |
| Paymob | `PAYMENT_SPEC.md` + `CONTEXT_EXPANSION_NOTES.md` §3 |
| iCarry | `DELIVERY_SPEC.md` + `CONTEXT_EXPANSION_NOTES.md` §4 |
| Future AI support | `AI_SUPPORT_FUTURE_SPEC.md` |
| Security stance | `THREAT_MODEL.md` |
| Catalog content rules | `PRODUCT_CONTENT_SPEC_v1.1_ADMIN_DRIVEN.md` |
| Milestone schedule | `proj_spec.md` |

---

_End of `ARCHITECTURE.md` v1.0._
