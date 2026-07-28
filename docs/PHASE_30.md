# PHASE 30 — Design System & Redesign (Pencil)

<!-- TOKEN BUDGET: keep this file under 10,000 tokens. Be concise. -->

## Phase Metadata

| Field | Value |
|-------|-------|
| Phase | `30` |
| Title | Design System & Redesign (Pencil) |
| Status | `⏳ pending` |
| Tag | `v0.30.0` |
| Depends on | PHASE_29 gate passing |

---

## Phase Goal

Replace the ad hoc, un-customized shadcn/ui look inherited from Phase 03/12 with a deliberate,
Pencil-authored design system and a redesign of the product's key screens/flows, before any
implementation code changes. This phase produces an approved, versioned design record — tokens,
component visual language, and screen references — that Phase 31 implements. It may propose bounded
UX/IA deltas against SPEC.md §5.3 where Pencil exploration finds a materially better flow, but never
Studio-scope capability (layers/transforms/templates/text, SPEC.md §9). This phase makes **no**
`src/` change (SPEC.md §1.3, §5, §6, §7.1).

---

## Design References

- [remove.bg](https://www.remove.bg) screenshot dated 2026-07-24 (architect-provided) — the
  Phase-25–29 hierarchy/interaction reference this phase supersedes with a durable design record.
- `docs/design/index.pen` — the Pencil source file; the architect has already scaffolded it.

---

## Scope

### Other

- [ ] `T1` Confirm design-tooling readiness: `docs/design/index.pen` open in the pen.dev VS Code
  editor tab, `get_editor_state(include_schema: true)` and `get_guidelines` succeed. Record this as
  a per-session precondition in `docs/design/DESIGN_SYSTEM.md` — Pencil MCP reads/writes the
  currently open tab, not an arbitrary path, so this must be re-confirmed at the start of every
  Pencil work session, including a future `/impl-assist 30` run — _Depends on:_ —
- [ ] `T2` Inventory current UI/UX pain points across the representative surface: empty/upload,
  automatic-processing, editor stage (Cutout Magic/Manual, Enhancements, Background), batch grid,
  error states, mobile and desktop breakpoints, both locales. For each, state what's wrong (generic
  un-themed shadcn tokens, weak visual hierarchy, thin brand identity, etc.) and why it matters —
  _Depends on:_ —
- [ ] `T3` Define design-system foundations in Pencil: color palette (light/dark, WCAG AA contrast
  checked), typography scale (keep the existing Geist Variable brand font, SPEC.md Metadata, unless
  the architect explicitly approves a change), spacing/radius/elevation/motion tokens, and
  iconography direction. Map each token back to the existing Tailwind `@theme` custom-property names
  in `src/app/styles/globals.css` so Phase 31 has a direct implementation target — _Depends on:_ `T1`
- [ ] `T4` Design the core component visual language in Pencil (buttons, cards, toolbar/tool panel,
  sliders, dialogs, upload dropzone, batch grid tile, before/after slider) consistent with `T3`'s
  tokens — _Depends on:_ `T3`
- [ ] `T5` Design the key screens/flows end-to-end in Pencil, both locales, required breakpoints:
  empty/upload, automatic-processing, editor stage with the Cutout(Magic/Manual)/Enhancements/
  Background toolbar and tool panels, batch grid overview + selected-item editor, error/recovery
  states, download menu. Use the remove.bg reference as a hierarchy starting point, not a
  pixel-identical target — _Depends on:_ `T4`
- [ ] `T6` Where `T5` surfaces a materially better UX/IA than the current automatic-first → toolbar
  structure (SPEC.md §5.3), document the proposed delta explicitly: what changes, why, and its
  impact on Phase-25–29 contracts. Stay inside the focused-product boundary (SPEC.md §9) — no
  layers, transforms, templates, or a Studio-scope surface — _Depends on:_ `T5`
- [ ] `T7` Validate the design system for accessibility (contrast ratios, focus states, touch target
  sizes ≥ 24×24px, motion/`prefers-reduced-motion` behavior) and responsive behavior at the required
  breakpoints (SPEC.md §5.4) before finalizing — _Depends on:_ `T5`
- [ ] `T8` Export the approved design system and screens as durable repository evidence using Pencil's
  `export_html`/`export_nodes`/`get_screenshot` tools into `docs/design/exports/`. Write
  `docs/design/DESIGN_SYSTEM.md` summarizing tokens, components, screens, the `T6` IA-delta decision
  (or explicit "no IA change"), and accessibility evidence. Record a dated architect approval line —
  _Depends on:_ `T2`–`T7`
- [ ] `T9` If `T6` proposes an approved IA delta, run `/spec-sync` to fold it into SPEC.md §5.3 before
  Phase 31 starts implementation — _Depends on:_ `T8`

---

## Files

### Create / modify

~~~
docs/design/index.pen
docs/design/DESIGN_SYSTEM.md
docs/design/exports/
docs/STACK.md
docs/PHASE_30.md
~~~

### Do NOT touch

- Anything under `src/`, `e2e/`, `messages/`, `public/` — this phase produces a design record only,
  never implementation code
- Studio-scope capability: layers, free object transforms, shadows, perspective, text, templates,
  marketplace-card composition (SPEC.md §9)
- Model/inference logic, quality-mode mapping, or any non-visual product behavior

---

## Contracts

### New persistent data (tables / collections / files)

None at runtime. `docs/design/DESIGN_SYSTEM.md` and `docs/design/exports/` are repository design
documentation, not application data.

### New API endpoints / RPC methods / events

None.

### New types / models / shared interfaces

None. `T3`'s token mapping is an implementation preview for Phase 31, not a binding code contract
until implemented.

### New env vars

None.

---

## Gate Checks

> **Before running gate:** confirm all Scope checkboxes are checked (or explicitly deferred in
> Architect Review Notes).

Run `/phase-gate 30`. Because this phase makes no `src/` change, the standard `docs/STACK.md` gate
commands are expected to pass unmodified (a regression signal if they don't) — no e2e spec is added.
Phase-specific checks:

```bash
git diff --stat main -- src/ e2e/ messages/ public/   # must be empty
```

Fail if: `docs/design/index.pen` was never confirmed open/readable via Pencil MCP during the work;
`docs/design/DESIGN_SYSTEM.md` is missing required screens/states/tokens or lacks a dated architect
approval line; contrast/motion accessibility evidence is missing; any `src/`/`e2e/`/`messages/`
diff exists; or the design proposes Studio-scope capability.

---

## Architect Review Notes

- [x] No architect review issues recorded

## Implementation Notes

None

## Atomic Commit Message

```text
docs(phase-30): add Pencil design system and redesign record
```

## Post-Phase Checklist

- [ ] Scope complete; gates green; review notes resolved
- [ ] Run `/context-update 30`
- [ ] Commit on `feat/phase-30`; tag `v0.30.0` after merge
