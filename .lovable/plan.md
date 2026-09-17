# Production Experience Pass

## Scope
Apply the frozen Cobblestone visual and interaction system to the existing production-connected routes without changing schema, business logic, permissions, records, or module boundaries.

## Build
1. **Global shell** — standardize the desktop sidebar to Today, Work, Projects, Schedule, Materials, More; remove Bulk Import from permanent navigation; preserve the mobile Today, Work, +, Projects, More bar and the existing capture flow.
2. **Core lists** — align Today and Work around the canonical WorkList and WorkItemDrawer; retain project/person grouping, project headings, limited visible actions, and existing Move Forward behavior.
3. **Projects** — replace progress-oriented presentation with a calm operational table and purpose-built mobile rows. Derive Next Move, Attention, and Relevant Date only from existing Work, readiness, schedule, and project dates; show a quiet dash when no reliable value exists.
4. **Project workspace** — keep Overview, Rooms, Work, Files plus More; place Updates, Materials, Schedule, Field, and Commercial in More while keeping Design Meeting and Installer Package accessible as setup tools rather than permanent tabs.
5. **Overview and Rooms** — tighten the existing document-style overview; strengthen Rooms as a three-pane operational workspace at comfortable widths. At tighter desktop widths, combine or collapse navigation so the selected Surface remains dominant, with no horizontal scrolling. Keep meaningful readiness reasons, compact surface facts, and drawer-based editing.
6. **Design Meeting** — preserve the working one-question flow and data behavior while refining desktop focus, mobile actions, known information, and decision navigation.
7. **Installer package** — keep immutable publishing and improve both on-screen review and printed room sheets, moving missing critical facts into one concise “Open / Confirm with office” section.
8. **Legacy cleanup** — verify imports before removing only inactive duplicate presentation paths; keep the single live capture path and all underlying routes/data.

## Verification
- Run focused type checks and inspect runtime logs.
- Exercise Today, Work, Projects, 114 Park Overview, Rooms, Design Meeting, Work drawer, readiness, installer publishing history, and print output without creating production records. Use the archived QA clone or reversible QA data only if mutation is required.
- Verify 1440×900, 1280×800, and 390px layouts with no horizontal overflow or dead controls.
- Capture canonical desktop and mobile screenshots plus the printed room sheet from the actual connected routes; create no alternate or mockup screens.
- Confirm normal production record counts and RLS/permissions remain unchanged by UI verification.
- Stop after this pass; do not begin Materials or any later business-module sprint.
