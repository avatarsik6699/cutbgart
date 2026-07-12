# STATE: BG Remove App Development Tracker

> **Single source of truth for project status, current contracts, and history.**
> Replaces what used to be four separate files (`STATE.md`, `CONTEXT.md`, `CHANGELOG.md`,
> `DECISIONS.md`). Updated by `/spec-sync` and `/context-update`.
>
> **Status legend**
> `⏳ pending` — not started
> `🔄 in-progress` — agent implementation in progress
> `✅ done` — gate checks passed, committed, merged
> `⚠️ NEEDS_REVIEW` — spec changed, phase scope may be stale
> `❌ blocked` — cannot proceed, see Blockers section
>
> **Impl By:** `🤖 agent` · `—` (not yet started)

---

## Phase Status

| Phase    | Status     | Tag    | Gate | Impl By | Notes |
|----------|------------|--------|------|---------|-------|
| PHASE_01 | ✅ done | v0.01.0 | ✅ | 🤖 agent | Scaffold |
| PHASE_02 | ✅ done | v0.02.0 | ✅ | 🤖 agent | ML core |
| PHASE_03 | ✅ done | v0.03.0 | ✅ | 🤖 agent | Quality toggle & design system |
| PHASE_04 | ✅ done | v0.04.0 | ✅ | 🤖 agent | Home page UI |
| PHASE_05 | ✅ done | v0.05.0 | ✅ | 🤖 agent | Analytics |
| PHASE_06 | ✅ done | v0.06.0 | ✅ | 🤖 agent | SEO layer |
| PHASE_07 | ✅ done | v0.07.0 | ✅ | 🤖 agent | Manual mask correction |
| PHASE_08 | ✅ done | v0.08.0 | ✅ | 🤖 agent | Correction editor hardening |
| PHASE_09 | ✅ done | v0.09.0 | ✅ | 🤖 agent | Correction zoom & pan |
| PHASE_10 | ✅ done | v0.10.0 | ✅ | 🤖 agent | Batch processing |

<!-- Add new rows here via /phase-init N -->

---

## Current Contract

> Technical contract as of the latest completed phase. Append-only — never remove an entry unless
> `SPEC.md` explicitly removes it (via `/spec-sync`). Updated by `/spec-sync` (on contract-changing
> spec edits) and `/context-update` (on phase completion).

**Phase completed:** `10` · **Phase in progress:** `—`

**Stack:** see [docs/STACK.md](./STACK.md)

### Core Models

```ts
// src/entities/processed-image/model/types.ts — Phase 02, per SPEC.md §2.2

type QualityMode = "fast" | "max";
type InferencePath = "webgpu" | "wasm";

interface DeviceCapabilities {
  inferencePath: InferencePath;       // via navigator.gpu.requestAdapter()
  defaultQualityMode: QualityMode;    // downgraded to "fast" on weak devices
}

interface SourceImage {
  blob: Blob;
  width: number;
  height: number;
  format: "image/jpeg" | "image/png" | "image/webp";
}

interface AlphaMatte {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

interface ProcessedImage {
  source: SourceImage;
  result: Blob;              // composited PNG-with-alpha, produced via OffscreenCanvas
  qualityMode: QualityMode;
}
```

```ts
// src/features/quality-mode-toggle/model/use-quality-mode.ts — Phase 03, per SPEC.md §3
// QualityMode itself already exists (entities/processed-image, Phase 02); this hook reads/writes
// it against localStorage.

function useQualityMode(defaultMode: QualityMode): {
  qualityMode: QualityMode;
  setQualityMode: (mode: QualityMode) => void;
};
```

```ts
// src/features/upload-image/model/types.ts — Phase 04, per SPEC.md §1.3, §7.3
// Validates + downscales a raw File into the existing SourceImage entity
// (entities/processed-image, Phase 02) — reuses that type rather than inventing a parallel one.

type UploadErrorCode =
  | "unsupported-format"          // SPEC.md §7.3: clear error, unsupported format
  | "exceeds-size-limit"          // SPEC.md §1.3: 20 MB hard limit
  | "exceeds-resolution-limit";   // SPEC.md §1.3: >4096px longest side (downscaled, not rejected;
                                  // this code stays in the union but is never actually constructed)

interface UploadValidationError {
  code: UploadErrorCode;
  message: string;                // human-readable, states the exact limit (SPEC.md §7.3)
}

type UploadResult =
  | { ok: true; image: SourceImage }
  | { ok: false; error: UploadValidationError };

function validateAndPrepareUpload(file: File): Promise<UploadResult>;
```

```tsx
// src/entities/processed-image/ui/BeforeAfterSlider.tsx — Phase 04, per SPEC.md §5.2
interface BeforeAfterSliderProps {
  before: SourceImage;   // original upload (entities/processed-image, Phase 02)
  after: Blob;           // ProcessedImage.result — composited PNG-with-alpha (Phase 02)
  alt?: string;
}
```

```ts
// src/shared/lib/analytics/types.ts + track-event.ts — Phase 05, per SPEC.md §7.6
type AnalyticsEvent =
  | "model_load_started"
  | "model_load_completed"
  | "model_load_failed"
  | "processing_started"
  | "processing_completed"
  | "processing_failed"
  | "download_clicked"
  | "webgpu_unavailable_fallback";

// Aggregate counters only — no PII, no image data, no per-image linkage (SPEC.md §1.1, §7.6).
// No-op safe when window.umami hasn't loaded yet (dev/test).
function trackEvent(event: AnalyticsEvent, data?: Record<string, string | number | boolean>): void;
```

```ts
// src/entities/processed-image/model/mask-correction.ts — Phase 07, per SPEC.md §2.2, §5.2
// Manual mask correction: pure brush primitives + patch-based gesture deltas.

type BrushMode = "add" | "erase" | "restore";

interface BrushStroke {
  points: { x: number; y: number }[];  // source-image pixel coordinates
  radius: number;                      // brush size, source-image pixels
  hardness: number;                    // 0–1, edge softness of the brush stamp
  mode: BrushMode;
}

// Reference implementation (pure/immutable); `restore` reads back from `original` (the
// pre-correction matte produced by inference) rather than clearing to 0/255.
function applyBrushStroke(matte: AlphaMatte, original: AlphaMatte, stroke: BrushStroke): AlphaMatte;

// Live-paint path: in-place alpha stamp on an RGBA buffer, returns the touched box.
function stampBrushAlphaInPlace(
  rgba: Uint8ClampedArray, originalAlpha: Uint8ClampedArray,
  width: number, height: number,
  center: { x: number; y: number }, radius: number, hardness: number, mode: BrushMode,
): BrushBoundingBox | null;

interface BrushBoundingBox { minX: number; maxX: number; minY: number; maxY: number }

// One committed gesture as a delta — undo/redo history stores these, O(stroke area) each; no
// changing multi-MB buffer ever crosses a React prop/state boundary (PHASE_07 R4).
interface MaskPatch {
  box: BrushBoundingBox;
  before: Uint8ClampedArray;  // alpha of `box`, row-major, pre-gesture
  after: Uint8ClampedArray;   // alpha of `box` post-gesture
}

function unionBoundingBox(a: BrushBoundingBox | null, b: BrushBoundingBox | null): BrushBoundingBox | null;
function extractAlphaRegion(rgba: Uint8ClampedArray, imageWidth: number, box: BrushBoundingBox): Uint8ClampedArray;
function writeAlphaRegion(rgba: Uint8ClampedArray, imageWidth: number, box: BrushBoundingBox, alpha: Uint8ClampedArray): void;
```

```ts
// src/features/correct-mask/ui/MaskCorrectionCanvas.tsx — Phase 07 (R4)
// Imperative channel for undo/redo + final matte readout — deliberately a ref API, not props.
interface MaskCanvasHandle {
  applyPatch(box: BrushBoundingBox, alpha: Uint8ClampedArray): void; // undo → patch.before, redo → patch.after
  extractMatte(): AlphaMatte | null;                                 // read once, on Done
}
```

