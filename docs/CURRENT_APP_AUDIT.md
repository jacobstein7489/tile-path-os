# Current App Audit

Verdict: the foundation is worth keeping. Roughly **70% keep-or-modify, 20% rebuild,
10% remove**. Nothing should be thrown away wholesale.

## 1. Routes

| Route | LOC | Classification | Notes |
| --- | --- | --- | --- |
| `src/routes/__root.tsx` | 146 | KEEP | shell + Toaster; add auth/session provider |
| `index.tsx` (redirect → /projects) | 7 | KEEP + MODIFY | redirect to role landing route |
| `dashboard.tsx` (Company Work) | 247 | KEEP + MODIFY | correct concept; needs 5 kinds/5 statuses, real users, My Work tab, denser table |
| `today.tsx` | 225 | MERGE → REMOVE | fold into `/dashboard?view=mine`; keep the undo-completion pattern |
| `projects.index.tsx` | 244 | KEEP + MODIFY | add readiness/blocker column, real PM/crew refs, saved filters |
| `projects.$projectId.tsx` (shell) | 132 | KEEP + MODIFY | tab set → Overview/Scope & Plans/Tiles & Finishes/Field/Install Materials/Commercial/Files; advance action becomes derived-gated |
| `projects.$projectId.index.tsx` (Overview) | 317 | KEEP + MODIFY | replace manual sub-steps with calculated readiness categories; make crew/dates click-to-edit |
| `projects.$projectId.scope.tsx` | 527 | RENAME + MODIFY | becomes **Tiles & Finishes**; 3-column layout is good; specs move from surface columns to `finish_selection` |
| `projects.$projectId.field.tsx` | 203 | KEEP + MODIFY | promote checklist to `visit` + items; link verifications to work items |
| `projects.$projectId.materials.tsx` | 149 | KEEP + MODIFY | requirement statuses derived; add on-hand/delivered |
| `projects.$projectId.files.tsx` | 150 | REBUILD | placeholder register; needs real storage buckets + upload |
| `materials.tsx` | 508 | KEEP + MODIFY | tab structure good; trim KPI cards, add Catalog tab, supplier refs |
| `schedule.tsx` | 434 | KEEP + MODIFY | crew lanes + Ready to Assign are right; needs capacity, confirm states, area-level assignment |
| `settings.tsx` | 20 | REBUILD | placeholder; becomes the configuration hub (users, roles, contacts, catalogs, rules) |
| — | — | NEW | `/sales`, `/reports`, `/projects/$id/commercial` |

## 2. Components

| Component | LOC | Classification | Notes |
| --- | --- | --- | --- |
| `kit.tsx` | 538 | KEEP + MODIFY | canonical kit; add combobox, inline edit, skeleton, avatar, timeline, button loading/pressed |
| `lib/status.tsx` | 114 | KEEP + MODIFY | chip system good; status vocabularies shrink to the new families |
| `AppSidebar.tsx` | 81 | KEEP + MODIFY | nav becomes Dashboard/Sales/Projects/Schedule/Install Materials/Reports/Settings; org card → user card with role switcher |
| `AppHeader.tsx` | 70 | KEEP + MODIFY | add global search + Quick Capture + user menu |
| `PageShell.tsx` | 45 | KEEP + MODIFY | keep as page frame; `ComingLater` removed once placeholders are gone |
| `LifecycleTrack.tsx` | 171 | KEEP + MODIFY | 12 → 10 stages; remove manual sub-step toggles (readiness replaces them); keep the rail visuals |
| `ProgressBar.tsx` | 20 | KEEP | |
| `WorkItemDrawer.tsx` | 266 | KEEP + MODIFY | best asset in the app; needs data-driven advancement, attachments, real owner/waiting-on pickers |
| `WorkItemDialogs.tsx` | 295 | MERGE | collapse Create/RequestMaterial into one create flow with 5 kinds |
| `QuickCapture.tsx` | 251 | KEEP + MODIFY | keep heuristic split + review; add project matching against real projects, contact matching, later AI classification |
| `MaterialDialogs.tsx` | 510 | KEEP + MODIFY | PO builder / receive / detail flows are correct; move detail into a drawer for consistency |
| `NewProjectModal.tsx` | 121 | KEEP + MODIFY | fields become real refs (customer company, GC, PM user, salesperson) |
| `ProjectMoreMenu.tsx` | 201 | KEEP + MODIFY | good; gate Delete behind admin role |
| `lib/data.ts` | 464 | KEEP + MODIFY | generic insert/update/delete helpers are fine; split per-domain files; replace blanket invalidation with scoped keys |
| `lib/workitems.ts` | 388 | KEEP + MODIFY | workflow map is the right shape; add step metadata + data-driven transitions; shrink taxonomies |
| `lib/lifecycle.ts` | 100 | KEEP + MODIFY | 10 stages; `STAGE_SUB_WORKFLOWS` and `stage_steps_done` retired in favor of readiness |
| `error-capture.ts`, `lovable-error-reporting.ts`, `utils.ts` | — | KEEP | platform plumbing |

