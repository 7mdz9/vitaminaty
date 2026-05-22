# PAYMENT_SPEC.md

**Project:** Vitaminaty
**Document version:** v1.0
**Owned by:** M5 (Paymob Real Integration milestone)
**HIGH_RIGOR:** Yes — payments domain. Full sweep applies.
**Audience:** BOB v5 / Claude Code / Codex / human engineers

---

## ⚠ Verification debt header

Every Paymob-specific detail in this document is **hypothesis-based** from training-data knowledge and **must be verified against current official Paymob documentation before M5 implementation**. See `CONTEXT_EXPANSION_NOTES.md` §3 for the verification checklist.

The M5 engineer is required to:

1. Read live Paymob docs at the start of M5.
2. Update this file's sections marked with 🟡 once verified, changing the marker to ✅.
3. Update `CONTEXT_EXPANSION_NOTES.md` §3 with verification notes.
4. Document any deviation from this spec in `LAST_SESSION.md`.

---

## 1. Goals

By end of M5:

1. Real `PaymobAdapter` implementation in `src/lib/paymob/paymob-adapter.ts` conforming to the `PaymentAdapter` interface defined in M0.
2. Webhook handler at `/api/webhooks/paymob` with HMAC verification, replay protection, idempotency.
3. All 5 payment methods (Cards, Apple Pay, Tabby, Tamara, COD) functional in sandbox.
4. End-to-end test transactions pass in sandbox for each method.
5. Live mode credentials configured but `paymob_live_mode` feature flag remains OFF until full cross-check sign-off.
6. Adversarial test suite passes (tampered signature, replayed timestamp, wrong algorithm).
7. Reconciliation tooling in place (admin UI shows payment events linked to orders).

---

## 2. The adapter interface (locked in M0)

```typescript
// src/lib/paymob/adapter.ts
export interface PaymentAdapter {
  /**
   * Create a payment intent for an order. Returns redirect/iframe info
   * that the client can use to complete the payment.
   */
  createIntent(input: CreateIntentInput): Promise<PaymentIntent>;

  /**
   * Verify a webhook payload and signature. Returns parsed event or throws.
   */
  verifyWebhook(rawBody: string, headers: Headers): Promise<VerifiedEvent>;

  /**
   * Issue a refund for a previous payment (full or partial).
   */
  refund(input: RefundInput): Promise<RefundResult>;

  /**
   * Look up a payment status from the provider (reconciliation).
   */
  getPaymentStatus(intentId: string): Promise<PaymentStatus>;
}

export interface CreateIntentInput {
  order: {
    id: string;
    reference: string;
    total_aed: AedAmount;          // whole AED integer
    customer: { email: string; phone_e164: string; full_name: string };
    ship_to: AddressSnapshot;
    items: Array<{ name: string; quantity: number; unit_price_aed: AedAmount }>;
  };
  method: 'card' | 'apple_pay' | 'tabby' | 'tamara' | 'cod';
  idempotency_key: string;
}

export interface PaymentIntent {
  intent_id: string;                // store on orders.payment_provider_intent_id
  provider_order_id: string;        // store on orders.payment_provider_order_id
  action:
    | { kind: 'redirect'; url: string }
    | { kind: 'iframe'; iframe_url: string; token: string }
    | { kind: 'cod'; reference: string };
  expires_at: string;
}

export interface VerifiedEvent {
  provider: 'paymob';
  provider_transaction_id: string;
  provider_order_id: string;
  provider_intent_id: string;
  kind: PaymentEventKind;
  amount_aed: AedAmount;
  currency: 'AED';
  occurred_at: string;
  raw_payload: object;
  signature_received: string;
}

export interface RefundInput {
  order_id: string;
  provider_transaction_id: string;
  amount_aed: AedAmount;            // can be partial
  reason?: string;
}
```

This interface is the same whether the stub or real adapter is selected. The selection logic:

```typescript
// src/lib/paymob/index.ts
import { env } from '@/lib/env';
import { StubPaymobAdapter } from './stub-adapter';
import { PaymobAdapter } from './paymob-adapter';

export function getPaymentAdapter(): PaymentAdapter {
  if (env.PAYMOB_MODE === 'live') return new PaymobAdapter(env);
  return new StubPaymobAdapter();
}
```

---

## 3. Paymob auth flow

🟡 Verification required at M5 — confirm legacy two-step vs Unified API.

### 3.1 Hypothesis (legacy two-step)

```
1. POST https://accept.paymob.com/api/auth/tokens
   Body: { "api_key": $PAYMOB_API_KEY }
   Returns: { "token": "..." }  ← short-lived auth token

2. Use that token in subsequent calls:
   Authorization: Bearer {token}
```

