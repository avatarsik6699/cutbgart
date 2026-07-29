# PHASE 30 — Design System & Redesign

<!-- TOKEN BUDGET: keep this file under 10,000 tokens. Be concise. -->

## Phase Metadata

| Field | Value |
|-------|-------|
| Phase | `30` |
| Title | Design System & Redesign |
| Status | `⏳ pending` |
| Tag | `v0.30.0` |
| Depends on | PHASE_29 gate passing |

---

## Phase Goal

Replace the ad hoc, un-customized shadcn/ui look inherited from Phase 03/12 with a formalized design
system and a redesign of the product's key screens/flows, implemented directly in this same phase —
no separate design-authoring phase, no exported design record handed off for later implementation.
Two prior attempts to author this with an external tool (Pencil/pen.dev, then Claude Design) were
tried and rejected by the architect; see `docs/STATE.md` § Project Log, 2026-07-29. This phase
instead iterates on what already ships: upgrade `shadcn/ui` and lean on its stock components, keep
the existing color palette and typography (formalized as documented tokens, not replaced), rework
weak layout/loading/background treatment, and consolidate the superseded pre-redesign UI in the same
pass — one pass over `shared/ui`/`ToolWorkspace`/tool panels instead of a design pass followed by a
separate implementation phase. This is a consolidation and visual-implementation phase, not
authorization for Studio features (SPEC.md §2.2, §5.2–§5.4, §7.1, §9). Any Phase-25–29 batch
capability missing here is a regression to fix, not accepted scope deferral.

---

## Design References

No external design tool or exported mockup — the baseline is the current implementation:
`src/pages/home/ui/HomePage.tsx`, `src/widgets/tool-workspace/`, `src/shared/ui/`, and the existing
tokens in `src/app/styles/globals.css` (`components.json`: `style: base-nova`, `baseColor: neutral`).
The [remove.bg](https://www.remove.bg) screenshot dated 2026-07-24 (architect-provided) remains
available as the Phase-25–29 hierarchy/interaction reference this phase may still consult, but it is
not a pixel target.

---

## Scope

### Design System Foundations

- [x] `T1` Inventory current UI/UX pain points across the representative surface: empty/upload,
  automatic-processing, editor stage (Cutout Magic/Manual, Enhancements, Background), batch grid,
  error states, mobile and desktop breakpoints, both locales. For each, state what's wrong (generic
  un-themed shadcn tokens, weak visual hierarchy, thin brand identity, etc.) and why it matters —
  _Depends on:_ —
- [x] `T2` Upgrade `shadcn/ui` to its current released version via the `shadcn` CLI against
  `components.json`; re-diff the existing `button`/`card`/`switch` primitives for upstream changes
  and note any breaking API change before restyling depends on it — _Depends on:_ —
- [x] `T3` Formalize the existing color palette and typography (Geist Variable brand font, SPEC.md
  Metadata — unchanged unless the architect explicitly approves a change) as documented Tailwind
  `@theme`/`:root` tokens in `src/app/styles/globals.css` (light/dark, WCAG AA contrast checked);
  add spacing/radius/elevation/motion tokens where currently only implicit in ad hoc class names —
  _Depends on:_ `T2`
- [x] `T4` Design and implement a subtle background pattern: engineering-grid/dot lines, low opacity,
  fading out gradually from a focal point, no motion. Implement as a reusable `site-shell`-level
  background layer; verify `prefers-reduced-motion` behavior and WCAG AA contrast of foreground
  content placed over it — _Depends on:_ `T3`

### Component Adoption & Layout

- [x] `T5` Pull additional stock shadcn/ui components into `shared/ui` as needed to replace bespoke
  markup: `Skeleton` (loading states), `Tooltip`/`Popover` (compact utility triggers), and any other
  primitive that already covers a hand-rolled pattern in `widgets/tool-workspace` or `pages/home` —
  _Depends on:_ `T2`
- [x] `T6` Rework the home-page layout: relocate `features/model-storage`'s `ModelStorageManager` out
  of its current floating `<aside>` below `ToolWorkspace` — e.g. into `site-header` as an icon
  trigger with `Tooltip`/`Popover` — preserving its existing cache-status/clear behavior and
  localization; re-balance the surrounding hero/feature/workspace composition — _Depends on:_ `T5`
