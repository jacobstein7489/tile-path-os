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
