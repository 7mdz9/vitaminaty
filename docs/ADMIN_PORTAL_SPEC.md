# ADMIN_PORTAL_SPEC.md

**Project:** Vitaminaty
**Document version:** v1.0
**Owned by:** M2 (Admin Portal milestone)
**Audience:** BOB v5 / Claude Code / Codex / human engineers

---

## 1. Purpose

The admin portal is the operational tool that lets the Vitaminaty team:

- Import the MD catalog.
- Enrich products from `imported` → `published`.
- Manage brands, categories, goals.
- Curate the homepage.
- Handle orders end-to-end.
- Configure integrations and feature flags.
- Audit every change.

It is built inside the same Next.js app per `DECISION_CAPTURE.md` Decision 3. All admin routes live under `/admin/*`. Authentication is via Supabase Auth with role + MFA enforcement.

---

## 2. Access model

### 2.1 Authentication

- Admin signs in at `/admin/sign-in`.
- Supabase Auth verifies email + password.
- On first signin, MFA enrollment (TOTP) is forced. Cannot proceed without enrolling.
- On every subsequent signin, MFA code required.
- Session cookie: `vit_admin_session`, HttpOnly, Secure, SameSite=Lax, 4-hour idle timeout, 12-hour absolute timeout.
- Optional IP allowlist via `ADMIN_IP_ALLOWLIST` env var (CIDR list; empty = unrestricted).

### 2.2 Authorization

- Every admin server action calls `requireAdmin()` from `src/lib/auth/policies.ts`.
- `requireAdmin()` verifies:
  - Session is valid.
  - User's `app_metadata.role === 'admin'`.
  - MFA was verified within session lifetime.
- Three defense layers per `DECISION_CAPTURE.md` §3:
  1. Server-side `requireAdmin()` (this).
  2. RLS at DB layer (`is_admin()` function).
  3. Audit log entry written.

### 2.3 Role model

- **MVP**: single `admin` role. All admins can do everything.
- **Phase 2 migration path** (documented but not implemented):
  - `viewer` — read-only access
  - `catalog_editor` — edit products, brands, categories; cannot publish
  - `publisher` — catalog_editor + publish/archive
  - `admin` — full access including user management and feature flag toggles

To migrate to multi-role:
- Extend `app_metadata` JSON with `roles: ['publisher']` array.
- Define role constants in `src/features/auth/rbac.ts`.
- Replace `requireAdmin()` calls with `requireRole('publisher')` etc.
- Update RLS policies to check role membership.
- This is a clean, isolated change requiring no schema migrations except the admin user records.

---

## 3. Admin route map

```
/admin
├── /sign-in                     — Admin signin (MFA-gated)
├── /                            — Dashboard (default landing)
├── /products
│   ├── /                        — Product list with filters
│   ├── /[productId]             — Product editor
│   └── /import                  — MD import UI
├── /brands
│   ├── /                        — Brand list
│   └── /[brandId]               — Brand editor
├── /categories                  — Category list + editor
├── /orders
│   ├── /                        — Order list
│   └── /[orderId]               — Order detail
├── /homepage                    — Homepage curation
├── /audit-log                   — Audit log viewer
├── /settings
│   ├── /feature-flags           — Feature flag toggles
│   ├── /integrations            — Paymob, iCarry config + status
│   └── /users                   — Admin user management
└── /support-chat                — Support conversations (Phase 2 AI use)
```

---

## 4. Dashboard (`/admin`)

**Purpose:** at-a-glance status for the admin team plus operational health signals.

**Widgets** (each is a Server Component fetching its own data):

1. **Catalog snapshot**
   - Total products
   - Published products
   - Products missing price
   - Products missing image
   - Products missing stock quantity (per §10 inventory rules)
   - Products out of stock (per §10)
   - Products low stock (per §10)
   - Products ready to publish
   - Average completion score
   - Top "needs attention" filter buttons that link directly to the matching work queue (§5.6): missing_price, missing_image, missing_stock_quantity, needs_category_review, needs_brand_review.

2. **Recent orders** (Phase: M4 visible, M5+ populated)
   - Last 10 orders with status + total
   - Quick-filter "pending payment", "preparing", "shipped"
   - Recently sold products: last 10 distinct products sold (M7+ populated)

3. **Recently edited products**
   - Last 10 products updated by any admin, with the editing admin's name and timestamp
   - Each entry links to the product editor

4. **Recent admin activity**
   - Last 10 audit log entries rendered with the §11.1 diff view (per-field human-readable)

