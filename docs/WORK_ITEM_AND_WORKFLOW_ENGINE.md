# Work Item and Workflow Engine

One record type for everything a human must do. Every list in the app is a filter over it.

## 1. User-facing model (what people see)

**Kinds (5):**

| Kind | Plain meaning |
| --- | --- |
| ACTION | something to do |
| QUESTION | a decision or answer needed |
| NEED | a material/product/resource must be obtained |
| CHANGE | potential/actual change to scope or price |
| PUNCH / RETURN | rework or completion after install |

**Statuses (5):** OPEN · IN PROGRESS · WAITING · BLOCKED · DONE.

Everything more specific ("Price Needed", "Measure saddle", "Waiting for supplier",
"Ready for return") is a **workflow step** or the **Next Action** text — never a status.

Fields shown to users: Project · What needs to happen · Owner · Waiting On · Status ·
Next Action · (Needed by, only when meaningful).

## 2. Internal model (what the system tracks)

`work_item.kind` (5 values) + `work_item.internal_subtype`, e.g.
`field_verification`, `dependency`, `install_material_need`, `tile_followup`,
`return_work`, `approval`, `decision`, `change_order_candidate`, `setup_task`.

Subtype drives: which workflow applies, which icon/labels appear, which module surfaces it,
and which reports count it. It is set automatically (from source/rule/template), and is
editable only by admins in an "advanced" section of the drawer.

Derived-only fields: `is_blocking` (question blocking readiness), `age_days`,
`is_overdue`.

## 3. Workflow engine

```text
workflow_key → ordered steps → per-step { label, next_action, owner_role, on_enter, exit_condition }
```

Definitions live in code (`src/lib/workflows/*.ts`) in v1, with the table shape ready to
move to the database (Settings → Workflows) in a later sprint.

Canonical workflows:

| Key | Steps |
| --- | --- |
| `return_work` | Scope → Installer → Price → Approve → Labor PO → Schedule → Perform → Verify → Close |
| `punch` | Identify → Assign → Schedule → Perform → Verify → Close |
| `field_verification` | Measure → Record dimensions → Order → Confirm order → Receive → Schedule install → Install → Verify |
| `install_material_need` | Need → On-hand check → Order / PO → Expected → Receive → Deliver to site → Ready |
| `dependency` | Waiting on trade → Trade says ready → Field verify → Release affected work |
| `question_decision` | Asked → Answer received → Confirmed → Applied |
| `change` | Identified → Priced → Submitted → Approved/Rejected → Applied to scope |
| `tile_followup` | Ordered/expected → Confirm receipt → Verify correct → Close |

Rules:

1. Steps advance **on data, not on typing**. Entering a price advances `return_work` from
   Price to Approve. Creating the PO advances to Schedule. Logging a receipt advances a
   need to Deliver. Marking a schedule assignment done advances to Verify.
2. Status is derived from step + waiting: a step whose owner is external ⇒ WAITING; a step
   whose blocking dependency is unmet ⇒ BLOCKED; final step ⇒ DONE.
3. `next_action` is always the current step's `next_action` string — the single sentence
   shown on Dashboard.
4. Every transition writes a `work_item_event` (append-only).
5. Manual override exists (advance/step-back) but requires a note; the note is history.

## 4. Cross-module linkage (one record, many views)

| Link | Effect |
| --- | --- |
| `linked_requirement_id` | need appears on project Install Materials and global Install Materials |
| `linked_selection_id` | tile follow-up appears on Tiles & Finishes |
| `linked_change_id` | change appears on Commercial |
| `area_id` / `surface_id` | item appears on Field, and blocks that area/surface |
| `owner_user_id` | item appears on that person's My Work |
| open + any project | item appears on Company Work |

Never duplicate rows across modules. Modules render filtered views and open the same drawer.

## 5. Interaction contract

- Whole row clickable → right-side drawer. No page navigation.
- Drawer sections: header (project · area/surface · kind chip) → description → Owner /
  Waiting On / Status / Needed by (inline editable, select-first) → **Next Action with the
  primary button that advances it** → subtle step sequence with only the current step
  emphasized → History (append-only) → Files/Photos.
- Completion: instant optimistic strike-through, row stays with "Completed — Undo" for
  ~6s, then moves to Completed. Toast: "Marked complete".
- Creation paths: Quick Capture (raw text → split into items), module context buttons
  ("Request material" from a surface pre-fills project/area/surface), rules engine
  (auto-created requirement items), field visit checklist.

## 6. Migration from current taxonomy

Current 10 types → kind / internal_subtype:

| Current type | kind | internal_subtype |
| --- | --- | --- |
| Task | ACTION | setup_task |
| Question / Decision | QUESTION | decision |
| Dependency | ACTION | dependency |
| Field Verification | ACTION | field_verification |
| Install Material Need | NEED | install_material_need |
| Punch / Return Work, Return Work | PUNCH | punch / return_work |
| Potential Change | CHANGE | change_order_candidate |
| Approval | QUESTION | approval |
| Tile Follow-up | NEED | tile_followup |

Current 12 statuses → status + workflow step:

| Current | status | step / next action |
| --- | --- | --- |
| Open | OPEN | first step |
| Waiting, Expected | WAITING | current step retained |
| Price Needed | IN PROGRESS | Price → "Get price from <contact>" |
| Crew Needed | IN PROGRESS | Installer → "Assign installer" |
| Measurement Needed | IN PROGRESS | Measure → "Measure on site" |
| Test Needed | IN PROGRESS | Measure/Test → "Perform test" |
| To Order | IN PROGRESS | Order / PO → "Place order" |
| Setup Needed | OPEN | Setup → "Schedule setup meeting" |
| Needs Pricing | IN PROGRESS | Priced → "Price change" |
| Scheduled | IN PROGRESS | Schedule → "Perform work" |
| Complete | DONE | Close |

The existing `WORKFLOWS` map in `src/lib/workitems.ts` is a good base and should be
refactored, not rewritten: add step metadata (owner role, exit condition, on_enter effects)
and data-driven advancement.
