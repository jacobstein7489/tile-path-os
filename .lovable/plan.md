# Cobblestone Tile OS — Product Freeze Blueprint (plan only)

No code, schema, data, or roadmap changes in this turn. This is the candidate final blueprint for one correction pass, then freeze.

## 1. Audit against the frozen model (verified in code)

Already built and worth keeping:
- Lifecycle engine `src/lib/lifecycle.ts` — seven controlled stages: Approved, Setup, Ready, Scheduled, Installation, Punch / Return, Complete, plus On Hold / Cancelled / Lost, legacy stage mapping, and entry gates.
- Work engine `src/lib/workitems.ts` (645 lines) — four user statuses (To Do, In Progress, Waiting, Done) mapped from legacy stored statuses, eight action categories, per-type workflows with next actions, overdue/waiting/due-today logic, today buckets, sorting, company feed.
- Readiness engine `src/lib/readiness.ts` — derived requirements keyed per project/scope/requirement with met / blocked / not_evaluated and a summary; no manual percentage.
- Finish model `src/lib/finishes.ts` — zone, reusable project-scoped selection, per-zone assignment, multi-surface application.
- Design meeting `src/lib/designmeeting.ts` — data-driven question rules, allowlisted write targets, validation, confirm decision, single reusable unresolved Work Item, session tracking.
- Materials `src/lib/data.ts` — material items, purchase orders, append-only receipts, derived status from receipt history.
- Field reports `src/lib/fieldreports.ts`, installer packages `src/lib/packages.ts` with immutable revisions, people/roles `src/lib/people.ts`, commissions `src/lib/commissions.ts`.
- Projects list and project shell (just validated) are the visual reference point.

Presentation to be replaced later (data/services kept):
- `today.tsx`, `work.tsx`, `WorkList.tsx`, `WorkItemDrawer.tsx`, `projects.$projectId.index.tsx`, `.scope.tsx`, `.design.tsx`, `materials.tsx`, `.install-materials.tsx`, `.tiles.tsx`, `.field.tsx`, `.schedule.tsx`, `.updates.tsx`, `.package.tsx`, `schedule.tsx`, `commissions.tsx`, `settings.tsx`, plus `QuickCapture.tsx` (1177 lines, over-scoped) and `kit.tsx` remnants (`ProgressBar`, KPI/card primitives).

True model gaps that block the frozen experience:
1. No explicit Move Forward transaction — status/waiting-on/follow-up/event write is spread across drawer JSX rather than one service.
2. Material requirement has no seven-step state field; status is derived from quantities only (Needed, To Order, Ordered, Partially Received, Received, Ready) — "Confirm spec/count", "Waiting/ETA", and "On Site" are not represented.
3. Punch / Return exists as work-item types and a stage but has no dedicated list surface.
4. Receiving has receipts but no shade/lot/caliber/photo capture (already logged as Sprint 2 gap).
5. Workflow Rules are seeded rows with no Settings editor.
6. Schedule is crew assignments only; Ready to Schedule queue and return-work lane are not surfaced.
7. Pre-award `leads.*` routes exist though estimating is out of scope — decide retire vs hide.

## 2. Canonical screen blueprint

Shared shell: 216px light sidebar (Today, Work, Projects, Schedule, Materials, More → Commissions, Reports, Settings), 48px header, warm canvas, white work surfaces, lists before cards.

