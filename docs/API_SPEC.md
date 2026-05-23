# API_SPEC.md

**Project:** Vitaminaty
**Document version:** v1.0
**Document type:** Server actions + webhook + REST contracts
**Audience:** BOB v5 / Claude Code / Codex / human engineers

---

## 1. Conventions

### 1.1 Server actions vs API routes

Per `ARCHITECTURE.md`, Vitaminaty uses Next.js Server Actions for app-internal mutations. The `/api/` directory is reserved for:

- Webhook receivers (Paymob, iCarry)
- Health/liveness endpoints
- Sitemap generation
- Future public REST surface (post-MVP, if needed)

This means:

- A customer adding to cart → server action (no REST route).
- An admin publishing a product → server action.
- Paymob calling back after a payment → REST route under `/api/webhooks/paymob`.

### 1.2 Server action contract

Every server action follows this shape:

```typescript
// File: src/features/{feature}/actions.ts
'use server';

import { z } from 'zod';
import { requireCustomer } from '@/lib/auth/policies';

const InputSchema = z.object({ /* ... */ });
type Output = { ok: true; data: T } | { ok: false; error: ErrorCode; message: string };

export async function someAction(rawInput: unknown): Promise<Output> {
  // 1. Validate input
  const input = InputSchema.parse(rawInput);
  // 2. Verify authorization
  const customer = await requireCustomer();
  // 3. Call service layer
  const result = await service.doWork(input, customer);
  // 4. Return discriminated union
  return { ok: true, data: result };
}
```

Errors are never thrown to the client. They're returned as `{ ok: false, error, message }` discriminated unions. The client renders `message` to the user; `error` is the machine-readable code for branching logic.

### 1.3 Error codes

```typescript
type ErrorCode =
  | 'unauthenticated'
  | 'unauthorized'
  | 'validation_failed'
  | 'not_found'
  | 'conflict'                  // e.g., slug already taken
  | 'stock_unavailable'
  | 'price_changed'
  | 'payment_provider_error'
  | 'shipping_provider_error'
  | 'rate_limited'
  | 'feature_disabled'
  | 'internal_error';
```

### 1.4 Idempotency

Mutations that have meaningful side effects (orders, payment intents) accept an `idempotency_key` string. Duplicate calls with the same key return the same result without re-executing.

Idempotency keys are HMAC-derived server-side from the relevant inputs:

```typescript
const key = hmac(env.IDEMPOTENCY_HMAC_SECRET, `${customer_id}|${cart_hash}|${minute_bucket}`);
```

Stored in the `orders.idempotency_key` column (UNIQUE constraint).

### 1.5 Rate limiting

Public unauthenticated actions: 10 requests / 60 seconds per IP.
Public authenticated actions: 30 / 60 seconds per user.
Admin actions: 60 / 60 seconds per user.

Implemented via `src/lib/rate-limit.ts` against Upstash Redis (in production) or in-memory (in dev).

---

## 2. Public server actions

### 2.1 `cart` feature

These actions manipulate the client-side cart and revalidate against the server. The cart itself lives in client storage per Decision C2; these actions are for server-side validation only.

#### `validateCartLine(input)`

Validates a single cart line against current DB state. Called when the cart drawer opens or before checkout.

```typescript
Input: { product_id: uuid, variant_id: uuid, quantity: int }
Output: {
  ok: true,
  data: {
    available: boolean,
    current_price_aed: int,
    current_stock_state: 'in_stock' | 'low_stock' | 'out_of_stock',
    max_orderable_quantity: int  // capped at stock_quantity if known
  }
} | { ok: false, error: 'not_found' | 'feature_disabled', message }
```

#### `revalidateCart(input)`

Bulk version called before checkout. Returns the full repricing. The revalidation result also drives the cart-line stock messaging per `INVENTORY_SPEC.md §6.2` (in-cart stock state surfaces; out-of-stock lines are excluded from total recalculation with inline warning shown).

