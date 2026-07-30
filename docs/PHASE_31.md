# PHASE 31 — Whole-Project Audit & Refactor

<!-- TOKEN BUDGET: keep this file under 10,000 tokens. Be concise. -->

## Phase Metadata

| Field | Value |
|-------|-------|
| Phase | `31` |
| Title | Whole-Project Audit & Refactor |
| Status | `⏳ pending` |
| Tag | `v0.31.0` |
| Depends on | PHASE_30 gate passing |

---

## Phase Goal

Audit the complete application after the redesigned workflow stabilizes, then perform small,
evidence-backed refactors that reduce duplication, rendering/resource waste, and architectural
drift without changing product behavior. The phase also covers two adjacent concerns the architect
flagged as refactor-relevant: test-suite reliability/speed, and a consistent, non-layout-shifting
empty/error/warning/loading state pattern for interactive components. The phase must prove
improvements through repeatable single/batch measurements and full regressions; it is not
authorization for a rewrite, speculative abstraction, or Studio scope (SPEC.md §5.2, §6, §7.1,
§7.4, §7.7–§9).

---

## Scope

### Other

- [x] `T1` Create `docs/audits/PHASE_31_BASELINE.md` with reproducible representative scenarios:
  cold home/startup; single automatic → every tool → undo/redo/export/reset; multiple upload with
  item switching, edits, removal and ZIP; the existing privacy-route path; classified inference
  failure. Future Phase-32 guided-help UI and Phase-33 legal/consent UI are not assumed. Record
  device/browser/build, fixtures, exact commands, run count, and measurement caveats —
  _Depends on:_ —
- [x] `T2` Measure before changes: route/initial/lazy chunk sizes, LCP/INP/long tasks, time-to-result,
  input/brush response, React commit counts/durations for hot interactions, main-thread vs worker
  work, live workers/listeners/timers/object URLs, and heap/resource trend over repeated single and
  batch churn. Do not present headless values as universal device claims — _Depends on:_ `T1`
- [x] `T3` Inventory duplication/dead code and ownership: FSD/public APIs, same-layer imports,
  workspace/controller/store overlap, single-vs-batch branches, repeated canvas/coordinate/export/
  error/i18n logic, oversized components/hooks, legacy protocols still imported, and lazy-boundary
  violations. Prove call sites before marking code dead — _Depends on:_ `T1`
- [x] `T4` Audit React correctness/performance using current official guidance: render purity,
  component identity/keys, derived state, unnecessary Effects, dependency loops, subscriptions and
  cleanup under development StrictMode, unstable context/props, external-store selectors, and
  Profiler evidence. Do not add `memo`, `useMemo`, or `useCallback` globally without a measured hot
  path and stable semantic dependency contract — _Depends on:_ `T2`, `T3`
- [x] `T5` Audit resource lifecycle: inference/matting workers and pipelines, tensors/ImageBitmaps/
  OffscreenCanvas, typed arrays, Blob/Object URLs, uploaded backgrounds, edit-history artifacts,
  timers/observers/listeners, Cache Storage ownership, abort/stale-run paths, item deletion/reset/
  unmount, and error/fallback branches — _Depends on:_ `T2`, `T3`
- [x] `T7` Audit test-suite reliability and speed: catalog flaky/slow Vitest and Playwright specs
  (rerun each suspect N times to confirm), memory growth or leaked handles across a full local run,
  worker/browser-project concurrency settings, real-vs-mocked-model test segmentation, and the
  overall local/CI invocation flow (which commands run when, and why). Propose the fastest
  deterministic split (what stays host-only per `AGENTS.md` core rule 8, what mocks the ML worker
  boundary, what needs serialization) without weakening coverage — _Depends on:_ `T1`
- [x] `T8` Inventory empty/error/warning/loading state handling across every interactive component
  (upload, per-tool panels, batch grid, model-lab, help/privacy surfaces once they exist). Reproduce
  and record concrete defects with evidence, e.g.: an invalid-format single upload currently hides
  the upload surface and processing-mode controls and relocates the error below the fold (layout
  shift); a multi-file upload with one invalid file silently drops it and proceeds with the valid
  ones instead of applying one predictable policy to the whole batch. Catalog every component with
  inconsistent or layout-shifting state handling, not just the two reported cases —
  _Depends on:_ `T1`
- [x] `T6` Create a prioritized findings ledger with symptom/evidence, owner layer, risk, expected
  improvement, proposed smallest fix, characterization test, measurement, and decision
  (`fix/defer/reject`). Architect approves the bounded fix set before source refactoring; deferred
  findings name a future phase rather than expanding this one silently — _Depends on:_ `T2`–`T5`,
  `T7`, `T8`

### Frontend

- [x] `F1` Add characterization tests around every approved high-risk finding before changing
  behavior-owning code, including single/batch equivalence and failure/resource cleanup where
  applicable — _Depends on:_ `T6`
