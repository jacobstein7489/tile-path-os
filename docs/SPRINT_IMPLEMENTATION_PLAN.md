# Sprint Implementation Plan

Each sprint must end shippable: real data, no dead buttons, no clipped screens, on-system
visuals. No sprint starts before its predecessor's acceptance criteria pass.

## Recommended sequence (with deviations explained)

| Sprint | Name | Why here |
| --- | --- | --- |
| 0 | Architecture + audit | this document set |
| 1 | Users, roles, company libraries, design system, RLS | everything else depends on real users and locked data |
| 2 | Company Work / My Work / Quick Capture / work-item engine v2 | the daily operating surface; delivers value immediately |
| 3 | **Project spine + Setup readiness + rules engine v1** (was Sprint 6) | *moved earlier* — readiness gating is the product's core promise and unblocks scheduling and materials; sales/takeoff can wait |
| 4 | Tiles & Finishes + product catalog (was 7) | *moved earlier* — needed for readiness to be truthful and for ordering |
| 5 | Install Materials, POs, receiving, delivery (was 8) | completes the readiness chain |
| 6 | Schedule + crews (was 9) | schedulability now means something |
| 7 | Field, visits, verifications, changes captured (was 10) | closes the loop on live jobs |
| 8 | Punch / Return / closeout (was 11) | |
| 9 | Sales / lead pipeline (was 3) | *moved later* — the company can log leads manually far more cheaply than it can run installs manually |
| 10 | Plans upload, revisions, scope builder (was 4) | heavy; valuable only once scope is central |
| 11 | Takeoff + Estimating tied to structured scope (was 5) | after plans |
| 12 | Commercial, contracts, changes, commissions (was 12) | |
| 13 | Reports (was 13) | needs mature data |
| 14 | Layout engine (was 14) | needs actual tile dimensions + verified field qty |
| 15 | Mobile Site Manager + full QA hardening (was 15) | continuous mobile checks earlier, dedicated sprint here |

Rationale for the biggest change: the original order builds Sales and Plans/Takeoff before the
operating core (readiness, materials, schedule, field). Operations is where the money leaks
today; sales and estimating are currently handled with existing tools and should be absorbed
once the spine is trustworthy.

---

## Sprint 1 — Foundation
Scope: auth (email + Google), `profile`/`role`/`user_role`, `has_role()`, admin user
management, companies/contacts/crews libraries, project participants/assignments, RLS on
every table replacing open policies, Settings shell, design-system hardening (combobox,
inline edit, skeleton, avatar, timeline, button states) and migration of existing routes onto
the kit, nav rename to final 7 items, seed real users and backfill text owners.
Done when: no open policies remain, every owner is a real user, all existing screens render
with kit components at 1440×900, no dead controls.

## Sprint 2 — Work
Scope: work-item schema v2 (5 kinds, 5 statuses, subtype, links, real owner/waiting-on),
workflow engine with step metadata and data-driven advancement, Company Work + My Work views,
Quick Capture with project/contact matching and review, drawer v2 with history and
attachments, undo-completion standard, `/today` retired.
Done when: one record updates everywhere; GM sees all work; every row opens the drawer.

## Sprint 3 — Project spine, Setup, rules v1
Scope: area/surface normalization (surface_kind, uom, qty), room-type + surface templates,
rules/requirements/answers tables, `evaluateRules`, `computeReadiness`, readiness categories
on Overview with drill-in drawers, 10-stage lifecycle with derived gating, retire
`stage_steps_done`, seeded rule library.
Done when: readiness is fully calculated and every incomplete category opens what's missing.

## Sprint 4 — Tiles & Finishes
Scope: manufacturer/collection/tile_product/finish_product catalog with actual dimensions,
`finish_selection` per surface, migration of legacy surface spec columns, Tiles & Finishes tab,
tile follow-up workflow, selection completeness feeding readiness.

## Sprint 5 — Install Materials
Scope: install material catalog + coverage formulas, requirement derivation, on-hand check,
PO builder and lifecycle, append-only receiving with damage handling, delivery to project,
Needs Attention view, readiness integration.

## Sprint 6 — Schedule & crews
Scope: crew capacity/lanes, area-level assignments, confirm/move states, Ready-to-Assign
driven by readiness, conflict and capacity warnings, schedule → work-item effects.

## Sprint 7 — Field
Scope: visits, checklists tied to work items, surface progress with qty, field verification
workflow, plan-vs-field variance → CHANGE candidates, photos.

## Sprint 8 — Punch / Return
Scope: punch capture by surface, return-work workflow end to end (installer, price, labor PO,
schedule, perform, verify), closeout gate, aging reports.

## Sprint 9 — Sales
Scope: lead capture, submission intake, pipeline board, proposal status, conversion into a
project without re-entry, salesperson ownership.

## Sprint 10 — Plans & Scope
Scope: plan set/revision upload to private storage, page thumbnails, current-revision control,
viewer, scale calibration, region drawing → area creation, revision-impact work items.

## Sprint 11 — Takeoff & Estimating
Scope: takeoff lines per surface, waste, pricing catalog, estimate versions and status,
proposal output, acceptance → Awarded, estimate lines traceable to surfaces.

## Sprint 12 — Commercial
Scope: contract values, change orders end to end, authorizations, billing milestones,
commission rules/entries, money-visibility permissions.

## Sprint 13 — Reports
Scope: readiness pipeline, throughput, punch aging, material spend and waste, crew
utilization, change-order capture rate; export.

## Sprint 14 — Layout engine
Scope: course/cut calculations from actual tile size + joint, start point and pattern
simulation per surface, cut-count and carton ordering output.

## Sprint 15 — Mobile & QA
Scope: mobile My Work / Field / receiving flows, offline-tolerant capture, performance
budget, accessibility pass, full regression, production hardening.

## Cross-sprint standing rules
- Every sprint: RLS review, empty/loading/error states, 1440×900 + 1280×800 visual check,
  no new hardcoded colors, no placeholder screens shipped.
- Every schema change: GRANTs + RLS + policies in the same migration; derived values never
  user-editable.
- Demo data is maintained as a realistic company dataset, refreshed each sprint.
