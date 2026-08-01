# Phase 19 runtime evidence

This host-only report contains runtime paths, model variants, classified fallbacks, timings, hard-
constraint observations, and pass/fail results only. It never records images, filenames, mattes,
trimaps, constraints, crop coordinates, or other image-derived data.

Run `pnpm e2e:phase-19-real` to refresh the available-host observation before Phase 19 closes.

## Current development host

- Date: 2026-07-22.
- Command: `pnpm e2e:phase-19-real`.
- Runtime path: headless Chromium, WASM. WebGPU was unavailable on this host.
- Balanced (`q8`): cold `4931 ms`; warm `171 ms`; requested/actual path `WASM/WASM`; fallback
  `none`.
- Maximum (`fp32`): cold `16050 ms`; warm `170 ms`; requested/actual path `WASM/WASM`; fallback
  `none`.
- Graph selection: only the selected q8 graph was requested for balanced runs and only the selected
  fp32 graph for maximum runs, both at revision
  `358d428c452e5e0cd52955011a8b51944731d28e`.
- Lifecycle: the automatic pipeline acknowledged disposal before ViTMatte started; the selected
  ViTMatte variant was reused warm and replaced serially on the mode switch.
- Constraint result: the injected hard foreground constraint remained `255` in all four results.
- Peak memory: `unavailable`; no value was inferred.
- Result: **PASS** in `42.9 seconds` on the available development host.
- Limitation: this run establishes the actual WASM path only; it does not claim WebGPU or physical-
  device performance.
