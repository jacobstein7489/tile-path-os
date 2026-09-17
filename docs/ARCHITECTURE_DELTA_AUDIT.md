# Cobblestone Tile OS — Final Architecture Delta Audit

Inspection of the live codebase and production database. No code changed in this pass.

## 1. CURRENT STATE (measured)

Database (live counts): 28 active projects, 17 rooms, 22 surfaces, 23 finish zones,
15 finish selections, 23 finish assignments, 19 active question rules, 2 design decisions,
79 readiness requirements, 156 unarchived work items, 1 installer package + 2 revisions,
11 material requirements, 1 PO, 2 receipts, 10 schedule assignments, 0 field reports, 0 project files.

114 Park Place (`11111111-1111-4111-8111-111111111111`): stage Setup, 2 rooms, 4 surfaces,
4 finish zones, 4 finish assignments, 27 readiness requirements, 21 open work items,
**0 design decisions, 0 installer package**. A QA clone (`9a9a9a9a-…0001`) exists with 1 package
and 47 requirements and is archived.

Existing tables cover every frozen concept: `projects`, `project_areas`, `project_surfaces`,
`finish_zone` / `finish_selection` / `finish_assignment`, `question_rule` / `design_decision` /
`design_meeting_session`, `readiness_requirement`, `work_items` / `work_item_events`,
`material_items` / `purchase_orders` / `po_lines` / `material_receipts`, `schedule_assignments` / `crews`,
`field_reports`, `project_files`, `installer_package` / `installer_package_revision`,
`companies` / `contacts` / `project_participants` / `project_assignments`, `profiles` / `user_roles`,
commissions tables.

Routes: 26 authenticated routes. Project screens exist for Overview, Rooms (`scope`), Tasks, Design,
Package, Tiles, Materials, Install Materials, Schedule, Field, Updates, Files.

RLS: enabled on all 32 public tables, 2–4 policies each, **zero anon policies** — everything is
role/assignment scoped via `has_role`, `can_access_project`, `can_edit_project`, `can_field_project`.

Conclusion: this is not a missing-system problem. The frozen architecture is ~90% present.
The delta is duplication cleanup, three thin capability gaps, and unexercised data on 114 Park Place.

## 2. KEEP (correct, leave alone)

- Physical hierarchy `projects → project_areas → project_surfaces` with `finish_zone` under surface.
- Reusable `finish_selection` (project-scoped product identity) + per-zone `finish_assignment`
  (layout facts). This is exactly the "one fact stored once" rule.
- Data-driven `question_rule` + allowlisted write targets in `src/lib/designmeeting.ts`
  (`TARGET_MAP`, `ruleApplies`, `useConfirmDecision`, `useMarkUnresolved`).
- Derived readiness: `src/lib/readiness.ts` + `readiness_requirement` keyed on
  `(project_id, scope_key, requirement_key)`, blocker-driven, no manual checklist.
- Work engine: `work_items` + append-only `work_item_events`, statuses To Do / Waiting / Scheduled / Done,
  Move Forward with follow-up resurfacing (`src/lib/workitems.ts`, `WorkItemDrawer`, `WorkList`).
- Installer package + immutable revisions (`src/lib/packages.ts`, `installer_package_revision`
  is INSERT/SELECT only), including `isPackageOutdated`.
- Procurement: `material_items` → `purchase_orders`/`po_lines` → append-only `material_receipts`.
- Field capture: `field_reports` + `FieldReportSheet`; `project_files` with real storage upload.
- Lifecycle: 7 controlled stages + On Hold / Cancelled in `src/lib/lifecycle.ts`, never auto-reversing.
- All RLS policies and helper functions. Nothing here needs loosening.
- Design system `src/components/kit.tsx`, `PageShell`, right-drawer/bottom-sheet pattern.

## 3. MODIFY

1. **Surface spec source of truth.** `project_surfaces` still carries ~18 flat spec columns
   (tile_sku, grout_color, joint_size, metal_profile, layout_pattern…) that now also live in
   `finish_selection` / `finish_assignment`. Keep the columns for legacy reads, but make
   selection/assignment the single write path and read-through everywhere (Rooms, Package, Readiness).
2. **Materials lifecycle vocabulary.** `material_items.status` should express
   NEED → CONFIRM DETAILS → ORDERED → WAITING/ETA → PARTIAL → RECEIVED → ON SITE → READY as one
   continuing record, with the actionable step surfaced as a Work Item instead of separate tasks.
3. **Readiness inputs.** Extend blockers to include material not-received and unresolved contractor
   dependency (today readiness is driven mostly by design/setup completeness).
4. **Installer package output.** Review → Publish exists; the printable sheet uses `window.print()`
   with no dedicated print stylesheet, and does not yet include niche/bench/curb/saddle grouping,
   photos, or actual tile dimensions in the room sheet.
5. **Global + project navigation.** Trim to Today / Work / Projects / Schedule / Materials / More and
   Overview / Rooms / Work / Files / More. Current project tab set is wider than the frozen spec.
6. **Geometry/measurement fields.** `surface_kind`, `uom`, `measured_*_in`, `geometry_ref`, `features`
   exist but are referenced by no UI. Keep the columns; expose measurement capture on the surface drawer
   so future layout-engine integration has data.
