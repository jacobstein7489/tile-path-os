# Sprint 1 Recovery: Production UI, Security and Acceptance Evidence

Sprint 2 remains blocked. This is a corrective Sprint 1 pass against the actual running product, preserving the frozen architecture and useful functionality while replacing prototype-quality presentation and closing every security or persistence failure found.

## Confirmed current-state gaps
Source inspection confirms the production kit exists, but major screens still compose it inconsistently:
- Dashboard, Today, Projects, Schedule, Install Materials, Settings and Project Overview contain substantial page-local layout and control styling.
- The Schedule still uses decorative violet states, large KPI cards and multiple lower-page sections.
- Today uses a hard-coded user identity instead of the authenticated user.
- Auth still exposes self-signup after the initial Administrator bootstrap.
- Project Overview does not currently render the required full lifecycle rail or calculated readiness summary.
- Clicked rows open drawers in places, but selected-row state is not consistently visible.

## 1. Freeze one production UI kit
Refine the existing shared kit into the only production presentation layer:
- Semantic tokens for white/neutral surfaces, typography, spacing, borders, focus, selection and the five permitted state colors.
- Shared page headers, compact summary metrics, filters, table headers/rows, selected rows, badges, progress, empty/loading states, drawers, modals and forms.
- One density system for 1280–1440 desktop layouts; minimal shadows, restrained radii and no decorative color.
- Replace route-local buttons, tabs, filters, fields, cards and row styling with kit primitives. Remove violet/decorative status use.

## 2. Redesign the running Sprint 1 screens
### Auth
Premium restrained sign-in screen using the same brand, type, fields and interaction states as the application. Remove open self-signup after bootstrap; users without approved access see a clear pending-access state.

### Dashboard
A compact operational work surface rather than a collection of cards. Preserve filters and Quick Capture. Make the actionable row hierarchy obvious, show one Next Action, and visibly select the exact row while its drawer is open.

### Today
Use the authenticated user's assignments. Replace decorative KPI cards with a quiet compact summary. Actions dominate. Completing an item immediately turns that exact row green, shows `Marked complete — Undo`, remains briefly, then moves only if the active view hides completed items.

### Projects
Build a premium flat table that fits without horizontal scrolling at 1280px. Give project/address and Next Move sufficient room; consolidate lifecycle into one compact stage badge; retain readable readiness, crew and dates. Entire rows are clickable with hover, keyboard focus and selected state. Keep the primary New Lead action obvious.

### Project Overview
Restore the complete frozen lifecycle rail: completed green, current blue, future gray. Show a one-screen operational summary with interactive Crew, Dates, Scope, calculated readiness and Next Move. Replace manual-looking readiness checkboxes with calculated category rollups. Use drawers for compact edits and keep deeper detail on click rather than stacking long sections.

### Schedule
Use compact crew lanes and a restrained Ready to Assign panel. Assignment selection opens a connected right drawer. Remove oversized KPI cards, violet decoration, excess whitespace and unnecessary lower-page content.

### Install Materials
Keep it explicitly about company-supplied installation materials. Use a compact workflow table and restrained tabs. Material rows receive visible selection and open a right drawer; Tiles & Finishes remain separate project scope.

### Settings
Create one polished management surface for Users/Roles, Companies, Contacts and Crews. Search, selection and editing use consistent tables and a connected drawer/modal pattern rather than large technical forms. Selected records remain visibly highlighted.

### New Lead
Short first step for required intake fields; optional details are secondary/revealable. Keep searchable real-data selectors and inline company/contact creation. Avoid a long modal.

## 3. Unified interaction behavior
- Entire natural targets are clickable and keyboard accessible across Projects, Work Items, Areas, Surfaces, Materials, Schedule and Settings.
- Opening a drawer applies a strong but restrained selected state to the originating row.
- Drawer headers identify both context and record, e.g. `Mark Drive / Order Primer`; Status, Owner, Waiting On and the single Next Action are primary, while history is secondary.
- Crew assignment, Dates, Material detail, Question, Need, Return Work and simple edits stay in contextual right drawers.
- Every visible control is exercised; dead controls are implemented or removed.

