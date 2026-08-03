# Phase 33 legacy target-device baseline

Captured on 2026-08-01 before the Editor v2 performance subsystem was implemented. This is a
diagnostic comparison baseline for the legacy single-image editor, not a Phase-33 budget pass.

## Target and method

- Browser: Chrome `150.0.7871.187`, normal Windows profile launched only for Phase 33; CDP attached
  from the repository host. `navigator.webdriver` was `false`.
- OS/device: Windows 10 (`Win32`), 16 logical processors, 32 GiB reported device memory.
- GPU: AMD Radeon 780M Graphics through ANGLE/D3D11. WebGPU adapter creation succeeded with
  `shader-f16` and `timestamp-query`; the application readout reported `on-device · webgpu` for
  both measured runs.
- Viewport: 789 × 758 CSS px at device-pixel ratio 1.2146.
- Input: repository asset `public/og-image.png`, 1536 × 1024, 1,202,308 bytes.
- Build: production output served from `http://localhost:4176/en/`.
- Collector: `scripts/profiling/v2/capture-legacy-target.ts`, diagnostic output schema
  `phase-33.legacy-baseline.v1`. It connects to the existing target Chrome, clears only its temporary
  browser/cache-storage profile before the cold run, drives the legacy UI, and records browser
  event-to-two-animation-frame latency, stage visibility, Long Task entries, CDP resource/runtime
  metrics, runtime path, artifact counters, and cancellation.

The raw report for this capture was written to `/tmp/phase-33-legacy-target.json`. The durable
values and limitations needed for the phase contract are recorded below; R4 owns the reusable,
repository-versioned `phase-33.performance.v1` report implementation.

## Results

| Signal | Cold | Warm |
|---|---:|---:|
| Import event → next paint | 9.8 ms | 8.1 ms |
| Model stage | 16,389.3 ms | 1,425.8 ms |
| Removal/inference stage | 10,457.2 ms | 7,640.8 ms |
| End-to-end completion | 27,158.5 ms | 9,316.8 ms |
| Scroll response during model stage | 6.2 ms | 7.2 ms |
| Control response during model stage | 24.0 ms | 14.9 ms |
| Scroll response during removal | 6.7 ms | 34.2 ms |
| Control response during removal | 14.1 ms | 73.9 ms |
| Result artifact count | 2 | 2 |
| Long tasks ≥ 50 ms | 0 | 0 |

The ten collected import/scroll/control samples had an observed p95 of 73.9 ms. This tiny sample is
useful for localization only and is not statistically sufficient for the final I4 percentile
claim.

Reset removed the active document and its exposed artifact counter after each completed run. A
cancel issued after the removal stage became visible returned to the upload surface in 44.7 ms;
the active document/artifact counter was no longer reachable afterward. The legacy worker protocol
could not be observed reliably from the attached production realm, so this capture does not claim
that an explicit `dispose` message or worker termination occurred. Phase-33 v2 contract tests and
repository statistics must prove those stronger lifetime guarantees.

## Reproduced symptom and interpretation

The architect manually scrolled the foreground target tab while observing the run. The browser was
responsive during import/model preparation, then visibly froze and lagged once the UI showed
`Removing background…`. The automated samples independently locate the worst response in the same
removal stage, especially in the warm run (34.2 ms scroll, 73.9 ms unrelated control).

`PerformanceObserver` supports `longtask` in this browser but reported no main-thread entry at or
above 50 ms. That zero does **not** refute the reproduced freeze: inference runs through a worker and
WebGPU, and GPU/renderer/process contention is not represented as a page main-thread Long Task.
Phase 33 must therefore retain direct event/paint response, missed-action checks, stage timing,
resource/artifact bounds, GPU-path reporting, and human-visible target confirmation instead of
using Long Task count as a proxy for responsiveness.

## Limitations carried into R4/I4

- CDP metrics are Chromium-only and are not cross-browser truth.
- Event-to-next-paint uses the captured browser event followed by two animation frames; it must be
  reported distinctly from Event Timing API duration.
- Single probes can miss frame pacing and intermittent GPU contention. I4 requires repeated samples,
  p95 evaluation, missed-action accounting, and ten import/cancel/reset cycles.
- The production service worker/cache path did not expose model responses through the collector's
  narrow legacy URL filter. R4 needs a resource probe that reports unsupported/unobserved data
  explicitly instead of turning it into a zero.
- Artifact counters are exposed only while a legacy result document is active; absence after reset
  means the document is unreachable, not an independently proven zero internal lease count.

## Outcome

`T2` is satisfied as a target-device legacy baseline. The freeze was reproduced and localized to
removal/inference, so migration remains blocked until the v2 target report passes the I4 budgets.
