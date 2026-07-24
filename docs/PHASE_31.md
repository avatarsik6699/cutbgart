# PHASE 31 — Batch Workflow Consolidation & UX Hardening

## Phase Metadata

| Field | Value |
|-------|-------|
| Phase | `31` |
| Title | Batch Workflow Consolidation & UX Hardening |
| Status | `⏳ pending` |
| Tag | `v0.31.0` |
| Depends on | PHASE_30 gate passing |

---

## Phase Goal

Consolidate and stress-test the single/selected-batch contract already delivered incrementally in
Phases 26–30, then remove superseded public controls and harden the complete redesigned workflow.
This is not a delayed batch-parity phase: any missing Phase-26–30 batch capability is a regression
to fix, not accepted scope deferral. It is the consolidation gate for the focused background
product—not authorization for Studio features (SPEC.md §2.2, §5.2–§5.4, §7.1–§7.7, §8–§9).

---

## Scope

### Frontend

- [ ] `F1` Audit and normalize the Phase-26 per-item ownership contract: each successful
  `BatchItem` has one independent `EditDocument`, artifact-store scope, committed history, active
  tool, and draft; queued/model-loading/error items retain lightweight status only. Remove any
  remaining duplicate or late-adoption adapter — _Depends on:_ —
- [ ] `F2` Verify the Phase-27–30 shared stage/toolbar/panel for the selected completed item has full
  Cutout Magic/Manual, Enhancements, Background, undo/redo, and sized individual PNG behavior —
  _Depends on:_ `F1`
- [ ] `F3` Preserve per-item tool/draft/history/zoom state on safe selection changes. If the current
  item has a dirty draft, require Apply/Discard/Stay; never silently apply, discard, or transfer it
  to another item — _Depends on:_ `F1`, `F2`
- [ ] `F4` Keep batch processing concurrency/error isolation and heavy-stage serialization from
  Phases 10/16/19. Stale async results from an unselected/removed item cannot update another
  document or global toolbar — _Depends on:_ `F1`–`F3`
- [ ] `F5` Keep Download all as client-side ZIP of each item's committed PNG. Preserve existing
  original-size behavior for bulk export in this phase; individual size settings do not silently
  change other items or the ZIP — _Depends on:_ `F2`
- [ ] `F6` On item removal/clear/reset, release its current/baseline/history artifacts, uploaded
  background blobs, object URLs, drafts, and workers without disturbing other items — _Depends
  on:_ `F1`–`F5`
- [ ] `F7` Remove superseded public UI/copy: initial Guided path; separate Edit mask/Refine
  selection buttons; candidate/Current result/Continue controls; technical matting/cleanup cards;
  duplicate rail Download/Background controls; prompt/model/runtime/quota explanations. Retain
  internal model-lab diagnostics and legacy source required by active protocols — _Depends on:_
  `F2`
- [ ] `F8` Audit `ToolWorkspace` after migration: no duplicated single/batch state machine, no
  same-layer feature imports, no unbounded artifact/stroke retention, no full changing image
  buffers in React state/props, and no broad god-component regression. Delete only proven-dead
  adapters after callsite/test verification — _Depends on:_ `F1`–`F7`
- [ ] `F9` Complete bilingual/responsive/accessibility polish: stable stage/panel geometry, toolbar
  overflow/navigation, touch targets, focus restoration, dirty-draft dialogs, screen-reader
  statuses, reduced motion, mobile camera/upload, and icon tooltips — _Depends on:_ `F2`–`F8`
- [ ] `F10` Add focused tests for per-item isolation, selection guards, stale work, cleanup, ZIP
  committed output, retained internal diagnostics, removed public copy/callsites, architecture
  boundaries, and memory/history budgets under many-item churn — _Depends on:_ `F1`–`F9`
- [ ] `F11` Rewrite/extend deterministic Playwright flows across configured browsers/locales for
  single and batch journeys: upload/automatic result, every tool, draft guards, per-item history,
  individual export, ZIP, reset/new upload, errors/fallbacks, keyboard/touch behavior, stage layout
  stability, and absence of superseded primary UI — _Depends on:_ `F10`

### Infra

- [ ] `I1` Run the complete existing real-model evidence chain applicable to automatic removal,
  Magic, Enhancements, foreground cleanup, and downloads on the available host. Add no new model/package,
  route, API, env var, analytics payload, persistence, Docker/CI Playwright, or Studio bundle —
  _Depends on:_ `F11`

---

## Files

### Create / modify

~~~
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
src/app/styles/globals.css
messages/ru.json
messages/en.json
e2e/home.spec.ts
e2e/brush-guided-correction.spec.ts
e2e/mask-correction.spec.ts
e2e/hybrid-pipeline.spec.ts
e2e/foreground-refinement.spec.ts
e2e/scenario-pages.spec.ts
e2e/support/mock-inference.ts
docs/PHASE_31.md
~~~

### Do NOT touch

- Add batch-wide editing/templates, bulk size conversion, cloud history, accounts, storage, API
- Delete model-lab/internal runtime evidence or legacy protocol code still imported/tested
- Change model pins/quality algorithms without new evidence and an explicit spec change
- Add layers, transforms, shadows, perspective, text, templates, or any Studio route/bundle

---

## Contracts

### New persistent data (tables / collections / files)

None. Every batch document/history remains browser-tab memory only and is released with its item.

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

Run `/phase-gate 31` with the complete `docs/STACK.md` gate. Also:

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

Fail if single/batch editors diverge, item state/history leaks, dirty work is silently lost,
stale work crosses items, ZIP captures drafts, cleanup leaks resources, removed primary controls
remain, internal diagnostics are accidentally deleted, or Studio scope enters the focused bundle.

---

## Architect Review Notes

- [x] No architect review issues recorded

## Implementation Notes

None

## Atomic Commit Message

```text
refactor(phase-31): consolidate batch workflow and legacy UX
```

## Post-Phase Checklist

- [ ] Scope complete; full gates green; review notes resolved
- [ ] Run `/context-update 31`
- [ ] Commit on `feat/phase-31`; tag `v0.31.0` after merge
