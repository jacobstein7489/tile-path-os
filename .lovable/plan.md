# Cobblestone Tile OS — Final Architecture Delta Audit (Revised)

Audit only. No code written. Boundary: Approved Project → Complete.
Revision incorporates the four required corrections: finish zones, no procurement redesign in Sprint 1, blocker-driven readiness, no fake production data — plus lightweight plan-assisted setup.

## 1. CURRENT — what genuinely exists and is production-connected

**Database (23 tables, real rows):** projects 29 (28 active), project_areas 15, project_surfaces 18, work_items 191 (154 unarchived), material_items 11, purchase_orders 1, po_lines, material_receipts 2, schedule_assignments 10, visit_checklist_items 5, crews 5, profiles 8, companies 16, contacts 0, field_reports 0, project_files 0, commission_plans 0, commission_payments 0, user_roles, project_assignments, project_participants, application_bootstrap.

**Live relationships:** projects → project_areas → project_surfaces; work_items → project/area/surface (+ waiting_on user/contact/company, source_field_report_id); material_items → project/area/surface; po_lines → purchase_orders + material_items; material_receipts → material_items + PO; schedule_assignments → project + crew; project_files → project/area/surface/field_report; field_reports → project + crew.

**Working today:** auth with 10 roles and per-project edit checks (`src/hooks/useAuth.ts`); work-item engine with events, optimistic save, 4-status mapping (`src/lib/workitems.ts`); Rooms/Surfaces editing incl. ~20 flat spec fields (`projects.$projectId.scope.tsx`); materials + PO + receiving flows (`MaterialDialogs.tsx`, `materials.tsx`); file upload to the `project-files` bucket with signed-URL viewing (`projects.$projectId.files.tsx`, `src/lib/fieldreports.ts`); daily updates (`FieldReportSheet.tsx`); bulk paste import (`QuickCapture.tsx`); schedule board.

**Not real despite appearing built:**
- `projects.readiness_pct` / `readiness_note` have **no writer anywhere** — read in 4 places, set by hand.
- `material_status` on projects duplicates what material_items already imply.
- 4 pre-award stages hold 14 imported stubs — outside the locked boundary.
- Design Meeting, Installer Package, finish zones/selections, and blocker-based readiness: **do not exist at all.**

## 2. Source of truth — existing vs proposed

| Concept | Existing | Proposed |
| --- | --- | --- |
| Project | `projects` (44 cols, mixes identity with denormalised status) | unchanged row; stage/readiness/material_status become derived, not typed-in |
| Room | `project_areas` | unchanged + plan page/location reference |
| Surface | `project_surfaces` (31 cols incl. all finish + layout data) | **the physical object**: geometry, measurements, waterproofing, prep. Flat spec columns stay for compatibility |
| Finish specification | flat columns on the surface | **`finish_zone` + `finish_selection`** — one default zone per surface, added zones only when a surface truly has multiple treatments; one selection may map to many surfaces/zones |
| Work | `work_items` + `work_item_events` | unchanged engine; follow-ups append events to the same item |
| Material | `material_items` split by `category` | **unchanged in Sprint 1**; procurement engine is Sprint 2 |
| Schedule | `schedule_assignments` | unchanged; assignment later gated on derived readiness |
| Files | `project_files` + `project-files` bucket | unchanged; plans, room links and installer packages all reference it |
| Updates | `field_reports` (+ photos as project_files) | unchanged |
| Readiness | manual `readiness_pct` | **named derived requirements/blockers** at surface → room → project; percentage is a secondary summary only |

## 3. Duplicate concepts already present

1. **Two work UIs** — `WorkList.tsx` + `WorkItemDrawer.tsx` (Today, Dashboard, project Tasks) vs `ops/TaskRow.tsx` + `ops/TaskDrawer.tsx` (`/work` only).
2. **Two lifecycle components rendered on the same screen** — `LifecycleTrack.tsx` and `ops/LifecycleRail.tsx` both in `projects.$projectId.tsx`.
3. **Two lifecycle vocabularies** — 10 stages in `src/lib/lifecycle.ts` vs the locked 7, plus `STAGE_SUB_WORKFLOWS` manual checkboxes competing with derived readiness.
4. **Three tile/material tabs on one project** — `tiles.tsx` (read-only mirror), `install-materials.tsx`, `materials.tsx`.
5. **Three work destinations** — `/today`, `/dashboard`, `/work`.
6. **Manual `stage_steps_done`** vs derived readiness.
7. Pre-award (`leads.*`) and Commissions sit outside the locked boundary.

## 4. KEEP (do not rewrite)

`work_items` / `work_item_events` engine and its 4 user-facing statuses; `project_areas` / `project_surfaces` hierarchy and every existing spec column; `material_items` / `purchase_orders` / `po_lines` / `material_receipts` **and their current behaviour**; `project_files` + storage + upload path; `field_reports`; `schedule_assignments` / `crews`; roles, RLS helper functions, project_assignments; `kit.tsx` design system; `WorkList` + `WorkItemDrawer`; `ops/Capture` + `CaptureProvider`; `ops/LifecycleRail`.

