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

### 2. Backend — small ordered migrations, validated between phases
No single giant migration. Each phase is additive and independently verifiable; legacy columns/policies are only removed after verification.

1. **People & roles** — `profile`, `role` (configurable records keyed by `key`, label, can_see_money), `user_role` join, `has_role(_user_id uuid, _role_key text)` security definer. **One source of truth: role records, no `app_role` enum** — new roles are data, not migrations.
2. **Companies & contacts** — `company`, `contact`, plus `crew` columns (company_id, lead_contact_id, capacity_per_day, is_active).
3. **Backfill** — seed real users/roles/companies/contacts/crews; map existing text owners, customers and suppliers onto real records (legacy text columns retained, read-only).
4. **Project refs & assignments** — project columns (job_number, source, bid_due_date, follow_up_on, salesperson_user_id, estimator_user_id, commission_user_id, customer_company_id, gc_company_id, primary_contact_id, pm_user_id, site_manager_user_id) + `project_assignment`.
5. **Storage & files** — private `project-files` bucket + `file_object` table with storage policies.
6. **RLS transition** — replace every open `USING (true)` policy with role/assignment-based policies, table by table, verifying reads/writes after each.
7. **Legacy cleanup** — only after the app is verified running on the new refs.

### 3. Auth
Email + password and Google sign-in, `/auth` route, `_authenticated` gating, profile bootstrap on first sign-in, role-aware nav and permissions.

### 4. Screens in scope
Settings (users & roles, companies, contacts, crews) · New Lead / Job intake modal (address, customer/GC, contact, salesperson, estimator, source, bid due, follow-up, notes, file upload) with searchable selectors · Projects list showing **one compact Stage chip per row** (no lifecycle rail in rows, no horizontal scroll) · Project Overview carrying the **full 10-stage master rail** · project header Edit / Hold / Cancel / Lost / Archive / Delete gated by role · existing Dashboard/Today/Schedule/Install Materials/project tabs migrated onto the frozen kit.

Visible lifecycle: New Submission → Estimating → Proposal → Awarded → Setup → Ready → Scheduled → Installation → Closeout/Return → Complete (On Hold, Lost, Cancelled as exceptions).

### 5. Validation before reporting done
- RLS tested by signing in as a non-privileged user and confirming denied reads/writes.
- Intake, edit, archive and permission paths round-tripped against the database.
- No raw color classes or local styling left in routes.
- **Visual QA:** Playwright screenshots at 1440×900 (and a 1280×800 clipping check) of Dashboard, Projects, one Project Overview, Schedule, Install Materials, Settings and New Lead/Job intake — reviewed for one consistent system, no clipping, no excessive scrolling, no dead controls.

Final report: migrations in order, security tests, data backfilled, frozen tokens/components, routes migrated, screenshots, any unmet criterion, any architectural issue found. Nothing deferred silently. Sprint 2 is not started.

