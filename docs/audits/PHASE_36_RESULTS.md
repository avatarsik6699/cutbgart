# Phase 36 Background and Enhancements results

Captured on 2026-08-03. This file records implementation, target-device, phase-gate, and architect
product-review evidence. Machine-readable evidence is stored in
[`PHASE_36_REPORTS.json`](./PHASE_36_REPORTS.json); `pnpm profile:phase-36 -- --verify` validates
its schema, invariants, and measured/unsupported signal boundaries.

## Automated host evidence

- Domain/application/runtime matrices cover descriptor validation, one active draft, stale and
  duplicate terminals, atomic changed/no-op/failure outcomes, Undo/Redo descriptor restoration,
  seeded 64-step lease churn, custom-image boundaries and cleanup, worker correlation/transfer,
  structured OOM, deterministic Enhancement order and policies, one global FIFO heavy-job
  boundary, pinned model profiles, and distinct composite/foreground URL lifetimes.
- The zero-retry mocked Chromium lane passed Background preview/committed export/Cancel/Apply,
  custom-image validation, Enhancement changed/no-op/failure/retry/cancelled-stale outcomes,
  truthful ordered progress, document history, Russian UI, one unrequested Automatic run, and
  Reset cleanup. Three isolated scenarios passed in 7.5 seconds without arbitrary waits.
- The serialized Linux-host real-model lane passed one representative 1536 × 1024 Automatic run,
  one custom Background prepare/Apply, two sequential real fine-detail/colour-halo passes,
  responsive Grid/scroll controls during Enhancement, pinned ViTMatte requests, and Reset cleanup
  in 46.6 seconds.

## Windows target-device evidence

- Playwright MCP drove managed Chrome 150 on Windows 10 (`Win32`), 1038 × 734 CSS pixels,
  device-pixel ratio 1.21458, 16 logical cores, with WebGPU exposed. WSL-hosted files were copied
  temporarily into the MCP-approved Windows root and removed after capture.
- A representative Automatic result completed, then custom Background preparation and Apply
  produced revision 2. The end-to-end MCP observation was approximately 1.6 seconds and counted
  one preparation and one materialization.
- The first Enhancement pass observed real `enhancement-model-loading`,
  `enhancement-fine-detail`, and `enhancement-colour-halo` stages, two operation runs, and one
  atomic commit. Its rounded end-to-end MCP observation was approximately 64.7 seconds.
- During cold model loading, Grid changed from fine to wide and scroll reached approximately
  297 px while stage progress continued. No missed action was observed. The MCP click round trip
  includes transport and is deliberately not claimed as event-to-paint.
- A second warm Enhancement pass ran both operations and committed atomically; its rounded
  end-to-end MCP observation was approximately 18.7 seconds.
- Document Undo/Redo reached revision 6, committed PNG export downloaded, and the live state held
  11 artifacts, 28 leases, and 3 object URLs before Reset. Reset returned all counters to zero.
- A separate cached 1 × 1 Automatic result followed by one real Magic prediction verified the
  Automatic/Magic regression on the same Windows session; cancelling the draft and Reset again
  returned resources to zero.
- Console errors were limited to established localhost analytics CSP/CORS diagnostics. No
  Background, Enhancement, Magic, worker, model, artifact, or snapshot error was emitted.

## Unsupported or bounded signals

- Windows timing samples include MCP transport, locator work, and assertion latency. They are
  end-to-end observations, not isolated worker or event-to-paint measurements.
- PerformanceObserver started after the first Automatic run and reported no long tasks during the
  observed finishing session. This does not claim that an earlier Automatic long task was absent.
- The one-document UI serializes tool drafts and does not deliberately overlap Automatic, Magic,
  and Enhancement. The executable Automatic → Enhancement → Magic FIFO contract test is the
  global admission evidence.
- The host real-model test accepts a truthful no-op as well as a changed commit, so it does not
  claim a host Enhancement commit count. Windows produced two changed commits.

## Current outcome

Phase-36 implementation, deterministic browser coverage, serialized host real-model smoke,
versioned report verification, Windows target-browser evidence, and architect product acceptance
pass. The complete repository gate also passed on 2026-08-03: production build/container smoke,
type-check, lint, unit/architecture/full and Phase-36 E2E suites, dependency/license/model checks,
and SHA-pinned Trivy filesystem/image scans were green with no HIGH/CRITICAL finding.
