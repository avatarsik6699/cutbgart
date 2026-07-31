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

**F-28 — `use-pending-request-worker.ts` had no worker `"error"`-event listener (`fix`, resolved
2026-07-31)**: a hard worker crash (uncaught exception, syntax error, OOM) never posts a `"message"`
— confirmed via a `MockWorker.crash()` test that a pending request registered before the crash never
resolved, leaving `ModelLab`/`InteractiveMattingLab` stuck at `status: "running"` forever. Fixed:
`usePendingRequestWorker` now takes a required `errorOutcome: () => TOutcome` parameter (parallel to
the existing `cancelledOutcome`), wires `worker.addEventListener("error", ...)` in `getWorker()`
that terminates the dead worker, resets `workerRef` so the next `getWorker()` call recreates it, and
resolves every pending request with `errorOutcome()`. Both call sites (`use-model-lab.ts`,
`use-interactive-matting-lab.ts`) added a `{ type: "worker-crashed" }` outcome variant and a run-loop
branch that sets `status: "cancelled"` + a user-visible `error` message (re-enabling the Run button
via the existing `canRun`/`controlsDisabled` derivation — no new UI needed, both surfaces already
render `state.error`). Added `use-pending-request-worker.test.ts` (no test file existed for this
hook before this fix) — 3 tests, including one asserting every pending resolver fires on crash and
one asserting the worker is recreated lazily rather than reused dead. Confirmed via `git stash`: both
new characterization tests fail against the pre-fix hook, pass post-fix.

**F-29 — `loadSyntheticCorpus` had no busy flag during its async corpus build (`fix`, resolved
2026-07-31)**: the "Создать синтетический корпус" button stayed clickable with no busy indicator
while `createSyntheticMattingCorpus()` was in flight — a slow/repeated click could race, and there
was no visual feedback the build was happening. Fixed: added a `corpusLoading: boolean` field to
`InteractiveState` (independent from the existing `status`, which is reserved for actual matting
runs and already drives the parent `ModelLab`'s "Run" button via `onRunningChange` — reusing it here
would have incorrectly blocked the unrelated comparison run), set/cleared around the async call in
`loadSyntheticCorpus`, and wired the button in `InteractiveMattingLab.tsx` to disable + show
`aria-busy`/a "Строим корпус…" label while `true`. Added a characterization test using a manually
resolved promise (`vi.hoisted` + `mockReturnValueOnce`) asserting `corpusLoading` is `true` mid-flight
and `false` once settled. Confirmed via `git stash` it fails pre-fix (`corpusLoading` stays
`undefined`), passes post-fix.

**F-30 — `MaskCorrectionCanvas.tsx`'s `createImageBitmap` had no `.catch` (`fix`, resolved
2026-07-31)**: a decode failure (rare — the blob already passed upload validation and prior ML
inference, but `createImageBitmap` can still reject under OOM or exotic image data) left the canvas
permanently inert with `rgbaRef`/`ctxRef` staying `null` forever, indistinguishable from still-loading,
with no way to recover. Fixed via the existing `correctionError`/`retryCorrectionRef`/
`CorrectionErrorAlert` mechanism already used for other correction-flow failures in
`use-tool-workspace-controller.ts` — no new UI pattern introduced: `MaskCorrectionCanvas` gained
optional `onDecodeError`/`decodeRetryToken` props (threaded through `MaskCorrectionSlots`), a new
`handleCanvasDecodeError` controller handler sets `correctionError` (new `cutoutCanvasDecodeError`
message, `en`/`ru`) and points `retryCorrectionRef` at a `canvasDecodeRetryToken` bump, which the
canvas's decode `useEffect` now includes in its dependency array to force a fresh
`createImageBitmap` attempt. Added a characterization test (`createImageBitmap` rejecting once,
then resolving after a `decodeRetryToken` bump) — confirmed via `git stash` it produces an unhandled
rejection and hangs against the pre-fix code, passes cleanly post-fix. Verified: `tsc`/`eslint`
clean, `pnpm vitest run` 387/387, `pnpm e2e e2e/home.spec.ts` 16/16 (no regression in the
already-covered manual-correction flows).