7. **Design meeting on 114 Park Place.** Rules and zones exist, but this project has zero decisions,
   so the chain has never been exercised on production data.

## 4. ADD (genuinely missing)

- Receipt detail fields: shade/lot, caliber, wrong-product quantity is present but no lot/shade/photo link;
  add `shade_lot`, `caliber`, `actual_tile_size`, `photo_file_id` on `material_receipts`.
- Print stylesheet + room-by-room printable package layout (jobsite-hangable).
- Room templates / duplicate-room quick add (Quick Add exists; template/duplicate does not).
- Plan linking beyond the current single `plan_file_id` per room: no per-surface plan link.
- Installer mobile read-only package view (current package route is office-oriented).

## 5. RETIRE (stop using; keep history)

- `src/components/LifecycleTrack.tsx` — imported nowhere; `ops/LifecycleRail.tsx` is canonical.
- Duplicate task UI: `src/components/ops/TaskDrawer.tsx` (394 lines) vs canonical
  `WorkItemDrawer.tsx` (536). Keep one.
- Duplicate capture UI: `QuickCapture.tsx` (1177), `ops/Capture.tsx` (339), `WorkItemDialogs.tsx` (303).
- Duplicate commissions screens: `commissions.tsx` and `leads.commissions.tsx`.
- Pre-award surface out of the frozen boundary: `leads.tsx`, `leads.index.tsx`, `leads.customers.tsx`
  (companies/contacts data stays; the leads pipeline screens leave navigation).
- QA clone project stays archived; never surfaced in normal lists.

## 6. SCHEMA DELTA (all additive, no drops, no renames)

1. `material_receipts`: add `shade_lot text`, `caliber text`, `actual_tile_size text`,
   `photo_file_id uuid references project_files(id)`.
2. `project_surfaces`: add `plan_file_id uuid`, `plan_page int`, `plan_location jsonb`
   (rooms already have these; surfaces do not).
3. `material_items`: add `on_site_qty numeric default 0` and a `work_item_id uuid` link so one
   requirement carries its current action instead of spawning tasks.
4. No other schema change is required. No table rename, no column drop, no type change.

## 7. UI / ROUTE DELTA

- Reuse as-is: `kit.tsx`, `PageShell`, `WorkList`, `WorkItemDrawer`, `LifecycleRail`, `FinishZones`,
  `PlanReference`, `ProjectStatusUpdateSheet`, `FieldReportSheet`, `MaterialDialogs`, `InlineEdit`,
  `OwnerPicker`, `DatePicker`, `GroupSection`, `Popover`.
- Modify: `projects.$projectId.tsx` (tab trim), `.scope.tsx` (surface measurement + duplicate room),
  `.package.tsx` (print layout + full room sheet), `.materials.tsx` / `materials.tsx` (one-record
  lifecycle), `AppSidebar.tsx` (nav trim).
- Truly new components: `PrintRoomSheet`, `RoomTemplatePicker`, `ReceiptDetailFields`,
  installer read-only package view.
- No new routes are required for Sprint 1.

## 8. SPRINT 1 BUILD ORDER (smallest safe)

1. Exercise and fix the existing chain on 114 Park Place: rooms → surfaces → one selection applied to
   multiple surfaces → design meeting → unresolved → Work → resolve → surface updates → readiness.
2. Make surface reads authoritative from selection/assignment everywhere the package and readiness use them.
3. Installer package: Review → Publish → revision → printable room sheet with print stylesheet.
4. Surface measurement fields exposed in the surface drawer (data only, no layout engine).
5. Navigation trim and retirement of the duplicate components listed in section 5.
6. Additive migration from section 6 (items 1–2 only if the receipt/plan work lands in this sprint).

## 9. SPRINT 1 DO-NOT-TOUCH LIST

RLS policies and helper functions; `auth`/`storage` schemas; procurement internals beyond the
lifecycle vocabulary; commissions logic; schedule internals; punch/return; existing 156 work items,
17 rooms, 22 surfaces, 23 assignments, 79 readiness rows; `installer_package_revision` immutability;
generated Supabase integration files; the archived QA clone.

## 10. 114 PARK PLACE ACCEPTANCE PLAN

Run all 20 listed steps against `11111111-1111-4111-8111-111111111111` in the real app, and prove with
before/after counts: rooms 2, surfaces 4, work items 21 at start; after the run, design decisions > 0,
exactly one unresolved Work Item reused (no duplicates), 1 installer package with revision 1,
readiness recomputed on stable keys, surfaces still 4, zones still 4, selections not duplicated.
Destructive or artificial variants run only on the archived QA clone.

## 11. RISKS / CONFLICTS FOUND

1. **Dual spec storage** (flat surface columns vs selection/assignment) is the single largest
   correctness risk — a stale flat column can contradict the published package.
2. **Design meeting never exercised on production**: 2 design decisions exist project-wide, both on the
   QA clone; 114 Park Place has none.
3. **No files and no field reports in production** — those paths are code-complete but unproven with data.
4. **Three overlapping capture UIs and two task drawers** invite divergent behavior.
5. **Leads/commissions screens sit outside the frozen boundary** but are still reachable in navigation.
6. **`window.print()` with no print stylesheet** will not produce a jobsite-quality sheet today.
7. Intermittent async React warning on rapid authenticated reloads (pre-existing, cosmetic).