```typescript
Input: { lines: Array<{ product_id, variant_id, quantity }> }
Output: {
  ok: true,
  data: {
    overall_status: 'ok' | 'price_changed' | 'stock_changed' | 'item_unavailable',
    // 'ok' means cart is committable as-is.
    // 'price_changed' means at least one line's unit_price_aed differs from client-displayed.
    // 'stock_changed' means at least one line has insufficient stock or flipped out_of_stock.
    // 'item_unavailable' means at least one variant was deleted or product unpublished.
    // Client must surface the appropriate message and re-confirm before placeOrder.
    lines: Array<{
      product_id,
      variant_id,
      product_name,
      variant_display,
      unit_price_aed,
      requested_quantity,
      available_quantity,
      line_total_aed,
      issues: Array<'price_changed' | 'stock_reduced' | 'unavailable'>
    }>,
    subtotal_aed: int,
    suggested_shipping_methods: Array<{ id, label, cost_aed, eta_days }>,
    vat_estimate_aed: int,        // 5% inclusive math
    estimated_total_aed: int
  }
} | { ok: false, ... }
```

### 2.2 `checkout` feature

#### `placeOrder(input)`

The big one. HIGH_RIGOR — all the controls from `THREAT_MODEL.md` §5.7 apply.

```typescript
Input: {
  cart_lines: Array<{ product_id, variant_id, quantity }>,
  shipping_address: AddressInput,
  shipping_method: 'standard' | 'express',
  payment_method: 'card' | 'apple_pay' | 'tabby' | 'tamara' | 'cod',
  idempotency_key: string,
  client_displayed_total_aed: int,
  marketing_opt_in?: boolean,
  consent_version: string
}

Output: {
  ok: true,
  data: {
    order_id: uuid,
    order_reference: string,             // 'VIT-2026-000123'
    total_aed: int,
    payment_action: {
      kind: 'redirect' | 'iframe' | 'cod_no_payment',
      url?: string,                       // for redirect/iframe
      iframe_token?: string,              // for iframe (Paymob)
      intent_id: string
    }
  }
} | { ok: false, error:
    | 'unauthenticated'
    | 'stock_unavailable'                 // server stock check failed
    | 'price_changed'                     // client-displayed total != server total
    | 'shipping_provider_error'           // quote API down
    | 'payment_provider_error'            // intent creation failed
    | 'feature_disabled',                 // commerce flag off
  message: string,
  details?: {
    out_of_stock_lines?: Array<...>,
    server_total_aed?: int,               // when price_changed
    server_breakdown?: { subtotal, shipping, vat }
  }
}
```

Server flow (re-stated from `ARCHITECTURE.md` §4 for reference; full transactional semantics in `INVENTORY_SPEC.md §6.1`):

1. Validate input schema.
2. Verify customer is authenticated and email-verified.
3. Verify `commerce_enabled` feature flag is on.
4. Verify idempotency key — if seen, return cached result.
5. Re-fetch each variant from DB by ID.
6. Validate availability + quantity.
7. Compute authoritative totals server-side. Compare with client. If mismatch, return `price_changed`.
8. Begin transaction:
   - `SELECT ... FOR UPDATE` on each variant in ASC variant_id order (lock ordering avoids deadlock under concurrent last-unit checkouts). Per `INVENTORY_SPEC.md §6.3`.
   - Re-validate availability under the lock; if any variant is now insufficient, `ROLLBACK` and return `stock_unavailable` with offending variant IDs.
   - INSERT into `orders`.
   - INSERT into `order_items`.
   - UPDATE `product_variants.stock_quantity` per line (the `compute_stock_status` trigger fires automatically, recomputing `stock_status`).
   - INSERT into `inventory_movements` per affected variant with `reason='order_placed'` and `order_id` populated. Per `INVENTORY_SPEC.md §4.3` and `§6.1`.
   - Write `audit_log` entry.
   - Commit.
9. Call `PaymentAdapter.createIntent()`.
10. Return order + payment action.

