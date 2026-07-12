# PHASE 10 — Batch processing

<!-- TOKEN BUDGET: keep this file under 10,000 tokens. Be concise. -->

## Phase Metadata

| Field | Value |
|-------|-------|
| Phase | `10` |
| Title | Batch processing |
| Status | `✅ done` |
| Tag | `v0.10.0` |
| Depends on | PHASE_09 gate passing |

---

## Phase Goal

Process many images in one in-memory browser session without repeating the upload → download loop
by hand (SPEC.md §2.2, §5.2–§5.4, §7.1, §7.3, §7.7, §8). Each item progresses independently
through the existing single-image workflow with bounded concurrency and isolated failures, while
remaining entirely client-side. Users can review, correct, reprocess, and download individual
results or download all completed results as a client-generated ZIP.

---

## Scope

### Backend

None

### Frontend

- [x] `F1` `features/upload-image` — accept multiple files on the existing upload surface and enter
  batch mode without adding a route — _Depends on:_ —
- [x] `F2` `features/batch-processing` — introduce in-memory `BatchSession` / `BatchItem` state and
  schedule independent item processing with adaptive bounded concurrency: at most 2 active
  inference jobs on WebGPU and 1 on WASM — _Depends on:_ `F1`
- [x] `F3` `features/batch-processing` — add a keyboard-focusable grid/tile overview with queued,
  model-loading, processing, result, and isolated error status per item; announce status changes via
  the existing `aria-live="polite"` path; display a live scheduler summary with inference path,
  active/limit, queued, completed, and failed counts — _Depends on:_ `F2`
- [x] `F4` `pages/home` and existing scenario-page compositions — wire batch mode into the current
  upload surface and allow selecting an item for review, correction, and reprocessing through the
  existing single-image `result`⇄`correcting` flow, with no duplicate top-level state machine
  — _Depends on:_ `F2`, `F3`
- [x] `F5` `features/download-result` — keep per-item PNG download and add client-side “download all
  as ZIP” for completed `BatchSession` items using `client-zip` pass-through streaming, with no
  redundant PNG recompression, server upload, or temporary persistence
  — _Depends on:_ `F2`
- [x] `F6` Tests — add unit/integration coverage for scheduling, state transitions, error isolation,
  and ZIP assembly; add Playwright coverage for multi-file upload, independent progress, item
  selection/correction/reprocessing, individual download, and download-all ZIP — _Depends on:_
  `F1`, `F2`, `F3`, `F4`, `F5`
- [x] `F7` `features/remove-background` + batch UI — expose real aggregate model-loading progress
  from Transformers.js (`progress`, `loaded`, `total`) as percent and MiB downloaded/total, and
  expose honest per-item processing stage + elapsed time without fabricating an inference percent
  that ONNX Runtime does not provide — _Depends on:_ `F2`, `F3`
- [x] `F8` `features/correct-mask` — add editor-scoped undo/redo shortcuts (`Ctrl/Cmd+Z`,
  `Ctrl/Cmd+Shift+Z`, and `Ctrl+Y`) and narrow the brush-size range so the maximum source-space
  brush footprint is approximately `150 × 150 px` — _Depends on:_ `F4`

### Infra

None

<!-- Test execution is governed by `## Gate Checks` below + docs/STACK.md § Gate Commands.
     Do not duplicate that list here. -->

---

## Files

### Create / modify
~~~
package.json
pnpm-lock.yaml
src/features/upload-image/ui/UploadDropzone.tsx
src/features/upload-image/ui/UploadDropzone.test.tsx
src/features/batch-processing/index.ts
src/features/batch-processing/model/types.ts
src/features/batch-processing/model/use-batch-processing.ts
src/features/batch-processing/model/use-batch-processing.test.ts
src/features/batch-processing/ui/BatchGrid.tsx
src/features/batch-processing/ui/BatchGrid.test.tsx
src/features/remove-background/model/state-machine.ts
src/features/remove-background/model/state-machine.test.ts
src/features/remove-background/model/useBackgroundRemoval.ts
src/features/remove-background/model/useBackgroundRemoval.test.ts
src/features/remove-background/worker/inference.worker.ts
src/features/correct-mask/model/use-mask-correction.ts
src/features/correct-mask/model/use-mask-correction.test.ts
src/features/correct-mask/ui/MaskCorrectionToolbar.tsx
src/features/correct-mask/ui/MaskCorrectionToolbar.test.tsx
src/features/download-result/index.ts
src/features/download-result/lib/create-results-zip.ts
src/features/download-result/lib/create-results-zip.test.ts
src/features/download-result/ui/DownloadAllButton.tsx
src/features/download-result/ui/DownloadAllButton.test.tsx
src/pages/home/ui/HomePage.tsx
src/pages/home/ui/HomePage.test.tsx
src/pages/product-photo/ui/ProductPhotoPage.tsx
src/pages/document-photo/ui/DocumentPhotoPage.tsx
src/pages/logo/ui/LogoPage.tsx
src/pages/avatar/ui/AvatarPage.tsx
e2e/home.spec.ts
e2e/mask-correction.spec.ts
e2e/scenario-pages.spec.ts
e2e/support/mock-inference.ts
e2e/fixtures/sample.jpg
~~~

