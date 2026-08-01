# PHASE 31 — Baseline

<!-- TOKEN BUDGET: keep this file under 10,000 tokens. Be concise. -->

Scope: `T1`. Captured 2026-07-30 on `feat/phase-31` at commit `3bb3659` (docs-only commit — no
`src/` changes yet at capture time). Node `v24.13.0`, `pnpm v11.10.0`.

## Representative scenarios

These are the fixtures/flows every later measurement (`T2`) and regression pass (`F6`) must reuse
verbatim so before/after numbers are comparable.

| # | Scenario | Entry | Fixture(s) | Notes |
|---|----------|-------|-----------|-------|
| S1 | Cold home/startup | `GET /en` | — | First paint, hydration, no upload yet |
| S2 | Single automatic → every tool → undo/redo/export/reset | `/en`, upload | `e2e/fixtures/sample.jpg` | Drive Cutout, Background, Enhancements panels in sequence; then undo/redo once each; export; reset |
| S3 | Multiple upload with item switching, edits, removal, ZIP | `/en`, multi-upload | 3× `sample.jpg` variants | Switch selection mid-batch, edit one item, remove one, export ZIP |
| S4 | Privacy route | `/en/privacy` | — | Existing static route, no editor state |
| S5 | Classified inference failure | `/en`, upload | `sample.jpg` + mocked worker failure | Use the existing deterministic worker test double (`pnpm e2e`) to force `model-load-failed` |
| S6 | Invalid-format single upload | `/en`, upload | `e2e/fixtures/unsupported.txt` | New in this phase (T8) — characterizes the fixed layout-shift bug |
| S7 | Invalid-format file inside a multi-file upload | `/en`, multi-upload | `sample.jpg` × 2 + `unsupported.txt` | New in this phase (T8) — characterizes the fixed batch-abort policy |

Future Phase-32 guided-help UI and Phase-33 legal/consent UI are not assumed in any scenario above.

## Devices / browsers

Local dev machine (WSL2, Linux 6.6, no discrete GPU passthrough — WebGPU path unavailable locally;
CI/production WebGPU claims need a real GPU host per `SPEC.md §7.4`). Playwright browser matrix per
`playwright.config.ts`: `chromium`, `firefox`, `webkit`, `Mobile Safari` (iPhone 14 emulation).

## Commands

```bash
pnpm build              # route/chunk sizes
pnpm tsc --noEmit
pnpm vitest run
pnpm exec steiger ./src
pnpm e2e                # S1-S4, S6, S7 (deterministic double)
pnpm e2e:real-model     # S1/S2 against the real model/CDN, serialized Chromium
```

No dedicated runtime profiling script exists yet (Lighthouse/Profiler automation). Per `T2`'s own
text, any device-specific LCP/INP/heap number captured only via manual DevTools/Lighthouse on this
one dev machine must be reported as a single-machine data point, not a universal claim — this
baseline file intentionally does not assert such numbers yet; `T2` is scoped separately.

## Run count / measurement caveats

- Unit suite (`pnpm vitest run`): 1 run is deterministic pass/fail; flake investigation (`T7`) reran
  suspect files 3× individually (see `PHASE_31_FINDINGS.md`).
- E2E (`pnpm e2e`): fixture-scoped runs (`-g` filter) used during this phase's implementation work;
  a full `pnpm e2e` pass is required at `/phase-gate 31`, not captured as part of this baseline
  file — see Known Gotchas below.
- Known flake (pre-existing, from project memory / prior sessions): the full `pnpm e2e` run can time
  out the `Mobile Safari` project under CPU contention when all four browser projects run in
  parallel; rerun that project alone (`--project="Mobile Safari"`) before treating a Mobile Safari
  failure as a real regression. Tracked as a `T7` finding, not re-derived here.

## What this baseline does NOT cover

- `T2`'s actual before/after performance numbers (chunk sizes, LCP/INP, commit counts, heap trend) —
  separate task, not run in this pass.
- `T3`/`T4`/`T5` (duplication inventory, React-correctness audit, resource-lifecycle audit) — see
  `PHASE_31_FINDINGS.md` for what was and wasn't covered this pass and why.