If COD, no payment intent — return `kind: 'cod_no_payment'` and order is created in `pending_payment` status, transitioning to `preparing` directly on next admin action.

### 2.3 `account` feature

#### `updateProfile(input)`

```typescript
Input: { full_name?: string, phone_e164?: string, marketing_opt_in?: boolean }
Output: { ok: true, data: { customer: CustomerRecord } } | { ok: false, ... }
```

#### `createAddress(input)`, `updateAddress(input)`, `deleteAddress(id)`, `setDefaultAddress(id)`

Standard CRUD on the customer's address book. RLS at DB enforces ownership; server actions also explicitly check `auth.uid()`.

#### `requestDataExport()`

Triggers a PDPL data export. Returns a download URL (signed Supabase Storage URL, 1-hour TTL) to a JSON file containing all the customer's PII + order history.

```typescript
Output: { ok: true, data: { download_url: string, expires_at: ISO } } | ...
```

#### `requestAccountDeletion()`

PDPL erasure request. Marks the customer as `deleted_at = now()`, zeroes PII fields, anonymizes order_items references. Order line items retained for accounting; customer_id nulled.

### 2.4 `auth` feature

Mostly handled by Supabase Auth UI helpers, but custom wrappers exist:

#### `signUp(input)`
#### `signIn(input)`
#### `requestPasswordReset(email)`
#### `verifyEmail(token)`

Each wraps Supabase Auth and adds:
- Rate limiting.
- Account lockout tracking (5 fails in 15 min → 1 hour lockout).
- Audit log entry for admin signins.

---

## 3. Admin server actions

All admin actions are in `src/features/admin-*/actions.ts` and start with `requireAdmin()`.

### 3.1 Product management

#### `getProductList(filter)`

```typescript
Input: {
  status?: ProductStatus,
  brand_id?: uuid,
  category_id?: uuid,
  review_flags?: Array<'missing_price' | 'missing_image' | 'case_pack' | ...>,
  fields_status?: { [field]: FieldStatus },
  search?: string,
  sort?: 'created_at_desc' | 'completion_score_asc' | 'name_asc',
  page?: int,
  page_size?: int
}
Output: {
  ok: true,
  data: {
    items: Array<ProductSummary>,
    total: int,
    page: int,
    page_size: int
  }
}
```

#### `getProduct(id)`

Returns the full product with variants, images, goal tags, plus computed `completion_score` and `missing_required_fields[]`.

#### `updateProduct(id, patch)`

Patches discrete fields. Each field tracked in `fields_status`. Triggers re-computation of `completion_score` and `status`.

```typescript
Input: {
  id: uuid,
  patch: {
    name?: string,
    brand_id?: uuid,
    category_id?: uuid,
    form?: ProductForm,
    retail_price_aed?: int,
    content?: { description?, benefits?, ... },
    label_data?: { ingredients?, allergens?, ... },
    // etc.
  }
}
Output: { ok: true, data: { product, completion_score, status_changed?: ProductStatus } }
```

Each call writes an `audit_log` row with the diff.

#### `publishProduct(id)` / `unpublishProduct(id)` / `archiveProduct(id)`

Status transitions. Each enforces the gate per v1.1 §9.1 (MVP publish rule). Cannot publish if `missing_required_fields[]` is non-empty.

#### `bulkPublish(ids[])` / `bulkAssignCategory(ids[], category_id)` / etc.

Bulk operations. Confirmation dialog required client-side; server enforces the same per-product checks before applying.

#### `uploadProductImage(input)`

```typescript
Input: {
  product_id: uuid,
  variant_id?: uuid,
  file: File,                              // FormData
  kind: ImageKind,
  alt_text?: string,
  is_primary?: boolean
}
Output: { ok: true, data: { image: ImageRecord } }
```

Server uploads to Supabase Storage at `/products/{brand_slug}/{product_slug}/...`, generates thumbnail variants, writes `product_images` row.

