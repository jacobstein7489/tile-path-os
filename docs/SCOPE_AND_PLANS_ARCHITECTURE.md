# Scope and Plans Architecture

## 1. Principle

**The estimate builds the project.** Structure created during estimating is the permanent
spine of the job. Setup, tiles & finishes, materials, schedule, field and closeout all hang
off the same `area` and `surface` rows. Nothing is recreated after award.

## 2. Target workflow

```text
Upload plan set (PDF)
  → select current revision            (plan_revision.is_current)
  → calibrate scale per page           (plan_page.scale_calibration)
  → draw / select a tiled room region  (plan_region polygon)
      → create permanent AREA          (area, room_type, level)
      → create applicable SURFACES     (rules engine proposes by room_type)
  → takeoff / measurements             (takeoff_line per surface, qty + waste)
  → estimate                           (estimate_line references area/surface)
Award → same records continue into Setup
```

Every step is optional-degradable: a job with no plans can still have areas/surfaces
created manually (Sprint 4 ships manual first, drawing second).

## 3. Surface proposal by room type (rules-driven)

Example: `room_type = Bathroom (full, with shower)` proposes
`Shower floor · Shower walls · Shower ceiling? · Curb · Niche(s) · Bench? · Bathroom floor ·
Wainscot/walls? · Threshold/saddle · Vanity backsplash?`
The estimator confirms/removes with checkboxes — **select > confirm > type**.

Room-type library lives in Settings (`room_type` + `room_type_surface_template`), so the
company can tune it without a release.

## 4. Quantities

- `takeoff_line` holds the measured quantity, method (drawn/manual/imported), waste %.
- `surface.plan_qty` = sum of takeoff lines (design intent). `surface.field_qty` = verified
  in the field. Variance surfaces as a Field alert and can create a CHANGE work item.
- UOM per surface: `sf`, `lf`, `ea`. Layout/ordering math converts using tile
  `sf_per_carton` and actual sizes (see TILES_AND_FINISHES_MODEL.md).

## 5. Revisions and change control

- Plan revisions are additive; superseding a revision flags affected `plan_region`s and
  raises an ACTION work item ("Review revision C impact on Scope").
- Scope changes after Awarded create `change_order` candidates rather than silently editing
  contract quantities: edit the surface, and the delta is offered as a CHANGE.

## 6. Screens

| Screen | Content |
| --- | --- |
| Project → Scope & Plans | left: plan viewer / revision selector; right: area list with surface counts and qty; drawer for surface edit |
| Project → Scope & Plans (no plans) | compact area/surface builder table (this is the current `scope` route repurposed) |
| Estimating workspace (Sprint 5) | takeoff lines grouped by area with pricing columns |

## 7. Storage and performance

- PDFs in the private `project-plans` bucket; page thumbnails pre-rendered on upload via a
  server function (client-side render for viewing, worker-safe libraries only).
- Rendering/markup runs client-side (`pdf.js` + canvas overlay), lazily imported behind a
  client-only boundary — never statically imported into an SSR route.

## 8. Open decisions

- Vector markup engine: build on canvas vs adopt a library — decide before Sprint 4.
- Do we store polygons in plan coordinates (recommended) and convert to real units on read?
  Yes: store plan-space geometry + calibration, compute area on read.
