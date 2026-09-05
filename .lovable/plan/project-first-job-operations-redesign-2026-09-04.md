# Project-First Job Operations Redesign

## Goal
Rebuild the daily Job Operations experience with the Project/Job as the main operating object. Rooms, Deliveries, Schedule, Tasks, Files, readiness, and Daily Updates support the job rather than replacing it as the center of the product. Preserve all production data, backend contracts, routes, history, assignments, schedules, and files.

## Locked visual direction
- Keep the selected Premium Calm Operations Workspace direction.
- Ink & Steel palette: warm #F4F3EF canvas, #FCFCFB surfaces, #1B1D20 text, #345B87 action blue, #E0E8EF selected states.
- Sora headings and Manrope body.
- Slim permanent desktop sidebar, calm operational density, restrained motion, and clear visual hierarchy.

## Product hierarchy
1. **Project/Job** — primary object and navigation context.
2. **Project readiness and next move** — immediate operational state.
3. **Rooms, Deliveries, Schedule, Tasks, Files, and Daily Updates** — supporting job workflows.
4. **Today** — a personal command center that brings assigned work, scheduled jobs, reminders, and missing updates together without becoming the product’s primary data model.

## Navigation lock
- Global navigation stays: Dashboard, Today, Projects, Schedule, Deliveries, Settings.
- Project navigation stays: Overview, Rooms, Deliveries, Schedule, Tasks, Files.
- Daily Updates and activity surface contextually, not as a permanent tab.
- Work remains a secondary/contextual view; not promoted to global navigation.

## Implementation sequence
1. Inventory and preserve existing project, room/area, delivery/material, schedule, task, file, readiness, people, and field-report contracts.
2. Establish shared design tokens, Sora/Manrope typography, navigation, responsive shell, operational surfaces, and consistent loading/empty states.
3. Rebuild **Projects** as a compact operational table on desktop, matching the selected direction. Use project cards only on mobile. Keep live next move, stage/readiness, ownership, dates, and attention state concise and scannable.
4. Rebuild the **Project shell and Overview** as the job command center: compact identity/readiness header, rooms and field context, deliveries, schedule, open tasks, files, latest Daily Update, blockers, and one clear next move. Preserve the existing lifecycle and child routes while simplifying presentation.
5. Keep **fast Capture** as a one-question global or project-scoped flow, with optional assignment, due date, and importance after the first save. Keep Bulk Import separate.
6. Keep the **simplified task drawer** with Move Forward and Complete as the primary actions, progressively revealing Keep Open, Waiting, Next Step, and Done outcomes. Reuse existing status mappings and audit events.
7. Rebuild **Today** as a personal command center for assigned work, scheduled jobs, reminders, and missing Daily Updates. Retain the shared task behavior and optimistic inline owner/date/important/complete actions.
8. Refine **Work** as a supporting cross-project task view with grouped/list modes, project context, inline owner/date actions, and the same task interaction model used inside a Project.
9. Rebuild **Daily Update** as a guided three-step mobile-first flow: site status, blockers/materials/next work, then review suggested follow-up tasks before submission.
10. Refine **Schedule** for a weekly desktop view and focused one-day mobile view, with linked jobs, crew context, readiness, and Daily Update indicators where existing data supports them.
11. Validate at 1440×900, 1280×800, 390×844, and 430×932; capture the requested acceptance screenshots.

## Technical constraints
- No schema migrations, reseeding, data deletion, route removal, or new business modules.
- Preserve all existing project-centered domains, including Rooms, Deliveries, Schedule, Tasks, Files, readiness, and Daily Updates.
- Reuse existing work-item status values, workflow mappings, mutations, and event history; preserve legacy values.
- Keep cached data visible during navigation and use optimistic mutations for star, owner, date, and completion.
- Fix the existing hydration mismatch and cross-origin native date-picker fault only where affected by this redesign.

## Acceptance
- Desktop Projects remains a compact operational table; mobile Projects uses stacked cards with no horizontal scrolling.
- Every major supporting workflow maintains visible Project/Job context.
- Capture is usable in 5–8 seconds.
- A task update is possible in under 15 seconds without opening a full form.
- Daily Update is a clear three-step mobile-first flow.
- No horizontal scrolling or tiny controls at the target mobile widths.
- Browser Back restores route/search state, and core screens remain responsive and error-free.
