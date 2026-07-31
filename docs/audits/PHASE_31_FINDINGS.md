# PHASE 31 — Findings Ledger

<!-- TOKEN BUDGET: keep this file under 10,000 tokens. Be concise. -->

Scope: `T3`–`T5`, `T7`, `T8` inventory, `T6` prioritized decisions. Captured 2026-07-30 on
`feat/phase-31`. Decision legend: `fix` (implemented this pass), `defer` (names a future phase),
`reject` (investigated, no action needed).

## T8 — Empty/error/warning/loading state handling

### F-01 — Invalid single upload hides the upload surface and shifts the error below the fold

- **Symptom / evidence**: `ToolWorkspace.tsx`'s idle-surface branch (`QualityModeToggle` +
  `UploadDropzone` + `ChoosePhotoButton`) was gated on `!displayError`, and `displayError` included
  `uploadError`. An invalid-format upload therefore unmounted the entire idle surface and rendered
  the error in a separate `[grid-area:error]` CSS grid row positioned below `surface` in
  `.tool-workspace-idle` (`globals.css`) — reproduced via `e2e/home.spec.ts` (`unsupported.txt`
  fixture) before the fix: the alert appeared, upload controls disappeared.
- **Owner layer**: `widgets/tool-workspace` (`ToolWorkspace.tsx`, `use-tool-workspace-controller.ts`).
- **Risk**: UX — confusing, was reported directly by the architect as "нецелевое поведение."
- **Expected improvement**: error shown in place, no layout shift, no disappearing controls, retry
  available immediately.
- **Decision**: `fix` (implemented this pass, `F7`).
- **Smallest fix applied**: split `displayError` (workflow/model errors, unchanged gating) from
  `uploadError` (rendered via a new in-place `UploadErrorNotice` inside the owning surface —
  idle command-deck section, or the batch "add images" row — instead of the shared error grid
  area). Added `handleDismissUploadError` (clears only `uploadError`, no broader state reset).
- **Characterization tests**: `ToolWorkspace.test.tsx` — "keeps the upload surface visible in place
  next to the error, with no layout shift"; `e2e/home.spec.ts` — "keeps the upload surface in place
  on an invalid file, with a working retry."
- **Measurement**: before/after DOM assertion (upload input + 3 radios stay mounted while
  `role="alert"` is present); e2e verifies visually-equivalent behavior across the real browser.

### F-02 — Multi-file upload silently drops the invalid file and processes the valid ones

- **Symptom / evidence**: `handleUploads` in `use-tool-workspace-controller.ts` set `uploadError` to
  the first invalid file's error but still called `batch.enqueue(valid)` for the rest. Combined with
  F-01's gating, this meant valid files were enqueued into `batch.session` while the entire batch UI
  was hidden behind the error screen (`batchActive` was also gated on `!displayError`) — worse than
  "drop and continue," since the processed items became invisible until the user dismissed the error.
- **Owner layer**: `widgets/tool-workspace/model/use-tool-workspace-controller.ts`.
- **Risk**: UX/data-integrity confusion — architect-reported.
- **Expected improvement**: one predictable policy — abort the whole attempt on any invalid file,
  with retry, matching `T8`'s explicit ask.
- **Decision**: `fix` (implemented this pass, `F7`).
- **Smallest fix applied**: `handleUploads` now returns early (no `batch.enqueue` call at all) when
  any file in the batch fails validation, instead of partially enqueuing.
- **Characterization tests**: `use-tool-workspace-controller.test.ts` — "aborts a multi-file batch
  upload entirely when one file is invalid"; `ToolWorkspace.test.tsx` — "aborts the whole batch when
  one of several files is invalid, instead of silently dropping it."

### F-03 — Inventory of other interactive components (per-tool panels, model-lab, privacy)

- **Coverage this pass**: per-tool panels (`CutoutToolPanel`, `BackgroundToolPanel`,
  `EnhancementsToolPanel`) and `model-lab` already render their own scoped error/loading affordances
  in place (no shared grid-area indirection) per a spot-check of their `*.test.tsx` files — no
  layout-shift pattern matching F-01/F-02 found there. `privacy`/`about` pages are static, no
  loading/error states exist yet.
