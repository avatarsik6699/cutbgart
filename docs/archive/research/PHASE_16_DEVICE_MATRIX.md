# Phase 16 runtime evidence

This host-only evidence log contains no filenames, source pixels, result pixels, or other
image-derived data. `pnpm e2e:phase-16-real` records the capability/lifecycle summary of the host
that actually runs it.

Phase 16 closed locally without deployment on the available development-host smoke below. SPEC.md
v1.11 §7.4 supersedes the earlier plan for Phase 20 to complete pending weak/powerful physical
rows: no physical-device inventory is scheduled or required. Future device-specific evidence is
added only when a user report is reproduced, without overstating general compatibility.

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
  behavior, or heavy WebGPU disposal. Those environments are unverified rather than pending release
  gates; real-user incidents are investigated and converted into regression coverage when
  reproducible.
