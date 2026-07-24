# PHASE 28 — Unified Cutout Tool

## Phase Metadata

| Field | Value |
|-------|-------|
| Phase | `28` |
| Title | Unified Cutout Tool |
| Status | `⏳ pending` |
| Tag | `v0.28.0` |
| Depends on | PHASE_27 gate passing |

---

## Phase Goal

Replace separate guided-selection and exact-mask entry points with one Cutout tool containing
`Magic` and `Manual`. Remove candidate/debug-shaped UI, make repeated correction predictable, and
make the brush-size preview match the real image-stage footprint for a single document and any
selected completed batch document (SPEC.md §5.3–§5.4, §7.1, §7.3, §7.7, §8).

## Design References

- Architect-provided remove.bg screenshot (2026-07-24) — Cutout panel with Magic/Manual behavior,
  Erase/Restore, size slider, stable image stage, compact actions.
- [remove.bg Magic Brush help](https://www.remove.bg/uk/help/a/how-to-use-magic-brush) — semantic
  brush corrects an automatically removed result; reference only, not a copy requirement.

---

## Scope

### Frontend

- [ ] `F1` Add one Cutout panel with persistent `Magic`/`Manual` mode tabs/segmented control.
  Switching modes preserves the same stage/zoom and never creates a parallel result document.
  Bind through the shared editor controller so the identical panel works on a single image or the
  selected completed `BatchItem` — _Depends on:_ —
- [ ] `F2` Map Magic to the existing guided semantic brush with `Keep`/`Remove`; map Manual to exact
  alpha `Restore` (opaque/add) and `Erase` controls. Do not expose the old restore-to-model brush as
  a third primary mode; baseline recovery remains available through draft/document undo —
  _Depends on:_ `F1`
- [ ] `F3` Remove from the primary Cutout UI: split Markings/Result panes, Current result section,
  candidate cards/navigation/descriptions, stroke/point/prompt limits, no-auto-run copy, model
  terminology, and `Continue from this result`. Keep internal ranking and legacy tests/source —
  _Depends on:_ `F1`, `F2`
- [ ] `F4` On Magic Apply, run SlimSAM only for a dirty non-empty draft, automatically choose the
  existing intent-best candidate, apply hard constraints, commit one `cutout` operation, promote
  it to the next base, and clear the applied draft. Additional strokes form a new explicit pass —
  _Depends on:_ `F3`
- [ ] `F5` If Magic Apply follows removal of every stroke and a current base exists, restore that
  base locally and clear stale candidates without inference. If there is no base, keep the green
  intent requirement. Disable Apply only when there is truly no visible change to apply —
  _Depends on:_ `F4`
- [ ] `F6` Manual paints a live exact-alpha draft; Apply recomposites and commits one `manual`
  operation, while Cancel restores the last committed document. Tool switching/reset/new upload
  uses the Phase-27 dirty-draft guard — _Depends on:_ `F2`
- [ ] `F7` Replace textual draft undo/redo/clear buttons with localized icon buttons and tooltips.
  Keep Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, and Ctrl/Cmd+Y scoped to the active draft while it is dirty;
  toolbar document history remains separate — _Depends on:_ `F4`, `F6`
- [ ] `F8` Replace the rail brush swatch with an ephemeral stage-centered preview. Convert the
  selected source-pixel diameter through the exact current viewport transform (including zoom),
  update during keyboard/pointer slider changes, and hide shortly after interaction. Respect
  reduced motion and do not intercept canvas input — _Depends on:_ `F1`, `F2`
- [ ] `F9` Keep zoom/pan keyboard and pointer behavior in both modes, cache gesture geometry, and
  ensure the preview/cursor/actual stamp share one source-to-viewport conversion — _Depends on:_
  `F8`
- [ ] `F10` Simplify actions to `Apply` and `Cancel` plus draft icons. Busy/error states preserve
  markings and the last committed document, reject stale responses, and never silently apply on
  tool close or batch-item switch — _Depends on:_ `F4`–`F9`
- [ ] `F11` Add unit/component/hook tests for mode mapping, automatic candidate selection, repeated
  passes, Apply/Cancel commits, zero-mark base reset, draft-vs-document history, exact-alpha
  semantics, stage preview geometry at multiple aspect ratios/zoom levels, keyboard input, and
  stale/error preservation — _Depends on:_ `F1`–`F10`
- [ ] `F12` Replace/extend Playwright coverage across all configured browsers/locales for automatic
  result → Cutout → Magic/Manual, icon history, viewport-accurate transient size preview,
  repeated Apply, zero-mark reset without inference, Cancel, zoom/pan, toolbar history boundary,
  and absence of removed technical/candidate copy. Repeat core Apply/Cancel/history/isolation flows
  on two selected items from a multiple upload — _Depends on:_ `F11`

### Infra

- [ ] `I1` No new model/package/asset/route/env/analytics/persistence. Reuse the Phase-21 real-model
  command only if implementation changes worker orchestration; otherwise normal real-model smoke is
  sufficient — _Depends on:_ `F12`

---

## Files

### Create / modify

~~~
src/widgets/tool-workspace/ui/CutoutToolPanel.tsx
src/widgets/tool-workspace/ui/CutoutToolPanel.test.tsx
src/widgets/tool-workspace/ui/BrushSizeStagePreview.tsx
src/widgets/tool-workspace/ui/BrushSizeStagePreview.test.tsx
src/widgets/tool-workspace/model/use-tool-workspace-controller.ts
src/features/select-object/model/guided-brush-session.ts
src/features/select-object/model/use-object-selection.ts
src/features/select-object/model/*.test.ts
src/features/select-object/ui/GuidedBrushCanvas.tsx
src/features/select-object/ui/GuidedBrushControls.tsx
src/features/select-object/ui/*.test.tsx
src/features/correct-mask/model/use-mask-correction.ts
src/features/correct-mask/ui/MaskCorrectionCanvas.tsx
src/features/correct-mask/ui/MaskCorrectionToolbar.tsx
src/features/correct-mask/**/*.test.ts*
src/features/editor-history/
src/features/batch-processing/ui/BatchGrid.tsx
src/features/batch-processing/ui/BatchGrid.test.tsx
src/widgets/tool-workspace/ui/ToolWorkspace.tsx
src/app/styles/globals.css
messages/ru.json
messages/en.json
e2e/brush-guided-correction.spec.ts
e2e/mask-correction.spec.ts
docs/PHASE_28.md
~~~

### Do NOT touch

- SlimSAM model assets/revision, candidate-ranking/fusion quality rules, or advanced boundary
  algorithms explicitly deferred after Phase 21
- Matting/foreground algorithms, Background/export content, or batch-wide editing
- Delete legacy point/box/layer internals still used by worker/session compatibility
- Server/API/persistence/analytics/routes/SEO or Studio features

---

## Contracts

### New persistent data (tables / collections / files)

None.

### New API endpoints / RPC methods / events

None.

### New types / models / shared interfaces

```ts
type CutoutMode = "magic" | "manual";
type CutoutIntent = "keep" | "remove";
type ManualCutoutMode = "restore" | "erase";

interface CutoutDraft {
  mode: CutoutMode;
  dirty: boolean;
  canApply: boolean;
  applying: boolean;
}
```

Magic Apply chooses the internally top-ranked candidate and commits it; alternatives are not a
public selection contract. Applied marks become the new base and are cleared visibly. A base-backed
empty reset never invokes the model. Draft history and committed document history stay separate.

### New env vars

None.

---

## Gate Checks

Run `/phase-gate 28`; standard checks plus:

```bash
pnpm vitest run src/features/select-object src/features/correct-mask \
  src/features/editor-history src/widgets/tool-workspace
pnpm e2e e2e/brush-guided-correction.spec.ts e2e/mask-correction.spec.ts
pnpm tsc --noEmit
pnpm exec steiger ./src
```

Fail if two correction entry points remain, removed candidate/quota/Continue UI is public, Apply
does not promote the base for repeated passes, empty base reset calls the model or stays disabled,
Manual has ambiguous add/restore language, or the displayed brush diameter disagrees with the
actual stamp after zoom.
Also fail if Cutout is absent/different for a selected batch item, a draft or document operation
crosses item boundaries, or switching items silently applies/discards dirty Cutout work.

---

## Architect Review Notes

- [x] No architect review issues recorded

## Implementation Notes

None

## Atomic Commit Message

```text
feat(phase-28): unify Magic and Manual cutout editing
```

## Post-Phase Checklist

- [ ] Scope complete; gates green; review notes resolved
- [ ] Run `/context-update 28`
- [ ] Commit on `feat/phase-28`; tag `v0.28.0` after merge
