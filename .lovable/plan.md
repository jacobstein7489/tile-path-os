# Architecture Freeze + Sprint 1

Two phases in one pass: (A) fold the final corrections into `docs/`, then freeze; (B) implement Sprint 1 only.

## Phase A — Final documentation corrections

| Doc | Change |
| --- | --- |
| `TILES_AND_FINISHES_MODEL.md` | Fulfillment ends at On Site / Ready — `Installed` removed from finish states. Consolidated procurement + allocation model. |
| `SCOPE_AND_PLANS_ARCHITECTURE.md` | Plan/Field measurement records only, `surface.governing_measurement_id` pointer, geometry-capable zones with an implicit default zone. |
| `LIFECYCLE_AND_READINESS.md` | Progress computed per compatible quantity family; optional `installation_weight` for a future effort-weighted project %. Finish readiness derived, never editable. |
| `DATA_MODEL.md` | Tables below. |
| `DESIGN_SYSTEM_PLAN.md` | Sprint 1 design freeze: one production system, no local style drift, explicit acceptance list. |
| `SPRINT_IMPLEMENTATION_PLAN.md` | Sprint 1 acceptance criteria as written; design freeze precedes new screens. |
| `MASTER_PRODUCT_ARCHITECTURE.md`, `SCREEN_MAP.md`, `WORK_ITEM_AND_WORKFLOW_ENGINE.md`, `CURRENT_APP_AUDIT.md`, `README.md` | Consistency edits (lifecycle wording, lead intake screen, waiting-on company). |

### Corrected model (documented now, built in later sprints)

- `finish_selection` — specification only (what finish belongs to surface/zone: product, pattern, direction, start point, joint, grout, alignment; spec status Draft → Selected → Confirmed → Superseded).
- `finish_requirement` — per surface/zone quantity need: required_qty, uom, waste_pct, supplier, supplied_by, expected_date, allocated_qty, on_site_qty, shortfall. Order state `Not Ordered → Ordered → Partially Received → Received → On Site / Ready`. No `Installed`. State derived from allocations + receipts, never typed.
- `finish_procurement_requirement` — project-level aggregate keyed by (project, product, effective spec): sums child requirements into one orderable total (cartons rounded once at this level). One PO line can cover Walls A/B/C + niche for T17.
- `finish_allocation` — links procurement/receipt quantity back to each originating `finish_requirement` so per-surface readiness stays exact.
- `finish_receipt` — append-only: qty good/damaged/wrong/missing, `shade_lot`, `caliber`, optional `actual_w_mm`/`actual_h_mm`/`thickness_mm` lot overrides (override wins for layout on that lot). `tile_product` holds manufacturer spec defaults only.
- `surface_measurement` — kind `plan` | `field` (plus explicit verified manual records), width/height/length/area/uom, source, measured_by/at, verified_by/at. `project_surfaces.governing_measurement_id` points at the controlling record; no copied third row.
- `finish_zone` — every surface has one default zone (implicit in UI). Zone carries optional own measurement, offsets and geometry jsonb so real geometry can land later without a model change.
- `work_item.waiting_on_company_id` alongside user/contact.
- `commitment` / `commitment_line` — material / finish / labor / service; return-work labor path (price → approve → commitment → schedule → perform → verify).
- Progress: `surface_progress = completed_governing_qty / governing_qty`, rolled up quantity-weighted **within each uom family** (sf, lf, ea) — no invented conversions. Optional `installation_weight` per surface/line enables a future effort-weighted single project %; until estimating data exists, families are shown side by side. Never manually edited.

## Phase B — Sprint 1 implementation

### 1. Design system freeze (before any new screen)
One production system in `src/styles.css` + `src/components/kit.tsx`: type scale (28/20/16/14/13/12, tabular numerals), 4px spacing tokens, page shell and fixed sidebar/header dimensions, neutral + restrained semantic OKLCH tokens, single blue primary, radii 8/12/999, two shadows, 120–180ms motion. Components: PageShell, Sidebar, PageHeader, Table set with full-row click, Button (all variants + states), IconButton, Input/Textarea/Select, **searchable Combobox**, DateField, InlineEdit, StatusChip, ProgressBar, ReadinessMeter, Avatar, Drawer, Modal, Toast (sonner), Skeleton, EmptyState, ErrorState, LifecycleRail. Every interactive component defines default/hover/focus-visible/pressed/loading/disabled/error/success. Then migrate every existing route onto it and remove local styling.

### 2. Backend (single migration, submitted for approval)
`profile`, `role`, `user_role` (+ `app_role` enum, `has_role()` security definer), `company`, `contact`, `crew` extensions, `project_assignment`, `file_object`, project columns for lead intake (source, bid_due_date, follow_up_on, salesperson_user_id, estimator_user_id, customer_company_id, gc_company_id, primary_contact_id, commission_user_id) plus private `project-files` storage bucket. GRANTs + RLS with role/assignment-based policies replacing every open `USING (true)` policy. Real user/company/contact/crew seed data, text owners backfilled.

### 3. Auth
Email + password and Google sign-in, `/auth` route, `_authenticated` gating, profile bootstrap on first sign-in, role-aware nav.

### 4. Screens in scope
Settings (users & roles, companies, contacts, crews) · New Lead / Job intake modal with all intake fields, searchable selectors and file upload · Projects list with the simplified 10-stage rail from New Submission · Project header with working Edit / Hold / Cancel / Lost / Archive / Delete gated by role · existing Dashboard/Today/Schedule/Install Materials/project tabs migrated to the frozen kit.

Visible lifecycle: New Submission → Estimating → Proposal → Awarded → Setup → Ready → Scheduled → Installation → Closeout/Return → Complete (On Hold, Lost, Cancelled as exceptions).

### 5. Validation before reporting done
Playwright pass at 1440×900 and 1280×800 on every route: no clipped layouts, no dead controls, full-row click targets, RLS verified by signing in as a non-privileged user, intake + edit + archive round-tripped against the database, no raw color classes left in routes.

Sprint 2 is not started.
