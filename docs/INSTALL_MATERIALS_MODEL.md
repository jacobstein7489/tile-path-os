# Install Materials Model

Cobblestone-supplied installation materials only — never tile or finishes.

Categories: thinset · mortar · mud · portland · sand · primer · self-leveler · membrane ·
waterproofing · mesh/lath · leveling systems · spacers · sealants · protection ·
other consumables.

## 1. Workflow (single source of truth)

```text
Need → On-hand check → Order / PO → Expected → Partial receipt → Received
     → Delivered to project → Ready
```

Statuses on `material_requirement`: `Needed · Checking Stock · To Order · Ordered ·
Expected · Partially Received · Received · Delivered · Ready · Waived`.
Status is **derived** from quantities + PO state + delivery records, never typed.

Derivation (extends the existing `materialStatusFrom` helper):

```text
required = required_qty
if waived            → Waived
if delivered ≥ required → Ready
if received ≥ required  → Received (Delivered pending)
if received > 0         → Partially Received
if po sent/confirmed    → Ordered / Expected (if expected_date set)
if on_hand ≥ required   → Ready (from stock)
if required > 0         → To Order
else                    → Needed
```

## 2. Quantities and derivation

`required_qty` (from takeoff + coverage rules) · `on_hand_qty` (warehouse/truck stock) ·
`ordered_qty` (sum of PO lines) · `received_qty`, `damaged_qty`, `wrong_qty` (sum of
append-only receipts) · `delivered_qty` (sum of deliveries).

`required_qty` may be computed by rule: e.g. thinset bags =
`ceil(surface_sf / coverage_per_bag * (1 + waste))` per installation system. The estimator/PM
can override with a note (override is data, not a silent edit).

## 3. Commitments (generalized purchase orders)

Purchases are **not** material-only. One model covers every outbound commitment:

`commitment`: kind (`material` | `finish` | `labor` | `service`), vendor_company_id,
vendor_contact_id?, project_id? (null for stock POs), number, status
`Draft → Sent → Confirmed → Partial → Received/Performed → Closed → Cancelled`, value,
expected_date, approved_by_user_id, approved_at, created_by_user_id, notes.

`commitment_line`: commitment_id, line kind, reference — `material_requirement_id`,
`finish_procurement_requirement_id`, or `work_item_id` (labor/service, e.g. return work) —
description, qty, uom, unit_cost?, total?, notes.

- The existing `purchase_orders` / `po_lines` tables are the material-only ancestor of this
  model and are migrated into it, not extended sideways.
- PO builder starts from selected requirement lines ("Order these 6 needs") — the current
  `CreatePoModal` flow is the right idea and should be kept + modified.
- Finish lines reference the **consolidated** procurement requirement, so one tile order can
  satisfy many surfaces (see TILES_AND_FINISHES_MODEL.md §4).
- Sending a commitment advances every linked NEED work item to the Expected step.

### Labor commitments and return work

Return work needs a purchase path before the Commercial sprint:

```text
Return work identified → installer selected → installer price entered
  → price approved (role-gated) → labor commitment issued → scheduled
  → performed → verified → closed
```

Approval is an explicit recorded event (`approved_by_user_id`, `approved_at`), not a status
someone types. Money visibility on labor commitments respects `role.can_see_money`.


## 4. Receiving (append-only, non-negotiable)

Each receipt is an immutable row: date, qty good, damaged, wrong, packing slip #,
received_by user, notes, optional photo. Receipts never overwrite; totals recompute.
Damaged/wrong quantities auto-create an ACTION work item ("Replace 2 damaged bags — claim
with supplier") owned by the office coordinator.

## 5. Delivery to project

Separate from receipt: material can be received at the shop and delivered later.
`material_delivery` closes the loop and is what flips a requirement to **Ready**, which is
what project readiness checks.

## 6. Screens

- **Global Install Materials**: tabs `Needs Attention · Requirements · Purchase Orders ·
  Receiving · Catalog`. One dense table per tab, row → drawer. KPI strip reduced to at most
  four quiet counts.
- **Project → Install Materials**: same rows filtered to the project, grouped by
  area/surface where relevant, with a "what's blocking readiness" summary line.
- **Settings → Install material catalog**: items, default suppliers, coverage rates.

## 7. Migration from current data

`material_items` becomes `material_requirement` (add `on_hand_qty`, `delivered_qty`,
`install_material_id`, `supplier_company_id`); category values map to the new enum; text
suppliers become `company` rows. `purchase_orders`, `po_lines`, `material_receipts` are
kept as-is structurally (receipts already append-only with INSERT/SELECT-only policies —
good). Existing "Install Material Need" work items link via `linked_requirement_id`.
