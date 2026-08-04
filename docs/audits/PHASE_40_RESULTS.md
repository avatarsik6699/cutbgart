# Phase 40 v1-faithful batch workspace results

Date: 2026-08-04

## Implemented boundary

- `/editor-v2` and `/en/editor-v2` now expose the established v1 batch workspace over the
  Phase-37 runtime: ordered admission up to 20 files, truthful preparing/model-loading/processing/
  queued/result/error states, counters, horizontal rail, selection, and Add images.
- `BatchMainPageProjection` is immutable and bounded. `BatchMainPageIntent` is the sole action
  boundary; presentation owns no files, actors, workers, controllers, correlations, or workflow
  state.
- Selection, retry, remove, individual PNG, guarded clear, ZIP start/cancel, and quality capture
  delegate to `EditorSession`. Completed selection and export do not trigger inference.
- The v1 and v2 routes share controller-neutral batch rail/status components. The legacy feature
  remains a thin adapter, avoiding two independently styled implementations.
- Public `/` and `/en`, scenario bindings, SEO/indexing, analytics, model assets, and editor-tool
  presentation were not changed. Deferred editor-tool UI remains the only accepted visual
  difference below the shared batch toolbar.

## Architecture review

- Workspace/runtime ownership remains below the projection/intent seam; runtime-owned preview URLs
  are exposed only as transient handles.
- `WorkspaceItemStatus` adds a distinct `model-loading` projection so the UI does not mislabel model
  preparation as inference work.
- Memoized batch presentation uses structural projection equality and stable callbacks; unchanged
  tool drafts do not churn the rail. Branded identifiers are recovered from the typed projection at
  the neutral shared-component boundary instead of being cast from arbitrary strings.
- Import preparation remains bounded at two jobs and heavy processing remains FIFO at one job.
  Capacity rejection is explicit and additive; per-item failure does not poison siblings.
- Resource cleanup is exercised after invalid admission, removal, retry, clear, and dispose. A
  discovered reset defect was fixed: a failed/preparing item without a document ID is now removed,
  so the next valid single-file admission cannot inherit a phantom batch item.

## Visual and behavioral evidence

- Sixteen bilingual desktop (`1440×1000`) and narrow (`390×844`) snapshots freeze v1 and v2 batch
  processing/selection states. Product UI is not masked and no pixel-difference allowance is used.
  The v1 in-progress elapsed clock is paused through Playwright's clock API before admission so the
  reference remains exact rather than weakening comparison tolerance.
- Manual inspection confirmed matching batch hierarchy, rail/card geometry, counters, status
  treatment, selection, toolbar placement, and responsive overflow. The v2 status remains
  semantically more precise where the legacy page says preparation while runtime is processing.
- Phase-40 deterministic Chromium: 13/13 PASS with zero retries.
- Phase-37–40 deterministic regression set: 26/26 PASS.
- Phase-40 serialized real-model Chromium: 1/1 PASS in 25.9 s, covering two FIFO runs, responsive
  selection, selected PNG, ZIP, and no additional inference.
- Focused projection/presentation/page/session tests: 15/15 PASS; TypeScript, lint, and architecture
  lint PASS. Lint retains only the pre-existing Fast Refresh warning in `shared/ui/button.tsx`.

## Gate result

The first full gate exposed two narrow issues: a presentation-level native image element bypassed
the v2 Image adapter, and the Phase-38 matrix could drive a mock stage before slow parallel image
preparation had started its run. Both were recorded as review notes, fixed at their owning
boundaries, and verified before the complete gate rerun.

The complete `/phase-gate 40` rerun passed:

- Docker production build/start — PASS; `app` healthy.
- `pnpm generate:code` and `pnpm tsc --noEmit` — PASS.
- `pnpm vitest run` — 176 files, 670 tests PASS.
- `pnpm e2e:full` — deterministic Chromium 123 PASS / 3 intentional skips, followed by legacy
  real-model smoke 1/1 PASS.
- container-network smoke — PASS.
- `pnpm lint` — PASS with only the pre-existing Fast Refresh warning in
  `shared/ui/button.tsx`; `pnpm exec steiger ./src` — PASS.
- Phase-40 deterministic Chromium — 13/13 PASS; serialized Phase-40 real-model Chromium — 1/1 PASS
  in 25.4 s.
- Architect review notes — 0 unchecked.

Overall `/phase-gate 40`: **PASS**.

## Remaining work

- Migrate the Manual/Magic, Background, and Enhancements visual workspace to the v1 presentation.
- Run managed-Windows complete-product acceptance at the later cutover gate.
- Authorize public route cutover and legacy removal only in a separate approved phase.
