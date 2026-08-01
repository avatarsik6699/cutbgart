# PHASE 32 — Stability Results

Baseline and acceptance matrix: `PHASE_32_BASELINE.md`. Append evidence only after a wave's focused
checks pass.

## Wave 1 — lifecycle and initialization

Passed on 2026-08-01.

- Upload validation, decode, resize and encode now run in a dedicated serial preparation worker for
  both single and multi-file entry points. Upload callbacks are revision-guarded, and model-progress
  rendering is limited to one React update per animation frame.
- Automatic and batch inference use request/run identities. Retry invalidates the prior item run;
  stale model/process replies are ignored. Worker `error`/`messageerror` and unmount terminalize or
  reject every owned process, matte, recomposite and disposal request.
- The inference worker transfers matte buffers at ownership boundaries instead of cloning them.
  Production model selection, revisions and inference quality are unchanged.
- Focused Vitest: `40/40` passed across upload preparation, automatic inference and batch lifecycle,
  including stale retry/model-ready, worker crash and unmount settlement.
- TypeScript and targeted ESLint: passed with no errors or warnings.
- Bilingual upload-responsiveness plus the existing critical browser journey: `3/3` Chromium tests
  passed. Each three-file upload completed three independent preparation requests and stayed below
  the frozen `<100 ms` upload event-to-next-paint budget.
- Serialized available-host real-model smoke: `1/1` passed in `15.5 s`, using the pinned ISNet model
  through the existing Hugging Face fallback. This confirms the new upload worker feeds the real
  inference worker successfully.

Commands:

```bash
pnpm vitest run src/features/batch-processing/model/use-batch-processing.test.ts \
  src/features/remove-background/model/useBackgroundRemoval.test.ts \
  src/features/upload-image/model/use-upload-preparation.test.ts \
  src/features/upload-image/ui/UploadDropzone.test.tsx \
  src/features/upload-image/ui/ChoosePhotoButton.test.tsx
pnpm tsc --noEmit
pnpm eslint <Wave-1 changed TypeScript files>
pnpm playwright test e2e/phase-32-stability.spec.ts e2e/ci-critical.spec.ts \
  --project=chromium
pnpm e2e:real-model
```

Measurement caveat: these results prove the frozen budgets on the available host and deterministic
fixtures; they do not claim universal device performance. Final 40-cycle resource/heap and full-gate
evidence remains reserved for the end of Wave 4.

## Wave 2 — Cutout

Passed on 2026-08-01.

- Magic Apply is single-flight at both the guided-selection and document-commit boundaries. A
  synchronous double invocation emits one prompt, one recomposite and one history commit.
- Guided stroke consolidation, full-resolution constraints/influence maps, candidate ranking and
  fusion moved into the existing SlimSAM worker. Ranked matte buffers transfer back to the UI; the
  main thread creates only a bounded diagnostic/model prompt of at most 32 points.
- Magic Cancel now always advances the draft revision, clears error/candidate/stroke state and emits
  a localized visible/live-region acknowledgement, including the zero-stroke case.
- Document undo/redo replaces the guided base by reference without terminating or re-encoding the
  model. Version-keyed Magic/Manual initialization synchronizes each tool to the latest committed
  document while preserving the selected item's worker owner and revision.
- Manual Apply owns one Promise across re-entry, commits once, promotes the committed matte on the
  next entry and invalidates stale completion on cancel/item/unmount. The existing canvas baseline
  commit clears its dirty guard after success.
- Focused Vitest: `88/88` passed across guided selection/fusion/ranking, manual patch history/canvas,
  controller integration and the full ToolWorkspace component suite.
- TypeScript, targeted ESLint and the production build passed. The build emitted only the existing
  `>500 kB` model-worker chunk advisory; the new upload worker bundles independently at `3.18 kB`.
- Phase-32 bilingual upload/Cancel/tool-churn flows passed `6/6`; the synchronous-double-click Magic
  budget test passed with event-to-next-paint `<100 ms`, one prompt and one recomposite. The existing
  bilingual/repeated Magic suite passed all `5/5` scenarios when its two final cases were rerun after
  updating the deterministic worker mock, and the critical single+batch Manual/history journey
  passed `1/1`.

Commands:

```bash
pnpm vitest run <8 Wave-2 focused test files>
pnpm tsc --noEmit
pnpm eslint <Wave-2 changed TypeScript files>
pnpm build
pnpm playwright test e2e/phase-32-stability.spec.ts --project=chromium --workers=1
pnpm playwright test e2e/brush-guided-correction.spec.ts --project=chromium --workers=1
pnpm playwright test e2e/ci-critical.spec.ts --project=chromium --workers=1
```

Measurement caveat: the next-paint budget uses deterministic mocked inference on the available host;
the worker boundary and production bundle were also verified, but real SlimSAM quality/performance is
not generalized to untested devices. Final long-task/heap/resource churn remains an end-of-phase gate.

## Wave 3 — Enhancements, Background and viewport

Passed on 2026-08-01.

- Enhancement preparation (trimap, crop and deterministic fallback) and full-matte equality now run
  inside the refinement worker. Apply is single-flight; Stop invalidates the run, releases both
  refinement workers, retains the committed image and selected checkboxes, and reports that no
  partial result was saved.
- Background Apply coalesces repeated calls and sends only one matte copy to the recomposition worker
  instead of cloning it both inside `ProcessedImage` and as a separate request field. The fill rail is
  vertically bounded/scrollable, so the inline palette, hue control and Done action remain reachable.
