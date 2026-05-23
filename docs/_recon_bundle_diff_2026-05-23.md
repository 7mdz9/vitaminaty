# RECON DIFF — M1 spec-evolution bundle

Date: 2026-05-23

Bundle location: `M1-bundle/`

Live location: `docs/`

Scope: read-only recon of 8 bundle files against the live docs tree. No bundle content was applied.

## 1. INVENTORY_SPEC.md

FILE: `INVENTORY_SPEC.md`

STATUS: net-new

LIVE PATH: `docs/INVENTORY_SPEC.md` does not exist

LIVE FILE EXECUTION-ERA MARKERS PRESENT:
- Existing live file: no
- M1 ships / recovery entries: not applicable
- Bundle target sections already present live: no

BUNDLE EDITS:
- Adds canonical inventory tracking spec.
- Covers per-variant inventory model, `stock_status`, trigger-derived status, publish gate, inventory movements ledger, storefront display rules, checkout stock semantics, restoration triggers, and out-of-scope automation.

MERGE STRATEGY:
- Copy as-is into `docs/INVENTORY_SPEC.md`.

RISK NOTES:
- None from file collision. This file introduces cross-references that require the DB/API/Admin/Product/proj spec updates to land consistently.

## 2. M1_ADDENDUM_0012_PROMPT.md

FILE: `M1_ADDENDUM_0012_PROMPT.md`

STATUS: net-new

LIVE PATH: `docs/M1_ADDENDUM_0012_PROMPT.md` does not exist

LIVE FILE EXECUTION-ERA MARKERS PRESENT:
- Existing live file: no
- M1 ships / recovery entries: not applicable
- Bundle target sections already present live: no

BUNDLE EDITS:
- Adds the CODEX prompt for the M1 addendum migration `0012_inventory.sql`.
- Prompt is operational, not a durable product/spec artifact.

MERGE STRATEGY:
- Copy as-is into `docs/M1_ADDENDUM_0012_PROMPT.md`, or keep alongside docs as the next-step execution prompt.

RISK NOTES:
- None from file collision. Human should not treat this file as evidence that `0012_inventory.sql` already exists or ran.

## 3. ADMIN_PORTAL_SPEC.md

FILE: `ADMIN_PORTAL_SPEC.md`

STATUS: clean-apply

LIVE PATH: `docs/ADMIN_PORTAL_SPEC.md`

LIVE FILE EXECUTION-ERA MARKERS PRESENT:
- Live §10 is still `Homepage curation`: yes (`docs/ADMIN_PORTAL_SPEC.md:428`)
- Live file has inventory editing §10 already: no
- Live audit table has execution-era additions: no. Live table has the M1-kickoff rows only: 15 data rows plus header.
- Live numbering still matches M1-kickoff structure: yes (`§10 Homepage`, `§11 Audit log`, `§12 Settings`, `§13 Audit-logged events`, `§14 Phase 2`)

BUNDLE EDITS:
- §4 expands dashboard widgets with inventory, missing-data, operational alerts, admin progress.
- §5.1 adds missing stock quantity flag and stock-status filter chips.
- §5.2 adds Stock column and product side-drawer row behavior.
- §5.3 expands bulk operations with inventory actions, undo, audit logging, publish safeguards, and stock-adjust safeguards.
- Adds §§5.4-5.13 for spreadsheet quick edit, side drawer, queues, save-and-next, shortcuts, command bar, image upload, stale-data detection, composed filters, and progress.
- Adds new §10 Inventory editing surfaces, which renumbers live §10 Homepage to bundle §11 and downstream sections accordingly.
- Adds §12.1 audit-log diff view.
- Expands audit-logged events table with stock/variant/image/bulk/stale-save entries.
- Updates phase 2 list to clarify inventory automation/sync remains post-MVP while inventory tracking is MVP.