## 5. MODIFY (and exactly why)

| Item | Change | Why |
| --- | --- | --- |
| `src/lib/lifecycle.ts` | 7 operating stages (Approved → Setup → Ready → Scheduled → Installation → Punch/Return → Complete); retire `STAGE_SUB_WORKFLOWS` | current 10 include out-of-scope pre-award plus hand-ticked steps |
| Readiness | replaced by a derived blocker service; `readiness_pct` becomes a read-only secondary summary and is never hand-edited | today it is a hand-set number that misrepresents reality |
| `projects.material_status`, `stage_steps_done`, `next_move*` | stop writing; keep columns for history | duplicate facts already derivable |
| `project_surfaces` | remains the physical object; add measurement/geometry fields; flat finish columns kept read-compatible and backfilled into the default zone selection | preserves data for a later external layout engine (MeasureSquare) without building CAD |
| `project_areas` | add plan file/page/location reference | plan-assisted setup |
| `projects.$projectId.tsx` | one lifecycle component (Rail); tabs reduce to Overview / Rooms / Work / Files / More | two rails and 10 tabs today |
| `projects.$projectId.scope.tsx` | Rooms screen edits the physical surface and its zone selections in a right drawer (bottom sheet on mobile); zones hidden unless more than one exists | must not shift the user's position; simple jobs stay simple |
| `WorkItemDrawer` | follow-up appends an event to the same item rather than inviting a new task | prevents duplicate task-per-phone-call |
| `useAuth` permissions | add office-setup / design-meeting / publish-package capability checks | publishing a package needs a gate |

## 6. ADD (missing, required)

**Finish model (correction 1)**
- **`finish_zone`** — `surface_id`, `name`, `sort_order`, `is_default`, optional `measurement`/`geometry_ref`/`offset` jsonb. Every surface gets one implicit default zone; the UI never shows zone management until a second zone exists. Supports accent band, niche back vs sides, checkerboard, border/listello, partial-height, multiple products on one wall.
- **`finish_selection`** — `project_id`, `area_id`, `surface_id`, `zone_id`, product/tile reference or legacy values (tag, sku, size, finish, manufacturer, supplier), grout (manufacturer/colour), joint size, metal/trim profile, pattern, direction, start/alignment, tile height/termination/transition, `spec_status`, `revision_no`, `confirmed_at`, `confirmed_by`. A selection may be reused across multiple surfaces/zones.

**Design meeting**
- **`design_meeting_session`** (project, opened_by, opened_at, completed_at) and **`design_decision`** (session, surface_id, zone_id, question_key, prompt, answer_value, status unresolved/confirmed/deferred, work_item_id, decided_by, decided_at).
- **`question_rule`** — conditional catalogue (`applies_when` jsonb over surface kind, waterproofing, tile size, zone count), so only unresolved applicable questions appear.

**Installer package**
- **`installer_package`** + **`installer_package_revision`** (project, area, revision_no, published_at, published_by, snapshot jsonb of surface + zone + selection data, file ref) — publish/revision history, no silent overwrite after publication.

**Readiness (correction 3)**
- **`readiness_requirement`** — derived rows: `project_id`, `area_id`, `surface_id`, `category` (Room/Surface setup · Finish specification · Design decisions · Installer package · Material readiness · Site/dependency), `label`, `state` (met / blocked / not_evaluated), `work_item_id`, `computed_at`. Rendered as named blockers ("Master Bathroom — Not Ready · Niche treatment unresolved · Door saddle not confirmed"). Material readiness reports **not yet evaluated** in Sprint 1 rather than pretending.

**Plan-assisted setup (lightweight, no CAD, no recognition)**
- Open an attached plan PDF from `project_files`, pick a page, create/link a Room from that page, optionally pin or rough-outline where the room sits, then create its surfaces. The plan/page/location reference persists on the room for a future layout integration.

**Screens:** Office Setup checklist on Overview (with plan viewer), Smart Design Meeting flow (Room → Surface → Zone → Known info → Decisions needed → Confirm → Next), Review / Publish installer package, mobile + printable package by room.

## 7. Revised minimum safe schema delta (additive only)