- Today — three sections only: Needs you now, Follow-ups due, Scheduled today. One quiet line of counts, no KPI strip. Rows open the Work drawer.
- Work — company actions, group toggle By Project / By Person, max five rows per group with "View all N". Sticky one-line control bar: group toggle, mine/all, search.
- Projects — flat operations list: Project, Stage, Next Move, Crew/Owner, Relevant Date, Attention; search plus Active / Upcoming / On Hold / Completed. No progress before Installation.
- Project Overview — narrow document column: current state line, one Next Move, up to three Waiting rows, Latest Update, derived Setup/Readiness status with click-through, Upcoming. No cards.
- Rooms / Surface workspace — desktop room rail → surface list → dominant surface workspace (tile/product, grout, metal/saddle/trim, measurements, layout, prep/waterproofing, finish/height, instructions, photos, readiness). Mobile drill-down.
- Setup views — Setup (stored stage) contains two explicit operational views: Design & Decisions and Readiness. Neither is a stored stage; readiness stays derived.
- Design / Site Meeting capture — launched from Update / meeting actions, history lives in Updates; not a permanent destination. One question at a time with known-facts strip, Confirm writes to the surface via the allowlisted target map, Unresolved reuses exactly one Work Item with owner, waiting-on, follow-up date.
- Work Item drawer — same right drawer on desktop, bottom sheet on mobile, opened identically from Today, Work, Project. Header identity, Move Forward block first, then details, then history. Scroll and selected row preserved.
- Move Forward flow — single control: what happened (note) plus what happens next (To Do / Waiting with waiting-on and follow-up date / Scheduled with date / Done). Writes status, fields, and one history event in one call.
- Materials / procurement — one global workspace with two distinct subsections inside it: Tiles & Finishes and Install Materials. Rows are requirements in the seven frozen states; actions Confirm spec/count, Order, Set ETA, Receive, Mark on site.
- Receiving — from a PO or requirement: quantity good/damaged, packing slip, note; appends a receipt and recomputes requirement state. Shade/lot/photo deferred.
- Schedule & Crews — week grid by crew, Ready to Schedule queue rail on the left, return-work lane. Crews, not per-installer task lists.
- Installation / Field — daily update capture per project, progress by room/surface, suggested Work Items from the update, and installer-package handoff (published documents also appear in Files).
- Punch / Return — filtered list of punch/return work items across projects, grouped by project, same drawer.
- Settings / Workflow Rules — existing Users, Companies, Contacts, Crews tabs plus a read-only, inspectable Workflow Rules tab (question rules and readiness requirement keys). Editing is a later controlled gate.
- Commissions — flat list per salesperson with plan snapshot and status; no dashboard cards.
- Pre-award leads — routes and data stay intact but are hidden from daily approved-to-complete navigation. Nothing deleted.
- Mobile purpose-built: bottom nav Today, Work, +, Projects, More; compact rows; Capture sheet; Move Forward sheet; Site Meeting one-question flow; Material Need quick form.

## 3. Object-flow map (one record, many views)

```text
PROJECT ───────── Projects list · Project Overview · Schedule · Materials filter
   │
   ├── ROOM ──── Rooms rail
   │      └── SURFACE ─ Surface workspace · Design Meeting target · Installer
   │                    package · Field progress · Punch item scope
   │
   ├── WORK ITEM ─ Today (owner + date) · Work (project/person group) ·
   │               Project Work · Punch list · Drawer · Move Forward
   │               (one row; every screen is a filter, never a copy)
   │
   └── MATERIAL REQUIREMENT ─ Project Materials · global Materials ·
                              PO · Receiving · readiness blocker ·
                              optional linked Work Item (1:1, not duplicated)
```

Rules: Work Items are never re-created per view; readiness blockers link to the requirement or work item that causes them; permanent decisions live on the surface, not in comments.

## 4. Implementation order after approval

1. Move Forward service + Work Item drawer (unblocks Today, Work, Project Work). Gate: one status change writes one event and resurfaces on follow-up date.
2. Today. Gate: only signed-in person's rows, three sections, optimistic Completed — Undo.
3. Work grouped by Project / Person. Gate: five-row groups, View all N, drawer parity with Today.
4. Project Overview. Gate: one Next Move, max three Waiting, derived readiness click-through.
5. Rooms / Surface workspace. Gate: instructions persist on the exact surface, mobile drill-down.
6. Design / Site Meeting capture. Gate: confirm writes to surface, unresolved reuses exactly one Work Item.
7. Materials states + Receiving. Gate: requirement moves Need → Ready with append-only receipts. (Needs the state decision in section 5.)
8. Schedule & Crews with Ready to Schedule queue. Gate: assignment appears on project and Today.
9. Field / Installation, then Punch / Return list.
10. Settings Workflow Rules (read-first), then Commissions.