- **Decision**: `defer` — a full component-by-component inventory beyond the two reported defects
  and the spot-check above was not completed this pass; name a future `T8`-style pass if new
  interactive surfaces are added (e.g. Phase 32's guided-help UI) rather than re-opening this phase.

## T8 full-inventory follow-up (2026-07-31)

Architect asked for the `F-03`-deferred full pass to actually be completed ("детально проработать
обработку состояний empty, error, warning, loading"). Systematically covered every surface under
`src/features/*/ui/`, `src/widgets/*/ui/`, `src/routes/`. Personally re-verified each item below
before deciding, not taken on trust from the research pass.

**Clean, no defect** (matches `F7`'s in-place/no-layout-shift pattern correctly): `BackgroundToolPanel`,
`BackgroundFillSelector`, `InlineColorPicker`, `CutoutToolPanel`, `EditorStage`, `EditorToolbar`,
`ToolPanelSlot`, `DiagnosticsSheet`, `LocalExecutionReadout`, `CanvasViewControls`,
`BrushSizeStagePreview`, `BatchGrid`, `DownloadResultButton`, `DownloadSplitButton`, `editor-history`
undo/redo, `ForegroundRefinementControls` (in isolation — see `F-19` for its dead-call-site issue),
`QualityModeToggle`, `about`/`privacy` routes (genuinely static, both locales).

**F-25 — `ModelStorageManager` had no retry on a failed initial load (`fix`)**: `busy`/`error`
rendered correctly in place, but the only button stayed `disabled` while `status` was `null`, so a
failed mount-time `refresh()` left no way to recover short of closing/reopening the popover.
Verified directly (`ModelStorageManager.tsx`, pre-fix): `disabled={busy || !status || ...}`. Fixed:
renders a "Try again" button (calling `refresh()`) in place of the disabled Clear button whenever
`error && !status`. Added `ModelStorageManager.test.tsx` (component had zero test coverage before
this fix) — 3 tests, including one asserting the retry button is present/enabled and successfully
recovers. Confirmed via `git stash` that the retry test fails pre-fix, passes post-fix.

**F-26 — `GuidedBrushControls` had a working `retry()` on its model hook that no button ever called (`fix`)**:
verified `use-object-selection.ts`'s `retry` (line 339) has zero call sites anywhere before this fix
(`grep`) — an errored prediction left only "Cancel," forcing the user to abandon the guided-brush
session and re-enter the tool from scratch. Fixed: `GuidedBrushControls` now takes a required
`onRetry` prop and swaps its Apply button for a "Try again" button when `status === "error"`;
`ToolWorkspace.tsx` wires `guided.retry` to it. Added a characterization test; confirmed via
`git stash` it fails pre-fix (no "Try again" button rendered) and passes post-fix.

**F-27 — `ModelLab.tsx`'s precondition hint used identical error styling to real failures (`fix`)**:
the "select ≥2 models" hint used `role="alert"`+`text-destructive`, visually indistinguishable from
the genuine `state.error` alert rendered a few lines below it in the same section. Fixed: changed to
`role="status"`+`text-muted-foreground`. No new test added — this is a dev-only,
`VITE_ENABLE_MODEL_LAB`-gated route with no existing component-render test harness (only its
model/hooks are unit-tested); the fix is a one-line role/class correction, verified by direct read,
not a behavior change worth standing up new render-test infrastructure for on a dev-only surface.

**Deferred (named, not implemented — each needs real behavior-changing work this pass's bounded
scope doesn't cover)**:
- `MatteRefinementControls` missing an `error` prop — superseded by `F-19` (component has no live
  call site; fixing this in isolation was deprioritized once that was found).
- `use-pending-request-worker.ts` has no worker `"error"`-event listener (affects `ModelLab`/
  `InteractiveMattingLab`): a hard worker crash leaves `status: "running"` forever with no visible
  failure. Needs a new error-message contract on the shared hook (`F2`'s extraction) — real,
  moderate-risk shared-hook surgery, not a one-line fix.
- `loadSyntheticCorpus` (`use-interactive-matting-lab.ts`) has no busy flag during its async corpus
  build — dev-only lab feature, lower priority.
- `MaskCorrectionCanvas.tsx`'s `createImageBitmap` has no `.catch` — a decode failure leaves the
  canvas permanently inert with no error/retry. Core correction-canvas path; needs a
  characterization test against the actual decode-failure path before touching, per this phase's
  own no-blind-fix rule for behavior-owning code.
- `describe-state.ts`'s `loadSyntheticCorpus`/GuidedBrush download progress is received but
  discarded (`void progress`) — the busy overlay shows a static message instead of the real
  percentage the worker reports, unlike the main pipeline's equivalent state. Needs the discarded
  value threaded through an existing prop, verified against real worker timing.
- `UploadDropzone.tsx`/`ChoosePhotoButton.tsx` share an unguarded preparation counter that two
  overlapping upload triggers could race — needs a revision-guard fix mirroring
  `use-background-fill.ts`'s existing pattern for the same class of problem, plus a race-condition
  characterization test (harder to write reliably than the fixes above).
- `__root.tsx` has no `errorComponent`/`notFoundComponent`/`pendingComponent` on
  `createRootRoute` — latent (no route currently uses loaders), but a lazy-chunk fetch failure or
  unmapped path has no branded fallback today. Router-wide infra change, not a single-surface fix;
  worth a dedicated finding in a phase that touches routing.

## T7 — Test-suite reliability and speed

### F-04 — Stale assertion text in `QualityModeToggle.test.tsx` (deterministic failure, not flake)

- **Symptom / evidence**: `it("opens and closes accessible maximum-quality help by click")` asserted
  `/compatible WebGPU/i`, but the current copy (`messages/en.json`
  `processingModeMaximumHelpBody`) reads "...on WebGPU and is selected by default on compatible
  devices." — the words no longer appear adjacent. Reproduced 100% (3/3 runs) on `main` before this
  branch's changes, confirming it predates this phase and is unrelated to the `F7` work above.
- **Owner layer**: `features/quality-mode-toggle` test only; no product code involved.
- **Risk**: low individually, but a permanently-red spec erodes trust in `pnpm vitest run` as a
  signal — directly relevant to "test-suite reliability."
- **Decision**: `fix` (implemented this pass — trivial, test-only, no behavior change, no
  architect-approval-triggering condition per the phase's safety check).
- **Fix applied**: updated the assertion to match current copy, using a substring
  (`/precise model on WebGPU/i`) unique to the popover body (the first attempt using "compatible
  devices" collided with an unrelated `sr-only` string elsewhere in the same component).
- **Measurement**: reran the file 3× before (3/3 fail) and 3× after (3/3 pass); full `pnpm vitest
  run` is green (368/368) with this fix in place.

### F-05 — `Mobile Safari` Playwright project times out under CPU contention on a full local run

- **Symptom / evidence**: pre-existing project knowledge (prior sessions) that a full `pnpm e2e` run
  can time out the `Mobile Safari` project when host CPU is under load from other processes.
  Verified this pass that `scripts/run-e2e.ts` already runs each non-Chromium project **serially**
  (`for (const args of runs)`, not `Promise.all`) and already pins `firefox`/`webkit`/
  `Mobile Safari` to `workers: 1` specifically to avoid same-host memory/CPU contention (see the
  in-file comment on `DEFAULT_PROJECTS`). CI only ever runs the single mocked-Chromium
  `e2e:ci-critical` project — this class of flake cannot reach CI.
- **Owner layer**: `scripts/run-e2e.ts`, `playwright.config.ts` — already correctly configured.
- **Decision**: `reject` — no pipeline defect found; the existing serialization/worker-pinning is the
  right mitigation. The residual flake is host-machine contention (other local processes competing
  for CPU during a long local run), not something the invocation flow can eliminate. Documented here
  (and already in project memory) as the standing operating note: rerun `Mobile Safari` alone
  (`--project="Mobile Safari"`) before treating its failure as a real regression.

### F-18 — Vitest full-run heap trend: stable, no leak; real root cause of the "memory/concurrency" complaint was the multi-browser E2E gate, now removed

- **Symptom / evidence**: architect reported "periodically возникают проблемы с памятью,
  конкурентностью" (periodic memory/concurrency problems) across unit/e2e/Playwright runs. Two
  separate things were checked:
  1. **Vitest** (`pnpm vitest run --logHeapUsage --reporter=verbose`, full 87-file/376-test suite):
     per-test process heap fluctuates between ~50–190 MB with no monotonic growth trend across the
     run (GC reclaims between tests, confirmed by non-increasing values later in the run vs.
     earlier) — no leak, no "did not exit"/unhandled-process warnings. `/usr/bin/time -v` on the
     same run: 410 MB peak RSS for the orchestrating process, 23s wall/483% CPU on 6 cores — nothing
     indicating a resource problem in isolation.
  2. **Playwright**: `scripts/run-e2e.ts`'s `DEFAULT_PROJECTS` constant pinned `firefox`/`webkit`/
     `Mobile Safari` to `workers: 1` specifically because running several software-rendered browser
     pages in parallel made them **contend for host memory** (in-file comment, corroborated by
     `F-05`'s Mobile-Safari-CPU-contention finding earlier this phase). This is real, measured
     evidence of the architect's "concurrency" complaint — not a false impression.
- **Consequence of this session's separate chromium-only decision**: with Firefox/WebKit/Mobile
  Safari removed from `playwright.config.ts` (architect request, 2026-07-31, see `docs/STATE.md` §
  Project Log), `DEFAULT_PROJECTS` in `scripts/run-e2e.ts` became a live bug — `pnpm e2e` with no
  explicit `--project` would loop over three browser names Playwright no longer configures and fail
  immediately (`Error: Project(s) "firefox" not found`, reproduced before the fix). Fixed by
  deleting `DEFAULT_PROJECTS` and the per-project-serialization loop entirely (`scripts/run-e2e.ts`)
  — with a single configured project, the workaround has no purpose. Verified: `pnpm tsc --noEmit`
  clean; `pnpm e2e e2e/ci-critical.spec.ts` passes end-to-end through the simplified script.
- **Owner layer**: `scripts/run-e2e.ts`, `playwright.config.ts`.
- **Decision**: `fix` (implemented this pass). The multi-browser memory-contention source of the
  "concurrency" complaint is now structurally eliminated (one browser project, no serialization
  workaround needed) rather than merely documented as a standing operating note like `F-05` was.
- **Residual**: Vitest itself was never the source of the reported instability — its default thread
  pool (up to 6, matching `nproc`) showed no leak or contention symptom over a full run. No
  Vitest-side config change made; none evidenced as needed.

### F-06 — Real-vs-mocked-model segmentation and CI-vs-local invocation flow

- **Coverage this pass**: confirmed `docs/STACK.md` and `.github/workflows/ci.yml` already match —
  CI runs only `pnpm e2e:ci-critical` (mocked Chromium, one worker); every other Playwright project
  (`pnpm e2e`, `pnpm e2e:real-model`, the phase-specific `*-real` commands) is host-only, matching
  `AGENTS.md` core rule 8 and `docs/FRONTEND_CONVENTIONS.md` §10.2. No drift found between the
  documented flow and the actual CI workflow file.
- **Decision**: `reject` — flow is already the fastest-deterministic-split this task asked for; no
  change needed.

### F-13 — Same stale-copy/behavior-drift classes recur across the full `pnpm e2e` suite, not just `home.spec.ts`

- **Symptom / evidence**: running the complete `pnpm e2e` (not `home.spec.ts` alone) surfaced 9
  Chromium failures. Beyond the `ci-critical.spec.ts` batch-ZIP timeout (see `F-07` item 5, same
  root cause, recurs here too), all were the exact same three drift classes already root-caused in
  `F-07`, just in different files:
  - `processing-modes.spec.ts` (4 specs) — same stale `/^Maximum quality/` regex as `F-07` item 3/4.
    Fixed identically (`/^Maximum/`).
  - `scenario-pages.spec.ts` ("the reused upload surface enters batch mode for multiple files") —
    expected `"Скачать всё"` right after a 2-file upload, but batch upload auto-selects the first
    item into the editor view (the same "automatic-first" pattern the `automatic-first editor shell`
    tests already name for single upload), so the split button shows the singular `"Скачать"` for
    that item, not the no-selection `"Скачать всё"` label. Fixed by asserting the singular label.
  - `security-privacy.spec.ts` ("single and batch analytics/export...") — same auto-select
    consequence: the batch ZIP export is only reachable through the "Output options" menu once an
    item is auto-selected, not the main split button labeled `"download all"`. Fixed using the same
    Output-options-menu pattern already used in `home.spec.ts`'s (now-fixed) batch download test.
  - `security-privacy.spec.ts` ("rejects malformed and decompression-bomb-like images...") — expected
    a `"Reset"` button after an invalid upload; this is the exact old-UX assertion `F7` obsoleted
    (upload-validation errors now dismiss via the in-place `"Try again"` retry, not the old shared
    `"Reset"` banner). Fixed by asserting `"Try again"`.
  - `security-privacy.spec.ts` ("single and batch analytics/export...") also intermittently showed
    the `F-07` item 5 client-zip-504 symptom — see the correction below the `F-07` entry: this turned
    out to be a false failure caused by this session's own stale leftover `vite dev` processes, not a
    real product/pipeline bug. Fixed with the label change alone; no product or config change needed.
- **Owner layer**: `e2e/processing-modes.spec.ts`, `e2e/scenario-pages.spec.ts`,
  `e2e/security-privacy.spec.ts` — assertions only.
- **Decision**: `fix` for all 5 — 4 label/behavior-drift assertions plus the "Reset"→"Try again"
  direct consequence of this phase's own `F7` change (not independent drift).
- **Risk**: this confirms the stale-assertion problem was suite-wide, not `home.spec.ts`-specific —
  fixing only `home.spec.ts` would have left `pnpm e2e` red elsewhere for the same reasons. Full
  `pnpm e2e --project=chromium` is green (77 passed, 3 legitimately skipped) after this fix.

### F-07 — Five deterministically-failing `e2e/home.spec.ts` Chromium specs, pre-existing on `main`

- **Symptom / evidence**: while regression-testing `F7`, five specs failed for reasons unrelated to
  this phase's changes; confirmed by stashing this branch's diff and rerunning against `main` at
  `3bb3659` — identical 5 failures, same locators/timeouts.
- **Owner layer**: `e2e/home.spec.ts` only (assertions), not `src/` — for 4 of the 5.
- **Decision**: `fix` for 4/5, `defer` for 1/5 (root-caused, not a copy-drift guess):
  1. `renders the idle state with the quality toggle and upload controls` — `fix`. Phase 30 replaced
     the raster `<img alt="cutbg">` logo with an inline `aria-hidden` SVG mark inside a
     `<Link aria-label="cutbg">` (`shared/ui/brand-logo.tsx`) — there is no `img` role left. Updated
     the assertion to `getByRole("link", { name: "cutbg" })` and dropped the raster-specific
     `naturalWidth`/`complete` checks.
  2. `command deck keeps mode badges separated...` — `fix`. "Recommended"/"Beta" text badges were
     replaced by a shimmer border on the Maximum-quality card (already asserted in
     `QualityModeToggle.test.tsx`: "shows no Beta or Recommended badges"). Renamed the test and
     replaced the badge-geometry check with a `quality-mode-shimmer` class assertion plus explicit
     "no badge text" checks; kept the still-valid header-pattern-position/no-horizontal-overflow
     assertions unchanged.
  3./4. `automatic-first editor shell is stable and keyboard reachable` (both locales) — `fix`.
     `EDITOR_LOCALES[].modes` used `/^Maximum quality/i` / `/^Максимальное качество/i`; the actual
     label (`messages/{en,ru}.json` `processingModeBen2`) is "Maximum" / "Максимум". Same file's
     `helpBody` regex had the exact `F-04` stale-copy bug (`/compatible WebGPU/i` /
     `/совместимый WebGPU/i`) — replaced with a substring from the current popover body
     (`/precise model on WebGPU/i` / `/самую точную модель на WebGPU/i`).
  5. `batch: upload multiple, select, reprocess, download one and all` — `fix`, not copy drift.
     Instrumented the page with `console`/`response` listeners: the ZIP-download click failed
     because `http://localhost:3000/node_modules/.vite/deps/client-zip.js?v=...` 504d ("Outdated
     Optimize Dep"). Initially suspected a real Vite dev-optimizer mid-session invalidation and tried
     retrying the dynamic `import("client-zip")` once after a delay — the retry never resolved
     either, which pointed at something environmental rather than a one-shot transient failure.
     **Correction after further investigation**: `ps aux` showed 5 leftover orphaned `vite dev`
     processes on port 3000, the oldest running since the start of this multi-hour session
     (`scripts/run-e2e.ts`'s own fresh server spawn had been silently failing to bind — "Port 3000 is
     already in use" — every single e2e invocation this session, so every run was actually reusing
     whichever stray server happened to still be alive, with an optimize-deps cache stale relative to
     the many source edits made throughout the session). Killed all leftover `vite dev` processes
     (`pkill -f "vite/bin/vite.js dev"`) and reran with a clean environment: **all 3 previously-timing-
     -out tests passed immediately** (`ci-critical.spec.ts`, `home.spec.ts`, and the `F-13`-listed
     `security-privacy.spec.ts` case). This was never a real product, `client-zip`, or
     `scripts/run-e2e.ts` bug — it was this session's own process hygiene (many back-to-back
     `pnpm e2e ...` invocations without letting each one's server fully terminate). No code or config
     change was needed or made; reverted the earlier speculative import-retry (confirmed unnecessary).
- **Decision**: `fix` for all 5 (corrected from the initial 4/5 `fix` + 1/5 `defer`).
- **Risk**: same as `F-04` — a permanently-red-on-`main` block of `pnpm e2e` erodes the suite as a
  regression signal. `pnpm e2e --project=chromium` is fully green (77 passed, 3 skipped) with a
  clean environment. **Process-hygiene note for future sessions**: if `pnpm e2e` reports "Port 3000
  is already in use" before running, a stale server is being reused — check `ps aux | grep vite` and
  kill orphans before trusting any failure in that run as a real regression.

### F-08 — T2 performance instrumentation gaps (chunk sizes measured; interaction/heap tooling missing)

- **Coverage this pass**: real production bundle sizes and a real (single-machine, localhost, no
  throttling) cold-`/en` paint timing were captured — see `docs/audits/PHASE_31_T2_MEASUREMENTS.md`.
  Confirms the lazy-loading split actually holds in the shipped build: cold `/en` loads ~603.6 KB JS
  (mostly the 554.5 KB app-shell `index-*.js`), while `tool-workspace-*.js` (227 KB) and all four
  ~510 KB ML worker bundles load only on first use, never on cold visit.
- **Decision**: `reject` for the chunk-size/lazy-boundary claim (verified, no regression, no action
  needed). **Updated (2026-07-30, same session, continued at the architect's request)**: built
  `scripts/profiling/measure-baseline.ts` (`pnpm profile:baseline`) — a real CDP-based harness for
  long-task tracking and JS-heap trend over repeated churn. See `F-15` for the heap/leak result
  (`reject` — no leak found). Long-task tracking is also now real (zero recorded, expected given the
  mocked-worker isolation). **Still `defer`**: real-model time-to-result (this machine has no WebGPU
  passthrough, so any number would be WASM-only and mislabeled) and React commit-count/duration
  profiling (needs a `Profiler`-instrumented build; deprioritized, not ruled out, given the heap/
  long-task data and `F-11`'s effect spot-check both came back clean — see
  `PHASE_31_T2_MEASUREMENTS.md` for the full reasoning).

### F-15 — Repeated single/batch upload churn: no leak found (2 independent sample sizes)

- **Coverage**: `pnpm profile:baseline` measured JS heap (via CDP `Performance.getMetrics` +
  `HeapProfiler.collectGarbage` before each sample) across 40 and 100 repeated single-upload
  churn iterations (upload → automatic result → back to upload) and 60 repeated batch-churn
  iterations (3-image upload → remove each item individually → back to upload) — see
  `PHASE_31_T2_MEASUREMENTS.md` for the full tables.
- **Result**: growth rate decelerates ~10x from the first 10 iterations to the tail in every run
  (single: +196 KB/iter → +19 KB/iter; batch: +110 KB/iter → +12 KB/iter), and 8–9% of iterations
  show the heap **decrease** even after a forced GC pass — real reclamation, not just uncollected
  garbage. This is the signature of one-time warm-up stabilizing, not a constant-rate leak (which
  would show flat or accelerating growth with near-zero negative deltas).
- **Decision**: `reject` — no leak found in either flow, for the two upload/teardown paths tested.
  Explicitly **not** claiming this covers every resource-lifecycle path: repeated tool-switching
  within one document, repeated background-fill changes, and manual mask-correction churn were not
  exercised by this harness and remain untested — named here so a future pass doesn't have to
  rediscover the gap.

### F-16 — T3 deepened with `knip` (dead-code/unused-export scan): one real candidate, rest is noise

- **Coverage**: ran `npx knip` (ad hoc, not added to `package.json` — matches `I1`'s "do not add a
  package merely to automate one inspection" rule) across the whole repo. It reported 6 "unused
  files," 2 "unused dependencies," and ~234 "unused exports"/"unused exported types."
- **Verified false positives** (spot-checked every category, not just a sample of the biggest one):
  - All 6 "unused files" (`public/sw.js`, `scripts/operations/exercise-capacity.mjs`,
    `scripts/operations/validate-alerts.mjs`, `scripts/release/smoke.mjs`, `steiger.config.ts`,
    `tests/release/server.mjs`) are real, invoked call sites — `knip` only traces JS `import`
    graphs, so it can't see `navigator.serviceWorker.register("/sw.js")`, `docs/STACK.md`-documented
    standalone `node scripts/...` invocations, `scripts/release/deploy.sh`/`common.sh`'s
    `node /app/release/smoke.mjs`, or `tests/release/Dockerfile`'s reference.
  - `@feature-sliced/steiger-plugin` ("unused devDependency") — false positive; `steiger.config.ts`
    imports it directly (`import fsd from "@feature-sliced/steiger-plugin"`), `knip`'s default
    config apparently doesn't scan that config file for dependency usage.
  - The ~234 "unused exports"/"unused exported types" are overwhelmingly FSD public-API barrel
    (`index.ts`) re-exports and TanStack Router file-based-route `Route` exports — both are
    intentional-by-convention (`docs/FRONTEND_CONVENTIONS.md` §3: "index.ts — public API — the only
    import surface other layers may use"; `Route` is consumed by the router's codegen, not a normal
    import) — `knip` has no FSD/TanStack-Router-specific config here to suppress this whole class.
  - **Conclusion**: `knip`'s default config isn't a good fit for this project's architecture without
    real configuration investment (ignore patterns for barrel exports, router codegen, shell/Docker-
    invoked scripts) — that investment is itself a separate, scoped deliverable, not something to
    improvise as a one-off scan.
- **One real, unresolved candidate**: `onnxruntime-web` ("unused dependency") — genuinely never
  `import`ed as a JS module; only referenced in string literals building a CDN path
  (`${appEnv.modelCdnBaseUrl}/onnxruntime-web/${appEnv.onnxRuntimeWebVersion}/` across 3 worker
  files). Checked `pnpm-lock.yaml`: `@huggingface/transformers` transitively pins a *different*
  `onnxruntime-web` version (`1.26.0-dev.20260416-...`) than this project's direct
  `^1.27.0`, and `src/shared/config/env.ts`'s `onnxRuntimeWebVersion: "1.27.0"` matches the direct
  dependency's version exactly — strong evidence this is a deliberate version-pin anchor (keeping
  the actually-fetched-from-CDN runtime version visible/auditable in `package.json` for Phase 22's
  `pnpm audit`/license-review gate), not dead code.
- **Decision**: `reject` for all of the above, including `onnxruntime-web` — removing a
  security-reviewed pinned dependency on the strength of a static import-graph tool, without being
  able to verify on real WebGPU/WASM hardware in this environment that nothing subtle breaks, is
  exactly the kind of package-churn risk this phase's rules forbid taking casually. If this pin is
  genuinely obsolete, that's a decision for whoever owns the Phase 22 security gate, with the
  evidence above as a starting point — not a same-pass removal here.

### F-09 — Worker-lifecycle duplication: 7 sites, not 6 as `FRONTEND_CONVENTIONS.md` §9 currently says

- **Symptom / evidence**: `grep -rl "new Worker(" src/features` finds **7** feature-owned hooks with
  independent worker init/postMessage/terminate logic, not 6: `useBackgroundRemoval.ts`,
  `use-matte-refinement.ts`, `use-foreground-refinement.ts`, `use-model-lab.ts`,
  `use-object-selection.ts`, `use-batch-processing.ts`, and `use-interactive-matting-lab.ts` (the
  last one — Phase 15/18's interactive matting-lab evaluation hook — was missing from the
  documented list). `use-object-selection.ts` alone has **10** separate `.terminate()` call sites
  across its 1026 lines (multiple worker-swap/retry/cleanup paths), the clearest single piece of
  evidence for why a shared `shared/lib/use-worker.ts` (already named in
  `docs/FRONTEND_CONVENTIONS.md` §9) is worth building.
- **Owner layer**: `docs/FRONTEND_CONVENTIONS.md` §9 (doc accuracy) + the 7 hooks above (actual dedup
  target).
- **Decision**: `fix` (doc count correction, this pass) — **and partially `fix` for the extraction
  itself**, completed during `F2` (2026-07-30). Comparing `use-foreground-refinement.ts` and
  `use-matte-refinement.ts` line-by-line found their worker scaffolding
  (`workerRef`/`requestCounterRef`/`activeRequestRef`/`pendingDisposeRef`, `getWorker`'s lazy-init +
  message-listener + stale-requestId filtering + `"disposed"` handling, `release`, and
  terminate-on-unmount) was **byte-for-byte identical** apart from naming — a clean, low-risk,
  fully-covered-by-existing-tests extraction target, unlike `F-10`. Extracted
  `src/shared/lib/use-worker-lifecycle.ts` (`useWorkerLifecycle`, with its own 7-test unit suite) and
  migrated both hooks to it, preserving their one genuine behavioral difference (`useForegroundRefinement.start`
  cancels a prior in-flight request before starting a new one; `useMatteRefinement.start` does not —
  documented inline in the migrated file so it isn't "fixed away" by a future edit). Both hooks' own
  pre-existing test suites (4 + 5 tests) pass **unmodified**, which is the strongest available
  evidence of behavior preservation — the public API (`{state, start, cancel, prepareNext,
  finishApplying, release, reset}`) is unchanged. `tsc`, `vitest` (375/375), `steiger`, and
  `e2e/foreground-refinement.spec.ts` + `e2e/matte-refinement.spec.ts` (all 4 browsers) all pass.
  **Second extraction, same session**: `use-model-lab.ts` and `use-interactive-matting-lab.ts` (the
  Phase-15/18 evaluation-lab pair) turned out to share a *different* but equally byte-for-byte
  identical pattern from each other — a request-id-keyed pending-promise `Map` plus a `stopWorker`
  that terminates and resolves every outstanding request as `{type:"cancelled"}`, with no
  cancel/dispose messages sent to the worker at all (materially different protocol from the
  refine-* pair, confirmed by reading `useModelLab` in full before assuming it fit
  `useWorkerLifecycle` — it doesn't). Extracted a second shared hook,
  `src/shared/lib/use-pending-request-worker.ts` (`usePendingRequestWorker`), and migrated both.
  Both hooks' pre-existing tests (2 + 1) pass unmodified; `e2e/model-lab.spec.ts` (all 4 browsers)
  passes.

  **Final disposition, all 3 remaining hooks read in full this session** (2026-07-30) —
  `reject`/`defer` for extraction, none migrated:
  - **`useBackgroundRemoval.ts`** (607 lines) — does not fit either shared hook. It has *three*
    heterogeneous concurrent request trackers (a singular `pendingRequestIdRef` for the main
    process flow, driven by a `useReducer` state machine rather than a resolved promise; a
    `pendingAlphaMatteRequestsRef` Map with `{resolve, reject}`; a `pendingRecompositeRequestsRef`
    Map, same shape; a `pendingDisposeRequestsRef` Map matching the cancel/dispose protocol) —
    no single active-request concept (`useWorkerLifecycle`) and no single homogeneous pending map
    with uniform outcome resolution (`usePendingRequestWorker`). Forcing it into either would mean
    rewriting, not extracting.
  - **`use-batch-processing.ts`** (628 lines) — a genuine scheduler (queue/active-set/concurrency-
    limit orchestration across `queueRef`/`activeRef`/`workRef`), not a single-request or
    Map-of-independent-requests hook. It also has three separate pending Maps (mattes, composites,
    disposals) plus queue-scheduling state with no equivalent in either extracted hook. Its worker
    is created via a `useEffect` keyed on `batchStarted`, not an on-demand lazy `getWorker()` call.
  - **`use-object-selection.ts`** (1026 lines) — confirmed the highest-risk shape suspected
    up-front: it contains **two separate `workerRef` declarations** (two distinct worker-owning
    subsystems in one file) using **revision-number-based staleness checks**
    (`revisionRef.current`) and explicit stale-worker-swap logic
    (`if (workerRef.current !== worker) return; worker.terminate();`) instead of either
    extracted hook's request-id/Map-based model entirely.
  - **Decision**: `reject` (not `defer`) — this isn't "ran out of time," it's "read all three fully
    and confirmed none of them share genuine, provable duplication with the two hooks already
    extracted, or with each other." A third or fourth shared hook built to fit just one call site
    each would be indirection, not deduplication — exactly the mistake `F-10` corrected earlier in
    this same session. `F2`'s worker-lifecycle line of work is complete: 4 of 7 hooks share two
    real, evidenced patterns now; the other 3 each have a genuinely distinct shape and stay as they
    are.

### F-10 — Duplicated canvas pointer-to-pixel scale math (2 real, independent implementations)

- **Symptom / evidence**: `MaskCorrectionCanvas.tsx:287-291` computes
  `scaleX = canvas.width / canvasRect.width` / `scaleY` from `getBoundingClientRect()` to map
  pointer coordinates to canvas pixels. `GuidedBrushCanvas.tsx` independently caches its own
  interaction rect (`cacheInteractionRect`/`ensureInteractionRect`, lines 141-152) and does its own
  delta math off `event.clientX`/`clientY` (line 220-223) for panning. No shared helper; each
  component authored its own version. `BrushSizeStagePreview.tsx` and
  `InlineColorPicker.tsx` also call `getBoundingClientRect()` independently, though for simpler
  single-axis-percentage cases, not full canvas-pixel scale math — less clearly the same duplication
  class.
- **Decision**: `reject` — **corrected during `F2`** (2026-07-30). On closer read while scoping the
  extraction, the two implementations compute genuinely different quantities, not the same math
  twice: `MaskCorrectionCanvas.readCanvasGeometry()` returns CSS-to-canvas-**backing-store-pixel
  scale factors** (`canvas.width / canvasRect.width`) for placing brush stamps at exact bitmap
  resolution; `GuidedBrushCanvas` computes a CSS-to-**normalized-[0,1]-fraction position**
  (`displayPointToNormalized`, already factored into `select-object/model/prompt-coordinates.ts`)
  for SAM prompt coordinates, plus a separate CSS-pixel **pan delta** for viewport panning. All
  three start from `getBoundingClientRect()`, which is why they read as "the same duplication" from
  the outside, but forcing them into one shared function would produce a worse abstraction than two
  small, purpose-specific ones — exactly what this phase's no-speculative-abstraction rule warns
  against. No extraction made; `DisplayRect`-shaped rect params could be shared trivially but that's
  not meaningful deduplication on its own.

### F-17 — `MaskCorrectionCanvas.tsx`'s window-shortcut effect had no dependency array (`F3`, fixed)

- **Symptom / evidence**: extended `T4`'s spot-check beyond the two files already checked (`F-11`)
  to every effect-owning hook/component with 2+ `useEffect` call sites (`use-batch-processing.ts`,
  `use-object-selection.ts`, `GuidedBrushCanvas.tsx`, `MaskCorrectionCanvas.tsx`). Found
  `MaskCorrectionCanvas.tsx`'s keyboard/wheel-shortcut effect (was lines 547–581) had **no
  dependency array at all** — unlike the near-identical effect in `GuidedBrushCanvas.tsx`, which
  correctly scopes to `[active, session.source.height, session.source.width, surfaceRef,
  viewportControls]`. Every render tore down and re-attached all four window/editor-level listeners
  (`keydown`, `keyup`, `blur`, `wheel`), contradicting the effect's own comment ("Capture shortcuts
  for the lifetime of the correction editor"). Not a leak (cleanup always paired correctly) but real
  wasted churn on every unrelated re-render of the mask-correction canvas, and inconsistent with the
  sibling component's proven-correct pattern.
- **Owner layer**: `src/features/correct-mask/ui/MaskCorrectionCanvas.tsx`.
- **Root cause detail**: the two handlers passed to `addEventListener`
  (`handleKeyboardNavigation`, `handleWheel`) are plain component-scope functions redefined every
  render (not memoized), so simply adding a dependency array listing them would not have changed
  the re-run-every-render behavior — the real fix needed to break that coupling.
- **Decision**: `fix` (implemented). Added `handleKeyboardNavigationRef`/`handleWheelRef`, kept
  fresh via a small no-deps `useEffect` (runs after every render, cheap — same pattern as `F-14`'s
  `onMessageRef` sync), and had the listener-attaching effect call through the refs with a real
  `[interactionEnabled]` dependency array — matching `GuidedBrushCanvas.tsx`'s proven shape.
  Everything the inline `releaseHandTool`/`handleKeyUp` closures touch (refs, `setSpacePanning`,
  `stopPanning`) was checked and confirmed ref/setState-only — safe to keep capturing at
  `interactionEnabled`-change time without a stale-closure risk.
- **Characterization test**: `MaskCorrectionCanvas.test.tsx` — "keeps window shortcuts working after
  an unrelated re-render, without re-attaching listeners every render" — asserts no
  `addEventListener`/`removeEventListener("keydown", ..., true)` calls across an unrelated prop
  (`brushRadius`) re-render, and that the shortcut still fires correctly afterward. Verified this
  test fails against the pre-fix code (stashed the source change, reran — 1/25 failed with the
  exact expected mismatch) and passes with the fix (25/25).
- **Measurement**: `pnpm vitest run` (376/376), `tsc`, `steiger`, and `e2e/mask-correction.spec.ts`
  (all 4 browsers) all pass.

### F-14 — Self-caught bug while building `F2`'s two shared hooks: unmemoized return object

- **Symptom / evidence**: both `useWorkerLifecycle` and `usePendingRequestWorker`'s first drafts
  returned a plain object literal (`{ getWorker, nextRequestId, ... }`) built fresh every render.
  Every individual function inside was itself `useCallback`-memoized, but the *wrapping object* was
  not — so every `useCallback(..., [worker])` in a migrated feature hook (`start`, `cancel`,
  `reset`, the unmount effect) would have recreated its own callback on every render regardless of
  whether anything the hook depends on actually changed, silently defeating the memoization this
  extraction was supposed to preserve. Caught before committing by re-reading the two hooks against
  `T4`'s "unstable context/props" concern, not by a failing test — none of the existing tests assert
  referential stability across re-renders.
- **Fix applied**: wrapped both hooks' return values in `useMemo`, keyed on their member functions.
- **Note**: `useForegroundRefinement`/`useMatteRefinement`'s `workerFactory` parameter still has an
  unstable *default* value (`() => new Worker(...)` re-evaluates every render when the caller omits
  the argument, which `use-tool-workspace-controller.ts` always does) — this means `getWorker`, and
  therefore the whole memoized `worker` object, was already unstable across renders **before this
  extraction**, unchanged by it. Not a regression introduced this pass, but worth a future `T4`
  finding: passing a `useCallback`-memoized factory (or defaulting via a module-level constant
  function instead of a per-call inline arrow) would fix it for both migrated hooks at once.

### F-11 — React correctness spot-check: no new defects found in the two hottest files this session touched

- **Coverage this pass**: read all 9 `useEffect` call sites in
  `use-tool-workspace-controller.ts` (the file `F7`'s `handleUploads`/`handleDismissUploadError`
  changes live in). All either have an empty dependency array with correct cleanup (stale-closure
  guards via `cancelled`/run-id refs), or list every value they read. The unmount-cleanup effect
  (`useEffect(() => () => {...}, [])`, line 286) correctly disposes the active document scope and
  bumps run-id refs to invalidate in-flight async work. No render-phase side effects, no
  missing-cleanup, no obvious dependency-array bug found in this subset.
- **Decision**: `reject` for these 9 effects specifically — no action needed.
  **Widened, same session (2026-07-30)**: also read every `useEffect` in `use-batch-processing.ts`
  (5), `use-object-selection.ts` (2), and `GuidedBrushCanvas.tsx` (3) — all correct (ref-guarded
  one-shot triggers, paired `addEventListener`/`removeEventListener`, or documented intentional
  every-render synchronization with an inline `eslint-disable` explaining why). Reading
  `MaskCorrectionCanvas.tsx`'s 4 effects found one real defect — see `F-17` (fixed). Still `defer`:
  a Profiler-API-backed audit (commit counts/durations, StrictMode double-invoke timing) — that
  needs instrumentation this session didn't build (`F-08`), and the remaining effect-owning files
  not read this pass (mostly small UI components with 1 effect each — lower risk than the ones
  covered) — same reasoning as before: bounded, evidence-based scope, not exhaustive-or-nothing.

### F-12 — Resource lifecycle spot-check: worker termination pattern is consistent where checked

- **Coverage this pass**: `use-foreground-refinement.ts`'s `reset()` terminates its worker and clears
  `pendingDisposeRef`, wired via `useEffect(() => reset, [reset])` with `reset` stabilized by
  `useCallback([], ...)` — correct unmount-only termination, no re-run-on-every-render risk. Spot
  check only; did not read all 7 worker-owning hooks' full termination paths (in particular
  `use-object-selection.ts`'s 10 termination call sites were not individually traced this pass).
- **Decision**: `reject` for the one hook checked — `defer` for a full `T5` pass across the remaining
  6 hooks (particularly `use-object-selection.ts`, the highest-risk one given its termination-site
  count) and the still-unmeasured heap/resource trend from `F-08`.

## Architecture audit vs `patient_tracker` / `FRONTEND_CONVENTIONS.md` (2026-07-31)

Architect-requested comparison against the reference codebase `patient_tracker` and this project's
own `docs/FRONTEND_CONVENTIONS.md` (never actually performed earlier this phase — only the doc was
adapted). Each finding below was personally re-verified against the cited files after an initial
research pass, not taken on trust.

### F-19 — `ForegroundRefinementControls`/`MatteRefinementControls` are fully-built, tested, dead production UI; the configuration options they offer no longer reach the user

- **Evidence**: `EnhancementsToolPanel.tsx` (live, rendered from `ToolWorkspace.tsx`) is a generic,
  operation-agnostic progress/error/outcome panel driven by `enhancement-operation-registry.ts`'s
  `"matte-refinement"`/`"foreground-cleanup"` adapters. `use-tool-workspace-controller.ts` calls
  `useForegroundRefinement()` (line 186) and `useMatteRefinement()` (via `refinement`, wired
  similarly) directly — their business logic (start/cancel/progress/error) is fully live and feeds
  `EnhancementsToolPanel` through `failEnhancementRun` (lines ~1009-1021, ~956-969). But their
  dedicated presentational components, `features/refine-foreground/ui/ForegroundRefinementControls.tsx`
  and `features/refine-matte/ui/MatteRefinementControls.tsx`, have **zero import sites anywhere in
  `src/` outside their own feature folder and their own `*.test.tsx`** (`grep -rln` confirmed) — they
  are never rendered in the actual app. Two concrete, user-facing configuration options are lost as a
  result: `MatteRefinementControls`' Balanced/Maximum mode radio buttons (the controller exposes
  `setRefinementMode` at `use-tool-workspace-controller.ts:1391` but `ToolWorkspace.tsx` never
  destructures or wires it — confirmed via `grep`), and `ForegroundRefinementControls`' "component
  cleanup" checkbox (the controller hardcodes `componentCleanup: true` at line 811 instead of reading
  a user choice). `refinementMode` is still auto-selected once via `recommendMattingMode` (line 266),
  so the feature isn't broken, but the user can no longer override it, and this isn't stated anywhere
  as an intentional simplification.
- **Owner layer**: `widgets/tool-workspace` (consumes the generic panel instead of the dedicated
  ones), `features/refine-foreground/ui`, `features/refine-matte/ui` (orphaned).
- **Why it's a problem**: two fully-tested feature UI components (with their own `*.test.tsx`,
  exported through their slice's `index.ts`, matching every rule in `FRONTEND_CONVENTIONS.md`) do
  nothing in production — anyone reading these features in isolation would reasonably believe mode
  selection and cleanup-toggle are live product behavior. This is exactly the "legacy protocols
  still imported" / dead-code class `T3` asked to inventory, missed by this phase's earlier `knip`
  pass (`F-16`) because `knip` doesn't flag re-exported-but-never-rendered components the way it
  flags unused files.
- **Decision**: `fix` (resolved 2026-07-31) — architect confirmed the auto-select-only behavior is
  **intentional**, not a regression: "да, это умышленное решение с автовыбором, так и было
  задумано." Per the architect's explicit instruction, the dead components are left in place
  (not deleted, not behaviorally touched) but marked `@deprecated` with a removal-candidate note:
  a JSDoc block on `ForegroundRefinementControlsProps`/`ForegroundRefinementControls` and on
  `MatteRefinementControlsProps`/`MatteRefinementControls` (both `ui/*.tsx` files), plus a one-line
  comment on their `index.ts` re-exports, so this doesn't get silently rediscovered/re-litigated in
  a future phase — anyone reading either component now sees immediately that it has no production
  call site and why. No behavior change, no deletion; this phase's own "prove call sites before
  marking dead" evidence (the `grep` above) is preserved as the deprecation rationale for whenever a
  future phase does the actual removal. **This supersedes the narrower T8 finding below
  (`MatteRefinementControls` missing an `error` prop) — fixing that prop on a deprecated component
  with no live call site is not worthwhile.**
- **Confidence**: high — every claim above is a direct `grep`/read result, not inference.

### F-20 — `ToolWorkspace.tsx` violates its own §2.1 ("one component per file"): four sub-components extracted

- **Evidence**: `PersistentPreviewLayers`, `MaskCorrectionSlots`, `UploadErrorNotice`,
  `CorrectionErrorAlert` were all defined inline in `ToolWorkspace.tsx` (1815 lines) alongside the
  exported `ToolWorkspace` itself — direct violation of `FRONTEND_CONVENTIONS.md` §2.1 ("Never
  define two functional … components in the same file"), which unlike §2.4/§2.5/§2.7/§1 is **not**
  listed among the doc's own open/grandfathered exceptions. `patient_tracker` has no comparable
  multi-component business/widget file (only shadcn compound-primitive files under
  `components/ui/` mix exports, e.g. `card.tsx`).
- **Owner layer**: `widgets/tool-workspace/ui`.
- **Decision**: `fix` (implemented this pass). Extracted all four into their own files
  (`PersistentPreviewLayers.tsx`, `MaskCorrectionSlots.tsx`, `UploadErrorNotice.tsx`,
  `CorrectionErrorAlert.tsx`), each re-exporting its own props type, no public-API/behavior change.
  `ToolWorkspace.tsx` now imports them. Verified: `pnpm tsc --noEmit` clean, `pnpm exec eslint`
  clean on all 5 files, `pnpm exec steiger ./src` clean (no new FSD violations), `pnpm vitest run
  src/widgets/tool-workspace` 41/41 pass (unmodified behavior/tests).
- **Confidence**: high.

### F-21 — Byte-identical progress-bar/fallback-banner markup triplicated across `refine-foreground`, `refine-matte`, and the live `EnhancementsToolPanel`

- **Evidence**: `ForegroundRefinementControls.tsx` and `MatteRefinementControls.tsx` both rendered
  the identical `role="progressbar"` markup (`h-2 overflow-hidden rounded-full bg-muted` wrapping
  `h-full bg-primary` sized via inline `width` style) and an identical amber fallback banner
  (`rounded-lg border border-amber-400/50 bg-amber-50 p-3 text-xs text-amber-900
  dark:bg-amber-950/30 dark:text-amber-200`). While investigating `F-19` above, found the exact same
  progressbar markup a **third** time in the live `EnhancementsToolPanel.tsx` (lines 87-96,
  pre-fix) — this one is the one actually rendered in production. `patient_tracker` has a shared
  `components/ui/progress.tsx` primitive for exactly this case.
- **Owner layer**: `shared/ui` (new primitives), all three consumers.
- **Decision**: `fix` (implemented this pass). Extracted `shared/ui/progress-bar.tsx`
  (`ProgressBar`, parameterized on `value`) and `shared/ui/inline-status-notice.tsx`
  (`InlineStatusNotice`, the amber fallback banner — kept single-purpose, no speculative `tone`
  prop since only the warning variant is actually duplicated 2+ times; `ForegroundRefinementControls`'
  separate destructive/success terminal-message block is NOT identical to anything else and was left
  untouched). Applied `ProgressBar` in all three consumers (`ForegroundRefinementControls`,
  `MatteRefinementControls`, `EnhancementsToolPanel`); `InlineStatusNotice` in the two refinement
  controls files (`EnhancementsToolPanel` has no equivalent fallback banner to replace). Verified:
  `pnpm tsc --noEmit` clean, unit tests for all three files still pass.
- **Confidence**: high — markup verified byte-identical by direct read, not impression.

### F-22 — Three independent byte-formatting functions instead of one `shared/lib` helper

- **Evidence**: `features/refine-matte/model/model-registry.ts:51` `formatMattingModelSize`
  (1,000,000-based, `.toFixed`), `features/model-storage/model/model-cache.ts:58-65`
  `formatStorageBytes` (1024-based B/KB/MB/GB ladder, used in the live `ModelStorageManager.tsx`
  settings surface), `features/model-lab/model/model-registry.ts:190` `formatModelSize`
  (1,000,000-based, hardcoded Cyrillic `"МБ"` unit, dev-only `routes/dev.model-lab.tsx`) — three
  different "format bytes as text" implementations in three `features/*/model/` files.
- **Owner layer**: candidate `shared/lib/format-bytes.ts`.
- **Decision**: `defer` — the three implementations are not behaviorally identical (1024- vs
  1,000,000-based, different rounding, one hardcoded-locale), so consolidation requires a decision on
  which behavior wins for each caller, not a mechanical extraction; doing that silently risks
  changing a user-visible number (e.g. `ModelStorageManager`'s displayed cache size) without the
  measurement/characterization-test rigor this phase requires for any behavior change. Named as a
  future-phase candidate, not implemented.
- **Confidence**: medium (real duplication, but consolidation needs a product decision on rounding).

### F-23 — Pervasive `interface` usage contradicts §2.3/§8 ("use `type`, never `interface`"), including the canonical domain-type source file

- **Evidence**: 215 production `interface` declarations vs 122 `type` declarations (`grep -rn`
  count, excluding tests). `entities/processed-image/model/types.ts` — named by `FRONTEND_CONVENTIONS.md`
  §3/§8 as the domain-type source of truth — used `interface` for every one of its 8 exported domain
  types (`DeviceCapabilities`, `SourceImage`, `AlphaMatte`, `PixelRect`, `Trimap`,
  `RefinementConstraintMap`, `BackgroundGradientStop`, `ProcessedImage`), zero `type` aliases. Unlike
  §2.4/§2.5/§2.7/§1, §8's `type`-not-`interface` rule has no listed exception in the doc's own
  Architect Review Notes.
- **Owner layer**: `entities/processed-image/model/types.ts` (fixed); rest of the codebase
  (unfixed, out of bounded scope).
- **Decision**: `fix`, narrowly — converted only the canonical domain-types file (8 interfaces to
  `type`; confirmed zero `extends` usages of any of them anywhere in `src/` first, so the conversion
  is mechanical and behavior-preserving). Did **not** mass-convert the other ~207 `interface`
  declarations project-wide — that is exactly the blanket rewrite `docs/PHASE_31.md` forbids without
  per-callsite evidence and characterization tests, and is a separate, much larger, dedicated-phase
  scope. Recommend the architect add this as an explicit open item in `FRONTEND_CONVENTIONS.md`'s
  Architect Review Notes (parallel to the existing §2.4/§2.5/§2.7/§1 entry), since right now the doc
  gives no acknowledgment that this rule is violated almost everywhere.
- **Confidence**: medium — real, verified, codebase-wide violation of an explicit rule, but it's a
  typing-style rule, and the fix applied is intentionally narrow.

### F-24 — `use-tool-workspace-controller.ts`'s god-hook shape is also duplicated directly inside `ToolWorkspace.tsx` itself

- **Evidence**: `ToolWorkspace.tsx` calls `useToolWorkspaceController()` but *also* declares ~20 of
  its own `useState` hooks in the component body (`toolByDocument`, `viewPositionByDocument`,
  `backgroundDraftByDocument`, `exportSettingsByDocument`, `cutoutModeByDocument`,
  `interactionModeByDocument`, `pendingTool`, `pendingBatchItem`, etc.) feeding ~18 handler
  functions defined in the same file. `patient_tracker`'s largest comparable UI files
  (`se-wizard/index.tsx`, `add-patient-modal/index.tsx`) have 0-1 `useState` calls each; all
  workflow state lives in a dedicated hook.
- **Owner layer**: `widgets/tool-workspace/ui/ToolWorkspace.tsx` + `model/use-tool-workspace-controller.ts`.
- **Decision**: `defer` — this widens the scope of the god-hook decomposition already deferred
  above ("Overall T2–T5 disposition") to explicitly include `ToolWorkspace.tsx`'s own state, not
  just the model hook file. Confirmed real and evidenced, but per-callsite characterization tests
  for ~20 state variables and ~18 handlers is real, separately-scoped decomposition work, not
  something to rush inside this already-large pass.
- **Confidence**: high (exact useState/handler locations cited) — sizing/risk is what pushes this to
  `defer`, not doubt about the finding.

### Overall T2–T5 disposition

The god-hooks (`use-tool-workspace-controller.ts` 1442 lines, `use-object-selection.ts` 1026 lines,
`ToolWorkspace.tsx` 1815 lines — the last one grew slightly from this phase's own `F7` fix) and
missing `shared/ui` primitives (status/error component — `UploadErrorNotice` is a small, scoped
instance, not a general extraction; promoting it needs a second call site per this phase's
no-speculative-abstraction rule) remain the standing structural findings, now with concrete
line-level evidence (`F-09`, `F-10`) instead of assumption. **Decision: `defer` the actual
decompositions/extractions to a dedicated `F2` follow-up pass** — each needs characterization tests
per call site before touching, which is real, sizable work the phase's own rules require doing
properly rather than rushed inside an already-large session. `T2`'s interaction/heap tooling (`F-08`)
is deferred for the same reason: it doesn't exist yet and building it safely is its own deliverable.