```ts
// src/features/batch-processing/model/types.ts — Phase 10, per SPEC.md §2.2, §5.2–§5.4

type BatchItemStatus = "queued" | "model-loading" | "processing" | "result" | "error";
type ProcessingStage = "queued" | "preparing" | "inference" | "compositing" | "complete";

interface ModelLoadProgress {
  status: "idle" | "checking-cache" | "downloading" | "building-session" | "ready";
  percent: number | null;
  loadedBytes: number;
  totalBytes: number | null;
  fromCache: boolean | null;
}

interface ItemProcessingProgress {
  stage: ProcessingStage;
  startedAt: number | null;
  elapsedMs: number;
  percent: null;
}

interface BatchItem {
  id: string;
  originalFileName: string;
  source: SourceImage;
  qualityMode: QualityMode;
  alphaMatte?: AlphaMatte;
  processedImage?: ProcessedImage;
  status: BatchItemStatus;
  error?: string;
  enqueuedAt: number;
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
```

### Analytics Events

> Umami custom events (SPEC.md §7.6), client-fired only — not part of this app's own server
> contract (see Active Endpoints below).

| Event | Fired from | Purpose |
|-------|-----------|---------|
| `model_load_started` | `useBackgroundRemoval` on `SELECT_FILE` (idle/error → model-loading) | Model-load drop-off rate |
| `model_load_completed` | `useBackgroundRemoval` on `MODEL_READY` | Model-load drop-off rate |
| `model_load_failed` | `useBackgroundRemoval` on `FAILED` while status was `model-loading` | Model-load drop-off rate |
| `processing_started` | `useBackgroundRemoval` on `START_PROCESSING` | Core product completion metric |
| `processing_completed` | `useBackgroundRemoval` on `PROCESSING_SUCCEEDED` | Core product completion metric |
| `processing_failed` | `useBackgroundRemoval` on `FAILED` while status was `processing` | Core product completion metric |
| `download_clicked` | `DownloadResultButton` click handler | Funnel's final conversion |
| `webgpu_unavailable_fallback` | `detectDeviceCapabilities` when WebGPU adapter request fails/unsupported | WASM fallback frequency |

### Active Endpoints

| Method | Path | Auth | Response / Payload |
|--------|------|------|---------------------|
| `GET` | `/` | none | SSR HTML page shell rendering the full `pages/home` composition (upload → process → download flow, Phase 04) |
| `GET` | `/dev/remove-background` | none | SSR HTML shell hosting the isolated `remove-background` test harness (`<div data-testid="remove-background-test-harness">`). Undesigned, `noindex`, dev-only — not a launch page (SPEC.md §5.1) |
| `GET` | `/udalit-fon-s-foto-tovara`, `/udalit-fon-s-foto-na-dokumenty`, `/udalit-fon-s-logotipa`, `/udalit-fon-dlya-avatarki` | none | SSR HTML: scenario-specific `pages/*` composition of the same upload → quality-toggle → remove-background → download flow as `/`, plus scenario copy, `HowTo` JSON-LD, and a static before/after example image (Phase 06, SPEC.md §5.1, §7.5) |
| `GET` | `/about` | none | SSR HTML: static project/tech/author info, no upload tool (Phase 06, SPEC.md §5.1) |
| `GET` | `/sitemap.xml` | none | Generated at build time by `scripts/generate-sitemap.ts` from the `routes/` tree, excludes `/dev/remove-background` (Phase 06, SPEC.md §7.5) |
| `GET` | `/robots.txt` | none | Static, fully open, links to `/sitemap.xml` (Phase 06, SPEC.md §7.5) |

### DB Schema

- Tables: none yet.
- Current migration head: `—`
- Client-side Cache Storage (`public/sw.js`, cache-first, content-hashed, added Phase 02): ONNX model weights (`onnx-community/ISNet-ONNX`, `q8`/`fp32` dtype variants — replaces the original `BiRefNet_lite`/`BiRefNet` pair per the 2026-07-10 model-swap decision below) and ONNX Runtime WASM binaries.
- Client-side `localStorage` (added Phase 03): `qualityMode: "fast" | "max"` — persisted across visits, no other user data stored client-side (SPEC.md §3).
- `umami-db` (Postgres, added Phase 05): Umami's own internal schema, managed entirely by the Umami container image — not owned by this app; this app's contract still has no server-side persistent store (SPEC.md §3).

### UI Pages

- `/` — full `pages/home` composition (Phase 04): upload (`features/upload-image`) → quality toggle
  (`features/quality-mode-toggle`, Phase 03) → processing (`features/remove-background`, Phase 02)
  → `BeforeAfterSlider` result view → download (`features/download-result`). Replaces the Phase 01
  hello-world placeholder.
- `/dev/remove-background` — undesigned ML pipeline test harness (Phase 02); exercises upload → both models load → inference → result end to end ahead of the real UI landing in Phase 04.
- `/udalit-fon-s-foto-tovara`, `/udalit-fon-s-foto-na-dokumenty`, `/udalit-fon-s-logotipa`,
  `/udalit-fon-dlya-avatarki` — scenario-specific `pages/*` slices (Phase 06): the same reused
  upload/quality-toggle/remove-background/download features as `/`, wrapped in scenario copy
  (bilingual — Russian primary, English subtitle) and a static before/after example image.
- `/about` — static project/tech/author info (Phase 06); no upload tool.

### Env Config

| Key | Example value | Required |
|-----|---------------|----------|
| `PORT` | `3000` | no — Nitro `node-server` preset default |
| `NODE_ENV` | `production` | no — standard Node convention for the container build |
| `VITE_MODEL_CDN_BASE_URL` | `https://cdn.cutbg.art/models` | required for production builds (Docker build arg once R2 is populated); unset in local dev — worker falls back to Transformers.js's own upstream defaults (SPEC.md §6, §6.1) |
| `VITE_UMAMI_SCRIPT_URL` | `https://cutbg.art/script.js` | required for production (Phase 05); unset in dev disables script injection |
| `VITE_UMAMI_WEBSITE_ID` | `3b1e...uuid` | required for production (Phase 05) |
| `VITE_CF_BEACON_TOKEN` | `abc123token` | required for production (Phase 05, Cloudflare Web Analytics beacon) |
| `UMAMI_APP_SECRET` | `<random 32+ char secret>` | required — `umami` container's own env, docker-compose only (Phase 05) |
| `UMAMI_DATABASE_URL` | `postgresql://umami:***@umami-db:5432/umami` | required — `umami` container's own env, docker-compose only (Phase 05) |
| `POSTGRES_PASSWORD` | `<random secret>` | required — `umami-db` container's own env, docker-compose only (Phase 05) |

### DB Seeds

None yet.

---

## Active Blockers

<!-- Format: PHASE_XX [YYYY-MM-DD]: description — who must resolve it -->

None

---

## Project Log

> Append-only, newest entry first. One entry format for everything that used to be split across
> `CHANGELOG.md` entries, `DECISIONS.md` ADRs, and the old "Expert Feedback Log" / "Rollback
> Notes" sections. Never delete an entry — if a decision is superseded, add a new entry that says
> so and leave the old one in place.

## 2026-07-12 — Phase 10 complete

**Type**: phase-completion
**Author**: AI (context-update)
**Triggered by**: PHASE_10 gate passed

### Changes / Decision
- Added an in-memory multi-image batch session with stable item identity, FIFO scheduling, isolated
  failures, and bounded inference concurrency (WebGPU: 2; WASM: 1).
- Added truthful shared model-loading and per-item processing progress, reusable item review and mask
  correction, per-item PNG downloads, and client-generated pass-through ZIP downloads.
- Added editor-scoped undo/redo shortcuts and capped the source-space brush footprint at about
  `150 × 150 px`.
- Added unit/integration and cross-browser Playwright coverage for the Phase 10 flows; no server
  endpoint, persistence, analytics event, or environment variable was added.

### Affected Phases / Consequences
- PHASE_11 may build background replacement on the completed batch/item result contract.
- No breaking contract change; the Phase 10 additions are client-side and additive.

## 2026-07-12 — Phase 10 batch runtime decisions

**Type**: decision
**Author**: AI (architect-delegated research)
**Triggered by**: Architect delegated the Phase 10 ZIP library, bounded-concurrency, and stable-item
identity decisions after `/phase-init 10` left them for verification.