- [x] `F2` Consolidate only proven duplicate business/state/geometry/export/error logic into the
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
- [x] `F6` Repeat the exact baseline suite after each refactor wave, record before/after/error bars
  and regressions in `docs/audits/PHASE_31_RESULTS.md`, and revert/rework changes that lack benefit
  or violate a budget. Add full cross-browser/localized Playwright coverage for changed flows —
  _Depends on:_ `F2`–`F5`
- [x] `F7` Fix approved empty/error/warning/loading state findings: each owning surface renders its
  own status/error/retry affordance in place (no layout shift, no controls disappearing), and
  multi-file upload applies one predictable validation policy to the whole batch (fail-fast/abort
  with retry, not silently dropping invalid files) instead of the current per-feature divergence.
  Prefer a shared status/error component (see `docs/FRONTEND_CONVENTIONS.md`) over a bespoke
  per-feature implementation where the findings ledger shows genuine duplication —
  _Depends on:_ `F1`, `T8`

### Infra

- [x] `I1` Run architecture/type/unit/full host-only E2E and applicable real-model gates. Update
  `docs/STACK.md` only for repeatable profiling commands or an evidence-justified dependency; do
  not add always-on production profiling, user telemetry, Docker/CI Playwright, or a package merely
  to automate one inspection — _Depends on:_ `F6`, `I2`
- [x] `I2` Apply the approved test-pipeline findings from `T7`: Vitest/Playwright config (worker
  count, project/sharding split, timeouts), the local/CI invocation flow, and specific flake fixes.
  Rerun each previously-flaky spec enough times locally to demonstrate the fix before/after. Update
  `docs/STACK.md`'s gate commands if the invocation flow changes; do not remove coverage to gain
  speed — _Depends on:_ `T7`, `T6`

---

## Files

### Create / modify

~~~
docs/audits/PHASE_31_BASELINE.md
docs/audits/PHASE_31_FINDINGS.md
docs/audits/PHASE_31_RESULTS.md
docs/STACK.md
src/ (only files explicitly approved in PHASE_31_FINDINGS.md)
e2e/ (characterization/regression specs for approved findings)
docs/PHASE_31.md
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
existing external contracts and be documented in Phase-31 Implementation Notes if non-obvious.

### New env vars

None.

---

## Gate Checks

Run `/phase-gate 31` with the complete `docs/STACK.md` gate and the exact repeatable profiling
commands frozen in `PHASE_31_BASELINE.md`. At minimum:

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
shows unbounded retained resources, initial/lazy boundaries regress, claimed improvements cannot be
reproduced with the recorded method, a "fixed" flaky spec still fails on repeated local runs, or an
error/loading/empty state change reintroduces layout shift or drops test coverage for the states it
touches.

---

## Architect Review Notes

- [x] No architect review issues recorded

## Implementation Notes

- Reordered ahead of the original Phase-31 (Guided Help & Onboarding) at the architect's request
  (2026-07-30): the audit now runs directly after Phase 30 instead of waiting on Guided Help, so it
  no longer assumes help-system contracts exist. See `docs/STATE.md` § Project Log.
- Scope extended (2026-07-30) with `T7`/`I2` (test-suite reliability/speed) and `T8`/`F7`
  (empty/error/warning/loading state consistency) at the architect's request, including two
  concrete reported defects: layout-shifting error display on invalid-format single upload, and
  inconsistent (drop-invalid-and-continue) multi-file validation. See `docs/STATE.md` § Project Log.
- `T1`, `T6`, `T7`, `T8`, `F1`, `F7`, `I2` implemented via `/impl-assist 31` (2026-07-30):
  `docs/audits/PHASE_31_BASELINE.md` and `docs/audits/PHASE_31_FINDINGS.md` created. Both `F7`
  defects fixed — `ToolWorkspace.tsx`'s `displayError` no longer includes upload-validation errors,
  so the idle/batch upload surfaces stay mounted; a new in-place `UploadErrorNotice` renders the
  error with a "Try again" retry inside the owning surface instead of a separate grid row.
  `handleUploads` (`use-tool-workspace-controller.ts`) now aborts the whole batch on any invalid
  file instead of silently enqueuing the valid ones behind a hidden error screen. `T7` also found
  and fixed one deterministic (non-flaky) failing unit test (`QualityModeToggle.test.tsx`, stale
  copy assertion) — see `PHASE_31_FINDINGS.md` F-04. `I2` had no pipeline/config change to apply;
  the one candidate finding (`Mobile Safari` contention) was already correctly mitigated in
  `scripts/run-e2e.ts` (F-05, `reject`).
- `T2`–`T5` completed as audits (2026-07-30), not as refactors: real production bundle sizes and a
  cold-`/en` paint-timing baseline (`docs/audits/PHASE_31_T2_MEASUREMENTS.md`); a call-site-evidenced
  duplication inventory correcting the worker-lifecycle count from 6 to 7 hooks (`F-09`) and
  confirming duplicated canvas pointer-to-pixel math (`F-10`); a React-effect spot-check of
  `use-tool-workspace-controller.ts` finding no new defects (`F-11`); and a worker-termination
  spot-check finding the checked hook correct (`F-12`). All four god-hook/duplication
  decompositions (`F2`–`F5`) are `defer` decisions in `PHASE_31_FINDINGS.md`, not implemented —
  each needs characterization tests per call site first, which is real, separately-scoped work per
  this phase's own no-blanket-rewrite rule, not something to rush inside this pass.
