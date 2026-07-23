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

Observed on `2026-07-23` with the host command above:

| Flow | Actual path | Total prompts | Keep / remove | Candidates | SlimSAM inference | Total flow | Result |
|------|-------------|---------------|---------------|------------|-------------------|------------|--------|
| Direct guidance | Chromium, SlimSAM WASM | `32` | `16 / 16` | `3` | `767 ms` | `17,451 ms` | PASS |
| Automatic-base correction | available automatic path, then Chromium SlimSAM WASM | `32` | `0 / 32` | `3` | `1,105 ms` | `31,845 ms` | PASS |

Both flows had no prompt count before the explicit recompute action and continued to the existing
result/refinement pipeline after accepting the automatically selected current result. No runtime failure was observed
(`failure: none`). The automatic-base red-only case confirms that the direct-flow green requirement
is not incorrectly applied when a preserved base matte exists.

## Interpretation

- A pass may claim only the actual Chromium paths printed by the test.
- `promptCount` must be at most `32` for the complete visible session, not per stroke.
- The direct flow must include both labels; the automatic-base flow may validly use red-only intent.
- Candidate count must remain between one and three after local material-difference collapse.
- Painting occurs before `data-prompt-count` exists, demonstrating explicit recompute at the
  browser/worker boundary.
- Timeout, model/CDN/WASM load failure, inference failure, missing count, or result-pipeline failure
  is classified as a failed available-host observation, not converted into an unsupported device
  claim.
