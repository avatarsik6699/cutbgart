# Phase 33 Editor v2 results

Captured on 2026-08-02 from the production build. These results are the final I4 performance and
resource-lifetime evidence for the isolated Editor v2 route; they do not claim that the legacy
editor is fixed.

## Target and method

- Browser automation: Playwright MCP `0.0.78`, using its managed, isolated Windows Chrome rather
  than attaching to a personal browser with `connectOverCDP`.
- Browser: Chrome `150.0.0.0`, Windows `Win32`, 900 × 500 CSS-pixel viewport.
- GPU: AMD Radeon 780M Graphics through ANGLE/D3D11. WebGPU adapter creation succeeded with
  `shader-f16`; `maxStorageBuffersPerShaderStage` was 16.
- App: production output at `http://localhost:4176/en/editor-v2`.
- Input: `public/og-image.png`, copied byte-for-byte to the Windows MCP fixture directory; SHA-256
  `f73a1d52083b3b4a44ffe41613597247c025b91d38d2d010f0f94612c2359906`.
- Reports: [`PHASE_33_REPORTS.json`](./PHASE_33_REPORTS.json), three
  `phase-33.performance.v1` records covering the deterministic fake lane and cold/warm real-model
  target runs. `pnpm profile:phase-33` validates their shape and recalculates every budget.
- Trace: `test-results/phase-33-target-trace.zip` (ignored local artifact; Windows source copy remains
  at `C:\Users\user\AppData\Local\cutbg-tools\phase-33-target-trace.zip`), 8.7 MiB, SHA-256
  `95004904cbbd4c60e569019fae91e6f3edaebc9f2de96f5d594e2ab799f78dc3`.

The target browser was driven through its normal Playwright connection. No user profile, remote
debugging port, `connectOverCDP`, or home browser participated in the final capture.

## Budget results

| Signal | Budget | Cold real model | Warm real model | Outcome |
|--------|--------|----------------:|----------------:|---------|
| Application-attributable Long Tasks | no task `>=50 ms` | 0 | 0 | PASS |
| Interaction event → two paints p95 | `<100 ms` | 60.6 ms (8 samples) | 27.7 ms (6 samples) | PASS |
| Missed scroll/control actions | 0 | 0 | 0 | PASS |
| Final artifacts after reset | 0 | 0 | 0 | PASS |
| Final leases after reset | 0 | 0 | 0 | PASS |
| Preview/export reinference | none | RUN stayed at 1 | RUN stayed at 2 total | PASS |

Cold worker stages were model load 5,627.8 ms and inference 25,321.2 ms. The warm worker retained
the model (model load 0 ms) and inference took 24,362.9 ms. Both runs produced the expected
`og-image-no-background.png`; each result exposed 3 artifacts, 5 leases, and 2 object URLs while
live, then returned to 0/0/0 after Start over.

The trace contains an extra five-minute idle interval after the cold worker had already emitted
`SUCCEEDED`: the first harness pass waited for the wrong image accessible name. Worker timings,
interaction samples, export checks, and resource readings were recovered from the still-live page;
the incorrect wait is excluded from the report and was not repeated for the warm run.

## Ten-cycle artifact audit

Each cycle performed import → Cancel → wait for the worker `CANCELLED` acknowledgement → verify
Retry → Start over → read the repository-backed counters. All ten cycles observed exactly one new
RUN and one new `CANCELLED`; every post-reset sample was artifacts 0, leases 0, object URLs 0.

| Cycle | ACK/reset duration | Post-reset artifacts / leases / URLs |
|------:|-------------------:|-------------------------------------:|
| 1 | 22,694 ms | 0 / 0 / 0 |
| 2 | 20,645 ms | 0 / 0 / 0 |
| 3 | 21,836 ms | 0 / 0 / 0 |
| 4 | 23,695 ms | 0 / 0 / 0 |
| 5 | 23,882 ms | 0 / 0 / 0 |
| 6 | 24,209 ms | 0 / 0 / 0 |
| 7 | 24,130 ms | 0 / 0 / 0 |
| 8 | 23,917 ms | 0 / 0 / 0 |
| 9 | 23,468 ms | 0 / 0 / 0 |
| 10 | 23,424 ms | 0 / 0 / 0 |

Cancellation is truthful but cooperative: the active WebGPU inference cannot be preempted, so the
worker acknowledges cancellation only after that invocation returns. The UI remained responsive
and no stale result committed, but cancellation latency is a recorded residual UX risk.

## Support and limitations

- Long Task observation is supported and reported as an observed empty list, not an assumed zero.
- Interaction values are controlled event-to-two-animation-frame probes, distinct from Event Timing
  API duration.
- Page-realm Resource Timing cannot see the model fetch performed in the worker. The real reports
  therefore mark `resources` as `unsupported` and keep the sample array empty; they do not present
  an unobservable metric as zero. Artifact/lease/object-URL bounds come from the application
  repository counters exposed on the production route.
- The 14 target interaction samples prove this acceptance run but are not field telemetry. Manual
  architect verification remains required before migration.
- Two analytics requests fail under localhost CSP/CORS. They are unrelated to the local editor,
  model, worker, or measured interaction path.

## Outcome

I4 passes for Editor v2 on the original Windows/Radeon target class. The previously reproduced
legacy freeze was not reproduced: all 14 actions painted, p95 remained below 100 ms, and no
application Long Task reached 50 ms. This evidence clears the automated migration blocker while
leaving architect manual verification outstanding.

## I5 phase gate — 2026-08-03

Gate host: WSL2 Linux `6.6.87.2`, Node `24.13.0`, pnpm `11.10.0`, Docker `29.6.2`, and Docker
Compose `5.3.1`. Target-device browser/GPU details remain the Windows Chrome/Radeon evidence above.

| Check | Result |
|-------|--------|
| Production container build, health, and HTTP smoke | PASS |
| TypeScript, ESLint, Steiger architecture lint | PASS; one pre-existing legacy Fast Refresh warning, no lint errors |
| Vitest | PASS — 132 files, 524 tests |
| Full deterministic Playwright | PASS — 89 passed, 3 opt-in model-lab scenarios skipped |
| Existing real-model smoke | PASS — 1/1 |
| Phase-33 mocked Chromium lane, one worker | PASS — 2/2 |
| Phase-33 serialized real-model lane | PASS — 1/1 |
| Production build | PASS |
| Versioned performance report verification | PASS — 3 reports |
| Production dependency audit and license policy | PASS — no known vulnerabilities; 12 reviewed license expressions |
| Model manifest validation | PASS — manifest `v0.22.0` |
| Pinned Trivy filesystem scan | PASS — 0 HIGH/CRITICAL vulnerabilities, secrets, or misconfigurations |
| Pinned Trivy runtime-image scan | PASS — 0 HIGH/CRITICAL vulnerabilities |
| Architect Review Notes | PASS — 0 unchecked notes |

Non-blocking diagnostics retained from the gate: the legacy root shell emits React's existing
`hreflang` casing warning during E2E, production builds retain the established large worker/chunk
warning, and Docker heuristics flag the public `VITE_CF_BEACON_TOKEN` build argument as secret-like.
`docs/STACK.md` explicitly classifies that analytics value as a public browser identifier. None of
these diagnostics altered the Phase-33 editor result, security scan outcome, or acceptance budgets.
