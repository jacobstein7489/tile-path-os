- [x] Reset application shell and project navigation
- [x] Rebuild Overview and progressive readiness detail
- [x] Rebuild Rooms surface workspace and Design Meeting
- [x] Align Today, Work, drawer, and update flows
- [x] Restyle installer package and materials-adjacent navigation
- [x] Verify 114 Park Place at desktop and mobile sizes; capture requested screenshots
- [x] UI Surgery Pass 1: materially recompose Project Shell, Overview, Rooms, and Design Meeting; verify against the locked screenshot acceptance
- [x] UI Surgery Pass 1B: compact mobile project shell, correct Overview details, Rooms workflows, Design Meeting classification/flow, and capture required acceptance screenshots
  - [x] Prove all hard acceptance conditions in ten named desktop/mobile screenshots; report incomplete if any condition fails
  - [x] Zero configuration: correct the seeded question-rule values in place so all four screens work immediately on existing project data

## Sprint 1 (installer chain on 114 Park Place) — done
- Authoritative spec resolver (`src/lib/spec.ts`) feeds Rooms, snapshot and print sheet; legacy flat columns kept as fallback only.
- Measurement/geometry fields exposed in the surface drawer.
- Tracked (unresolved) decisions stay answerable; confirming closes the same Work item.
- Installer package: publish immutable revision + jobsite print sheet (app chrome hidden in print).
- Retired unused LifecycleTrack.tsx and ops/TaskDrawer.tsx.

## Production Experience Pass
- [x] Unify global shell and mobile navigation
- [x] Finalize Today and Work shared experience
- [x] Finalize Projects operational list using only existing Work, readiness, schedule, and project dates
- [x] Finalize project shell, Overview, responsive Rooms, and Design Meeting without alternate screens
- [x] Improve installer package review and printed room sheet
- [x] Retire verified inactive duplicate UI paths
- [x] Verify desktop, mobile, workflows, unchanged production counts, and screenshots without production mutations

## V2 Frontend Rebuild
- [x] Build the new V2 shell, tokens, navigation, and interaction primitives
- [x] Rebuild Today, Work, and the universal Work drawer
- [x] Rebuild Projects and the dedicated project workspace shell
- [x] Rebuild Project Overview and Rooms / Surface workspace
- [x] Rebuild Design Meeting without changing its workflow logic
- [x] Rebuild Installer Package office review and printed field package
- [x] Remove normal-navigation exposure to superseded core presentation paths after dependency checks
- [x] Verify every core route at 1440px; Projects, Work, Rooms, and Design Meeting at 390px; Rooms at 1280px
- [x] Capture side-by-side old versus V2 evidence for Projects, Overview, Rooms, Work, Design Meeting, and Installer Package
- [x] Confirm zero overflow, workflow continuity, reload persistence, and unchanged production counts
- [x] Stop before Materials Sprint 2