MERGE STRATEGY:
- Clean apply is acceptable because the live file still matches the M1-kickoff structure and has no M1 execution-era edits in the touched sections.
- Paste-overwrite is low risk for this file.

RISK NOTES:
- The prompt referred to “§14 audit table,” but live currently has audit-logged events at §13; the bundle renumbers it to §14 after inserting new §10 inventory surfaces.
- Bundle end marker changes document version to v1.1; that is expected.

## 4. DB_SCHEMA.md

FILE: `DB_SCHEMA.md`

STATUS: clean-apply

LIVE PATH: `docs/DB_SCHEMA.md`

LIVE FILE EXECUTION-ERA MARKERS PRESENT:
- Live §10 migration sequence mentions `0011_wholesale_revoke_writes.sql`: no
- Live §5.2 still has `in_stock boolean NOT NULL DEFAULT true`: yes (`docs/DB_SCHEMA.md:316`)
- Live has `stock_status` enum: no
- Live has `inventory_movement_reason` enum: no
- Live has `inventory_movements` table: no
- Live has §9.10 inventory RLS: no
- Live has execution-era dated notes in DB_SCHEMA touched sections: no

BUNDLE EDITS:
- §3 adds `stock_status` and `inventory_movement_reason` enum documentation for addendum migration 0012.
- §5.2 replaces `product_variants.in_stock` with trigger-computed `stock_status`, rewrites low-stock index, adds stock-status index and trigger/function.
- §8.4 adds `inventory_movements` append-only ledger table.
- §9.10 adds admin-read RLS posture for `inventory_movements`.
- §10 updates migration sequence with `0011_wholesale_revoke_writes.sql` and planned `0012_inventory.sql`.
- §11 adds inventory-related indexes.

MERGE STRATEGY:
- Clean apply is acceptable structurally because the live file has not received M1 execution-era DB_SCHEMA updates and still has the exact pre-addendum `in_stock` shape.
- After applying, verify §10 preserves both `0011_wholesale_revoke_writes.sql` and planned `0012_inventory.sql`.

RISK NOTES:
- The live DB_SCHEMA currently does not document 0011 even though the migration exists and passed Final Audit recovery. The bundle would correct this.
- This file describes a future schema mutation over already-imported products; the actual addendum must still be implemented and verified in migrations.

## 5. API_SPEC.md

FILE: `API_SPEC.md`

STATUS: clean-apply

LIVE PATH: `docs/API_SPEC.md`

LIVE FILE EXECUTION-ERA MARKERS PRESENT:
- Live §2.1 `revalidateCart` has inventory status concepts already: yes, basic stock state exists.
- Live §2.2 `placeOrder` server flow edited during M1 execution: no evidence found.
- Live §3.1 admin inventory endpoints already present: no
- Live execution-era markers in touched sections: no

BUNDLE EDITS:
- §2.1 expands `revalidateCart` response with `overall_status` and stock messaging semantics.
- §2.2 expands `placeOrder` flow to use `SELECT FOR UPDATE`, atomic stock decrement, trigger-driven `stock_status`, and `inventory_movements` insert inside the same transaction.
- §3.1 adds six admin inventory actions: `setVariantStock`, `adjustVariantStock`, `recountVariantStock`, `setVariantLowStockThreshold`, `bulkAdjustVariantStock`, `getInventoryHistory`.

MERGE STRATEGY:
- Clean apply is acceptable; live file appears to be M1-kickoff-era API planning content, not execution-updated content.

RISK NOTES:
- The API spec already had some stock wording; the bundle expands it into the new canonical inventory model.

## 6. proj_spec.md

FILE: `proj_spec.md`

STATUS: clean-apply

LIVE PATH: `docs/proj_spec.md`

LIVE FILE EXECUTION-ERA MARKERS PRESENT:
- Live §M1 has M1 SHIPPED entry: no
- Live §M1 has Final Audit recovery/0011 addendum note: no
- Live §3 still lists `Warehouse automation / inventory sync` as a broad MVP non-goal: yes
- Live §9 P8 still lists broad `Warehouse automation / inventory sync`: yes
- Execution-era content in live file touched sections: no

