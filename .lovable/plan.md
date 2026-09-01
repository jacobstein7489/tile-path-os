# Sprint 1 Acceptance Evidence Pass

No new modules. This pass produces the frozen Sprint 1 evidence, and fixes only what the evidence proves is wrong (permissions, bootstrap safety, backfill mapping, dead controls, style drift).

## 1. Visual QA
Drive the real app in a headless browser signed in as the Administrator account and capture 1440x900 screenshots of: Dashboard, Today, Projects, one Project Overview (114 Park Place), Schedule, Install Materials, Settings, New Lead intake modal.
Re-run the same pass at 1280x800 and measure document scroll width vs viewport width on each route to prove no horizontal overflow or clipped content. Report any route that overflows, then fix layout on that route only.

## 2. RLS / permission test report
For each role — Administrator/GM, PM, Site Manager, Office Coordinator, and a user with a role but no project assignment — run direct read/write attempts against every gated table as that signed-in user and record allowed vs denied per table.
Current policies gate most tables on "is staff" or "can admin data", not on project assignment. The report will state that plainly. Where the frozen criteria intended project-scoped restriction (project-level writes for PM / Site Manager), the pass adds assignment-scoped policies (assignment check via a security-definer helper) so scoping is enforced by the database, not the UI.

## 3. Delete vs archive permissions
Document, then enforce:
- Permanent delete of a project: Administrator only (database policy, not just a hidden menu item).
- Hold / Lost / Cancel / Archive: Admin, GM, PM, Office Coordinator (lifecycle state changes, reversible).
- Office Coordinator: no permanent delete anywhere; company/contact/crew records deactivate rather than delete.
- Child records (areas, surfaces, work items, material lines, PO lines): delete allowed for Admin/GM/PM; others deactivate or close.
Output a role x object matrix in the docs and align the UI menus to it.

## 4. Auth bootstrap safety
Review the new-user trigger and confirm the admin grant is guarded by "no admin exists yet", so it can fire exactly once. Add an explicit safety so no later self-signup can gain a role automatically, and confirm that further employees are created through the Settings user-management flow.

## 5. Data migration / backfill report
Query the legacy free-text fields (project customer, crew lead, project manager, supplier text on materials, crew name text) against the new company/contact/profile/crew records and report: mapped, unmapped and why. No legacy column is dropped or rewritten in this pass — they stay as rollback data.

## 6. Functional checks
Exercise end to end and report pass/fail with evidence: New Lead saves and reopens; inline creation of customer/GC/contact then reuse in a second lead; user selectors list real configured users; edit project; Hold; Lost; Cancel; Archive; Admin delete with confirmation; file upload and retrieval from the private bucket; company/contact/crew create and edit persistence; full-row click on Projects; sweep for dead buttons (every control either acts or is removed).

## 7. Design-system evidence
Inventory every route and component for hardcoded colors and one-off styling outside the shared kit, list offenders, and convert them to kit primitives and tokens.

## Deliverable
A written Sprint 1 evidence report plus updated permission docs, with screenshots attached. Sprint 2 is not started.

## Technical notes
- Screenshots and interaction flows run via Playwright against the local dev server with a restored session.
- Permission tests run as real signed-in users so RLS is exercised, not bypassed.
- Any policy change ships as a migration; delete gating is enforced in the database and mirrored in the UI.