### Changes / Decision
- Use `client-zip@^2.5.0` for download-all. It is browser-focused, dependency-free, ships TypeScript
  declarations, accepts streaming/Blob-like inputs, and deliberately stores rather than recompresses
  entries. Phase 10 outputs are already-compressed PNGs, so `fflate`/`zip.js` compression features
  would add CPU, memory, and API surface without material archive-size benefit. Because the app is
  SSR-rendered, load `client-zip` only inside the browser download action, not in the server graph.
- Use adaptive inference concurrency: maximum `2` active jobs on WebGPU and `1` on WASM. This keeps
  bounded parallelism on capable devices while avoiding duplicated memory pressure on the fallback
  path. Queue order is FIFO; failure always releases a slot. Phase 10 exposes a live, item-derived
  scheduler summary (path, active/limit, queued, done, failed, total) and keeps transient per-item
  queue/processing timestamps for local diagnostics only; none of this metadata is persisted or
  sent to analytics.
- Give every `BatchItem` a stable `crypto.randomUUID()` at enqueue time and retain its original
  filename separately. Selection and React keys use the UUID, never array position or filename;
  sanitized duplicate download names receive numeric suffixes.
- Surface Transformers.js aggregate model-loading progress as real percent and transferred/total
  MiB when `progress_total.loaded/total` are available, with explicit cache-check, download,
  ONNX-session-build, and ready stages. ONNX inference exposes no reliable completion percentage,
  so per-item processing shows stage + elapsed time with an indeterminate indicator and never
  simulates percentage progress.

### Affected Phases / Consequences
- PHASE_10 — the three `[TODO: verify]` markers are resolved; tests must cover both scheduler limits,
  slot release after failure, stable identity, filename collision handling, and ZIP contents.
- `docs/STACK.md` now records `client-zip` as the client-side ZIP dependency.
- No server endpoint, persistence, environment variable, or privacy-contract change.

## 2026-07-11 — Spec change: point-prompt/SAM removed from MVP; batch/background renumbered

**Type**: spec-change
**Author**: AI (spec-sync)
**Triggered by**: Architect request — brush correction covers roughly 80% of real correction
scenarios, so spending current MVP time on Point-prompt / SAM mask correction is not worthwhile.

### Changes / Decision
- Supersedes the previous 2026-07-11 spec-change entry only for Point-prompt / SAM scope.
- `SPEC.md` §8: removed the planned "Point-prompt / SAM mask correction" phase from MVP.
- `SPEC.md` §8: Phase `10` is now Batch processing, Phase `11` is Background replacement, and
  Phase `12` is Hardening & Launch.
- `SPEC.md` §1.3, §2.1, §2.2, §3, §5.2, §5.3, §6, §6.1, §7.3, §7.7, and §10: removed
  Point-prompt / SAM-specific model, state-machine, feature-slice, error-handling, testing, cache,
  and open-question requirements from current MVP scope.
- `SPEC.md` §9: returned Point-prompt / SAM-style mask correction to backlog v2+ as deliberately
  deferred, not rejected.
- Document Version `v1.3` → `v1.4`.
- No change to `docs/STATE.md` § Current Contract — nothing shipped changed; the removed phase was
  not scaffolded.

### Affected Phases / Consequences
- PHASE_01–PHASE_07 — unaffected (`✅ done`, no contracts of already-shipped phases changed).
- PHASE_08 and PHASE_09 — unaffected future phases from the existing plan.
- Future PHASE_10–PHASE_12 should be initialized from the updated `SPEC.md` numbering:
  `10` = Batch processing, `11` = Background replacement, `12` = Hardening & Launch.
- No `docs/PHASE_*.md` files were patched because PHASE_08+ files do not exist yet.

## 2026-07-11 — Spec change: three backlog v2+ items pulled into MVP as Phases 10-12 (point-prompt/SAM correction, batch processing, background replacement); Hardening & Launch renumbered to 13

**Type**: spec-change
**Author**: AI (spec-sync)
**Triggered by**: Architect review of §9 Out of Scope — confirmed point-prompt/SAM-style mask
correction is a genuinely complementary tool to the Phase 07 brush (fast whole-region selection /
better complex-boundary handling vs. manual pixel painting), not a replacement, and decided to pull
it into MVP alongside batch processing and background replacement, all before the final launch
phase. Ordering and feature shape confirmed via `AskUserQuestion`.

### Changes / Decision
- `SPEC.md` §8: three new phases inserted before the final phase, in architect-chosen order:
  - Phase `10` — Point-prompt/SAM mask correction: a "smart-select" mode inside the existing
    `features/correct-mask` slice/`correcting` state, alongside (not replacing) the brush modes;
    commits into the same undo/redo history as brush strokes; needs one new client-side segmentation
    model (exact repo left `[NEEDS_CLARIFICATION]`, §6/§10 — to be settled at Phase 10 `/phase-init`,
    same process used for the IS-Net model choice).
  - Phase `11` — Batch processing: parallel upload/processing of multiple images (bounded
    concurrency, §7.1), grid/tile overview with per-item status, selecting an item reuses the
    existing single-image `result`⇄`correcting` flow unchanged (no parallel state machine),
    per-item or "download all as ZIP" (client-side library, `[NEEDS_CLARIFICATION]`).
  - Phase `12` — Background replacement: `BackgroundFill` (solid color / linear-or-radial gradient /
    user-uploaded image), composited via the existing `OffscreenCanvas` pipeline; uploaded background
    image stays client-side only, same privacy invariant as `SourceImage`.
  - Old Phase `08` "Hardening & Launch" → renumbered to Phase `13`, content unchanged.
- `SPEC.md` §1.3: the three items moved from the Excluded/backlog-v2 column into Included (MVP),
  each with a one-line description and its new phase number.
- `SPEC.md` §2.1: `Visitor` role capabilities/restrictions updated (batch upload, mask correction via
  brush and/or point-prompt, background replacement, ZIP download; dropped the stale
  "cannot batch-process" restriction).
- `SPEC.md` §2.2: new `BatchSession`/`BatchItem` and `BackgroundFill` entities; `AlphaMatte` bullet
  extended to describe the point-prompt "smart-select" mode.
- `SPEC.md` §3, §4: reaffirmed the client-side-only/no-server-endpoint invariant explicitly covers
  batch sessions, ZIP assembly, and uploaded background images — nothing new touches the server.
- `SPEC.md` §5.1, §5.2, §5.3, §5.4: no new routes or top-level UI states — batch mode is entered by
  dropping/selecting multiple files on the existing upload surface; background-fill selection and
  per-item batch review live inside the existing `result`/`correcting` states; accessibility bullets
  added for batch grid navigation and the background-fill controls.
- `SPEC.md` §6, §6.1: infrastructure rows added for the Phase 10 segmentation model and Phase 11 ZIP
  library (both `[NEEDS_CLARIFICATION]` pending real evaluation), following the same
  cache-independently-per-first-use pattern as the existing IS-Net weights.
- `SPEC.md` §7.1, §7.3, §7.7: new NFR/error-handling/testing rows for bounded batch concurrency,
  per-item batch error isolation, degenerate point-prompt selections, and e2e coverage for all three
  new features.
- `SPEC.md` §9: the three items removed from backlog v2+ with a pointer to this entry; remaining
  backlog is Accounts/processing-history/cloud-storage, Public API, Mobile app.
- `SPEC.md` §10: three new open questions (exact SAM model repo, exact ZIP library, batch concurrency
  limit) — all explicitly deferred to their respective phase's `/phase-init`, not guessed here.
- Document Version `v1.2` → `v1.3` (see Metadata; date unchanged, same day).
- No change to `docs/STATE.md` § Current Contract — nothing shipped changed; none of Phases
  08-13 are scaffolded yet.