### 3.2 Hypothesis (Unified API / Intention API)

```
1. POST https://accept.paymob.com/v1/intention/
   Authorization: Token $PAYMOB_SECRET_KEY
   Body: { ... full order details ... }
   Returns: { client_secret, id, ... }

2. Iframe URL: https://accept.paymob.com/unifiedcheckout/?publicKey=$PUBLIC_KEY&clientSecret={client_secret}
```

### 3.3 Decision at M5

The M5 engineer picks one approach based on current Paymob docs and what their UAE account supports. This file is updated with the chosen approach + actual endpoints + actual env var requirements. The other env vars in `ENVIRONMENT_VARIABLES.md` §2.3 may consolidate.

---

## 4. Payment intent creation per method

🟡 All flows below are hypothesis-based.

### 4.1 Cards (3DS-enabled)

```
1. Adapter.createIntent({ method: 'card', order })
2. Call Paymob: register order, request payment_key with PAYMOB_INTEGRATION_ID_CARDS
3. Return iframe action:
   { kind: 'iframe', iframe_url: '...accept.paymob.com/api/acceptance/iframes/{IFRAME_ID}?payment_token={key}', token: key }
4. Client embeds iframe; customer enters card; Paymob handles PCI scope
5. Webhook fires with txn_response_code, is_3d_secure, etc.
```

### 4.2 Apple Pay

```
1. Adapter.createIntent({ method: 'apple_pay', order })
2. Different integration_id (PAYMOB_INTEGRATION_ID_APPLE_PAY)
3. Return: { kind: 'iframe', iframe_url: '...Apple Pay flow...' } OR
            { kind: 'redirect', url: 'paymob-hosted apple pay button page' }
4. Customer authorizes via device; Paymob receives token
5. Webhook fires
```

The exact pattern depends on whether we embed Paymob's Apple Pay button or redirect to Paymob's hosted page. **Decision at M5** based on UX requirements and Paymob's current recommendations.

### 4.3 Tabby (BNPL — Buy Now Pay Later)

```
1. Adapter.createIntent({ method: 'tabby', order })
2. PAYMOB_INTEGRATION_ID_TABBY
3. Return: { kind: 'redirect', url: '...tabby checkout URL via Paymob...' }
4. Customer completes Tabby flow off-site (4 installments)
5. Webhook fires with Tabby-specific approval/rejection
```

### 4.4 Tamara (BNPL alternative)

Same pattern as Tabby with `PAYMOB_INTEGRATION_ID_TAMARA`.

### 4.5 COD (Cash on Delivery)

COD is gateway-independent. The order is created with `payment_method='cod'` and `status='preparing'` immediately (skipping `pending_payment` → `paid`). No Paymob call. No webhook expected. Customer pays the courier on delivery.

```typescript
// Stub adapter handles this case identically to real adapter for COD
if (input.method === 'cod') {
  return {
    intent_id: `cod_${order_id}`,
    provider_order_id: `cod_${order_id}`,
    action: { kind: 'cod', reference: order.reference },
    expires_at: ...
  };
}
```

---

## 5. Webhook handler — `/api/webhooks/paymob`

This is the HIGH_RIGOR core. Implementation follows the THREAT_MODEL.md §5.5 controls.

### 5.1 Handler skeleton

```typescript
// src/app/api/webhooks/paymob/route.ts
export async function POST(request: Request) {
  const rawBody = await request.text();              // raw, NOT request.json()
  const adapter = getPaymentAdapter();
  
  let verified: VerifiedEvent;
  try {
    verified = await adapter.verifyWebhook(rawBody, request.headers);
  } catch (err) {
    if (err instanceof BadSignatureError) {
      logger.warn('paymob.webhook.bad_signature', { ip: request.headers.get('x-forwarded-for') });
      return new Response('bad signature', { status: 400 });
    }
    if (err instanceof StaleRequestError) {
      logger.warn('paymob.webhook.stale', { ... });
      return new Response('stale', { status: 400 });
    }
    logger.error('paymob.webhook.parse_error', { err });
    return new Response('parse error', { status: 400 });
  }
  
  // Idempotency check
  const existing = await paymentEventRepo.find({
    provider: 'paymob',
    provider_transaction_id: verified.provider_transaction_id,
    kind: verified.kind
  });
  if (existing) {
    logger.info('paymob.webhook.idempotent_replay', { ... });
    return new Response('', { status: 200 });
  }
  
  // Append-only event log
  await paymentEventRepo.insert({
    order_id: await orderRepo.findByPaymobIntent(verified.provider_intent_id).id,
    kind: verified.kind,
    provider: 'paymob',
    provider_transaction_id: verified.provider_transaction_id,
    provider_intent_id: verified.provider_intent_id,
    amount_aed: verified.amount_aed,
    currency: verified.currency,
    raw_payload: verified.raw_payload,
    signature_received: verified.signature_received,
    occurred_at: verified.occurred_at
  });
  
  // Apply order state transition (separate service call)
  await paymentService.applyEvent(verified);
  
  return new Response('', { status: 200 });
}
```

