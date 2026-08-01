# Phase 17 runtime evidence

This host-only report contains runtime path, prompt/candidate lifecycle, classified failures,
timings, and pass/fail observations only. It never records images, filenames, prompt coordinates,
masks, or other image-derived data.

Run `pnpm e2e:phase-17-real` to refresh the available-host observation before Phase 17 closes.

## Current development host

- Date: 2026-07-16.
- Command: `pnpm e2e:phase-17-real`.
- Runtime path: headless Chromium, WASM.
- Lifecycle: one cached image embedding accepted cumulative positive/negative labels, exposed three
  scored alternatives, accepted two object layers, and continued into the exact mask-correction
  editor. Latest-revision rejection is covered at the worker-protocol/hook boundary and in the
  deterministic browser cancellation/re-entry flow.
- Result: **PASS** in 14.1 seconds on the available development host.
- Limitation: this available host does not establish WebGPU or physical-device behavior; Phase 17
  reuses Phase 16's WASM-only SlimSAM pin.