### Affected Phases / Consequences
- PHASE_01–PHASE_07 — unaffected (`✅ done`, no contracts of already-shipped phases changed).
- PHASE_08, PHASE_09 (already spec'd, not yet scaffolded — previous entry below) — unaffected in
  content; only the phases after them shifted.
- PHASE_10, PHASE_11, PHASE_12, PHASE_13 — not yet scaffolded; the next `/phase-init` beyond 09
  should target this entry's §8 numbering, not the prior two-phase tail.
- Recommended sequencing note (not enforced by tooling): Phase 10's point-prompt mode extends the
  same `MaskCorrectionCanvas`/`MaskPatch` history that Phase 08 restructures and Phase 09 adds
  zoom/pan to — build order 08 → 09 → 10 avoids rework, consistent with the phase numbering itself.

## 2026-07-11 — Spec change: Phase 07 hardening carve-out (new Phase 08) + correction zoom/pan (new Phase 09); old Phase 08 renumbered to 10

**Type**: spec-change
**Author**: AI (spec-sync)
**Triggered by**: Architect request — Phase 07's residual architectural debt (`PHASE_07.md` §
Implementation Notes: stroke interpolation, large-brush O(r²) stamp cost, main-thread
extractAlphaMatte/recomposite+PNG-encode on Edit/Done, duplicate `getBoundingClientRect` reads, the
react-dom 19.2 dev-perf-track freeze, and the Phase 06 scenario-page hydration race) should be
closed out as its own phase before adding new correction-editor functionality, and the architect
wants to schedule zoom/pan for the correction canvas next as a distinct feature phase.

### Changes / Decision
- `SPEC.md` §8: new Phase `08` = "Correction editor hardening" — folds in every residual item listed
  in `PHASE_07.md` § Implementation Notes (stroke interpolation, brush-stamp LUT, worker offload of
  Edit/Done compositing, cached `getBoundingClientRect`, react-dom 19.3 upgrade, Phase 06 scenario-page
  hydration-race fix). Purely a hardening/perf/robustness phase — no new externally observable
  behavior, so no new Contracts beyond what Phase 07 already recorded.
- `SPEC.md` §8: new Phase `09` = "Correction zoom & pan" — zoom/pan controls scoped to the existing
  `correcting` state, precise editing on high-resolution images; no new top-level UI state.
- `SPEC.md` §8: old Phase `08` ("Hardening & Launch") renumbered to Phase `10`, unchanged in content.
- `SPEC.md` §1.3, §5.2, §5.3, §5.4, §7.7 updated to describe the new zoom/pan capability (Phase 09):
  correction-canvas zoom/pan added to the MVP boundaries row, `features/correct-mask`'s
  responsibility note, the `correcting` state description (view-only transform, brush coordinates
  stay in source-image pixel space), a new accessibility bullet (keyboard-operable zoom, `aria-live`
  level announcement), and a new mandatory e2e coverage row.
- Document Version `v1.1` → `v1.2`.
- No change to `docs/STATE.md` § Current Contract — nothing shipped changed; neither new phase is
  scaffolded yet.

### Affected Phases / Consequences
- PHASE_01–PHASE_07 — unaffected (`✅ done`, no contracts of already-shipped phases changed).
- PHASE_08, PHASE_09, PHASE_10 — not yet scaffolded; the next `/phase-init` should target the new
  §8 phase table as of this entry (`08` = Correction editor hardening, `09` = Correction zoom & pan,
  `10` = Hardening & Launch), not the old two-phase numbering.
- Phase 08 should be scaffolded and gated before Phase 09 starts (Phase 09's zoom/pan touches the
  same `MaskCorrectionCanvas` that Phase 08 restructures for worker-offloaded compositing and
  patch-based history — sequencing avoids rework).

## 2026-07-11 — Phase 07 complete + R4: pointer-up freeze root-caused to react-dom dev build; patch-based history

**Type**: bugfix + decision (supersedes the diagnosis in the next entry, "Phase 07 follow-up:
pointer-up freeze in mask correction")
**Author**: `v.godlevskiy` (via AI agent)
**Triggered by**: the ~1-2s freeze on every brush-stroke pointer-up survived the previous entry's
`appliedMatteRef` fix — reproduced on a 1024x1024 (1MP) image and profiled against a live
`pnpm dev` session.

### Changes / Decision
- **The previous diagnosis was wrong.** The redundant resync/repaint it eliminated was real but
  cost ~50ms; the freeze was a 1.0-1.4s main-thread long task inside *react-dom's development
  build*: React 19.2's Component Performance Track deep-diffs every changed prop object per render
  (`logComponentRender` → `addObjectDiffToProperties`), and a changing `matte: AlphaMatte` prop
  made it enumerate the megapixel `Uint8ClampedArray` element-by-element via `for..in`, twice per
  commit. App code measured ~3ms. Production builds are unaffected; upstream fixed it in react-dom
  19.3 canary (`ArrayBuffer.isView` guard), not in stable 19.2.x. Same freeze applied to every
  Undo/Redo click. Recorded as a reusable pitfall in `docs/KNOWN_GOTCHAS.md`.
- **Fix (architectural, not a workaround)**: no changing multi-MB object crosses a React
  prop/state boundary in the correction flow anymore. A gesture commits a `MaskPatch` delta
  (dirty box + before/after alpha bytes, O(stroke area)); `useMaskCorrection`'s undo/redo history
  stores patches instead of full-matte snapshots and writes them back through the canvas's new
  imperative `MaskCanvasHandle.applyPatch`; "Done" reads the final matte once via `extractMatte`.
  `MaskCorrectionCanvas`'s props are all identity-stable during editing (`initialMatte` replaces
  the old `matte` prop, read once per source decode); the `[matte]` resync effect and
  `appliedMatteRef` are gone.
- Side benefits: history memory drops from up to 20 full mattes (~320MB at the 4096² input limit)
  to stroke-sized patches; pointer-up cost drops from O(image) to O(stroke box); `pointercancel`
  now reverts an aborted gesture's stamps (previously lingered uncommitted); empty gestures no
  longer push undo steps.
- Verified: CPU profile after the change shows **zero** >50ms long tasks on stroke release and on
  undo/redo (was 1.0-1.4s per release); full unit suite, `tsc`, `eslint`, and
  `e2e/mask-correction.spec.ts` (real inference) green.

### Affected Phases / Consequences
- No SPEC.md/API/schema changes — the correction feature's externally observable behavior is
  identical; `MaskPatch`/`MaskCanvasHandle` are recorded in PHASE_07.md Contracts and the Current
  Contract above.
- Residual follow-ups (stroke interpolation, large-brush stamp LUT, worker offload of Edit/Done
  compositing, react-dom 19.3 upgrade when stable, scenario-page hydration race) are listed in
  PHASE_07.md § Implementation Notes so they aren't rediscovered from scratch.

## 2026-07-11 — Phase 07 follow-up: pointer-up freeze in mask correction

**Type**: bugfix
**Author**: `v.godlevskiy` (via AI agent)
**Triggered by**: manual `pnpm dev` testing after the R1–R3 Architect Review Notes fix (previous
entry) — dragging the brush was smooth, but releasing the mouse button froze for ~1-2s on realistic
image sizes.

### Changes / Decision
- Root cause: `MaskCorrectionCanvas`'s `[matte]` sync effect couldn't tell "this prop change is our
  own commit echoing back down" apart from "this is a genuine external change" (undo/redo) — every
  stroke commit triggered a second, fully redundant full-buffer alpha resync plus a full-canvas
  `putImageData`, on top of the dirty-rect repaints the drag itself had already done. `putImageData`
  over a full-resolution photo is the expensive part and is what produced the freeze.
- Fixed with an `appliedMatteRef` tracking which `AlphaMatte` object is currently reflected in the
  live buffer (set on decode and on every commit); the sync effect now bails out immediately when
  the incoming `matte` prop is that same object reference, and only pays for the full resync/repaint
  on genuine external changes (undo/redo still work as before). Also cached the 2D context with
  `willReadFrequently: true`, since this component calls `getImageData`/`putImageData` continuously
  by design — a standard mitigation for GPU-readback stalls in canvas-heavy pixel editors.
- Regression test added in `MaskCorrectionCanvas.test.tsx` that round-trips a committed matte back in
  as the next prop (mirroring the real `useMaskCorrection` data flow, which the existing tests didn't
  exercise) and asserts no extra `putImageData` call fires.

### Affected Phases / Consequences
- No SPEC.md/API/schema changes — implementation-detail performance fix within Phase 07's existing
  contract, same as R3.

## 2026-07-11 — Phase 07 Architect Review Notes: hydration race, brush cursor/UX, brush performance