- [x] `T7` Document the architect-approved IA delta in `docs/design/DESIGN_SYSTEM.md` and
  `SPEC.md §5.3`: marketing-led empty state → same-URL application workspace; workspace top bar;
  stable contain-fit stage with right tool rail and canvas controls; batch filmstrip reusing the
  same editor. Preserve the Phase-25–29 state/document contracts and focused-product boundary —
  _Depends on:_ `T6`

### Apply Across the App

- [x] `T8` Apply `T2`–`T5`'s tokens/components to every `src/shared/ui` component and
  `site-header`/`site-footer`/`site-shell` — _Depends on:_ `T5`
- [x] `T9` Apply the redesign to the upload surface, `widgets/tool-workspace` (stage, toolbar, tool
  panel slot, Cutout/Enhancements/Background panels, processing log — `Skeleton` placeholders during
  model-loading/processing) and the batch grid, preserving every existing state-machine/document/
  history contract from Phases 25–29 unless `T7` implements an approved delta — _Depends on:_ `T8`
- [x] `T10` Implement exactly `T7`'s approved bounded IA delta through the Architect Review Notes
  below. Do not add routes, persistence, APIs, Studio tools, or a second single/batch state machine —
  _Depends on:_ `T9`, `T22`
- [x] `T11` Remove superseded public UI/copy left over from the pre-redesign era not already removed
  in Phases 25–29: stray visual remnants, duplicate rail controls, technical/debug-shaped copy.
  Retain internal model-lab diagnostics and legacy source still required by active protocols —
  _Depends on:_ `T9`

### Legacy Consolidation & Regression Hardening

- [x] `T12` Audit and normalize the Phase-25 per-item ownership contract: each successful
  `BatchItem` has one independent `EditDocument`, artifact-store scope, committed history, active
  tool, and draft; remove any remaining duplicate or late-adoption adapter — _Depends on:_ `T9`
- [x] `T13` Verify the redesigned shared stage/toolbar/panel for the selected completed item has
  full Cutout Magic/Manual, Enhancements, Background, undo/redo, and sized individual PNG behavior;
  preserve per-item tool/draft/history/zoom state on safe selection changes — a dirty draft requires
  Apply/Discard/Stay, never silent loss or cross-item transfer — _Depends on:_ `T12`
- [x] `T14` Keep batch processing concurrency/error isolation, heavy-stage serialization (Phases
  10/16/19), and cleanup-on-removal (artifacts, uploaded background blobs, object URLs, drafts,
  workers) intact; keep Download-all as a client-side ZIP of each item's committed PNG — _Depends
  on:_ `T12`, `T13`
- [x] `T15` Audit `ToolWorkspace` after migration: no duplicated single/batch state machine, no
  same-layer feature imports, no unbounded artifact/stroke retention, no full image buffers in React
  state/props, no god-component regression. Delete only proven-dead adapters after callsite/test
  verification — _Depends on:_ `T9`–`T14`
- [x] `T16` Complete bilingual/responsive/accessibility polish under the reworked design: stable
  stage/panel geometry, toolbar overflow/navigation, touch targets, focus restoration, dirty-draft
  dialogs, screen-reader statuses, `prefers-reduced-motion` (including the new background pattern),
  WCAG AA contrast on every restyled surface, mobile camera/upload, and icon tooltips — _Depends
  on:_ `T8`–`T15`
- [x] `T17` Add focused tests for per-item isolation, selection guards, stale work, cleanup, ZIP
  committed output, retained internal diagnostics, removed public copy/callsites, architecture
  boundaries, and memory/history budgets under many-item churn — _Depends on:_ `T12`–`T16`
- [x] `T18` Rewrite/extend deterministic Playwright flows across configured browsers/locales for
  single and batch journeys under the reworked UI: upload/automatic result, every tool, draft
  guards, per-item history, individual export, ZIP, reset/new upload, errors/fallbacks,
  keyboard/touch behavior, stage layout stability, and absence of superseded UI — _Depends on:_ `T17`
- [ ] `T19` Run the complete existing real-model evidence chain applicable to automatic removal,
  Magic, Enhancements, foreground cleanup, and downloads on the available host. Add no new
  model/package, route, API, env var, analytics payload, persistence, Docker/CI Playwright, or
  Studio bundle — _Depends on:_ `T18`
- [ ] `T20` Re-measure TTI/LCP/INP (SPEC.md §1.2) after the redesign on the available host; a
  regression against the pre-redesign baseline is release-blocking for this phase — _Depends on:_
  `T16`