#### `setVariantStock(input)`

Set a variant's absolute stock_quantity. Writes one `inventory_movements` row with `reason='manual_adjustment'`. Single-step, single transaction.

```typescript
Input: {
  variant_id: uuid,
  new_quantity: int,         // >= 0
  change_reason_note?: string,  // optional admin note
  expected_updated_at: timestamptz   // optimistic concurrency token from the loaded variant
}
Output: {
  ok: true,
  data: {
    variant_id,
    previous_quantity: int | null,
    new_quantity: int,
    stock_status: 'in_stock' | 'low_stock' | 'out_of_stock',  // trigger-computed
    movement_id: uuid
  }
} | { ok: false, error: 'stale_data' | 'not_found' | 'feature_disabled', message }
```

The `stale_data` error fires if `expected_updated_at` does not match the current `product_variants.updated_at` — per `ADMIN_PORTAL_SPEC §5.11` optimistic concurrency rules.

#### `adjustVariantStock(input)`

Apply a delta to a variant's stock_quantity (positive = increment, negative = decrement). Use when admin is recording goods received/damaged/found and wants the delta semantics rather than absolute set. Same audit + movement record + optimistic concurrency as `setVariantStock`.

```typescript
Input: {
  variant_id: uuid,
  delta: int,                // signed
  change_reason_note?: string,
  expected_updated_at: timestamptz
}
Output: same shape as setVariantStock
  error values include 'insufficient_stock' (delta would push quantity below 0)
```

#### `recountVariantStock(input)`

Stock-recount workflow (`ADMIN_PORTAL_SPEC §10.3`). Sets absolute count with `reason='stock_recount'`. The change_amount on the movement row reflects the delta but the consistency CHECK is relaxed for recount per `DB_SCHEMA.md §8.4`.

```typescript
Input: {
  variant_id: uuid,
  recounted_quantity: int,
  change_reason_note?: string,
  expected_updated_at: timestamptz
}
Output: same shape as setVariantStock
```

#### `setVariantLowStockThreshold(input)`

```typescript
Input: { variant_id: uuid, low_stock_threshold: int, expected_updated_at: timestamptz }
Output: { ok: true, data: { variant_id, stock_status } }
```

Trigger may recompute stock_status if the new threshold crosses the current quantity. No `inventory_movements` row — this is metadata, not stock movement.

#### `bulkAdjustVariantStock(input)`

Bulk stock adjustment across multiple variants. One transaction; either all variants update + write movement rows, or none do. Per `ADMIN_PORTAL_SPEC §5.3` and `§10`.

```typescript
Input: {
  adjustments: Array<{ variant_id: uuid, delta: int }>,
  reason: 'manual_adjustment' | 'stock_recount',
  change_reason_note?: string  // applied to every movement row in the bulk
}
Output: {
  ok: true,
  data: {
    affected_variant_ids: uuid[],
    movement_ids: uuid[],
    audit_log_id: uuid   // single audit row for the whole bulk
  }
} | { ok: false, error: 'insufficient_stock' | 'not_found' | 'feature_disabled',
     message, failed_variant_id?: uuid }
```

If any single variant adjustment would push stock below 0, the entire bulk fails with `insufficient_stock` and `failed_variant_id` populated. No partial commits.

#### `getInventoryHistory(input)`

Admin read of `inventory_movements`. Per `ADMIN_PORTAL_SPEC §10.8`.

```typescript
Input: {
  scope: { type: 'variant', variant_id: uuid }
       | { type: 'product', product_id: uuid }
       | { type: 'order', order_id: uuid }
       | { type: 'reason', reason: inventory_movement_reason }
       | { type: 'admin', actor_user_id: uuid }
       | { type: 'date_range', from: timestamptz, to: timestamptz },
  pagination?: { limit: int, offset: int }
}
Output: {
  ok: true,
  data: {
    movements: Array<{
      id, product_id, variant_id, variant_display,
      previous_quantity, new_quantity, change_amount,
      reason, change_reason_note,
      changed_by_user_id, changed_by_email,    // email redacted for non-admin viewers
      changed_at,
      order_id, order_reference                 // present only when applicable
    }>,
    total: int,
    has_more: boolean
  }
}
```

