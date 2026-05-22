# CONTEXT_EXPANSION_NOTES.md

**Project:** Vitaminaty
**Document version:** v1.0
**Document type:** Living acknowledged-unknowns document + verification checklist
**Author note:** This file was written from training-data knowledge (cutoff Jan 2026) without live web access. Every finding below is a **starting hypothesis**, not verified live truth. M5, M6, and M8 are required to re-verify and update this file before implementation.
**Update policy:** Whoever executes M5, M6, or M8 verifies each marked item against current official documentation and either confirms it (updating the confidence to `verified`) or corrects it (with source URL + date checked).

---

## 1. Why this document exists

The Spec Architect process Phase 2 calls for inline web lookups against official sources for Paymob, iCarry, and UAE PDPL specifics. Web search was unavailable in the spec-authoring session. Rather than block the master spec, we proceed with **disciplined assumptions** and require re-verification during the integration milestones.

This is appropriate because:

- Vendor APIs drift faster than spec documents. Even a "fresh" web lookup at spec time would be stale by the time the engineer implements it 4-6 weeks later.
- The adapter pattern (`PaymentAdapter`, `ShippingAdapter`) isolates Paymob/iCarry behind interfaces. The master spec defines the **interface contract** that's portable across whatever Paymob/iCarry actually offer; the milestones then map real APIs to that interface.
- Forcing verification at M5/M6 ensures the engineer reads the docs themselves rather than relying on potentially-stale spec content.

The risk we're accepting: the interface design in M0–M4 might assume a Paymob/iCarry capability that doesn't exist or has changed. If that happens, M5/M6 surfaces the discrepancy and the spec gets revised. Cost is moderate (1-2 days of rework) and acceptable.

---

## 2. Confidence rubric

Throughout this file each finding is tagged:

| Tag | Meaning |
|---|---|
| `confidence: high` | I'm confident this is correct as of training cutoff, but vendor docs may have changed. |
| `confidence: medium` | This is my working understanding, but I have less certainty. Could be wrong on details. |
| `confidence: low` | Educated inference. Treat as a hypothesis only. |
| `verified` | Confirmed against current official docs (set by M5/M6/M8 engineer when verified). |
| `verification_required_before_implementation: true` | Must be re-checked against live docs before any code depends on this. |
| `affected_milestone: M5 / M6 / M8` | Which milestone owns the re-verification. |

---

## 3. Paymob — Search 1

**Affected milestone:** M5 (real Paymob integration)
**All findings below: `verification_required_before_implementation: true`**

### 3.1 Auth flow

> **Hypothesis:** Paymob historically used a two-step auth: (1) POST `/auth/tokens` with `api_key` to receive an `auth_token`; (2) use `auth_token` in subsequent calls. Some newer "Unified API" / "Intention API" endpoints accept a single `Secret Key` in the `Authorization: Token {key}` header for the entire request lifecycle.
>
> **Confidence:** medium. Paymob has been migrating toward the Unified API over the past 2-3 years. Whether the legacy flow is deprecated or still recommended varies by region and account type.

**Verification action at M5:**

- [ ] Read current Paymob Accept API docs at `https://developers.paymob.com/`.
- [ ] Confirm which auth pattern is recommended for new UAE merchants in 2026.
- [ ] If two flows exist, default to whichever Paymob documents as preferred for new integrations.
- [ ] Update this file's §3.1 with `verified: true` + source URL + date.

### 3.2 Payment-intent / order flow

> **Hypothesis:** Standard Paymob Accept flow has three logical steps:
> 1. **Order registration** — create an `Order` representing the customer's intent, returning an `order_id`.
> 2. **Payment key request** — request a `payment_key` token scoped to the order + a specific `integration_id` (one per payment method: cards, Apple Pay, Tabby, Tamara).
> 3. **Customer payment** — redirect customer to Paymob's hosted iframe with the `payment_key`; iframe handles card capture (PCI-DSS compliance lives at Paymob).
>
> The newer Unified API consolidates these into a single "Intention" creation that returns a `client_secret` for the iframe.
>
> **Confidence:** medium-high on the legacy three-step pattern; medium on Unified API specifics.

