# Phase 16 device matrix

This host-only evidence log contains no filenames, source pixels, result pixels, or other
image-derived data. Run `pnpm e2e:phase-16-real` serially on each representative device and record
the emitted capability/lifecycle summary here.

Phase 16 closes locally without deployment on the available development-host smoke below. The
pending representative rows are retained as explicit non-evidence and are owned by Phase 20's
consolidated pre-deploy acceptance for the Phases 16–19 interactive pipeline (SPEC.md v1.9 §7.4).

| Device class | Browser/path | Switching + warm reuse | Heavy disposal | BEN2 | Fallback | SlimSAM point/box | Result |
|---|---|---|---|---|---|---|---|
| Weak device | Real Safari/Chromium, WASM/no WebGPU | Pending representative hardware | Pending | Expected guarded fallback | Pending | Pending light-on-light + ambiguous samples | Pending |
| Powerful device | Real Chromium, WebGPU + shader-f16 | Pending representative hardware | Pending | Pending fp16 run | Pending forced OOM/WebGPU failure | Pending light-on-light + ambiguous samples | Pending |

## Current development host

- Date: 2026-07-13
- Command: `pnpm e2e:phase-16-real`
- Capability: headless Chromium 149 reported no WebGPU adapter (`webgpu: false`, `fp16: false`).
- Result: **PASS (weak/WASM development-host evidence)** — BEN2 was guarded and fell back once to
  IS-Net q8; SlimSAM q8 encoded once and accepted both positive-point and normalized-box prompts;
  the real response produced the visible prompt marker and mask overlay; all model requests used
  the pinned Hugging Face upstream fallback on this unconfigured dev build.
- Latest runtime after caches were warm: 28.2 seconds for the serialized combined check.
- Limitation: this sample/host does not establish BEN2 WebGPU execution, physical weak-device
  behavior, heavy WebGPU disposal, or the required light-on-light and ambiguous-background image
  quality matrix. The representative weak and powerful physical-device rows remain pending.
