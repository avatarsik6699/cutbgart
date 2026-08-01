# Phase 21 Runtime Evidence

## Scope

Host-only, serialized Chromium exercise of the actual available production paths. The check uses a
checked-in public non-user image and persists no image, filename, coordinate, stroke, mask, prompt,
or candidate content. Only path, bounded counts, classified outcome, timing, and pass/fail
observations belong here.

Command:

```bash
pnpm e2e:phase-21-real
```

## Observation

Re-verified on `2026-07-27` from the final Phase-27 review state with the host command above:

| Flow | Actual path | Total prompts | Keep / remove | Directional alpha result | SlimSAM inference | Total flow | Result |
|------|-------------|---------------|---------------|--------------------------|-------------------|------------|--------|
| Automatic-base mixed intent | available automatic path, then Chromium SlimSAM WASM | `32` | `16 / 16` | committed | `380 ms` | `31,823 ms` | PASS |
| Automatic-base Keep | available automatic path, then Chromium SlimSAM WASM | `32` | `32 / 0` | `5,434` gained; `0` unintended lost | `378 ms` | `28,134 ms` | PASS |
| Automatic-base Remove | available automatic path, then Chromium SlimSAM WASM | `32` | `0 / 32` | `6,159` lost; `0` unintended gained | `368 ms` | `28,080 ms` | PASS |

All flows ran inference only from explicit Cutout Apply and committed the automatically selected
result to the existing document pipeline. No runtime failure was observed (`failure: none`). The
directional cases inspect the actual matte submitted for recomposition: Keep never decreases the
automatic base alpha, and Remove never increases it.

## Interpretation

- A pass may claim only the actual Chromium paths printed by the test.
- `promptCount` must be at most `32` for the complete visible session, not per stroke.
- The direct flow must include both labels; the automatic-base flow may validly use red-only intent.
- Painting occurs before `data-prompt-count` exists, demonstrating explicit Apply at the
  browser/worker boundary.
- With an automatic base, Keep-only recomposition must report zero decreased-alpha pixels and
  Remove-only recomposition must report zero increased-alpha pixels.
- Timeout, model/CDN/WASM load failure, inference failure, missing count, or result-pipeline failure
  is classified as a failed available-host observation, not converted into an unsupported device
  claim.