### Do NOT touch

- `docs/SPEC.md` — phase-init must not modify the approved spec
- Backend, database, Docker, Nginx, or server-upload code — batch processing and ZIP assembly are
  client-side only (SPEC.md §3, §4)
- Route definitions, SEO copy, metadata, sitemap generation, or JSON-LD — batch mode adds no route
  and is not an SEO-content phase (SPEC.md §5.1)
- `features/correct-mask` internals except the narrowly approved `F8` keyboard shortcuts and brush
  range — selected items still reuse the existing correction flow rather than creating a parallel
  editor
- Background replacement — deferred to Phase 11

---

## Contracts

> This section is the source of truth for `/context-update`. Fill it in **before** handing to AI.

### New persistent data (tables / collections / files)

None — `BatchSession`, every `BatchItem`, and ZIP assembly are in-memory only, scoped to the browser
tab, and discarded on reload (SPEC.md §2.2, §3).

### New API endpoints / RPC methods / events

None — batch processing, compositing, and ZIP assembly remain entirely client-side and add no server
endpoint or analytics event (SPEC.md §4, §7.6).

### New types / models / shared interfaces

```ts
type BatchItemStatus = "queued" | "model-loading" | "processing" | "result" | "error";
type ProcessingStage = "queued" | "preparing" | "inference" | "compositing" | "complete";

interface ModelLoadProgress {
  status: "idle" | "checking-cache" | "downloading" | "building-session" | "ready";
  percent: number | null; // 0–100 only when totalBytes > 0
  loadedBytes: number;
  totalBytes: number | null;
  fromCache: boolean | null; // null until cache/network source is known
}

interface ItemProcessingProgress {
  stage: ProcessingStage;
  startedAt: number | null;
  elapsedMs: number;
  percent: null; // reserved; do not synthesize a fake inference percentage
}

interface BatchItem {
  id: string; // crypto.randomUUID(), generated once when the file enters the batch
  originalFileName: string;
  source: SourceImage;
  qualityMode: QualityMode; // snapshot at enqueue time; stable across this item's run
  alphaMatte?: AlphaMatte;
  processedImage?: ProcessedImage;
  status: BatchItemStatus;
  error?: string;
  enqueuedAt: number; // performance.now(); diagnostic timing only
  startedAt?: number;
  completedAt?: number;
  processingProgress: ItemProcessingProgress;
}

interface BatchSchedulerSnapshot {
  inferencePath: InferencePath;
  concurrencyLimit: 1 | 2;
  activeCount: number;
  queuedCount: number;
  completedCount: number;
  failedCount: number;
  totalCount: number;
}

interface BatchSession {
  items: BatchItem[];
  selectedItemId: string | null;
  modelLoads: Partial<Record<`${QualityMode}:${InferencePath}`, ModelLoadProgress>>;
}

function deriveBatchSchedulerSnapshot(
  session: BatchSession,
  inferencePath: InferencePath,
  concurrencyLimit: 1 | 2,
): BatchSchedulerSnapshot;
```

Each item independently owns its `SourceImage → AlphaMatte → ProcessedImage` lifecycle. Selecting an
item must reuse the existing single-image `result`⇄`correcting` flow; no duplicate state machine is
part of this contract (SPEC.md §2.2, §5.3).

Identity is never derived from array position or filename: `id` is created once with
`crypto.randomUUID()` and remains stable across status updates, selection, correction, retry, and
reordering. `originalFileName` is retained for deterministic, sanitized download names; collisions
receive a numeric suffix. Scheduler bookkeeping remains feature-local and is not persisted.

The scheduler permits at most 2 simultaneous inference jobs when the detected path is WebGPU and 1
when it is WASM. Validation/decoding and ZIP entry preparation may overlap, but they must not create
additional inference jobs. Queue dispatch is FIFO; a failed item releases its slot and never blocks
the rest. Tests must inject the limit and use `1` deterministically where ordering matters.

