# Cobblestone Tile OS — Sprint 1 Plan & Schema Delta (Final)

Plan only. No code in this pass. Boundary: Approved Project → Complete.
Incorporates all corrections: reusable project-level finish selections with per-zone assignments, data-driven question rules, derived Office Setup summary, deterministic readiness recomputation, procurement untouched until Sprint 2, and production data protection.

## 1. CURRENT — what genuinely exists

**Database (23 tables, real rows):** projects 29 (28 active), project_areas 15, project_surfaces 18, work_items 191 (154 unarchived), material_items 11, purchase_orders 1, po_lines, material_receipts 2, schedule_assignments 10, visit_checklist_items 5, crews 5, profiles 8, companies 16, contacts 0, field_reports 0, project_files 0, commission_plans 0, commission_payments 0, user_roles, project_assignments, project_participants, application_bootstrap.

**Live relationships:** projects → project_areas → project_surfaces; work_items → project/area/surface (+ waiting_on user/contact/company, source_field_report_id); material_items → project/area/surface; po_lines → purchase_orders + material_items; material_receipts → material_items + PO; schedule_assignments → project + crew; project_files → project/area/surface/field_report; field_reports → project + crew.

**Working today:** 10-role auth with per-project edit checks; work-item engine with events and 4-status mapping; Rooms/Surfaces editing with ~20 flat spec fields (`scope.tsx`); materials + PO + receiving; file upload to the `project-files` bucket with signed URLs; daily field updates; bulk paste import; schedule board.

**Not real despite appearing built:** `readiness_pct` / `readiness_note` have no writer anywhere (hand-set); `projects.material_status` duplicates material_items; 4 pre-award stages hold 14 imported stubs outside the boundary; design meeting, installer package, finish zones/selections and blocker readiness do not exist at all.

## 2. Source of truth — existing vs proposed

| Concept | Existing | Proposed |
| --- | --- | --- |
| Project | `projects` (44 cols) | same row; stage/readiness/material_status become derived, never typed in |
| Room | `project_areas` | unchanged + plan file/page/location reference |
| Surface | `project_surfaces` | **the physical object**: geometry, measurements, waterproofing, prep, features. Flat finish columns kept for compatibility |
| Finish zone | — | `finish_zone` belongs to exactly one surface; every surface gets one implicit default zone; extra zones only when a surface truly has multiple treatments |
| Finish specification | flat surface columns | `finish_selection` — **project-level reusable product specification**, not owned by any surface or zone |
| Applied finish | — | `finish_assignment` — links one zone to one selection and carries the per-zone layout facts (pattern, direction, start/alignment, height/termination) |
| Work | `work_items` + `work_item_events` | unchanged engine; follow-ups append events to the same item |
| Material | `material_items` + POs + receipts | **unchanged in Sprint 1**; procurement engine is Sprint 2 |
| Schedule | `schedule_assignments` | unchanged; readiness gating comes later |
| Files | `project_files` + bucket | unchanged; plans, room links and installer packages reference it |
| Updates | `field_reports` | unchanged |
| Readiness | manual `readiness_pct` | named derived requirements/blockers with stable keys at surface → room → project; percentage is a secondary read-only summary |

## 3. Duplicate concepts already present

Two work UIs (`WorkList`/`WorkItemDrawer` vs `ops/TaskRow`/`ops/TaskDrawer` on `/work`); two lifecycle components rendered on the same project screen (`LifecycleTrack` + `ops/LifecycleRail`); two lifecycle vocabularies (10 stages vs the locked 7, plus `STAGE_SUB_WORKFLOWS`); three tile/material tabs (`tiles.tsx`, `install-materials.tsx`, `materials.tsx`); three work destinations (`/today`, `/dashboard`, `/work`); manual `stage_steps_done` vs derived readiness; pre-award and Commissions outside the boundary.

## 4. KEEP (do not rewrite)

Work engine and its 4 user-facing statuses; `project_areas`/`project_surfaces` hierarchy and every existing column; `material_items`/`purchase_orders`/`po_lines`/`material_receipts` **and their current behaviour**; `project_files` + storage + upload path; `field_reports`; `schedule_assignments`/`crews`; roles, RLS helpers, project_assignments; `kit.tsx`; `WorkList` + `WorkItemDrawer`; `ops/Capture` + `CaptureProvider`; `ops/LifecycleRail`.

## 5. MODIFY (and why)

| Item | Change | Why |
| --- | --- | --- |
| `src/lib/lifecycle.ts` | 7 operating stages (Approved → Setup → Ready → Scheduled → Installation → Punch/Return → Complete); retire `STAGE_SUB_WORKFLOWS` | current 10 include out-of-scope pre-award and hand-ticked steps |
| Readiness | derived blocker service with stable keys; `readiness_pct` becomes read-only secondary display | today it is a hand-set number that misrepresents reality |
| `projects.material_status`, `stage_steps_done`, `next_move*` | stop writing; keep columns for history | duplicate derivable facts |
| `project_surfaces` | stays the physical object; adds measurement/geometry/features; flat finish columns remain readable and are backfilled into selections/assignments | preserves data for a future external layout engine, no CAD built |
| `project_areas` | add plan file/page/location reference | plan-assisted setup |
| `projects.$projectId.tsx` | one lifecycle rail; tabs reduce to Overview / Rooms / Work / Files / More | two rails and 10 tabs today |
| `scope.tsx` → Rooms | right-drawer (mobile bottom-sheet) editing of the surface and its default zone assignment; zone controls appear only when a second zone exists | simple jobs stay simple; user position never shifts |
| `WorkItemDrawer` | follow-up appends an event to the same item | no duplicate task per phone call |
| `useAuth` | add office-setup / design-meeting / publish-package capability checks | publishing needs a gate |

