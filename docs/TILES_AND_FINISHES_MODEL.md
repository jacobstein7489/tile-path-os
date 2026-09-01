# Tiles and Finishes Model

Separate from Install Materials. This module answers: *what finished product goes on this
exact surface, and is it selected, confirmed, ordered, and on site?*

## 1. Catalog vs selection

```text
manufacturer → collection → tile_product        (company catalog, reusable)
                          → finish_product      (grout, metals, saddles, trim, mosaic)
                                     │
                          finish_selection  ── surface (exact)
```

The catalog is company-wide and grows with use ("Save to catalog" on first entry).
Selections are project data.

## 2. `tile_product` fields (manufacturer spec defaults)

Manufacturer · Collection · Product name · SKU · Supplier · Nominal size (label) ·
**Actual manufactured width/height (mm)** · Thickness (mm) · Finish · Rectified/edge type ·
Recommended joint (mm) · Pieces per carton · SF per carton · Photo · Notes.

Rules:

- Nominal size is a **label only**. Never used in calculation.
- Layout, cut counts, and course math use actual size + joint.
- Ordering rounds up to full cartons using `sf_per_carton`, then applies waste %.
- **Caliber and shade/lot are NOT product attributes.** The product row carries manufacturer
  spec defaults; the physical characteristics of what arrived live on the receipt (§6).

## 3. `finish_product` kinds

Grout (manufacturer, color, type: cement/epoxy/urethane, joint range) · Metal profile
(brand, material, finish, height, edge type) · Saddle/threshold (material, size, edge
profile, fabrication) · Pencil / bullnose / trim / mosaic (size, sheet coverage) ·
Sealant/caulk color-matched to grout.

## 4. Specification vs fulfillment — two separate models

Specification answers *what belongs here*. Fulfillment answers *do we have it*. They are
never the same field.

### `finish_selection` — specification only

Scope: project / area / surface / **zone**. Fields: kind, product ref (tile or finish),
layout pattern, direction, start point, joint size, grout color, alignment (stacked/offset %),
notes.

Spec status: `Draft → Selected → Confirmed → Superseded`.
**Confirmed** (customer/designer approved) is what readiness requires; Selected alone does not
release a job. There are no Ordered/Received/Installed values here.

### `finish_requirement` — per surface/zone quantity need

finish_selection_id, required_qty, uom, waste_pct, supplier_company_id, `supplied_by`
(cobblestone / customer / GC / designer / tile store), expected_date, allocated_qty,
on_site_qty, shortfall_qty, missing/wrong/damaged counts, notes.

Order state: `Not Ordered → Ordered → Partially Received → Received → On Site / Ready`.

- **`Installed` is not a fulfillment state.** Physical installation lives entirely in the
  Surface/progress engine (see LIFECYCLE_AND_READINESS.md §4).
- Order state and readiness are **derived** from allocations + receipts + supplied_by, never
  typed by a user.

### `finish_procurement_requirement` — consolidated ordering

Multiple surfaces/zones using the same product must buy once. A project-level aggregate row
is keyed by `(project_id, product_ref, effective_spec)` — effective spec meaning any attribute
that must not be mixed across an order (e.g. finish, size, requested shade where specified).

```text
Wall A ┐
Wall B ├─ finish_requirement (T17) ─┐
Wall C ┤                            ├─→ finish_procurement_requirement (T17, project total)
Niche  ┘                            ┘         └─→ commitment_line (one PO line)
```

- Waste and carton rounding are applied **once**, at the aggregate level, not per surface.
- Order/receipt quantities flow back through `finish_allocation` rows
  (procurement_requirement_id, finish_requirement_id, qty, receipt_id?) so per-surface
  readiness, shortfalls and shade continuity stay exact.
- Allocation default is proportional to required_qty; a coordinator can reallocate explicitly
  (e.g. give the niche its own lot) and the change is recorded.

## 5. `finish_receipt` — append-only, carries lot reality

Per receipt: date, commitment/PO ref, qty good / damaged / wrong / missing, **shade_lot**,
**caliber**, optional `actual_w_mm` / `actual_h_mm` / `thickness_mm` overrides, packing slip,
received_by, photo, notes.

- A receipt-level dimension override wins over the product default for layout math on that
  lot — real cartons vary and layout must use what is on site.
- Multi-lot jobs are a known defect source: a shade/caliber mismatch across allocations to the
  same continuous surface raises an ACTION work item.
- Receipts are never edited or overwritten; totals recompute from the receipt set.

## 6. Migration from current data

Today, spec text lives in `project_surfaces` columns (`tile_tag`, `tile_size`,
`manufacturer`, `supplier`, `grout_color`, `joint_size`, `metal_profile`, `layout_pattern`,
`tile_sku`, `tile_finish`, …). Plan:

1. Create catalog, selection, requirement, procurement, allocation and receipt tables.
2. Copy each populated surface spec into `finish_selection` rows (tile, grout, metal),
   creating catalog rows on the fly, deduped by manufacturer + name + size; derive
   `finish_requirement` rows from surface quantities.
3. Keep the legacy columns read-only (deprecated, retained for rollback) for at least one
   sprint after the new references are proven, then drop.
4. `project_surfaces` ends as pure structure (name, kind, governing measurement, status).


## 6. Screens

- **Project → Tiles & Finishes**: area list → surface list → selection panel (3-column,
  reuses the current `scope` route layout, which is good and should be kept + modified).
- Selection panel: select-first pickers over the catalog, with "New product" inline.
- Per-surface completeness chip and a project-level "selections confirmed" rollup feeding
  readiness.
- **Settings → Product catalog**: manufacturers, collections, products, suppliers.
