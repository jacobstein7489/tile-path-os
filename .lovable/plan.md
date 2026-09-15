# Cobblestone Tile OS — Final Architecture Delta Audit

Audit only. No code written. Boundary: Approved Project → Complete.

## 1. CURRENT — what genuinely exists and is production-connected

**Database (23 tables, real rows):** projects 29 (28 active), project_areas 15, project_surfaces 18, work_items 191 (154 unarchived), material_items 11, purchase_orders 1, po_lines, material_receipts 2, schedule_assignments 10, visit_checklist_items 5, crews 5, profiles 8, companies 16, contacts 0, field_reports 0, project_files 0, commission_plans 0, commission_payments 0, user_roles, project_assignments, project_participants, application_bootstrap.

**Live relationships:** projects → project_areas → project_surfaces; work_items → project/area/surface (+ waiting_on user/contact/company, source_field_report_id); material_items → project/area/surface; po_lines → purchase_orders + material_items; material_receipts → material_items + PO; schedule_assignments → project + crew; project_files → project/area/surface/field_report; field_reports → project + crew.

**Working today:** auth with 10 roles and per-project edit checks (`src/hooks/useAuth.ts`); work-item engine with events, optimistic save, 4-status mapping (`src/lib/workitems.ts`); Rooms/Surfaces editing incl. ~20 spec fields (`projects.$projectId.scope.tsx`); materials + PO + receiving flows (`MaterialDialogs.tsx`, `materials.tsx`); file upload to the `project-files` bucket with signed-URL viewing (`projects.$projectId.files.tsx`, `src/lib/fieldreports.ts`); daily updates capture (`FieldReportSheet.tsx`); bulk paste import (`QuickCapture.tsx`); schedule board.

**Not real despite appearing built:**
- `projects.readiness_pct` / `readiness_note` have **no writer anywhere** — read in 4 places, set by hand. Readiness is fiction today.
- `material_status` on projects is a stored text field, duplicating what material_items already imply.
- 4 pre-award stages (New Submission, Estimating, Proposal, Awarded) hold 14 imported stubs — outside the locked boundary.
- Design Meeting, Installer Package, Finish Specification as an object, and a procurement state machine: **do not exist at all.**

## 2. Source of truth — existing vs proposed

| Concept | Existing | Proposed |
| --- | --- | --- |
| Project | `projects` (44 cols, mixes identity, denormalised status, commissions) | `projects` stays, but stage/readiness/material_status become derived, not typed-in |
| Room | `project_areas` | unchanged (rename in UI only: Room) |
| Surface | `project_surfaces` (31 cols incl. all finish + layout data) | **remains the single source of truth for the installation spec**; gains geometry/measurement + confirmation fields |
| Finish spec | columns on the surface | stays on the surface — no separate table, no second copy |
| Work | `work_items` + `work_item_events` | unchanged engine; follow-ups append events to the same item |
| Material | `material_items` split by `category` (Finish Tile / Grout & Metals / Installation Materials) | one table, one lifecycle, category distinguishes Tiles & Finishes from Install Materials; requirements generated from surfaces |
| Schedule | `schedule_assignments` | unchanged; gate assignment on derived readiness |
| Files | `project_files` + `project-files` bucket | unchanged; installer packages reference it, never a second store |
| Updates | `field_reports` (+ photos as project_files) | unchanged |

## 3. Duplicate concepts already present

1. **Two work UIs.** `WorkList.tsx` + `WorkItemDrawer.tsx` (Today, Company Work, project Tasks) vs `ops/TaskRow.tsx` + `ops/TaskDrawer.tsx` (`/work` only).
2. **Two lifecycle components rendered on the same screen** — `LifecycleTrack.tsx` and `ops/LifecycleRail.tsx` are both imported and shown in `projects.$projectId.tsx`.
3. **Two lifecycle vocabularies** — 10 stages in `src/lib/lifecycle.ts` vs the locked 7, plus `STAGE_SUB_WORKFLOWS` manual checkboxes that compete with derived readiness.
4. **Three tile/material tabs on one project** — `tiles.tsx` (read-only mirror of surfaces), `install-materials.tsx` (filtered material_items), `materials.tsx` (same table again).
5. **Three work destinations** — `/today`, `/dashboard`, `/work`.
6. **Manual `stage_steps_done` array** vs real derived readiness.
7. Pre-award surface (`leads.*`) and Commissions sit outside the locked boundary.

