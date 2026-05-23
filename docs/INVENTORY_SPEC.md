# INVENTORY_SPEC.md

**Project:** Vitaminaty
**Document version:** v1.0
**Created:** 2026-05-23
**Owned by:** spans M1 (schema addendum 0012), M2 (admin editing UX), M3 (storefront display), M4 (checkout decrement + race-safe transaction), M7 (cancellation/refund restoration)
**Audience:** BOB v5 / Claude Code / Codex / human engineers

---

## 1. Purpose

Vitaminaty's MVP supplements catalog must know how many units are available per variant and must prevent overselling at checkout. This document is the single source of truth for inventory **tracking** at MVP.

**Inventory tracking is MVP.** Warehouse automation, barcode workflows, supplier purchase orders, and supplier sync are post-MVP — see `proj_spec.md §9` P8 and §7 of this document.

This spec coordinates the inventory surface across:

- Database schema (the new columns and the `inventory_movements` table — `DB_SCHEMA.md §5.2`, §6.x, §10 migration 0012).
- Admin editing UX (`ADMIN_PORTAL_SPEC.md §10`, plus the side drawer in §5.5 and the spreadsheet edit in §5.4).
- Storefront display (M3 — `proj_spec.md §M3`; rendering rules in §5 below).
- Checkout flow (M4 — `proj_spec.md §M4`; transaction semantics in §6 below).
- Order lifecycle restoration (M7 — `proj_spec.md §M7`; cancellation/refund rules in §6.4 below).

---

## 2. Locked product decisions

The following decisions were made in the M1 spec-evolution chat (2026-05-23) and are non-negotiable inputs to every milestone that touches inventory. Restated here so the spec is self-contained.

| Decision | Lock | Reference |
|---|---|---|
| Stock decrement timing | At order creation (atomic transaction with row lock). **No reservation timeout at MVP.** | M4, INVENTORY_SPEC §6.1 |
| Stock restoration triggers | Order cancellation, payment failure (Paymob webhook decline), refund. Discrete `reason` values per §4.3. | INVENTORY_SPEC §6.4 |
| Storefront stock visibility | Low-stock badge only. No exact counts visible to customers. Out-of-stock disables Add to Cart. | INVENTORY_SPEC §5 |
| Backorder policy | Not at MVP. `stock_status` enum has three values: `in_stock`, `low_stock`, `out_of_stock`. | INVENTORY_SPEC §3.2 |
| Variant requirement | Products with `status='published'` must have at least one variant with `stock_quantity IS NOT NULL`. Products with other statuses may have zero variants. | INVENTORY_SPEC §3.4 |
| Manual stock adjustment approval | Single-step admin action with audit log + inventory_movements ledger entry. No second-step approval at MVP. | ADMIN_PORTAL_SPEC §10.4 |
| Pre-publish stock semantics | Stock on pre-publish products is real, not phantom. Admin sets stock during enrichment; it just isn't customer-visible until status flips to published. | INVENTORY_SPEC §3.5 |
| Missing-stock-quantity flag | New 9th admin_review_flag: `missing_stock_quantity`. True iff product has zero variants OR any variant has `stock_quantity IS NULL`. Affects completion_score. | PRODUCT_CONTENT_SPEC v1.1 §5.4, §22.1 |
| Inventory movements table | Append-only ledger. No UPDATE or DELETE policies in RLS. Same architectural pattern as `payment_events`, `shipment_events`, `audit_log`. | INVENTORY_SPEC §4.2 |
| `stock_status` derivation | Stored column maintained by a Postgres trigger on INSERT/UPDATE of `stock_quantity` or `low_stock_threshold`. Indexed for storefront query efficiency. | INVENTORY_SPEC §3.3 |
| `in_stock` boolean field | **Dropped.** `stock_status` enum replaces it. The existing `variants_low_stock_idx` partial index is rewritten to filter on `stock_status`. | INVENTORY_SPEC §3.6, migration 0012 |

---

## 3. Per-variant inventory model

### 3.1 Schema additions on `product_variants`

Migration 0012 extends `product_variants` with:

```sql
-- New column: tri-state derived status
ALTER TABLE product_variants
  ADD COLUMN stock_status stock_status NOT NULL DEFAULT 'out_of_stock';

-- The boolean in_stock is dropped (per locked decision)
ALTER TABLE product_variants DROP COLUMN in_stock;
```

