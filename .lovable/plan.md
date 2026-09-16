# UI Surgery Pass 1

## Scope
Replace the frontend composition of exactly these project screens:

1. Project shell
2. Project Overview
3. Rooms / Surfaces
4. Design Meeting

No database, permissions, readiness engine, work engine, question-rule schema, procurement, schedule, field-report, or production-record changes. Today, Work, Updates, Materials, Schedule, Field, Punch, Commissions, and Reports remain untouched.

## Non-negotiable visual acceptance
- This is a structural recomposition, not a component substitution or token restyle.
- The finished screens must look materially different from the rejected implementation.
- Do not preserve the existing card/grid JSX hierarchy and merely change spacing, borders, radii, shadows, or colors.
- Overview must read as one calm operational document: one prominent Next Move followed by naturally separated Waiting, Latest Update, Setup Status, and Upcoming sections. No equal-box dashboard composition.
- Rooms must read as one continuous three-pane workspace on desktop, not three cards placed in a grid.
- Design Meeting must read as a focused decision workspace, not a form inside a card.

## Build

### Project shell
- Remove the permanent lifecycle rail and nested lifecycle track.
- Keep a compact project identity block, quiet address/customer/PM metadata, Overview / Rooms / Work / Files / More navigation, Update menu, and project More menu.
- Turn the stage label into the single entry point for current-stage detail and controlled advancement, using the existing lifecycle rules and project update mutation.
- Keep the header compact across desktop and mobile.

### Project Overview
- Replace the card dashboard with one white workspace divided by typography, whitespace, and thin rules.
- Derive one Next Move in this order: required setup/readiness action, overdue or high-priority work, follow-up due, then upcoming scheduled action.
- Show no more than three Waiting rows, one Latest Update section, a compact Setup Status list, and Upcoming.
- Add a right-side readiness drawer. Its first view groups requirements into the six existing categories with counts and status. Selecting a category reveals only its Room → Surface details.
- Never expose percentages, progress bars, KPI tiles, or the raw full requirement list.

### Rooms / Surfaces
- Rewrite the screen as a continuous three-pane desktop workspace: Rooms, Surfaces, Surface Workspace. Use borders, not pane cards.
- Keep mobile as a drill-down: Rooms → Surfaces → selected Surface.
- Rooms show surface counts and meaningful readiness language only. Plan opens the existing Plan Reference experience without occupying the surface list.
- Surfaces show one concise specification or missing-information summary, never manual status/progress.
- Surface Workspace gets Specification, Layout, Measurements, Prep, and Photos & Notes tabs with definition-list rows and only operationally important missing values.
- Hide default-zone terminology for one-finish surfaces. Show a compact finish-area selector only when multiple zones exist.
- Replace the giant edit modal with a right drawer using the same five categories and only that category’s fields.
- Keep Edit primary. Move Add issue, Request material, Add finish area, and Archive into overflow. Remove Confirm detail and equal-weight permanent actions.
- Preserve existing room/surface creation and all current finish selection/assignment writes.

### Design Meeting
- Filter the existing applicable questions to `Design decisions` only. Office Setup / Finish Specification targets and metadata never enter this flow.
- Build a desktop surface rail grouped by room, showing unresolved counts or Ready. Selecting a surface opens its next unresolved design decision.
- Show one question at a time with a compact known-information strip.
- Render 2–5 choice and yes/no answers as large buttons; render text and number inputs only when required.
- Remove the progress bar and dropdown-based simple choices.
- Keep Confirm & Next and existing allowlisted writes and decision logging.
- Put “Can’t decide” in a small drawer with note and existing follow-up fields where supported, while preserving exactly-one-Work-Item reuse.
- On mobile, use a full-screen single-decision flow with fixed bottom actions.

## Verification
- Confirm no `SectionCard`, `ProgressBar`, `DetailCard`, generic `SURFACE_FIELDS` modal, `LifecycleRail`, or `LifecycleTrack` remains in these four presentations.
- Verify Design Meeting contains only genuine design-decision rules and never SKU, manufacturer, supplier, product identification, or other Office Setup facts.
- Verify existing updates, room/surface creation, finish mapping, design confirmation, unresolved Work reuse, and stage gating still use their existing data paths.
- Run the focused typecheck and browser checks with no production-data mutation.
- Capture and inspect:
  - 1440×900: Overview, Rooms Specification, Rooms Layout, Design Meeting
  - 390px: Rooms, Design Meeting
- Return the screenshots, changed files, acceptance results, and any failures, then stop before all unrelated screens and Sprint 2.