## 4. KEEP (do not rewrite)

`work_items` / `work_item_events` engine and its 4 user-facing statuses; `project_areas` / `project_surfaces` hierarchy and every spec column; `material_items` / `purchase_orders` / `po_lines` / `material_receipts`; `project_files` + storage + upload path; `field_reports`; `schedule_assignments` / `crews`; roles, RLS helper functions, project_assignments; `kit.tsx` design system; `WorkList` + `WorkItemDrawer`; `ops/Capture` + `CaptureProvider`; `ops/LifecycleRail`.

## 5. MODIFY (and exactly why)

| Item | Change | Why |
| --- | --- | --- |
| `src/lib/lifecycle.ts` | 7 operating stages (Approved → Setup → Ready → Scheduled → Installation → Punch/Return → Complete); retire `STAGE_SUB_WORKFLOWS` | current 10 stages include out-of-scope pre-award and hand-ticked steps |
| `projects.readiness_pct` | written only by a derivation service from real surface + requirement + schedule facts | today it is a hand-set number that misrepresents reality |
| `projects.material_status`, `stage_steps_done`, `next_move*` | stop writing; keep columns for history | duplicate facts already derivable from material_items / work_items |
| `project_surfaces` | add measurement/geometry + decision-confirmation fields (see §7) | preserves data for a later external layout engine (MeasureSquare evaluation) without building CAD |
| `material_items.status` | drive through one shared lifecycle: Need → Confirm Details → Ordered → Waiting/ETA → Partial/Received → On Site → Ready | current statuses are ad-hoc and category-specific |
| `projects.$projectId.tsx` | one lifecycle component (Rail), tabs reduce to Overview / Rooms / Work / Files / More | two rails + 10 tabs today |
| `projects.$projectId.scope.tsx` | becomes the Rooms surface-of-truth screen with drawer editing, no inline expansion | already the only spec editor; must not shift the user's position |
| `WorkItemDrawer` | follow-up action appends an event to the same item instead of inviting a new task | prevents duplicate task-per-phone-call |
| `useAuth` permissions | add office-setup vs design-meeting vs publish capability checks | publishing a package needs a gate |

## 6. ADD (missing, required)

- **`design_meeting_session`** (project, opened_by, opened_at, completed_at) + **`design_decision`** (session, surface_id, question_key, prompt, answer_value, status: unresolved/confirmed/deferred, work_item_id, decided_by, decided_at). Confirmed answers write through to the surface; unresolved ones create/link one work item.
- **`question_rule`** — conditional question catalogue (applies_when JSON on surface kind/waterproofing/tile size etc.), so the meeting asks only unresolved, applicable questions.
- **`installer_package`** + **`installer_package_revision`** (project, room/area, revision_no, published_at, published_by, snapshot JSONB of surface data, pdf/file ref) — publish/revision history, no silent overwrite after publication.
- **`material_requirement` generation service** — derive requirements from surfaces into `material_items` (no new table).
- **`project_readiness`** (project_id, computed_at, score, blockers JSONB) or a derivation function writing `readiness_pct` + a blocker list.
- **Screens:** Office Setup checklist on the project Overview; Smart Design Meeting flow (Room → Surface → Known → Decisions Needed → Confirm → Next); Review / Publish installer package; mobile + printable installer package by room.

## 7. Minimum safe schema migrations (additive only)