**F-31 — `describe-state.ts`'s GuidedBrush download progress was discarded (`fix`, resolved
2026-07-31)**: `describeGuidedState` took a `progress` parameter and immediately `void`-discarded
it, so both the sr-only `aria-live` announcement and `GuidedBrushControls`' visible loading state
showed only a static "Preparing Magic…" message during the first-time SlimSAM model
download/image-encode — indistinguishable from a hang, even though the worker (`select-object.worker.ts`)
posts real percentages the whole time (`use-object-selection.ts`'s `state.progress`, already flowing
correctly, just never read by either consumer). Fixed: `describeGuidedState` now returns a new
`cutoutPreparingProgress` message (`en`/`ru`, `{progress}` placeholder) when `progress` isn't `null`,
falling back to the prior static text before the worker reports anything. `GuidedBrushControls`
gained an optional `progress` prop, rendered as the same text plus the shared `shared/ui/ProgressBar`
(`F-21`'s extraction) whenever `status` is `"loading-model"`/`"encoding-image"` — instead of the
generic keep/remove hint it showed before. `ToolWorkspace.tsx` now passes `guided.state.progress`
through. Added characterization tests in both `describe-state.test.ts` (new file) and
`GuidedBrushControls.test.tsx`; confirmed via `git stash` both fail against the pre-fix code
(static text, no `progressbar` role) and pass post-fix. Verified: `tsc`/`eslint` clean, `pnpm vitest
run` 390/390.

**F-32 — `UploadDropzone.tsx`/`ChoosePhotoButton.tsx` shared an unguarded preparation counter (`fix`,
resolved 2026-07-31)**: both components called `onPreparationChange?.(N)` at the start of an upload
and `onPreparationChange?.(0)` unconditionally in `.finally()` — an earlier trigger's `.finally`
firing after a newer, still-in-flight trigger had already reported its own count would zero the
shared counter mid-flight, making `UploadPreparationNotice` disappear while a real upload was still
preparing. Fixed by mirroring `use-background-fill.ts`'s existing `revisionRef` pattern in both
components: each call bumps a shared `revisionRef` and captures its own revision; the `.finally`
only zeroes the counter if no newer call has started since (`revisionRef.current === revision`).
Applied to all four call sites (`UploadDropzone`'s single/batch paths, `ChoosePhotoButton`'s
single/batch paths). Added a characterization test per component using a `vi.spyOn` on
`validateAndPrepareUpload` with a manually-resolved first call and an immediately-resolved second
call, asserting the counter is zeroed exactly once (not twice) after two overlapping triggers.
Confirmed via `git stash`: both tests fail against the pre-fix code (counter zeroed twice — once
stale, once real) and pass post-fix. Verified: `tsc`/`eslint` clean, `pnpm vitest run` 392/392.

**F-33 — `__root.tsx` had no `errorComponent`/`notFoundComponent` (`fix`, resolved 2026-07-31)**:
an unmapped path fell back to TanStack Router's bare, unbranded `<p>Not Found</p>` (the library logs
its own console warning recommending exactly this fix), and an uncaught render/loader error had no
branded fallback at all — reproduced by temporarily reverting the fix: navigating to an unmapped
path shows the literal "Not Found" text with no site chrome. Fixed by adding two new `pages/`
slices, `pages/not-found` (`NotFoundPage`) and `pages/route-error` (`RouteErrorPage`), each wrapped
in the existing `SiteShell` for consistent branding, with new localized message keys (`en`/`ru`).
Wired via `createRootRoute({ notFoundComponent: NotFoundPage, errorComponent: ({ reset }) =>
<RouteErrorPage onRetry={reset} /> })` in `__root.tsx`. Confirmed with a new
`e2e/scenario-pages.spec.ts` test navigating to a real unmapped path in a real browser, asserting
the branded page renders and the router's bare default text does not; `git stash`-verified this
test fails against the pre-fix `__root.tsx` (times out waiting for the branded testid, and the
router's own console warning about the missing `notFoundComponent` appears in the log) and passes
post-fix. `errorComponent` is wired identically and verified via `tsc`, but — matching this
finding's own original "latent" framing — remains unexercised by an automated trigger: no route in
this app currently has a loader or otherwise throws during render, so there is no real code path to
deliberately fail without adding synthetic test-only scaffolding; this is honestly the same
limitation the original finding named, not newly introduced by the fix. Verified: `tsc`/`eslint`/
`steiger` clean, `pnpm vitest run` 392/392 (one unrelated pre-existing flaky focus-trap timing test
failed once, passed on immediate rerun — not caused by this change).

**Deferred (named, not implemented — each needs real behavior-changing work this pass's bounded
scope doesn't cover)**:
- `MatteRefinementControls` missing an `error` prop — superseded by `F-19` (component has no live
  call site; fixing this in isolation was deprioritized once that was found).
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
- **Decision**: `fix` (resolved 2026-07-31) — re-examined: the three implementations reduce to two
  genuinely distinct *shapes* (a fixed-unit "N MB/МБ" formatter, and a B/KB/MB/GB auto-selecting
  ladder), not three arbitrary behaviors. Extracted `shared/lib/format-bytes.ts` with
  `formatMegabytes(bytes, { decimals, unitLabel })` and `formatBytesLadder(bytes)` — both
  parameterized so every call site's **exact prior output is preserved** (decimals/unit/locale
  passed explicitly per caller), avoiding the behavior-change risk the original `defer` was written
  against. `formatMattingModelSize`/`formatModelSize`/`formatStorageBytes` now thin wrappers.
  `format-bytes.test.ts` pins the exact prior string output of all three call sites as
  characterization tests (e.g. `formatMattingModelSize(60_000_000)` still `"60 MB"`,
  `formatModelSize(87_654_321)` still `"88 МБ"`). Verified: `pnpm tsc --noEmit`/`eslint` clean,
  `pnpm vitest run` 382/382 (including the pre-existing `model-registry.test.ts` suites, unchanged).
- **Confidence**: high — this was a mechanical, behavior-preserving extraction once framed around
  the two real shapes instead of the three surface-level call sites; no product decision was
  actually needed.

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
- **Update**: see `F-34` below for a first decomposition slice of the *model* hook
  (`use-tool-workspace-controller.ts`, 1453 → 1113 lines). `ToolWorkspace.tsx`'s own component-level
  state — the part this finding is actually about — is untouched; still `defer`.

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

### F-34 — First decomposition slice of `use-tool-workspace-controller.ts` (F-24 follow-up)

- **Evidence**: `use-tool-workspace-controller.ts` was 1453 lines, with the fine-detail/colour-halo
  enhancement pipeline (state machine + refs + 4 effects, ~340 lines) fully self-contained apart from
  two ref pairs (`refinementTargetRef`/`foregroundTargetRef`, `refinementContextRef`) that the
  mask-correction flow also writes into by design (tracking "what am I refining right now" across
  both flows).
- **Owner layer**: `widgets/tool-workspace/model/`.
- **Decision**: `fix` — extracted the enhancement-run state machine into a new
  `use-enhancement-runner.ts` (442 lines), taking `recomposite`/`batch.recomposite`,
  `releaseInference`, `guided.release`, `batch.releaseInference`, `refinementMode`, `inferencePath`,
  and the `commitSingleResult`/`commitBatchResult` callbacks as explicit dependencies, and exposing
  the shared ref pair back to the controller (not made fully private, since the correction flow
  genuinely needs to write into them). `use-tool-workspace-controller.ts` is now 1113 lines (~23%
  smaller); its public return-object shape (`enhancementState`, `enhancementProgress`, `refinement`,
  `foregroundRefinement`, `cancelEnhancements`, `retryEnhancements`, `releaseRefinementBeforeHeavyWork`
  keys) is unchanged, so `ToolWorkspace.tsx` needed no changes at all. No new characterization tests
  were written — this is a pure behavior-preserving extraction, verified instead by the full existing
  suite (43 `tool-workspace` tests, 392 project-wide) passing unchanged before and after, plus `tsc`,
  `eslint`, and `steiger` all clean.
- **Remaining scope** (still `defer`, unchanged from `F-24`/"Overall T2–T5" above): `ToolWorkspace.tsx`
  itself still owns ~20 `useState` calls and ~18 handlers directly in the component body;
  `use-object-selection.ts` (1026 lines) is untouched; further slices of
  `use-tool-workspace-controller.ts` (e.g. guided-cutout target tracking, mask-correction handlers)
  remain, each sized similarly to this one and each needing the same dependency-injection treatment
  since they also cross-reference shared refs.
- **Confidence**: high — mechanical extraction, fully covered by pre-existing tests, zero behavior
  change intended or observed.

### F-35 — Second decomposition slice: guided-cutout orchestration (F-24 follow-up)

- **Evidence**: the guided ("magic") cutout target-tracking (`handleApplyGuided`,
  `handleGuideAutomaticResult`, `handleGuideBatchResult`, `cancelGuided`, `guidedRunRef`,
  `guidedTargetRef`) turned out to be substantially more entangled with the rest of the controller
  than `F-34`'s enhancement-runner slice: `extractingMatte`, `correctionError`, `finalizingCorrection`,
  and `retryCorrectionRef` are genuinely shared display/race-guard state with the manual
  mask-correction flow, not guided-exclusive, and the three handlers collectively touch ~15 external
  collaborators (`commitSingleResult`/`commitBatchResult`, `recomposite`/`batch.recomposite`,
  `extractMatte`/`batch.extractMatte`, `releaseInference`, the enhancement-runner's
  `refinementContextRef`/`refinement`/`foregroundRefinement` release-reset pairs, `selectedBatchItem`,
  `deviceCapabilities`, the removal `state`). This is exactly the shape of entanglement that made the
  original `F-24` finding a `defer` rather than a `fix`.
- **Owner layer**: `widgets/tool-workspace/model/`.
- **Decision**: `fix` — asked the architect explicitly given the elevated risk (see
  `docs/PHASE_31.md` Implementation Notes for the question/answer); proceeded with the same
  dependency-injection pattern as `F-34`. New `use-guided-cutout.ts` (387 lines) takes the
  `useGuidedBrushSelection()` result as an *input* dependency rather than instantiating it itself —
  `guided.release` is also needed by `use-enhancement-runner.ts`, and owning the call inside
  `use-guided-cutout.ts` would have created a hook-to-hook circular dependency (enhancement-runner
  needs `guided.release`; guided-cutout needs the enhancement-runner's release/reset handles). `guided`
  and `guidedViewSession` stay directly in the controller as shared inputs to both sub-hooks.
  `use-tool-workspace-controller.ts` is now 874 lines (~40% smaller than the original 1453); public
  return-object shape unchanged, so `ToolWorkspace.tsx` needed no edits.
- **Verification**: full existing suite (43 `tool-workspace` tests, 392 project-wide) passing
  unchanged before/after this slice, `tsc`/`eslint`/`steiger` clean, plus a live Playwright MCP smoke
  test of the actual guided auto-cutout flow (upload → automatic matte extraction → "Подготовка
  Магии…" progress → interactive brush canvas ready with Оставить/Удалить enabled) — console showed
  only the same 4 pre-existing unrelated analytics/CSP errors seen in earlier phase verifications, no
  new errors introduced.
- **Remaining scope** (still `defer`): `ToolWorkspace.tsx`'s own component-level state (~20
  `useState`/~18 handlers) and `use-object-selection.ts` (1026 lines) are still untouched; the
  mask-correction handlers (`handleEditMask`, `handleBatchEditMask`, `handleDoneCorrecting`,
  `handleBatchDoneCorrecting`, `handleCancelCorrection`) remain in the controller and are the next
  candidate slice, sharing the same `extractingMatte`/`correctionError`/`finalizingCorrection`/
  `retryCorrectionRef` state this slice also reached into.
- **Confidence**: high — behavior-preserving extraction, verified by the full pre-existing automated
  suite plus a live manual run of the specific flow this slice touched.

### F-36 — Third decomposition slice: manual mask-correction flow (F-24 follow-up)

- **Evidence**: as flagged in `F-35`'s "Remaining scope", `handleEditMask`, `handleBatchEditMask`,
  `handleDoneCorrecting`, `handleBatchDoneCorrecting`, and `handleCancelCorrection` — plus the
  `originalMatte`/`correctionRunRef` state exclusive to this flow — were still directly in
  `use-tool-workspace-controller.ts`, sharing `extractingMatte`/`correctionError`/
  `finalizingCorrection`/`retryCorrectionRef` and the enhancement-runner's `refinementTargetRef` with
  the guided-cutout flow extracted in `F-35`.
- **Owner layer**: `widgets/tool-workspace/model/`.
- **Decision**: `fix` — new `use-mask-correction-flow.ts` (303 lines), same dependency-injection
  pattern as the prior two slices. `use-tool-workspace-controller.ts` is now 690 lines (~52% smaller
  than the original 1453).
- **Correctness finding surfaced mid-slice**: adding this third `useX(...)` sub-hook call tripped
  `eslint-plugin-react-hooks`'s `react-hooks/immutability` rule across *all three* sub-hooks at once —
  it flagged every `controllerHookResult.someRef.current = value` write in the controller (e.g.
  `enhancementRunner.refinementContextRef.current = {...}`, `guidedCutout.guidedTargetRef.current =
  null`) as "modifying a value returned from a hook," even though the identical pattern had linted
  clean after `F-34` and `F-35`. This was a real anti-pattern the rule's detection apparently only
  fully engages once enough hook calls are present to analyze — not a false positive to suppress.
  Fixed by adding setter methods to each sub-hook's returned API (`setRefinementContext`,
  `setRefinementTarget`, `setForegroundTarget`, `hardResetTargets` on the enhancement runner;
  `setGuidedTarget`, `bumpGuidedRun` on guided-cutout; `bumpCorrectionRun` on mask-correction) so the
  controller only ever calls methods, never assigns through a nested property path off another hook's
  return value. The two "bump" counter functions are wrapped in `useCallback(..., [])` for stable
  identity so the pre-existing unmount-cleanup effect could depend on them correctly; that effect
  still needs one precedented `eslint-disable-next-line react-hooks/exhaustive-deps` (matching the
  existing exception in `use-enhancement-runner.ts`'s `continueRun`) since the rule wants the whole
  `guidedCutout`/`maskCorrection` objects in the dependency array, which would fire the cleanup every
  render instead of only on unmount (those objects are fresh literals each render; only the two bump
  functions inside them are actually stable).
- **Verification**: full existing suite (43 `tool-workspace` tests, 392 project-wide) passing
  unchanged before/after, `tsc`/`eslint --no-cache` clean (zero errors, zero warnings) across all four
  `widgets/tool-workspace/model/*.ts` files, `steiger` clean, plus a live Playwright MCP run of the
  manual mask-correction flow specifically (upload → switch to "Вручную" tab → mask-correction canvas
  renders with active brush controls) — console showed only the same 4 pre-existing unrelated
  analytics/CSP errors, no new errors.
- **Remaining scope** (still `defer`): `ToolWorkspace.tsx`'s own ~20 `useState`/~18 handlers (what
  `F-24` itself names) and `use-object-selection.ts` (1026 lines) are untouched. What remains in
  `use-tool-workspace-controller.ts` (690 lines) is now mostly document-lifecycle orchestration
  (upload, reset, batch selection/clearing, undo/redo, background-commit wrappers) rather than a
  single undifferentiated god-hook — a materially different, smaller-risk shape than where `F-24`
  started, though still large enough that further splitting would need its own scoped pass.
- **Confidence**: high — behavior-preserving, verified by the full pre-existing suite plus a live
  manual run of the exact flow touched; the immutability-rule fix is a correctness improvement, not a
  cosmetic one (mutating properties off unstable hook-return objects is unsafe under the React
  Compiler's memoization assumptions).

### F-37 — Fourth decomposition slice: `ToolWorkspace.tsx`'s own per-document UI state (F-24, the literal finding)

- **Evidence**: `F-24` was originally about `ToolWorkspace.tsx` itself — not the controller hook —
  declaring ~20 `useState` calls and ~18 handlers directly in the component body. `F-34`–`F-36`
  addressed the controller (`use-tool-workspace-controller.ts`, 1453 → 690 lines); this slice is the
  first to touch the component that `F-24` actually named. Of the ~20 component-level `useState`
  calls, 7 followed one exact repeated shape: `Record<string, T>` keyed by `activeDocumentId`, each
  read as `activeDocumentId ? map[activeDocumentId] ?? default : default` and written via a
  `setX((current) => ({...current, [activeDocumentId]: value}))` updater — active tool, cutout mode,
  interaction mode, background-draft dirtiness, export settings, before/after slider position, and
  view-controls collapsed state.
- **Owner layer**: `widgets/tool-workspace/ui/ToolWorkspace.tsx`.
- **Decision**: `fix`, narrowly scoped to the 7 maps sharing the identical shape — new
  `use-document-ui-state.ts` (129 lines, co-located in `ui/` since this is presentation-tier state, not
  business logic, so it stays out of `model/`). Read this finding's "Remaining scope" for why the rest
  of the component's state was deliberately **not** touched in this slice.
- **Why not the rest of the component's state in the same pass**: the remaining ~13 `useState` calls
  and the `activeDraftDirty`/`discardActiveDraft`/`clearActiveDraftState` "confirm before discarding
  unsaved changes" logic are a fundamentally different, much more tightly-coupled cluster — that logic
  reads from nearly every other piece of state in the component (guided/manual draft dirtiness,
  background draft dirtiness, enhancement draft dirtiness) and calls back into most of the controller's
  handlers (`cancelGuided`, `handleCancelCorrection`, `cancelEnhancements`, `handleSelectBatchItem`,
  `handleClearBatch`, `handleReset`). Extracting it would repeat the same entanglement pattern already
  seen and solved for `F-35`/`F-36`, but at larger scale and directly inside a 1400+ line render
  function rather than an orchestration-only hook, which materially raises the chance of a JSX-level
  mistake a type checker won't catch. Treating this as its own dedicated pass (with its own read of
  `ToolWorkspace.test.tsx`'s 599 lines as the regression baseline) is the same judgment call this phase
  applied throughout, not new caution invented for this finding.
- **Verification**: full existing suite (43 `tool-workspace` tests — including `ToolWorkspace.test.tsx`
  — 392 project-wide) passing unchanged before/after, `tsc`/`eslint --no-cache` clean, `steiger` clean,
  plus a live Playwright MCP run exercising the extracted state directly: switched the active tool to
  "Фон" (confirms `activateTool`/`requestTool`), the before/after slider rendered (confirms
  `viewPosition`), and selecting a background preset flipped the panel into its dirty/unapplied state
  (confirms `setBackgroundDraftDirty` wired through `onDirtyChange` correctly) — console showed only
  the same 4 pre-existing unrelated analytics/CSP errors, no new errors.
- **Remaining scope** (still `defer`): the draft-guard cluster described above (~13 `useState` +
  `activeDraftDirty`/`discardActiveDraft`/`clearActiveDraftState` + the `pendingX`/request* wrapper
  functions), and `use-object-selection.ts` (1026 lines), are untouched. `ToolWorkspace.tsx` is now
  1413 lines (was 1537) with ~13 remaining component-level `useState` calls (was ~20).
- **Confidence**: high for the extracted piece (mechanical, fully covered by pre-existing tests plus a
  live run); the "remaining scope" boundary is a deliberate, reasoned stop, not an oversight.

### F-38 — Fifth decomposition slice: `ToolWorkspace.tsx`'s draft-guard cluster (F-24 follow-up)

- **Evidence**: the "remaining scope" flagged in `F-37` — the "confirm before discarding unsaved
  changes" navigation guard — was `ToolWorkspace.tsx`'s single largest remaining tangled cluster: 6
  `pendingX` `useState` calls, `pendingToolTriggerRef`, `manualDraftDirty`/`manualDraftResetKey`, the
  `activeDraftDirty` derivation (reads guided/manual/enhancement/background draft dirtiness), and 11
  functions (`requestTool`, `requestBatchItem`, `prepareActiveBatchMutation`,
  `executeBatchReprocess`/`requestBatchReprocess`, `executeBatchRemove`/`requestBatchRemove`,
  `requestBatchClear`, `requestReset`, `clearActiveDraftState`, `discardActiveDraft`).
- **Owner layer**: `widgets/tool-workspace/ui/ToolWorkspace.tsx`.
- **Decision**: `fix` — extracted to `use-draft-guard.ts` (ui/, presentation-tier state, same
  co-location rationale as `F-37`), taking a ~24-key dependency-injection object (controller handlers,
  `documentUiState` setters, `batch` accessors, the two document-initialization refs already owned by
  `ToolWorkspace.tsx`). The hook owns all pending-navigation state plus `manualDraftDirty`/
  `manualDraftResetKey` (tightly coupled to the guard — both feed `activeDraftDirty` and are reset on
  discard) and returns `activeDraftDirty`, `draftGuardOpen`, the `requestX` wrappers,
  `discardActiveDraft`, and `dismissPendingGuard` (the "continue editing" button's handler, previously
  an inline arrow function in the JSX). `ToolWorkspace.tsx`: 1413 → 1274 lines.
- **Fix note — `react-hooks/immutability` on a dependency object's ref property**: writing
  `deps.initializedMagicDocumentRef.current = null` (a nested property path off the hook's own `deps`
  parameter) was flagged by the same rule documented in `F-36`, extended here to hook *arguments*, not
  just other hooks' return values — `deps` is itself never reassignable inside the hook body. Fixed by
  destructuring `const { initializedMagicDocumentRef, initializedManualDocumentRef } = deps;` once at
  the top of the hook and writing through the local bindings instead of the nested path.
- **Verification**: full existing suite (43 `tool-workspace` + 392 project-wide) passing unchanged,
  `tsc`/`eslint --no-cache` clean, `steiger` clean, plus a live Playwright MCP run: uploaded a sample
  image, switched to "Улучшения", unchecked an enhancement option (dirties the draft), then clicked
  "Фон" — the guard dialog appeared and the tool stayed on "Улучшения". Clicked "Продолжить
  редактирование" (dismiss) — guard closed, draft state untouched, still on "Улучшения". Re-triggered
  the guard and clicked "Отбросить черновик" (discard) — draft cleared and the tool switched to "Фон"
  as originally requested. Console showed only the same 4 pre-existing unrelated errors throughout.
- **Remaining scope** (still `defer`): `use-object-selection.ts` (1026 lines) is untouched — on
  inspection it is two already-cohesive, single-responsibility worker-orchestration hooks
  (`useObjectSelection`, a Phase-17 compatibility hook, and `useGuidedBrushSelection`, the Phase-21
  primary flow) sharing one file, not a god-hook blending unrelated concerns; its length comes from two
  complete state machines, not poor separation. Splitting it into two files would be a pure
  file-organization change with materially lower value than the slices done so far, and was not
  pursued without a more specific rationale.
- **Confidence**: high — mechanical extraction, fully covered by pre-existing tests plus a live run
  exercising both guard outcomes (dismiss and discard) directly.
