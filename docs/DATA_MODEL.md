# Data Model

Target: Postgres (Lovable Cloud). All new public tables get GRANTs + RLS + policies in the
same migration. `id uuid pk default gen_random_uuid()`, `created_at`, `updated_at`
(trigger `touch_updated_at`) on all mutable tables unless noted.

Legend: **NEW** = to be created · **EXISTS** = present today · **EXISTS+** = present, needs
columns/normalization.

---

## 1. People and organizations

| Table | State | Key fields |
| --- | --- | --- |
| `profile` | NEW | user_id (auth), full_name, initials, phone, avatar_tone, is_active, default_route |
| `role` | NEW | key (enum `app_role`), label, can_see_money |
| `user_role` | NEW | user_id, role (enum), unique(user_id, role) |
| `company` | NEW | name, kind (customer/gc/designer/supplier/tile_store/installer/trade/other), phone, address, notes |
| `contact` | NEW | company_id?, full_name, title, phone, email, kind, notes, is_active |
| `crew` | EXISTS+ | name, initials, tone, sort_order, is_open_lane, + company_id?, lead_contact_id?, capacity_per_day, is_active |
| `project_participant` | NEW | project_id, role_in_project, user_id?/contact_id?/company_id? |
| `project_assignment` | NEW | project_id, user_id, role_in_project (pm, site_manager, estimator, salesperson) |

## 2. Job spine (permanent physical hierarchy)

| Table | State | Notes |
| --- | --- | --- |
| `project` (`projects`) | EXISTS+ | name, address, project_type, lifecycle_stage, exception_state, dates, archived_at. **Add:** job_number, customer_company_id, gc_company_id, primary_contact_id, pm_user_id, site_manager_user_id, salesperson_user_id, estimator_user_id, commission_user_id, commission_rule_id?, source, bid_due_date, follow_up_date, awarded_at, intake_notes, readiness_pct (derived cache), install_progress_pct (derived cache). **Deprecate (keep read-only through at least the next sprint, do NOT drop in Sprint 1):** crew_lead, project_manager, customer, material_status, needs_attention, next_move, next_move_owner, stage_steps_done |
| `area` (`project_areas`) | EXISTS+ | project_id, name, room_type (ref), level/floor, sort_order, status, notes. Status in Not Ready/Ready/Working/Blocked/Complete. Progress derived from surfaces |
| `surface` (`project_surfaces`) | EXISTS+ | area_id, name, surface_kind (floor/wall/shower_floor/curb/niche/bench/stair/riser/apron/backsplash/other), status, uom (sf/lf/ea), **governing_measurement_id** -> `surface_measurement`, installation_weight?, completed_qty, sort_order, notes. **Deprecated read-only:** plan_qty, field_qty and all tile/grout/metal/prep spec columns (move to `finish_selection` + `requirement_answer`) |
| `surface_measurement` | NEW | surface_id, zone_id?, kind (plan/field), width, height, length, area, uom, source (drawn/manual/imported/field), measured_by_user_id, measured_at, verified_by_user_id?, verified_at?, notes |
| `finish_zone` | NEW | surface_id, name, sort_order, is_default, measurement_id?, offset_x, offset_y, geometry jsonb? -- every surface has exactly one implicit default zone; extra zones appear only when needed |
| `surface_feature` | NEW | surface_id, feature_type (niche, bench, curb, drain, transition, jamb), qty, notes |

Rule: areas/surfaces are created during estimating and reused for the life of the job.
Deletion is soft (`archived_at`) once takeoff or selections reference them.

## 3. Plans, scope, takeoff

| Table | State | Notes |
| --- | --- | --- |
| `plan_set` | NEW | project_id, title, discipline, source (upload/email), is_current |
| `plan_revision` | NEW | plan_set_id, revision_label, issued_date, file_path, page_count, is_current |
| `plan_page` | NEW | plan_revision_id, page_number, sheet_number, title, scale_calibration jsonb, thumbnail_path |
| `plan_region` | NEW | plan_page_id, area_id?, polygon jsonb, label, computed_area_sf |
| `takeoff_line` | NEW | project_id, area_id, surface_id?, plan_region_id?, uom, qty, waste_pct, method (drawn/manual/imported), notes |
| `scope_note` | NEW | project_id, area_id?, surface_id?, body, author_user_id |

## 4. Tile / finish products

