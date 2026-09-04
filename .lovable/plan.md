# Complete Daily Experience Redesign

## Goal
Rebuild the daily Job Operations experience around Project, Task, and Update while preserving all production data, backend contracts, routes, history, assignments, schedules, and files.

## Locked visual direction
- Ink & Steel palette: warm #F4F3EF canvas, #FCFCFB surfaces, #1B1D20 text, #345B87 action blue, #E0E8EF selected states.
- Sora headings and Manrope body.
- Slim permanent sidebar and calm operational workspace.
- Premium Calm Workspace composition: comfortable density, generous task surfaces, restrained motion.

## Implementation sequence
1. Inventory existing data hooks and mutation contracts for tasks, projects, updates, schedules, files, and people.
2. Establish shared tokens, typography, navigation, responsive shell, action surfaces, and reusable task/project primitives.
3. Rebuild global and project-scoped Capture as a one-question flow with optional post-save assignment, date, and importance.
4. Rebuild the Task drawer/sheet around Move Forward and Complete, with progressive Keep Open, Waiting, Next Step, and Done outcomes.
5. Rebuild Today as a personal command center and Work as collapsible project/person task surfaces with inline owner/date actions.
6. Replace the Projects table with a responsive project-card grid and redesign the Project shell, Overview, Work, Updates, Files, and guided Daily Update.
7. Refine Schedule for weekly desktop and one-day mobile use, including project links and update-state indicators when available.
8. Validate at 1440×900, 1280×800, 390×844, and 430×932; capture every requested acceptance state.

## Technical constraints
- No schema migrations, reseeding, data deletion, or business-module additions.
- Reuse existing work item status values and backend mutations; preserve legacy values.
- Use existing TanStack routes and Lovable Cloud clients.
- Keep cached data visible during navigation and use optimistic mutations for star, owner, date, and completion.
- Fix existing hydration and date-picker runtime faults as part of the affected surfaces.

## Acceptance
- Capture is usable in 5–8 seconds.
- A task update is possible in under 15 seconds without seeing a full form.
- Daily Update is a three-step mobile-first flow.
- No horizontal scrolling or tiny controls on target mobile widths.
- Browser Back restores route/search state and the core screens remain responsive and error-free.
