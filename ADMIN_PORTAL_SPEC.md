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

**Purpose:** at-a-glance status for the admin team.

**Widgets** (each is a Server Component fetching its own data):

1. **Catalog snapshot**
   - Total imported products
   - Published / partial / draft / imported counts
   - Average completion score
   - Top "needs attention" filter buttons (missing_price, missing_image, needs_category_review, needs_brand_review)

2. **Recent orders** (Phase: M4 visible, M5+ populated)
   - Last 10 orders with status + total
   - Quick-filter "pending payment", "preparing", "shipped"

3. **Recent admin activity**
   - Last 10 audit log entries

4. **Feature flag status**
   - All commerce-related flags with their current state
   - Quick toggle for `maintenance_mode` and `read_only_mode`

5. **System health**
   - Paymob mode (stub/live)
   - iCarry mode (stub/live)
   - Email provider mode (stub/resend)
   - Last failed webhook (if any)

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
- Case-pack
- Duplicate
- Multiple price pairs
- Needs category review
- Needs brand review
- Needs label data

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
| Status | Status pill with color (gray=imported, yellow=partial, green=published, etc.) |
| Score | Completion score 0-100 with progress bar |
| Flags | Icon chips for active review flags |
| Actions | Edit · Publish/Unpublish · Archive · ⋯ |

### 5.3 Bulk actions

Select multiple via checkbox column. Bulk action bar appears with:

- Assign category
- Assign brand
- Set price (apply same price to all)
- Add goal tag(s)
- Toggle publish
- Archive
- Flag for review

Every bulk action requires double-confirmation if affecting >20 products.

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

## 10. Homepage curation (`/admin/homepage`)

Single page with all the homepage editing surfaces:

- **Hero copy + CTA** — text inputs, link target
- **Promo banner** — text input, link target, optional schedule (start/end dates)
- **New Arrivals rail** — product picker (4 slots)
- **Bestsellers rail** — product picker (4 slots)
- **Featured Brand Strip** — brand picker (2 slots; enforced max)
- **Goal pills** — read-only display of the 5 goals; can re-order

Preview button shows the homepage as-it-will-render.

---

## 11. Audit log (`/admin/audit-log`)

Read-only paginated log.

Filters: actor, action type, entity type, entity ID, date range.

Each row: timestamp · actor · action · entity · diff link · IP · user agent.

Clicking diff link opens a side panel with the before/after JSON.

---

## 12. Settings

### 12.1 Feature flags (`/admin/settings/feature-flags`)

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

### 12.2 Integrations (`/admin/settings/integrations`)

Status dashboard for Paymob and iCarry:

- Current mode (stub / live)
- Last successful webhook timestamp
- Webhook failure count (last 24h)
- Test transaction button (sandbox only)
- Credentials masked (last 4 only)

### 12.3 Admin user management (`/admin/settings/users`)

List of admin users with:
- Email
- Last signin
- MFA enrolled? (yes/no)
- Created
- Actions: revoke MFA (forces re-enroll), deactivate, delete

Adding a new admin requires an existing admin's MFA re-verification.

---

## 13. Audit-logged events

Every action below writes an `audit_log` row:

| Action | Entity | Triggers email/alert? |
|---|---|---|
| Product create | product | No |
| Product update (any field) | product | No |
| Product publish | product | No |
| Product unpublish | product | No |
| Product archive | product | No |
| Bulk operation | bulk (with count) | No |
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

## 14. Phase 2 admin capabilities (out of scope for MVP)

Documented for reference:

- Reviews moderation queue (when reviews system ships)
- Promo code engine (campaign creator, code generator, usage limits)
- Customer support conversation viewer (when AI support ships per `AI_SUPPORT_FUTURE_SPEC.md`)
- Multi-role permissions
- Bulk image upload via ZIP file
- CSV bulk price update
- Inventory sync (warehouse integration)

---

_End of `ADMIN_PORTAL_SPEC.md` v1.0._