5. **Operational alerts**
   - Failed payment webhooks (last 24h)
   - Failed shipment webhooks (last 24h)
   - Out-of-stock published products (a published product that ran out is an alert, not a routine state)

6. **Feature flag status**
   - All commerce-related flags with their current state
   - Quick toggle for `maintenance_mode` and `read_only_mode`

7. **System health**
   - Paymob mode (stub/live)
   - iCarry mode (stub/live)
   - Email provider mode (stub/resend)
   - Last failed webhook (if any)

8. **Admin progress indicator**
   - Per-signed-in-admin: "You edited N products today, M in the last hour." Reads from `audit_log` filtered by `actor_user_id = current admin` and `action IN ('product_update','product_publish',...)`. Gives the admin a sense of progress against the 787-product enrichment backlog.

---

## 5. Product list (`/admin/products`)

### 5.1 Filters

Per v1.1 §23.1, the filter bar supports:

**Status filter (single-select):**
- All
- Imported (787 initially)
- Draft
- Partial
- Ready to publish
- Published
- Hidden
- Archived

**Review flag filter (multi-select chips):**
- Missing price
- Missing image
- Missing stock quantity (per §10 inventory rules; new 9th flag in PRODUCT_CONTENT_SPEC v1.1 §5.4)
- Case-pack
- Duplicate
- Multiple price pairs
- Needs category review
- Needs brand review
- Needs label data

**Stock status filter (single-select; per §10 inventory rules):**
- All
- In stock
- Low stock
- Out of stock

**Other filters:**
- Brand (dropdown from canonical brands)
- Category (dropdown from public taxonomy)
- Search by name (full-text + fuzzy with trigram index)
- Completion score range slider (0-100)

**Sort options:**
- Newest imported (default for `imported` status)
- Lowest completion score first (for enrichment workflows)
- Recently updated
- Alphabetical

### 5.2 List view

Each row shows:

| Column | Content |
|---|---|
| Image thumbnail | Real image if uploaded, else brand-color placeholder |
| Name | Normalized name; muted if status='imported' |
| Brand | Canonical name; "Needs review" badge if `brand` field status is `needs_review` |
| Category | Public category; "Uncategorized" pill if null |
| Price | `AED X` if set; "—" if missing, with red "missing" badge |
| Stock | Aggregate variant stock summary per §10.6: total units across variants, with a "Low" or "Out" badge if any variant trips the threshold. "—" with red "missing" badge if `missing_stock_quantity` flag is true. |
| Status | Status pill with color (gray=imported, yellow=partial, green=published, etc.) |
| Score | Completion score 0-100 with progress bar |
| Flags | Icon chips for active review flags |
| Actions | Edit · Publish/Unpublish · Archive · ⋯ |

Clicking a row anywhere except an actions button opens the product side drawer (§5.5). The Edit action opens the full editor (§6) directly.

### 5.3 Bulk actions

Select multiple via checkbox column. Bulk action bar appears with:

- Assign category
- Assign brand
- Add goal tag(s)
- Set price (apply same price to all)
- Set stock quantity (apply same quantity to all selected variants; per §10)
- Adjust stock (delta — add or subtract a count across selected variants)
- Set low-stock threshold (per-variant default override; per §10)
- Mark hidden / visible (toggle `is_public_visible`)
- Publish (bulk publish ready products — see safeguards below)
- Archive
- Flag for review

**Universal safeguards on bulk actions:**

- Every bulk action requires double-confirmation if affecting >20 products.
- An undo toast surfaces for 30 seconds after any destructive bulk action (bulk hide, bulk category reassign, bulk archive). The toast offers a one-click revert that records its own audit_log entry. After 30 seconds the toast dismisses and undo is no longer available; admin must perform a forward action to revert.
- Every bulk action writes one `audit_log` row, not one per affected product. The row's `diff` JSONB carries the full list of affected product IDs and the per-field change applied.

**Bulk publish — additional safeguards (per request scope §1):**

- Confirmation modal shows the full list of products being published (paginated if >50).
- For each product, the modal surfaces any active review flags as warning rows.
- The modal includes a soft-warning override: "I understand N of these products have unresolved review flags; publish anyway." Override must be checked explicitly; default state is unchecked.
- **Hard-block exception (not overridable):** if any selected product has `admin_review_flags.case_pack = true`, that product is excluded from the bulk-publish action and the modal shows a non-dismissable error row explaining why (per PRODUCT_CONTENT_SPEC v1.1 §18.2: case-pack products may never be publicly visible). Admin must deselect those products to proceed.
- The single bulk_publish audit_log entry records: the full list of published product IDs, the admin's override decision (yes/no), the count of products that had review flags at publish time, and the list of products that were hard-blocked and excluded.