**Type**: bugfix + decision
**Author**: `v.godlevskiy` (via AI agent)
**Triggered by**: manual `pnpm dev` testing of Phase 07's initial Scope implementation surfaced
three issues, resolved via `/impl-assist 07 review` (R1–R3).

### Changes / Decision
- **R1 (pre-existing, cross-cutting, predates Phase 07)**: the very first upload attempt right
  after a page load could silently do nothing — a real hydration race (SSR markup painted before
  React finishes attaching `UploadDropzone`/`ChoosePhotoButton`'s handlers), the same class of bug
  `docs/KNOWN_GOTCHAS.md` already documented for Playwright automation, but reproducible by a real
  user. Fixed only on `pages/home/ui/HomePage.tsx` (a `hydrated` flag gates the upload controls'
  `disabled` prop until a `useEffect` confirms hydration) — the Phase 06 scenario pages almost
  certainly have the same latent issue but are Phase 07's explicit "Do NOT touch" scope; flagged as
  a follow-up, not fixed here.
- **R2/R3**: `features/correct-mask`'s brush tool had no visible size indicator and stuttered on
  anything larger than the e2e fixture's 1x1 placeholder image. Root-caused to
  `useMaskCorrection`/`MaskCorrectionCanvas` doing O(image size) array clones and full-canvas
  repaints on every single pointer-move point. Re-architected: `MaskCorrectionCanvas` now owns a
  persistent `ImageData` buffer mutated in place per point (new `stampBrushAlphaInPlace` in
  `entities/processed-image`) and repaints only the touched bounding box; `useMaskCorrection` was
  simplified to a single `commitStroke(matte)` call per whole gesture instead of a
  begin/add/end-per-point trio, restoring undo/redo to "one gesture, one history entry" without the
  per-point cost. Added a mode-tinted (green/red/blue) brush-size cursor overlay and plain-language
  mode descriptions in the toolbar for the UX gap.
- Verifying the R3 fix via real e2e (not the mocked unit tests) surfaced a second, test-only issue:
  the toolbar's mode-description text reflows the page enough on a mode-button click to scroll the
  canvas out of the viewport before the next drag reads its position — fixed in
  `e2e/mask-correction.spec.ts` (`scrollIntoViewIfNeeded()` before every drag) and recorded in
  `docs/KNOWN_GOTCHAS.md` as a reusable Playwright pitfall.

### Affected Phases / Consequences
- No SPEC.md/API/schema changes — all three notes were implementation-detail and UX fixes within
  Phase 07's existing contract.
- Follow-up not yet scheduled: Phase 06 scenario pages (`pages/product-photo`,
  `pages/document-photo`, `pages/logo`, `pages/avatar`) likely share R1's hydration race on their
  own upload controls; worth its own pass rather than silently bundling into a future phase.

## 2026-07-11 — Spec change: manual mask correction pulled into MVP as new Phase 07

**Type**: spec-change
**Author**: AI (spec-sync)
**Triggered by**: Architect request — the tool isn't fully usable end-to-end without a way to fix
model mistakes on real photos; deferring this to backlog v2 no longer made sense pre-launch.

### Changes / Decision
- `SPEC.md` §1.3: "Manual mask correction (brush add/erase/restore)" moved from Excluded (backlog
  v2) into Included (MVP).
- `SPEC.md` §2.2: `AlphaMatte` is now documented as user-correctable post-inference — brush
  add/erase/restore-to-model-output, adjustable brush size/hardness, undo/redo. Corrections mutate
  the in-memory `AlphaMatte` only; nothing new is persisted or leaves the device (§1.1 invariant
  unaffected).
- `SPEC.md` §5.2: new feature slice `features/correct-mask` — reuses the existing
  `OffscreenCanvas` compositing pipeline in `features/remove-background`; no new ML model, no new
  inference pass.
- `SPEC.md` §5.3: new `correcting` state, reachable from and returning to `result`.
- `SPEC.md` §7.7: new mandatory e2e coverage row for the correction flow.
- `SPEC.md` §8: renumbered. New Phase `07` = "Manual mask correction". Old Phase `07`
  (Cross-browser hardening) and old Phase `08` (Launch) merged into new Phase `08` = "Hardening &
  Launch".
- `SPEC.md` §9: backlog v2+ now lists "Point-prompt / SAM-style mask correction" (click-based,
  heavier model) as the deferred follow-up technique, distinct from the brush-based correction
  that moved to MVP.
- Document Version `v1.0` → `v1.1`, Date → `2026-07-11`.
- No change to `docs/STATE.md` § Current Contract — nothing shipped changed; Phase 07's actual
  code contract will be recorded by `/context-update` once that phase is implemented.

### Affected Phases / Consequences
- PHASE_01–PHASE_06 — unaffected (`✅ done`, no contracts of already-shipped phases changed).
- PHASE_07, PHASE_08 — not yet scaffolded; the next `/phase-init` should target the new §8 phase
  table as of this entry (`07` = Manual mask correction, `08` = Hardening & Launch), not the old
  Cross-browser-hardening/Launch split.

---

## 2026-07-11 — Phase 06 complete

**Type**: phase-completion
**Author**: AI (context-update)
**Triggered by**: PHASE_06 gate passed (type-check, unit tests, Steiger arch lint, Docker
bootstrap/smoke, and the full `pnpm e2e` cross-browser matrix — chromium/webkit/Mobile Safari,
45/45 — all green) and committed

### Changes / Decision
- Four scenario `pages/*` slices (`product-photo`, `document-photo`, `logo`, `avatar`) added under
  `/udalit-fon-s-foto-tovara`, `/udalit-fon-s-foto-na-dokumenty`, `/udalit-fon-s-logotipa`,
  `/udalit-fon-dlya-avatarki` — each composes the same reused upload/quality-toggle/
  remove-background/download features as `pages/home` (`pages/home` itself untouched), wrapped in
  scenario-specific copy and a static before/after example image. No new product logic.
- Copy language (SPEC.md §10 left this an open question): resolved as bilingual — Russian
  `<h1>`/body copy matching the Russian URL slugs' search intent, plus an English subtitle. `/about`
  (new static `pages/about` slice: project/tech/author info, no upload tool) stays English-only.
- `shared/lib/seo` (`json-ld.ts`): `SITE_URL` constant (`https://cutbg.art`) plus
  `buildWebApplicationJsonLd`/`buildHowToJsonLd` builders. JSON-LD is emitted via each route's
  `head().scripts` (TanStack Router's documented inline `application/ld+json` pattern) — `HowTo` on
  the four scenario routes, `WebApplication` added to `routes/index.tsx`'s `head()` only (verified
  `pages/home/ui/HomePage.tsx` itself has zero diff this phase).
- `scripts/generate-sitemap.ts` walks `src/routes/`, excludes the `dev/` test harness by filename
  convention, and writes `public/sitemap.xml`; wired into `pnpm build` (`pnpm generate-sitemap &&
  vite build`) so a new route can't be forgotten. `public/sitemap.xml` is gitignored as a build
  artifact. `public/robots.txt` added, fully open, links to the sitemap.
- Before/after example images (`public/images/*.webp`) are procedurally generated placeholder
  graphics (simple shapes rasterized to WebP via a temporary `sharp` dev-dependency, removed again
  after generating the assets) — no real product/document/logo/avatar photography existed in the
  repo. Should be swapped for real photos before relying on these pages for actual search ranking.
- `e2e/scenario-pages.spec.ts` added: per scenario page, a fast render/h1 check and a fast
  upload → model-loading reachability check, plus one full upload → process → download deep check
  on `/udalit-fon-s-foto-tovara` (the full pipeline is already covered end to end by
  `e2e/home.spec.ts`, so it isn't re-run at full cost on every scenario page); `/about` gets a
  render-only check.
- Bug caught during implementation verification (fixed before commit, not left for review): the
  first draft's per-page `aria-live` announcer silently dropped the `RemoveBackgroundState`
  `"error"` status, so screen readers heard nothing on a real processing error. Fixed by routing the
  announcer through the same `displayError` value the visible error banner already uses, on all four
  scenario pages.

### Affected Phases / Consequences
- No changes to `features/upload-image`, `features/remove-background`, `features/quality-mode-toggle`,
  `features/download-result`, or `entities/processed-image` — confirmed reuse-only, per this phase's
  own "Do NOT touch" scope.
- Phase 07 (cross-browser hardening) inherits five new routes; this phase's `pnpm e2e` gate run
  already exercises all of them (plus `/`) across chromium/webkit/Mobile Safari, so Phase 07 is
  real-device hardening of already-passing coverage, not first-time coverage.
- Production deploy has no new required env vars for this phase (Contracts: none) — `SITE_URL` is a
  hardcoded constant (`https://cutbg.art`, matching the domain already used for Umami/CDN), not
  configurable per deployment target.

## 2026-07-10 — Phase 05 gate: e2e regression + pre-existing Mobile Safari test bug fixed

**Type**: bugfix
**Author**: `v.godlevskiy` (via AI agent)
**Triggered by**: running `pnpm e2e` as part of closing out Phase 05 (bundling the analytics work
with the post-IS-Net UX fixes below) surfaced two issues in `e2e/home.spec.ts`'s critical-path spec.

### Changes / Decision
- **Real regression**: the model-loading progress text (`pages/home/ui/HomePage.tsx`) was changed
  to include the active inference path (e.g. "on WASM") inline, which pushed the ellipsis away from
  the literal word "model" — breaking the `/loading .* model…/i` locator the e2e spec uses to
  disambiguate the visible progress text from the (differently worded) `aria-live` announcement.
  Fixed by moving the path label after the ellipsis/percentage instead of between "model" and "…".
  Caught by `chromium`/`webkit` failing identically on the first `pnpm e2e` run after these UX fixes.
- **Pre-existing test bug, newly exposed**: the critical-path spec asserted
  `getByLabel("Upload an image")` (the desktop `UploadDropzone` input) to be `toBeVisible()` after
  resetting back to idle. That input is `hidden … sm:flex` by design — `ChoosePhotoButton` is the
  visible control on narrow viewports (SPEC.md §5.4) — so this assertion was always wrong for the
  `Mobile Safari` project. It never surfaced before because Mobile Safari's run never reached that
  line: BiRefNet's `std::bad_alloc` (see the model-swap entry below) killed the run earlier every
  time. IS-Net finally let Mobile Safari's run complete, exposing the latent assertion bug. Fixed by
  switching to `toBeAttached()`, matching the same locator's existing pattern in the idle-state test
  above it in the same file.

### Affected Phases / Consequences
- Confirms IS-Net (unlike BiRefNet) completes the full critical path on all three configured e2e
  projects (`chromium`, `webkit`, `Mobile Safari`) — the "known environment gap" flagged in Phase
  04's completion entry below is resolved as a side effect of the model swap, not just a headless
  quirk as originally guessed.
- 15/15 e2e tests green across all three projects as of this entry.

## 2026-07-10 — Post-IS-Net UX fixes: before/after preview bug, diagnostic log panel, WebGPU re-enabled

**Type**: bugfix + decision
**Author**: `v.godlevskiy` (via AI agent)
**Triggered by**: manual testing of the IS-Net model swap (previous entry below) surfaced three
issues: the before/after slider never actually revealed the cutout, progress feedback was too
sparse to tell what was happening, and it was unclear which model/path was actually running.

### Changes / Decision
- **Before/after slider bug** (`entities/processed-image/ui/BeforeAfterSlider.tsx`): the "after"
  cutout was stacked directly on top of the unclipped "before" image, so the cutout's transparent
  background just let "before" show through unchanged — the slider visually did nothing. Fixed by
  clipping both images to complementary halves and adding a checkerboard backdrop behind the cutout
  side (standard transparency-preview convention).
- **Diagnostic log panel**: `inference.worker.ts` now forwards per-file `initiate`/`done` progress
  events (previously only the aggregate download percent was surfaced); `useBackgroundRemoval` collects
  these plus state-transition/timing events into a capped `logs` array; `pages/home/ui/ProcessingLog.tsx`
  renders them behind a "Show log" toggle. Also added a persistent status line ("Model: IS-Net (q8) ·
  Running on WebGPU/WASM") so the active model/dtype/path is never a mystery.
- **WebGPU re-enabled**: `device-capabilities.ts`'s `supportsWebGPU()` real adapter/`fp16` probe is
  restored (was hardcoded `false` after the BiRefNet failures). IS-Net is architecturally unrelated to
  BiRefNet's Concat/Split fan-out, so there was no known reason to keep it disabled once the model
  changed. Verified end-to-end in a real (non-headless) Chromium via Playwright automation against a
  production build (`pnpm build` + `.output/server/index.mjs`) — that specific browser had no GPU
  adapter available (`No available adapters`) so it exercised the WASM path, but confirmed the full
  flow, the new log panel, the status line, and the slider fix all work correctly. WebGPU itself
  remains unverified on a real GPU-backed browser in this project — the worker's mid-session
  `isWebGpuExecutionError` → WASM fallback stays in place either way.
- `docs/SPEC.md` §2.2, §6 updated to drop the "WebGPU forced off" language.

### Affected Phases / Consequences
- Supersedes the WebGPU-disabled decision in the previous Project Log entry.
- `pnpm dev`'s Vite dev server was unreliable for this session's own Playwright verification (cold-start
  dependency re-optimization kept forcing full page reloads mid-interaction, discarding file-upload
  automation) — worked around by verifying against a production build instead. Not an app bug; worth
  knowing if `/phase-gate`'s e2e step is ever flaky in a similarly cold environment.

## 2026-07-10 — ML model swap: BiRefNet → IS-Net (both WebGPU and WASM paths were broken)

**Type**: decision
**Author**: `v.godlevskiy` (via AI agent)
**Triggered by**: manual post-Phase-05 testing in a real (non-headless) browser — every attempt to
process an image failed. This turned out to be the same underlying issue Phase 04's completion entry
below already flagged as a "known environment gap" assumed specific to headless e2e browsers; it is
not headless-specific, it reproduces in normal interactive use too.

### Changes / Decision
- Root-caused in two steps:
  1. WebGPU path: BiRefNet's Concat/Split-heavy ONNX graph needs more storage-buffer bindings per
     shader than `maxStorageBuffersPerShaderStage` allows on effectively any device — a confirmed,
     still-open onnxruntime-web limitation (microsoft/onnxruntime#21968), not a per-device fluke.
     First fix attempt: force `inferencePath: "wasm"` in `detectDeviceCapabilities()` rather than
     rely on the existing mid-session catch-and-retry (`isWebGpuExecutionError` in
     `inference.worker.ts`), since the failure is deterministic, not transient.
  2. That surfaced a second, independent failure: BiRefNet's fp32 WASM path hits `std::bad_alloc` —
     wasm32's address-space ceiling colliding with the model's activation-memory footprint (a
     Swin-transformer-backed decoder at a fixed 1024×1024 input). Confirmed not a host-RAM shortage
     (16 GB free). This matches a 2024 comment on the same upstream GitHub issue predicting exactly
     this outcome for BiRefNet specifically.
- Given both execution paths were broken for the *same* model family, not a config/device issue,
  the model itself was replaced: `onnx-community/ISNet-ONNX` (IS-Net, github.com/xuebinqin/DIS) now
  backs both quality tiers, differentiated by dtype (`q8` fast / `fp32` max) instead of by separate
  `_lite`/full model files. IS-Net is a much lighter classic encoder-decoder (no BiRefNet-style
  fan-out) and is natively recognized by Transformers.js's pipeline resolution; verified end-to-end
  (load + inference + correct mask dimensions on a real photo) via a throwaway Node smoke test
  before switching — see `worker/inference.worker.ts`'s top-of-file comment for the full rationale.
- WebGPU stays **forced off** (`supportsWebGPU()` hardcoded `false`) even after the model swap — IS-Net
  not sharing BiRefNet's specific failure mode is a reasonable bet, not a verified fact (no real GPU/
  browser available to test WebGPU in this session). Re-enable only after confirming IS-Net actually
  works via WebGPU in a real browser.
- License note: `onnx-community/ISNet-ONNX` is AGPL-3.0 (SPEC.md previously rejected BRIA's
  RMBG-2.0 specifically over its non-commercial license). Accepted knowingly here — architect
  confirmed this project has no commercial-use plans and takes on the risk. Revisit before any
  commercial deployment.
- SPEC.md §2.2, §3, §6, §6.1 updated to match (model identity, dtype scheme, WebGPU status).

### Affected Phases / Consequences
- Supersedes Phase 04's completion-entry note below ("Known environment gap... likely headless-
  specific") — it was not headless-specific; this entry is the corrected diagnosis.
- Phase 02's "Current Contract" model references (BiRefNet_lite/BiRefNet) below are superseded by
  this entry per this log's append-only convention — the code and SPEC.md now reflect IS-Net.
- No `/phase-gate` re-run performed as part of this change; typecheck/lint/unit tests/arch-lint all
  green (51/51 tests). A full e2e pass (`pnpm e2e`, host-only) has not been re-run against the new
  model in this session — recommended before the next phase gate.

## 2026-07-10 — Phase 05 complete

**Type**: phase-completion
**Author**: AI (context-update)
**Triggered by**: PHASE_05 gate passed (type-check, unit tests, arch lint, Docker
bootstrap/smoke all green; e2e explicitly waived — pure instrumentation, no new user-facing flow)

### Changes / Decision
- `umami` + `umami-db` (Postgres) services added to `docker-compose.yml`, `umami-db` gating
  `umami` startup via healthcheck; both `restart: unless-stopped`
- `uptime-kuma` self-hosted uptime monitoring added as a `docker-compose.yml` service (chosen over
  UptimeRobot to stay consistent with this project's self-hosted-everything infra), bound to
  `127.0.0.1` only — monitors/alert channels configured once through its own web UI via SSH tunnel
- `deploy/nginx/app.conf` proxies Umami's script/collect endpoints (`/script.js`, `/api/send`) on
  the app's own domain rather than a separate `umami.` subdomain — no extra DNS/cert needed
- `shared/lib/analytics` FSD slice (flat `types.ts` / `track-event.ts` / `index.ts` — `model/`
  subfolder avoided, Steiger flags it as a reserved segment name in the `shared` layer):
  `AnalyticsEvent` union + `trackEvent()` wrapper around `window.umami.track(...)`, no-op safe
  when the script hasn't loaded (dev/test)
- Umami tracking script + Cloudflare Web Analytics beacon injected into `routes/__root.tsx` head,
  gated on production env vars so local dev stays script-free
- Event wiring: `model_load_started/completed/failed` and `processing_started/completed/failed`
  from `useBackgroundRemoval.ts`'s existing dispatch sites (state machine reducer itself stays
  untouched — side effects live in the hook, via a new `awaitingModelLoadRef` to distinguish
  model-load vs. processing failures without reading stale `state.status` inside the worker's
  once-bound message handler); `webgpu_unavailable_fallback` from `device-capabilities.ts`;
  `download_clicked` from `DownloadResultButton.tsx`'s click handler
- No new e2e spec added (AGENTS.md core rule 8 waived per this phase's own Gate Checks — pure
  instrumentation of the existing Phase 04 flow); event-firing covered at the Vitest level instead
  (`track-event.test.ts` + updated `useBackgroundRemoval.test.ts` / `device-capabilities.test.ts` /
  `DownloadResultButton.test.tsx`) — 55/55 unit tests green across 13 files
- This app's own server contract is unchanged (no new endpoints) — all new events are Umami
  client-side custom events, documented in Current Contract's new "Analytics Events" table

### Affected Phases / Consequences
- No changes to `pages/home/ui/HomePage.tsx` or the ML pipeline/upload/download UX — confirmed
  instrumentation-only, per this phase's "Do NOT touch" scope
- Phase 06 (SEO scenario pages + sitemap script) is next; it inherits the `shared/lib/analytics`
  slice if any new pages need event tracking
- Production deploy still needs real values for the six new env vars (`VITE_UMAMI_SCRIPT_URL`,
  `VITE_UMAMI_WEBSITE_ID`, `VITE_CF_BEACON_TOKEN`, `UMAMI_APP_SECRET`, `UMAMI_DATABASE_URL`,
  `POSTGRES_PASSWORD`) and one-time Uptime Kuma monitor/alert setup via SSH tunnel — none of this
  is automatable from compose/env alone

## 2026-07-10 — Phase 04 complete

**Type**: phase-completion
**Author**: AI (context-update)
**Triggered by**: PHASE_04 gate passed (type-check, unit tests, architecture lint, Docker
bootstrap/smoke all green) and committed

### Changes / Decision
- `features/upload-image` FSD slice: drag-and-drop, click-to-browse, clipboard paste, mobile
  camera capture (`capture` attribute); format/size/resolution validation (JPEG/PNG/WebP, 20 MB
  hard limit); client-side downscale above 4096px on the longest side; `validateAndPrepareUpload`
  produces the existing `SourceImage` entity rather than a parallel type
- `BeforeAfterSlider` display component added to `entities/processed-image`
- `features/download-result` FSD slice: PNG-with-alpha download button, releases the object URL
  via `URL.revokeObjectURL` after download or on next processing
- `pages/home` composes upload (`F1`) + quality toggle (Phase 03) + `useBackgroundRemoval`
  (Phase 02) + `BeforeAfterSlider` (`F2`) + download (`F3`) into the full
  `idle → model-loading → ready → processing → result` state machine, `error` reachable from any
  state, real model-load progress, WASM path labeled "lightweight mode", reset without page
  reload, one-click "recompute in max quality"; root carries `data-testid="home-page"`
- `routes/index.tsx` replaced: thin `loader` + head-meta shell rendering `pages/home`, replacing
  the Phase 01 hello-world placeholder — `GET /` is the same route, not a new endpoint
- Accessibility (SPEC.md §5.4): real `<input type="file">` under the drop zone, `aria-live="polite"`
  state-transition announcements, WCAG AA contrast/focus states, mobile "choose photo" button
- Vitest + Testing Library coverage: `upload-image` validation/downscale, `BeforeAfterSlider`,
  `download-result`, and the composed `pages/home` state machine (52 tests total project-wide)
- Playwright `e2e/home.spec.ts` extends Phase 03's setup with the critical-path flow
  (upload → process → download → process another image) across the chromium/webkit/Mobile Safari
  projects added to `playwright.config.ts`, plus fast idle/validation-error specs
- `pages/home/lib/source-image-to-file.ts` bridges `upload-image`'s validated `SourceImage.blob`
  back into a raw `File` for `useBackgroundRemoval.selectFile` (Phase 02 hook API left unchanged,
  per this phase's "Do NOT touch" constraint on `features/remove-background`)

### Affected Phases / Consequences
- `/dev/remove-background` stays as the isolated ML test harness (untouched this phase); Phase 06
  adds SEO scenario pages and the sitemap script, Phase 05 adds analytics/Umami wiring
- Known environment gap: the critical-path e2e spec's real WASM inference (`OrtRun()` on the full
  1024×1024 BiRefNet) hits `std::bad_alloc` in this dev WSL2 environment's headless browsers
  (chromium/webkit/Mobile Safari) — confirmed not a host-RAM shortage (16 GB free at time of gate),
  so likely an ONNX Runtime WASM linear-memory ceiling specific to headless execution here. Fast
  idle/validation-error specs pass on all three projects; architect approved treating `/phase-gate
  04` as PASS with this documented, pre-existing gap (see PHASE_04.md Implementation Notes) rather
  than blocking phase closure on it. Needs a real `pnpm e2e` run to fully verify the critical path
  end to end

## 2026-07-10 — Docker dev environment + e2e/Playwright policy

**Type**: decision
**Author**: `v.godlevskiy` (via AI agent)
**Triggered by**: Docker now confirmed working from this project's WSL/terminal environment
(previously unavailable — see Phase 02's completion entry below); architect requested this be
formalized ahead of Phase 04

### Changes / Decision
- Confirmed `docker`/`docker compose` work from this environment (`docker --version`,
  `docker compose version`, a real `docker compose build`/`up` round-trip against the app) — the
  Phase 02-era "Docker unavailable in this environment" constraint no longer holds
- Added a `dev` build stage to `Dockerfile` (extends `deps`, no `COPY . .` — source is bind-mounted
  at runtime) and a standalone `docker-compose.dev.yml` giving a container-parity, hot-reloading
  dev session (`docker compose -f docker-compose.dev.yml up --build`, port 3000 published). This is
  additive — plain `pnpm dev` remains the default for everyday local work; Docker is for when a
  task genuinely needs container parity (AGENTS.md core rule 7)
- `docs/STACK.md`'s Gate Commands "Infrastructure / bootstrap" row no longer needs a Docker-
  unavailability caveat — Docker-dependent gate steps (bootstrap, smoke) should actually run now,
  not be skipped
- Formalized (AGENTS.md core rule 8, `docs/STACK.md`, `docs/playbooks/impl-assist.md`,
  `docs/PHASE_TEMPLATE.md`) that every user-facing flow needs Playwright coverage under `e2e/`,
  and that `pnpm e2e` should be run during `/impl-assist` verification (not only `/phase-gate`) as
  an automated stand-in for a first pass of the architect's manual browser check
- Explicitly scoped e2e/Playwright as **host-only**: it must never run inside Docker and must
  never be wired into CI (`.github/workflows/ci.yml` has no e2e job, by design). Its purpose is a
  local, human-in-the-loop confirmation that a phase's work behaves correctly after implementation,
  or to reproduce a reported issue — not pipeline gating

### Affected Phases / Consequences
- Phase 04 onward: `/phase-gate`'s infrastructure/bootstrap/smoke steps are expected to actually
  execute via Docker rather than being skipped; any future phase adding a user-facing flow must add
  or extend an `e2e/` spec for it
- No change to CI (`.github/workflows/ci.yml`): it still only runs lint/typecheck/arch-lint/unit
  tests before building and pushing the Docker image — e2e stays a local-only step by design

## 2026-07-10 — Phase 03 complete

**Type**: phase-completion
**Author**: AI (context-update)
**Triggered by**: PHASE_03 gate passed and committed

### Changes / Decision
- shadcn/ui installed and configured on the Base UI engine (`components.json`, Tailwind theme
  tokens); components copied into the repo rather than consumed as an npm dependency (SPEC.md §6)
- `shared/ui` base component set added via the shadcn CLI: `Button`, `Switch`, `Card`, aggregated
  through a public `shared/ui/index.ts` (flat CLI output paths, not the nested-folder layout
  originally sketched — see PHASE_03.md Implementation Notes)
- `features/quality-mode-toggle` FSD slice: `useQualityMode` hook backing a `localStorage`-persisted
  `qualityMode` (`"fast" | "max"`), defaulting to `DeviceCapabilities.defaultQualityMode`
  (Phase 02) when unset
- Toggle UI control wired to `useQualityMode`, integrated into `/dev/remove-background` as the
  `qualityMode` parameter passed into `useBackgroundRemoval` (Phase 02), proving the wiring ahead
  of the real `pages/home` composition in Phase 04
- Vitest unit + Testing Library tests: `localStorage` persistence, default-selection from
  `DeviceCapabilities`, toggle UI interaction
- `@playwright/test` installed ahead of schedule (chromium only) with `playwright.config.ts` and
  one smoke spec (`e2e/dev-remove-background.spec.ts`) covering harness render, toggle interaction,
  and `localStorage` persistence across reload — STACK.md's E2E gate row updated to match; the
  cross-browser critical-path matrix (upload → process → download) stays deferred to Phase 04
- `resolve.tsconfigPaths: true` added to `vitest.config.ts` so shadcn's `@/*`-aliased imports
  resolve under Vitest
- `useQualityMode`'s initial-state read guards `typeof window === "undefined"` for SSR correctness
  (see `docs/KNOWN_GOTCHAS.md`)

### Affected Phases / Consequences
- Phase 04 (`pages/home`) will replace `/dev/remove-background` with the real, designed UI
  composition, reusing the `shared/ui` primitives and `quality-mode-toggle` slice from this phase
- Phase 04's e2e work extends the Playwright setup installed in this phase rather than bootstrapping
  it from scratch

---

## 2026-07-10 — Phase 02 complete

**Type**: phase-completion
**Author**: AI (context-update)
**Triggered by**: PHASE_02 gate passed (type-check, unit tests, arch lint green; Docker-dependent
bootstrap/smoke steps skipped — Docker unavailable in this environment, architect confirmed
manual verification and approved committing without them) and committed

### Changes / Decision
- `entities/processed-image` domain types (`SourceImage`, `AlphaMatte`, `ProcessedImage`,
  `QualityMode`, `DeviceCapabilities`) and `features/remove-background` FSD slice
- `DeviceCapabilities` detection selecting WebGPU (`fp16`) vs WASM (`q8`) inference path
- Web Worker hosting Transformers.js v4 model init + inference (`BiRefNet_lite` fast /
  `BiRefNet` max quality), never on the main thread
- `useBackgroundRemoval` hook implementing the full state machine (SPEC.md §5.3)
- `OffscreenCanvas` postprocessing/compositing in the worker producing `ProcessedImage`
- Mandatory error handling: WebGPU fallback notice, size/resolution/format limits,
  model-load-failure retry, device-out-of-memory message
- `/dev/remove-background` undesigned test route exercising the full pipeline end to end
- Vitest unit + integration tests (device capability detection, error handling, postprocessing,
  `useBackgroundRemoval` against a mocked worker)
- `@huggingface/transformers` v4 + ONNX Runtime Web deps, `env.useWasmCache = true`
- GitHub Actions workflow uploading `.onnx` weights + WASM binaries to Cloudflare R2, triggered
  on `models.manifest.json` changes to `main` plus manual `workflow_dispatch`
- Service Worker (`public/sw.js`) cache-first caching of model weights/WASM from the R2 CDN,
  `lite`/full variants cached independently

### Affected Phases / Consequences
- Phase 04 (`pages/home`) will replace `/dev/remove-background` with the real, designed UI
  composition built on this slice
- Phase 04 is also where Playwright/e2e gets wired in, exercising this pipeline's critical path

---

## 2026-07-10 — Phase 01 complete

**Type**: phase-completion
**Author**: AI (context-update)
**Triggered by**: PHASE_01 gate passed

### Changes / Decision
- TanStack Start scaffolded (Vite, Nitro `node-server` preset, TypeScript strict), FSD layer
  skeleton, ESLint + Prettier, Steiger architecture lint, Husky + lint-staged
- Hello-world page at `/`, proving the SSR pipeline end to end
- Dockerfile, docker-compose (`app` + `nginx` + `certbot`), Nginx reverse proxy, Certbot TLS
  bootstrap (`deploy/init-letsencrypt.sh`), GitHub Actions CI (lint → typecheck → arch-lint →
  test → build → push to GHCR → SSH deploy)
- Gate commands in `docs/STACK.md` scoped to what's actually testable in dev/CI (`app` container
  directly); `nginx`/TLS verification documented as a VPS-only manual step

### Affected Phases / Consequences
- None (additive change — first phase)

---

## v1.0 — 2026-07-09 — Initial Setup

**Type**: phase-completion
**Author**: `v.godlevskiy`
**Triggered by**: Project initialization with SDD workflow

### Changes
- `SPEC.md` created: project goals, roles, data model, API/contract, phase plan
- `STACK.md` populated with build/test/run commands

### Affected Phases / Consequences
- None (initial state)

---

<!--
ENTRY TEMPLATE — copy this block when adding a new entry. Pick the Type that fits:
  spec-change      — docs/SPEC.md changed (via /spec-sync)
  phase-completion — a phase closed out (via /context-update)
  decision         — an architectural decision / trade-off (ADR-style, manual or agent-recorded)
  feedback         — human reviewer or domain-expert feedback on a phase
  rollback         — a phase was rolled back or a migration reversed

## [YYYY-MM-DD] — [Short Title]

**Type**: spec-change | phase-completion | decision | feedback | rollback
**Author**: [name / AI skill]
**Triggered by**: [what caused this]

### Changes / Decision
- [what changed, or what was decided and why — alternatives considered if relevant]

### Affected Phases / Consequences
- PHASE_XX — [reason / what changes as a result, good and bad]

-->