Existing columns retained (with constraints unchanged):

| Column | Type | Constraints | Purpose |
|---|---|---|---|
| `stock_quantity` | int | `CHECK (stock_quantity IS NULL OR stock_quantity >= 0)` | Current on-hand count. NULL = "not yet set" (drives missing_stock_quantity flag). |
| `low_stock_threshold` | int | `NOT NULL DEFAULT 5` | Per-variant threshold below which `stock_status` = `low_stock`. |
| `stock_status` | enum | `NOT NULL DEFAULT 'out_of_stock'` (new) | Derived; never written directly by application code. |

### 3.2 `stock_status` enum

```sql
CREATE TYPE stock_status AS ENUM ('in_stock', 'low_stock', 'out_of_stock');
```

Three values. No `backorder_disabled` value (locked decision Q3). Out-of-stock = unbuyable, full stop.

### 3.3 `stock_status` derivation trigger

The enum value is **computed**, not written directly. A trigger maintains it on every INSERT/UPDATE that touches `stock_quantity` or `low_stock_threshold`:

```sql
CREATE OR REPLACE FUNCTION compute_stock_status()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.stock_quantity IS NULL OR NEW.stock_quantity <= 0 THEN
    NEW.stock_status := 'out_of_stock';
  ELSIF NEW.stock_quantity <= NEW.low_stock_threshold THEN
    NEW.stock_status := 'low_stock';
  ELSE
    NEW.stock_status := 'in_stock';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER variants_compute_stock_status
  BEFORE INSERT OR UPDATE OF stock_quantity, low_stock_threshold ON product_variants
  FOR EACH ROW EXECUTE FUNCTION compute_stock_status();
```

Rules implemented by this trigger:

- `stock_quantity IS NULL` → `out_of_stock` (treat NULL as zero-available for safety; missing data must not be sellable).
- `stock_quantity <= 0` → `out_of_stock`.
- `0 < stock_quantity <= low_stock_threshold` → `low_stock`.
- `stock_quantity > low_stock_threshold` → `in_stock`.

Application code MUST NOT write `stock_status` directly. The trigger is the single source of derivation truth.

### 3.4 Variant requirement for publish

Per locked decision Q4: a product with `status='published'` must have at least one variant with `stock_quantity IS NOT NULL`.

This is enforced at the **publish action** layer in the admin service (not at the DB level via CHECK) because:

- A DB CHECK would prevent admin from publishing in valid edge cases without complex deferrable constraint dance.
- The publish flow is the natural gate — admin sees the validation failure inline and fixes the missing data.
- Imported products (`status='imported'`) are allowed to have zero variants — that's the whole point of the enrichment workflow.

Server-side publish service validates:

```pseudo
if product.status_change_to == 'published':
    variants = load_variants(product.id)
    if len(variants) == 0:
        return error('cannot_publish: no_variants')
    if any(v.stock_quantity IS NULL for v in variants):
        return error('cannot_publish: missing_stock_quantity')
```

Backfill for existing 787 imported products: none required. They stay in `status='imported'` until admin enriches them.

### 3.5 Pre-publish stock semantics

Stock on pre-publish (`status IN ('imported', 'draft', 'partial', 'ready_to_publish', 'hidden')`) products is **real**, not phantom. Admin sets it during enrichment and it persists. It just doesn't render on the public storefront until `status='published'` AND `is_public_visible=true`.

This means:
- `inventory_movements` rows can exist for products that aren't yet published.
- The `import_update` reason value (§4.3) covers the case where the M2 admin re-imports stock data from a future supplier feed into pre-publish products.

### 3.6 Removal of the `in_stock` boolean

The existing `product_variants.in_stock` boolean column is **dropped** in migration 0012. The existing partial index that referenced it is rewritten:

```sql
DROP INDEX IF EXISTS variants_low_stock_idx;

CREATE INDEX variants_low_stock_idx
  ON product_variants(stock_quantity)
  WHERE stock_status = 'low_stock';

CREATE INDEX variants_stock_status_idx
  ON product_variants(stock_status);
```

The second index supports storefront listing queries that filter by stock_status (M3) and admin queue queries (`/admin/queues/low-stock`, `/admin/queues/out-of-stock`).

No existing application code references `in_stock` yet (per M1 ship state — confirmed in the M1 spec-evolution chat). The drop is safe.