**Bulk stock-adjust — additional safeguards (per §10 inventory rules):**

- Each affected variant generates one `inventory_movements` row with `reason='manual_adjustment'` (or `'stock_recount'` if the admin chose the "stock recount" sub-action).
- The bulk action is a single transaction: either all selected variants get adjusted and their movement rows written, or none of them do.

### 5.4 Spreadsheet-style quick edit

The product list table (§5.2) supports inline editing of high-frequency fields without leaving the list view. Editable columns when admin is in "quick edit" mode:

- Retail price
- Stock quantity (aggregated across variants — see §10.6 for the per-variant edit affordance in the drawer)
- Category
- Brand
- Status
- Visibility (`is_public_visible`)

Behavior:

- **Explicit save, not autosave.** Cells become editable on click. Changed cells are visually marked (border color + background tint) until saved.
- A persistent "Save N changes" button appears in the page header once at least one cell is dirty. The button shows the count of changed cells and a tooltip listing affected products.
- Clicking Save fires one server action that applies all changes inside a single Postgres transaction. Either all changes commit or none do (cart-style atomic save).
- One `audit_log` row per save action, with the `diff` JSONB carrying all changed (product_id, field, before, after) tuples in one entry.
- Navigating away with unsaved changes triggers a "You have N unsaved changes" confirmation dialog. Cancel returns to the page; discard drops the local edits and navigates.

Quick edit + side drawer interaction (§5.5):

- If the admin has pending unsaved quick edits and opens the side drawer for any product, a modal prompts "Save N changes or discard?" before opening the drawer. Never silently lose data; never allow a quick edit and a drawer edit to overlap and produce ambiguous state.

### 5.5 Product side drawer

Clicking a product row anywhere except action buttons opens a side drawer (slide-in panel from the right, ~40% viewport width on desktop, full-width sheet on mobile). Drawer contents:

- Primary image (with drag-drop / paste-image upload zone overlaid — per §5.10)
- Product name (read-only header)
- Retail price (editable)
- Stock quantity per variant (editable; one row per variant; per §10.6)
- Low-stock threshold per variant (editable)
- Category (editable dropdown)
- Brand (editable dropdown)
- Status (editable dropdown)
- Visibility (`is_public_visible`) toggle
- Compact "missing fields" checklist showing which Tier 1/Tier 2 fields are unfilled (links to the relevant section of the full editor)
- Active review flags as removable chips (clicking an X resolves the flag and writes an audit_log entry)

Footer actions:
- "Save" (saves drawer-only changes, single transaction)
- "Save & close"
- "Open full editor" → navigates to `/admin/products/[id]` (§6)
- "Cancel" — discards unsaved drawer changes after confirmation

Stale-data detection in the drawer follows §5.11.

### 5.6 Missing-data work queues

Dedicated queue views accessible from the dashboard (§4 widget 1) and from `/admin/queues`. Each queue is a filtered product list with the field that defines the queue placed front and center in the row UI.

Standard queues:

- **Missing price** — `admin_review_flags.missing_price = true`
- **Missing image** — `admin_review_flags.missing_image = true`
- **Missing stock quantity** — `admin_review_flags.missing_stock_quantity = true` (per §10 + PRODUCT_CONTENT_SPEC v1.1 §5.4)
- **Needs brand review** — `admin_review_flags.needs_brand_review = true`
- **Needs category review** — `admin_review_flags.needs_category_review = true`
- **Needs label data** — `admin_review_flags.needs_label_data = true`
- **Ready to publish** — completion_score >= publish threshold AND no blocking review flags AND status != 'published'
- **Out of stock** — derived from §10: any published product where every variant has `stock_status = 'out_of_stock'`
- **Low stock** — derived from §10: any published product where at least one variant has `stock_status = 'low_stock'`

Each queue supports composed filtering on top of its base filter — see §5.9.

### 5.7 Save & Next workflow inside queues

