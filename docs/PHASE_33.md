# PHASE 33 — Whole-Project Audit & Refactor

<!-- TOKEN BUDGET: keep this file under 10,000 tokens. Be concise. -->

## Phase Metadata

| Field | Value |
|-------|-------|
| Phase | `33` |
| Title | Whole-Project Audit & Refactor |
| Status | `⏳ pending` |
| Tag | `v0.33.0` |
| Depends on | PHASE_32 gate passing |

---

## Phase Goal

Audit the complete application after the editor/help/legal contracts stabilize, then perform small,
evidence-backed refactors that reduce duplication, rendering/resource waste, and architectural
drift without changing product behavior. The phase must prove improvements through repeatable
single/batch measurements and full regressions; it is not authorization for a rewrite, speculative
abstraction, or Studio scope (SPEC.md §5.2, §6, §7.1, §7.4, §7.7–§9).

---

## Scope

### Other

- [ ] `T1` Create `docs/audits/PHASE_33_BASELINE.md` with reproducible representative scenarios:
  cold home/startup; single automatic → every tool → undo/redo/export/reset; multiple upload with
  item switching, edits, removal and ZIP; help/legal choice paths; classified inference failure.
  Record device/browser/build, fixtures, exact commands, run count, and measurement caveats —
  _Depends on:_ —
- [ ] `T2` Measure before changes: route/initial/lazy chunk sizes, LCP/INP/long tasks, time-to-result,
  input/brush response, React commit counts/durations for hot interactions, main-thread vs worker
  work, live workers/listeners/timers/object URLs, and heap/resource trend over repeated single and
  batch churn. Do not present headless values as universal device claims — _Depends on:_ `T1`
- [ ] `T3` Inventory duplication/dead code and ownership: FSD/public APIs, same-layer imports,
  workspace/controller/store overlap, single-vs-batch branches, repeated canvas/coordinate/export/
  error/i18n logic, oversized components/hooks, legacy protocols still imported, and lazy-boundary
  violations. Prove call sites before marking code dead — _Depends on:_ `T1`
- [ ] `T4` Audit React correctness/performance using current official guidance: render purity,
  component identity/keys, derived state, unnecessary Effects, dependency loops, subscriptions and
  cleanup under development StrictMode, unstable context/props, external-store selectors, and
  Profiler evidence. Do not add `memo`, `useMemo`, or `useCallback` globally without a measured hot
  path and stable semantic dependency contract — _Depends on:_ `T2`, `T3`
- [ ] `T5` Audit resource lifecycle: inference/matting workers and pipelines, tensors/ImageBitmaps/
  OffscreenCanvas, typed arrays, Blob/Object URLs, uploaded backgrounds, edit-history artifacts,
  help media, timers/observers/listeners, Cache Storage ownership, abort/stale-run paths, item
  deletion/reset/unmount, and error/fallback branches — _Depends on:_ `T2`, `T3`
- [ ] `T6` Create a prioritized findings ledger with symptom/evidence, owner layer, risk, expected
  improvement, proposed smallest fix, characterization test, measurement, and decision
  (`fix/defer/reject`). Architect approves the bounded fix set before source refactoring; deferred
  findings name a future phase rather than expanding this one silently — _Depends on:_ `T2`–`T5`

### Frontend

- [ ] `F1` Add characterization tests around every approved high-risk finding before changing
  behavior-owning code, including single/batch equivalence and failure/resource cleanup where
  applicable — _Depends on:_ `T6`
- [ ] `F2` Consolidate only proven duplicate business/state/geometry/export/error logic into the
  correct FSD owner and remove only proven-dead adapters/callsites. Preserve public contracts,
  localization, accessibility, model results, and lazy loading — _Depends on:_ `F1`
- [ ] `F3` Fix approved React findings: eliminate render-phase side effects and effect feedback
  loops, add missing cleanup, narrow subscriptions/selectors, stabilize ownership/identity where
  measured, and split hot visual updates away from React state when already required by the canvas
  contract — _Depends on:_ `F1`, `T4`
- [ ] `F4` Fix approved lifecycle findings with explicit disposal/abort/reachability ownership and
  tests for success, cancel, stale, error, reset, item deletion, branch eviction, and unmount —
  _Depends on:_ `F1`, `T5`
- [ ] `F5` Fix approved initial-bundle/main-thread/interaction findings through existing lazy
  boundaries, worker paths, bounded work, or smaller dependency surface. Do not trade correctness
  or meaningful caching for a synthetic benchmark — _Depends on:_ `F1`, `T2`
- [ ] `F6` Repeat the exact baseline suite after each refactor wave, record before/after/error bars
  and regressions in `docs/audits/PHASE_33_RESULTS.md`, and revert/rework changes that lack benefit
  or violate a budget. Add full cross-browser/localized Playwright coverage for changed flows —
  _Depends on:_ `F2`–`F5`

### Infra

- [ ] `I1` Run architecture/type/unit/full host-only E2E and applicable real-model gates. Update
  `docs/STACK.md` only for repeatable profiling commands or an evidence-justified dependency; do
  not add always-on production profiling, user telemetry, Docker/CI Playwright, or a package merely
  to automate one inspection — _Depends on:_ `F6`

---

## Files

### Create / modify

~~~
docs/audits/PHASE_33_BASELINE.md
docs/audits/PHASE_33_FINDINGS.md
docs/audits/PHASE_33_RESULTS.md
docs/STACK.md
src/ (only files explicitly approved in PHASE_33_FINDINGS.md)
e2e/ (characterization/regression specs for approved findings)
docs/PHASE_33.md
~~~

### Do NOT touch

- Product behavior, model/quality algorithms or pins without a separate evidence/spec decision
- Add Studio features, new metadata/analytics, accounts, storage, API, advertising, or payments
- Mass rewrite/renaming, blanket memoization, package churn, or deletion without callsite evidence
- Weaken accessibility, localization, single/batch parity, privacy, or test coverage for metrics

---

## Contracts

### New persistent data (tables / collections / files)

Repository audit/baseline/results documentation only. No runtime persistence is added.

### New API endpoints / RPC methods / events

None.

### New types / models / shared interfaces

None by default. Any internal extraction listed in the approved findings ledger must preserve the
existing external contracts and be documented in Phase-33 Implementation Notes if non-obvious.

### New env vars

None.

---

## Gate Checks

Run `/phase-gate 33` with the complete `docs/STACK.md` gate and the exact repeatable profiling
commands frozen in `PHASE_33_BASELINE.md`. At minimum:

```bash
pnpm build
pnpm vitest run
pnpm exec steiger ./src
pnpm e2e
pnpm e2e:real-model
pnpm e2e:phase-21-real
pnpm e2e:phase-19-real
pnpm e2e:phase-20-real
pnpm tsc --noEmit
```

Fail if source changes lack a finding/baseline/characterization test, behavior or single/batch
parity drifts, React StrictMode reveals repeated side effects/unclean subscriptions, repeated churn
shows unbounded retained resources, initial/lazy boundaries regress, or claimed improvements cannot
be reproduced with the recorded method.

---

## Architect Review Notes

- [x] No architect review issues recorded

## Implementation Notes

None

## Atomic Commit Message

```text
refactor(phase-33): harden architecture and runtime performance
```

## Post-Phase Checklist

- [ ] Scope complete; gates green; review notes resolved
- [ ] Run `/context-update 33`
- [ ] Commit on `feat/phase-33`; tag `v0.33.0` after merge