## 6. ADD

### 6.1 Finish model (three tables, no conflict)

- **`finish_zone`** — `surface_id`, `name`, `sort_order`, `is_default`, optional `measurement`/`geometry_ref`/`offset` jsonb. Exactly one surface per zone. Every surface gets one default zone, invisible in the UI until a second zone exists. Supports accent band, niche back vs sides, checkerboard, border/listello, partial-height, multiple products on one wall.
- **`finish_selection`** — **project-scoped, reusable, not owned by a surface or zone**: `project_id`, `label` (e.g. "T17 Calacatta"), tile/product ref, tag, manufacturer, sku, size, finish, supplier, supplied_by, grout manufacturer/colour, joint size, metal/trim profile, `spec_status`, `revision_no`, `confirmed_at`, `confirmed_by`.
- **`finish_assignment`** — `zone_id`, `finish_selection_id`, `pattern`, `direction`, `start_alignment`, `height_termination`, `coverage`, `sort_order`. One selection can serve Shower Wall A/B/C and the Niche while Wall A and Wall B keep different directions and start points.

### 6.2 Design meeting, data-driven

- **`design_meeting_session`** — project, opened_by, opened_at, completed_at.
- **`design_decision`** — session, surface_id, zone_id, question_key, answer_value, status (unresolved / confirmed / deferred), work_item_id, decided_by, decided_at. Confirming always writes through to the real field; `design_decision` is a log, never the source of truth.
- **`question_rule`** — `key`, `prompt`, `scope` (project/room/surface/zone), `applies_to_surface_types`, `applies_when` jsonb, `answer_type` (choice/text/number/boolean/product_ref), `options` jsonb, `target_entity` + `target_field` or `write_handler`, `required_for_readiness` bool + `readiness_category`, `sort_order`, `is_active`. Examples: `layout_direction` → choice Vertical/Horizontal → writes `finish_assignment.direction`; `niche_treatment` → applies only when surface features indicate a niche. No hard-coded question logic in the frontend.

### 6.3 Installer package

- **`installer_package`** + **`installer_package_revision`** — project, area, revision_no, published_at, published_by, immutable snapshot jsonb of surface + zone + assignment + selection data, file ref. Publish/revision history; no silent overwrite after publication.

### 6.4 Readiness, deterministic

- **`readiness_requirement`** — `project_id`, `area_id`, `surface_id`, `zone_id`, **`requirement_key` (stable identity, unique per scope)**, `category` (Room/Surface setup · Finish specification · Design decisions · Installer package · Material readiness · Site/dependency), `label`, `state` (met / blocked / not_evaluated / retired), `work_item_id`, `computed_at`.
- Recompute is an idempotent upsert on `(project_id, coalesce scope ids, requirement_key)`: create newly applicable requirements, update existing ones, retire those no longer applicable. Duplicate blocker rows are impossible.
- UI reads names, not numbers: "Master Bathroom — Not Ready · Niche treatment unresolved · Door saddle not confirmed". Material readiness reports **not yet evaluated** in Sprint 1.

### 6.5 Office Setup — derived summary, no checklist

A read-only summary on Overview computed from real records, with each row linking to where the work happens. No manual steps, no "mark setup complete":
`Plan attached ✓` · `Rooms created ✓` · `6 of 8 surfaces have finish mapping` · `3 design decisions still required` · `Installer package not published`.

### 6.6 Plan-assisted setup (lightweight, no CAD, no recognition)

Open an attached plan PDF from `project_files`, pick a page, create/link a Room from that page, optionally pin or rough-outline where the room sits, then create its surfaces. The plan/page/location reference persists on the room for a future layout integration.

### 6.7 Screens

Office Setup summary + plan viewer on Overview; Smart Design Meeting (Room → Surface → Zone → Known information → Decisions needed → Confirm → Next); Review / Publish installer package; mobile + printable package by room.

## 7. Schema delta (additive only)