In any queue view, the product editor (or side drawer, depending on the queue's preferred edit surface) exposes these actions:

- **Save** — commits the current product's changes; admin stays on this product.
- **Save & Next (N)** — commits and advances to the next product in the same queue, in the queue's current sort order.
- **Skip** — advances without saving; the product remains in the queue.
- **Mark for review** — sets a `needs_label_data` (or other appropriate) review flag and advances. Logs an audit_log entry.

When the admin reaches the last product in the queue and presses Save & Next, the queue view re-queries (the saved product may have left the queue) and shows the next page or a "Queue empty — N products processed in this session" completion screen.

### 5.8 Keyboard shortcuts

Admin portal global shortcuts (active everywhere):

| Shortcut | Action |
|---|---|
| `Cmd-K` (or `Ctrl-K` on non-mac) | Open command bar (§5.9) |
| `?` | Show shortcut help overlay |
| `Esc` | Close drawer / modal / overlay |

Inside a queue view (§5.6) or product editor (§6):

| Shortcut | Action |
|---|---|
| `J` | Next product in queue/list |
| `K` | Previous product in queue/list |
| `E` | Open side drawer for the focused/current product |
| `S` | Save |
| `N` | Save & Next |

Shortcuts are disabled inside text input fields (so typing "J" in a description field doesn't navigate away). The `?` overlay always lists the currently active shortcuts in the current context.

### 5.9 Command bar (Cmd-K)

Global command palette modal. Search across:

- Product name, SKU, barcode (live search against the catalog)
- Brand name (jumps to brand editor)
- Category name (jumps to category)
- Order reference (jumps to order detail)
- Queue name (e.g., typing "missing image" jumps to that queue)

Recent commands surface at the top when the bar opens. Selection executes immediately (no extra confirm step).

### 5.10 Image upload from drawer

The product side drawer (§5.5) and the full product editor (§6) both support direct image upload via:

- Drag-and-drop onto the image zone
- Paste from clipboard (`Cmd-V` while drawer/editor is focused)
- Click-to-select file picker

Upload constraints follow PRODUCT_CONTENT_SPEC v1.1 §27.2 (file size, format, dimensions). On successful upload, the new image appears immediately in the drawer; an audit_log entry records the upload with the file metadata.

### 5.11 Stale-data detection (optimistic concurrency)

Every product edit surface (full editor, side drawer, spreadsheet inline) carries the `updated_at` timestamp it loaded into a hidden form field. On save, the server compares the submitted `updated_at` against the current row's `updated_at`.

If they differ:

- Server returns `409 stale_data` with the diff between the snapshot the admin loaded and the current state.
- UI surfaces a non-dismissable warning: "This product was updated [N] seconds ago by [admin display name]. Reload to see changes or save anyway?"
- "Reload" discards the admin's local changes and reloads the current state.
- "Save anyway" forces the save (last-write-wins) and records both admin identities in the audit_log diff: `{ overridden_by: <admin>, original_editor: <other admin>, original_updated_at: <ts> }`.

This protects against silent concurrent overwrites without blocking the admin from intentional overrides.

### 5.12 Quick composed filters

Queue views and the product list both support multi-criterion filtering composed at the URL level. Example:

```
/admin/products?status=imported&missing_price=true&category=sport-nutrition&brand=applied-nutrition
```

The filter bar UI exposes an "Add filter" affordance that lets the admin stack arbitrary conditions. Saved filter presets are stored per-admin (post-MVP polish — out of MVP scope but the URL contract must support arbitrary stacking now so the post-MVP feature is additive).

### 5.13 Recent activity / progress indicator

Per signed-in admin, the dashboard widget (§4 widget 8) and the product list header surface a small progress line:

- "You edited N products today, M in the last hour."
- Source: `audit_log` filtered by `actor_user_id = current admin` and `action IN ('product_update', 'product_publish', 'product_unpublish', 'bulk_*')`, grouped by `entity_id` (distinct products) with time-window aggregations.
- Refreshes on every save and every navigation back to the list.

Purpose: psychological progress signal against the 787-product enrichment backlog. Not a performance metric; not surfaced to other admins. No leaderboard.

---

## 6. Product editor (`/admin/products/[productId]`)

### 6.1 Layout

Three-column layout on desktop, stacked on mobile:

```
┌─────────────────────────────────────────────────────────────────────┐
│  Header bar:  [← Back] Product name · Status pill · Score badge ·  │
│               [Save] [Preview as Public] [Publish] [⋯]             │
├──────────────────────┬─────────────────────────┬───────────────────┤
│                      │                         │                   │
│  Left sidebar:       │  Main editor:           │  Right sidebar:   │
│  Field checklist     │  Field forms grouped    │  Status panel     │
│  with per-field      │  by section             │  Review flags     │
│  statuses            │                         │  Audit history    │
│                      │                         │  Source info      │
│                      │                         │                   │
└──────────────────────┴─────────────────────────┴───────────────────┘
```

### 6.2 Left sidebar — field checklist

Every field shows its current status with an icon:

| Status | Icon | Color | Meaning |
|---|---|---|---|
| `complete` | ✓ | green | Field has a value and is approved |
| `verified` | ✓✓ | green | Label-derived content verified against label |
| `draft` | ✎ | amber | Drafted (AI or admin) but not approved — never public |
| `missing` | ○ | gray | No value |
| `needs_review` | ⚠ | red | Has value but flagged for review |
| `not_applicable` | — | gray | N/A for this product type |

Clicking a row scrolls to that field in the main editor and focuses the input.

The checklist groups fields by tier:

- **Tier 1 — Import (always complete after import):**
  - name, source_category, brand_raw, source_row
- **Tier 2 — Publish (MVP):**
  - name (normalized), brand (canonical), category (public), retail_price
- **Tier 3 — Quality:**
  - image, description, nutrition_panel, ingredients, allergens, directions, warnings, seo

### 6.3 Main editor sections

Each section is a collapsible form. Save is per-section (not monolithic).

**Section A — Identity**
- Name (normalized) — text input, suggested value from raw name with title-case applied
- Brand — combobox; if `brand_raw` doesn't match an alias, "Add as new alias for {brand}" CTA appears
- Category — dropdown from public taxonomy; "Suggest based on source_category" button uses the mapping table
- Subcategory — dropdown
- Form — dropdown (Powder / Capsule / ...)
- Goal tags — multi-select with primary/secondary distinction

**Section B — Pricing**
- Retail price (AED) — integer input
- Wholesale price (internal) — integer input (admin-only field)
- Compare-at price — integer input, optional, only shown when promotions UI lands

**Section C — Visibility & Stock**
- Status — read-only display; transitions via the Publish/Archive buttons
- `is_public_visible` — toggle (gated by publish gate validation)
- Stock state per variant (sub-form)

**Section D — Variants**
Variant table. Add/remove variants. Each variant has:
- Flavor, Size, SKU, Barcode, Price, In stock, Stock quantity, Weight (grams)
- Re-order via drag handles
- Set primary variant (default selected on PDP)

**Section E — Images**
Image grid with drag-drop upload. Each image:
- Thumbnail preview
- Kind dropdown (front / label-nutrition / label-ingredients / angle / open / lifestyle)
- Alt text input
- Variant assignment (optional)
- Primary toggle (max 1 primary per product)
- Sort order via drag

Upload destination: `products/{brand_slug}/{product_slug}/{auto-filename}`. Thumbnails auto-generated server-side on upload.

**Section F — About this product (content.description, content.benefits)**
- Description textarea (multi-paragraph)
- Benefits — list editor (3-6 bullets, char-counter per bullet ≤ 8 words)
- "AI draft" button — calls AI helper to draft text from product name + category template. Drafted text status = `draft`, hidden from public until admin clicks "Approve."

**Section G — Label data**
- Nutrition panel — structured editor matching v1.1 §9 schema (panel_type select, serving_size, servings_per_container, then add/remove rows)
- Ingredients — textarea (label verbatim)
- Allergens — chip multi-select (milk, eggs, soy, gluten, peanuts, tree nuts, fish, shellfish, sesame, sulfites)
- Manufacturing facility warnings — textarea
- Directions of use — textarea (label verbatim)
- Storage instructions — textarea
- Warnings — textarea
- Each field has a "Mark as verified" button that flips status from `draft` to `verified` (admin confirms it's been checked against the label).

**Section H — SEO**
- SEO title (with character counter, optimal 50-60)
- SEO description (with character counter, optimal 150-160)
- "AI draft" button using product name + brand + category template

**Section I — Cross-sell**
- Often Bought With — picker (search products by name/brand, drag to reorder, max 3)
- Related products (read-only, computed)

### 6.4 Right sidebar — status panel

- **Publish readiness** — shows current tier (Pre-MVP / MVP / Professional / Full-quality) with the missing requirements listed
- **Review flags** — chips for each active flag, click to dismiss with confirmation
- **Audit history** — last 5 audit log entries for this product with timestamps + actor

### 6.5 Header actions

- **Save** — saves whatever section is active (auto-save on field blur is also enabled)
- **Preview as Public** — opens the PDP in a new tab with the current data (adaptive rendering rules apply; missing sections hidden)
- **Publish** — checks publish gate (MVP rule); if pass, sets `is_public_visible=true` and `status='published'`. If fail, modal lists missing fields.
- **Unpublish** — sets `is_public_visible=false`, status `hidden`.
- **⋯ menu**: Archive · Duplicate · View audit log · Download as JSON · Force re-import from source row

### 6.6 Auto-status transitions

After every save, the system recomputes:

- `completion_score`
- `missing_required_fields[]`
- `status` (auto-promoting `imported` → `draft` on first edit; `draft` → `partial` when at least one optional field is saved; `partial` → `ready_to_publish` when MVP fields all complete)

The admin sees this in real-time without manual status manipulation.

---

## 7. Brand management

### 7.1 Brand list (`/admin/brands`)

Table:

| Column | Content |
|---|---|
| Logo | Real or placeholder |
| Name | Display name |
| Slug | Read-only |
| Aliases | Count of raw spellings mapped here |
| Products visible | Count |
| Products total | Count |
| Tier | heavy/medium/light (computed) |
| Featured? | Toggle for homepage featuring (max 2 active) |
| Visible in directory? | Toggle |
| Actions | Edit · ⋯ |

### 7.2 Brand editor

- Display name, slug, country of origin
- Aliases list (add/remove raw MD spellings)
- Logo upload (Supabase Storage)
- Hero image upload (heavy brands)
- Short description (1-2 sentences)
- Long description (paragraph)
- Featured products list (drag-to-reorder, max 10)
- Top categories (auto-computed display)
- Visibility toggles

### 7.3 Brand normalization tool

A standalone tool at `/admin/brands/normalize`:

- Lists all raw MD brand spellings that don't yet map to a canonical brand.
- For each, admin can:
  - Map to existing canonical brand (adds to its aliases)
  - Create new canonical brand
  - Mark as "ignore" (e.g., the "SNACKS" pseudo-brand row)

After mapping, all affected products' `brand_id` is updated and `needs_brand_review` flag cleared.

---

## 8. Category management

### 8.1 Category list (`/admin/categories`)

The 16 Plan v2 categories. Admin can:

- Reorder (affects nav display)
- Toggle visibility per category
- Edit listing page copy
- Edit category SEO fields
- View product count

### 8.2 Adding new categories

Restricted to Phase 2. The 16 categories are seeded and locked for MVP. Subcategories per category can be edited freely.

---

## 9. Order management

### 9.1 Order list (`/admin/orders`)

Filters: status, date range, customer email, payment method, search by order reference.

Each row: reference · customer · date · total · payment method · status pill · actions.

### 9.2 Order detail (`/admin/orders/[orderId]`)

Sections:

- **Header:** reference, customer, status, total, [Refund] [Cancel] buttons
- **Order summary:** line items with images, quantities, prices, totals (subtotal/shipping/VAT/total)
- **Shipping address:** frozen snapshot (denormalized in DB)
- **Payment info:** method, intent ID, transaction ID, status. Link to view raw payment_events
- **Shipment info:** tracking number, link, status. Link to view raw shipment_events
- **Timeline:** chronological events (created → paid → preparing → shipped → delivered) with timestamps
- **Customer notes:** any notes attached to the order
- **Admin notes:** internal-only notes (admin can add)

### 9.3 Order status transitions

Admin can manually:

- **Mark as preparing** (from `paid`)
- **Mark as shipped** (from `preparing`) — requires tracking number input
- **Mark as delivered** (from `shipped`) — usually auto-set by iCarry webhook
- **Cancel** (from `pending_payment` or `paid`) — triggers refund flow if paid
- **Refund** (any time post-payment) — partial or full

Each transition writes audit log + sends transactional email (M7+).

---

## 10. Inventory editing surfaces

Cross-reference: `INVENTORY_SPEC.md` is the canonical inventory spec. This section covers only the admin-facing editing UX. Storefront stock display is M3 territory (per `INVENTORY_SPEC.md` §5). Checkout decrement is M4 territory (per `INVENTORY_SPEC.md` §6).

### 10.1 Where inventory is edited

Three surfaces, in order of granularity:

1. **Spreadsheet inline edit on the product list** (§5.4) — bulk light-touch edits on the aggregated stock summary across variants.
2. **Product side drawer** (§5.5) — per-variant stock + threshold edits with low-friction navigation between products.
3. **Full product editor** (§6) — deep edits including creating/deleting variants, per-variant SKU/barcode/weight, and stock-recount workflows.

### 10.2 Per-variant fields admin can edit

Per `INVENTORY_SPEC.md` §3 and the updated `DB_SCHEMA.md §5.2` schema:

| Field | Type | Editable | Notes |
|---|---|---|---|
| `stock_quantity` | int >= 0 | yes | Direct edit. Triggers a trigger-computed update of `stock_status` (per INVENTORY_SPEC.md §3.3). Writes `inventory_movements` row with `reason='manual_adjustment'`. |
| `low_stock_threshold` | int >= 0 | yes | Default 5 per variant on creation. Per-variant override. |
| `stock_status` | enum | no | Computed by trigger from quantity + threshold. Admin cannot set directly. |
| `sku` | text unique | yes | Validated unique at save. |
| `barcode` | text | yes | Optional. |
| `weight_grams` | int > 0 | yes | Optional but required pre-publish for shipping rate calc. |

### 10.3 Stock-recount workflow

A dedicated "Stock recount" action appears on the side drawer and in the full editor:

- Admin enters the new physical count.
- System writes one `inventory_movements` row with `reason='stock_recount'` carrying both the previous and new quantity in `change_amount`.
- Distinct from `manual_adjustment` so the inventory log can distinguish "I'm correcting a count discrepancy" from "I damaged 3 units and need to subtract them."

### 10.4 Manual adjustment workflow

The default direct-edit path on the variant stock_quantity field uses `reason='manual_adjustment'`. The admin can optionally add a freetext note (stored in the movement row's `change_reason_note` text column — see `INVENTORY_SPEC.md` §4). Single-step action; no second-step approval (per the locked decision in the M1 spec-evolution chat).

### 10.5 Low-stock threshold override

Default threshold for newly-created variants is 5. Admin can override per-variant in either the side drawer or the full editor. The bulk action "Set low-stock threshold" (§5.3) applies a chosen threshold across all selected variants in one transaction.

### 10.6 Aggregated stock display in the product list

The product list (§5.2) shows aggregated stock at the product level:

- Total = sum of `stock_quantity` across variants.
- Badge "Low" if any variant is `stock_status = 'low_stock'`.
- Badge "Out" if every variant is `stock_status = 'out_of_stock'`.
- Badge "Mixed" if some variants out and some in stock.
- Displayed value "—" with red "missing" badge if `missing_stock_quantity = true` (product has zero variants OR any variant has `stock_quantity IS NULL`).

Spreadsheet inline edit on this aggregated cell distributes the new total proportionally across existing variants — or, if exactly one variant exists, sets that variant directly. If multiple variants exist and admin wants per-variant control, they must use the side drawer.

### 10.7 Variant creation gate for publish

Per the locked decision (M1 spec-evolution chat Q4): a product with `status='published'` must have at least one variant with `stock_quantity IS NOT NULL`. This is enforced by a CHECK at the publish action layer (server-side validation in the publish service):

- Attempting to set `status='published'` on a product with zero variants → returns `cannot_publish: no_variants`.
- Attempting to set `status='published'` on a product whose variants all have `stock_quantity IS NULL` → returns `cannot_publish: missing_stock_quantity`.

The error responses surface in the admin UI as inline error toasts on the publish button.

### 10.8 Inventory movement log viewer

A read-only viewer at `/admin/products/[id]/inventory-history`:

- Lists `inventory_movements` rows for the product (across all its variants) in reverse chronological order.
- Columns: timestamp · variant · previous_quantity · new_quantity · change_amount · reason · admin (actor) · order reference if applicable · note.
- Filterable by reason.
- Read-only (the table is append-only per `INVENTORY_SPEC.md` §4.2).

Also available portal-wide at `/admin/inventory-history` filtered by date/admin/reason.

---

## 11. Homepage curation (`/admin/homepage`)

Single page with all the homepage editing surfaces:

- **Hero copy + CTA** — text inputs, link target
- **Promo banner** — text input, link target, optional schedule (start/end dates)
- **New Arrivals rail** — product picker (4 slots)
- **Bestsellers rail** — product picker (4 slots)
- **Featured Brand Strip** — brand picker (2 slots; enforced max)
- **Goal pills** — read-only display of the 5 goals; can re-order

Preview button shows the homepage as-it-will-render.

---

## 12. Audit log (`/admin/audit-log`)

Read-only paginated log.

Filters: actor, action type, entity type, entity ID, date range.

Each row: timestamp · actor · action · entity · diff preview · IP · user agent.

Clicking the diff preview opens a side panel with the per-field human-readable diff view (§12.1).

### 12.1 Diff view (human-readable)

The audit_log table stores changes in a `diff` JSONB column (per `DB_SCHEMA.md §8.1`). The admin UI renders that JSON as a per-field changelog rather than raw JSON. Example rendering:

> **Sarah Khalil** updated product **Optimum Nutrition Gold Standard Whey 2kg Chocolate** at 2026-06-14 11:22:18:
>
> - `retail_price_aed`: changed from **AED 89** to **AED 94**
> - `stock_quantity` (variant: Chocolate 2kg): changed from **12** to **8**
> - `is_public_visible`: changed from **false** to **true**

Renderer rules:
- Money fields render with the `AED` prefix and natural integer formatting.
- Status enum changes render as "Status: imported → published" not "imported -> published".
- Stock_quantity changes mention the affected variant flavor+size in parens.
- Diff entries that contain PII (customer email, phone) are redacted in the renderer ("***@example.com").
- The raw JSON remains available via a "Show raw" toggle for engineering investigations.

For bulk operations, the renderer summarizes ("Sarah Khalil bulk-published 23 products") and offers a "Show all affected products" expander listing each ID with a link.

---

## 13. Settings

### 13.1 Feature flags (`/admin/settings/feature-flags`)

Per `DECISION_CAPTURE.md` §4, all flags listed in three sections (surface, feature, operational).

Each flag row:
- Key
- Description
- Current value (toggle)
- Last changed by + when

**HIGH_RIGOR-gated flags** show a "Locked" indicator until the corresponding cross-check sign-off note appears in `LAST_SESSION.md`. Toggling these flags requires:
1. Confirmation modal with the HIGH_RIGOR consequences listed.
2. MFA re-verification (re-enter TOTP code).
3. Optional: typed confirmation phrase ("ENABLE PAYMOB LIVE").

### 13.2 Integrations (`/admin/settings/integrations`)

Status dashboard for Paymob and iCarry:

- Current mode (stub / live)
- Last successful webhook timestamp
- Webhook failure count (last 24h)
- Test transaction button (sandbox only)
- Credentials masked (last 4 only)

### 13.3 Admin user management (`/admin/settings/users`)

List of admin users with:
- Email
- Last signin
- MFA enrolled? (yes/no)
- Created
- Actions: revoke MFA (forces re-enroll), deactivate, delete

Adding a new admin requires an existing admin's MFA re-verification.

---

## 14. Audit-logged events

Every action below writes an `audit_log` row:

| Action | Entity | Triggers email/alert? |
|---|---|---|
| Product create | product | No |
| Product update (any field) | product | No |
| Product publish | product | No |
| Product unpublish | product | No |
| Product archive | product | No |
| Stock manual adjustment | product_variant | No |
| Stock recount | product_variant | No |
| Variant create | product_variant | No |
| Variant delete | product_variant | No |
| Low-stock threshold change | product_variant | No |
| Image upload | product | No |
| Bulk operation (any) | bulk (with count + ID list in diff) | No |
| Bulk publish override (review flags ignored) | bulk_publish | Alert admin team |
| Stale-data save override | product | No |
| Brand create/update | brand | No |
| Category update | category | No |
| Order status change | order | Email customer (M7+) |
| Order refund | order | Email customer (M7+) |
| Feature flag toggle | feature_flag | Alert admin team |
| Admin user added | admin_user | Alert admin team |
| Admin user deactivated | admin_user | Alert admin team |
| MFA reset | admin_user | Alert admin team |
| Integration credentials updated | integration | Alert admin team |

---

## 15. Phase 2 admin capabilities (out of scope for MVP)

Documented for reference:

- Reviews moderation queue (when reviews system ships)
- Promo code engine (campaign creator, code generator, usage limits)
- Customer support conversation viewer (when AI support ships per `AI_SUPPORT_FUTURE_SPEC.md`)
- Multi-role permissions
- Bulk image upload via ZIP file
- CSV bulk price update
- Saved filter presets per-admin (the URL contract from §5.12 supports stacking now; the UI affordance to save/recall presets ships post-MVP)
- **Warehouse inventory automation / sync** — barcode scanner workflows, supplier purchase orders, automated supplier stock sync, multi-warehouse / multi-location inventory. Inventory *tracking* itself is MVP per `INVENTORY_SPEC.md`; the *automation/sync* layer on top is post-MVP. See `proj_spec.md §9` P8.

---

_End of `ADMIN_PORTAL_SPEC.md` v1.1 — extended 2026-05-23 with §4 dashboard expansion, §5.3 bulk-operation safeguards, §5.4–5.13 UX enhancements, §10 inventory editing surfaces, §12.1 audit-log diff view._
