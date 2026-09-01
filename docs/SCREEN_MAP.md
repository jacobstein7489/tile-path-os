# Screen Map (production target)

Desktop-first, 1440×900 baseline, max content width 1400px, one app shell everywhere.

## 1. Global

| Route | Screen | Primary content | Notes |
| --- | --- | --- | --- |
| `/dashboard` | Company Work | one dense work-item table; quiet filter counts (Open / Needs Action / Waiting / Upcoming / Completed) + Project / Owner / Type filters; `+ Quick Capture` | GM default = all work. No KPI card wall. Row → drawer |
| `/dashboard?view=mine` | My Work | same table scoped to `owner_user_id = me` | tab, not a nav item; mobile default for site managers |
| `/sales` | Sales pipeline | lead/submission table by stage, proposal status, next action | Sprint 3 |
| `/projects` | Projects | flat dense table: Project · Customer · Stage · Readiness · Progress · Crew · Dates · Next action; `+ New Project` | whole row clickable |
| `/projects/$id` | Overview | identity header + lifecycle rail + one gated advance action; readiness categories (clickable); area/surface rollup; project work items; crew & dates (click to edit) | |
| `/projects/$id/scope` | Scope & Plans | plan revision selector + viewer; area/surface builder | Sprint 4 |
| `/projects/$id/finishes` | Tiles & Finishes | area → surface → selection panel (3-col) | rename of today's `scope` route |
| `/projects/$id/field` | Field | area/surface progress, visits & checklists, field verifications, variance | |
| `/projects/$id/materials` | Install Materials | project requirements, POs, receipts, blocking summary | |
| `/projects/$id/commercial` | Commercial | contract value, changes, authorizations, billing | Sprint 12 |
| `/projects/$id/files` | Files | plans, photos, proposals, packing slips | needs real storage |
| `/schedule` | Schedule | weekly crew lanes + Ready to Assign sidebar; drag/click to assign | |
| `/materials` | Install Materials | tabs: Needs Attention · Requirements · Purchase Orders · Receiving · Catalog | |
| `/reports` | Reports | saved operational reports (readiness, throughput, punch aging, material spend) | Sprint 13 |
| `/settings` | Settings | sub-nav: Users & Roles · Companies & Contacts · Crews · Product Catalog · Install Material Catalog · Room Types · Rules Library · Company Preferences | currently a placeholder |

Removed: `/today` (folded into My Work).

## 2. Overlays (no page navigation)

| Overlay | Trigger |
| --- | --- |
| Work Item drawer | any work row anywhere |
| Quick Capture drawer | Dashboard button, global `C` shortcut |
| New Project modal | Projects page |
| Project ••• menu | project header (Edit / On Hold / Cancelled / Lost / Archive / Delete-admin) |
| Readiness category drawer | clicking a readiness category |
| Surface / selection drawer | Tiles & Finishes, Field |
| Assign crew drawer | Schedule cell, project Crew field |
| Receive material modal | Receiving tab, requirement row |
| PO builder | Requirements tab multi-select |
| Contact / company drawer | any Waiting-On chip |

## 3. Per-screen density rules

- Max one KPI strip per screen, ≤4 quiet stats, no color-blocked cards.
- Tables: 40–44px rows, sticky header, right-aligned numerics, one chip column max, one
  action column at the right edge, no horizontal scroll at 1440px.
- No page may exceed ~2 viewport scrolls; deeper detail goes in a drawer.
- Every screen states its empty state in one compact line + one action.

## 4. Role landing routes

admin/GM → `/dashboard` · sales → `/sales` · estimator → `/projects?filter=estimating` ·
PM → `/dashboard?view=mine` · site manager → `/dashboard?view=mine` (mobile) ·
office coordinator → `/materials` · accounting → `/reports`.
