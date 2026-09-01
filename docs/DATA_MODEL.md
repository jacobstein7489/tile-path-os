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
| `project` (`projects`) | EXISTS+ | name, address, project_type, lifecycle_stage, exception_state, dates, archived_at. **Add:** job_number, customer_company_id, gc_company_id, primary_contact_id, pm_user_id, site_manager_user_id, salesperson_user_id, estimator_user_id, bid_due_date, awarded_at, readiness_pct (derived cache), install_progress_pct (derived cache), source. **Remove/derive:** crew_lead text, project_manager text, material_status, needs_attention, next_move, next_move_owner, stage_steps_done |
| `area` (`project_areas`) | EXISTS+ | project_id, name, room_type (enum-ish ref), level/floor, sort_order, status, notes. Status ∈ Not Ready/Ready/Working/Blocked/Complete. progress is derived from surfaces |
| `surface` (`project_surfaces`) | EXISTS+ | area_id, name, surface_kind (floor/wall/shower_floor/curb/niche/bench/stair/riser/apron/backsplash/other), status, plan_qty, field_qty, uom (sf/lf/ea), sort_order, notes. **Move out:** all tile/grout/metal/prep spec columns → `finish_selection` + `requirement_answer` |
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
| `tile_product` | NEW | collection_id, name, sku, supplier_company_id, nominal_size, actual_w_mm, actual_h_mm, thickness_mm, finish, is_rectified, edge, recommended_joint_mm, pieces_per_carton, sf_per_carton, caliber, shade_lot, photo_path, notes |
| `finish_product` | NEW | kind (grout/metal_profile/saddle/threshold/pencil/bullnose/trim/mosaic/sealant_finish), manufacturer_id?, name, sku, supplier_company_id, spec jsonb |
| `finish_selection` | NEW | project_id, area_id?, surface_id?, kind, tile_product_id?/finish_product_id?, qty_required, uom, layout_pattern, layout_direction, start_point, joint_mm, grout_color, status (Selected/Confirmed/Ordered/Received/Installed), notes |

Layout math always uses `actual_w_mm`/`actual_h_mm` + `recommended_joint_mm`.

## 5. Install materials

| Table | State | Notes |
| --- | --- | --- |
| `install_material` (catalog) | NEW | category (thinset/mortar/mud/portland/sand/primer/self_leveler/membrane/waterproofing/mesh_lath/leveling/spacers/sealant/protection/consumable), name, sku, default_supplier_company_id, uom, coverage_per_unit, notes |
| `material_requirement` | EXISTS+ (`material_items`) | project_id, area_id?, surface_id?, install_material_id?, name, uom, required_qty, on_hand_qty, ordered_qty, received_qty, damaged_qty, delivered_qty, status, expected_date, supplier_company_id, responsibility, notes. Rename conceptually; keep row data |
| `purchase_order` | EXISTS+ | po_number, supplier_company_id (replaces text), project_id?, status (Draft/Sent/Confirmed/Partial/Received/Closed/Cancelled), expected_date, created_by_user_id, notes |
| `po_line` | EXISTS+ | po_id, material_requirement_id?, finish_selection_id?, description, qty, uom, unit_cost?, notes |
| `material_receipt` | EXISTS (append-only) | material_requirement_id, po_id?, receipt_date, received_qty, damaged_qty, wrong_qty, packing_slip, received_by_user_id, notes |
| `material_delivery` | NEW | project_id, requirement_id?, delivered_on, delivered_by_user_id, qty, notes |

Receipts stay INSERT/SELECT only; requirement totals are recomputed from receipts.

## 6. Work and process

| Table | State | Notes |
| --- | --- | --- |
| `work_item` | EXISTS+ | project_id, area_id?, surface_id?, **kind** (action/question/need/change/punch), internal_subtype, title, description, owner_user_id, waiting_on_user_id?, waiting_on_contact_id?, status (open/in_progress/waiting/blocked/done), workflow_key, workflow_step, next_action, priority, needed_by (nullable), impact, source (quick_capture/field/rule/material/schedule), created_by_user_id, completed_at, completed_by_user_id, linked_requirement_id?, linked_selection_id?, linked_change_id? |
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
3. Split spec columns off `project_surfaces` into `finish_selection` (copy, don't drop
   until verified), keep surfaces as pure structure.
4. Introduce companies/suppliers, backfill supplier text → `company`.
5. Replace open `USING (true)` policies with role/assignment-based RLS.
6. Add rules/requirements/readiness tables; compute readiness from them; retire
   `stage_steps_done`.
