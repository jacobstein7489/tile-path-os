# Sprint 1 Acceptance Evidence Pass

No new modules. This pass produces the frozen Sprint 1 evidence, and fixes every failure it uncovers (permissions, destructive access, bootstrap/onboarding, file privacy, persistence, visual standard) inside Sprint 1.

## 1. Visual QA
Sign in as the Administrator in a headless browser and capture 1440x900 screenshots of: Auth / Sign-In, Dashboard, Today, Projects, one Project Overview (114 Park Place), Schedule, Install Materials, Settings, New Lead intake.
Re-run at 1280x800 and measure document scroll width vs viewport on each route to prove no horizontal overflow or clipped content.
Judgement is against the frozen Cobblestone bar: any screen that is cramped, over-colored, inconsistent, clipped, or prototype-looking is a FAIL and gets fixed in this pass, not deferred. The Auth screen is held to the same standard as the app screens.

## 2. Permission matrix: expected vs actual
Write the intended matrix first (role x object x action), then test real signed-in users against it. Any mismatch is a Sprint 1 failure and is corrected by migration.

Cross-project isolation cases, each run for read and write:
- PM assigned to Project A -> Project A (allow), Project B unassigned (deny)
- Site Manager assigned to Project A -> Project A (allow), Project B unassigned (deny)
- Office Coordinator -> company-wide operational access per the approved matrix
- Administrator / GM -> company-wide
- Unassigned basic user -> deny on both

Current policies gate on "is staff" / "can admin data" with no assignment check, so project-scoped roles will fail these tests. Fix: a security-definer assignment helper plus assignment-scoped policies on projects and all project-child tables, so scoping is enforced in the database, not the UI.

## 3. Destructive access: archive/void, not erase
- Permanent project delete: Administrator only, enforced by policy.
- Areas, surfaces, work items, material requirements: archive / void / close once they have linked activity. Hard delete only for unreferenced draft records.
- PMs get project write access but not permanent erasure of historical activity.
- Receipts and work-item events stay append-only (no update, no delete, any role).
- Office Coordinator: no permanent delete anywhere; companies/contacts/crews deactivate.
Deliver a role x object matrix of delete vs archive/void/deactivate, enforce it in policies, and align every UI menu to it.

## 4. Bootstrap and invite-controlled onboarding
- Verify the first-admin grant fires exactly once and is concurrency-safe (advisory lock or a unique constraint that makes a second simultaneous grant impossible).
- After that, a self-created auth account receives no role and therefore no application access; the app is not an open employee signup system.
- Onboarding runs through Settings: an Administrator invites/approves a user and assigns roles. Any account without an approved role lands on a "pending access" state rather than the app.

## 5. File security
Test, not just upload: authorized upload; authorized retrieval; unassigned user cannot retrieve a private project file; a direct storage URL does not bypass policy (expired/absent signature denied); archiving or deactivating a project does not orphan its file references. Fix any leak by tightening the storage.objects policies to project assignment.

## 6. Functional checks
End to end with evidence: New Lead saves and reopens; inline creation of customer/GC/contact then reuse in a second lead; user selectors list real configured users; edit project; Hold; Lost; Cancel; Archive; Admin delete with confirmation; company/contact/crew create and edit persistence; full-row click on Projects; sweep for dead buttons (every control acts or is removed).

## 7. Data migration / backfill report
Compare legacy free-text fields (project customer, crew lead, project manager, material supplier, crew name) with the new company/contact/profile/crew records: report mapped, unmapped and why. Legacy columns are left untouched as rollback data.

## 8. Design-system evidence
Inventory every route and component for hardcoded colors and one-off styling outside the shared kit, list offenders, and convert them to kit tokens and primitives.

## Pass/fail
Sprint 1 passes only when security matches the intended matrix, data persists, no unsafe destructive permissions remain, bootstrap/onboarding is safe, private files are actually private, all listed interactions work, and all listed screens meet the frozen design standard. Sprint 2 is not started.

## Technical notes
- Screenshots and flows run via Playwright against the local dev server with restored sessions.
- Permission tests execute as real signed-in users so RLS is exercised, never bypassed by an admin client.
- Test users are created for PM, Site Manager, Office Coordinator and unassigned roles, with assignments only to Project A.
- All policy and trigger changes ship as migrations; UI is mirrored to the enforced matrix afterwards.