### 5.2 HMAC verification

🟡 Algorithm and field order verification required at M5.

Hypothesis (legacy Paymob HMAC):

```typescript
// Paymob constructs the HMAC string by concatenating specific fields in a documented order.
// Example for "Transaction Processed Callback":
const concatenated = [
  payload.amount_cents,
  payload.created_at,
  payload.currency,
  payload.error_occured,
  payload.has_parent_transaction,
  payload.id,
  payload.integration_id,
  payload.is_3d_secure,
  payload.is_auth,
  payload.is_capture,
  payload.is_refunded,
  payload.is_standalone_payment,
  payload.is_voided,
  payload.order.id,
  payload.owner,
  payload.pending,
  payload.source_data.pan,
  payload.source_data.sub_type,
  payload.source_data.type,
  payload.success
].join('');

const expected = crypto
  .createHmac('sha512', PAYMOB_HMAC_SECRET)
  .update(concatenated)
  .digest('hex');

const received = headers.get('hmac') || payload.hmac;

if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received))) {
  throw new BadSignatureError();
}
```

**M5 must verify:**
- Exact field order per event type (different events may have different orders)
- SHA-512 vs SHA-256 algorithm
- Where HMAC arrives (header vs body)
- Encoding (hex vs base64)
- `crypto.timingSafeEqual` always used (constant-time comparison)

### 5.3 Replay protection

```typescript
const occurredAt = new Date(payload.created_at);
const now = new Date();
const windowSeconds = env.WEBHOOK_REPLAY_WINDOW_SECONDS;

if (Math.abs(now.getTime() - occurredAt.getTime()) > windowSeconds * 1000) {
  throw new StaleRequestError();
}
```

Default window: 300 seconds (5 minutes). Tunable via env.

### 5.4 Idempotency

Database unique constraint on `payment_events(provider, provider_transaction_id, kind)` per `DB_SCHEMA.md` §7.3.

If Paymob re-delivers the same event (which they do on receiving non-200 from us), the INSERT fails the unique constraint. The handler catches this and returns 200 without re-applying the state transition.

### 5.5 Event kinds and order state transitions

| Paymob event | `payment_event_kind` | Order state transition |
|---|---|---|
| Auth + capture success | `captured` | `pending_payment` → `paid`; set `paid_at`; trigger confirmation email; trigger shipment creation |
| Auth-only (capture pending) | `authorized` | `pending_payment` → `paid` (treating auth-only as success for our model); same triggers |
| Failure (any reason) | `failed` | `pending_payment` → `failed`; set `failed_at`; trigger failure email |
| Refund | `refunded` | If amount matches order total → `paid` → `refunded`; otherwise record event, no status change |
| Void | `voided` | `pending_payment` → `cancelled` |
| Chargeback | `chargeback` | Record event, alert admin team (no auto-status change — needs human review) |

🟡 Verify mapping against actual Paymob event payloads at M5.

---

## 6. Sandbox & test transactions

🟡 Sandbox specifics to verify at M5.

### 6.1 Sandbox setup

- Separate Paymob account for sandbox (free tier).
- Sandbox integration IDs in `.env.staging`.
- Sandbox iframe ID different from live.
- Webhook URL configured at Paymob dashboard to point at the staging deploy.

### 6.2 Test cards (per Paymob docs — to verify)

| Scenario | Test Card | Notes |
|---|---|---|
| Successful 3DS | 5111... | 3DS passes |
| Failed 3DS | 5111... | 3DS fails |
| Insufficient funds | 5111... | Returns specific error |
| Generic decline | 5111... | Returns decline |

### 6.3 Required test transactions before live cutover

The M5 cross-check requires successful end-to-end runs of:

1. Cards: 3DS success → order paid → email sent → shipment created
2. Cards: 3DS failure → order failed → failure email sent
3. Apple Pay: success → order paid
4. Tabby: redirect → approved → webhook → order paid
5. Tamara: redirect → approved → webhook → order paid
6. COD: order created in `preparing` directly, no payment provider call
7. Refund: full refund → `refunded` event → order status updated
8. Refund: partial refund → event recorded, order remains `paid`

Test records archived in `tests/integration/paymob-real/` with anonymized payloads.

