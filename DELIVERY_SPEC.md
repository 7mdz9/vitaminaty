# DELIVERY_SPEC.md

**Project:** Vitaminaty
**Document version:** v1.0
**Owned by:** M6 (iCarry Real Integration milestone)
**HIGH_RIGOR:** Partial — production data path, webhook signature verification, secrets
**Audience:** BOB v5 / Claude Code / Codex / human engineers

---

## ⚠ Verification debt header

iCarry's public API documentation is less polished than Paymob's. Every iCarry detail in this document is **hypothesis-based** and the M6 engineer must verify against current iCarry documentation OR pivot to an alternative shipping provider while keeping the `ShippingAdapter` interface unchanged.

See `CONTEXT_EXPANSION_NOTES.md` §4 for the verification checklist.

---

## 1. Goals

By end of M6:

1. Real `ICarryAdapter` (or alternative chosen at verification) in `src/lib/icarry/icarry-adapter.ts` conforming to the `ShippingAdapter` interface from M0.
2. Shipment creation triggered on `orders.status = 'paid'` (or on order creation for COD).
3. Tracking number + URL stored on order and displayed to customer.
4. Webhook handler at `/api/webhooks/icarry` for status updates (or polling fallback if no webhooks).
5. End-to-end test shipments work in sandbox.
6. Live mode credentials configured but `icarry_live_mode` flag remains OFF until cross-check sign-off.
7. Admin order management can see shipment events linked to orders.

---

## 2. The adapter interface (locked in M0)

```typescript
// src/lib/icarry/adapter.ts
export interface ShippingAdapter {
  /**
   * Get a shipping quote for an address + cart weight. Returns available
   * methods with prices and ETA.
   */
  getQuote(input: QuoteInput): Promise<ShippingQuote>;

  /**
   * Create a shipment record at the provider after the order is paid.
   */
  createShipment(input: CreateShipmentInput): Promise<ShipmentCreated>;

  /**
   * Verify a webhook payload and signature.
   */
  verifyWebhook(rawBody: string, headers: Headers): Promise<VerifiedShipmentEvent>;

  /**
   * Poll for current status if webhooks unavailable.
   */
  getShipmentStatus(providerShipmentId: string): Promise<ShipmentStatus>;

  /**
   * Cancel a shipment (best effort).
   */
  cancelShipment(providerShipmentId: string): Promise<void>;
}

export interface QuoteInput {
  destination: { city: string; emirate: string; country_code: 'AE' };
  total_weight_grams: number;
  declared_value_aed: number;
  is_cod: boolean;
  cod_amount_aed?: number;
}

export interface ShippingQuote {
  methods: Array<{
    id: 'standard' | 'express' | 'same_day';
    label: string;
    cost_aed: AedAmount;
    eta_min_days: number;
    eta_max_days: number;
    available: boolean;
  }>;
}

export interface CreateShipmentInput {
  order_id: string;
  order_reference: string;
  customer: { name: string; phone_e164: string; email: string };
  origin: { /* Vitaminaty warehouse */ };
  destination: AddressSnapshot;
  items: Array<{ name: string; quantity: number; weight_grams?: number; sku?: string }>;
  method: 'standard' | 'express' | 'same_day';
  total_weight_grams: number;
  declared_value_aed: number;
  is_cod: boolean;
  cod_amount_aed?: number;
  special_instructions?: string;
  idempotency_key: string;
}

export interface ShipmentCreated {
  provider_shipment_id: string;
  tracking_number: string;
  tracking_url: string | null;
  estimated_delivery: string | null;
  label_pdf_url: string | null;       // if provider returns a label
}

export interface VerifiedShipmentEvent {
  provider: 'icarry' | string;
  provider_shipment_id: string;
  status: ShipmentStatus;
  occurred_at: string;
  raw_payload: object;
}
```

Adapter selection:

```typescript
// src/lib/icarry/index.ts
export function getShippingAdapter(): ShippingAdapter {
  if (env.ICARRY_MODE === 'live') return new ICarryAdapter(env);
  return new StubShippingAdapter();
}
```

---

## 3. Stub adapter behavior (M0–M5)

The stub provides realistic responses so M3/M4 development isn't blocked:

