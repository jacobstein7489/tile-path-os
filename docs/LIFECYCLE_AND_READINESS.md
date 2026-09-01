# Lifecycle and Readiness

## 1. Master lifecycle (final, 10 stages)

| # | Stage | Meaning | Primary owner |
| --- | --- | --- | --- |
| 1 | New Lead / Submission | opportunity captured | Sales |
| 2 | Estimating | plans, scope, takeoff, pricing | Estimator |
| 3 | Proposal | proposal issued / revised | Sales |
| 4 | Awarded | won; contract/authorization in place | Sales → PM |
| 5 | Setup | project fully defined and specified | PM |
| 6 | Ready | all readiness categories satisfied | PM |
| 7 | Scheduled | crew + dates committed | PM / GM |
| 8 | Installation | physical work in progress | Site Manager |
| 9 | Closeout / Return | punch, return work, final verification | Site Manager |
| 10 | Complete | closed operationally and commercially | Accounting |

Exception states (orthogonal flag, stage preserved): **On Hold · Lost · Cancelled**.

Mapping from the current 12 stages:

| Current | New |
| --- | --- |
| New Submission | New Lead / Submission |
| Estimating | Estimating |
| Proposal / Revision | Proposal |
| Approved | Awarded |
| Office Setup | Setup |
| Site Walkthrough / Decisions | **merged into Setup** (a readiness category) |
| Materials & Readiness | **merged into Setup/Ready** (readiness categories) |
| Ready to Schedule | Ready |
| Scheduled | Scheduled |
| Installation | Installation |
| Punch / Return | Closeout / Return |
| Complete | Complete |

## 2. Stage transitions are gated, not typed

- No stage dropdown anywhere. One primary action per project header:
  `Advance to <next stage>`, enabled only when the stage's exit conditions are met.
- Disabled state shows *why* ("3 setup categories incomplete") and clicking the reason
  opens exactly what is missing.
- Regression (e.g. Ready → Setup) happens automatically when derived data stops
  qualifying; the app records the reason in the project history.
- Exception states are set from the project ••• menu and shown as a banner chip.

Exit conditions (v1):

| Stage | Exit condition |
| --- | --- |
| New Lead | customer + address + project type + salesperson set |
| Estimating | ≥1 area with ≥1 surface, takeoff qty on every surface, estimate v≥1 exists |
| Proposal | estimate status = Sent |
| Awarded | estimate Accepted or contract recorded |
| Setup | all *required* readiness categories = complete |
| Ready | schedule assignment exists with crew and date |
| Scheduled | first assignment marked In Progress or install progress > 0 |
| Installation | all surfaces Complete or Punch-flagged; install progress = 100 |
| Closeout | no open punch/return work items; final verification recorded |

## 3. Setup / readiness categories (calculated, never checkboxes)

Stage 5–6 completeness is computed from underlying data plus rule-generated requirements.

| Category | Complete when |
| --- | --- |
| Project information | customer, GC, contacts, PM, site manager, address, type set |
| Scope complete | every area has surfaces; every surface has qty + uom |
| Plans / current revision | a `plan_revision.is_current` exists (or "no plans" flagged) |
| Tiles & finishes | every surface has confirmed selections for its required finish kinds |
| Installation systems | rule-required system answers present (prep, waterproofing, underlayment, mud vs thinset, membrane) |
| Site requirements | rule-required site answers present (power, water, storage, access, protection, dumpster, parking) |
| Install materials | every requirement status ∈ {Ready, Delivered} or explicitly waived |
| Required decisions | zero open work items of kind QUESTION marked blocking |
| Commercial authorization | contract/authorization recorded; deposit condition satisfied if company setting requires it |

Each category returns `{ state: complete | partial | blocked | not_applicable, missing: [...] }`.
Not-applicable is decided by the rules engine (e.g. no shower → no waterproofing category).

`readiness_pct = required categories complete / required categories total`, rounded; the
project header shows the number plus the top blocking reason.

## 4. Area / surface state machine

`Not Ready → Ready → Working → Complete`, with `Blocked` reachable from any state.

- Surface state is set by field action (Field tab) or derived (`Ready` when its selections +
  install materials + rule answers are satisfied).
- Area state = rollup of its surfaces (any Blocked → Blocked; all Complete → Complete;
  any Working → Working; all Ready → Ready; else Not Ready).
- Install progress % = qty-weighted complete surfaces (falls back to count-weighted when
  quantities are missing).

## 5. Readiness computation architecture

- Pure function `computeReadiness(projectBundle) → ReadinessResult` in
  `src/lib/readiness/` — no I/O, unit-testable, shared by server and client.
- Server function `getProjectReadiness` loads the bundle and returns the result; a
  `readiness_snapshot` row is written on change so lists and reports can sort without
  recomputation.
- Invalidated by any write to areas, surfaces, selections, requirements, answers,
  materials, schedule, commercial.
- Displayed in exactly three places: Projects table (pct + top blocker), project header
  (pct + gated advance), Overview readiness card (category list, each clickable).

## 6. Interaction rules

- Every category row is clickable → opens a drawer listing precisely the missing items,
  each of which is itself actionable (answer question, create need, assign crew).
- Never show a readiness number without a path to fix it.
- Stage rail: current stage emphasized, past stages quiet-complete, future stages muted.
  Stage rail is context, not navigation, and never scrolls horizontally at 1440px.