---

## 7. Adversarial tests (HIGH_RIGOR mandate)

Per `THREAT_MODEL.md` §7 cross-check requirements, M5 must include these test categories:

| Test | Expected outcome |
|---|---|
| Tampered signature (one bit flipped) | 400 + bad_signature log entry |
| Stale timestamp (older than window) | 400 + stale_request log entry |
| Future timestamp (clock skew attack) | 400 + stale_request log entry |
| Replayed payload (same transaction_id+kind seen before) | 200, no side effect |
| Wrong HMAC algorithm (SHA-256 instead of SHA-512, if SHA-512 is the spec) | 400 + bad_signature |
| Off-by-one field concatenation order | 400 + bad_signature |
| Empty body | 400 |
| Malformed JSON | 400 |
| Valid signature but unknown event type | 200, logged, no side effect |
| Webhook for an order that doesn't exist | 400 + alert (potential attack signal) |
| Webhook with amount mismatch (Paymob says AED 100, our order says AED 200) | 400 + alert |

All adversarial tests live in `tests/integration/webhooks/paymob.adversarial.test.ts`.

---

## 8. Secrets and storage

| Field | Stored | Notes |
|---|---|---|
| `PAYMOB_API_KEY` | Vercel env | Server-only, never in client bundle |
| `PAYMOB_HMAC_SECRET` | Vercel env | Server-only, used only in webhook verification |
| `PAYMOB_INTEGRATION_ID_*` | Vercel env | Not secret per se, but env-scoped |
| Paymob transaction ID | DB `payment_events.provider_transaction_id` | For reconciliation |
| Paymob order ID | DB `orders.payment_provider_order_id` | Reconciliation |
| Paymob payment_key / client_secret | DB `orders.payment_provider_intent_id` (short-lived; ok to store) | For polling status if webhook missed |
| **PAN (card number)** | **NEVER STORED** | Paymob holds; we only see masked last4 |
| **CVV** | **NEVER STORED, NEVER RECEIVED** | Paymob holds |
| **Expiry date** | **NEVER STORED** | Paymob holds |
| Card sub-type (e.g., "MasterCard") | `payment_events.raw_payload` | OK — not PCI |
| Masked last-4 (e.g., "•••• 4242") | `payment_events.raw_payload` | OK — not PCI |
| 3DS authentication data | **NEVER STORED** | Issuer secret |

Runtime guard: a pre-insert hook on `payment_events` scans the `raw_payload` JSON for fields named `pan`, `card_number`, `cvv`, `cvc`, `expiry`, `exp_month`, `exp_year` and **strips them** before insert. Anything unexpected logs an alert.

---

## 9. Reconciliation

A daily reconciliation job (Phase 2 trigger; M5 lays groundwork):

```
1. For all orders with status='paid' or 'failed' in the last 24 hours:
2.   Compare orders.total_aed against sum of payment_events with kind='captured' minus 'refunded'
3.   Flag discrepancies in an admin alert
```

M5 ships the data shape and admin UI to view this. The cron job itself is Phase 2.

---

## 10. Future capabilities (post-MVP, documented for context)

| Capability | When | Notes |
|---|---|---|
| Saved cards (tokenization) | Phase 2 | Customer opts in; we store only Paymob's token, never card data |
| Apple Pay button on PDP for one-tap checkout | Phase 2 | UX optimization |
| Multi-currency (AED only at MVP; potentially USD, SAR later) | Phase 2 | Database has `currency` columns already; UI ready |
| Subscription payments | Phase 3 | Different domain (recurring billing) |
| Refund partial product-line refunds | Phase 2 | Currently refund is order-level only |
| Tabby/Tamara as primary BNPL highlight on PDP | Phase 2 | "Pay AED X in 4 installments" badge |

---

## 11. Definition of done (M5)

- [ ] `PaymobAdapter` implements full `PaymentAdapter` interface.
- [ ] `/api/webhooks/paymob` handler complete.
- [ ] HMAC verification with current algorithm + field order (verified against live docs).
- [ ] Replay window enforced.
- [ ] Idempotency via DB constraint enforced and tested.
- [ ] All 5 payment methods tested in sandbox.
- [ ] All adversarial tests pass.
- [ ] Reconciliation viewer in admin portal.
- [ ] PCI never-store guard active.
- [ ] `CONTEXT_EXPANSION_NOTES.md` §3 updated with verification notes.
- [ ] HIGH_RIGOR cross-check by the other executor (Codex if Opus built, vice versa).
- [ ] `paymob_live_mode` flag remains OFF; flip is a separate manual sign-off step.

---

_End of `PAYMENT_SPEC.md` v1.0._
