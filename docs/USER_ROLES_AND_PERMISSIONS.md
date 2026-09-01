# Users, Roles, Resources and Permissions

## 1. Two distinct populations

**Internal users** log in. They can own work.
**External contacts** never log in (in this phase). They can only be *waited on*.

```text
app_user ──< user_role >── role
   │
   └──< work_item.owner_user_id           (always internal)

contact ──> company (optional)
   │
work_item.waiting_on_user_id  XOR  work_item.waiting_on_contact_id
```

Rule: `Owner = internal user`. `Waiting On = internal user OR external contact/company`.
Never a free-text name. Legacy free-text values are migrated, not trusted.

## 2. Roles

| Role | Purpose |
| --- | --- |
| `admin` | company owner/GM; all data, destructive actions, settings, rules library |
| `sales` | leads, submissions, proposals, customer comms |
| `estimator` | plans, scope, takeoff, estimate build |
| `project_manager` | owns projects end-to-end; setup, decisions, changes |
| `site_manager` | field execution, visits, verifications, punch/return |
| `office_coordinator` | install materials, ordering, POs, receiving, tile follow-up |
| `accounting` | authorizations, billing, commissions, financial reports |

A user may hold multiple roles (`user_role` join table). Permissions are the **union** of
role grants. Roles are stored in a dedicated table — never on the profile — to prevent
privilege escalation, and checked through a `has_role()` security-definer function.

## 3. External resources and contacts

Separate library, configured in Settings:

- `company` — customer, general contractor, designer/architect, supplier, tile store,
  installer/sub, other trade (plumber, electrician, HVAC, waterproofer), other.
- `contact` — person, optional company link, role label, phone, email, notes.
- `crew` — installer teams; may link to an installer company and/or contacts; carries
  capacity, lead contact, color/lane for the schedule.

Project participants are attached via `project_participant`
(`project_id`, `role_in_project`, `contact_id`|`company_id`|`user_id`), so "who is the GC
on this job" is data, not text.

## 4. Permission matrix (v1, coarse but real)

Legend: F = full, W = write own/assigned, R = read, — = hidden.

| Surface | admin | sales | estimator | PM | site mgr | office | accounting |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Dashboard / Company Work | F all | R own+sales | R own | F own projects | W own | W own | R |
| My Work | F | F | F | F | F | F | F |
| Sales pipeline | F | F | R | R | — | — | R |
| Projects list | F | R | R | F assigned | R assigned | R | R |
| Scope & Plans | F | R | F | W | R | — | — |
| Tiles & Finishes | F | R | W | W | R | W | — |
| Field | F | — | — | W | F | R | — |
| Install Materials / PO | F | — | — | W | R | F | R |
| Schedule | F | R | — | W | R | R | — |
| Commercial | F | R own | — | R | — | — | F |
| Reports | F | R own | R | R | — | R | F |
| Settings: company libraries | F | — | — | — | — | W suppliers | — |
| Settings: users & roles | F | — | — | — | — | — | — |
| Settings: rules/SOP library | F | — | — | R | — | — | — |
| Delete project permanently | F | — | — | — | — | — | — |

Financial visibility flag: `role.can_see_money` (admin, accounting, sales own deals, PM
optionally per company setting).

## 5. Enforcement architecture

1. **Database RLS is the boundary.** Every table gets policies keyed to `auth.uid()` and
   `has_role()`. Public/anon access is removed — current demo tables are open and must be
   locked in Sprint 1.
2. **Server functions** perform privileged writes; the admin client is only loaded inside
   handlers after verifying role.
3. **UI hides what the user cannot do** — no dead buttons — but never relies on hiding for
   security.
4. **Assignment scoping:** `project_assignment (project_id, user_id, role_in_project)`
   drives "my projects" for PM/site manager defaults.

## 6. Identity and onboarding

- Email + password plus Google sign-in; no anonymous signups.
- `profile` table (id ↔ auth user, name, initials, avatar color, phone, default landing
  route, active flag).
- Admin invites users in Settings, assigns roles, deactivates leavers (deactivated users
  keep history; their open work must be reassigned — enforced by a reassignment dialog).
- Demo/seed data must be rewritten to reference seeded real users
  (e.g. Yaakov = admin/GM, a PM, a site manager, an office coordinator).

## 7. Open decisions

- Do crews/installers eventually get limited logins (mobile day sheets)? Assume no in v1;
  design `contact.can_login` for later.
- Per-project financial visibility for PMs: company-wide setting or per-user? Recommend
  company-wide setting in Settings.
