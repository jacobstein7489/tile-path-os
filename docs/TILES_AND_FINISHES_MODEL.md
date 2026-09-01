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

## 2. `tile_product` fields (all required for real layout math)

Manufacturer · Collection · Product name · SKU · Supplier · Nominal size (label) ·
**Actual manufactured width/height (mm)** · Thickness (mm) · Finish · Rectified/edge type ·
Recommended joint (mm) · Pieces per carton · SF per carton · Caliber · Shade/lot ·
Photo · Notes.

Rules:

- Nominal size is a **label only**. Never used in calculation.
- Layout, cut counts, and course math use actual size + joint.
- Ordering rounds up to full cartons using `sf_per_carton`, then applies waste %.
- Caliber and shade/lot are tracked per receipt (multi-lot jobs are a real defect source);
  a mismatch raises an ACTION work item.

## 3. `finish_product` kinds

Grout (manufacturer, color, type: cement/epoxy/urethane, joint range) · Metal profile
(brand, material, finish, height, edge type) · Saddle/threshold (material, size, edge
profile, fabrication) · Pencil / bullnose / trim / mosaic (size, sheet coverage) ·
Sealant/caulk color-matched to grout.

## 4. `finish_selection`

Per surface (or per area for shared specs): kind, product ref, qty required + uom,
layout pattern, layout direction, start point, joint size, grout color, alignment
(stacked/offset %), and status:

`Selected → Confirmed (customer/designer approved) → Ordered → Received → Installed`

- **Confirmed** is what readiness requires; Selected alone does not release a job.
- Missing/late finish products generate NEED work items with the `tile_followup` workflow
  (e.g. "114 Park — master mosaic missing, waiting on tile store").
- Selection completeness per surface is rule-driven: a shower floor requires tile + grout +
  drain treatment; a stair requires tread tile + nosing/metal + riser treatment.

## 5. Migration from current data

Today, spec text lives in `project_surfaces` columns (`tile_tag`, `tile_size`,
`manufacturer`, `supplier`, `grout_color`, `joint_size`, `metal_profile`, `layout_pattern`,
`tile_sku`, `tile_finish`, …). Plan:

1. Create catalog + selection tables.
2. Copy each populated surface spec into `finish_selection` rows (tile, grout, metal),
   creating catalog rows on the fly, deduped by manufacturer + name + size.
3. Keep the legacy columns read-only for one sprint, then drop.
4. `project_surfaces` ends as pure structure (name, kind, qty, status).

## 6. Screens

- **Project → Tiles & Finishes**: area list → surface list → selection panel (3-column,
  reuses the current `scope` route layout, which is good and should be kept + modified).
- Selection panel: select-first pickers over the catalog, with "New product" inline.
- Per-surface completeness chip and a project-level "selections confirmed" rollup feeding
  readiness.
- **Settings → Product catalog**: manufacturers, collections, products, suppliers.
