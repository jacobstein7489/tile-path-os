# Architecture Revision Pass (documentation only)

All 10 review corrections folded into the existing `docs/` set and the sprint plan. No code, no schema, no migrations.

## Documents to revise

| Doc | Change |
| --- | --- |
| `DATA_MODEL.md` | New/changed tables listed below; waiting-on company; measurements/zones; lot receipts; commitment model; commission identity |
| `TILES_AND_FINISHES_MODEL.md` | Split specification from fulfillment; lot/receipt-level shade, caliber, dimension overrides |
| `SCOPE_AND_PLANS_ARCHITECTURE.md` | Surface measurements (plan/field/governing) + finish zones; retire reliance on plan_qty/field_qty |
| `LIFECYCLE_AND_READINESS.md` | 10 visible stages per your wording; readiness requirements derived underneath; physical progress roll-up formula |
| `INSTALL_MATERIALS_MODEL.md` | Purchase orders generalized to commitments (material / labor / service) |
| `DESIGN_SYSTEM_PLAN.md` | Frozen token set + Sprint 1 acceptance checklist and no-local-style-drift rule |
| `SPRINT_IMPLEMENTATION_PLAN.md` | Minimal Lead Intake into Sprint 1; revised Sprint 1–5 scope |
| `MASTER_PRODUCT_ARCHITECTURE.md`, `SCREEN_MAP.md`, `WORK_ITEM_AND_WORKFLOW_ENGINE.md`, `CURRENT_APP_AUDIT.md`, `README.md` | Consistency edits (lifecycle wording, lead intake screen, waiting-on company, return-work purchase path) |

## Revised / new tables (documented, not created)

**Lead intake (early)**
- `project` gains: `source`, `bid_due_date`, `follow_up_on`, `salesperson_user_id`, `estimator_user_id`, `customer_company_id`, `gc_company_id`, `primary_contact_id`, `commission_user_id`, `commission_rule_id` (nullable ref, calculation later).
- `company`, `contact`, `file_object` needed in Sprint 1 so intake can attach plans/files immediately.

**Measurements and zones (new)**
- `surface_measurement`: surface_id, kind (`plan` / `field` / `governing`), width, height, length, area, uom, source (drawn/manual/imported/field), measured_by, measured_at, verified_by, verified_at, notes.
- `finish_zone`: surface_id, name, sort_order, share of surface (measurement ref or own measurement), notes. Selections may attach to a zone instead of the whole surface.
- `project_surfaces.plan_qty` / `field_qty` become derived read caches over measurements; layout math uses the governing measurement only.

**Finish specification vs fulfillment (split)**
- `finish_selection` (specification only): project/area/surface/zone, kind, product ref, layout pattern, direction, start point, joint, grout color, alignment, spec status (`Draft → Selected → Confirmed → Superseded`).
- `finish_requirement` (new, fulfillment): finish_selection_id, required_qty, uom, waste_pct, cartons_required, supplier_company_id, supplied_by (cobblestone/customer/GC/designer/tile store), expected_date, order_state (`Not Ordered → Ordered → Partially Received → Received → On Site → Installed`), on_site_qty, shortfall_qty, readiness flag.
- `finish_receipt` (new, append-only): finish_requirement_id, commitment/PO ref, receipt_date, qty good/damaged/wrong/missing, `shade_lot`, `caliber`, optional `actual_w_mm` / `actual_h_mm` / `thickness_mm` overrides, packing slip, received_by, photo, notes.
- `tile_product` keeps manufacturer spec **defaults** (nominal + actual size, joint, carton data); shade/caliber move to receipts, with any receipt-level dimension override winning for layout on that lot.