```typescript
// src/lib/icarry/stub-adapter.ts
export class StubShippingAdapter implements ShippingAdapter {
  async getQuote(input: QuoteInput): Promise<ShippingQuote> {
    return {
      methods: [
        {
          id: 'standard',
          label: 'Standard Delivery',
          cost_aed: input.declared_value_aed >= 200 ? 0 : 20,
          eta_min_days: 1,
          eta_max_days: 2,
          available: true
        },
        {
          id: 'express',
          label: 'Express Delivery',
          cost_aed: 30,
          eta_min_days: 1,
          eta_max_days: 1,
          available: true
        },
        {
          id: 'same_day',
          label: 'Same-Day Delivery',
          cost_aed: 50,
          eta_min_days: 0,
          eta_max_days: 0,
          available: false           // disabled until feature flag flips
        }
      ]
    };
  }

  async createShipment(input: CreateShipmentInput): Promise<ShipmentCreated> {
    return {
      provider_shipment_id: `stub_${input.order_id}`,
      tracking_number: `STUB${Date.now()}`,
      tracking_url: null,
      estimated_delivery: addDays(new Date(), 2).toISOString(),
      label_pdf_url: null
    };
  }

  // verifyWebhook, getShipmentStatus, cancelShipment stubbed similarly
}
```

---

## 4. iCarry decision tree (at M6)

🟡 M6 first task: read iCarry docs and choose.

### 4.1 Path A — iCarry has a usable REST API

Implement `ICarryAdapter` directly. Proceed with §5 onward.

### 4.2 Path B — iCarry has no API but has a sales/portal interface

Two sub-options:

- **B1:** Admin team manually enters shipments into iCarry's web portal. Our system tracks orders as `preparing` until admin marks them as shipped. Tracking number entered manually. No automated webhook.
- **B2:** Use a different aggregator with a documented API:
  - **Shipox** — UAE multi-carrier aggregator with API.
  - **Postaplus** — UAE.
  - **Direct integration with Aramex** — well-documented but only one carrier.
  - **Direct integration with Emirates Post** — established, has API.

For B1 (manual), the `ICarryAdapter` is essentially a thin wrapper that doesn't call any external API and returns shipment records based on admin input. The order management UI in `/admin/orders/[id]` becomes the entry point.

For B2 (alternative aggregator), the `ShippingAdapter` interface stays the same; only the concrete implementation differs. Update `ENVIRONMENT_VARIABLES.md` §2.4 with the new provider's env vars.

### 4.3 Choosing at M6

The M6 engineer evaluates iCarry against the verification checklist in `CONTEXT_EXPANSION_NOTES.md` §4 and chooses one of A / B1 / B2. This document is updated to reflect the chosen path.

---

## 5. iCarry API (hypothesis — Path A)

🟡 All endpoint paths, payload shapes, and response formats are hypothesis-based.

### 5.1 Auth

Hypothesis: API key in header.

```http
GET /api/shipments/123
Authorization: Bearer $ICARRY_API_KEY
```

Or alternatively:

```http
GET /api/shipments/123
X-API-Key: $ICARRY_API_KEY
```

### 5.2 Create shipment

Hypothesis:

```http
POST /api/v1/shipments
Authorization: Bearer $ICARRY_API_KEY
Content-Type: application/json

{
  "reference": "VIT-2026-000123",
  "origin": {
    "name": "Vitaminaty Warehouse",
    "phone": "+9714XXXXXXXX",
    "address": "...",
    "city": "Dubai",
    "emirate": "Dubai",
    "country": "AE"
  },
  "destination": {
    "name": "Customer Name",
    "phone": "+97150XXXXXXX",
    "address": "Apartment 12, Building Name, ...",
    "city": "Abu Dhabi",
    "emirate": "Abu Dhabi",
    "country": "AE"
  },
  "items": [
    { "name": "Whey Protein", "quantity": 1, "weight_grams": 2500, "sku": "WHEY-CHOC-2.5KG" }
  ],
  "total_weight_grams": 2500,
  "declared_value": { "amount": 28000, "currency": "AED" },
  "service_level": "standard",
  "cod": { "amount": 28000, "currency": "AED" },
  "special_instructions": "Call before delivery",
  "callback_url": "https://vitaminaty.ae/api/webhooks/icarry"
}

Response:
{
  "shipment_id": "ic_abc123",
  "tracking_number": "ICARRY12345",
  "tracking_url": "https://track.icarry.ae/ICARRY12345",
  "estimated_delivery": "2026-05-23T18:00:00Z",
  "label_pdf_url": "https://api.icarry.ae/labels/ic_abc123.pdf"
}
```

