# Rules / SOP Engine

The engine that makes the software know the company process so employees don't have to.

## 1. Purpose

Given a project's structure and answers so far, decide:

1. Which **surfaces** should exist for a room type (proposals).
2. Which **questions/requirements** apply (progressive disclosure).
3. Which **install materials** are required and in what quantity.
4. Which **readiness categories** apply and whether they are satisfied.
5. Which **work items** must be auto-created (and by whom).

## 2. Rule shape

```ts
rule = {
  key: 'mud_bed_requirements',
  scope: 'surface' | 'area' | 'project',
  when: Condition,          // jsonb, all-of / any-of tree
  then: Effect[],           // requirements, surfaces, materials, work items
  category: 'installation_systems',
  priority: number,
  is_active: boolean,
  version: number,
}
```

**Conditions** reference typed facts:
`project.type`, `area.room_type`, `surface.kind`, `surface.features[]`,
`answer.<key>`, `selection.tile.thickness_mm`, `selection.tile.actual_w_mm`,
`surface.qty`, `project.stage`.

**Effects:**

| Effect | Result |
| --- | --- |
| `require_answer` | creates a `requirement_instance` + question (options, default, help text) |
| `propose_surface` | offers a surface in the scope builder |
| `require_material` | creates/updates a `material_requirement` with a coverage formula |
| `create_work_item` | creates a work item with kind/subtype/owner role/workflow |
| `mark_category_applicable` / `not_applicable` | shapes readiness |
| `warn` | soft advisory shown in context |

## 3. Progressive disclosure

Questions are only instantiated when their condition is true, so the user never sees an
irrelevant field.

```text
Surface = Shower floor
  → Q: Waterproofing system?  [Sheet | Liquid | Pre-slope + pan liner]
      → if Sheet   → Q: Manufacturer/system?  → materials: membrane, seam tape, corners
      → if Liquid  → Q: Coats? → materials: liquid membrane, fabric
  → Q: Pre-slope method? [Mud bed | Foam tray]
      → if Mud bed → materials: portland, sand, mesh, deck mud calc
  → Q: Drain type? [Point | Linear] → if Linear → Q: length? → metal/profile requirement
Surface has Niche = Yes
  → Q: Niche size/qty, shelf material, waterproofing detail
Metal = Yes
  → Q: Profile type, finish, height (auto-suggested from tile thickness + thinset bed)
```

Answers are stored in `requirement_answer` (jsonb) against a stable `requirement_key`, so
rule edits never orphan history.

## 4. Evaluation model

- Pure function `evaluateRules(projectBundle, ruleSet) → { requirements, proposals,
  materialTargets, workItems, categories }` in `src/lib/rules/`.
- Runs server-side on write (project bundle changed) and on demand for previews.
- **Idempotent:** re-evaluation reconciles by `(rule_id, requirement_key, scope_id)`,
  updating or retiring instances. Answers are never deleted — a retired requirement keeps
  its answer marked `not_applicable`.
- Rule changes are versioned; existing projects keep their instances until a PM presses
  "Re-check requirements" (explicit, with a diff), so a rule edit cannot silently
  un-ready 40 live jobs.

## 5. Authoring UX (Settings → Rules Library, admin only)

Table of rules grouped by category, each row → drawer with a plain-language builder
("When room type is Bathroom and surface is Shower floor, then ask …"). Rules ship as
seeded company defaults so the library is useful on day one; no one has to write JSON.

## 6. Seed rule families (v1)

Room-type surface templates · Waterproofing · Mud bed / deck mud · Self-leveling & prep ·
Membranes (crack isolation, uncoupling) · Niches / benches / curbs · Metals & transitions ·
Large-format requirements (tile > 15" → back-butter, LFT mortar, leveling system) ·
Stone-specific (sealer, white thinset, no-stain grout) · Stairs / risers · Exterior /
freeze-thaw · Site requirements (power, water, storage, protection, access, dumpster) ·
Commercial authorization (deposit before scheduling).

## 7. Guardrails

- The engine advises and requires; it never silently changes prices, schedules, or scope.
- Every auto-created record records `source = rule` and its rule key in history.
- A rule can be marked "advisory" so a company can adopt it without hard-blocking readiness.