Every gate: typecheck, 1440×900 / 1280×800 / 390px with no overflow, no production records created for QA, real 114 Park Place data.

## 5. Resolved decisions — final stored vs user-facing mappings

**Lifecycle (no new stored stages).** Stored: Approved, Setup, Ready, Scheduled, Installation, Punch / Return, Complete (+ On Hold, Cancelled, Lost). User-facing copy: `Ready` displays as **Ready to Schedule**; all others unchanged. Setup contains two views only — Design & Decisions and Readiness. Readiness stays derived from `readiness_requirement` and never changes stage.

**Work status.** Final user-visible states: To Do → Waiting → Scheduled → Done. `In Progress` is removed from the user-facing model. Stored values are preserved as-is; mapping:

| Stored | User-facing |
| --- | --- |
| Scheduled | Scheduled |
| Waiting, Expected | Waiting |
| Complete, Done | Done |
| Open, Price Needed, Crew Needed, Measurement Needed, Test Needed, To Order, Setup Needed, Needs Pricing, In Progress, any other active value | To Do |

Move Forward writes only these four target states (plus waiting-on / follow-up date / scheduled date) and appends one history event. No production status normalization.

**Work types.** Stored types stay unchanged. Creation UX exposes five intents:

| Intent | Stored type written | Also displayed as this intent |
| --- | --- | --- |
| Action / Task | Task | Approval, Potential Change |
| Question / Decision | Question / Decision | — |
| Material Need | Install Material Need | Tile Follow-up |
| Field Verification / Dependency | Field Verification | Dependency |
| Punch / Return | Punch / Return Work | Return Work |

**Navigation.** Global: Today · Work · Projects · Schedule · Materials · More (Commissions · Reports · Settings). Project: Overview · Rooms · Work · Files · More (Updates · Materials · Schedule · Field · Commercial). Tiles & Finishes and Install Materials are subsections of project Materials. Installer Package lives under Field handoff, published documents also listed in Files. Design/Site Meeting is an action, history in Updates. Pre-award leads: routes and data kept, hidden from daily navigation.

**Workflow Rules.** Read-only inspection in Settings first; editing is a later controlled gate.

## 6. Material lifecycle — derivable now vs smallest schema gap

Existing fields on `material_items`: `required_qty`, `ordered_qty`, `received_qty`, `damaged_qty`, `expected_date`, `status`, `next_step`, `notes`, plus append-only `material_receipts`.

| Frozen state | Derivable today? | Basis / gap |
| --- | --- | --- |
| Need | Yes | `required_qty` null/0 or no order activity |
| Confirm Spec/Count | **No** | needs a confirmation marker (smallest addition: `spec_confirmed_at timestamptz`) |
| Order | Yes | `ordered_qty > 0` |
| Waiting / ETA | Yes | ordered and `received_qty < required_qty`, ETA from `expected_date` |
| Receive | Yes | receipts exist and `received_qty < required_qty` (partial) |
| On Site | **No** | receiving to shop vs delivered to jobsite is indistinguishable (smallest addition: `on_site_qty numeric` or `on_site_at timestamptz`) |
| Ready | Yes | `received_qty >= required_qty` with no unresolved damage |

Recommended smallest later migration (not in this turn, requires its own approved gate): two columns on `material_items` — `spec_confirmed_at` and `on_site_at` (or `on_site_qty`). Until approved, the Materials UI shows five honest states and labels the two unsupported ones as unavailable rather than faking them.

## 7. Remaining true technical unknowns (require inspection, not product decisions)

1. Whether every legacy stored work-item status in production maps cleanly under the table above — needs a distinct-value read before the Move Forward build.
2. Whether readiness requirement keys currently cover both Design & Decisions and Readiness views for all live projects, or only 114 Park Place.
3. Whether existing surfaces have plan/photo attachment paths available for the Surface workspace photo section.
4. Whether `expected_date` is populated consistently enough on live material rows to drive the Waiting/ETA state.