1. `project_surfaces`: add `surface_kind`, `uom`, `measured_length_in`, `measured_width_in`, `measured_height_in`, `tile_length_in`, `tile_width_in`, `grout_joint_in`, `geometry_ref` (jsonb), `features` (jsonb), `spec_confirmed_at`, `spec_confirmed_by`.
2. New tables `design_meeting_session`, `design_decision`, `question_rule`, `installer_package`, `installer_package_revision` — each with GRANTs + assignment-scoped RLS via existing `can_access_project` / `can_edit_project`.
3. `material_items`: add `requirement_source` ('surface' | 'manual'), `source_surface_id`, `eta_date`, `on_site_qty`.
4. `projects`: add `readiness_blockers` jsonb + `readiness_computed_at`; nothing dropped.
5. Optional stage remap kept as data-only: pre-award projects stay at their stored stage and are simply filtered out of the operating list. **No renames, no drops, no data deletion.**

## 8. Sprint 1 scope (smallest proof of the chain)

Approved project → Office Setup → Rooms/Surfaces → tile/finish mapping → Smart Design Meeting → unresolved Work Item → resolved decision → Installer Package → automatic Readiness.

1. Migration set from §7.
2. Lifecycle reduced to the 7 operating stages; one rail; project tabs Overview / Rooms / Work / Files / More.
3. Rooms screen: drawer-based surface editing incl. new measurement fields; a "known info vs missing" indicator per surface.
4. Office Setup block on Overview: files uploaded, rooms created, surfaces created, known finishes mapped.
5. Smart Design Meeting: rule-driven conditional questions, Confirm writes to the surface, Unresolved creates or links one work item.
6. Installer Package: publish a room package (mobile view + print), revision history, republish creates revision 2.
7. Readiness derivation service + blocker list, replacing the manual number; Schedule reads it.
8. Retire the second work UI on `/work` in favour of `WorkList`/`WorkItemDrawer`.

**Acceptance test — 114 Park Place** (`11111111-…-111111111111`, stage Setup, readiness 40 today, 21 open work items, rooms Master Bathroom + Main Floor, surfaces Shower Floor / Shower Wall A / Niche / Main Floor Field, tile tags T-1/T-2/T-3, manufacturer "TBD", grout colour null, only Shower Wall A `detail_confirmed`):

1. Project opens on the 7-stage rail at Setup; all 21 open work items and 4 surfaces still present.
2. Office Setup shows rooms/surfaces complete, files missing (project_files is empty today).
3. Design Meeting for Master Bathroom asks grout colour and manufacturer for T-1/T-2 (null today) and skips fields already set (layout direction, start point, waterproofing); Shower Wall A shows fewer questions because it is already confirmed.
4. Confirming grout colour on Shower Wall A writes to `project_surfaces` and is visible in Rooms and in the package.
5. Marking manufacturer unresolved creates exactly one work item; calling the vendor twice adds two events to that same item — no second task.
6. Publishing the Master Bathroom package produces revision 1 with the confirmed values; changing a spec afterwards requires revision 2 and leaves revision 1 intact.
7. Readiness recomputes from real facts (unconfirmed surfaces + open material needs) and no longer reads 40 unless the facts say so; blockers are listed by name.
8. Main Floor, all existing materials, receipts, schedule rows and history are unchanged.

## 9. Sprint 1 will NOT touch

Leads / pre-award / estimating routes, Commissions and commission plans, `today.tsx` and `dashboard.tsx` layouts, the schedule board's internals, PO builder and receiving dialogs, bulk import, any CAD/layout rendering, MeasureSquare integration (evaluation only), Tiles & Finishes and Install Materials data models (kept distinct), and any deletion of production rows, columns or tables.

## 10. RETIRE eventually (no data loss)

`ops/TaskRow.tsx` + `ops/TaskDrawer.tsx`; `LifecycleTrack.tsx` once the rail carries detail; `projects.$projectId.tiles.tsx` (read-only mirror of Rooms); `STAGE_SUB_WORKFLOWS` + `stage_steps_done` writes; `projects.material_status` / `next_move` / `next_move_owner` writes; one of `/today` `/dashboard` `/work`; `visit_checklist_items` folded into Field/work items. Columns stay in place for history.
