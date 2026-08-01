# Phase 20 Runtime Evidence

Date: 2026-07-22. Command: `pnpm e2e:phase-20-real` (host-only, serialized Chromium).
This document contains no uploaded image, filename, prompt, matte, pixel sample, or user/device
identifier. Measurements describe only the available test host and are not physical-device claims.

## Available-host result

- Playwright 1.61.1, Headless Chrome 149.0.7827.55 on Linux; 6 logical cores and 16 GiB reported
  device memory. No usable WebGPU path was available, so every observed model run requested and
  completed on WASM with no model fallback.
- Automatic IS-Net q8: 20,929 ms (`180,000 ms` limit).
- ViTMatte Balanced q8: 4,947 ms cold and 158 ms warm (`120,000/30,000 ms` limits).
- ViTMatte Maximum fp32: 19,121 ms cold and 165 ms warm (`120,000/30,000 ms` limits).
- Foreground cleanup: 187 ms end-to-end; worker compute 7.9 ms (`10,000 ms` limit). The 1×1 smoke
  matte had no soft edge, so the classified terminal result was `unchanged/no-soft-edge`.
- Generated 2500×2500 compatibility case: source crop 2500×2500, bounded input 1024×1024,
  Balanced/WASM result in 15,710.4 ms, no fallback, restored matte 2500×2500. The earlier supplied
  incident dimensions are therefore covered without retaining its image or filename.
- Selected-flow interaction count: 2 (refine, cleanup), within the maximum of 3.
- Peak/delta memory API: `unavailable`; no value was inferred. The worker reports a measured heap
  delta only when both observations exist.
- Threshold result: PASS. WebGPU and physical Firefox/Safari/iOS/Android devices remain unverified;
  deterministic browser-engine fallback flows are covered separately by the normal Playwright
  matrix.

## Quality regression gate

The eight-category synthetic corpus enforces: exact cleanup-disabled alpha, alpha-error and
boundary-IoU non-regression within `1e-6`, at least 5% mean colour-spill improvement, at most 1%
per-case spill regression, at most 3 acceptance interactions, at most 2,000 ms per deterministic
128px case, and at most 256 MiB measured cleanup heap delta (or explicit `unavailable`). The focused
Vitest corpus passed all thresholds.

## COOP/COEP decision

Decision: defer cross-origin isolation; `deploy/nginx/app.conf` remains unchanged.

- The available host reported `crossOriginIsolated: false` and no `SharedArrayBuffer`.
- ONNX Runtime Web 1.27.0 therefore selects one WASM thread; its installed source explicitly sets
  `numThreads = 1` when cross-origin isolation is absent and otherwise caps the default at 4.
- No isolated/non-isolated A/B result proved a release benefit, and the complete production
  CDN/Cloudflare injection, same-origin Umami endpoints, analytics delivery, and every public route
  cannot be validated from this local-only deployment. Enabling headers without that evidence
  would violate Phase 20's compatibility condition. A future evaluation must prove both benefit and
  full resource compatibility before changing production headers.

## Incident-first compatibility record

- One voluntary incident was supplied during manual verification: large-image Balanced and Maximum
  refinement produced ONNX Runtime `OrtRun`/`SafeIntOnOverflow`, while a smaller control succeeded.
- Environment details beyond the error and inputs were not supplied, so that physical browser/device
  remains unverified. The issue was independently reproduced on Headless Chrome/WASM as an unbounded
  2086×2253 crop padded to 2112×2272.
- The smallest durable rules are now enforced: bounded ViTMatte input with source-sized restoration,
  Balanced WebGPU→WASM retry, generated large-input real coverage, and localized applied/unchanged/
  error cleanup outcomes. No diagnostic export, intake endpoint, backend, device registry, PII,
  image payload, or analytics event was added.