### 3.2 Brand management

#### `getBrandList()`, `getBrand(id)`, `updateBrand(id, patch)`, `uploadBrandLogo(...)`, `uploadBrandHero(...)`, `toggleBrandDirectoryVisibility(id)`, `setFeaturedHomepageBrand(id, enabled)`

Standard. Featured-brand toggle enforces max-2-active.

#### `addBrandAlias(brand_id, raw_spelling)`

Adds a raw MD spelling to a brand's `aliases[]`. Used when admin encounters a previously-unknown spelling.

### 3.3 Category management

#### `getCategoryList()`, `updateCategory(id, patch)`, `reorderCategories(ids[])`, `setCategoryListingCopy(id, copy)`

### 3.4 Order management

#### `getOrderList(filter)`, `getOrder(id)`, `updateOrderStatus(id, newStatus)`, `triggerShipment(order_id)`, `refundOrder(order_id, amount)`, `cancelOrder(order_id, reason)`

Order status transitions are guarded: cannot go from `pending_payment` → `delivered` directly; must walk through `paid` → `preparing` → `shipped` → `delivered`.

### 3.5 Homepage curation

#### `updateHomepageHero(input)`, `setHomepageRail(rail, product_ids[])`, `setFeaturedBrandStrip(brand_ids[])`

### 3.6 Audit log

#### `getAuditLog(filter)`

Read-only, paginated, admin-only.

### 3.7 Feature flags

#### `getAllFlags()`, `setFlag(key, enabled)`

Toggling a HIGH_RIGOR-gated flag (`commerce_enabled`, `paymob_live_mode`, etc.) requires a confirmation token issued by an admin with the explicit sign-off step. Implementation: a second factor (e.g., re-enter MFA code) inside the flag-toggle UI before applying the change.

### 3.8 MD import

#### `runMdImport(file)`

Uploads a new `product.md` and re-runs the import. Diff report returned before the import is committed; admin confirms.

```typescript
Input: { file: File, dry_run?: boolean }
Output: {
  ok: true,
  data: {
    summary: {
      new_products: int,
      updated_products: int,
      flagged_for_review: int,
      potentially_discontinued: int
    },
    diff_url?: string,                      // signed URL to diff CSV
    committed?: boolean
  }
}
```

---

## 4. Webhook routes (REST under `/api/webhooks/`)

### 4.1 `POST /api/webhooks/paymob`

**Trust zone:** Zone W. Untrusted until signature verified.

**Behavior:**

1. Capture raw body (NOT parsed via `request.json()` yet — need raw bytes for HMAC).
2. Extract Paymob's HMAC signature (header name TBD per `CONTEXT_EXPANSION_NOTES.md` §3.5 verification at M5).
3. Verify HMAC against `PAYMOB_HMAC_SECRET` using SHA-512 (or per-verification algorithm).
4. Parse JSON.
5. Verify timestamp within `WEBHOOK_REPLAY_WINDOW_SECONDS` (default 300s).
6. Look up the order by `payment_provider_intent_id`.
7. Idempotency check: SELECT from `payment_events` WHERE `(provider='paymob', provider_transaction_id=X, kind=Y)`. If found, return 200 with no side effects.
8. INSERT into `payment_events` (append-only).
9. Apply order state transition based on event kind:
   - `authorized` + `captured` → order.status = 'paid', `paid_at = now()`, trigger order confirmation email, trigger shipment creation
   - `failed` → order.status = 'failed', `failed_at = now()`, send failure email
   - `refunded` → order.status = 'refunded' (full) or remain (partial), record event
10. Return 200 to Paymob.

**Failure responses:**

