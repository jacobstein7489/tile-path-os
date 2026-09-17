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
- Materials / procurement — global workspace summarizing two distinct tracks: Tiles & Finishes and Install Materials. Rows are requirements in seven states; actions Confirm spec, Order, Set ETA, Receive.
- Receiving — from a PO or requirement: quantity good/damaged, packing slip, note; appends a receipt and recomputes requirement state. Shade/lot/photo deferred.
- Schedule & Crews — week grid by crew, Ready to Schedule queue rail on the left, return-work lane. Crews, not per-installer task lists.
- Installation / Field — daily update capture per project, progress by room/surface, suggested Work Items from the update.
- Punch / Return — filtered list of punch/return work items across projects, grouped by project, same drawer.
- Settings / Workflow Rules — existing Users, Companies, Contacts, Crews tabs plus a read-first Workflow Rules tab (question rules and readiness requirement keys) — editing is a later gate.
- Commissions — flat list per salesperson with plan snapshot and status; no dashboard cards.
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

## 5. Contradictions and unresolved decisions (not improvised)

1. Stage count: your scope lists nine stages (adds Design / Decisions, Readiness, Ready to Schedule); code has seven controlled stages, and readiness is deliberately derived, not a stage. Recommend keeping seven stored stages and presenting Design/Decisions and Readiness as views inside Setup. Needs your call.
2. Material lifecycle: seven requested states vs quantity-derived status today. Adding "Confirm spec/count", "Waiting/ETA", "On Site" needs a stored state column — that is a schema change, so it must wait for an approved migration gate.
3. Work Item statuses: users see four; twelve legacy stored statuses remain mapped. Confirm we keep the mapping rather than normalizing stored data.
4. Ten work-item types remain vs the earlier "five types" simplification. Confirm the final type list.
5. Project More holds Updates, Materials, Schedule, Field, Commercial; today there are also Tiles, Install Materials, Package, Tasks routes. Confirm Tiles & Finishes and Installer Package placement inside More.
6. Pre-award `leads.*` routes: retire or keep hidden?
7. Workflow Rules editing: read-only display now, or an editor in the same pass?
