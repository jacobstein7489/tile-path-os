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
