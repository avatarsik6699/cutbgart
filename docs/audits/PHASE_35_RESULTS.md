# Phase 35 Magic Cutout results

Captured on 2026-08-03. Architect product review and `/phase-gate 35` passed; this file records the
accepted implementation, target-device, and gate evidence.
Machine-readable evidence is stored in [`PHASE_35_REPORTS.json`](./PHASE_35_REPORTS.json), and
`pnpm profile:phase-35 -- --verify` validates its schema, invariants, and measured/unsupported
signal boundaries.

## Automated host evidence

- Focused v2/domain/application/runtime/presentation suites cover Magic legal and stale
  transitions, cancellation, retry retention, bounded strokes/points/history, semantic Keep/Remove
  fusion, deterministic ranking, preview leases, transfer/correlation, worker crash recovery,
  shared automatic/Magic admission, one-commit Apply, and deterministic 100-document ownership
  churn.
- The zero-retry mocked Chromium lane passed source-space strokes, local keyboard Undo/Redo,
  Predict without commit, refinement invalidating the previous candidate, warm re-predict, explicit
  candidate selection and Apply, document Undo/Redo, export, dirty-Cancel confirmation, Russian UI,
  and Reset cleanup. Counts were one automatic run, two requested Magic predictions, and one Magic
  commit.
- The serialized Linux-host real-model smoke passed one automatic run, two real SlimSAM predictions
  in one draft (cold worker session then warm re-predict), one non-inference snapshot commit, and
  Reset cleanup in 31.2 seconds after the final architecture-review fixes.
- The Phase-34 mocked Chromium regression remained green after Manual and Magic began sharing the
  versioned snapshot materialization worker: 3/3 tests passed.

## Windows target-device evidence

- Playwright MCP drove managed Chrome 150 on Windows 10 (`Win32`), 1038 × 734 CSS pixels,
  device-pixel ratio 1.21458, 16 logical cores, with WebGPU exposed.
- The real automatic result completed before Magic opened. A source-space Keep stroke completed in
  27 ms and enabled Predict.
- During real Magic encoding, an unrelated Grid toggle plus page scroll completed in 27 ms and the
  page reached `scrollY ≈ 300`; no missed action was observed.
- The first fresh-worker prediction reached candidates in approximately 10 seconds. Asset cache
  provenance was not observable, so this is a cold worker/model-session sample, not a claimed cold
  network download measurement.
- Adding a Remove refinement immediately removed the stale candidate without inference. Warm
  re-predict completed in 347 ms. The PerformanceObserver captured one 55 ms long task across the
  observed Magic session.
- Candidate selection and Apply completed in 34 ms. Apply → document Undo → Redo reached revision 4.
  The live committed state held 5 artifacts, 11 leases, and 2 object URLs; Reset returned all three
  counters to zero.
- Browser console errors were limited to the established localhost analytics CSP/CORS diagnostics;
  no Magic, worker, model, artifact, or canvas error was emitted.
- The temporary Windows upload fixture was removed and the WSL dev server was stopped after capture.

## Unsupported or bounded signals

- Separate event-to-paint timing samples for model-loading and decoder prediction were not captured;
  those stages completed between MCP observations. They remain `unsupported`, not inferred from
  tool-call duration.
- The Windows sample observed responsiveness during encoding and warm decoder completion, but did
  not force overlapping automatic and Magic requests. The executable coordinator contract test is
  the evidence for global FIFO one-heavy-job admission and queued cancellation.
- The 1 × 1 smoke fixture validates protocol/lifecycle behavior, not segmentation quality or large-
  image memory pressure. Representative-image quality remains bounded by the architect's accepted
  manual review rather than claimed from this fixture.

## Current outcome

Phase 35 passed the complete repository gate, its Phase-35-specific mocked and real SlimSAM lanes,
container build/smoke, dependency/license/model checks, Trivy filesystem/image scans, Windows
target-browser review, and unresolved-review-note check. The limitations above remain explicit.