Vitaminaty values to use:
- Origin: from env vars (`ICARRY_ORIGIN_ADDRESS_ID` or full address constants in `src/lib/icarry/origin.ts`)
- Declared value: `orders.subtotal_aed` (in cents/fils per iCarry's convention — verify)
- COD: only set if `payment_method='cod'`; amount = `total_aed`

### 5.3 Track shipment

```http
GET /api/v1/shipments/{shipment_id}
Authorization: Bearer $ICARRY_API_KEY

Response:
{
  "shipment_id": "ic_abc123",
  "tracking_number": "ICARRY12345",
  "status": "in_transit",
  "events": [
    { "status": "created", "occurred_at": "..." },
    { "status": "picked_up", "occurred_at": "..." },
    { "status": "in_transit", "occurred_at": "..." }
  ]
}
```

### 5.4 Cancel shipment

```http
DELETE /api/v1/shipments/{shipment_id}
Authorization: Bearer $ICARRY_API_KEY
```

Best-effort. Only possible before pickup typically.

---

## 6. Status translation table

🟡 iCarry's actual status enum to be confirmed at M6.

| iCarry status (hypothesis) | Our `shipment_status` |
|---|---|
| `created` / `pending` | `created` |
| `picked_up` / `collected` | `picked_up` |
| `in_transit` / `in_hub` | `in_transit` |
| `out_for_delivery` / `with_driver` | `out_for_delivery` |
| `delivered` | `delivered` |
| `delivery_attempted` / `delivery_failed` | `delivery_failed` |
| `returned` / `returning_to_origin` | `returned` |
| `cancelled` | `cancelled` |

The translation table lives in `src/lib/icarry/status-map.ts` and is the only place iCarry's vocabulary touches our domain.

---

## 7. Webhook handler — `/api/webhooks/icarry`

Same pattern as Paymob (`PAYMENT_SPEC.md` §5):

1. Capture raw body.
2. Verify HMAC against `ICARRY_WEBHOOK_SECRET`.
3. Verify timestamp within replay window.
4. Look up order by `shipping_provider_shipment_id`.
5. Idempotency check on `shipment_events`.
6. INSERT into `shipment_events`.
7. Apply order state transition.
8. Return 200.

🟡 HMAC algorithm + header to verify at M6.

### 7.1 Order state transitions

| Shipment status | Order state transition |
|---|---|
| `created` | No change (order already `preparing`) |
| `picked_up` | No change (order remains `preparing`) |
| `in_transit` | No change |
| `out_for_delivery` | `preparing` → `shipped` if not already; set `shipped_at` |
| `delivered` | `shipped` → `delivered`; set `delivered_at`; trigger delivered email |
| `delivery_failed` | Log event, alert admin (no auto state change) |
| `returned` | Alert admin, manual decision required |
| `cancelled` | No change (cancellation typically driven by admin, not iCarry) |

---

## 8. Polling fallback (if no webhooks)

If iCarry doesn't support webhooks (or the engineer at M6 decides webhooks are unreliable), implement a polling job:

```typescript
// src/server/services/shipping-poll-job.ts
// Runs every 15 minutes via Vercel cron or Supabase Edge Function

export async function pollActiveShipments() {
  const adapter = getShippingAdapter();
  const activeOrders = await orderRepo.findActiveShipments(); // status in ['preparing', 'shipped']
  
  for (const order of activeOrders) {
    if (!order.shipping_provider_shipment_id) continue;
    try {
      const status = await adapter.getShipmentStatus(order.shipping_provider_shipment_id);
      // Insert into shipment_events if status changed
      // Apply state transitions
    } catch (err) {
      logger.warn('shipping.poll.error', { order_id: order.id, err });
    }
  }
}
```

Vercel Cron Job configuration in `vercel.json`:

```json
{
  "crons": [
    { "path": "/api/cron/poll-shipments", "schedule": "*/15 * * * *" }
  ]
}
```

The cron endpoint at `/api/cron/poll-shipments` checks for a Vercel cron header to prevent external invocation.

---

## 9. COD handling

When `orders.payment_method='cod'`:

1. Order created in `preparing` status (not `pending_payment`).
2. Shipment created with `cod` payload set to order total.
3. iCarry (or alternative) handles COD collection at delivery.
4. On `delivered` event, the COD is considered "received."
5. Reconciliation: admin sees pending COD vs settled COD per a daily report (Phase 2 polish; M6 produces the data).

🟡 Verify at M6: how iCarry handles COD remittance. What cycle? What fee?

---

## 10. Shipping zone & pricing model (MVP)

Per Plan v2:

- **UAE-only** at launch (all 7 emirates).
- **Free delivery threshold: AED 200** for Standard.
- **Standard: AED 20** below threshold, free above.
- **Express: AED 30** (always).
- **Same-Day: AED 50** (disabled at launch — feature flag).

These are the values the stub adapter returns. Live adapter at M6 may receive different quotes from iCarry; the spec defers to whichever is correct per business decision at M6.

Pricing logic centralized in `src/server/services/shipping-service.ts`:

```typescript
export async function computeShippingCost(input: {
  subtotal_aed: AedAmount;
  method: 'standard' | 'express' | 'same_day';
  destination: AddressSnapshot;
}): Promise<AedAmount> {
  const adapter = getShippingAdapter();
  const quote = await adapter.getQuote({ ... });
  const chosenMethod = quote.methods.find(m => m.id === input.method);
  if (!chosenMethod || !chosenMethod.available) {
    throw new ShippingMethodUnavailableError();
  }
  return chosenMethod.cost_aed;
}
```

---

## 11. Adversarial tests (M6 cross-check)

Same pattern as Paymob webhooks:

| Test | Expected outcome |
|---|---|
| Tampered signature | 400, bad_signature log |
| Stale timestamp | 400, stale_request log |
| Replayed event | 200, no side effect |
| Unknown status value | 200, logged, no state change |
| Webhook for unknown shipment_id | 400, alert |

Tests in `tests/integration/webhooks/icarry.adversarial.test.ts`.

---

## 12. Secrets and storage

| Field | Stored | Notes |
|---|---|---|
| `ICARRY_API_KEY` | Vercel env | Server-only |
| `ICARRY_WEBHOOK_SECRET` | Vercel env | Server-only |
| `ICARRY_ORIGIN_ADDRESS_ID` | Vercel env | Vitaminaty warehouse identifier at iCarry |
| Shipment ID | DB `orders.shipping_provider_shipment_id` | For reconciliation |
| Tracking number | DB `orders.tracking_number` | Customer-facing |
| Tracking URL | DB `orders.tracking_url` | Customer-facing |
| Label PDF URL | Not stored long-term (transient; downloaded on demand) | Print-on-pickup workflow |
| Customer PII in shipment events | DB `shipment_events.raw_payload` | Treat as PII, redact in logs |

---

## 13. Definition of done (M6)

- [ ] iCarry vs alternative decision made and documented in this file.
- [ ] `ICarryAdapter` (or alternative) implements full `ShippingAdapter` interface.
- [ ] Shipment created automatically on `orders.status = 'paid'` (and on order creation for COD).
- [ ] Tracking number + URL stored and shown to customer.
- [ ] Status translation map covers all provider status values.
- [ ] Webhook handler (or polling job) updates `shipment_events` and `orders.status`.
- [ ] Adversarial tests pass.
- [ ] COD handling verified end-to-end.
- [ ] Admin order detail page shows shipment events.
- [ ] `CONTEXT_EXPANSION_NOTES.md` §4 updated with verification notes.
- [ ] HIGH_RIGOR cross-check by the other executor.
- [ ] `icarry_live_mode` flag remains OFF; flip is a separate manual sign-off step.

---

## 14. Future capabilities (post-MVP)

| Capability | When | Notes |
|---|---|---|
| Same-day delivery enabled | Q2 2026 per Plan v2 | Flip `same_day_delivery_enabled` flag |
| Real-time rate quotes from multiple carriers | Phase 2 | If alternative aggregator supports it |
| GCC shipping (Saudi, Oman, Kuwait, etc.) | Phase 3 | Multi-country expansion |
| Delivery time slot selection | Phase 2 | If carrier supports |
| Pickup point delivery | Phase 2 | Lockers, partner stores |
| Returns label generation | Phase 2 | Self-service returns |

---

_End of `DELIVERY_SPEC.md` v1.0._
