# TileFlow OS

We are starting a completely fresh production application called COBBLESTONE TILE OS.

IMPORTANT: Do not use or recreate any previous version of this product. Do not assume any previous navigation, architecture, workflows, cards, dashboards, or layouts.

The attached screenshots are the NEW VISUAL DIRECTION ONLY. They define HOW THE SOFTWARE SHOULD LOOK: premium modern white/light SaaS, soft neutral backgrounds, clean typography, subtle blue primary actions, restrained green/amber/red status colors, thin borders, soft corners, elegant progress bars, clean dense tables, lots of breathing room without wasting space, no dark sidebar, no giant cards, no clutter, and no generic project-management-template appearance.

CRITICAL VISUAL RULE: Do not copy lifecycle wording from screenshots. Screenshots are for visual style only. The written lifecycle below is the only authoritative lifecycle.

==================================================

WHAT COBBLESTONE TILE OS IS

==================================================

Cobblestone Tile OS is the operating system for a professional tile installation company. It manages a job from the moment a new opportunity comes in until the project is fully completed.

The software must always answer:

- Where is this project up to?

- What is complete?

- What must happen next?

- Who owns the next action?

- Who are we waiting on?

- What is blocking the project or a specific area?

- Are materials ready?

- Is a crew needed?

- Is the project ready to schedule?

- Once installation starts, what physical work is complete and what remains?

==================================================

MASTER PROJECT LIFECYCLE

==================================================

Every project has ONE permanent master lifecycle:

1. New Submission

2. Estimating

3. Proposal / Revision

4. Approved

5. Office Setup

6. Site Walkthrough / Decisions

7. Materials & Readiness

8. Ready to Schedule

9. Scheduled

10. Installation

11. Punch / Return

12. Complete

Exception states: On Hold, Lost, Cancelled.

The FULL lifecycle exists from the beginning. Do not start the lifecycle at Approved.

Stages can have internal sub-workflows, but those never replace the master lifecycle.

Examples:

- Estimating: Takeoff → Questions → Estimate → Internal Review → Ready to Send

- Office Setup: Project Info → Areas & Surfaces → Tile / Grout / Metals → Installation Systems → Site Requirements → Setup Review

- Materials & Readiness: Requirements Confirmed → To Order → Ordered → Receiving → Ready

- Punch / Return: Punch Open → Waiting on Material / Trade → Ready for Return → Return Scheduled → Verified

==================================================

GLOBAL NAVIGATION

==================================================

Exactly:

Dashboard

Today

Projects

Schedule

Materials

Settings

Do not add extra permanent navigation items.

==================================================

PROJECT NAVIGATION

==================================================

Inside a project, eventually use exactly:

Overview

Scope & Details

Field

Materials

Files

The lifecycle is status/context above the project. It is not another navigation menu.

==================================================

CORE DATA MODEL

==================================================

There must be ONE SOURCE OF TRUTH.

PROJECT → AREA / ROOM → SURFACE / FEATURE

Example:

119 Park Place

→ Master Bathroom

→ Main Floor

→ Shower Floor

→ Shower Wall A

→ Shower Wall B

→ Shower Wall C

→ Niche

→ Bench

→ Curb

CRITICAL BUSINESS RULE: Areas and surfaces begin DURING ESTIMATING. The estimator builds the physical project structure while doing takeoff. After approval, Office Setup REUSES those exact records. Never recreate rooms or surfaces later.

During estimating the estimator can enter rooms/areas, surfaces, plan measurements, estimated SF, scope, approximate quantities, installation assumptions, tile selections if known, questions, and exclusions.

==================================================

SURFACE / FINISH DATA

==================================================

Tile, grout and metal specifications belong to the exact surface.

A surface can contain measurements, plan/field measurement, SF, tile, tile tag, tile size, manufacturer, supplier, grout/color, joint size, metal/profile/finish/size, layout pattern, direction, start point, tile height, prep, waterproofing, underlayment, notes, photos, readiness, and physical installation progress.

Scope & Details answers: WHAT GOES WHERE?

Materials answers: DO WE HAVE IT?

Do not maintain duplicate selection systems.

==================================================

MATERIALS / PO / RECEIVING

==================================================

Materials has two lanes:

1. Finish materials: tile, mosaic, stone, grout, metals/profiles, bullnose, pencils, saddles/thresholds, specialty trim.

2. Installation materials: thinset, mortar, mud, Portland cement, sand, membranes, waterproofing, self-leveler, primer, mesh/lath, leveling systems, spacers, sealants, protection, consumables.