---

## 4. Inventory movement log

### 4.1 Purpose

Every change to `stock_quantity` writes an append-only ledger row to `inventory_movements`. The ledger answers: who changed this variant's stock, when, by how much, and why.

This is the inventory equivalent of `payment_events` and `audit_log`. The architectural pattern (append-only, no UPDATE/DELETE policies, admin SELECT) is the same.

### 4.2 Schema

Migration 0012 creates `inventory_movements`:

```sql
CREATE TABLE inventory_movements (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  previous_quantity int CHECK (previous_quantity IS NULL OR previous_quantity >= 0),
  new_quantity int NOT NULL CHECK (new_quantity >= 0),
  change_amount int NOT NULL,  -- signed; positive=increment, negative=decrement
  reason inventory_movement_reason NOT NULL,
  change_reason_note text,  -- optional freetext, e.g. "3 units damaged in storage"
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  -- order_id is set when reason ∈ {order_placed, order_cancelled, payment_failed, refund_returned}
  CONSTRAINT inventory_movements_change_consistency
    CHECK (change_amount = new_quantity - COALESCE(previous_quantity, 0)
        OR reason = 'stock_recount')
);

CREATE INDEX inventory_movements_variant_idx
  ON inventory_movements(variant_id, changed_at DESC);

CREATE INDEX inventory_movements_product_idx
  ON inventory_movements(product_id, changed_at DESC);

CREATE INDEX inventory_movements_order_idx
  ON inventory_movements(order_id)
  WHERE order_id IS NOT NULL;

CREATE INDEX inventory_movements_reason_idx
  ON inventory_movements(reason, changed_at DESC);
```

Notes on column semantics:

- `previous_quantity` is nullable to support the variant's first-ever stock write (movement row inserted when admin first sets a stock value on a NULL variant).
- `change_amount` is signed: positive for additions, negative for decrements. The consistency CHECK enforces `change_amount = new_quantity - previous_quantity` except for `stock_recount` (where the admin states a new absolute count and `change_amount` is the implied delta).
- `changed_by` ON DELETE SET NULL preserves history if an admin user is later deleted.
- `order_id` ON DELETE SET NULL preserves the movement record even if an order is deleted (which should never happen — but defensive design).

**Important — the CHECK constraint is a self-consistency check, not a reality check.** It enforces internal arithmetic agreement between the three quantity fields on the row being inserted (`change_amount` equals `new_quantity - previous_quantity`, except for `stock_recount` which is exempt). It does **not** verify that `previous_quantity` matches the variant's actual pre-update `stock_quantity` — that check is impossible at row-insert time without a JOIN and could race against concurrent updates anyway. The application layer is responsible for setting `previous_quantity` to the variant's true pre-update value, and this responsibility is exercised inside the same transaction that decrements/increments the variant (so the read of variant.stock_quantity and the write of the movement row are atomic per `INVENTORY_SPEC.md §6.1`). The integration test suite (`tests/integration/repositories/inventory-movement-repository.test.ts`) covers the success path; the SELECT FOR UPDATE locking in §6.3 makes the race safe.

### 4.3 Reason enum

```sql
CREATE TYPE inventory_movement_reason AS ENUM (
  'manual_adjustment',
  'order_placed',
  'order_cancelled',
  'payment_failed',
  'refund_returned',
  'stock_recount',
  'import_update'
);
```

Seven values, one per distinct cause:

