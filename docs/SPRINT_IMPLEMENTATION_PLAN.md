# Sprint Implementation Plan

Each sprint must end shippable: real data, no dead buttons, no clipped screens, on-system
visuals. No sprint starts before its predecessor's acceptance criteria pass.

## Recommended sequence (with deviations explained)

| Sprint | Name | Why here |
| --- | --- | --- |
| 0 | Architecture + audit | this document set |
| 1 | Design freeze, users/roles, company libraries, minimal lead intake, RLS | one visual system plus real people and data must exist before more screens |
| 2 | Company Work / My Work / Quick Capture / work-item engine v2 | the daily operating surface; delivers value immediately |
| 3 | **Project spine + Setup readiness + rules engine v1** (was Sprint 6) | *moved earlier* — readiness gating is the product's core promise and unblocks scheduling and materials; sales/takeoff can wait |
| 4 | Tiles & Finishes + product catalog (was 7) | *moved earlier* — needed for readiness to be truthful and for ordering |
| 5 | Install Materials, POs, receiving, delivery (was 8) | completes the readiness chain |
| 6 | Schedule + crews (was 9) | schedulability now means something |
| 7 | Field, visits, verifications, changes captured (was 10) | closes the loop on live jobs |
| 8 | Punch / Return / closeout (was 11) | |
| 9 | Full Sales / lead pipeline (was 3) | *moved later* — **minimal lead/job intake ships in Sprint 1** so the system is usable immediately; the pipeline, proposals and conversion tooling land here |
| 10 | Plans upload, revisions, scope builder (was 4) | heavy; valuable only once scope is central |
| 11 | Takeoff + Estimating tied to structured scope (was 5) | after plans |
| 12 | Commercial, contracts, changes, commissions (was 12) | |
| 13 | Reports (was 13) | needs mature data |
| 14 | Layout engine (was 14) | needs actual tile dimensions + verified field qty |
| 15 | Mobile Site Manager + full QA hardening (was 15) | continuous mobile checks earlier, dedicated sprint here |

Rationale for the biggest change: the original order builds Sales and Plans/Takeoff before the
operating core (readiness, materials, schedule, field). Operations is where the money leaks
today; sales and estimating are currently handled with existing tools and should be absorbed
once the spine is trustworthy.

---

## Sprint 1 — Foundation, design freeze, real people, minimal intake

**Design freeze first.** One production design system (DESIGN_SYSTEM_PLAN.md §7) is
implemented and every existing route migrated onto it before further screens exist.

Scope:
1. Design system: tokens, page shell, sidebar 248px, 64px header, tables, buttons, inputs,
   **searchable reusable selectors** (no repeated typing for people/companies/products),
   drawers/modals, lifecycle rail, status chips, progress, toasts, loading/error/empty states,
   click/hover/pressed/focus behaviour. Migrate existing routes; delete local styling.
2. Auth: email + Google, `profile` / `role` / `user_role` / `has_role()`, admin user
   management, **safe Admin bootstrap only** — all other internal users onboard via real
   invitation. No invented passwords, no shared accounts.
3. Libraries: real `company`, `contact`, `crew`; `project_participant` / `project_assignment`;
   backfill legacy owner/customer/supplier text into references. **Legacy columns retained as
   deprecated read-only rollback data — nothing dropped this sprint.**
4. Minimal New Lead / Job intake: address, customer/GC company, primary contact, salesperson,
   estimator, source, bid due, follow-up, notes, **plans/files upload** — so the company can
   start using the system immediately. Full Sales pipeline still lands in Sprint 9.
5. Commercial identity from day one: `salesperson_user_id`, `commission_user_id`,
   `commission_rule_id?` stored on the job (calculation stays in Sprint 12).
6. Project CRUD: New Project, Edit, Hold, Cancel, Lost, Archive, Delete — permission-gated
   and fully wired.
7. Nav rename to the final items; visible lifecycle set to the frozen 10 stages.
8. RLS cutover **table by table**, each with a lockout-safety test before the open policy is
   dropped: Admin, PM, Site Manager, Office Coordinator, and one unauthorized/non-assigned
   scenario, verifying allowed AND denied reads and writes.

Done when: one design system in use everywhere; no open `USING (true)` policies; every owner
is a real user; searchable selectors replace typing; lead intake with file upload works; no
dead controls; no clipped layouts at 1440x900 and 1280x800; full-row click targets everywhere.