1. `project_surfaces`: add `surface_kind`, `uom`, `measured_length_in`, `measured_width_in`, `measured_height_in`, `geometry_ref` jsonb, `features` jsonb. **No flat finish column dropped or renamed in Sprint 1.**
2. New `finish_zone`, `finish_selection`, `finish_assignment`.
3. Backfill from the 18 existing surfaces: one default zone each; group surfaces into project-level selections **only where the effective specification fields match exactly** — any difference creates its own selection rather than guessing; per-surface layout facts (direction, start point, pattern, tile height, transition) go onto the assignment.
4. New `design_meeting_session`, `design_decision`, `question_rule` (+ seed of the initial rule catalogue as data, not schema).
5. New `installer_package`, `installer_package_revision`.
6. New `readiness_requirement` with a unique index giving `requirement_key` stable identity per scope; `projects` gains `readiness_computed_at`.
7. `project_areas`: add `plan_file_id`, `plan_page`, `plan_location` jsonb.
8. **Not in Sprint 1:** any `material_items` column change, requirement generation, allocation or procurement lifecycle work. Procurement architecture stays unlocked for Sprint 2.
9. Every new table ships GRANTs (`authenticated`, `service_role`) plus assignment-scoped RLS through the existing `can_access_project` / `can_edit_project` helpers, and a `touch_updated_at` trigger. No drops, no renames, no deletions, no re-seeding of production rows.

## 8. Implementation sequence

Sprint 1 ends at: Approved Project → Office Setup → Rooms/Surfaces → Finish Mapping → Smart Design Meeting → unresolved Work → Installer Package → Setup/Design Readiness.

1. Migrations from §7; verify the zone/selection/assignment backfill row-by-row against the existing 18 surfaces.
2. Lifecycle reduced to 7 stages; one rail; project tabs Overview / Rooms / Work / Files / More.
3. Rooms screen: drawer editing of the physical surface plus its zone assignment; selection picker reuses existing project selections; "Add finish zone" surfaces only when needed.
4. Plan-assisted setup: open plan, pick page, create/link room, optional pin, create surfaces.
5. Office Setup derived summary on Overview with click-through targets.
6. Question rule catalogue + Smart Design Meeting: known information first, only applicable unresolved questions, Confirm writes through to the target field, Unresolved creates or links exactly one work item.
7. Installer package publish from the same records; revision history; later change requires revision 2.
8. Deterministic readiness recomputation with named blockers by category; material readiness "not yet evaluated"; percentage read-only.
9. Retire the second work UI on `/work` in favour of `WorkList` / `WorkItemDrawer`.

## 9. Acceptance test — 114 Park Place (real data, nothing fabricated)

Reference project `11111111-…-111111111111`, stage Setup, 21 open work items, rooms Master Bathroom + Main Floor, surfaces Shower Floor / Shower Wall A / Niche / Main Floor Field, tile tags T-1/T-2/T-3, manufacturer "TBD", grout colour null, only Shower Wall A `detail_confirmed`.

Read-only and additive checks run against the real project. **Every destructive or artificial write runs on a temporary QA clone/snapshot, never the production row.** No manufacturer, grout, selection or decision is invented to make a test pass.

1. Project opens on the 7-stage rail at Setup; 21 open work items, 4 surfaces, materials, receipts, schedule rows and history unchanged.
2. Plan file is visible in Office Setup and a page can be opened (project_files is empty today, so exercised with a real attachment or on the QA clone).
3. Each surface has exactly one default zone, invisible in the UI, with an assignment whose values match the pre-migration flat fields.
4. One project-level selection serves more than one surface (Shower Floor and Niche already share T-1) with the product specification stored once.
5. Two surfaces sharing a selection keep different layout direction / start point on their own assignments.
6. Shower Wall A accepts a second finish zone; only then does zone management appear.
7. Design Meeting shows known information first and asks only genuinely unresolved applicable questions (grout colour, manufacturer); a niche-only question appears solely on the Niche surface.
8. Confirming an answer writes to the intended target field (assignment or selection) and is visible in Rooms and the package — not just logged as text.
9. Leaving manufacturer unresolved creates exactly one work item; two vendor follow-ups add two events to that same item.
10. Publishing Master Bathroom creates revision 1 from those same records; a later spec change requires revision 2 and leaves revision 1 intact.
11. Readiness recomputes twice in a row and produces the same named blockers — no duplicates; resolved items retire; material readiness reads "not yet evaluated"; percentage cannot be hand-edited.
12. Final diff confirms no production row was deleted, reset or fabricated.

## 10. Sprint 1 will NOT touch

Procurement (material_items schema/behaviour, consolidated requirements, POs, allocations, receiving, on-site readiness — all Sprint 2); leads / pre-award / estimating; commissions; `today.tsx` and `dashboard.tsx` layouts; schedule board internals; PO builder and receiving dialogs; bulk import; any CAD, plan recognition or layout rendering; MeasureSquare integration (evaluation only); deletion of any production row, column or table.

## 11. RETIRE eventually (no data loss)

`ops/TaskRow.tsx` + `ops/TaskDrawer.tsx`; `LifecycleTrack.tsx` once the rail carries detail; `projects.$projectId.tiles.tsx`; `STAGE_SUB_WORKFLOWS` + `stage_steps_done` writes; `projects.material_status` / `next_move` / `next_move_owner` writes; the flat `project_surfaces` finish columns once assignments are the read path (after Sprint 1); one of `/today` `/dashboard` `/work`; `visit_checklist_items` folded into Field/work items. Columns and rows stay in place for history.
