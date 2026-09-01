# Design System Plan

No redesign in Sprint 0. This is the specification later sprints implement **once**.

## 1. Principles

Premium · modern · bright · calm · clean · soft · minimal · professional.
Summary first, detail on click. Restraint over decoration. One visual language everywhere.

Explicit bans: dark sidebar, giant hero cards, multi-color KPI walls, decorative gradients,
purple/indigo SaaS defaults, generic admin-template layouts, more than one accent color per
screen, dead buttons, clipped content, inconsistent page widths.

## 2. Foundations (tokens only, no hardcoded colors in components)

- **Color:** OKLCH tokens in `src/styles.css`. Page `--background` soft neutral, surfaces
  white, borders very low contrast, text near-black with a clear 3-step hierarchy
  (primary/secondary/muted). Single blue `--primary`. Semantic green/amber/red reserved for
  status chips and never used for layout.
- **Typography:** one geometric sans (current Plus Jakarta Sans is acceptable). Scale:
  28/20/16/14/13/12 with tight tracking on headings, 1.45 body leading. Numeric columns use
  tabular figures.
- **Spacing:** 4px base; section rhythm 24/32; page padding 32; card padding 20/24.
- **Radius:** 8 (controls), 12 (cards), 999 (chips).
- **Elevation:** borders first; at most two shadows (`sm` for cards on hover, `lg` for
  drawers/modals).
- **Motion:** 120–180ms ease-out; drawers slide, rows fade. No bounce, no spinners longer
  than 400ms without skeletons.

## 3. Component inventory (single source: `src/components/ui` + `kit`)

App shell · Sidebar (nav + org card) · Page header (title, subtitle, actions) ·
Project header (identity, chips, ••• menu) · Lifecycle rail · Underline tabs · Filter bar /
segmented counts · Table (Table/Th/Td/Row) · Clickable row · Button (primary/secondary/
ghost/danger, all states) · Icon button · Status chip · Progress bar · Readiness meter ·
Avatar / initials · Drawer · Modal · Toast (sonner) · Checkbox / radio / switch · Text input
/ textarea / select / combobox (select-first pickers) · Date field · Inline editable field ·
Empty state · Skeleton · Section card · KPI stat (quiet) · Step sequence · History timeline ·
Attachment tile.

Every interactive component must define: default · hover · focus-visible · pressed ·
loading · disabled · error · success.

## 4. Interaction standards

- Whole rows and whole cards are click targets; nested actions stop propagation.
- If a value is displayed, clicking it edits it (crew, dates, owner, status, selections).
- Optimistic writes + toast; failures roll back and show an inline error, never a silent no-op.
- Completion = strike-through + "Completed — Undo" for ~6s, then relocation.
- Keyboard: `/` search, `C` quick capture, `Esc` closes overlay, arrow navigation in tables.
- Accessibility: AA contrast, visible focus rings, labelled controls, `aria-live` for toasts.

## 5. Governance

1. Tokens and primitives live in one place; pages compose, never restyle.
2. A page may not introduce a new color, radius, shadow, or font size — extend the token set
   instead (requires a note in this doc).
3. A component-usage lint pass at the end of each sprint: no raw `text-white`/`bg-[#…]`, no
   duplicated table/chip implementations.
4. Screens are reviewed at 1440×900 and 1280×800 before a sprint is called done.

## 6. Current state assessment

`src/components/kit.tsx` and `src/lib/status.tsx` are a solid starting kit (Table, Modal,
Drawer, Chip, Button, Field, EmptyState, StepSequence). Gaps: no combobox/inline-edit/
skeleton/avatar/history-timeline; button lacks loading/pressed states; several routes still
style locally; density and spacing drift page to page. Sprint 1 hardens the kit and migrates
existing routes onto it rather than restyling each page again.

## 7. Sprint 1 design freeze (binding)

Sprint 1 establishes ONE production Cobblestone design system **before** any additional
application screens are developed. Frozen values:

| Element | Frozen spec |
| --- | --- |
| Type scale | 28 / 20 / 16 / 14 / 13 / 12 px; headings tracking -0.01em; body leading 1.45; tabular figures in every numeric column |
| Spacing tokens | 4px base; page padding 32; section rhythm 24/32; card padding 20/24; table cell 12/14 |
| Sidebar | fixed 248px, light surface, 13px nav labels, 36px rows, single active state |
| Header | 64px project/page header, title 20px, actions right-aligned, one primary button |
| Page shell | max content width 1440, single scroll container, no nested scrollbars |
| Table density | 40px header row, 44px body row, 13px text, hover tint, full-row click target |
| Drawer | 480px right-side; Modal 560px standard / 720px builder; both radius 12, shadow lg |
| Buttons | primary / secondary / ghost / danger x default, hover, focus-visible, pressed, loading, disabled |
| Inputs | 36px height, radius 8, 1px border, focus ring 2px primary at 30%; searchable selector is the default for any reference field |
| Status | one chip component driven by `src/lib/status.tsx`; families never share colors |
| Progress | one bar component; 6px track; derived values only |
| Feedback | sonner toast; skeletons for >400ms; inline error under the field; success = state change, not a banner |
| Empty states | one component: icon, one line of meaning, one primary action |

Rules:

1. **No route may introduce independent local styling when a shared component or token
   exists.** No new color, radius, shadow, or font size in a page file.
2. Every core screen must be migrated onto the shared kit within Sprint 1.
3. Visual goal: premium, modern, extremely clean, bright/light, restrained color, minimal
   scrolling, summary-first / detail-on-click. The approved Cobblestone references are the
   quality bar.
4. Sprint 1 is not done until every screen is verified at **1440x900 and 1280x800** with no
   clipped content, no dead controls, and full-row natural click targets.