## 4. Expected permission matrix before testing
Define and document expected READ/WRITE/ARCHIVE/HARD DELETE behavior by role and object before running tests:
- Administrator: company-wide operations; only role allowed permanent Project Delete.
- GM: company-wide operational read/write/archive; no permanent project/history deletion.
- PM: assigned-project read/write/archive only; unassigned project denied.
- Site Manager: assigned-project operational read/write only within approved field scope; unassigned project denied.
- Office Coordinator: approved company-wide operational access; deactivate/archive where allowed, never blanket hard delete.
- Authenticated account without approved role: no application data access.

Run expected-vs-actual tests as real signed-in users for Project A and unassigned Project B. Correct every mismatch with database-enforced assignment policies, then rerun. UI hiding is not accepted as enforcement.

## 5. Safe retention and destructive operations
- Permanent Project Delete remains Administrator-only and requires explicit confirmation.
- Referenced areas, surfaces, work items and material requirements use Archive/Void/Close, not hard delete.
- Hard delete is limited to explicitly unreferenced draft records where safe.
- PMs cannot erase historical activity.
- Receipts and work-item events remain append-only for every application role.
- Companies, contacts, crews and employees deactivate rather than erase.

## 6. Bootstrap and controlled onboarding
Make the first-Administrator bootstrap concurrency-safe with a database lock/constraint so two near-simultaneous signups cannot both become Administrator. Once an Administrator exists:
- no future account gets an application role automatically;
- public self-signup is not presented as employee onboarding;
- an account created at the auth provider has no application access until explicitly approved and assigned by an Administrator;
- Settings provides the controlled invitation/approval and role assignment flow.

## 7. Private file security
Test the real storage path and policies:
- authorized assigned user uploads and retrieves;
- unassigned/no-role user cannot retrieve;
- raw/direct object URL cannot bypass authorization;
- signed URLs are short-lived and fail after expiration;
- archive/deactivation keeps project-file references intact.
Correct any policy or application mismatch and rerun all cases.

## 8. Persistence and functional acceptance
Exercise and record pass/fail for:
- New Lead saves and reopens correctly;
- inline customer/GC/contact creation persists and is reusable;
- employee selectors use configured users;
- project edit, Hold, Lost, Cancel and Archive persist;
- Administrator-only Delete works with confirmation;
- company/contact/crew creation and editing persist;
- file upload/retrieval works under authorization;
- Projects rows are fully clickable;
- completion/Undo behavior works;
- no visible dead buttons remain.

## 9. Legacy-data backfill report
Compare existing project customer, crew lead, project manager, material supplier and crew text values to relational companies, contacts, profiles and crews. Report mapped and unmapped values with reasons. Preserve all legacy fields untouched as rollback data.

## 10. Visual QA and evidence
Use the actual running application, not isolated components. Capture and inspect these nine final 1440x900 states:
1. Auth
2. Dashboard
3. Today
4. Projects
5. 114 Park Place Overview
6. Schedule
7. Install Materials
8. Settings
9. New Lead modal

Repeat every screen at 1280x800. Record viewport width vs document width and fail any horizontal overflow. Also fail and fix cramped layouts, awkward truncation, excess vertical scrolling, unclear targets, inconsistent typography/spacing, decorative color, dead controls or any screen that still reads as the old prototype.

## Final deliverable and pass rule
Return one Sprint 1 evidence report containing:
- all nine final screenshots;
- 1280x800 overflow/clipping results;
- expected-vs-actual permission matrix and cross-project test outcomes;
- destructive-access matrix;
- bootstrap concurrency/onboarding proof;
- private-file test results;
- persistence/interaction results;
- backfill mapping report;
- route/component design-system audit with no unexplained local styling remaining.

Sprint 1 is reported complete only if every listed security, persistence, interaction and visual check passes after correction. Sprint 2 is not started.