**Verification action at M5:**

- [ ] Confirm three-step vs Unified API pattern currently recommended.
- [ ] Confirm the field names that go to `orders.payment_provider_order_id` (Paymob's order ID) and `orders.payment_provider_intent_id` (the payment_key or intention's client identifier).
- [ ] Verify whether multiple payment methods per order require multiple `payment_key` calls or a single Intention with multiple available methods.

### 3.3 Hosted checkout / iframe flow

> **Hypothesis:** Paymob provides a hosted iframe (`https://accept.paymob.com/api/acceptance/iframes/{iframe_id}?payment_token={payment_key}`) for card capture. Apple Pay typically uses Paymob's hosted button, not the iframe. Tabby and Tamara redirect off-site to their own checkout flows.
>
> **Confidence:** high on iframe for cards; medium on Apple Pay; medium on Tabby/Tamara redirect mechanics.

**Verification action at M5:**

- [ ] Confirm iframe URL pattern and iframe ID env var requirement.
- [ ] Confirm Apple Pay integration approach (web Apple Pay vs Paymob-hosted button).
- [ ] Confirm Tabby/Tamara whether they're separate integration IDs or routed through Paymob's BNPL aggregator.
- [ ] Verify whether Tabby and Tamara each require their own merchant accounts at the respective BNPL providers, or whether Paymob handles the merchant relationship.

### 3.4 Webhook / callback event types

> **Hypothesis:** Paymob fires HTTP callbacks ("Transaction Processed Callback") to a merchant-configured URL after payment events. Common event signals: `success: true/false`, `txn_response_code`, `is_refunded`, `is_voided`, `is_3d_secure`, `is_capture`. Refund events may come as separate `is_refund` callbacks.
>
> **Confidence:** medium.

**Verification action at M5:**

- [ ] Enumerate the full list of webhook event types Paymob currently sends.
- [ ] Confirm payload schema for each event type.
- [ ] Confirm what triggers each event (3DS challenge, refund, void, chargeback).
- [ ] Confirm whether Paymob supports webhook event versioning.

### 3.5 HMAC verification method

> **Hypothesis:** Paymob includes an `hmac` field (or sometimes header) on each webhook. The HMAC is computed by Paymob from a specific concatenation of webhook fields, signed with the merchant's `HMAC_SECRET`. The merchant must reconstruct the same concatenation and verify.
>
> The concatenation order is documented per event type and **must be exact**. Common SHA-512 hex digest.
>
> **Confidence:** high on existence of HMAC; medium on exact algorithm and field order (Paymob has changed this in the past).

**Verification action at M5:**

- [ ] Confirm hash algorithm (SHA-512 vs SHA-256 vs other).
- [ ] Document the exact field concatenation order **per webhook event type**.
- [ ] Confirm whether HMAC is in body or header.
- [ ] Confirm constant-time comparison requirement (it's a standard requirement; just verify Paymob's example does this).
- [ ] **HIGH_RIGOR cross-check**: an incorrect HMAC verification is a critical security flaw. The M5 implementation must include adversarial tests that fail on tampered payloads.

### 3.6 Required identifiers for reconciliation

