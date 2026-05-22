# PRODUCT_CONTENT_SPEC_v1.1_ADMIN_DRIVEN.md

**Project:** Vitaminaty
**Document version:** v1.1 (admin-driven)
**Supersedes:** v1.0 (`PRODUCT_CONTENT_SPEC.md`)
**Document type:** Catalog content model — fields, statuses, lifecycle, publish gates, adaptive rendering, brand and category normalization
**Audience:** BOB v5 / Claude Code / Codex / human reviewers
**Treated as:** spec text under BOB v5 invariant I1 — character-verbatim, no rephrasing

---

## §1 Purpose & scope

This document defines the **content model** for the Vitaminaty product catalog: what fields exist on a product, what their statuses can be, how a product moves from import to public visibility, what the public site is allowed to render at each stage, and how the admin team enriches the catalog over time.

It is the contract that:

- `DB_SCHEMA.md` reads when designing the `products` table, `fields_status` JSONB shape, and `admin_review_flags`.
- `ADMIN_PORTAL_SPEC.md` reads when building the product editor and product list filters.
- `ARCHITECTURE.md` reads when defining the admin-driven enrichment data flow.
- `proj_spec.md` references when scoping M1 (import), M2 (admin editor), and M3 (public rendering).

If a field name, status name, or rule in this document conflicts with another spec file, **this document wins** for content-model questions. Schema and UI specs adapt to this; this does not adapt to them.

---

## §2 Core principles

These principles are not negotiable. Every downstream decision in M1-M3 must honor them.

### §2.1 Admin-driven, not import-driven

The MD import (`docs/reference/product.md`, 817 source rows → 787 unique products) is the **starting point**, not the finished catalog. Every product lands in `status='imported'` with most fields empty. The admin team enriches products one by one over weeks or months. The public site shows only what the admin has explicitly published.

### §2.2 Never invent