Rationale: one inference job can retain the ONNX session/model, source and output buffers, and large
intermediate tensors. WebGPU can benefit from a second in-flight job while command submission and
readback overlap, but higher fixed concurrency multiplies VRAM pressure for limited throughput gain.
On the WASM fallback, jobs compete for the same CPU and wasm32 linear-memory budget; serial inference
reduces UI contention and the documented `bad_alloc`/out-of-memory risk. This is a conservative
product default, not a claim that every device has identical capacity. Keep the limits as named,
feature-local policy constants so later real-device evidence can tune them without changing the
batch state contract.

The grid displays `BatchSchedulerSnapshot` as a compact live summary, for example: “WebGPU · 2/2
active · 4 queued · 3 done · 1 failed”. Counts are derived from current item states rather than
independently mutated counters, so they cannot drift. Announce meaningful transitions through the
existing polite live region, but do not announce every count change if that would flood assistive
technology. Per-item timestamps use `performance.now()` only to derive transient queue and processing
durations for diagnostics/tests; never persist or send them to analytics. The summary must not expose
device identifiers, image contents, filenames, or other PII.

### Progress metadata contract

Model loading is shared by batch items that use the same quality-mode/inference-path key because the
scheduler reuses that cached pipeline/session. Display one aggregate model-loading panel per active
key, not a misleading copy on every tile; the normal same-quality batch therefore shows one panel.
Transformers.js v4 `progress_callback` emits aggregate `progress_total` events with
`progress`, `loaded`, and `total`; forward all three from the worker as numeric bytes and derive the
UI values from them:

- percent: clamp `progress` to `0..100`, display with at most one decimal place;
- transferred size: IEC units (`MiB = bytes / 1_048_576`), e.g. `52.4 / 176.0 MiB`;
- if `total <= 0`, show downloaded MiB plus an indeterminate progress bar and no percentage;
- distinguish `checking-cache`, network `downloading`, ONNX `building-session`, and `ready` so a
  pause after bytes reach 100% is not presented as a frozen download;
- when the model is already cached, progress may jump directly to complete; show “Loaded from
  browser cache” when this is observable, otherwise “Model ready” — never infer a network download;
- throttle UI updates to at most one rendered update per animation frame while always delivering
  the terminal 100%/ready event; progress must be monotonic within one load attempt and reset on a
  genuine retry or quality-mode change.

Exact percentage for the ONNX inference call is not available from the current Transformers.js /
ONNX Runtime Web pipeline. During per-image processing show the truthful stage (`preparing`,
`inference`, `compositing`) and elapsed time with an indeterminate indicator. `percent` remains
`null` until an upstream runtime exposes measured progress; do not estimate it from historical
averages, timers, image dimensions, or other simulated progress. Tiles may show “Processing · 3.2s”
and the scheduler summary continues to show overall completed/total counts.

ZIP contract: `client-zip@^2.5.0`, using `downloadZip`/its `Response` stream and store/pass-through
entries. The outputs are PNGs and already compressed, so DEFLATE would add CPU and memory pressure
for negligible size reduction. The implementation may materialize the final `Response.blob()` for
the normal anchor-download path, but must not first copy every PNG into `Uint8Array` or construct a
second full archive buffer. Import `client-zip` only from the browser-side download action (a
client-only dynamic import), never during TanStack Start SSR; revoke the resulting object URL after
the download is initiated.

Mask-correction interaction contract: while the existing correction editor is mounted,
`Ctrl/Cmd+Z` invokes one available undo step, `Ctrl/Cmd+Shift+Z` invokes one available redo step,
and `Ctrl+Y` invokes one available redo step. A handled shortcut prevents the browser default; an
unavailable history action remains a no-op. Listeners are removed with the editor and must not
affect the result, upload, or batch-grid views. The brush-size control continues to store radius in
source-image pixels, but caps it at `75 px`, yielding a maximum circular footprint of approximately
`150 × 150 px`; the UI presents the corresponding diameter so “size” is unambiguous.

### New env vars

None

---

## Gate Checks

> **Before running gate:** confirm all Scope checkboxes are checked (or explicitly deferred in
> Architect Review Notes). Unchecked items appear in the gate report as a warning, not a hard block.

Run `/phase-gate 10` before committing.

`/phase-gate` returns full PASS only when:
- Automated checks are green
- All architect review items below are resolved (checked off)