| Table | State | Notes |
| --- | --- | --- |
| `product_manufacturer` | NEW | name, notes |
| `product_collection` | NEW | manufacturer_id, name |
| `tile_product` | NEW | collection_id, name, sku, supplier_company_id, nominal_size (label only), actual_w_mm, actual_h_mm, thickness_mm, finish, is_rectified, edge, recommended_joint_mm, pieces_per_carton, sf_per_carton, photo_path, notes. **Caliber/shade are NOT product columns** -- they live on `finish_receipt` (lot reality); the product row holds manufacturer spec defaults |
| `finish_product` | NEW | kind (grout/metal_profile/saddle/threshold/pencil/bullnose/trim/mosaic/sealant_finish), manufacturer_id?, name, sku, supplier_company_id, spec jsonb |
| `finish_selection` (SPEC ONLY) | NEW | project_id, area_id?, surface_id?, zone_id?, kind, tile_product_id?/finish_product_id?, layout_pattern, layout_direction, start_point, joint_mm, grout_color, alignment, spec_status (Draft/Selected/Confirmed/Superseded), confirmed_by, confirmed_at, notes. **No fulfillment states here** |
| `finish_requirement` (FULFILLMENT) | NEW | finish_selection_id, surface_id, zone_id?, required_qty, uom, waste_pct, supplier_company_id?, supplied_by (cobblestone/customer/gc/designer/tile_store), expected_date, allocated_qty, on_site_qty, shortfall_qty, missing_qty, wrong_qty, damaged_qty, order_state (Not Ordered/Ordered/Partially Received/Received/On Site) -- **derived, never typed; there is no `Installed` state** |
| `finish_procurement_requirement` | NEW | project_id, tile_product_id?/finish_product_id?, effective_spec jsonb (attributes that must not be mixed in one order), total_required_qty, waste_pct, cartons, uom, supplier_company_id, expected_date, order_state (derived) -- one aggregate per product per project so many surfaces buy once |
| `finish_allocation` | NEW | procurement_requirement_id, finish_requirement_id, qty, receipt_id?, allocated_by_user_id, notes -- preserves allocation back to originating surfaces/zones |
| `finish_receipt` | NEW (append-only) | commitment_id?, procurement_requirement_id, receipt_date, good_qty, damaged_qty, wrong_qty, missing_qty, **shade_lot**, **caliber**, actual_w_mm?, actual_h_mm?, thickness_mm?, packing_slip, received_by_user_id, photo_path, notes |

Layout math always uses `actual_w_mm`/`actual_h_mm` + `recommended_joint_mm`.

## 5. Install materials

| Table | State | Notes |
| --- | --- | --- |
| `install_material` (catalog) | NEW | category (thinset/mortar/mud/portland/sand/primer/self_leveler/membrane/waterproofing/mesh_lath/leveling/spacers/sealant/protection/consumable), name, sku, default_supplier_company_id, uom, coverage_per_unit, notes |
| `material_requirement` | EXISTS+ (`material_items`) | project_id, area_id?, surface_id?, install_material_id?, name, uom, required_qty, on_hand_qty, ordered_qty, received_qty, damaged_qty, delivered_qty, status, expected_date, supplier_company_id, responsibility, notes. Rename conceptually; keep row data |
| `commitment` (from `purchase_orders`) | EXISTS+ | number, **kind (material/finish/labor/service)**, vendor_company_id (replaces supplier text), vendor_contact_id?, project_id?, status (Draft/Sent/Confirmed/Partial/Received-Performed/Closed/Cancelled), value?, expected_date, approved_by_user_id?, approved_at?, created_by_user_id, notes |
| `commitment_line` (from `po_lines`) | EXISTS+ | commitment_id, line_kind, material_requirement_id? / finish_procurement_requirement_id? / work_item_id? (labor/service e.g. return work), description, qty, uom, unit_cost?, total?, notes |
| `material_receipt` | EXISTS (append-only) | material_requirement_id, po_id?, receipt_date, received_qty, damaged_qty, wrong_qty, packing_slip, received_by_user_id, notes |
| `material_delivery` | NEW | project_id, requirement_id?, delivered_on, delivered_by_user_id, qty, notes |

Receipts stay INSERT/SELECT only; requirement totals are recomputed from receipts.

## 6. Work and process

