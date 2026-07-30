# PHASE 31 — Results

<!-- TOKEN BUDGET: keep this file under 10,000 tokens. Be concise. -->

Scope: `F6`. Captured 2026-07-30 on `feat/phase-31`, after implementing the approved `F7` fix and
the `F-04`/`F-13` test-suite corrections. Baseline scenarios/commands: `PHASE_31_BASELINE.md`.
Findings and decisions: `PHASE_31_FINDINGS.md`.

## What changed this phase (source, not docs)

1. **`F7` — empty/error/warning/loading state consistency** (`F-01`, `F-02`):
   - `src/widgets/tool-workspace/ui/ToolWorkspace.tsx`: `displayError` no longer includes
     upload-validation errors; a new `UploadErrorNotice` renders in place inside the idle/batch
     upload surface instead of a separate `[grid-area:error]` row.
   - `src/widgets/tool-workspace/model/use-tool-workspace-controller.ts`: `handleUploads` aborts the
     whole batch on any invalid file (no partial enqueue); new `handleDismissUploadError`.
2. **Test-suite reliability** (`F-04`, `F-13`):
   - `src/features/quality-mode-toggle/ui/QualityModeToggle.test.tsx`: fixed a stale copy assertion
     (deterministic failure, not flaky).
   - `e2e/home.spec.ts`, `e2e/processing-modes.spec.ts`, `e2e/scenario-pages.spec.ts`,
     `e2e/security-privacy.spec.ts`: fixed 9 stale assertions (Phase-30 copy/UX drift: removed
     badges, renamed radio label, replaced raster logo, "automatic-first" batch auto-select
     changing which download control is visible, `F7`'s own Reset→Try-again change).
3. **Doc corrections**: `docs/FRONTEND_CONVENTIONS.md` §9 worker-lifecycle count (6 → 7 hooks,
   `F-09`).
4. **`F2` — worker-lifecycle deduplication, part 1** (`F-09`, committed separately after the above):
   - New `src/shared/lib/use-worker-lifecycle.ts` (`useWorkerLifecycle`) + its own test suite.
   - `src/features/refine-foreground/model/use-foreground-refinement.ts` and
     `src/features/refine-matte/model/use-matte-refinement.ts` migrated to it; public API and all
     pre-existing tests unchanged.
5. **`F2` — worker-lifecycle deduplication, part 2** (`F-09`, same session):
   - New `src/shared/lib/use-pending-request-worker.ts` (`usePendingRequestWorker`) — a second,
     differently-shaped shared hook for the request-id/`Map`/`stopWorker` pattern shared by
     `use-model-lab.ts` and `use-interactive-matting-lab.ts` (not the cancel/dispose protocol
     `useWorkerLifecycle` covers).
   - Both hooks migrated; public API and pre-existing tests unchanged.
   - Self-caught bug fixed before committing (`F-14`): both new shared hooks initially returned an
     unmemoized object every render, silently defeating downstream `useCallback` memoization —
     wrapped both in `useMemo`.
   - 3 hooks remain unmigrated: `useBackgroundRemoval.ts`, `use-object-selection.ts` (1026 lines, 10
     `.terminate()` sites — the highest-risk one), `use-batch-processing.ts`.

## Before / after (`F2` extraction)

| | Before | After |
|---|---|---|
| `use-foreground-refinement.test.ts` | 4/4 pass | 4/4 pass (unmodified) |
| `use-matte-refinement.test.ts` | 5/5 pass | 5/5 pass (unmodified) |
| `use-worker-lifecycle.test.ts` | n/a (new) | 7/7 pass |
| `use-model-lab.test.ts` | 2/2 pass | 2/2 pass (unmodified) |
| `use-interactive-matting-lab.test.ts` | 1/1 pass | 1/1 pass (unmodified) |
| `e2e/foreground-refinement.spec.ts` + `e2e/matte-refinement.spec.ts` (4 browsers) | not rerun | 36/36 pass |
| `e2e/model-lab.spec.ts` (4 browsers) | not rerun | 4/4 pass (3/4 gated behind `VITE_ENABLE_MODEL_LAB` per browser, as before) |
| `pnpm vitest run` | 368/368 | 375/375 |

## Before / after

### Unit tests (`pnpm vitest run`)

| | Before | After |
|---|---|---|
| Test files | 86 (1 failing) | 86 (0 failing) |
| Tests | 368 (1 failing, `QualityModeToggle.test.tsx`) | 368 (all passing) |

Reran the previously-failing file 3× before the fix (3/3 fail) and 3× after (3/3 pass) — see `F-04`.

### E2E (`pnpm e2e --project=chromium`)

| | Before (this branch, pre-fix) | After |
|---|---|---|
| Failing specs | 9 (`ci-critical`, `home`×2, `processing-modes`×4, `scenario-pages`, `security-privacy`×2) | 0 |
| Passed | 68 | 77 |
| Skipped | 3 | 3 |

All 9 pre-existing failures were confirmed present on `main` at `3bb3659` before any of this
session's `src/` changes (stashed diff, reran, identical failures) — none were regressions
introduced by `F7`. One (`security-privacy.spec.ts`'s "rejects malformed..." test) needed a genuine
assertion update because `F7` intentionally changed the upload-error dismiss control from a shared
"Reset" button to an in-place "Try again" retry — expected, not a regression.

### Cross-browser (`pnpm e2e`, all 4 projects: chromium, firefox, webkit, Mobile Safari)

Run 1 (after `F2` parts 1–2 and `F-16`/T3, before `F-17`/`F3`):

| Project | Passed | Failed | Skipped |
|---|---|---|---|
| chromium | 77 | 0 | 3 |
| firefox | 76 | 0 | 4 |
| webkit | 76 | 0 | 4 |
| Mobile Safari (full-suite run) | 74 | 2 | 4 |
| Mobile Safari (rerun alone, per `F-05`) | 76 | 0 | 4 |

`chromium`/`firefox`/`webkit` were fully green. `Mobile Safari`'s 2 failures in the full-suite run
(one `page.goto` "Page crashed", one downstream element-not-found) were the documented contention
flake (`F-05`) — confirmed by rerunning `Mobile Safari` alone immediately afterward: 76/76 passed.

Final run (after `F-17`/`F3`, the `MaskCorrectionCanvas.tsx` fix — the last source change this
phase): `chromium` 77/77, `firefox` 76/76, `webkit` 76/76, all 0 failed. A first attempt at this
final run showed 71 firefox failures — traced immediately to this session's own process hygiene
(a `pkill -f "vite dev"` aimed at a separately-started manual dev server also killed the e2e run's
server mid-suite, `NS_ERROR_CONNECTION_REFUSED` on every subsequent test) — not a real regression;
confirmed by an immediate clean rerun. `Mobile Safari` was interrupted partway through this final
run at the architect's explicit direction (11/80 passed, 0 failures observed before stopping) —
accepted given it's the already-documented secondary/contention-prone browser and the other three
browsers are fully clean both before and after `F-17`.

Also manually spot-checked live in a browser via Playwright MCP (not just automated): uploaded an
invalid-format file — error appeared in place inside the upload surface with a working "Try again"
that dismissed it without disturbing the upload controls (`F7`); then uploaded a real image through
the real (non-mocked) inference pipeline on this dev server — automatic Cutout completed and the
editor rendered correctly end-to-end.

## Chunk sizes (`T2`, single data point — see `PHASE_31_T2_MEASUREMENTS.md`)

No regression from `F7`: `UploadErrorNotice`/`handleDismissUploadError` are small in-file additions
to already-loaded `tool-workspace-*.js`; no new route, no new lazy chunk, no new dependency. `F2`
(two new `shared/lib` hooks) and `F-17` (ref-forwarding in an existing file) are similarly small,
in-place additions with no new chunks. Not re-measured byte-for-byte — each change is too small
relative to the 227 KB `tool-workspace` chunk to be a meaningful signal without a dedicated
bundle-diff tool (still named in `F-08` as unbuilt tooling).

## Findings not acted on this phase

See `PHASE_31_FINDINGS.md` for the full ledger — updated through `F-17`. What remains `defer`/
`reject`-without-action, and why:
- **`F2` (worker-lifecycle), 3 of 7 hooks**: `useBackgroundRemoval.ts`, `use-batch-processing.ts`,
  `use-object-selection.ts` — each read in full and confirmed to have a genuinely different
  lifecycle shape from the two patterns already extracted (`F-09`'s final entry). Not a time
  shortfall; a deliberate `reject` against forcing a third/fourth abstraction onto one call site
  each.
- **`F-10`, canvas pointer math**: rejected outright — the two implementations compute different
  quantities (scale factor vs. normalized position), not the same logic twice.
- **`F-08`, remaining `T2` scope**: real-model timing (needs WebGPU-capable hardware this dev
  machine doesn't have) and React commit/duration profiling (needs a `Profiler`-instrumented build
  not built this pass, deprioritized given clean heap/long-task/effect-audit results elsewhere).
- **`F-16`, `onnxruntime-web` dependency**: real candidate, deliberately not removed — package-churn
  risk on a security-pinned dependency without real-hardware verification is exactly what this
  phase's rules forbid taking casually; flagged for whoever owns the Phase 22 security gate.