1. `project_surfaces`: add `surface_kind`, `uom`, `measured_length_in`, `measured_width_in`, `measured_height_in`, `geometry_ref` jsonb, `features` jsonb. **No flat finish column is dropped or renamed.**
2. New `finish_zone`; new `finish_selection`. Backfill: for each of the 18 existing surfaces insert one `is_default` zone and one `finish_selection` carrying its current flat values (T-1/T-2/T-3 tags, sizes, layout direction, start point etc.). Existing columns remain readable.
3. New `design_meeting_session`, `design_decision`, `question_rule`.
4. New `installer_package`, `installer_package_revision`.
5. New `readiness_requirement`; `projects` gains `readiness_computed_at` (percentage stays as a derived display value only).
6. `project_areas`: add `plan_file_id`, `plan_page`, `plan_location` jsonb.
7. **Removed from Sprint 1 (was in the previous draft):** all `material_items` additions and any requirement-generation/procurement lifecycle change. Procurement architecture stays untouched and unlocked for Sprint 2.
8. Every new table ships GRANTs plus assignment-scoped RLS through the existing `can_access_project` / `can_edit_project` helpers. No drops, no renames, no data deletion, no re-seeding.

## 8. Sprint 1 implementation sequence

Sprint 1 ends at: Approved Project → Office Setup → Rooms/Surfaces → Finish Mapping → Smart Design Meeting → unresolved Work → Installer Package → Setup/Design Readiness.

1. Migrations from §7, with the zone/selection backfill verified row-by-row against the existing 18 surfaces.
2. Lifecycle reduced to 7 operating stages; one rail; project tabs Overview / Rooms / Work / Files / More.
3. Rooms screen: drawer-based editing of the physical surface plus its default zone selection; "Add finish zone" appears only when needed; selections reusable across surfaces.
4. Office Setup block on Overview: plan file present → page picked → rooms created/linked (optional pin) → surfaces created → known finishes mapped.
5. Smart Design Meeting: rule-driven conditional questions per surface/zone showing known information first; Confirm writes the zone selection; Unresolved creates or links exactly one work item.
6. Installer Package: publish a room package (mobile + print) from the same records; revision history; a later spec change requires revision 2.
7. Setup/Design readiness service producing named blockers by category; material readiness explicitly "not yet evaluated"; percentage read-only.
8. Retire the second work UI on `/work` in favour of `WorkList` / `WorkItemDrawer`.

## 9. Revised acceptance test — 114 Park Place (real data, no fabrication)

Reference project `11111111-…-111111111111`, stage Setup, 21 open work items, rooms Master Bathroom + Main Floor, surfaces Shower Floor / Shower Wall A / Niche / Main Floor Field, tile tags T-1/T-2/T-3, manufacturer "TBD", grout colour null, only Shower Wall A `detail_confirmed`.

Read-only and additive checks run against the real project. **Any destructive or artificial step runs on a temporary QA clone/snapshot of 114 Park Place, never the production row.** No manufacturer, grout, selection or decision is invented to make a test pass — genuinely unresolved values stay unresolved.

1. Project opens on the 7-stage rail at Setup; all 21 open work items, 4 surfaces, materials, receipts, schedule rows and history unchanged.
2. Attached plan file is visible in Office Setup and a page can be opened (project_files is empty today, so this is exercised by attaching a real plan or on the QA clone).
3. Each of the 4 surfaces shows exactly one default finish zone, invisible in the UI; its selection matches the pre-migration flat values.
4. The same selection maps to more than one surface (Shower Floor and Niche already share T-1) without duplicating the specification.
5. One complex surface (Shower Wall A) accepts an additional finish zone, and only then does zone management appear.
6. Design Meeting shows known information (layout direction, start point, waterproofing, tile tag/size) and asks only the genuinely unresolved applicable questions — grout colour and manufacturer; Shower Wall A asks fewer because it is already confirmed.
7. Leaving manufacturer unresolved creates exactly one work item; two vendor follow-ups add two events to that same item — no second task.
8. Confirming a decision becomes permanent surface/zone specification, visible in Rooms and in the package.
9. Publishing Master Bathroom generates revision 1 from those same records; a later spec change requires revision 2 and leaves revision 1 intact.
10. Setup/Design readiness recomputes and names its remaining blockers by category; material readiness reads "not yet evaluated"; the percentage cannot be edited by hand.
11. Final diff confirms no production row was deleted, reset or fabricated.

## 10. Sprint 1 will NOT touch

Procurement: material_items schema/behaviour, consolidated requirements, POs, allocations, receiving, on-site readiness (all Sprint 2). Leads / pre-award / estimating routes. Commissions and commission plans. `today.tsx` and `dashboard.tsx` layouts. Schedule board internals. PO builder and receiving dialogs. Bulk import. Any CAD, automatic plan recognition or layout rendering. MeasureSquare integration (evaluation only). Deletion of any production row, column or table.

## 11. RETIRE eventually (no data loss)

`ops/TaskRow.tsx` + `ops/TaskDrawer.tsx`; `LifecycleTrack.tsx` once the rail carries detail; `projects.$projectId.tiles.tsx` (read-only mirror of Rooms); `STAGE_SUB_WORKFLOWS` + `stage_steps_done` writes; `projects.material_status` / `next_move` / `next_move_owner` writes; the flat `project_surfaces` finish columns once zone selections are the read path; one of `/today` `/dashboard` `/work`; `visit_checklist_items` folded into Field/work items. Columns and rows stay in place for history.