## Sprint 2 — Work
Scope: work-item schema v2 (5 kinds, 5 statuses, subtype, links, real owner and
`waiting_on_user_id` / `waiting_on_contact_id` / `waiting_on_company_id`), workflow engine with
step metadata and data-driven advancement, Company Work + My Work views, Quick Capture with
project/contact matching and review, drawer v2 with history and attachments, undo-completion
standard, `/today` retired.
Done when: one record updates everywhere; GM sees all work; every row opens the drawer.

## Sprint 3 — Project spine, measurements, Setup, rules v1
Scope: area/surface normalization (surface_kind, uom), **`surface_measurement` (plan/field) +
`finish_zone` with one implicit default zone + `surface.governing_measurement_id`**, backfill
from `plan_qty`/`field_qty`, room-type + surface templates, rules/requirements/answers tables,
`evaluateRules`, `computeReadiness`, readiness categories on Overview with drill-in drawers,
10-stage lifecycle with derived gating, derived installation progress per quantity family plus
optional `installation_weight`, retire `stage_steps_done` usage.
Done when: readiness and progress are fully calculated (never editable) and every incomplete
category opens exactly what is missing.

## Sprint 4 — Tiles & Finishes (specification, then fulfillment)
Scope: manufacturer/collection/tile_product/finish_product catalog with actual manufactured
dimensions, `finish_selection` as **specification only** (Draft/Selected/Confirmed/Superseded),
`finish_requirement` per surface/zone for quantity and derived order state (**no `Installed`
state**), `finish_procurement_requirement` consolidating identical products across surfaces
into one order requirement, `finish_allocation` back to surfaces/zones, append-only
`finish_receipt` carrying shade/caliber and optional actual-dimension overrides, migration of
legacy surface spec columns (copy only), Tiles & Finishes tab, tile follow-up workflow,
selection completeness feeding readiness.

## Sprint 5 — Install Materials & commitments
Scope: install material catalog + coverage formulas, requirement derivation, on-hand check,
**generalized `commitment` / `commitment_line` (material / finish / labor / service)** migrated
from `purchase_orders` / `po_lines`, labor commitment path for return work (price → recorded
approval → labor PO → schedule), append-only receiving with damage handling, delivery to
project, Needs Attention view, readiness integration.

## Sprint 6 — Schedule & crews
Scope: crew capacity/lanes, area-level assignments, confirm/move states, Ready-to-Assign
driven by readiness, conflict and capacity warnings, schedule → work-item effects.

## Sprint 7 — Field
Scope: visits, checklists tied to work items, surface progress with qty, field verification
workflow, plan-vs-field variance → CHANGE candidates, photos.

## Sprint 8 — Punch / Return
Scope: punch capture by surface, return-work workflow end to end (installer, price, recorded
approval, labor commitment, schedule, perform, verify — the labor commitment mechanics are
pulled forward to Sprint 5), closeout gate, aging reports.

## Sprint 9 — Sales
Scope: lead capture, submission intake, pipeline board, proposal status, conversion into a
project without re-entry, salesperson ownership.

## Sprint 10 — Plans & Scope
Scope: plan set/revision upload to private storage, page thumbnails, current-revision control,
viewer, scale calibration, region drawing → area creation, revision-impact work items.

## Sprint 11 — Takeoff & Estimating
Scope: takeoff lines per surface, waste, pricing catalog, estimate versions and status,
proposal output, acceptance → Awarded, estimate lines traceable to surfaces.

## Sprint 12 — Commercial
Scope: contract values, change orders end to end, authorizations, billing milestones,
commission rules/entries, money-visibility permissions.

## Sprint 13 — Reports
Scope: readiness pipeline, throughput, punch aging, material spend and waste, crew
utilization, change-order capture rate; export.

## Sprint 14 — Layout engine
Scope: course/cut calculations from actual tile size + joint, start point and pattern
simulation per surface, cut-count and carton ordering output.

## Sprint 15 — Mobile & QA
Scope: mobile My Work / Field / receiving flows, offline-tolerant capture, performance
budget, accessibility pass, full regression, production hardening.

## Cross-sprint standing rules
- Every sprint: RLS review, empty/loading/error states, 1440×900 + 1280×800 visual check,
  no new hardcoded colors, no placeholder screens shipped.
- Every schema change: GRANTs + RLS + policies in the same migration; derived values never
  user-editable.
- Demo data is maintained as a realistic company dataset, refreshed each sprint.