BUNDLE EDITS:
- §3 narrows the non-goal to warehouse automation/sync only; inventory tracking becomes MVP.
- §9 P8 expands the post-MVP boundary to exclude inventory tracking from the automation/sync non-goal.
- §M1 adds addendum migrations subsection for shipped 0011 and planned 0012.
- §M2 adds admin inventory editing UX scope.
- §M3 adds storefront stock display scope.
- §M4 adds atomic checkout decrement and inventory-movement transaction requirements.
- §M7 adds restoration flow scope for cancel/payment failure/refund-returned cases.

MERGE STRATEGY:
- Clean apply is acceptable structurally because live `proj_spec.md` does not contain M1 execution-era shipped content.

RISK NOTES:
- The bundle assumes M1 has shipped; live `PROJECT_STATE.md` still says “ready for M1 Final Audit rerun,” not shipped. This is a cross-file state issue, but it does not create a direct `proj_spec.md` merge conflict.

## 7. PRODUCT_CONTENT_SPEC_v1.1_ADMIN_DRIVEN.md

FILE: `PRODUCT_CONTENT_SPEC_v1.1_ADMIN_DRIVEN.md`

STATUS: requires-merge

LIVE PATH: `docs/PRODUCT_CONTENT_SPEC_v1.1_ADMIN_DRIVEN.md`

LIVE FILE EXECUTION-ERA MARKERS PRESENT:
- Live §3 updated during M1 Step 8 with actual import counts: yes (`787`, `55` raw spellings, `55` seeded canonical brands, `44` matched brands, `18` brand-null, `140`, `369`, `36`)
- Live §12.2 updated during M1 Step 8 recovery with 25 additional canonical brands: yes (`updated 2026-05-23 after Step 8 brand coverage recovery`)
- Bundle §3 does not carry those live count updates: yes, bundle is older in this section.
- Bundle §12.2 does not carry the live 55-brand map/update note: yes, bundle is older in this section.
- Bundle wants to modify §5.4, §22.1, §23.1: live has no execution-era edits in those specific sections beyond the Step 8-wide file changes elsewhere.

BUNDLE EDITS:
- §5.4 expands `admin_review_flags` from 8 flags to 9 by adding `missing_stock_quantity`.
- §22.1 updates completion-score penalty term for 9 flags / max 45 penalty.
- §23.1 adds `missing_stock_quantity` review flag filter and stock-status filter.

MERGE STRATEGY:
- Manual merge required.
- Apply only the bundle additions to live §5.4, §22.1, and §23.1.
- Preserve live §3 final M1 import counts and live §12.2 55-brand canonical map exactly.
- Do not paste-overwrite the whole file.

RISK NOTES:
- Whole-file overwrite would clobber the M1 Step 8 canonical counts and the meta-model-blessed 25-brand recovery work.

## 8. PROJECT_STATE.md

FILE: `PROJECT_STATE.md`

STATUS: requires-merge

LIVE PATH: `docs/PROJECT_STATE.md`

LIVE FILE EXECUTION-ERA MARKERS PRESENT:
- Live §1 has M1 execution-era description: yes
- Live §2 current milestone says M1 Final Audit recovery complete / ready for rerun: yes
- Live §3 has M1 execution patterns, including append-only event repos, RLS suite, local-only Supabase scripts, bundle secret scan, 0011 wholesale isolation: yes
- Live §5 file map includes M1 repositories, scripts, tests, migrations 0001-0011: yes
- Live §6 has M1 Step 3/8/7/0011 deviations and clearances: yes
- Live §9 HIGH_RIGOR surface updated for M1: yes
- Bundle contains literal meta-instruction note: yes (`Note for CODEX merging this edit into the live PROJECT_STATE.md...`)