Use the commands in [docs/STACK.md](./STACK.md#gate-commands) as the source of truth for:
- infrastructure / bootstrap
- migrations (if applicable)
- backend / unit tests
- frontend prep, type-check, unit tests (if a frontend exists)
- e2e — mandatory for this phase: drop/select multiple images, assert independent per-item progress
  and error isolation, select one item to review/correct/reprocess, download it individually, and
  download all completed results as a ZIP (SPEC.md §7.7)
- the default smoke check

If this phase needs a custom smoke target or other phase-specific note, record it here:

```bash
# Optional phase-specific smoke override
# none — this phase adds no server route; use the default home-page smoke plus batch e2e above
```

Phase-specific verification:

- Exercise both injected scheduler branches (`2` for WebGPU, `1` for WASM), including a failed item
  releasing its slot and the queue continuing.
- Assert the displayed scheduler summary always matches item-derived counts, never exceeds its
  advertised limit, and remains usable/announced at mobile and desktop breakpoints.
- Mock `progress_total` events and verify percent plus MiB rendering, unknown-total fallback,
  monotonic updates, cache-ready behavior, quality-mode reset, and the download → session-build →
  ready transition. Assert processing uses stage + elapsed time and never renders a fake percent.
- Verify duplicate/unsafe source filenames produce unique sanitized `.png` ZIP entries.
- Inspect one generated archive in Chromium, Firefox, and WebKit and assert each downloaded PNG is
  byte-for-byte identical to its per-item result.
- In the correction editor, commit strokes and verify `Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z`, and
  `Ctrl+Y` traverse the same undo/redo history as the toolbar buttons; verify the brush slider caps
  its source-space footprint at approximately `150 × 150 px`.

---

## Architect Review Notes

Use this section after manual product, UX, API, or workflow verification. This is the human-facing
channel for post-implementation fixes.

Add one unchecked checkbox per issue the agent must fix before the phase can close. Keep each item
independently fixable and describe observed behavior plus expected behavior. If the fix may change
SPEC/API/schema/security behavior, say so explicitly in the note.

The agent resolves these items through `/impl-assist 10 review`. Leave an item unchecked while it
is still open. Check it off only after the fix is implemented and re-verified. If manual
verification found nothing, keep the default checked line below.

- [x] Batch upload gives no immediate feedback while all selected files are decoded and validated;
  show an explicit preparation state as soon as a multi-file selection starts and prevent an
  overlapping selection until those files enter the queue.
- [x] Batch tiles look static even though they select an item for review; add clear hover, focus,
  and selected affordances plus concise action/status and image metadata.
- [x] Filenames alone do not identify batch items reliably; add a compact source-image thumbnail
  to every tile, including queued and processing items, without leaking object URLs after unmount.
- [x] Queued items do not explain that the shared model is prepared first and remaining work is
  dispatched through a bounded FIFO queue; show truthful queue position, elapsed waiting/processing
  time, stage indicators, and the existing measured shared-model percent/MiB without fabricating a
  per-image inference percentage.
- [x] Non-ready tiles appear selectable but cannot open a review workflow; disable selection until
  the item reaches `result` and state clearly that review becomes available when processing finishes.
- [x] “Reprocess item” does not say which quality mode it uses after the global toggle changes;
  label the action with the item's snapshotted mode and explain that the toggle applies to new
  uploads while reprocessing preserves the item's mode.

---

## Implementation Notes

<!-- Optional. The agent adds a short bullet here only when something isn't already visible from
     the code or commit history: an intentional deviation from the plan, a residual risk, a
     rejected alternative. Leave empty when nothing needs recording — this is not a mandatory
     per-task log. -->

- Phase-init open questions were resolved on 2026-07-12: `client-zip@^2.5.0`; concurrency 2 on
  WebGPU / 1 on WASM; stable `crypto.randomUUID()` item IDs plus retained original filenames. See
  `docs/STATE.md` § Project Log for the decision record.

---

## Atomic Commit Message

```
feat(phase-10): add bounded batch processing and ZIP downloads
```

---

## Post-Phase Checklist

- [x] All Scope checkboxes checked (or deferred in Architect Review Notes)
- [x] All automated gate checks green
- [x] All architect review notes resolved
- [x] `docs/STATE.md` updated — run `/context-update 10`
- [x] Committed atomically on `feat/phase-10` branch
- [x] Tag created after merge to main: `git tag -a v0.10.0 -m "Phase 10: Batch processing"`