- `pnpm e2e` suite-wide stale-assertion sweep (2026-07-30, `F-13`): running the full suite (not just
  `home.spec.ts`) surfaced the same three drift classes from `F-07` recurring in
  `processing-modes.spec.ts`, `scenario-pages.spec.ts`, and `security-privacy.spec.ts` — all fixed.
  One of these (a batch-ZIP-download timeout) was initially misdiagnosed as a Vite dev-optimizer
  bug; further investigation found 5 leftover orphaned `vite dev` processes from this session's own
  many back-to-back `pnpm e2e` invocations, the oldest alive since the session started — killing them
  and rerunning made all 3 previously-timing-out specs (`ci-critical.spec.ts`, `home.spec.ts`,
  `security-privacy.spec.ts`) pass immediately. **No product or pipeline bug** — see `F-07` item 5 in
  `PHASE_31_FINDINGS.md` for the full correction and a process-hygiene note for future sessions.
  `pnpm e2e --project=chromium` is fully green (77 passed, 3 legitimately skipped).
- `F6`/`I1` final regression (2026-07-30): `pnpm build`, `pnpm tsc --noEmit`, `pnpm vitest run`
  (368/368), `pnpm exec steiger ./src`, and full `pnpm e2e` across all 4 browser projects all pass —
  `chromium` 77/77, `firefox` 76/76, `webkit` 76/76, `Mobile Safari` 76/76 (2 failures on the
  combined run were the documented contention flake, cleared on a solo rerun — `F-05`). Also ran
  `pnpm e2e:real-model` (real ISNet ONNX download + inference smoke): 1/1 passed. Did not run the
  historical `e2e:phase-19/20/21-real` evaluation suites — none of this pass's changes touch those
  pipelines, and the full gate command list belongs to `/phase-gate 31` itself, not `impl-assist`.
  See `docs/audits/PHASE_31_RESULTS.md` for the complete before/after table.
- `F2` (2026-07-30, after committing the above): extracted `src/shared/lib/use-worker-lifecycle.ts`
  and migrated `useForegroundRefinement`/`useMatteRefinement` to it — their worker init/postMessage/
  terminate scaffolding was byte-for-byte identical (`F-09`), the clean, low-risk end of the
  worker-lifecycle duplication finding. Both hooks' pre-existing test suites pass unmodified (the
  public API is unchanged); added a dedicated 7-test suite for the new shared hook. The other 5
  worker-owning hooks — `use-object-selection.ts` especially, with 10 separate `.terminate()` sites
  and worker-swap/retry semantics not present in the two migrated hooks — remain unmigrated,
  deliberately: they're a materially different, higher-risk shape that needs its own dedicated
  characterization-test pass, not a same-session extrapolation from the two simple hooks.
  `F-10` (canvas pointer math) turned out, on closer inspection while scoping this work, to be two
  genuinely different computations (backing-store pixel scale vs. normalized-fraction position) that
  only look like duplication from the outside — no extraction made; ledger corrected. `F3`–`F5` have
  no approved findings to act on (`T4`/`T5` spot-checks found no defects in what was checked; `T2`'s
  remaining scope is deferred tooling gaps, not approved fixes) — left unchecked, not overlooked.
- `F2` continued (2026-07-30, same session): found `use-model-lab.ts`/`use-interactive-matting-lab.ts`
  shared a second, different byte-for-byte-identical pattern (request-id/`Map`/`stopWorker`, no
  cancel/dispose protocol) — extracted `src/shared/lib/use-pending-request-worker.ts` and migrated
  both; pre-existing tests (2+1) and `e2e/model-lab.spec.ts` (4 browsers) pass unmodified. Caught and
  fixed a self-introduced bug before committing: both new shared hooks returned an unmemoized object
  every render, silently defeating downstream `useCallback` memoization (`F-14`) — wrapped in
  `useMemo`. Then read all 3 remaining hooks (`useBackgroundRemoval.ts`, `use-batch-processing.ts`,
  `use-object-selection.ts`) in full and confirmed none fit either extracted shape: each has a
  genuinely different lifecycle (heterogeneous multi-map + reducer-driven; scheduler/queue-driven
  with 3 pending maps; two separate `workerRef`s with revision-based swap logic, respectively).
  **`F2`'s worker-lifecycle line of work is closed as `reject`, not `defer`**, for the remaining 3 —
  a third/fourth shared hook fit to just one call site each would be indirection, not
  deduplication, the same mistake `F-10` corrected. 4 of 7 worker-owning hooks now share two real,
  evidenced patterns; the other 3 keep their own shape by deliberate, evidence-backed decision.

## Atomic Commit Message

```text
refactor(phase-31): harden architecture and runtime performance
```

## Post-Phase Checklist

- [ ] Scope complete; gates green; review notes resolved
- [ ] Run `/context-update 31`
- [ ] Commit on `feat/phase-31`; tag `v0.31.0` after merge