BUNDLE EDITS:
- §2 adds spec evolution log subsection §2.1.
- §2.1 records the inventory scope expansion, files changed, migration routing for `0012_inventory.sql`, and resolved design questions Q1-Q13.
- Bundle wants milestone status to read M1 complete and next step as M1 addendum 0012 → M2.

MERGE STRATEGY:
- Manual merge required.
- Extract only the new §2.1 spec evolution log subsection from the bundle.
- Do not copy the literal “Note for CODEX merging this edit...” into live `PROJECT_STATE.md`; it is meta-instruction, not durable project content.
- Insert §2.1 alongside the existing live §2 milestone status.
- Preserve all live §1, §3, §5, §6, §9 execution-era content.
- Update live §2 milestone status only after the human/meta-model has actually marked M1 shipped. Recommended target wording from the bundle: `M1 — Data layer: COMPLETE (shipped 2026-05-23). Next milestone: M1 addendum migration 0012 (inventory tracking) → then M2 — Admin portal.`

RISK NOTES:
- Highest clobber risk in the bundle. Whole-file overwrite would erase M1 execution state, file map, deviations, HIGH_RIGOR surface, and 0011 recovery notes.
- Live `PROJECT_STATE.md` does not yet show “M1 ships”; it says ready for Final Audit rerun. The bundle assumes the ship line exists.

## Bundle-wide observations

- Cross-file consistency: `0012_inventory.sql` is referenced across `INVENTORY_SPEC.md`, `M1_ADDENDUM_0012_PROMPT.md`, `DB_SCHEMA.md`, `API_SPEC.md`, `proj_spec.md`, `PRODUCT_CONTENT_SPEC_v1.1_ADMIN_DRIVEN.md`, `ADMIN_PORTAL_SPEC.md`, and `PROJECT_STATE.md`. `DB_SCHEMA.md` should be the canonical numbering source: 0011 is shipped/recovery, 0012 is planned inventory addendum.
- Cross-file consistency: `missing_stock_quantity` appears in product content flags, admin filters/work queues, and the addendum prompt. It must be added without overwriting live Step 8 product-count and brand-map updates.
- Cross-file consistency: inventory movements are consistently described as append-only, admin-read, service-role-write, with no UPDATE/DELETE policies.
- Net-new files in bundle: `INVENTORY_SPEC.md`, `M1_ADDENDUM_0012_PROMPT.md`.
- Clean-apply files: `ADMIN_PORTAL_SPEC.md`, `DB_SCHEMA.md`, `API_SPEC.md`, `proj_spec.md`.
- Requires-merge files: `PRODUCT_CONTENT_SPEC_v1.1_ADMIN_DRIVEN.md`, `PROJECT_STATE.md`.
- No additional net-new files are expected from the spec bundle itself. The actual implementation step will add `supabase/migrations/0012_inventory.sql` and likely repository/tests files per the addendum prompt.

Summary recommendation:
- Copy net-new files as-is.
- Paste-overwrite clean-apply files only after human confirmation that no one edited those same docs after this recon.
- Manually merge `PRODUCT_CONTENT_SPEC_v1.1_ADMIN_DRIVEN.md` and `PROJECT_STATE.md` as targeted additions only.

HANDOFF

files_created: [`docs/_recon_bundle_diff_2026-05-23.md`]

files_modified: none

net_new_files_in_bundle: [`INVENTORY_SPEC.md`, `M1_ADDENDUM_0012_PROMPT.md`]

clean_apply_files: [`ADMIN_PORTAL_SPEC.md`, `DB_SCHEMA.md`, `API_SPEC.md`, `proj_spec.md`]

requires_merge_files: [`PRODUCT_CONTENT_SPEC_v1.1_ADMIN_DRIVEN.md`, `PROJECT_STATE.md`]

next_step: [human reviews report, applies clean-apply files, manually merges requires-merge files, then runs the M1_ADDENDUM_0012_PROMPT.md addendum step.]
