# Phase 34 Manual Cutout and history results

Captured on 2026-08-03. The machine-readable evidence is
[`PHASE_34_REPORTS.json`](./PHASE_34_REPORTS.json); `pnpm profile:phase-34 -- --verify` validates
its schema, history limits, inference counts, action completion, and final resource counts.

## Automated host evidence

- The bilingual mocked Chromium lane passed Cancel, Apply, draft Undo/Redo, document Undo/Redo,
  export, keyboard routing, and Reset with no retries or arbitrary sleeps.
- A 22-commit churn scenario retained exactly 20 document operations, performed one automatic
  inference and 22 Manual commits, then reached 0 artifacts, 0 leases, and 0 object URLs after
  Reset.
- Unit and actor suites cover the independent 20-operation and 96-MiB pruning bounds, redo branch
  invalidation, stale revisions, retryable Apply, exact alpha output, dirty rectangles, pointer
  cancellation, transfer/correlation, and the prohibition on model input in the Manual worker.
- The serialized Linux-host real-model smoke completed automatic removal, one Manual Apply,
  document Undo/Redo, export, and Reset. RUN remained at one: Manual Apply, history navigation, and
  export did not invoke inference.

## Windows target-device evidence

- Playwright MCP drove managed Chrome 150 on Windows 10 (`Win32`), 1038 × 734 CSS pixels,
  device-pixel ratio 1.21458, 16 logical cores, with WebGPU available.
- The real model produced the automatic result. The canvas source decoded at its expected 1 × 1
  fixture size and exposed pixel `[76, 76, 76, 207]` before editing.
- Erase, draft Undo/Redo, Apply, document Undo/Redo, and Reset all completed with no missed
  action. The revision reached 4 after Apply → Undo → Redo.
- The live committed state held 5 artifacts, 9 leases, and 2 object URLs. Reset returned all three
  counters to zero.
- The temporary fixture copied into the Windows Playwright upload root was removed after capture.

## Caps and limitations

- The deterministic churn test is the executable evidence for the 20-operation cap. The pure
  history-policy suite supplies deterministic 96-MiB boundary coverage without allocating a
  96-MiB browser fixture.
- Precise brush/Apply/Undo/Redo event-to-paint timings were not captured. Playwright MCP observed
  successful visual completion and zero missed actions, but the report marks latency as
  `unsupported` with an empty sample array rather than presenting tool-call duration as browser
  paint latency.
- Export was verified in both the mocked and serialized real-model host lanes, but was not repeated
  during the Windows target capture; the target record therefore stores `null`, not a synthetic
  pass.
- Localhost still emits the pre-existing analytics CSP/CORS diagnostics. After changing source
  loading from `fetch(blob:)` to the image decode path, no Manual source-blob CSP error remained.

## Outcome

Phase-34 implementation evidence passes the scoped functional, inference-isolation, history-bound,
and cleanup requirements.

## I5 phase gate — 2026-08-03

Gate host: WSL2 Linux `6.6.87.2`, Node `24.13.0`, pnpm `11.10.0`, Docker `29.6.2`, and Docker
Compose `5.3.1`. Target-device browser details remain the Windows Chrome evidence above.

| Check | Result |
|-------|--------|
| Production container build, health, and HTTP smoke | PASS |
| Generated code, TypeScript, ESLint, and Steiger architecture lint | PASS; one pre-existing Fast Refresh warning, no lint errors |
| Full Vitest | PASS — 136 files, 537 tests |
| Full deterministic Playwright | PASS — 92 passed, 3 opt-in model-lab scenarios skipped |
| Existing serialized real-model smoke | PASS — 1/1 |
| Phase-34 mocked Chromium lane | PASS — 3/3 |
| Phase-34 serialized real-model/manual lane | PASS — 1/1 |
| Production build and versioned report verification | PASS |
| Dependency audit, licenses, and model manifest | PASS — 0 known vulnerabilities; 12 reviewed license expressions; manifest `v0.22.0` |
| Pinned Trivy filesystem and runtime-image scans | PASS — 0 HIGH/CRITICAL findings, secrets, or misconfigurations |
| Architect Review Notes and manual acceptance | PASS — no unresolved note |

The first full E2E attempt found port 3000 occupied by an ordinary project dev server, so the runner
could not start its required `--mode e2e` server and environment-dependent legacy tests failed. The
exact process tree was identified and stopped; the canonical zero-retry rerun passed. This was an
environment collision, not a product retry. The established `hreflang` casing diagnostic, large
bundle warnings, and Docker's public `VITE_CF_BEACON_TOKEN` secret-like heuristic remain
non-blocking known diagnostics.

Overall Phase-34 gate result: **PASS**.