> **Hypothesis:** The fields we must store on each `payment_event` for reconciliation:
> - `paymob_transaction_id` (primary key from Paymob's side)
> - `paymob_order_id` (Paymob's order, matches what we created in §3.2 step 1)
> - `paymob_integration_id` (which payment method was used)
> - `amount_cents` (returned by Paymob; cross-check against our `orders.total_aed`)
> - `currency` ("AED")
> - `txn_response_code` + `txn_response_message` (human-readable)
> - `is_3d_secure` (cards only)
> - `created_at` (Paymob's timestamp)
> - The raw payload JSON (for forensic recovery)
>
> **Confidence:** high on conceptual list; medium on exact field names.

**Verification action at M5:**

- [ ] Confirm exact field names from current Paymob webhook payload schemas.
- [ ] Confirm whether Paymob exposes a query API to fetch transaction state by ID (for reconciliation jobs).

### 3.7 Sandbox vs live mode

> **Hypothesis:** Paymob provides sandbox credentials separate from live. Sandbox integration IDs differ from live. Test cards documented on developer portal. Webhook configuration is per-environment (sandbox webhook URL → sandbox account; live webhook URL → live account).
>
> **Confidence:** high.

**Verification action at M5:**

- [ ] Obtain sandbox credentials for the Vitaminaty Paymob account.
- [ ] Confirm sandbox base URL (likely also `accept.paymob.com` with sandbox-specific integration IDs, but verify).
- [ ] Document the list of test cards (e.g., Mastercard 5111... for 3DS pass) in the M5 PR.

### 3.8 What we store vs never store

> **Hypothesis:**
>
> **Must store** (in `payment_events` and `orders`):
> - Paymob transaction ID, order ID, integration ID
> - Amount, currency, status, response code/message
> - Timestamp from Paymob
> - The raw JSON payload (forensic)
> - HMAC signature received (for audit, not for re-verification)
>
> **Must never store**:
> - **PAN (card number) in any form** — Paymob holds the card; we hold only the `card_subtype` (e.g., "MasterCard") and the masked last-4 (e.g., "•••• 4242") for display.
> - **CVV** — never seen, never touched.
> - **Expiry date** — same.
> - **Full card holder name** (we may have customer's name from registration, but never as captured at payment).
> - **3DS authentication data** (issuer secrets, OTP).
>
> **Tokenization**: If the customer chooses "save card for next time" (Phase 2 feature, not MVP), we store only Paymob's `payment_method_token` — never the underlying card. The token is what we send back to Paymob to charge again.
>
> **Confidence:** high. This is industry-standard PCI-DSS Level 4 merchant practice and Paymob's hosted iframe architecture exists specifically to keep us in scope-reduced PCI compliance.

**Verification action at M5:**

- [ ] Confirm what Paymob returns to us about the card (typically `card_subtype` + last4 only).
- [ ] Confirm Paymob's tokenization feature is supported on the UAE account and what the token format is.
- [ ] **HIGH_RIGOR cross-check**: any field appearing in webhook payloads that looks like PAN/CVV/expiry data triggers an audit-log-and-redact + alert.

---

## 4. iCarry — Search 2

**Affected milestone:** M6 (real iCarry integration)
**All findings below: `verification_required_before_implementation: true`**

### 4.1 Whether public REST API docs exist

> **Hypothesis:** iCarry is a UAE-based logistics aggregator. Their public-facing developer documentation is **less polished than Paymob's**. They may offer:
> - A REST API for shipment creation and tracking (likely available to merchant accounts via a developer portal)
> - A Shopify/WooCommerce plugin for non-technical merchants
> - Direct integrations with specific carriers (Aramex, DHL, Emirates Post, Fetchr, local couriers)
>
> Whether they publish Swagger/OpenAPI is unclear. Many UAE-region carriers do not.
>
> **Confidence:** low to medium. iCarry's public web presence has been more focused on merchant sales than developer documentation.

**Verification action at M6:**

- [ ] Visit `https://icarry.ae/` and locate the developer / API docs section.
- [ ] If no public docs, contact iCarry account manager for API documentation PDF or sandbox access.
- [ ] If no REST API at all, evaluate alternative paths:
  - Direct integration with Aramex / Emirates Post (each has documented REST APIs).
  - Use iCarry's manual order entry as fallback (admin team manually creates shipments via iCarry's web portal for each order — works for low volume).
  - Switch to a different aggregator (Shipox, Postaplus, etc. — each has tradeoffs).
- [ ] **Decision point for the engineer at M6**: if iCarry's API is workable, proceed with the adapter; if not, the `ShippingAdapter` interface stays in place and a different concrete implementation slots in. The spec's interface design **does not change** — only the concrete `icarry-adapter.ts` does.

### 4.2 Auth method

> **Hypothesis:** Likely an API key in a request header (`X-API-Key` or `Authorization: Bearer {key}`). Likely a single per-merchant API key, not OAuth.
>
> **Confidence:** medium.

**Verification action at M6:**

- [ ] Confirm exact auth header name and format.
- [ ] Confirm whether sandbox and live require separate keys.

### 4.3 Create shipment payload shape

> **Hypothesis:** Standard fields any shipping API requires:
> - Origin address (Vitaminaty warehouse)
> - Destination address (customer)
> - Package weight + dimensions
> - Declared value (for insurance)
> - Service level (Standard / Express / Same-Day)
> - Reference / merchant order ID
> - Customer contact phone (carriers require for delivery coordination)
>
> Optional:
> - COD amount (if cash on delivery)
> - Special instructions
>
> **Confidence:** high on the conceptual fields, low on iCarry's specific JSON shape.

**Verification action at M6:**

- [ ] Map iCarry's exact create-shipment payload schema.
- [ ] Confirm whether package weight/dimensions are required per item or per shipment.
- [ ] **Critical**: confirm COD handling — does iCarry handle COD collection from the carrier and remit to Vitaminaty? On what cycle? With what fee?

### 4.4 Quote / rate request support

> **Hypothesis:** Many UAE aggregators expose a rate-quote endpoint that returns shipping cost + ETA per service level for a given origin/destination/weight. iCarry may or may not.
>
> **Confidence:** low.

**Verification action at M6:**

- [ ] Determine whether iCarry has a rate quote API.
- [ ] If yes, integrate it so checkout can show real-time shipping cost (instead of the flat AED 20 / free-over-200 model).
- [ ] If no, keep the flat-rate model from the spec (Standard free over 200, AED 20 below; Express AED 30; Same-Day disabled).
- [ ] **Spec decision**: the master spec assumes flat-rate. If iCarry supports quotes and we want to use them, that's a v2 improvement, not an MVP blocker.

### 4.5 Tracking endpoint support

> **Hypothesis:** Standard pattern: shipment-created response includes a `tracking_number` and a `tracking_url`. A separate GET endpoint exposes status by tracking number or shipment ID.
>
> **Confidence:** medium-high.

**Verification action at M6:**

- [ ] Confirm tracking endpoint URL pattern.
- [ ] Confirm whether the public `tracking_url` is hosted by iCarry or by the underlying carrier (this affects what we show customers).
- [ ] Confirm whether tracking updates are pulled (we poll) or pushed (webhook).

### 4.6 Webhook / callback support

> **Hypothesis:** Likely yes — most modern logistics platforms emit webhooks for shipment events: `picked_up`, `in_transit`, `out_for_delivery`, `delivered`, `failed_delivery`, `returned`. Auth via webhook signature header.
>
> **Confidence:** medium.

**Verification action at M6:**

- [ ] Confirm webhook event types from iCarry.
- [ ] Confirm signature verification method (HMAC algorithm + header).
- [ ] If no webhook support, implement a polling job (every 15 minutes against active shipments) as fallback.

### 4.7 Shipment status values

> **Hypothesis:** Map to a canonical enum we control:
> - `created` — shipment booked, awaiting pickup
> - `picked_up` — courier collected from warehouse
> - `in_transit` — in carrier network
> - `out_for_delivery` — on the truck
> - `delivered` — confirmed delivered
> - `delivery_failed` — attempted but not delivered
> - `returned` — sent back to Vitaminaty
> - `cancelled`
>
> iCarry's actual values may differ. The adapter translates iCarry's vocabulary into ours.
>
> **Confidence:** high on the canonical set; iCarry's specific mapping is the unknown.

**Verification action at M6:**

- [ ] Get iCarry's exact status enum.
- [ ] Implement the translation table in `src/lib/icarry/icarry-adapter.ts`.

### 4.8 Label generation

> **Hypothesis:** Standard shipping platforms return a label PDF URL on shipment creation. iCarry likely does the same — but in many UAE aggregator workflows, the carrier prints the label at pickup and the merchant doesn't need to.
>
> **Confidence:** low to medium.

**Verification action at M6:**

- [ ] Confirm whether label generation is needed on our side or handled by iCarry/carrier.
- [ ] If label generation is required, plan UI for printing labels from the admin order detail page.

### 4.9 Minimum data needed from our order/address tables

> **Hypothesis (this we control regardless of iCarry's specifics):** what we hand iCarry is:
> - Customer name, phone, email
> - Full destination address (line 1, line 2, city, emirate)
> - Order ID (our reference)
> - Total weight (computed from line items; product-level `weight` field needed in DB)
> - Total declared value (= order subtotal in AED)
> - Service level (mapped from customer's selection)
> - COD flag + amount if payment method = COD
>
> **Confidence:** high.

**Spec impact:**
- Product schema needs a `weight_grams` field per variant (already present in `variants[].weight` per v1.1 §10.7, but make this required for production publish at Professional tier).
- Address schema needs phone field as required (also for SMS-based delivery coordination).
- Order schema needs a denormalized snapshot of the destination address at order creation (addresses can change later; the order's shipping address must be frozen at order time).

---

## 5. UAE PDPL retention — Search 3

**Affected milestone:** M8 (pre-launch legal review)
**Status:** Treat as **recommended policy pending legal/accounting confirmation**, not hard legal facts.

### 5.1 What we know

UAE Federal Decree-Law No. 45 of 2021 ("Personal Data Protection Law" / PDPL) provides the general framework:

- **Lawful processing** required (consent, contract, legal obligation, vital interests, public interest, legitimate interests).
- **Data subject rights** include access, correction, erasure, data portability, objection, withdrawal of consent.
- **Cross-border transfer** restrictions to non-adequate jurisdictions; transfers within Supabase EU regions are generally treated as adequate-equivalent under the law (verify with UAE Data Office guidance).
- **Breach notification** to the UAE Data Office (within a reasonable period — original draft said 72 hours; check whether final implementing regulations confirmed this).
- **Penalties** for non-compliance via administrative fines.

PDPL does **not specify** product-by-product retention periods. Those come from sectoral rules:

- **Commercial law / accounting**: UAE Federal Law No. 32 of 2021 (Commercial Companies Law) and tax law generally require accounting records (which include invoices, hence orders) to be kept for **5 years** for VAT purposes (UAE Federal Decree-Law No. 28 of 2022 / Tax Procedures Law). Some interpretations extend to 7 years for cautious practice.
- **Customer accounts**: no specific statutory retention; falls under PDPL's "purpose limitation" principle — keep only as long as needed for the original purpose.

### 5.2 What the THREAT_MODEL.md should say (corrected)

The original `THREAT_MODEL.md` v1.0 said "Order data retained 7 years (UAE commercial law)" — this is **overstated as a hard legal requirement**. Corrected version:

> **Retention policy (recommended — pending legal/accounting confirmation):**
>
> - **Order data**: retained for a minimum of **5 years** to satisfy UAE VAT and commercial accounting requirements (UAE Federal Decree-Law No. 28 of 2022). A more cautious **7 years** is common practice for UAE commercial entities and is recommended pending final legal confirmation. The retention window starts from the order date.
> - **Customer accounts**: active accounts retained indefinitely; **inactive accounts (no signin or order in 24 months) flagged for review** and may be purged after a further admin-approved review. This timing is a business policy, not a legal mandate.
> - **Marketing consent records**: retained alongside the customer record while the customer exists; if consent is withdrawn, the withdrawal event itself is logged and retained for at least 5 years as proof of compliance with withdrawal requests.
> - **Audit log**: retained indefinitely while the business operates (append-only). Audit log entries are not PII per se but may reference PII; treat as PII-adjacent.
> - **Payment events**: retained for at least 5 years for VAT and reconciliation.
> - **Anonymization on customer deletion**: when a customer requests deletion under PDPL Article 16, we zero out PII fields on the customer record but retain order line items with a `customer_id = null` reference + a `deleted_at` timestamp on the customer row. This preserves accounting integrity while honoring the erasure request.
>
> **All retention timings above are subject to legal review before launch. The M8 milestone includes a retention-policy sign-off step with a UAE-qualified legal advisor.**

### 5.3 Verification actions at M8

- [ ] Engage UAE legal counsel familiar with PDPL + VAT for retention review.
- [ ] Confirm 5-year vs 7-year order retention for our specific business model (e-commerce retailer).
- [ ] Confirm the deletion-vs-anonymization approach is PDPL-compliant.
- [ ] Confirm cross-border transfer documentation (Supabase EU region) is acceptable.
- [ ] Draft the Privacy Policy public page with the legally-reviewed retention statements (M8 deliverable).
- [ ] Confirm consent-capture UI satisfies PDPL Article 6 lawful-basis recording (timestamp, version of policy at time of consent, mechanism of consent).
- [ ] Confirm breach notification timeline against current PDPL implementing regulations.

### 5.4 What this means for the master spec

The master spec must:

- Define retention as policy-controlled (config table in admin portal), not hardcoded.
- Default values in M0 should match the §5.2 recommended policy, **clearly marked as pending legal review**.
- M8 must include a "legal review" checkpoint in its definition-of-done.
- Privacy Policy page text is a deliverable of M8 and pulls from the legally-approved retention policy.

---

## 6. Items that must be verified against current official docs before implementation

Consolidated checklist. M5/M6/M8 engineer signs each off with date + source URL:

### 6.1 Pre-M5 (Paymob) verification

- [ ] Paymob auth flow — legacy two-step vs Unified API recommendation (§3.1)
- [ ] Order/Intention creation API and required fields (§3.2)
- [ ] Hosted iframe / Apple Pay / Tabby / Tamara specifics (§3.3)
- [ ] Webhook event types and payload schemas (§3.4)
- [ ] HMAC algorithm, field order, header vs body, per-event-type (§3.5) — **HIGH_RIGOR cross-check required**
- [ ] Reconciliation identifier field names (§3.6)
- [ ] Sandbox setup and test card list (§3.7)
- [ ] Card tokenization mechanics if planning Phase 2 saved-card feature (§3.8)

### 6.2 Pre-M6 (iCarry) verification

- [ ] Public REST API existence + documentation source (§4.1) — **decision point: proceed with iCarry, switch to direct carrier integration, or use manual portal**
- [ ] Auth method (§4.2)
- [ ] Create-shipment payload (§4.3) — including COD handling
- [ ] Quote / rate API availability (§4.4)
- [ ] Tracking endpoint (§4.5)
- [ ] Webhook support + signature method (§4.6)
- [ ] Shipment status enum (§4.7)
- [ ] Label generation (§4.8)

### 6.3 Pre-M8 (legal) verification

- [ ] Order retention period (5 vs 7 years) (§5.1)
- [ ] Customer account retention policy (§5.2)
- [ ] PDPL deletion-vs-anonymization approach (§5.3)
- [ ] Cross-border transfer documentation (§5.3)
- [ ] Privacy Policy text with legal review (§5.4)
- [ ] Consent-capture UI compliance (§5.3)
- [ ] Breach notification timeline (§5.3)

---

## 7. Spec impact summary

This section lists the specific edits other spec files require because of Phase 2 findings. Apply these when M5/M6/M8 verifications complete.

### 7.1 `PAYMENT_SPEC.md` (to be authored in Phase 5)

Must include:

- A "verified against Paymob docs on YYYY-MM-DD by {engineer}" header that M5 fills in.
- Section labeling every Paymob-specific field with its verified payload schema (not the hypotheses above).
- HMAC verification implementation with **explicit adversarial test cases** (tampered payload, replayed payload, wrong algorithm, off-by-one field order).
- Sandbox vs live config flow.
- The "what we never store" PCI list (§3.8) as an explicit DO-NOT list with ESLint or runtime guardrails.

### 7.2 `DELIVERY_SPEC.md` (to be authored in Phase 5)

Must include:

- A "verified against iCarry docs on YYYY-MM-DD by {engineer}" header that M6 fills in.
- The decision the M6 engineer made about iCarry-vs-alternative (§4.1).
- Concrete shipment payload schema.
- COD handling: who collects, who remits, what cycle, what fee.
- Tracking polling vs webhook approach.
- Shipment status translation table.

### 7.3 `THREAT_MODEL.md` (already authored — needs edit)

Edits to apply now:

- §5.10 retention paragraph rewritten per §5.2 above. **Order retention "5 years minimum, 7 years recommended pending legal review"** instead of flat "7 years (UAE commercial law)".
- §5.10 customer inactive timeline updated to **24 months pending business decision** instead of 2 years stated definitively.
- §5.10 PDPL breach notification adjusted from "72 hours per PDPL Article 9" to **"per current PDPL implementing regulations — verify at M8"**.
- §6 (Known threats accepted as residual risk) — add a new row: "PDPL retention defaults applied before legal review at M8. Pre-launch legal sign-off required."

I'll apply these edits to `THREAT_MODEL.md` immediately after this file is presented.

### 7.4 `ENVIRONMENT_VARIABLES.md` (already authored — minor edit)

Edits to apply now:

- §2.3 Paymob — keep all variables but add a comment that the env var names assume the legacy three-step flow. If M5 verifies Unified API is preferred, some variables (e.g., separate integration IDs per payment method) may collapse into a single intent secret.
- §2.4 iCarry — keep all variables but add a comment that the var set assumes iCarry has a documented REST API. M6 decision may replace these with carrier-specific vars if pivoting away from iCarry.

I'll apply these edits immediately after this file is presented.

### 7.5 `proj_spec.md` (to be authored in Phase 5)

Must include:

- A "Phase 2 verification debt" subsection in the meta or open-questions area that links to this file.
- The milestone definitions for M5, M6, M8 must each include a "verification step" referencing this file.
- The cross-check requirements in M5 and M6 must include "verify CONTEXT_EXPANSION_NOTES.md hypothesis section and update with `verified` markers + source URLs + dates."

---

## 8. Living-document update policy

When an engineer executes M5, M6, or M8:

1. **Read this file completely** before starting implementation.
2. **Verify each hypothesis** in the relevant section against the current official docs.
3. **Update each verified item** by changing `confidence: medium` → `verified: YYYY-MM-DD by {name}` and adding the source URL.
4. **Correct any hypothesis that turned out to be wrong**: rewrite the section, note the correction in the §9 update log below, and update any downstream spec files (`PAYMENT_SPEC.md`, `DELIVERY_SPEC.md`, etc.) that depended on the wrong hypothesis.
5. **Commit the updated file** in the same PR as the implementation.

---

## 9. Update log

| Date | Author | Change |
|---|---|---|
| 2026-05-21 | Spec Architect | Initial seed — all findings hypothesis-only, verification debt logged. |

---

_End of `CONTEXT_EXPANSION_NOTES.md` v1.0._