Track required quantity, supplied by, ordered by, supplier, PO, ordered quantity, expected date, received quantity, missing quantity, damaged/wrong/backordered, and ready status.

POs are separate records. PO statuses: Draft, Sent, Confirmed, Partially Received, Closed, Cancelled.

Receiving must support MULTIPLE append-only receipts. Never overwrite receipt history.

==================================================

SEPARATE STATUS FAMILIES

==================================================

Do NOT create one giant status field.

PROJECT: master lifecycle stage

AREA / SURFACE: Not Ready, Ready, Working, Blocked, Complete

TASK: Open, Waiting, Complete

QUESTION / DECISION: Needs Answer, Waiting, Resolved / Approved

MATERIAL: Needed, To Order, Ordered, Expected, Partially Received, Received, Short, Wrong, Damaged, Ready

PO: Draft, Sent, Confirmed, Partially Received, Closed, Cancelled

CHANGE: Potential, Needs Review, Needs Pricing, Waiting Approval, Approved, Rejected, Authorized, Completed, Billing Triggered

==================================================

CONDITIONAL RULES

==================================================

Do not display hundreds of questions at once. Questions must be progressive and conditional.

Example: Mud Bed should trigger only mud-related requirements such as location, thickness, elevation, slope, drain elevation, reinforcement, substrate, waterproofing responsibility, curing requirements. Uncoupling membrane should trigger its own relevant requirements.

==================================================

STRUCTURED WORK ITEMS / TRIGGERS

==================================================

Core rule: COMMENTS ARE FOR CONTEXT. ACTIONS CHANGE THE PROJECT.

When something happens, create the correct structured record: Task, Question, Decision, Issue, Material Need, Approval, Potential Change, Change Order, Field Update, Punch / Return Item.

Each actionable record should know Project, Area/Surface if applicable, Type, Description, Owner, Waiting On, Due/Needed By, Impact, Status, Next Action, History.

Examples:

- “Need more thinset” → Material Need → shows inside project + Materials Needs Attention + assigned owner’s Today list.

- “Is this wire going the correct direction?” → Question / Field Issue → link to exact area/surface → Waiting on contractor/electrician → optionally block affected surface.

- Extra material needs to be moved → Task → assigned owner → appears in Today.

- Return touch-up waiting for saddle → Punch/Return Item Waiting on Material → when saddle becomes Received, surface “Schedule Return Visit”.

==================================================

READINESS VS PROGRESS

==================================================

Stage and readiness are different.

A project can be in Materials & Readiness while some areas are Ready and others Not Ready.

Readiness must explain WHY.

Before physical installation begins, do NOT show fake installation percentages. Show setup/readiness completion instead.

During Installation, track true physical progress and roll it up Surface → Area → Project.

==================================================

DESKTOP FIRST

==================================================

Desktop first. Optimize for approximately 1440x900 at 100% browser zoom. Mobile comes later.

==================================================

PHASE 1 — BUILD ONLY THIS NOW

==================================================

Do NOT build the whole product yet.

Build only:

1. Shared premium desktop design system matching the attached screenshots.

2. Permanent desktop sidebar and application header.

3. Projects page.

4. Basic Project shell.

5. Reusable FULL 12-stage lifecycle component.

6. Initial real database/data models for Projects, Areas, Surfaces, lifecycle, and structured work items.

7. One working Project Overview page.

PROJECTS PAGE:

One clean flat table.

Columns:

Project

Stage

Readiness

Installation Progress

Crew

Dates

Material Status

Needs Attention

Next Move

Filters:

All

Preconstruction

Ready

Scheduled

Installation

Closeout

On Hold

Complete

Do not create Kanban, lifecycle-grouped project lists, giant card layouts, or drawer-first project navigation.

PROJECT OVERVIEW:

Include project identity/header, FULL 12-stage master lifecycle, current stage, readiness, progress only when appropriate, crew, dates, blockers, and next move.

Use real editable application data, not a static screenshot recreation.

==================================================

TEST DATA

==================================================

Create two editable demo projects:

- 114 Park Place: new/preconstruction project we will later move through Estimating → Approval → Setup → Readiness → Scheduling.

- 8-28 Clyde: active Installation project. Crew: Philip. Example open material need: more thinset.

==================================================

FINAL RULE

==================================================

Do not reinterpret this into a generic construction CRM. Do not add features just because they are common in PM software. Do not continue into additional modules until this Phase 1 foundation is approved. If a major architecture decision is unclear, ask before inventing it.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://tile-path-os.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/d4e9e09e-8fcb-4cb7-be01-25ea04259e2b).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