| Status | Reason | Body |
|---|---|---|
| 400 | Bad signature | `{ error: 'bad_signature' }` (logs + alert if >10 in 5 min) |
| 400 | Timestamp out of window | `{ error: 'stale_request' }` |
| 200 | Idempotent replay | Empty body, no side effect |
| 200 | Unknown event type | Empty body, logged, no side effect (so Paymob stops retrying) |
| 500 | Internal error during processing | `{ error: 'internal' }`, Paymob will retry |

Test fixtures: a known-good signed payload + tampered variant in `tests/fixtures/paymob-webhooks/`. Adversarial tests in M5.

### 4.2 `POST /api/webhooks/icarry`

Same pattern as Paymob:

1. Verify HMAC signature (`ICARRY_WEBHOOK_SECRET`).
2. Verify timestamp.
3. Parse payload.
4. Look up order by `shipping_provider_shipment_id`.
5. Idempotency check on `shipment_events` table.
6. INSERT into `shipment_events`.
7. Apply order state transition:
   - `picked_up` → order remains `preparing`
   - `in_transit` → order remains `preparing` (or move to `shipped` here if not yet)
   - `out_for_delivery` → order.status = `shipped` if not already
   - `delivered` → order.status = `delivered`, trigger delivered email
   - `delivery_failed` → log, no state change
   - `returned` → admin notification, manual decision required
8. Return 200.

If iCarry has no webhook support (`CONTEXT_EXPANSION_NOTES.md` §4.6 verification), a polling job at `src/server/services/shipping-poll-job.ts` runs every 15 minutes against active shipments.

### 4.3 `GET /api/health`

Public liveness probe. Returns 200 + `{ status: 'ok', version, env }` if app is responsive. No auth, no DB query (fast).

### 4.4 `GET /api/sitemap.xml`

Dynamic sitemap generator. Lists all products with `is_public_visible=true`, plus categories, brands, legal pages. Cached at edge.

---

## 5. Response shapes — shared types

```typescript
// src/types/api.ts (shared between server and client)

export type Result<T> = { ok: true; data: T } | { ok: false; error: ErrorCode; message: string; details?: Record<string, unknown> };

export interface Pagination {
  page: number;
  page_size: number;
  total: number;
}

export interface ProductSummary {
  id: string;
  slug: string;
  name: string;
  brand: { id: string; display_name: string; slug: string };
  category: { id: string; name: string; slug: string } | null;
  status: ProductStatus;
  is_public_visible: boolean;
  completion_score: number;
  retail_price_aed: number | null;
  thumbnail_url: string | null;
  admin_review_flags: AdminReviewFlags;
}

export interface ProductDetail extends ProductSummary {
  name_raw: string;
  form: ProductForm | null;
  variants: VariantRecord[];
  images: ImageRecord[];
  goal_tags: GoalTag[];
  content: ProductContent;
  label_data: ProductLabelData;
  fields_status: FieldsStatus;
  source: { source_file: string; source_row: number[]; source_notes: string | null };
  missing_required_fields: string[];
}
```

(Full TypeScript types live in `src/types/`. The above is illustrative.)

---

## 6. Versioning policy

- **Server actions** are not versioned. They're internal to the app. Breaking changes require updating both server and client in the same release.
- **Webhook contracts** are external. Paymob and iCarry control these — we conform to their versions. If they version-bump, we ship a new adapter version.
- **Public REST** (if added post-MVP): `/api/v1/...` URI versioning.

---

## 7. Testing surface

| Surface | Test type | Location |
|---|---|---|
| Server actions | Integration tests with test Supabase | `tests/integration/{feature}.test.ts` |
| Webhook handlers | Adversarial tests + golden payloads | `tests/integration/webhooks/{provider}.test.ts` |
| E2E flows | Playwright | `tests/e2e/*.spec.ts` |

M5 must include adversarial Paymob webhook tests (tampered signature, replayed timestamp, off-by-one field order, wrong algorithm).
M6 must include the same for iCarry.

---

_End of `API_SPEC.md` v1.0._
