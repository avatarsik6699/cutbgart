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
- [x] `F3` Fix approved React findings: eliminate render-phase side effects and effect feedback
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
- **Continued at the architect's explicit request (2026-07-30) to finish every remaining `T`/`F`
  item rather than close on the state above**, including standing up new tooling where needed:
  - `T2`/`T5`: built `scripts/profiling/measure-baseline.ts` (`pnpm profile:baseline`, documented in
    `docs/STACK.md`) — a real CDP-based harness for JS-heap trend and long-task tracking. Measured
    single-upload churn at 2 independent sample sizes (40 and 100 iterations) and batch churn (60
    iterations): growth decelerates ~10x from first-10 to tail in every run, with 8–9% of iterations
    showing real GC reclamation — no leak found (`F-15`).
  - `T3`: ran `knip` (ad hoc, not added as a dependency) across the repo. Verified every "unused
    file"/"unused devDependency" flag as a false positive (shell/Dockerfile-invoked scripts, a
    config-file-only import knip's default setup doesn't trace) and the ~234 "unused export" flags
    as FSD-barrel/router-codegen noise. One real, unresolved candidate found (`onnxruntime-web`,
    likely a deliberate version-pin anchor for the Phase 22 security gate) — not removed; flagged
    for whoever owns that gate (`F-16`).
  - `T4`: widened the effect audit to every hook/component with 2+ `useEffect` sites
    (`use-batch-processing.ts`, `use-object-selection.ts`, `GuidedBrushCanvas.tsx`,
    `MaskCorrectionCanvas.tsx`), beyond the 2 files already checked. Found one real bug —
    `MaskCorrectionCanvas.tsx`'s keyboard/wheel-shortcut effect had no dependency array at all,
    unlike the correct sibling pattern in `GuidedBrushCanvas.tsx` — and fixed it via ref-forwarding
    so the effect properly scopes to `[interactionEnabled]` without a stale-closure risk (`F-17`,
    `F3`). Added a characterization test confirmed to fail against the pre-fix code.
  - Manually spot-checked live via Playwright MCP (per the architect's invitation, not just
    automated coverage): the `F7` invalid-upload flow and a real (non-mocked) automatic-cutout run
    against the actual inference pipeline — both worked correctly end-to-end in a real browser.
  - Final full regression: `chromium` 77/77, `firefox` 76/76, `webkit` 76/76 all green (0 failed) —
    confirmed both before and after the `F-17` fix, the last source change this phase. A first
    attempt at the post-`F-17` run showed 71 firefox failures traced immediately to this session's
    own process hygiene (a `pkill` aimed at an unrelated manually-started dev server also killed the
    e2e run's own server mid-suite) — not a regression; a clean immediate rerun confirmed green.
    `Mobile Safari` was intentionally not run to completion in the final pass (stopped partway,
    0 failures observed) at the architect's direction, given it's the already-documented
    contention-prone secondary browser and the other three are fully clean.
  - **Result**: `F2` and `F3` now have real, implemented, evidence-backed fixes. `F4`/`F5` remain
    unchecked — not from time pressure, but because every measurement this phase could responsibly
    take (`F-12`, `F-15`, `F-08`'s chunk-size piece) came back clean, and the only way to find more
    would be tooling (a `Profiler`-instrumented build, real-WebGPU hardware) this environment cannot
    stand up and validate. Those are named, scoped candidates for a future pass, not gaps papered
    over.

- Architecture audit vs `patient_tracker`/`FRONTEND_CONVENTIONS.md` (2026-07-31, architect request —
  never actually performed earlier this phase, only the conventions doc itself was adapted). Six
  findings (`F-19`–`F-24`) added to `PHASE_31_FINDINGS.md`. Implemented: `F-20` (extracted
  `ToolWorkspace.tsx`'s 4 inline sub-components into their own files, §2.1 violation), `F-21`
  (extracted `shared/ui/progress-bar.tsx` + `inline-status-notice.tsx`, deduplicating byte-identical
  markup found triplicated across `refine-foreground`/`refine-matte`/the live
  `EnhancementsToolPanel`), `F-23` (converted the canonical `entities/processed-image/model/types.ts`
  from `interface` to `type` per §8 — narrow fix, not a codebase-wide rewrite). `F-19` (found
  `ForegroundRefinementControls`/`MatteRefinementControls` are fully-built, tested, dead production
  UI — their business-logic hooks are live but the presentational components have zero call sites)
  confirmed by the architect (2026-07-31) as an **intentional** auto-select-only decision, not a
  regression — both components marked `@deprecated` with a removal-candidate note (JSDoc +
  `index.ts` comment) instead of deleted or fixed, per the architect's explicit instruction, so a
  future phase doesn't need to rediscover this. Deferred with named reasons: `F-22` (3 non-identical
  byte-formatting functions — needs a rounding/behavior decision before consolidating), `F-24`
  (widens the already-deferred `use-tool-workspace-controller.ts` decomposition to include ~20
  `useState`s duplicated directly in `ToolWorkspace.tsx`). Verified: `pnpm tsc --noEmit`,
  `pnpm exec eslint src/`, `pnpm exec steiger ./src` all clean; `pnpm vitest run` 376/376;
  `pnpm e2e e2e/home.spec.ts` 16/16.
- `T8` full-inventory follow-up (2026-07-31, architect request — `F-03` had only spot-checked
  before). Systematically covered every interactive surface. Fixed: `F-25` (`ModelStorageManager`
  had no retry on a failed initial load — only button stayed disabled; added a "Try again" button +
  its first test file, 3 tests), `F-26` (`GuidedBrushControls`' errored-prediction state offered
  only Cancel even though `use-object-selection.ts`'s `retry()` existed and was never called —
  wired it to a new "Try again" button), `F-27` (`ModelLab.tsx`'s precondition hint used identical
  `role="alert"`/destructive styling to real errors — changed to `role="status"`/muted). Deferred
  with named reasons (each needs real behavior-changing work, not a bounded-pass fix): worker
  `"error"`-event listener gap in `use-pending-request-worker.ts`, `loadSyntheticCorpus` missing
  busy flag, `MaskCorrectionCanvas`'s unhandled `createImageBitmap` rejection, discarded
  GuidedBrush download-progress percentage, an unguarded upload-preparation-counter race, and
  `__root.tsx`'s missing router-level error/not-found fallback. Verified: `pnpm tsc --noEmit`,
  `pnpm exec eslint src/`, `pnpm exec steiger ./src` clean; `pnpm vitest run` 379/379; full
  `pnpm e2e` 77/77 (3 skipped), Chromium-only per the same-day gate change above.
- Configured Playwright gate scoped to Chromium-only (2026-07-31, architect request, propagated via
  `/spec-sync`): `SPEC.md §7.4` and `playwright.config.ts` no longer configure Firefox/WebKit/Mobile
  Safari projects — Chromium remains the fast local/CI regression gate; Phase 33's physical-device
  sample is now the only remaining compatibility evidence for the dropped engines. `F6`'s "full
  cross-browser/localized Playwright coverage" line above reflects what this phase's own regression
  passes actually ran under the gate as it existed at the time (all 4 projects) and is left
  unedited as a historical record; going forward, `pnpm e2e` runs Chromium only. `PHASE_32`/`PHASE_34`
  marked `⚠️ NEEDS_REVIEW` in `STATE.md` — both still name cross-browser Playwright coverage in their
  scope text. See `docs/STATE.md` § Project Log (2026-07-31) for the full decision record.
- Closed 6 of the 7 previously-deferred T8/architecture findings above (2026-07-31, architect
  request to "continue further work"), superseding their "deferred" framing:
  - `F-22` (byte-formatting consolidation) — turned out to be behavior-preserving once reframed
    around 2 real shapes instead of 3 surface call sites; no product decision actually needed.
  - `F-28` `use-pending-request-worker.ts` gained a worker `"error"`-listener (a hard crash
    previously hung `ModelLab`/`InteractiveMattingLab` at `status: "running"` forever).
  - `F-29` `loadSyntheticCorpus` gained a `corpusLoading` busy flag.
  - `F-30` `MaskCorrectionCanvas`'s `createImageBitmap` gained a `.catch`, wired through the
    existing `correctionError`/`CorrectionErrorAlert` mechanism (no new UI pattern).
  - `F-31` `describeGuidedState`/`GuidedBrushControls` now show the worker's real download
    percentage during first-time SlimSAM model loading instead of a static message.
  - `F-32` `UploadDropzone`/`ChoosePhotoButton` gained a `revisionRef` guard (mirroring
    `use-background-fill.ts`) so an earlier trigger's `.finally` can no longer zero the shared
    preparation counter out from under a newer, still-in-flight trigger.
  - `F-33` `__root.tsx` gained `notFoundComponent`/`errorComponent` (new `pages/not-found`,
    `pages/route-error` slices, both wrapped in `SiteShell`) — verified live via Playwright MCP
    (branded 404 page renders correctly) and a new `e2e/scenario-pages.spec.ts` test.
  - Left deferred, unchanged from above: `F-19`'s dead-UI decision (already resolved separately —
    architect confirmed intentional, components marked `@deprecated`) and `F-24` (god-hook
    decomposition — assessed as genuinely too large/risky for this bounded continuation; needs its
    own dedicated design pass, not force-fit here).
  - Every fix has a characterization test confirmed via `git stash` to fail pre-fix, pass post-fix.
    Verified: `tsc`, `eslint`, `steiger` clean; `pnpm vitest run` 392/392.
- F-24 follow-up (2026-07-31, `F-34`): extracted the fine-detail/colour-halo enhancement-run state
  machine out of `use-tool-workspace-controller.ts` (1453 → 1113 lines) into a new
  `use-enhancement-runner.ts` (442 lines), a self-contained subsystem apart from a ref pair the
  mask-correction flow also writes into (exposed back to the controller by design). Public return
  shape of the controller unchanged, so `ToolWorkspace.tsx` needed no edits. Pure behavior-preserving
  extraction — no new characterization tests; verified by the full existing suite (43 tool-workspace
  tests, 392 project-wide) passing unchanged before/after, plus `tsc`/`eslint`/`steiger` clean.
  Remaining scope explicitly still deferred: `ToolWorkspace.tsx`'s own ~20 `useState`/~18 handlers
  (what `F-24` is actually about), `use-object-selection.ts` (1026 lines, untouched), and further
  slices of the controller (guided-cutout tracking, mask-correction handlers).
- F-24 follow-up (2026-07-31, `F-35`): attempted the next slice (guided-cutout orchestration) and
  found it substantially more entangled than `F-34` — `extractingMatte`/`correctionError`/
  `finalizingCorrection`/`retryCorrectionRef` are shared with the manual mask-correction flow, and the
  handlers touch ~15 external collaborators. Asked the architect explicitly given the elevated risk
  ("Извлечь аккуратно сейчас" chosen over stopping or pivoting to `ToolWorkspace.tsx`); proceeded with
  the same dependency-injection pattern. New `use-guided-cutout.ts` (387 lines) takes the
  `useGuidedBrushSelection()` result as an input rather than owning it, avoiding a hook-to-hook
  circular dependency with `use-enhancement-runner.ts` (`guided.release` is needed by both).
  `use-tool-workspace-controller.ts` is now 874 lines (~40% smaller than the original 1453). Verified:
  full suite (43 tool-workspace, 392 project-wide) unchanged before/after, `tsc`/`eslint`/`steiger`
  clean, plus a live Playwright MCP run of the guided auto-cutout flow end-to-end (no new console
  errors). Next candidate slice: the mask-correction handlers, which share the same state this slice
  reached into.

## Atomic Commit Message

```text
refactor(phase-31): harden architecture and runtime performance
```

## Post-Phase Checklist

- [ ] Scope complete; gates green; review notes resolved
- [ ] Run `/context-update 31`
- [ ] Commit on `feat/phase-31`; tag `v0.31.0` after merge