**Commitments (generalized POs)**
- `commitment` (replaces material-only `purchase_order`): kind (`material` / `finish` / `labor` / `service`), vendor_company_id, vendor_contact_id, project_id?, number, status (`Draft → Sent → Confirmed → Partial → Received/Performed → Closed → Cancelled`), value, expected_date, approved_by_user_id, approved_at.
- `commitment_line`: commitment_id, line kind, ref (`material_requirement_id` / `finish_requirement_id` / `work_item_id` for return-work labor), description, qty, uom, unit_cost, total.
- Return-work path documented end to end without waiting for the Commercial sprint: installer priced → price approved → labor commitment issued → scheduled → performed → verified.

**Waiting On**
- `work_item` gains `waiting_on_company_id`; exactly one of user / contact / company, with company meaning "the vendor as an organization".

**Physical progress (derived, never edited)**
```text
surface_progress = completed_governing_qty / governing_qty        (0 when governing_qty = 0)
area_progress    = Σ completed_governing_qty / Σ governing_qty    (over non-archived surfaces, same uom family)
project_progress = Σ completed_governing_qty / Σ governing_qty    (over all in-scope areas)
```
Quantity-weighted, never an average of percentages, never manually set. Mixed uom (sf/lf/ea) roll up in separate buckets and combine by estimated labor weight, documented explicitly.

## Visible lifecycle (frozen wording)

New Submission → Estimating → Proposal → Awarded → Setup → Ready → Scheduled → Installation → Closeout/Return → Complete. Exceptions: On Hold, Lost, Cancelled. All readiness categories sit underneath and complete from data; no manual step checkboxes anywhere.

## Revised Sprint 1–5 scope

**Sprint 1 — Foundation + Minimal Lead Intake.** Auth (email + Google), `profile`/`role`/`user_role`/`has_role`, companies/contacts/crews libraries, project assignments, RLS + GRANTs replacing all open policies, frozen design system with acceptance checklist and route migration onto the kit, and a working New Lead/Job intake form (address, customer/GC, contact, salesperson, estimator, source, bid due, follow-up, notes, plan/file upload) with the 10-stage rail visible from New Submission.

**Sprint 2 — Work.** Work-item schema v2 (5 kinds, 5 statuses, owner user, waiting-on user/contact/**company**), workflow engine with data-driven advancement, Company Work + My Work, Quick Capture, drawer v2 with history and attachments, undo-completion.

**Sprint 3 — Project spine, measurements, readiness, rules v1.** Areas/surfaces normalization, `surface_measurement` (plan/field/governing) and `finish_zone`, rules/requirements/answers tables, `evaluateRules` + `computeReadiness`, derived stage gating, progress roll-up formula implemented as the single source.

**Sprint 4 — Tiles & Finishes (specification + fulfillment).** Catalog with actual dimensions, `finish_selection` (spec) and `finish_requirement` (fulfillment) as separate models, `finish_receipt` with shade/caliber/dimension overrides, supplied-by handling, zone-level selections, completeness feeding readiness.

**Sprint 5 — Install Materials + Commitments.** Material catalog and coverage formulas, requirement derivation, on-hand check, generalized commitment builder covering material/finish/labor/service, append-only receiving with damage/wrong/missing handling, delivery, Needs Attention, and the return-work labor commitment path.

Sales (full pipeline) stays at Sprint 9 — intake earlier, pipeline later. Plans/Takeoff/Estimating stay at 10–11.

## Tradeoffs I'd flag

1. **Labor commitments in Sprint 5** pull a slice of commercial work forward. Worth it for return work, but installer pricing without contract/billing context means partial financial data until Sprint 12 — accepted deliberately.
2. **Zones plus three measurement kinds** is real complexity in Sprint 3. I'd default new surfaces to a single implicit zone and a single governing measurement so the simple case stays one-field simple; zones appear only when added.
3. **Mixed-uom progress** cannot be exact without labor weights. I'd ship sf-weighted roll-up first and show lf/ea buckets separately rather than invent a conversion factor.
4. **Keeping `plan_qty`/`field_qty` as derived caches** rather than dropping them — safer migration, but they must be documented as read-only or they'll drift.
