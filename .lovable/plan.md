# Cobblestone Tile OS — V2 Frontend Rebuild

## Objective
Build a genuinely new, production-connected Cobblestone V2 presentation layer for the seven core routes. Preserve the existing database, records, permissions, authentication, data hooks, and business workflows. The old frontend is an implementation reference only and will not determine V2 composition.

## V2 Foundation
1. **New shared presentation layer** — create focused V2 shell, page framing, navigation, operational rows, status language, workspace panes, and detail surfaces instead of incrementally restyling old page components.
2. **Visual system** — light neutral canvas, white working planes, sharp typography, restrained Cobblestone blue, subtle separators, compact spacing, limited radius, almost no shadow, and no card-grid/dashboard aesthetic.
3. **Interaction system** — full-row targets, quick restrained transitions, stable scroll/context, desktop right drawers, mobile sheets/focused screens, immediate completion feedback with Undo, and no unexpected inline page expansion.
4. **Global shell** — slim desktop navigation for Today, Work, Projects, Schedule, Materials, and More; More contains Commissions, Reports, and Settings. Mobile remains Today, Work, +, Projects, More.

## Core Route Rebuild
1. **Projects** — replace the table/card transformation with a purpose-built operational list. Project identity leads; stage is compact; Next Move, meaningful Attention, crew/owner, and Relevant Date use only existing Work, readiness, schedule, and project data. Mobile receives its own concise job-row hierarchy.
2. **Project workspace** — rebuild the project header and tabs as a dedicated workspace: Overview, Rooms, Work, Files, More. Keep Update primary; place Design Meeting and Installer Package contextually rather than as permanent tabs.
3. **Overview** — compose a calm operational brief around current stage/readiness, one Next Move, Waiting/Blocked, Upcoming, Latest Update, and room readiness. Avoid dashboards, metric grids, task dumps, and repeated cards.
4. **Rooms / Surfaces** — create a new navigation-and-workspace experience. At 1440px show room navigation, surface navigation, and a dominant selected-surface workspace. At 1280px intelligently combine/collapse navigation while keeping the surface workspace dominant. Mobile drills from Rooms → Room → Surface. Surface content uses composed sections for Specification, Layout, Measurements, Prep, and Photos & Notes, with quiet missing states and one readiness conclusion.
5. **Design Meeting** — retain the current data-driven one-question logic, allowed writes, session behavior, and exact-one unresolved Work Item reuse. Rebuild it as a focused guided decision workspace with room/surface context, decision position, known facts, clear answer controls, optional note, Can’t decide yet, and Confirm & Next.
6. **Today and Work** — replace the current shared list presentation with one new V2 action-center system. Today remains personal and time-oriented. Work supports By Project and By Person, shows projects once, limits each group to relevant active work, and opens the same universal drawer.
7. **Universal Work drawer** — preserve all Work mutations and Move Forward behavior while reorganizing the UI around Title, context, Owner, state, one dominant Move Forward action, then Waiting on, Follow-up, Notes, Updates, Files, and History.
8. **Installer Package** — rebuild office review as a publishing workspace grouped by room and surface. Preserve snapshot construction, immutable revisions, current publication behavior, and history. Redesign print output for jobsite scanning with strong Tile, Layout, Grout, Edge, Height, Prep, Important, and one consolidated Open — Confirm with office section.

## Business-Logic Guards
- Do not change schema, migrations, RLS, permissions, authentication, or production records.
- Reuse current Work, readiness, finish assignment/selection, Design Meeting, and installer publication services without rewriting their rules.
- Preserve lifecycle control and all existing routes needed by downstream modules.
- Do not expand Materials, Receiving, Schedule internals, Field, Punch/Return, Commercial, Commissions, estimating, takeoff, CAD, or future plan recognition.
- Do not create demo-only or alternate V2 routes. Normal navigation must render V2.
- Use existing 114 Park Place records for read-only validation. Use the archived QA clone only if mutation testing is unavoidable and reversible.

## Delivery Order
1. V2 tokens, shell, framing, navigation, and shared interaction primitives.
2. New Work action center and universal Work drawer; wire Today and Work.
3. New Projects operational list and project workspace header/navigation.
4. New Overview and Rooms/Surface workspace.
5. New Design Meeting presentation while retaining its current mutation path.
6. New Installer Package office review and print sheet.
7. Remove normal-navigation exposure to superseded core presentation paths only after dependency checks.

## Acceptance
- Capture every V2 core route at 1440×900: Today, Work, Projects, Overview, Rooms, Design Meeting, Installer Package.
- Capture Projects, Work, Rooms, and Design Meeting at 390px.
- Also validate critical 1280px Rooms behavior and all tested pages for zero horizontal overflow.
- Verify live 114 Park Place data appears correctly and existing edits persist after reload.
- Verify, without polluting production data, that Design Meeting behavior, unresolved decision → existing Work linkage, Work Move Forward, readiness, and installer revisions remain wired to their established services.
- Compare production counts before and after visual QA and report any discrepancy immediately.
- Confirm no alternate old version of any core route is reachable through normal navigation.
- Run focused type checks and browser checks; report screenshots, changed routes/components, retired presentation pieces, failures, and intentionally untouched issues.
- Stop after the V2 core frontend. Do not begin Materials Sprint 2.