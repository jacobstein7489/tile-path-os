# Cobblestone Tile OS — Master Product Architecture

Status: Sprint 0 (architecture only, no implementation)
Audience: product owner, future implementation sprints

---

## 1. What the product is

Cobblestone Tile OS is the **operating system of a professional tile installation company**.
It is not a CRM, not a task app, and not a generic construction PM tool. It is a
**process engine**: the software knows the company SOP, and it tells each person the one
thing they must do next.

A job flows through the system once, from first submission to final closeout, using a
single permanent record set. Nothing is re-entered, re-typed, or recreated between
departments.

The product must always answer, per project and per company:

1. Where is this job?
2. What is done?
3. What must happen next, and who owns it?
4. Who are we waiting on (internal or external)?
5. What is blocking work — at job, area, or surface level?
6. Are tiles/finishes selected and received? Are install materials ready?
7. Is the job ready to schedule? Is a crew assigned?
8. Once installing, what physical work is complete and what remains?
9. What money is authorized, changed, or outstanding?

## 2. Core product rule

**Sophisticated underneath. Extremely simple for the user.**

- Capture every important detail; show each person only what matters now.
- Interaction order: **SELECT > CONFIRM > TYPE.**
- Backend complexity (dozens of internal types, workflow steps, rule evaluations) must
  never surface as dozens of dropdowns, statuses, or buttons.
- Summary first, detail on click, drawers over pages.
- Readiness and completeness are **calculated**, never manually ticked.

## 3. Architectural layers

```text
┌───────────────────────────────────────────────────────────────┐
│ PRESENTATION      one design system, one app shell, drawers    │
├───────────────────────────────────────────────────────────────┤
│ VIEW MODEL        role-scoped views over one work-item feed     │
│                   (Company Work, My Work, project tabs)         │
├───────────────────────────────────────────────────────────────┤
│ PROCESS ENGINE    lifecycle | readiness calculator | rules/SOP  │
│                   engine | work-item workflow engine            │
├───────────────────────────────────────────────────────────────┤
│ DOMAIN            job → area → surface; tiles/finishes;         │
│                   install materials; POs/receipts; schedule;    │
│                   commercial; people/contacts                   │
├───────────────────────────────────────────────────────────────┤
│ PLATFORM          Postgres (Lovable Cloud) + RLS, TanStack      │
│                   Start server functions, TanStack Query        │
└───────────────────────────────────────────────────────────────┘
```

Four engines are the product's real IP:

| Engine | Responsibility | Doc |
| --- | --- | --- |
| Lifecycle + Readiness | derive stage gates and completeness from data | LIFECYCLE_AND_READINESS.md |
| Work Item + Workflow | one actionable record type, staged next actions | WORK_ITEM_AND_WORKFLOW_ENGINE.md |
| Rules / SOP | conditional requirements and progressive questions | RULES_ENGINE.md |
| Structure (Scope) | permanent job → area → surface spine created at estimating | SCOPE_AND_PLANS_ARCHITECTURE.md |

## 4. Non-negotiable invariants

1. **One structure.** Areas and surfaces are created during estimating and reused
   forever. No department recreates them.
2. **One actionable record.** Everything a human must do is a work item. Dashboard,
   My Work, project tabs, and materials views are *filters* of the same rows. Never copies.
3. **Separate status families.** Project lifecycle, area/surface state, work-item status,
   material status, PO status, and change status are distinct fields with distinct
   vocabularies. No universal status column.
4. **Append-only history.** Receipts, work-item events, and commercial approvals are
   never overwritten.
5. **Real people.** Owner is always a configured internal user. Waiting-On is a user or
   an external contact/company. No placeholder owners like "Office Team".
6. **Calculated readiness.** Setup categories, readiness %, and schedulability are derived.
7. **Actual tile dimensions.** Layout math uses manufactured size, not nominal labels.
8. **Desktop first (1440×900)**, mobile as a focused Site Manager surface later.

## 5. Global navigation (final)

`Dashboard · Sales · Projects · Schedule · Install Materials · Reports · Settings`

- **My Work** is a scoped view of Dashboard (a filter/tab), not a nav item. It becomes the
  mobile default for Site Managers and crews.
- Today (current route) collapses into My Work.
- No additional permanent nav items without an architectural reason.

## 6. Project navigation (final)

`Overview · Scope & Plans · Tiles & Finishes · Field · Install Materials · Commercial · Files`

Lifecycle is **context above** the tabs (a rail plus one gated primary action), never a
navigation menu.

## 7. Role experience model

| Role | Lands on | Sees |
| --- | --- | --- |
| Admin / GM | Dashboard → all company work | everything, incl. money, delete |
| Sales | Sales pipeline | leads, proposals, own work |
| Estimator | Projects (estimating filter) | plans, scope, takeoff, estimates |
| Project Manager | Dashboard → my projects | full project, no company financials |
| Site Manager | My Work (mobile) | today's projects, field, punch |
| Office Coordinator | Install Materials + My Work | orders, POs, receiving, tile follow-ups |
| Accounting | Commercial / Reports | authorizations, billing, commissions |

Detail in USER_ROLES_AND_PERMISSIONS.md.

## 8. Data backbone (summary)

Nine clusters: **People** (users, roles, contacts, companies, crews) · **Job spine**
(projects, areas, surfaces) · **Plans** (plan sets, revisions, markups, takeoff) ·
**Products** (tile catalog, finish selections) · **Install materials** (catalog,
requirements, POs, receipts, deliveries) · **Work** (work items, events, attachments) ·
**Process** (rules, requirements, answers, readiness snapshots) · **Schedule**
(assignments, crew days) · **Commercial** (contract values, changes, authorizations).
Full definition in DATA_MODEL.md.

## 9. What Sprint 0 concludes

- The existing foundation (design tokens, kit primitives, job→area→surface tables, work
  item engine, schedule, materials, POs, receipts) is **worth keeping and refactoring**;
  roughly 70% of current code survives with modification.
- The three biggest missing architectural pieces are **real users/contacts**,
  **the rules/readiness engine**, and **plans/takeoff**.
- The three biggest simplifications required are **5 work-item types**, **5 statuses**,
  and **10 lifecycle stages with derived setup categories**.