## 3. Database

| Table | Classification | Action |
| --- | --- | --- |
| `projects` | KEEP + MODIFY | add job_number, real FK refs (customer/GC/PM/site mgr/estimator/salesperson), bid_due, awarded_at; retire crew_lead/project_manager/material_status/next_move/next_move_owner/stage_steps_done text fields |
| `project_areas` | KEEP + MODIFY | add room_type, level; derive progress |
| `project_surfaces` | KEEP + MODIFY | keep structure fields; migrate ~18 spec columns to `finish_selection`; add surface_kind, uom, plan/field qty |
| `work_items` | KEEP + MODIFY | add kind, internal_subtype, owner_user_id, waiting_on refs, links, completed_by |
| `work_item_events` | KEEP | append-only; add actor_user_id, payload |
| `material_items` | RENAME + MODIFY | → `material_requirement`; add on_hand/delivered, catalog + supplier FKs |
| `purchase_orders`, `po_lines` | KEEP + MODIFY | supplier FK, richer statuses, created_by, unit cost |
| `material_receipts` | KEEP | already append-only with INSERT/SELECT-only policies — exactly right |
| `schedule_assignments` | KEEP + MODIFY | area_id, confirm states, created_by |
| `crews` | KEEP + MODIFY | link to installer company/contacts, capacity, is_active |
| `visit_checklist_items` | KEEP + MODIFY | split into `visit` + `visit_checklist_item`, link items to work items |
| RLS across all tables | REBUILD | every table currently uses `USING (true)` open policies for anon/public — must become role- and assignment-scoped before real users |
| — | NEW | profiles/roles, companies/contacts, participants/assignments, plans/takeoff, product catalog/selections, install material catalog, deliveries, rules/requirements/answers/readiness, estimates/contracts/changes, files |

## 4. Workflows and interactions

| Behavior | Classification | Notes |
| --- | --- | --- |
| Manual `stage_steps_done` toggles + gated advance | REBUILD | replaced by calculated readiness gating |
| Work-item workflow advancement (manual step advance) | KEEP + MODIFY | keep engine, drive from data events |
| Quick Capture raw-text split | KEEP + MODIFY | strong differentiator; upgrade matching |
| Whole-row clickability (projects, work items) | KEEP | already partially done; extend to areas, surfaces, schedule cells, material lines |
| Completion + Undo | KEEP | standardize across all lists |
| Free-text owners ("Office", "Yaakov" hardcoded actor) | REMOVE | replace with authenticated user |
| `ComingLater` placeholder screens (settings, files) | REMOVE | replaced by real screens |
| Toasts via sonner | KEEP | standardize copy |

## 5. Top structural debts (fix order)

1. No authentication/users/roles; actor hardcoded, RLS wide open. **(blocking)**
2. No contacts/companies — supplier/customer/GC are text.
3. Status/type taxonomies too large and overlapping with workflow steps.
4. Readiness is manual, not calculated; no rules engine.
5. Finish specs stored as flat surface columns — can't support real tile math or ordering.
6. Files have no storage.
7. `useInvalidateAll()` invalidates 11 query keys on every write — replace with scoped keys.
8. Visual drift and local styling on several routes.