- View controls are absent from Background and Enhancements. Both brush canvases leave plain wheel
  events to page scrolling, reserve Ctrl/Command+wheel for zoom, expose a visible/accessibility capture
  state, hide both brush rings during Space-pan, and update brush position imperatively.
- Focused Vitest passed `72/72`; TypeScript and production build passed (only the pre-existing model
  worker chunk-size advisory remains).
- The bilingual single/multiple browser matrix passed `7/7`. Background and Enhancement Apply each
  met the frozen `<100 ms` event-to-next-paint budget; Background emitted one recomposite for repeated
  activation, Enhancement emitted one refine run, Stop retained the checkbox selection and truthful
  cancellation copy, and tool churn preserved the Cutout controls.

Commands:

```bash
pnpm vitest run <6 Wave-3 focused test files>
pnpm tsc --noEmit
pnpm eslint <Wave-3 changed TypeScript files>
pnpm build
pnpm e2e e2e/phase-32-stability.spec.ts --project=chromium --workers=1
```

Measurement caveat: mocked worker latency isolates main-thread interaction cost; the production
worker bundles were built, while final real-model/resource-churn evidence remains an end-of-phase
gate.

## Wave 4 — batch and per-item cache

Passed on 2026-08-01.

- Mixed-validity uploads now enqueue every valid sibling while showing the invalid-file notice; adding
  another upload wave appends independent queue work without changing completed items or selection.
  The existing request/run maps enforce the frozen WASM=1/WebGPU=2 concurrency limits and ignore stale
  retry replies.
- `BatchItem.error` is a structured `{ code, message, detail, retryable }` value. Worker/model/item
  failures map to localized safe copy; raw worker diagnostics, paths and image names never enter the
  tile detail. Each failed tile exposes expandable details and Retry starts a fresh request for only
  that retained source.
- Completed items retain independent edit-document scopes/artifact registries, histories, per-document
  tool/draft/export/view preferences and viewport state. Remove/retry/reset dispose only unreachable
  scopes. Existing eight-item churn coverage plus the new add/fail/retry case prove bounded ownership.
- Focused Wave-4 Vitest passed `43/43`; targeted ESLint and TypeScript passed.
- The expanded bilingual phase browser matrix passed `9/9`. It injects one safe batch failure, retries
  it, appends a fourth image, commits Background/Magic/Enhancement edits to three different documents,
  restores each exact document/tool/revision, and asserts selection emits zero additional automatic
  `process` or guided `encode` requests. A completed Magic document is hydrated from its retained
  matte without creating a worker; encoding begins only after the first new marking.

Commands:

```bash
pnpm vitest run src/features/batch-processing/model/use-batch-processing.test.ts \
  src/features/batch-processing/ui/BatchGrid.test.tsx \
  src/widgets/tool-workspace/model/use-tool-workspace-controller.test.ts \
  src/widgets/tool-workspace/ui/ToolWorkspace.test.tsx
pnpm eslint <Wave-4 changed TypeScript files>
pnpm tsc --noEmit
pnpm e2e e2e/phase-32-stability.spec.ts --project=chromium --workers=1
```

## Final host evidence

Passed on 2026-08-01.

- The complete deterministic Chromium suite passed `87/87` active tests; the three model-lab opt-in
  cases were skipped by their documented feature flags. The serialized real-model/CDN smoke then
  passed `1/1` in `19.3 s` using the pinned ISNet revision through `huggingface.co`.
- Phase-32's bilingual stability matrix passed `9/9` inside that parallel full-suite run. Upload
  preparation recorded no application long task `>=100 ms`; Apply next-paint checks stayed below the
  frozen `<100 ms` budget, Apply remained single-flight, and completed-item switching emitted neither
  automatic `process` nor `encode` work.
- Full Vitest passed `94` files / `416` tests. TypeScript and Steiger passed. ESLint passed with zero
  errors and the existing `src/shared/ui/button.tsx` Fast Refresh export warning only. The production
  and Docker builds passed with the existing `>500 kB` model-worker chunk advisory.
- The repeated production-build profiler recorded cold load `298 ms` and FCP `260 ms`. Forty single
  upload/reset cycles retained `6,848,612 → 10,019,564` bytes (`+3,170,952`, versus baseline
  `+3,314,912`); forty three-item batch/remove cycles retained `8,357,116 → 10,719,016` bytes
  (`+2,361,900`, the same order as baseline `+2,306,044`). Both paths recorded zero long tasks and
  materially decelerating heap growth: the batch final ten cycles added about `233 kB`, versus about
  `1.06 MB` in the first ten. Artifact/worker tests separately prove unreachable resources are
  disposed; the forced-GC heap trend is not claimed as zero allocation or universal device evidence.
- `pnpm audit --prod --audit-level high`, the production-license policy, model-manifest verification,
  pinned Trivy `0.70.0` filesystem scan and image scan all passed with zero high/critical findings.
  `docker compose up --build -d app` and the container-network smoke passed; the app reported healthy.

Final gate commands included `pnpm lint`, `pnpm tsc --noEmit`, `pnpm vitest run`,
`pnpm exec steiger ./src`, `pnpm profile:baseline`, `pnpm e2e:full`, the security/supply-chain commands
from `docs/STACK.md`, and the Docker bootstrap/smoke pair.

Measurement caveat: all timing and heap numbers are regression evidence for this WSL2/Chromium host
and the frozen fixtures. Phase 33 still owns physical-device and broader product validation.