The system **never** generates content that doesn't trace back to a real source:
- No fabricated supplement facts (no made-up protein-per-serving numbers, no invented ingredient lists)
- No fabricated reviews (the reviews surface shows only an empty state at MVP)
- No fabricated discounts (compare-at prices are admin-entered only)
- No medical claims (we cannot say "treats X" or "cures Y" — only what the manufacturer's label says, verbatim)
- No invented brand stories, history, or origin claims
- No invented descriptions in published state (descriptions can be `draft` and admin-approved → `complete`)

### §2.3 Progressive enrichment

Products do not need to be "complete" to be useful internally. The admin sees imported-but-empty products in the admin list. The public site sees only published products. Between import and publish, the product exists in a workshop state where each field is independently tracked.

### §2.4 Hide rather than fake

When a field is missing, the corresponding PDP section is **hidden entirely** — no "no information available" placeholders, no "—", no "TBD." Adaptive rendering (§6) decides what sections render based on field statuses.

### §2.5 Internal data stays internal

`wholesale_price_internal` is admin-only — never exposed publicly via API, page render, JSON-LD, sitemap, or any other surface. Enforced at three layers: column REVOKE in Postgres, repository query exclusion, and code review.

### §2.6 Source traceability is permanent

Every product retains its source lineage forever:
- `source_file` (e.g., `product.md`)
- `source_row[]` (array of original Excel rows that produced this product — may be multiple for merged duplicates)
- `name_raw` (exact name as it appeared in Excel before normalization)
- `brand_raw` (raw brand spelling before canonical mapping)
- `source_category` (one of the 15 MD source categories)
- `source_notes` (the MD "Notes" column verbatim)

These fields are read-only after import. They allow forensic recovery if normalization decisions need revisiting.

---

## §3 Source catalog summary

| Field | Value |
|---|---|
| Source file | `docs/reference/product.md` (derived from "Copy of prices pre finale.xlsx") |
| Original Excel rows | 817 |
| Unique products after dedupe | **787** |
| Duplicates merged | 30 |
| MD source categories | **15** |
| Raw brand spellings observed | ~52 |
| Canonical brands after normalization | ~30 |
| Products flagged `case_pack` (hidden from public) | ~140 |
| Products with missing prices (`N/A` in source) | ~360 |
| Products needing category review after MD → public mapping | ~36 (the "Uncategorized" + ambiguous rows) |

The exact numbers may shift by ±5 after the M1 import runs the normalization pipeline; the M1 cross-check verifies the final counts and updates this section.

---

## §4 Product lifecycle — 7 statuses

A product transitions through these statuses. The transitions are mostly automatic (driven by completeness) with a few admin-only manual transitions.

| Status | Public visible? | Meaning | Enters from | Exits to |
|---|---|---|---|---|
| `imported` | No | Just landed from MD import. Tier 1 fields complete, Tier 2 fields mostly empty. | (initial state) | `draft` on first admin edit |
| `draft` | No | Admin has started enriching but Tier 2 fields are not yet complete. | `imported` | `partial` |
| `partial` | No | At least some Tier 2 fields complete, but not all required-for-publish fields. | `draft` | `ready_to_publish` |
| `ready_to_publish` | No | All Tier 2 (MVP publish gate) fields complete. Admin can publish anytime. | `partial` | `published` (manual click) |
| `published` | Yes | Admin clicked Publish. `is_public_visible=true`. Live on the public site with adaptive rendering. | `ready_to_publish` | `hidden`, `archived` |
| `hidden` | No | Admin temporarily removed from public. Data preserved. Can republish. | `published` | `published`, `archived` |
| `archived` | No | Admin marked as discontinued. Soft-delete; data preserved for traceability. | any non-imported status | (terminal) |

**Auto-transitions** are computed at every save. **Manual transitions** require an explicit admin action: Publish, Unpublish, Archive, Restore.

**Status transitions write to `audit_log`** with the actor, before/after status, and timestamp.

---

## §5 Field-level status model

### §5.1 `fields_status` JSONB shape

Every product has a `fields_status` JSONB column. The shape is a flat object keyed by field name, with the values being one of the statuses defined in §5.2.

```json
{
  "name": "complete",
  "brand": "complete",
  "category": "complete",
  "form": "complete",
  "retail_price": "complete",
  "description": "draft",
  "benefits": "missing",
  "image": "complete",
  "nutrition_panel": "verified",
  "ingredients": "verified",
  "allergens": "complete",
  "directions": "verified",
  "warnings": "verified",
  "storage": "missing",
  "seo_title": "draft",
  "seo_description": "missing",
  "often_bought_with": "missing"
}
```

The set of keys is **fixed** at the schema layer. Adding a new field requires a migration to update the `fields_status` shape across all rows.

### §5.2 Field status values

| Status | Icon | Color | Meaning | Public-visible content? |
|---|---|---|---|---|
| `complete` | ✓ | green | Field has a value, admin-approved | Yes |
| `verified` | ✓✓ | green | Label-derived content cross-checked against the physical label | Yes |
| `draft` | ✎ | amber | Drafted (AI-assisted or manual) but not yet approved | **No — never shown publicly** |
| `missing` | ○ | gray | Field has no value | N/A (section hidden) |
| `needs_review` | ⚠ | red | Field has a value but flagged for review (e.g., brand auto-mapped, admin should confirm) | **No — section hidden until reviewed** |
| `not_applicable` | — | gray | Field doesn't apply to this product type (e.g., nutrition_panel on a non-ingestible) | N/A (section hidden) |

**Critical rule:** content with status `draft` or `needs_review` **is never rendered publicly**, even if the product is `published`. Adaptive rendering (§6) filters by per-field status, not just product status.

### §5.3 Status transitions per field

Field-level transitions are mostly automatic. Specifics:

- **On import:** every Tier 1 field set to `complete`, every Tier 2/Tier 3 field set to `missing`. Brand and category set to `needs_review` if the raw value didn't map cleanly to a canonical record.
- **On admin edit of a field:** field moves to `complete` for free-text fields, or `draft` if the admin used an "AI draft" button without clicking "Approve."
- **On admin clicking "Mark as verified" on a label-derived field:** status moves from `complete` (or `draft`) to `verified`.
- **On admin clicking "Approve draft":** status moves from `draft` to `complete`.
- **On admin clicking "Mark not applicable":** status moves to `not_applicable`.
- **On admin clearing a field:** status moves back to `missing`.

### §5.4 `admin_review_flags` JSONB shape

A separate JSONB column tracks boolean flags for admin attention. Each flag is automatic-on-import and can be manually dismissed by an admin after review.

```json
{
  "missing_price": true,
  "missing_image": true,
  "case_pack": false,
  "duplicate_suspected": false,
  "multiple_price_pairs": false,
  "needs_category_review": false,
  "needs_brand_review": false,
  "needs_label_data": true
}
```

| Flag | Triggered on import when… | Effect |
|---|---|---|
| `missing_price` | Source `Retail Price` is `N/A` | Product can't pass MVP publish gate (price is required). Filter visible in admin list. |
| `missing_image` | No image uploaded to Supabase Storage | Product can't pass MVP publish gate. |
| `case_pack` | Source name contains `(N/CASE)` or `(N/C)` or `N/CASE` patterns | Product is **never publicly visible** at MVP — case-pack items are wholesale, not retail. Hidden from public regardless of publish status. |
| `duplicate_suspected` | Import dedupe heuristic flagged this product as a probable duplicate of another | Admin should investigate and merge or archive. |
| `multiple_price_pairs` | Source row had multiple `Wholesale Price` / `Retail Price` pairs that couldn't be cleanly merged | Admin must pick a canonical pair. |
| `needs_category_review` | MD category mapped to "Uncategorized" or the mapping rule has `requires_split=true` | Admin must assign a public category before publish. |
| `needs_brand_review` | Brand raw value didn't match any canonical alias | Admin must map to existing brand or create a new canonical brand. |
| `needs_label_data` | Product has no `label_data` filled (no nutrition panel, no ingredients) | Soft flag — product can publish at MVP gate without label data, but Tier 3 quality requires it. |

Flags surface in the admin product list as filter chips (per `ADMIN_PORTAL_SPEC.md` §5.1).

---

## §6 Adaptive PDP rendering — Cases A–G

The public PDP renders different sections based on which fields have publishable content. This produces seven "shapes" of PDP that all look professional, none of which look incomplete.

**Always rendered (regardless of completeness):**
- Header: brand line, name, breadcrumb
- Price block (if `retail_price` is `complete` — otherwise product cannot publish, so this is guaranteed)
- Primary image (if `image` is `complete` — same guarantee)
- Stock state
- Variant selector (if variants exist)
- Add-to-Cart button (when `commerce_enabled` flag is on)
- Trust block (Vitaminaty value props — authenticity, fast delivery, returns)
- FAQ block (static content per category)
- Reviews empty state

**Conditionally rendered based on field status:**

| Section | Renders when… | Source field(s) |
|---|---|---|
| About this product | `description` is `complete` or `verified` | `content.description` |
| Key benefits | `benefits` is `complete` and array has ≥1 item | `content.benefits[]` |
| Directions of use | `directions` is `complete` or `verified` | `label_data.directions_of_use` |
| Storage instructions | `storage` is `complete` or `verified` | `label_data.storage_instructions` |
| Nutrition panel | `nutrition_panel` is `complete` or `verified` | `label_data.nutrition_panel` (structured object per §9) |
| Ingredients | `ingredients` is `complete` or `verified` | `label_data.ingredients` |
| Allergens | `allergens` is `complete` or `verified` | `label_data.allergens[]` |
| Warnings | `warnings` is `complete` or `verified` | `label_data.warnings` |
| Manufacturing facility warnings | `warnings` is `complete` AND `label_data.manufacturing_facility_warnings` non-empty | `label_data.manufacturing_facility_warnings` |
| About the brand | Linked brand has `long_description` populated | `brands.long_description` |
| Often Bought With | `often_bought_with` is `complete` and array has ≥1 item | `content.often_bought_with_ids[]` |
| You May Also Like | Always renders if ≥1 same-category published products exist | computed from `products` + `categories` |

### The seven cases

Cases describe the rendering "shape" of a PDP based on which content fields are populated:

| Case | Description | When it applies |
|---|---|---|
| **A** | Bare minimum — only the always-rendered blocks. No description, no label data, no benefits. | Product just promoted to `published` with only Tier 2 fields complete. |
| **B** | + About this product | `description` complete |
| **C** | + Benefits | `description` + `benefits` complete |
| **D** | + Directions and warnings | C + `directions` + `warnings` complete |
| **E** | + Nutrition panel and ingredients | D + `nutrition_panel` + `ingredients` complete |
| **F** | + Allergens and storage | E + `allergens` + `storage` complete |
| **G** | Full quality — every Tier 3 field complete | E + F + brand long description + Often Bought With |

A product can move from Case A → G over time as the admin enriches it. **No rework on the PDP code is required between cases** — the same template adaptively shows/hides sections based on field statuses.

---

## §7 Public publish gates

Three tiers of "ready to publish." A product can be published at any tier; later enrichment moves it through subsequent tiers without re-publishing.

### §7.1 MVP publish gate (required for `status` → `ready_to_publish`)

All of these must be `complete` or `verified`:

- `name`
- `brand` (canonical brand_id assigned, not `needs_review`)
- `category` (public category assigned, not `needs_review`)
- `retail_price`
- `image` (primary image uploaded)

Additionally:
- `is_case_pack` admin review flag must be `false`
- At least one variant must exist OR product must be flagged as non-variant
- `is_public_visible` will be set to `true` on publish

If a product is `archived`, it cannot publish until restored.

### §7.2 Quality publish gate (target for most products)

Everything in §7.1 plus:

- `description` is `complete` or `verified`
- `benefits` is `complete` with ≥3 items
- `directions` is `complete` or `verified`
- `warnings` is `complete` or `verified`
- `seo_title` is `complete`
- `seo_description` is `complete`

This is the recommended state for hero products on the homepage rails.

### §7.3 Full-quality publish gate (Case G)

Everything in §7.2 plus:

- `nutrition_panel` is `verified` (label cross-checked)
- `ingredients` is `verified`
- `allergens` is `complete`
- `storage` is `complete`
- Linked brand has `long_description` populated
- `often_bought_with` is `complete` with ≥3 items

This is what we aim for over time. Not required to ship.

---

## §8 Field tiers — what gets filled when

### §8.1 Tier 1 — Import (always complete after MD import)

| Field | Source |
|---|---|
| `name_raw` | Excel NAME column verbatim |
| `name` | Normalized from `name_raw` (title-case, brand-prefix stripped) |
| `brand_raw` | Excel Brand column |
| `source_category` | MD source category (one of 15) |
| `source_row[]` | Excel row indices |
| `source_notes` | MD Notes column |
| `retail_price` | Excel Retail Price if numeric (else `missing` + `missing_price` flag) |
| `wholesale_price_internal` | Excel Wholesale Price if numeric |

### §8.2 Tier 2 — MVP publish (admin fills before first publish)

| Field | How admin fills |
|---|---|
| `brand` (canonical) | Map `brand_raw` to canonical brand via normalization tool (§12) |
| `category` (public) | Assign one of 16 Plan v2 categories via mapping suggestion (§13.3) |
| `form` | Select from enum (Powder/Capsule/Tablet/Softgel/Gummies/Liquid/RTD/Food) |
| `goal_tags` | Multi-select from 5 Plan v2 goals (§15) |
| `image` (primary) | Upload to Supabase Storage |
| `slug` | Auto-generated from `name`; admin can edit |

### §8.3 Tier 3 — Quality (filled over time)

All of:
- `description`, `benefits[]`, `directions_of_use`, `storage_instructions`, `warnings`
- `nutrition_panel` (structured per §9), `ingredients`, `allergens[]`
- `seo_title`, `seo_description`
- Additional `images[]` with `kind` and `alt_text`
- `often_bought_with[]`
- Brand-level: `long_description`, `hero_image`, `country_of_origin`

---

## §9 Label data — nutrition panel structured object

The nutrition panel is a structured JSONB object inside `label_data.nutrition_panel`. It captures label-derived facts verbatim from the physical product label.

### §9.1 Schema

```json
{
  "panel_type": "supplement_facts" | "nutrition_facts" | "amino_profile" | "none",
  "serving_size": "1 scoop (30g)",
  "servings_per_container": 67,
  "rows": [
    { "label": "Calories", "amount": "120", "unit": "kcal", "dv_percent": null, "is_proprietary_blend": false },
    { "label": "Protein", "amount": "25", "unit": "g", "dv_percent": null, "is_proprietary_blend": false },
    { "label": "Total Carbohydrate", "amount": "3", "unit": "g", "dv_percent": "1", "is_proprietary_blend": false },
    { "label": "Sugars", "amount": "1", "unit": "g", "dv_percent": null, "is_proprietary_blend": false, "is_subrow": true, "parent_label": "Total Carbohydrate" },
    { "label": "Sodium", "amount": "60", "unit": "mg", "dv_percent": "3", "is_proprietary_blend": false },
    { "label": "Calcium", "amount": "150", "unit": "mg", "dv_percent": "12", "is_proprietary_blend": false },
    { "label": "Proprietary Blend", "amount": "5", "unit": "g", "dv_percent": null, "is_proprietary_blend": true }
  ],
  "footnote": "* Percent Daily Values are based on a 2,000 calorie diet. † Daily Value not established.",
  "label_image_id": "uuid-of-product_images-row-with-kind=label_nutrition"
}
```

### §9.2 Panel types

| Type | Used for | Required fields |
|---|---|---|
| `supplement_facts` | Capsules, tablets, powders sold as supplements | `serving_size`, `servings_per_container`, `rows[]` |
| `nutrition_facts` | Snacks, RTDs, food products | `serving_size`, `servings_per_container`, `rows[]` |
| `amino_profile` | Amino-acid-focused powders showing per-serving amino breakdown | `serving_size`, `rows[]` |
| `none` | Products without a nutrition panel (e.g., topicals) | none |

### §9.3 Rules

- Values are stored as **strings** (preserves "0.5", "<1", "trace" exactly as on the label).
- `unit` is one of: `g`, `mg`, `mcg`, `IU`, `kcal`, `kJ`, `ml`, `oz`, `%`, `serving`.
- `dv_percent` is a string for the same reason ("12", "12.5", "<1", "**").
- `is_proprietary_blend: true` indicates the row is a proprietary blend total — sub-rows beneath it may have `amount: null` (label doesn't disclose).
- Subrows (sugars under carbs, saturated fat under total fat) use `is_subrow: true` and reference `parent_label`.
- Footnote text is captured verbatim from the label.

### §9.4 Status

`nutrition_panel` field status:
- `missing` — nothing entered
- `draft` — admin entered values but didn't cross-check against label image
- `complete` — admin entered values, no cross-check yet
- `verified` — admin clicked "Mark as verified" after cross-checking against the label image (which must be uploaded as a `label_nutrition` image)

**Only `verified` panels render publicly when adaptive rendering targets Case E or higher.** `complete` panels show in admin preview but not in production publish unless admin explicitly downgrades the gate.

---

## §10 Product images

### §10.1 Image schema (per `product_images` table)

```
id, product_id, variant_id (nullable), storage_path, public_url,
alt_text, kind, sort_order, is_primary, created_at
```

### §10.2 Image kinds

| Kind | Description | Required for what |
|---|---|---|
| `front` | Front-of-pack hero shot, ideally on a clean background | Required for MVP publish (the primary) |
| `label_nutrition` | Clear photo or scan of the nutrition / supplement facts panel | Required for `nutrition_panel` `verified` status |
| `label_ingredients` | Clear photo or scan of the ingredients list | Required for `ingredients` `verified` status |
| `angle` | Side or angled view | Optional |
| `open` | Product opened (e.g., showing scoop, capsule shape) | Optional |
| `lifestyle` | Product in use, branded photoshoot | Optional |

### §10.3 Rules

- Exactly one `is_primary=true` image per product (enforced by partial unique index).
- The `front` kind is typically the primary, but admin can set any kind as primary.
- `sort_order` controls gallery order on PDP.
- `alt_text` is required for accessibility — auto-generated as "[Product name] - [kind]" if admin doesn't override.
- Storage path convention: `products/{brand_slug}/{product_slug}/{auto-filename-with-hash}`.
- Thumbnails (400×400, 200×200) auto-generated server-side on upload.

---

## §11 Brand directory — tiers

Brands are tiered for how prominently they appear on the public site. The tier is **computed**, not admin-set, but admin can override.

| Tier | Computed when… | Where it shows |
|---|---|---|
| **Heavy** | Brand has ≥15 published products AND has both `logo_url` and `hero_image_url` AND has `long_description` ≥200 chars | Full brand landing page with hero, brand story, featured products rail. Eligible for "Featured Brand Strip" on homepage. |
| **Medium** | Brand has 5-14 published products AND has `logo_url` | Brand landing page with simpler layout, no hero. |
| **Light** | Brand has 1-4 published products OR is missing logo | Brand appears only in brand directory list. No dedicated landing page. |

### §11.1 Featured Brand Strip (homepage)

Maximum 2 active featured brands at any time. Admin selects from heavy-tier brands only. Enforced by partial unique index in admin.

---

## §12 Brand normalization

### §12.1 Why this exists

The MD source had ~52 raw brand spellings ("APPLED NUTRITION", "AN", "Applied Nutrition", etc.) for ~30 actual brands. The import script applies a normalization map; remaining unknowns get `needs_brand_review` flag and admin assigns canonically via the Brand Normalization Tool in the admin portal.

### §12.2 Canonical brand map (seed at M1)

The seed map below is loaded at M1. Admin extends it during enrichment as new raw spellings are encountered.

| Canonical brand | Slug | Common aliases (from MD) |
|---|---|---|
| Applied Nutrition | `applied-nutrition` | `APPLED NUTRITION`, `AN`, `APPLIED NUTRITION` |
| Athletic Nutrition | `athletic-nutrition` | `ATHLETIC NUTRITION`, `AN ATHLETIC` |
| Big and Fit | `big-and-fit` | `BIG AND FIT`, `BIG & FIT`, `B&F` |
| BiotechUSA | `biotech-usa` | `BIOTECH USA`, `BIOTECHUSA`, `BIO TECH USA` |
| BPI Sports | `bpi-sports` | `BPI`, `BPI SPORTS` |
| BSN | `bsn` | `BSN` |
| Cellucor | `cellucor` | `CELLUCOR`, `C4` |
| Dymatize | `dymatize` | `DYMATIZE`, `DYMA` |
| EAS | `eas` | `EAS` |
| Evogen | `evogen` | `EVOGEN` |
| Gaspari Nutrition | `gaspari-nutrition` | `GASPARI`, `GASPARI NUTRITION` |
| GAT Sport | `gat-sport` | `GAT`, `GAT SPORT` |
| Hi-Tech Pharmaceuticals | `hi-tech-pharmaceuticals` | `HI-TECH`, `HITECH`, `HI TECH PHARMA` |
| Hydroxycut | `hydroxycut` | `HYDROXYCUT`, `MUSCLETECH HYDROXYCUT` |
| Insane Labz | `insane-labz` | `INSANE LABZ`, `INSANE` |
| iSatori | `isatori` | `ISATORI` |
| Kevin Levrone | `kevin-levrone` | `KEVIN LEVRONE`, `LEVRONE` |
| MHP | `mhp` | `MHP` |
| MuscleMeds | `musclemeds` | `MUSCLE MEDS`, `MUSCLEMEDS` |
| MuscleTech | `muscletech` | `MUSCLETECH`, `MUSCLE TECH` |
| Mutant | `mutant` | `MUTANT` |
| Nutrex | `nutrex` | `NUTREX`, `NUTREX RESEARCH` |
| Optimum Nutrition | `optimum-nutrition` | `OPTIMUM NUTRITION`, `ON`, `OPTIMUM` |
| QNT | `qnt` | `QNT` |
| Redcon1 | `redcon1` | `REDCON1`, `REDCON 1`, `RED CON 1` |
| Rule 1 Proteins | `rule-1-proteins` | `RULE 1`, `R1`, `RULE ONE` |
| Scitec Nutrition | `scitec-nutrition` | `SCITEC`, `SCITEC NUTRITION` |
| SuperHuman | `superhuman` | `SUPERHUMAN`, `SUPER HUMAN` |
| Universal Nutrition | `universal-nutrition` | `UNIVERSAL`, `UNIVERSAL NUTRITION` |
| USPlabs | `usplabs` | `USPLABS`, `USP LABS` |

**Open list.** Final canonical brand count is determined by M1 import results. Admin adds new brands as discovered.

### §12.3 Pseudo-brand handling

Some MD source rows have non-brand values in the brand column (e.g., "SNACKS"). The import flags these with `needs_brand_review=true` and an admin must either:
- Create a new canonical brand (e.g., the snack manufacturer if identifiable)
- Mark as "ignore — not a brand" (sets `brand_id=null` and the product won't pass publish gate until brand is assigned)

---

## §13 Categories

### §13.1 Plan v2 public taxonomy (16 categories, locked for MVP)

Organized under three navigation groups:

**Sport Nutrition** (8 categories)
- Proteins
- Mass Gainers
- Pre-Workouts
- Creatine
- Amino Acids
- Performance Enhancers
- Post-Workout Recovery
- Weight Management

**Health & Wellness** (5 categories)
- Vitamins & Minerals
- Wellness & Daily Health
- Immunity Support
- Hormonal & Anti-Aging Support
- Specialized Health

**Snacks & Drinks** (3 categories)
- Healthy Snacks
- Protein Bars
- Functional Drinks

### §13.2 Category page structure

Each category has:
- `name`, `slug`, `parent_nav` (one of three nav groups)
- `subcategories[]` — optional sub-taxonomy strings for filter chips
- `supported_goals[]` — which of the 5 Plan v2 goals can be used as filters here
- `listing_copy` — short intro for the category landing page (1-2 paragraphs)
- `seo_title`, `seo_description`
- `is_visible` toggle
- `sort_order`

### §13.3 MD → public mapping (seed at M1)

The 15 MD source categories map to public taxonomy via `md_category_mapping` table:

| MD source category | Default public category | Requires split? | Notes |
|---|---|---|---|
| Proteins & Mass Gainers | Proteins (default) / Mass Gainers (when name contains "GAINER") | **Yes** | Import script auto-splits; admin reviews |
| Pre Workout / Pre-Workout | Pre-Workouts | No | |
| Creatine | Creatine | No | |
| Amino Acids / BCAAs / EAAs | Amino Acids | No | |
| Test Boosters | Hormonal & Anti-Aging Support | No | |
| Fat Burners / Weight Loss | Weight Management | No | |
| Recovery | Post-Workout Recovery | No | |
| Vitamins | Vitamins & Minerals | No | |
| Daily Health / Wellness | Wellness & Daily Health | No | |
| Immunity | Immunity Support | No | |
| Anti-Aging / Hormones | Hormonal & Anti-Aging Support | No | |
| Specialized / Other Health | Specialized Health | No | |
| Snacks | Healthy Snacks (default) / Protein Bars (when name contains "BAR") | **Yes** | |
| Drinks / Beverages | Functional Drinks | No | |
| Uncategorized / Misc | (no default — flagged for review) | **Yes** | ~36 products land here; admin assigns manually |

Auto-split rules embedded in the import script. Anything unmappable gets `needs_category_review=true`.

---

## §14 Subcategories

Subcategories are **string tags within a category** for filter chips, not separate taxonomy rows. Stored on `categories.subcategories[]` array.

Examples:
- Proteins: `["Whey Concentrate", "Whey Isolate", "Whey Hydrolysate", "Casein", "Plant-Based", "Beef Protein", "Egg White"]`
- Mass Gainers: `["Lean Gainer", "Heavy Gainer", "Vegan Gainer"]`
- Pre-Workouts: `["Stim", "Non-Stim", "High-Stim", "Pump"]`

The import script does not assign subcategories. Admin assigns during enrichment.

---

## §15 Goals (Plan v2 — 5 goals)

| Tag | Display name | Description |
|---|---|---|
| `build_muscle` | Build Muscle | Higher protein, creatine, mass gainers, recovery |
| `boost_energy` | Boost Energy | Pre-workouts, caffeine, energy drinks, B-vitamins |
| `recovery` | Recovery | BCAAs, EAAs, post-workout, glutamine, joint support |
| `weight_management` | Weight Management | Fat burners, low-cal proteins, appetite control |
| `endurance` | Endurance | Carbs, electrolytes, beta-alanine, cardio support |

A product can have multiple goal tags. One goal can be marked `is_primary=true` per product (used for the "primary goal" pill on PDP and listing cards).

Goal pages (`/goal/[tag]`) are first-class destinations on the homepage.

---

## §16 Variants — flavor × size

Variants represent purchasable SKUs. A product has 1..N variants.

### §16.1 Variant fields (per `product_variants` table)

```
id, product_id, flavor, size, sku, barcode, price_aed,
in_stock, stock_quantity, low_stock_threshold, weight_grams, sort_order
```

### §16.2 Rules

- Every product has at least one variant (a "default" variant if the product has no real variations).
- `(product_id, flavor, size)` is unique.
- `price_aed` is per-variant (variants can differ in price).
- `weight_grams` informs shipping cost computation per `DELIVERY_SPEC.md`.
- `low_stock_threshold` (default 5) is the threshold below which the admin gets a low-stock alert.
- `sort_order` controls variant selector order on PDP.

### §16.3 Variant display on PDP

If a product has multiple flavors: flavor selector chips above size selector.
If a product has multiple sizes: size selector chips with price per size.
If a product has only one variant: no selector — variant inferred.

---

## §17 Pricing rules

### §17.1 Three price fields

| Field | Purpose | Public visible? |
|---|---|---|
| `retail_price_aed` | Default public list price (whole AED integer). Stored on `products` for filtering; per-variant `price_aed` overrides on actual purchase. | Yes |
| `wholesale_price_internal` | Internal cost basis. Used for margin tracking only. | **No — never** (column REVOKE, repository exclusion, code review) |
| `compare_at_price_aed` | Optional. When set and > retail, shows as struck-through "was AED X" on PDP. | Yes |

### §17.2 Rules

- All money is **whole AED integers**. No fractional money anywhere in the database.
- VAT (5%) is **inclusive** — `retail_price_aed` already includes VAT. The breakdown (net + VAT) is computed at checkout per `src/lib/money/vat.ts`.
- `compare_at_price_aed` is admin-entered, never computed. No fake "was AED X" pricing.
- If `retail_price_aed` is null/missing, product cannot publish.

### §17.3 Free delivery threshold

Per Plan v2 and `DELIVERY_SPEC.md` §10: free Standard delivery on orders with subtotal ≥ AED 200. This is shipping logic, not product pricing, but products show "Free delivery on orders AED 200+" trust line on PDP.

---

## §18 Case-pack products

~140 products in the MD source are case-packs — bulk wholesale SKUs not intended for retail sale.

### §18.1 Detection

Import script flags `is_case_pack=true` (stored in `admin_review_flags.case_pack`) when source name matches any of:
- `(N/CASE)` where N is 2-12
- `(N/C)` where N is 2-12
- `N/CASE` without parens
- Names containing `CASE PACK`

### §18.2 Rule

**Case-pack products are never publicly visible at MVP.** Even if admin manually flips `is_public_visible=true`, the public catalog filter excludes them (`admin_review_flags.case_pack=false` is a query predicate on public reads).

The case-pack flag can be dismissed by admin only after manually splitting the case-pack into individual retail SKUs (a Phase 2 admin tool).

---

## §19 Discontinued candidates

Some products will be discontinued by the manufacturer. Admin marks these as `status='archived'`.

Rules:
- Archived products are not publicly visible.
- Archived products retain all data for traceability.
- Archived products do not appear in admin product list by default — admin must toggle "Show archived."
- Archived products with non-zero stock_quantity surface a warning to admin (don't archive sellable inventory).
- Archived products with existing orders retain order linkage (orders reference the archived product_id).

---

## §20 SEO fields

Per product:
- `content.seo_title` — recommended 50-60 chars, auto-suggested as "{Name} — {Brand} | Vitaminaty"
- `content.seo_description` — recommended 150-160 chars

If `seo_title` or `seo_description` is `missing`, the public page falls back to a derived default. **Missing SEO never blocks publish** but is part of Tier 3 quality gate.

Per brand:
- `seo_title`, `seo_description` on brand landing pages

Per category:
- `seo_title`, `seo_description` on category landing pages

---

## §21 Cross-sell — "Often Bought With"

### §21.1 Field

`content.often_bought_with_ids[]` — array of product UUIDs, max 3, ordered.

### §21.2 Rules

- Admin-curated only at MVP. No auto-suggestion algorithm.
- Referenced products must be `is_public_visible=true`. If a referenced product is unpublished or archived, the PDP silently drops it from the rail.
- Section renders when ≥1 valid product remains (per §6 adaptive rendering rules).

### §21.3 "You May Also Like" (separate, auto)

Auto-computed from same category. Shows up to 4 same-category published products excluding the current one. No admin curation.

---

## §22 Completion score

Per product, `completion_score` is an integer 0-100 stored in the `products.completion_score` column. Recomputed on every save.

### §22.1 Formula

```
score =   (count of Tier 1 fields in 'complete' state × 5)   // max 30 from 6 Tier 1 fields
        + (count of Tier 2 fields in 'complete' state × 6)   // max 36 from 6 Tier 2 fields
        + (count of Tier 3 fields in 'complete' or 'verified' state × 3)  // max 39 from 13 Tier 3 fields
        - (number of active admin_review_flags × 5)          // penalize unresolved flags
```

Clamped to `[0, 100]`. (The raw max sums to 105 but is clamped; penalty pushes problematic products down.)

### §22.2 Usage

- Admin product list shows score as a progress bar per row.
- Admin can sort by `completion_score ASC` to see what needs work.
- Score is **not shown publicly** — internal only.
- Score informs `featured_score` (a separate field) which can be admin-overridden for homepage curation.

---

## §23 Admin filters & bulk operations

Per `ADMIN_PORTAL_SPEC.md` §5.1, the admin product list supports these filters. Listed here for content-model consistency:

### §23.1 Filters

- **Status** (single-select): All / Imported / Draft / Partial / Ready to publish / Published / Hidden / Archived
- **Review flags** (multi-select chips): missing_price, missing_image, case_pack, duplicate_suspected, multiple_price_pairs, needs_category_review, needs_brand_review, needs_label_data
- **Brand** (dropdown of canonical brands)
- **Category** (dropdown of 16 Plan v2 categories)
- **Goal** (multi-select from 5 goals)
- **Form** (multi-select from 8 forms)
- **Completion score range** (slider 0-100)
- **Has primary image?** (yes/no)
- **Source category** (dropdown of 15 MD categories — useful for "what came from which Excel category")
- **Free-text search** on `name`, `name_raw`, `brand_raw`, `sku`

### §23.2 Bulk operations

- Assign category to selected
- Assign brand to selected
- Set price for selected (same price for all)
- Add/remove goal tag from selected
- Bulk publish (each must pass MVP gate individually; admin sees which fail)
- Bulk archive
- Bulk dismiss a review flag
- Export selected to CSV

All bulk operations are audit-logged with the selection size.

---

## §24 Safety rules — non-negotiable

Restating §2 with operational specifics. Violations are treated as bugs even if functionally "harmless."

1. **No fake supplement facts.** `nutrition_panel` content is only what admin entered after seeing the label. No defaults, no templates, no "common values for whey protein."
2. **No fake reviews.** Reviews section shows an "empty state" at MVP. No seeded reviews, no AI-generated reviews, no imported reviews.
3. **No fake discounts.** `compare_at_price_aed` only when admin sets it deliberately. No automatic inflation to make discounts look bigger.
4. **No medical claims.** "Helps build muscle" is OK if the label says it. "Cures fatigue" is never OK. Admin training and PDP copy review enforce.
5. **No wholesale price leakage.** `wholesale_price_internal` enforced at three layers (DB column REVOKE, repository exclusion, code review).
6. **Case-pack products never visible publicly.** Hard-coded predicate.
7. **No draft content goes live.** `draft` status fields never render publicly even if product is `published`.
8. **No published product without primary image.** MVP gate enforces.
9. **No published product without retail price.** MVP gate enforces.
10. **No published product with `needs_brand_review` or `needs_category_review`.** MVP gate enforces.
11. **No silent overwrites.** Every admin save writes to `audit_log` with the diff.

---

## §25 Source traceability

Permanent forensic-quality lineage on every product. Never deleted, never overwritten by enrichment.

| Field | Set when | Mutable? |
|---|---|---|
| `source_file` | Import | No |
| `source_row[]` | Import (multiple rows for merged duplicates) | No |
| `name_raw` | Import — exact Excel NAME column verbatim | No |
| `brand_raw` | Import — exact Excel Brand column verbatim | No |
| `source_category` | Import — one of 15 MD categories | No |
| `source_notes` | Import — exact MD Notes column verbatim | No |

If a product is re-imported (e.g., second MD file with corrections), the import script merges by `name_raw` + `brand_raw` and adds new `source_row` entries rather than replacing. Manual admin enrichment is preserved.

---

## §26 Slug rules

### §26.1 Generation

Slugs are auto-generated from `name` (the normalized display name) using:
```
slug = lowercase(name)
       .replace(/[^a-z0-9 ]/g, '')
       .replace(/\s+/g, '-')
       .replace(/^-+|-+$/g, '')
       .substring(0, 100)
```

Collisions resolved with `-2`, `-3`, etc. suffix.

### §26.2 Editing

Admin can edit the slug post-import. Editing the slug:
1. Writes the old slug to `slug_history` table (per `DB_SCHEMA.md`).
2. Sets the new slug as canonical.
3. Public routes serve 301 redirects from old slug → new slug.

This preserves SEO when admin renames products.

### §26.3 Reserved slugs

Cannot be used as product slugs (collide with other routes):
- `cart`, `checkout`, `account`, `admin`, `brands`, `categories`, `search`, `legal`, `api`, `sign-in`, `sign-up`

---

## §27 Image rules (additional)

### §27.1 Alt text generation

Auto-generated as: `"{normalized name} - {kind}"`
Example: `"Applied Nutrition Critical Whey 2KG White Chocolate Bueno - front"`

Admin can override.

### §27.2 Image file constraints

- Accepted formats: JPEG, PNG, WebP
- Maximum source size: 10 MB
- Recommended source dimensions: ≥1200×1200 (rendered down by Next/Image)
- Auto-generated thumbnails: 400×400, 200×200, 80×80 (for cart drawer)
- Storage path: `products/{brand_slug}/{product_slug}/{kind}-{hash}.{ext}`

### §27.3 Variant-specific images

An image can be tied to a variant via `variant_id` (nullable). When set:
- The image appears in the gallery only when that variant is selected.
- Variant-specific images take precedence over product-level images for that variant.

---

## §28 Update protocol

This document is a living spec. Changes follow this protocol:

| Change type | Process |
|---|---|
| New field added to product | Schema migration + update §5 fields_status keys + update §8 tier assignment + update DB_SCHEMA.md |
| New status added | Update §4 + update DB_SCHEMA.md ENUM + update ADMIN_PORTAL_SPEC.md |
| New review flag added | Update §5.4 + update DB_SCHEMA.md JSONB shape + update §23 filter list |
| New adaptive rendering case | Update §6 + update public PDP component |
| New canonical brand | Update §12.2 + insert into `brands` table |
| New category | Restricted to Phase 2 (16 categories locked for MVP) |
| New MD source category | Update §13.3 + insert into `md_category_mapping` |
| Publish gate change | Update §7 + update admin publish-gate validation logic + update `proj_spec.md` if it changes M2/M3 scope |

All changes increment the document version (v1.1 → v1.2). Major content-model changes (new statuses, gate changes) jump major (v1.x → v2.0).

---

_End of `PRODUCT_CONTENT_SPEC_v1.1_ADMIN_DRIVEN.md` v1.1. This document is the catalog content-model contract for Vitaminaty._