| Reason | When written | Sign of change_amount | Notes |
|---|---|---|---|
| `manual_adjustment` | Admin directly edits `stock_quantity` in drawer/editor/spreadsheet | any | Catch-all for admin-driven edits (damage, found extra, etc.) outside the dedicated recount workflow. `change_reason_note` recommended. |
| `order_placed` | Checkout commits an order; one row per variant in the order | negative | Written inside the same transaction as the order INSERT (M4). `order_id` populated. |
| `order_cancelled` | Admin cancels an order pre-fulfillment, or order auto-cancels (e.g., timeout in future post-MVP reservation pattern) | positive | Restores the originally-decremented amount. `order_id` populated. |
| `payment_failed` | Paymob webhook reports payment auth failed/declined for an order that had stock decremented | positive | Distinct from `order_cancelled` so the admin can distinguish "we cancelled" from "payment never went through." `order_id` populated. |
| `refund_returned` | Admin issues a refund post-fulfillment AND marks the goods as returned | positive | Partial refunds without returned goods do NOT write this row — they're recorded only in payment_events. Admin chooses at refund time whether stock is being restored. `order_id` populated. |
| `stock_recount` | Admin uses the dedicated "Stock recount" workflow (ADMIN_PORTAL_SPEC §10.3) to set an absolute count, typically after a physical inventory | any (often unrelated to actual movement) | Distinguished from manual_adjustment because the change_amount may not reflect actual goods movement — it reflects a count correction. The consistency CHECK on `change_amount` is relaxed for this reason. |
| `import_update` | A future post-MVP supplier sync or bulk re-import overwrites stock counts | any | Reserved for the post-MVP warehouse sync (`proj_spec.md §9` P8) and the M1 import script if it ever sets stock (it doesn't today, but the reason is reserved). |

### 4.4 RLS posture

`inventory_movements` follows the append-only pattern established in M1 for `payment_events`, `shipment_events`, `audit_log`. Migration 0012 enables RLS and adds policies:

```sql
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY inventory_movements_admin_read ON inventory_movements
  FOR SELECT TO authenticated
  USING (is_admin());

-- No INSERT/UPDATE/DELETE policies. Service-role bypasses RLS for writes
-- (admin inventory adjustments, checkout decrement, restoration flows all
-- run through src/server/repositories/inventory-movement-repository.ts
-- with the service-role client).
```

The repository at `src/server/repositories/inventory-movement-repository.ts` exposes:

- `appendMovement(row)` — service-role write.
- `listMovementsForVariant(variantId, limit?)` — admin read.
- `listMovementsForProduct(productId, limit?)` — admin read.
- `listMovementsForOrder(orderId)` — admin read.

No `update*`, no `delete*`. Same pattern as `audit-log-repository.ts`.

### 4.5 Storage cost

At MVP scale: 787 products × ~1.5 variants × ~5 movements per variant per quarter ≈ 6,000 movement rows per quarter. Negligible storage. No retention policy at MVP; revisit at M8 alongside PDPL audit retention.

---

## 5. Storefront display rules

M3 implements these. Captured here so M3 doesn't have to re-derive them.

### 5.1 PDP (product detail page) variant selector

When a customer is on a product detail page:

- **Variant selector chips/dropdown:** each variant rendered with its stock_status badge.
  - `in_stock` → no badge (clean default).
  - `low_stock` → small "Low stock" badge (no count).
  - `out_of_stock` → grey-out the variant chip; not selectable.
- **Add to Cart button state:**
  - If the customer has not yet selected a variant on a multi-variant product → button disabled with "Select a variant" hint.
  - If the selected variant is `out_of_stock` → button disabled with text "Out of stock."
  - If the selected variant is `in_stock` or `low_stock` → button enabled.
- **Product-level out-of-stock state:** if all variants are `out_of_stock`, the entire PDP shows a banner "Out of stock — check back soon" and Add to Cart is hidden entirely (not just disabled — the customer should not see a teasing disabled button when nothing is purchasable).

### 5.2 Product listing pages

Card-level rendering on `/products`, category pages, brand pages, search results:

- **Out-of-stock products** (every variant `out_of_stock`): card renders with grey overlay and "Out of stock" pill. Click-through to PDP still works (in case customer wants to subscribe to back-in-stock notifications — post-MVP feature; for now the PDP simply shows the banner).
- **Low-stock products** (any variant `low_stock`, none `out_of_stock`): card renders normally with a subtle "Low stock" badge in the corner.
- **In-stock products** (all variants `in_stock`): card renders normally with no stock badge.
- **Sort/filter affordances:** the product listing supports a filter "Hide out of stock" (default OFF — customers can opt in). Out-of-stock products do not get a permanent sort demotion; that decision is post-MVP UX polish.

### 5.3 Exact counts are never rendered publicly

No customer-facing surface ever shows the integer `stock_quantity`. "3 left" / "Only 2 remaining" copy is forbidden at MVP per locked decision Q2. The badge is the only signal.

### 5.4 Cart line items

When the customer views their cart:

- Each line item shows the stock_status of its variant *at view time* via the M4 cart revalidation flow (§6.2 below).
- If a cart line's variant flipped to `out_of_stock` between cart-add time and view time, the line shows an inline error: "This variant is now out of stock. Remove or save for later."
- Cart total is recalculated excluding out-of-stock lines (with an inline warning shown).

---

## 6. Checkout and order lifecycle stock semantics

M4 implements §6.1–§6.3. M7 implements §6.4 (restoration).

### 6.1 Atomic decrement at order creation

Per the locked decision Q1a, stock is decremented at order creation, atomically with the order INSERT, no reservation timeout.

The checkout `placeOrder` service action (M4) executes one transaction:

```pseudo
BEGIN;

  -- 1. Lock the variant rows for the order's line items in stable order
  --    (avoid deadlock — always lock variants in ASC variant_id order).
  SELECT id, stock_quantity FROM product_variants
    WHERE id IN (<line-item variant ids>)
    ORDER BY id ASC
    FOR UPDATE;

  -- 2. Validate availability: each line item's requested quantity <= variant's
  --    current stock_quantity. If any fails, ROLLBACK with 'insufficient_stock'
  --    error specifying which variant and how much short.

  -- 3. Insert orders row (server-computed totals, idempotency_key, etc.).
  INSERT INTO orders (...) VALUES (...) RETURNING id;

  -- 4. Insert order_items rows.
  INSERT INTO order_items (...) VALUES (...);

  -- 5. Decrement stock_quantity on each variant.
  --    The compute_stock_status trigger fires automatically and recomputes
  --    stock_status to in_stock/low_stock/out_of_stock as appropriate.
  UPDATE product_variants
    SET stock_quantity = stock_quantity - <line item quantity>
    WHERE id = <variant_id>;

  -- 6. Insert inventory_movements row per variant.
  INSERT INTO inventory_movements
    (product_id, variant_id, previous_quantity, new_quantity,
     change_amount, reason, order_id, changed_by)
    VALUES (..., 'order_placed', <order_id>, NULL);
  -- changed_by NULL when the actor is the customer; the order_id ties the
  -- movement to the customer who placed the order via orders.customer_id.

  -- 7. Insert audit_log row.

COMMIT;
```

If any step fails, the entire transaction rolls back. Stock is never partially decremented.

### 6.2 Cart revalidation contract

Before the customer reaches the "Place order" step, the cart is revalidated against current stock. The revalidation contract is implemented as `cart.revalidateCart` server action (per `API_SPEC.md §2.1`).

Revalidation returns one of:

- `ok` — cart is unchanged and committable.
- `price_changed` — server-recomputed total differs from client-displayed total. Customer must accept the new total before proceeding.
- `stock_changed` — at least one cart line's variant flipped to `out_of_stock` OR has insufficient stock for the requested quantity. Response includes per-line status (`available`, `out_of_stock`, `partial_quantity_only`).
- `item_unavailable` — variant was deleted or product unpublished.

The cart UI shows the updated state inline. The customer cannot proceed to payment until cart revalidation returns `ok`.

### 6.3 Race condition handling for last-unit

Two simultaneous checkouts of the last unit of a variant: only one succeeds. The `SELECT ... FOR UPDATE` row lock in step 1 of §6.1 serializes the two transactions. The second one reaches step 2 (validate availability) after the first commits, sees the now-zero stock, and rolls back with `insufficient_stock`.

This is a HIGH_RIGOR cross-check in M4 per `proj_spec.md §M4` ("Stock revalidation: simulate two simultaneous checkouts of the last unit — only one should succeed."). The cross-check is satisfied by the transactional pattern above.

### 6.4 Restoration triggers (M7)

Stock is restored to the variant when one of these three events happens. Each writes one `inventory_movements` row per affected variant with the corresponding `reason`:

#### 6.4.1 Order cancellation (`reason='order_cancelled'`)

Admin cancels an order via `ADMIN_PORTAL_SPEC §9.3` ("Cancel from `pending_payment` or `paid`"). If the order had previously decremented stock (status was `paid` or `pending_payment`), the admin cancel action triggers stock restoration:

```pseudo
BEGIN;
  FOR each order_item IN order:
    SELECT id, stock_quantity FROM product_variants
      WHERE id = order_item.variant_id FOR UPDATE;

    UPDATE product_variants
      SET stock_quantity = stock_quantity + order_item.quantity
      WHERE id = order_item.variant_id;

    INSERT INTO inventory_movements
      (product_id, variant_id, previous_quantity, new_quantity,
       change_amount, reason, order_id, changed_by)
      VALUES (..., 'order_cancelled', <order_id>, <admin_user_id>);
  END FOR;

  UPDATE orders SET status = 'cancelled' WHERE id = <order_id>;
  INSERT INTO audit_log (...);
COMMIT;
```

#### 6.4.2 Payment failure (`reason='payment_failed'`)

The Paymob webhook (M5) reports a payment auth decline for an order that had `status='pending_payment'` and had decremented stock. The webhook handler restores stock with reason `payment_failed`. Distinct from `order_cancelled` so the admin can distinguish "we chose to cancel" from "the payment never cleared."

Transaction shape identical to §6.4.1 but reason is `payment_failed` and `changed_by IS NULL` (no admin actor; the webhook is the trigger).

The order's status moves to `cancelled` (or a more specific `payment_failed` status if `order_status` enum gains that value at M5 — orthogonal decision).

#### 6.4.3 Refund with goods returned (`reason='refund_returned'`)

Admin issues a refund on a fulfilled order AND explicitly indicates that the goods were returned (a checkbox on the refund modal). Stock is restored:

- Full refund + goods returned → restore full original line quantities.
- Partial refund + goods returned → restore the partial quantity admin specifies per line.
- Refund without goods returned (customer keeps the goods, e.g., service-quality refund) → no stock restoration; `inventory_movements` NOT written. Payment-level events recorded in `payment_events` as usual.

The admin must check "Goods returned to inventory" explicitly to trigger the stock restoration. Default is unchecked — refunds without restoration are the safer default for the supplements market (returned supplements often cannot be resold for hygiene reasons; admin makes the call).

---

## 7. Out of scope for MVP

Explicitly documented so future contributors don't confuse these for MVP work:

| Capability | Why out of MVP | Future milestone |
|---|---|---|
| Warehouse automation | Operations team handles physical inventory manually at MVP scale (787 products). Automation infrastructure pays off at >5k SKUs. | Post-MVP P8 |
| Barcode scanner workflows | Manual stock entry via admin portal is sufficient at MVP volume. Barcode hardware is a separate workflow + ops investment. | Post-MVP P8 |
| Supplier purchase orders | PO management is its own subsystem (supplier vendor management, lead times, receiving). Not a path to MVP launch. | Post-MVP P8 |
| Automated supplier sync | Requires supplier API integrations, conflict resolution rules, supplier-side scheduling. Significant scope. | Post-MVP P8 |
| Multi-warehouse / multi-location inventory | MVP ships from one location. Multi-location inventory adds shipping rate complexity, location-specific stock, fulfillment routing — all post-MVP. | Post-MVP, no priority yet |
| Reservation timeout / soft holds | Phantom-decrement risk is small at MVP volume. Adding reservation infrastructure (background jobs or per-read TTL checks) is substantial complexity without proportionate payoff. | Revisit post-launch if abandonment data demands it. |
| Back-in-stock customer notifications | UX feature requiring customer subscription mechanism + email/SMS plumbing. | Post-MVP |
| Stock movement analytics / forecasting | Reporting on movement reasons, time-series stock-out frequency, reorder point recommendations. | Post-MVP |
| Inventory-level promo logic | "Only available when in stock > N" promo rules. | Post-MVP (with promo engine — `ADMIN_PORTAL_SPEC §15`) |

---

## 8. Cross-references

| Topic | Authoritative spec |
|---|---|
| Schema (columns, table, RLS, trigger, indexes) | `DB_SCHEMA.md §5.2`, §6.x (new), §10 (migration 0012) |
| Admin editing UX | `ADMIN_PORTAL_SPEC.md §10`, §5.4, §5.5 |
| Storefront display | `proj_spec.md §M3`; rendering rules in this doc §5 |
| Checkout transaction | `proj_spec.md §M4`; transaction shape in this doc §6.1 |
| Cart revalidation API | `API_SPEC.md §2.1` |
| Restoration flows | `proj_spec.md §M7`; reasons and shapes in this doc §6.4 |
| Missing-stock review flag | `PRODUCT_CONTENT_SPEC_v1.1_ADMIN_DRIVEN.md §5.4`, §22.1 |
| Out-of-MVP capabilities | This doc §7 + `proj_spec.md §9` P8 |

---

_End of `INVENTORY_SPEC.md` v1.0._
