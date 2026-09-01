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

## 4. Measurements, zones and quantities

Precise layout cannot depend on two flat numbers. Structured measurement records replace
`plan_qty` / `field_qty` as the source of truth.

### `surface_measurement`

| Field | Notes |
| --- | --- |
| surface_id / zone_id? | measurement can belong to a surface or a specific finish zone |
| kind | `plan` \| `field` (a manual override is a `field` record explicitly marked verified) |
| width, height, length, area, uom | store what was actually measured; area derived when dimensions given |
| source | drawn · manual · imported · field |
| measured_by_user_id, measured_at | provenance |
| verified_by_user_id, verified_at | verification, required before a record can govern after install starts |
| notes | |

There is **no third copied "governing" row**. `project_surfaces.governing_measurement_id`
points at the record currently controlling layout and quantity, so it can never drift from
the record it names. Default rule: the latest verified `field` record if one exists,
otherwise the current `plan` record; a user may repoint it explicitly and the change is
logged.

`takeoff_line` still holds priced takeoff quantity and waste %; it references the measurement
it came from. Plan-vs-field variance is computed by comparing the two records and can raise a
CHANGE work item.

### `finish_zone`

Every surface has exactly **one default zone**, created implicitly and hidden in the UI —
the simple case stays a single spec with no extra clicks. Additional zones appear only when a
surface genuinely carries more than one finish (e.g. a feature band, a wainscot break).

Zone fields: surface_id, name, sort_order, `measurement_id?` (own dimensions), `offset_x`,
`offset_y`, `geometry jsonb` (polygon/rect in surface coordinates, nullable). Zones are
architected for real geometry and offsets from day one — share/percentage is only a fallback
when no geometry is supplied.

UOM per surface: `sf`, `lf`, `ea`. Layout/ordering math uses actual tile dimensions plus
joint (see TILES_AND_FINISHES_MODEL.md). `surface.plan_qty` / `field_qty` remain only as
derived read caches over measurements, documented read-only.


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