| Table | State | Notes |
| --- | --- | --- |
| `work_item` | EXISTS+ | project_id, area_id?, surface_id?, **kind** (action/question/need/change/punch), internal_subtype, title, description, owner_user_id (always internal), waiting_on_user_id?, waiting_on_contact_id?, **waiting_on_company_id?** (at most one set, enforced by check constraint), status (open/in_progress/waiting/blocked/done), workflow_key, workflow_step, next_action, priority, needed_by (nullable), impact, source (quick_capture/field/rule/material/schedule), created_by_user_id, completed_at, completed_by_user_id, linked_requirement_id?, linked_selection_id?, linked_change_id? |
| `work_item_event` | EXISTS | append-only history: kind, message, actor_user_id, payload jsonb |
| `work_item_attachment` | NEW | work_item_id, file_path, kind (photo/doc), caption, uploaded_by |
| `quick_capture` | NEW | raw_text, source (whatsapp/email/call/site/meeting), created_by, processed_at, resulting_ids jsonb |
| `rule` | NEW | see RULES_ENGINE.md — scope, conditions jsonb, effects jsonb, is_active, version |
| `requirement_instance` | NEW | project_id, area_id?, surface_id?, rule_id, requirement_key, label, category, is_required, satisfied_by (answer/data/work_item), state |
| `requirement_answer` | NEW | requirement_instance_id, value jsonb, answered_by_user_id, answered_at |
| `readiness_snapshot` | NEW | project_id, computed_at, categories jsonb, readiness_pct, blocking jsonb |

## 7. Schedule

| Table | State | Notes |
| --- | --- | --- |
| `schedule_assignment` | EXISTS+ | project_id, crew_id?, area_id?, work_date, span_days, kind, status (Scheduled/Confirmed/In Progress/Done/Moved), notes, created_by |
| `crew_day_note` | NEW | crew_id, work_date, note (weather, absence, capacity) |
| `visit` | EXISTS+ (`visit_checklist_items`) | promote to `visit` (project_id, visit_date, user_id, purpose, summary) + `visit_checklist_item` (visit_id, label, done, work_item_id?) |

## 8. Commercial

| Table | State | Notes |
| --- | --- | --- |
| `estimate` | NEW | project_id, version, status (Draft/Internal Review/Sent/Accepted/Rejected/Superseded), total, sent_at, accepted_at |
| `estimate_line` | NEW | estimate_id, area_id?, surface_id?, description, qty, uom, unit_price, cost, category |
| `contract` | NEW | project_id, contract_value, signed_at, terms, file_path |
| `change_order` | NEW | project_id, work_item_id?, number, description, qty/uom, price, status (Identified/Priced/Submitted/Approved/Rejected/Void), approved_by_contact_id, approved_at |
| `authorization` | NEW | project_id, kind (deposit/CO/back_charge), amount, approved_by, file_path |
| `commission_rule` / `commission_entry` | NEW (Sprint 12) | user_id, basis, rate, computed amounts |

## 9. Files

| Table | State | Notes |
| --- | --- | --- |
| `file_object` | NEW | project_id?, entity_type, entity_id, bucket_path, filename, mime, size, kind (plan/photo/packing_slip/proposal/co/other), uploaded_by |

Storage buckets: `project-plans` (private), `project-photos` (private), `product-photos`
(public read).

## 10. Derived vs stored

Derived on read (cached in a snapshot/column only for list performance):
area/surface progress, project readiness_pct, setup category completeness, material status,
schedulability, install progress, open-work counts. Never user-editable.

## 11. Migration path from today

1. Add people tables; seed real users; backfill `owner_user_id` from existing text owners.
2. Add `work_item.kind` + 5-value status; map legacy types/statuses (see
   WORK_ITEM_AND_WORKFLOW_ENGINE.md §6) keeping `internal_subtype` and legacy step text.
3. Split spec columns off `project_surfaces` into `finish_selection` (copy only). Legacy
   owner/customer/supplier/status/spec columns stay in place as deprecated, read-only
   rollback data for at least one sprint after the new references prove stable in real use.
   No column drops in Sprint 1.
3b. Add `surface_measurement` + `finish_zone`; backfill one `plan` measurement per surface
   from `plan_qty` and one verified `field` measurement where `field_qty` exists; point
   `governing_measurement_id` at field-if-present else plan.
4. Introduce companies/suppliers, backfill supplier text → `company`.
5. Replace open `USING (true)` policies with role/assignment-based RLS **one table at a
   time**, each with a lockout-safety test (Admin, PM, Site Manager, Office Coordinator, and
   one unauthorized/non-assigned scenario; verify allowed AND denied reads and writes)
   before the open policy is dropped.
5b. Bootstrap exactly one Admin safely; every other internal user arrives through the real
   invitation/onboarding flow. Never invent passwords or shared accounts to complete a seed.
6. Add rules/requirements/readiness tables; compute readiness from them; retire
   `stage_steps_done`.