### Record

- [ ] `T21` Write `docs/design/DESIGN_SYSTEM.md` summarizing the formalized tokens, component
  conventions, screens/states covered, the `T7` IA-delta decision (or explicit "no IA change"), and
  accessibility evidence. Save before/after screenshots as durable evidence in
  `docs/design/exports/`. Record a dated architect approval line — _Depends on:_ `T1`–`T20`
- [x] `T22` Run `/spec-sync` before review implementation to fold the approved IA delta into
  `SPEC.md §5.3` and `docs/STATE.md`; final visual evidence/approval still belongs to `T21` —
  _Depends on:_ `T7`

---

## Files

### Create / modify

~~~
docs/design/DESIGN_SYSTEM.md
docs/design/exports/
docs/PHASE_30.md
components.json
src/app/styles/globals.css
src/shared/ui/button.tsx
src/shared/ui/card.tsx
src/shared/ui/switch.tsx
src/shared/ui/skeleton.tsx
src/shared/ui/tooltip.tsx
src/shared/ui/popover.tsx
src/shared/ui/site-header.tsx
src/shared/ui/site-footer.tsx
src/shared/ui/site-shell.tsx
src/pages/home/ui/HomePage.tsx
src/features/model-storage/ui/ModelStorageManager.tsx
src/features/batch-processing/model/types.ts
src/features/batch-processing/model/use-batch-processing.ts
src/features/batch-processing/model/*.test.ts
src/features/batch-processing/ui/BatchGrid.tsx
src/features/batch-processing/ui/BatchGrid.test.tsx
src/entities/edit-document/
src/features/editor-history/
src/features/download-result/lib/create-results-zip.ts
src/features/download-result/lib/create-results-zip.test.ts
src/widgets/tool-workspace/model/use-tool-workspace-controller.ts
src/widgets/tool-workspace/model/use-tool-workspace-controller.test.ts
src/widgets/tool-workspace/ui/ToolWorkspace.tsx
src/widgets/tool-workspace/ui/ToolWorkspace.test.tsx
src/widgets/tool-workspace/ui/EditorStage.tsx
src/widgets/tool-workspace/ui/EditorToolbar.tsx
src/widgets/tool-workspace/ui/ToolPanelSlot.tsx
src/widgets/tool-workspace/ui/CutoutToolPanel.tsx
src/widgets/tool-workspace/ui/EnhancementsToolPanel.tsx
src/widgets/tool-workspace/ui/BackgroundToolPanel.tsx
src/widgets/tool-workspace/ui/ProcessingLog.tsx
src/features/upload-image/
messages/ru.json
messages/en.json
e2e/home.spec.ts
e2e/brush-guided-correction.spec.ts
e2e/mask-correction.spec.ts
e2e/hybrid-pipeline.spec.ts
e2e/foreground-refinement.spec.ts
e2e/scenario-pages.spec.ts
e2e/support/mock-inference.ts
~~~

### Do NOT touch

- Add batch-wide editing/templates, bulk size conversion, cloud history, accounts, storage, API
- Delete model-lab/internal runtime evidence or legacy protocol code still imported/tested
- Change model pins/quality algorithms without new evidence and an explicit spec change
- Add layers, transforms, shadows, perspective, text, templates, or any Studio route/bundle
- Any IA change beyond what `T7` explicitly approved
- No new dependency (icon set, animation library) beyond what the `shadcn` CLI itself pulls for the
  components adopted in `T5`, unless evidence justifies one

---

## Contracts

### New persistent data (tables / collections / files)

None. Every batch document/history remains browser-tab memory only and is released with its item.
`docs/design/DESIGN_SYSTEM.md` and `docs/design/exports/` are repository design documentation, not
application data.

### New API endpoints / RPC methods / events

None.

### New types / models / shared interfaces

```ts
interface EditableBatchItem extends BatchItem {
  document: EditDocument | null;
  history: EditHistory;
  activeTool: EditorToolId | null;
  hasDirtyDraft: boolean;
}
```

An item owns its document/history; no artifact ID or draft is valid across item scopes. ZIP reads
committed current composites only and keeps Phase-10 per-item error isolation.

### New env vars

None.

---

## Gate Checks

> **Before running gate:** confirm all Scope checkboxes are checked (or explicitly deferred in
> Architect Review Notes).

Run `/phase-gate 30` with the complete `docs/STACK.md` gate. Also:

```bash
pnpm vitest run
pnpm exec steiger ./src
pnpm e2e
pnpm e2e:real-model
pnpm e2e:phase-21-real
pnpm e2e:phase-19-real
pnpm e2e:phase-20-real
pnpm tsc --noEmit
```

Fail if single/batch editors diverge, item state/history leaks, dirty work is silently lost, stale
work crosses items, ZIP captures drafts, cleanup leaks resources, removed/superseded UI remains,
internal diagnostics are accidentally deleted, Studio scope enters the focused bundle, an
unapproved IA change ships, WCAG AA contrast/motion regresses (including the new background
pattern), or TTI/LCP/INP regresses against the pre-redesign baseline.

---

## Architect Review Notes

- [x] Recompose the home empty state as one 5/7 marketing/upload layout, hide all marketing content
  after file acceptance, and replace the barely visible dot layer with the approved fading
  engineering-line grid.
- [x] Replace primary single/batch model-loading and processing visuals with stable stage/panel/tile
  Skeleton states while retaining localized progress semantics and no visible spinner/native
  progress UI.
- [x] Add compact workspace chrome for return-to-upload, current document/batch context,
  diagnostics and batch actions; remove the oversized Process another/Reprocess toolbar actions.
- [x] Make result, Magic and Manual share one stable contain-fit stage without square forcing,
  crop, aspect-ratio-dependent outer size, or mode/item layout shift.
- [x] Move selected-tool controls into the desktop right rail, add the shared Cutout canvas-view
  overlay, and preserve per-document zoom/pan/interaction state plus keyboard/touch alternatives.
- [x] Move technical processing logs out of the page grid into an explicit diagnostics Sheet/Drawer
  that is closed by default and does not consume editor space.
- [x] Restore a dashed, contrast-safe outer brush footprint with a solid inner/core treatment for
  both Magic and Manual. Superseded by the second review's restrained solid outer/core treatment
  below.
- [x] Replace the bottom batch overview with a vertical desktop/horizontal narrow-screen filmstrip,
  simplify batch chrome, preserve the shared editor contract, and eliminate container/page overflow
  at 390, 768, 1024 and 1440 px. Superseded by the second review's all-width horizontal filmstrip
  below.
- [x] Extend unit/component and deterministic Playwright coverage for the approved IA delta,
  single/batch geometry parity, loading skeletons, diagnostics, brush cursor, aspect ratios and
  responsive overflow. Keep `T19`–`T21` pending for later evidence/architect approval.
- [x] Soften the approved engineering grid, and keep Recommended/Beta badges aligned to the right
  of their processing-mode title at every responsive width.
- [x] Make Cutout Zoom, Pan, Fit and Fullscreen visibly functional on compatible Magic/Manual
  surfaces, including an in-page fallback where arbitrary-element Fullscreen is unavailable.
- [x] Restore the restrained solid outer/core brush treatment, use non-technical Brush size copy,
  add symmetric Magic hints, keep Magic/Manual control geometry stable, and center both canvases.
- [x] Remove the duplicate Enhancements heading and replace its repeatable no-op idle Cancel with an
  explicit Stop action only while enhancement work is running.
- [x] Eliminate Background rail and page horizontal overflow, including the native custom-image
  input at narrow rail widths.
- [x] Remove the separate workspace top bar and compose tool, batch, download, diagnostics and
  rightmost return-to-upload actions into one compact toolbar in every non-empty state.
- [x] Move batch navigation to one horizontal top filmstrip at every breakpoint, integrate a visual
  status summary, add per-item Download/Retry-or-Reprocess/Remove menus with dirty-draft guards, and
  fold Download all into the toolbar Download menu.
- [x] Extend unit/component and deterministic Playwright coverage for this second review iteration
  at 390, 768, 1024 and 1440 px while keeping `T19`–`T21` pending.
- [x] Replace the empty-state upload card with the approved icon-led command deck, prevent
  Recommended/Beta overlap, add reduced-motion-safe ambient treatment, and keep the engineering
  grid below an opaque site header.
- [x] Put return-to-upload first on the left of the workspace toolbar and portal the stable
  diagnostics Sheet/Drawer trigger into the site header beside model storage.
- [x] Add localized shortcut disclosure, `H`/`B`/`F` handling, `grab`/`grabbing` cursors and
  per-document collapse state to the shared Magic/Manual viewport controls.
- [x] Restore one-screen-pixel dashed outer brush footprints with a solid core for Magic, Manual
  and the transient size preview, without a heavy halo.
- [x] Give Magic and Manual one fixed rail structure with bottom-pinned Apply/Cancel, remove
  separators and visible draft Undo/Redo/Clear controls while retaining tool-local keyboard
  history.
- [x] Replace the divergent transparency backgrounds with one checkerboard design-system token
  across comparison, Magic, Manual, Enhancements, Background and the transparent-fill swatch.
- [x] Replace the Magic spinner/brush busy mixture with a stable localized Skeleton overlay that
  hides the custom cursor and never uses a native wait cursor.
- [x] Keep the active document's stage, comparison, Magic and Manual preview ownership stable
  across tool switches, reuse blob URLs/decoded canvases, remove the always-used panel Suspense
  boundary, and verify there is no blank-frame flicker.

## Implementation Notes

- `T6`: relocating `ModelStorageManager` behind a `site-header` icon trigger added ~40px to an
  already-tight mobile nav row, pushing the language switcher off-screen (horizontal page overflow,
  verified via `document.documentElement.scrollWidth` at 390px). Fixed by making the header row and
  nav wrap (`flex-wrap`) instead of overflowing — a pre-existing near-the-edge fit, not something
  `T1`'s inventory had flagged; noted here since `T16` (the dedicated responsive pass) would
  otherwise be the first place this surfaced.
- `T6`: `shared/ui/site-header`/`site-shell` cannot import `features/model-storage` directly (FSD
  layering — `shared` is below `features`). Added a generic `headerUtilitySlot`/`utilitySlot`
  `ReactNode` prop instead, so `pages/home` composes the actual `ModelStorageTrigger`
  (`features/model-storage`) and passes it down. Kept scoped to the home page only, matching the
  pre-existing behavior (`ModelStorageManager` was never rendered on the four scenario pages either).
- `T13`: the full Chromium e2e suite caught a real ambiguous-locator regression from `T6` —
  `e2e/home.spec.ts:182`'s loose `/download/i` button-name regex started matching the new
  `model-storage-trigger` ("Downloaded model storage") once that control moved into the
  always-visible header. Anchored the regex to `/^download$/i` (matching every other download-button
  locator already in the suite) rather than renaming the trigger — see
  `docs/design/DESIGN_SYSTEM.md` §4c.
- Second review: `CanvasViewControls` originally passed optional-anchor zoom commands directly to
  React `onClick`, so the click event was interpreted as a point and produced invalid offsets.
  Command buttons now use zero-argument adapters, with regression coverage in unit and browser
  tests; the reusable trap is recorded in `docs/KNOWN_GOTCHAS.md`.
- Second review: arbitrary-element fullscreen remains unavailable in Mobile Safari. The required
  inline fallback therefore raises the workspace content stacking context above page chrome while
  expanded, preventing the footer from intercepting its exit control.
- Third review: the header reserves one stable portal target for workspace diagnostics. The
  workspace retains the Sheet/Drawer state and content, while `createPortal` changes only the
  trigger's visual placement; the reserved target prevents hydration and workspace-state layout
  shifts.
- Third review: one document-keyed correction session now owns persistent comparison, Magic and
  Manual layers. Hidden layers retain their decoded canvas/blob URL state with pointer events
  disabled, and an available `alphaMatte` seeds Manual synchronously; changing the document key
  still disposes the session so drafts cannot cross single/batch document boundaries.
- Third review: persistent hidden Magic/Manual layers keep their local state but only the active
  layer owns global viewport and draft-history shortcuts. Committed Undo/Redo rebases the active
  Magic session to the restored image and matte so a later draft cannot restart from stale pixels.
- Third review: the deterministic runner keeps Chromium parallel but runs Firefox, WebKit and
  Mobile Safari with one worker. Their software-rendered persistent alpha canvases otherwise
  compete for scheduler and memory under parallel full-suite load; this changes orchestration, not
  assertions, browser coverage or product behavior.

## Atomic Commit Message

```text
refactor(phase-30): formalize design system and redesign in-repo
```

## Post-Phase Checklist

- [ ] Scope complete; full gates green; review notes resolved
- [ ] Run `/context-update 30`
- [ ] Commit on `feat/phase-30`; tag `v0.30.0` after merge
