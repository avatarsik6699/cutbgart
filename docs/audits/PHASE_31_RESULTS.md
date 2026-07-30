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

| Project | Passed | Failed | Skipped |
|---|---|---|---|
| chromium | 77 | 0 | 3 |
| firefox | 76 | 0 | 4 |
| webkit | 76 | 0 | 4 |
| Mobile Safari (full-suite run) | 74 | 2 | 4 |
| Mobile Safari (rerun alone, per `F-05`) | 76 | 0 | 4 |

`chromium`/`firefox`/`webkit` are fully green. `Mobile Safari`'s 2 failures in the full-suite run
(one `page.goto` "Page crashed", one downstream element-not-found) were the documented contention
flake (`F-05`, `PHASE_31_FINDINGS.md`) — confirmed by rerunning `Mobile Safari` alone immediately
afterward: 76/76 passed, 0 failed. **All 4 browser projects are green** as of this phase's close;
no real regression from any change made this session.

## Chunk sizes (`T2`, single data point — see `PHASE_31_T2_MEASUREMENTS.md`)

No regression: `F7`'s changes (`UploadErrorNotice`, `handleDismissUploadError`) are small in-file
additions to already-loaded `tool-workspace-*.js`; no new route, no new lazy chunk, no new
dependency. Not re-measured byte-for-byte after `F7` since the change is too small relative to the
227 KB chunk to be a meaningful signal without a dedicated bundle-diff tool (out of this pass's
scope per `F-08`).

## Findings not acted on this phase

See `PHASE_31_FINDINGS.md` for the full ledger. Everything with a `defer` decision (`F2`–`F5`'s
god-hook/duplication decompositions, and `F-08`'s remaining `T2` interaction/heap tooling) needs
either characterization tests per call site or new profiling tooling that doesn't exist yet — both
are real, separately-scoped deliverables per this phase's own no-blanket-rewrite/no-unverifiable-
performance-claim rules, not something safely rushed inside this pass.
