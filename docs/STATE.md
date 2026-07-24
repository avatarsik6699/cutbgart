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
| PHASE_11 | ✅ done | v0.11.0 | ✅ | 🤖 agent | Background replacement |
| PHASE_12 | ✅ done | v0.12.0 | ✅ | 🤖 agent | Localization, Branding & Launch Content |
| PHASE_13 | ✅ done | v0.13.0 | ✅ | 🤖 agent | Hardening & Launch |
| PHASE_14 | ✅ done | v0.14.0 | ✅ | 🤖 agent | VPS Model CDN |
| PHASE_15 | ✅ done | v0.15.0 | ✅ | 🤖 agent | Browser Model Evaluation Lab |
| PHASE_16 | ✅ done | v0.16.0 | ✅ | 🤖 agent | Production Model Modes & Guided Selection |
| PHASE_17 | ✅ done | v0.17.0 | ✅ | 🤖 agent | Iterative Guided Object Editor |
| PHASE_18 | ✅ done | v0.18.0 | ✅ | 🤖 agent | Browser Interactive Matting Lab |
| PHASE_19 | ✅ done | v0.19.0 | ✅ | 🤖 agent | Production Trimap & Alpha Refinement |
| PHASE_20 | ✅ done | v0.20.0 | ✅ | 🤖 agent | Foreground Edge Quality & Runtime Hardening |
| PHASE_21 | ✅ done | v0.21.0 | ✅ | 🤖 agent | Brush-Guided Object Correction |
| PHASE_22 | ✅ done | v0.22.0 | ✅ | 🤖 agent | Production Security & Supply Chain Hardening |
| PHASE_23 | ⏳ pending | v0.23.0 | ⬜ | — | Release Reliability & Operations |
| PHASE_24 | ⏳ pending | v0.24.0 | ⬜ | — | Legal & Data Governance Audit |
| PHASE_25 | ⏳ pending | v0.25.0 | ⬜ | — | Consent & Legal Surfaces |
| PHASE_26 | ⏳ pending | v0.26.0 | ⬜ | — | Editor Document Foundation & Guided Reset |
| PHASE_27 | ⏳ pending | v0.27.0 | ⬜ | — | Automatic-First Workspace |
| PHASE_28 | ⏳ pending | v0.28.0 | ⬜ | — | Unified Cutout Tool |
| PHASE_29 | ⏳ pending | v0.29.0 | ⬜ | — | Enhancements Tool & Committed History |
| PHASE_30 | ⏳ pending | v0.30.0 | ⬜ | — | Background & Export Tools |
| PHASE_31 | ⏳ pending | v0.31.0 | ⬜ | — | Batch Workflow Consolidation & UX Hardening |
| PHASE_32 | ⏳ pending | v0.32.0 | ⬜ | — | Guided Help & Onboarding |
| PHASE_33 | ⏳ pending | v0.33.0 | ⬜ | — | Whole-Project Audit & Refactor |
| PHASE_34 | ⏳ pending | v0.34.0 | ⬜ | — | Accessibility, Device & Product Validation |

<!-- Add new rows here via /phase-init N -->

---

## Current Contract

> Technical contract as of the latest completed phase. Append-only — never remove an entry unless
> `SPEC.md` explicitly removes it (via `/spec-sync`). Updated by `/spec-sync` (on contract-changing
> spec edits) and `/context-update` (on phase completion).

**Phase completed:** `22` · **Phase in progress:** `—`

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

```ts
// src/features/background-replacement/model/types.ts — Phase 11, per SPEC.md §1.3, §2.2, §5.2–§5.4
// Composited behind the cutout via the existing worker-side OffscreenCanvas pipeline
// (features/remove-background/lib/compositing.ts); never triggers a new inference pass.

type HexColor = `#${string}`;

interface BackgroundGradientStop {
  offset: 0 | 1;
  color: HexColor;
}

type BackgroundFill =
  | { type: "transparent" }
  | { type: "color"; value: HexColor }
  | {
      type: "gradient";
      kind: "linear" | "radial";
      stops: readonly [
        BackgroundGradientStop & { offset: 0 },
        BackgroundGradientStop & { offset: 1 },
      ];
    }
  | { type: "image"; blob: Blob };

// transparent is the default (preserves the pre-Phase-11 PNG-with-alpha behavior). Colors are
// uppercase opaque sRGB `#RRGGBB`; invalid values fall back to transparent, never an invented
// color. Gradients are fixed two-stop presets (three linear, three radial — see PHASE_11.md
// Contracts for the exact hex values/geometry); custom angles/stops are deferred beyond Phase 11.
// Custom-image fills accept the existing JPEG/PNG/WebP set up to 20 MB, downscaled above 4096px,
// drawn with centered aspect-preserving `cover`. Fill selection is item-local in batch mode; the
// same recomposited blob drives preview, individual download, and ZIP output. `preview()` is a
// local CSS-only update (no worker call); an explicit "Save background" action performs the one
// PNG recomposite/encode, and download/mask-correction entry are gated on that saved (non-`dirty`)
// state so neither ever serves a stale or preview-only file.
```

```ts
// src/paraglide/runtime.js — generated by the Paraglide compiler in Phase 12
type Locale = "ru" | "en";

// "ru" is the unprefixed base locale; "en" is served under /en/...
```

```ts
// src/features/remove-background/model/model-source.ts — Phase 14
type ModelSource = "cdn" | "upstream";

// Pipeline creation is serialized because Transformers.js model/WASM hosts are mutable globals.
// Every model request uses the manifest-pinned ISNet revision; a failed CDN load switches the
// worker once to Hugging Face + the upstream ONNX Runtime source and retries safely.
```

```ts
// src/features/model-lab/model/types.ts — Phase 15
type EvaluationModelId = "isnet-q8" | "isnet-fp32" | "ben2-fp16" | "mvanet-q4";

interface EvaluationModelProfile {
  id: EvaluationModelId;
  modelId: string;
  revision: string;
  dtype: "q8" | "fp32" | "fp16" | "q4";
  approximateBytes: number;
  supportedPaths: InferencePath[];
  license: "AGPL-3.0" | "MIT";
}

// Exported records contain timings/capabilities/preference only: no filename or image bytes.
interface BenchmarkMeasurement {
  modelId: EvaluationModelId;
  inferencePath: InferencePath;
  loadMs: number;
  inferenceMs: number;
  status: "success" | "error";
  errorCode?: string;
}
```

```ts
// Phase 16 — explicit production modes and guided object selection
type AutomaticModelMode = "isnet-q8" | "isnet-fp32" | "ben2-fp16";
type QualityMode = AutomaticModelMode | "fast" | "max"; // legacy worker aliases remain accepted

interface ProductionModelProfile {
  id: AutomaticModelMode;
  modelId: "onnx-community/ISNet-ONNX" | "onnx-community/BEN2-ONNX";
  revision: string;
  dtype: "q8" | "fp32" | "fp16";
  approximateBytes: number;
  supportedPaths: readonly InferencePath[];
  relativeSpeed: "fast" | "balanced" | "slow";
  requiresWebGPU: boolean;
}

type SelectionPrompt =
  | { type: "point"; x: number; y: number; label: 1 }
  | { type: "box"; xMin: number; yMin: number; xMax: number; yMax: number };

type ObjectSelectionStatus =
  | "idle"
  | "loading-model"
  | "encoding-image"
  | "ready-for-prompt"
  | "predicting-mask"
  | "preview"
  | "error";

interface GuidedModelProfile {
  modelId: "Xenova/slimsam-77-uniform";
  revision: "7c8459c48dabad6291b384c97be46c451c25d6c4";
  dtype: "q8";
  approximateBytes: 13_840_000;
  supportedPaths: readonly ["wasm"];
  license: "Apache-2.0";
}
```

Phase 16 pins IS-Net q8/fp32, BEN2 fp16, and SlimSAM q8 to immutable revisions. BEN2 is an
explicit, session-only WebGPU mode that falls back once to IS-Net q8 when capability, model, or OOM
checks fail. SlimSAM is loaded only after explicit guided-selection entry, reuses one image
embedding for replacement point/box prompts, and hands the accepted source-sized `AlphaMatte` to
the existing brush/background/download pipeline. One automatic pipeline and at most one explicitly
entered guided pipeline may coexist, but heavy inference is serialized and disposed on mode exit.

```ts
// Phase 17 — iterative guided object editor; all values are session-only
type PromptPointLabel = 0 | 1;
type SemanticStrokeMode = "keep" | "remove";

interface GuidedPoint {
  id: string;
  x: number;
  y: number;
  label: PromptPointLabel;
}

interface GuidedBox {
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
}

interface SemanticStroke {
  id: string;
  mode: SemanticStrokeMode;
  points: readonly { x: number; y: number }[];
  radius: number;
}

interface GuidedMaskCandidate {
  id: string;
  matte: AlphaMatte;
  score: number | null;
  differenceRatio: number;
}

interface ObjectMaskLayer {
  id: string;
  points: readonly GuidedPoint[];
  targetBox: GuidedBox | null;
  strokes: readonly SemanticStroke[];
  candidates: readonly GuidedMaskCandidate[];
  selectedCandidateId: string | null;
  acceptedMatte: AlphaMatte | null;
}

type PromptHistoryEntry =
  | { type: "point-added"; layerId: string; point: GuidedPoint }
  | { type: "box-changed"; layerId: string; before: GuidedBox | null; after: GuidedBox | null }
  | { type: "stroke-added"; layerId: string; stroke: SemanticStroke }
  | { type: "candidate-selected"; layerId: string; beforeId: string | null; afterId: string | null }
  | { type: "layer-added"; layerId: string }
  | {
      type: "layer-removed";
      layerId: string;
      promptData: {
        points: readonly GuidedPoint[];
        targetBox: GuidedBox | null;
        strokes: readonly SemanticStroke[];
        selectedCandidateId: string | null;
      };
      index: number;
    }
  | { type: "layer-selected"; beforeId: string; afterId: string };

interface PromptSession {
  source: SourceImage;
  baseMatte: AlphaMatte | null;
  layers: readonly ObjectMaskLayer[];
  activeLayerId: string;
  revision: number;
  history: readonly PromptHistoryEntry[];
  redo: readonly PromptHistoryEntry[];
}

interface IterativeSelectionPrompt {
  revision: number;
  points: readonly GuidedPoint[];
  box: GuidedBox | null;
  previousMask: AlphaMatte | null;
}
```

Phase 17 expands SlimSAM guidance to cumulative positive/negative points, one target box and
semantic keep/remove strokes per object layer, ranked alternative masks, bounded delta-only
undo/redo, and latest-revision-wins worker responses. Accepted layer masks are unioned over the
automatic base matte; explicit semantic constraints win. Invalid model scores remain `null` rather
than becoming invented confidence values. All prompts, candidates, masks, embeddings, and history
remain browser-memory-only and are released with the guided session.

```ts
// src/features/model-lab/model/types.ts — Phase 18; evaluation-only, never a production mapping
type MattingEvaluationModelId =
  | "vitmatte-small-composition1k-q8"
  | "vitmatte-small-composition1k-fp32"
  | "vitmatte-small-distinctions646-q8"
  | "vitmatte-small-distinctions646-fp32";

type LightweightPromptEvaluationModelId = "efficient-sam-ti" | "mobile-sam-vit-t";
type InteractiveEvaluationModelId =
  | MattingEvaluationModelId
  | LightweightPromptEvaluationModelId;

type CandidateEligibility = "production-eligible" | "evidence-only" | "rejected-license";

interface InteractiveMattingBenchmarkExport {
  schemaVersion: 2;
  capabilities: ModelLabCapabilities;
  candidates: InteractiveEvaluationModelProfile[];
  corpusCaseCount: number;
  quality: MattingQualityMeasurement[];
  runtime: InteractiveRuntimeMeasurement[];
  decision: InteractiveEvaluationModelId | "none";
}
```

Phase 18 extends the opt-in lab with immutable ViTMatte q8/fp32 profiles, deterministic trimap/crop
preparation, alpha/boundary metrics, classified runtime outcomes, sequential pipeline disposal, and
an image-free schema-v2 export. EfficientSAM-Ti and MobileSAM remain evidence-only because no
verified immutable first-party browser ONNX graph was found. Production inference remains unchanged;
the evidence record selects Distinctions-646 q8/fp32 as Phase-19 `balanced`/`maximum` inputs.

```ts
// Phase 19 — production trimap and soft-alpha refinement; all values are session-only
type MattingRefinementMode = "balanced" | "maximum";
type MattingModelVariantId =
  | "vitmatte-small-distinctions646-q8"
  | "vitmatte-small-distinctions646-fp32";
type TrimapValue = 0 | 128 | 255;
type HardConstraintValue = -1 | 0 | 1;

interface Trimap {
  width: number;
  height: number;
  data: Uint8ClampedArray;
  unknownBounds: PixelRect | null;
}

interface RefinementConstraintMap {
  width: number;
  height: number;
  data: Int8Array;
}

type MattingFallback = "none" | "balanced" | "deterministic";
```

Phase 19 adds selected-only, lazy Distinctions-646 q8/fp32 production refinement over an adaptive
trimap focus crop. The latest hard keep/remove constraint is re-applied after model output; pixels
outside the crop retain the prior alpha. Maximum may retry balanced once, then deterministic fusion;
balanced may fall back only to deterministic fusion. Automatic, guided, and ViTMatte heavy stages
are serialized with explicit disposal acknowledgements, and the refined matte continues through the
existing brush, background, batch, and download flows.

```ts
// Phase 20 — session-only foreground cleanup and bounded matting runtime
type MattingFallback = "none" | "balanced" | "wasm" | "deterministic";

interface MattingInputSize {
  width: number;
  height: number;
}

type ForegroundCleanupPath = "decontaminate" | "edge-aware-fallback" | "unchanged";
type ForegroundCleanupFallback =
  | "none"
  | "no-soft-edge"
  | "no-background-samples"
  | "processing-failed";

interface DirtyPixelPatch {
  bounds: PixelRect;
  rgba: Uint8ClampedArray;
}

interface ForegroundRefinementResult {
  foreground: Blob;
  matte: AlphaMatte;
  dirtyPatch: DirtyPixelPatch | null;
  requestedPath: "decontaminate";
  actualPath: ForegroundCleanupPath;
  fallback: ForegroundCleanupFallback;
  durationMs: number;
  memoryBytes: number | "unavailable";
}
```

Phase 20 bounds every ViTMatte input to at most 1024×1024 while preserving aspect ratio and restores
the soft alpha to source-crop dimensions. Balanced WebGPU execution failure retries Balanced/WASM
once; Maximum remains a finite fp32 → q8 → q8/WASM chain before deterministic fusion. Optional
foreground decontamination changes RGB only in safe soft-edge regions, keeps source alpha and hard
constraints exact, is reversible/non-accumulating, and reports localized applied, unchanged, or
recoverable-error outcomes. `ProcessedImage.foreground` is an optional browser-memory colour layer;
the current `AlphaMatte` remains the compositing-alpha authority.

```ts
// Phase 21 — brush-guided object correction; all values are session-only
type GuidedBrushMode = "keep" | "remove";
type GuidedBrushStatus =
  | "idle"
  | "loading-model"
  | "encoding-image"
  | "ready"
  | "dirty"
  | "predicting"
  | "preview"
  | "error";

interface GuidedBrushStroke {
  id: string;
  mode: GuidedBrushMode;
  points: readonly { x: number; y: number }[];
  radius: number;
}

interface GuidedBrushCandidate {
  id: string;
  matte: AlphaMatte;
  modelRankScore: number | null;
  intentScore: number;
  differenceRatio: number;
}

interface GuidedBrushSession {
  source: SourceImage;
  baseMatte: AlphaMatte | null;
  strokes: readonly GuidedBrushStroke[];
  brushRadius: number;
  status: GuidedBrushStatus;
  revision: number;
  computedRevision: number | null;
  editRegion: PixelRect | null;
  candidates: readonly GuidedBrushCandidate[];
  selectedCandidateId: string | null;
  history: readonly GuidedBrushStroke[];
  redo: readonly GuidedBrushStroke[];
}
```

Phase 21 replaces the primary Phase-17 point/box/layer UI with one two-zone semantic brush while
retaining the legacy source for compatibility. The inner core supplies hard `keep`/`remove`
constraints and prompt anchors; the full translucent radius bounds local candidate influence.
Visible strokes produce at most 32 label-balanced prompts for the whole session. Only explicit
recompute runs SlimSAM, intent-first ranking keeps raw model scores internal, materially duplicate
alternatives collapse, and automatic-base bytes outside local influence zones remain unchanged.
Latest-revision-wins orchestration and lifecycle run tokens prevent stale inference or result
application after edits, reset, cancel, batch changes, or disposal.

```ts
// models.manifest.json + scripts/sync-model-assets.ts — Phase 22
interface VerifiedModelAsset {
  path: string;
  revision: string;
  byteSize: number;
  sha256: string;
}

interface ModelAssetManifest {
  schemaVersion: 1;
  release: string;
  assets: VerifiedModelAsset[];
}
```

Phase 22 makes the model/WASM manifest the immutable release contract for synchronized browser
assets. Synchronization verifies source revision, byte size and SHA-256 before atomic activation,
retains the previous verified release for rollback, and never treats a filename alone as trust.

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
| `GET` | `/dev/model-lab` | none | Phase 15 internal `noindex` browser model-comparison lab. Enabled only by `VITE_ENABLE_MODEL_LAB=true`; otherwise renders an unavailable state and never loads candidate weights. Excluded from the sitemap. |
| `GET` | `/udalit-fon-s-foto-tovara`, `/udalit-fon-s-foto-na-dokumenty`, `/udalit-fon-s-logotipa`, `/udalit-fon-dlya-avatarki` | none | SSR HTML: scenario-specific `pages/*` composition of the same upload → quality-toggle → remove-background → download flow as `/`, plus scenario copy, `HowTo` JSON-LD, and a static before/after example image (Phase 06, SPEC.md §5.1, §7.5) |
| `GET` | `/about` | none | SSR HTML: static project/tech/author info, no upload tool (Phase 06, SPEC.md §5.1) |
| `GET` | `/sitemap.xml` | none | Generated at build time by `scripts/generate-sitemap.ts` from the `routes/` tree, excludes `/dev/remove-background` (Phase 06, SPEC.md §7.5) |
| `GET` | `/robots.txt` | none | Static, fully open, links to `/sitemap.xml` (Phase 06, SPEC.md §7.5) |
| `GET` | `/privacy` | none | SSR HTML: Russian privacy-policy content covering client-side processing, aggregate analytics, and the Telegram contact (Phase 12, SPEC.md §7.2) |
| `GET` | `/en`, `/en/about`, `/en/privacy` | none | English-locale counterparts of `/`, `/about`, and `/privacy`, localized through Paraglide (Phase 12, SPEC.md §5.5) |
| `GET` | `/en/remove-background-from-product-photo`, `/en/remove-background-from-id-photo`, `/en/remove-background-from-logo`, `/en/remove-background-from-avatar` | none | English-locale counterparts of the four Russian scenario pages (Phase 12, SPEC.md §5.1, §5.5) |
| `GET` | `/sitemap.xml` | none | Phase 12 contract: locale-aware build output containing both locale URLs and per-page `hreflang` alternates; supersedes the Phase 06 baseline above |
| `GET`, `HEAD` | `https://cdn.cutbg.art/models/{manifest-path}` | none | Public pinned ISNet/config/ONNX Runtime asset with CORS, byte ranges, immutable caching, and Cloudflare edge delivery (Phase 14) |
| `GET` | `/.well-known/security.txt` | none | RFC 9116 vulnerability-disclosure contact, expiry, canonical URL and policy link (Phase 22) |

### DB Schema

- Tables: none yet.
- Current migration head: `—`
- Client-side Cache Storage (`public/sw.js`, cache-first, content-hashed, added Phase 02): pinned ONNX model weights (IS-Net q8/fp32, explicitly loaded BEN2 fp16 and SlimSAM q8, plus selected-only ViTMatte Distinctions-646 q8/fp32 as of Phase 19) and ONNX Runtime WASM binaries. Production prefers the VPS-backed `cdn.cutbg.art` Cloudflare cache and automatically retries the same immutable revision from upstream Hugging Face/ONNX Runtime sources if it is unavailable (Phase 14/16/19). Partial `206` range probes are never cached.
- Client-side `localStorage` (added Phase 03, retained by Phase 16): `qualityMode: "fast" | "max"` persists only the corresponding IS-Net q8/fp32 preference. BEN2 and guided-selection state remain session-only; no other user data is stored client-side (SPEC.md §3).
- Phase 17 iterative prompts, object layers, candidates, semantic strokes, and undo/redo history are
  session-only and never enter Cache Storage, `localStorage`, analytics, logs, or server storage.
- Phase 18 matting corpus inputs/previews/results remain in memory. Only an explicit image-free JSON
  export and the repository evidence record persist; neither contains image bytes, filenames,
  prompt coordinates, or other private image-derived identifiers.
- Phase 19 trimaps, focus crops, constraints, refined mattes, and model sessions remain in memory
  and are discarded on reset/reload. Cache Storage may retain only immutable public model assets;
  the runtime evidence record is image-free.
- Phase 20 foreground samples, corrected colour buffers, edge/component masks, dirty patches, and
  worker sessions remain in browser-tab memory and are discarded on reset/reload. Only image-free
  quality/runtime observations persist; no filename, prompt, pixel sample, or user image is stored.
- Phase 21 brush strokes, compact constraint maps, prompt samples, candidates, edit regions,
  embeddings, accepted mattes, and bounded delta histories remain in browser-tab memory and are
  discarded on reset/source change/unmount. Only `docs/PHASE_21_RUNTIME_EVIDENCE.md` persists, with
  image-free runtime path, bounded counts, classified failures, timings, and pass/fail observations.
- Phase 22 versions the browser model cache from the verified model/WASM manifest, removes orphaned
  releases during activation, detects missing/corrupt bytes, and exposes a user-invoked clear action
  that affects only published model assets. Source images, filenames, EXIF, masks, composites and
  active editor work never enter or leave through this cache lifecycle.
- Phase 22 release artifacts include a machine-readable CycloneDX SBOM and GitHub provenance/SBOM
  attestations bound to the pushed production image digest. They contain build and dependency
  metadata only, never user or image data.
- `umami-db` (Postgres, added Phase 05): Umami's own internal schema, managed entirely by the Umami container image — not owned by this app; this app's contract still has no server-side persistent store (SPEC.md §3).

### UI Pages

- `/` — full `pages/home` composition (Phase 04): upload (`features/upload-image`) → quality toggle
  (`features/quality-mode-toggle`, Phase 03) → processing (`features/remove-background`, Phase 02)
  → `BeforeAfterSlider` result view → download (`features/download-result`). Replaces the Phase 01
  hello-world placeholder.
- `/dev/remove-background` — undesigned ML pipeline test harness (Phase 02); exercises upload → both models load → inference → result end to end ahead of the real UI landing in Phase 04.
- `/dev/model-lab` — approved Phase 15 internal comparison surface for sequential same-image
  IS-Net/BEN2/MVANet runs, pairwise preference, and image-free benchmark export. It is `noindex`,
  excluded from the sitemap, and inactive unless the build-time lab flag is enabled.
- Phase 18 extends `/dev/model-lab` with sequential ViTMatte trimap/alpha evaluation, deterministic
  local corpus scoring, resource/license disclosure, classified unsupported/OOM recovery, and
  image-free schema-v2 export. It adds no public route or production model fetch.
- `/udalit-fon-s-foto-tovara`, `/udalit-fon-s-foto-na-dokumenty`, `/udalit-fon-s-logotipa`,
  `/udalit-fon-dlya-avatarki` — scenario-specific `pages/*` slices (Phase 06): the same reused
  upload/quality-toggle/remove-background/download features as `/`, wrapped in scenario copy
  (bilingual — Russian primary, English subtitle) and a static before/after example image.
- `/about` — static project/tech/author info (Phase 06); no upload tool.
- Phase 12 composes every public page with shared `site-shell` chrome and serves complete Russian and
  English variants. `/`, `/about`, and the four scenario pages retain their existing base paths;
  English routes live under `/en`, with localized scenario slugs.
- `/privacy` and `/en/privacy` — static bilingual privacy policy covering the client-side image
  invariant, aggregate-only analytics, and the Telegram privacy contact.
- The home and scenario tools now share `widgets/tool-workspace`: a single-column mobile/tablet
  flow and a two-column desktop preview/control layout, with no new domain entity or persistence.
- Phase 17 evolves the same workspace's guided mode into an iterative object editor reachable from
  direct guidance or an automatic result. It returns the unioned source-sized matte to the existing
  exact correction, background, batch, and download flow without adding a route.
- Phase 19 adds bilingual `balanced`/`maximum` soft-edge refinement to automatic results, accepted
  guided results, and a selected settled batch item. It is lazy, reports actual path/fallback, and
  preserves entry to exact correction, backgrounds, individual/ZIP downloads, and reset.
- Phase 20 adds optional bilingual edge-colour cleanup after alpha refinement and before the exact
  brush. Automatic, accepted-guided, refined, and selected settled-batch results expose accessible
  applied/unchanged/error outcomes while keeping background and download output byte-consistent.
- Phase 21 makes a bilingual two-zone `Keep`/`Remove` semantic brush the primary guided flow from
  both direct upload and automatic results. Explicit recompute updates a clean split result preview;
  accepted output continues through matting, foreground cleanup, exact correction, backgrounds,
  selected-batch handling, and downloads without a parallel state machine or new route.

### Env Config

| Key | Example value | Required |
|-----|---------------|----------|
| `PORT` | `3000` | no — Nitro `node-server` preset default |
| `NODE_ENV` | `production` | no — standard Node convention for the container build |
| `VITE_MODEL_CDN_BASE_URL` | `https://cdn.cutbg.art/models` | expected for production builds (Phase 14 VPS-backed Cloudflare CDN); optional in local dev. If unset, or if the configured CDN load fails, the worker uses Transformers.js's upstream Hugging Face/ONNX Runtime sources (SPEC.md §6, §6.1) |
| `VITE_ENABLE_MODEL_LAB` | `false` | optional Phase 15 build-time flag; only the exact string `true` enables `/dev/model-lab`. Defaults off, especially in production. |
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

## 2026-07-24 — Phase 22 complete

**Type**: phase-completion
**Author**: AI (context-update)
**Triggered by**: PHASE_22 gate passed and architect requested finalization

### Changes / Decision
- Hardened the browser/SSR/Nginx boundary with an evidence-backed threat model, tested security
  headers, bounded upload/export privacy checks, owned `security.txt`, abuse controls and
  vulnerability-response runbooks.
- Hardened containers and GitHub Actions with immutable digests/SHAs, least privilege, production
  environment deployment, dependency/license/repository/container scanning, machine-readable SBOMs
  and digest-bound GitHub attestations verified before deploy.
- Replaced model/WASM trust-by-filename with a versioned SHA-256 manifest, verified atomic
  synchronization/rollback, corruption recovery, cache migration/orphan cleanup, usage reporting
  and a safe user-invoked model-cache clear action.
- Local gate evidence passed build, type-check, 299 unit/integration tests, the 288-case
  cross-browser Playwright matrix after one isolated Mobile Safari lazy-image retry, real-model
  inference, Compose health/smoke, license/audit checks, model manifest verification, Trivy
  filesystem/image scans, and CycloneDX SBOM validation.

### Affected Phases / Consequences
- PHASE_23 may build release reliability and operations on the verified image digest, SBOM,
  attestation, rollback and production-security contracts established here.
- No Phase-22 security exception is active; future exceptions require an owner, expiry,
  reachability rationale and compensating control in this Project Log.

## 2026-07-24 — Production-readiness roadmap promoted ahead of editor expansion

**Type**: spec-change
**Author**: AI (spec-sync)
**Triggered by**: architect approval to record the July-2026 production-readiness research in full
and extend/reorder the forward roadmap before implementation begins

### Changes / Decision
- `SPEC.md` v1.16 makes security and operations first-class product contracts. PHASE_22 now owns
  threat modelling, header/privacy tests, container/CI hardening, dependency/license/container
  gates, model/WASM integrity and cache lifecycle, SBOM/attestation, abuse controls,
  `security.txt`, and vulnerability response.
- PHASE_23 now owns immutable digest releases, candidate/post-deploy smoke, verified rollback,
  release identity, deployment concurrency/audit, owner-approved SLI/SLOs and alerts, bounded
  encrypted operational backups/restore drills, capacity/degradation exercises, incident/
  maintenance runbooks, and a deterministic mocked Chromium critical path in pull-request CI.
  Full cross-browser, WebGPU and real-model Playwright remains host-only.
- The legal audit and approved surfaces move to PHASE_24–25 so present analytics/privacy claims and
  future metadata governance are resolved before broader editor work. Owner/legal facts remain
  explicit future gate inputs, not facts inferred by an agent.
- The existing editor, batch, onboarding and refactor contracts move intact to PHASE_26–33 with
  repaired metadata, dependencies, tags, paths and cross-references. Batch parity remains
  cross-cutting through PHASE_26–30 and is consolidated in PHASE_31.
- New PHASE_34 adds manual WCAG-EM/WCAG 2.2 AA and assistive-technology evidence, a limited physical
  device/browser/degradation matrix, constrained-device performance, deterministic visual
  regression, consented usability sessions, RU/EN editorial QA, a truthful accessibility
  statement, and an evidence-linked readiness report.
- The production maintenance contract is now explicit: per-release verification, monthly security/
  dependency/backup review, quarterly restore/SLO/header/device/accessibility sampling, and annual
  or material-change threat/legal/accessibility review. The already implemented ZIP dependency is
  normalized to `client-zip` v2; the stale specification placeholder is removed.

### Affected Phases / Consequences
- PHASE_22–34 are pending sequential contracts and none is marked `NEEDS_REVIEW`.
- PHASE_01–21 remain completed historical contracts. `STATE.md` § Current Contract remains Phase 21
  until a new phase is implemented, gated, committed and closed.
- Earlier 2026-07-24 Project Log entries remain immutable historical records; their old phase
  numbers are superseded by this entry and the current Phase Status/SPEC tables.

## 2026-07-24 — Enhancements naming, batch invariance, guidance, legal, and audit roadmap

**Type**: spec-change
**Author**: AI (spec-sync)
**Triggered by**: architect review rejected the ambiguous `Edges` label, required every future
editor capability to preserve multiple-upload behavior, and requested dedicated onboarding, legal/
data-governance, and whole-project refactoring phases

### Changes / Decision
- `SPEC.md` v1.15 renames the public `Edges` tool to `Улучшения` / `Enhancements` and the future
  operation/tool IDs to `enhance`. The name describes user benefit and can group local model-based
  or deterministic finishing operations; Phase 25 still ships only fine-detail and colour-halo
  improvements.
- Batch behavior is now a cross-cutting delivery invariant: Phases 22–26 each support a single
  image and the selected completed item from a multiple upload. Phase 27 is a consolidation and
  stress/regression gate, not the first batch-parity implementation.
- PHASE_28 adds research, an asset/content preparation pipeline, contextual animated/static help,
  replayable onboarding, reduced-motion support, and single/batch guidance without blocking the
  automatic-first path.
- PHASE_29 separates legal/data discovery from UI implementation: operator and target-market facts,
  deployed/future field-level data inventory, applicability/legal-basis/retention/processor/
  transfer/notification matrices, banner/offer/consent decision, bilingual drafts, and qualified
  review. It must verify the current unconditional analytics-script loading and the privacy page's
  absolute “no personal data” claim against real payload/configuration evidence. Future metadata
  collection remains forbidden until this contract and Phase 30 land.
- PHASE_30 implements only the approved legal route/footer/privacy-choice matrix, with truthful
  cookie/storage language, non-essential gating, easy rejection/withdrawal, and no dark patterns.
- PHASE_31 performs a measured architecture/duplication/React render/effect/resource/bundle/
  responsiveness audit and bounded refactoring with before/after evidence and full regressions.

### Affected Phases / Consequences
- PHASE_22–27 — pending contracts were updated surgically for shared single/batch delivery and the
  Enhancements naming; none remains `NEEDS_REVIEW`.
- PHASE_28–31 — new pending sequential contracts were added despite earlier phases being pending
  because the architect explicitly requested a forward roadmap; dependencies still require each
  preceding gate to pass before implementation.
- PHASE_01–21 remain completed historical contracts. `STATE.md` § Current Contract is unchanged
  until a new phase is implemented, gated, and closed.

## 2026-07-24 — Automatic-first editor simplification and focused roadmap approved

**Type**: spec-change
**Author**: AI (spec-sync)
**Triggered by**: architect manual testing found that model/runtime details, parallel correction
panels, candidate navigation, quota explanations, and unclear continuation actions overwhelm the
background-removal journey; the architect requested a simpler remove.bg-like flow and an
architecture that does not block a possible future product-card editor

### Changes / Decision
- `SPEC.md` v1.14 separates the internal ML lifecycle from a new public journey: upload with a
  user-facing processing choice starts automatic removal immediately, then one stable editor stage
  exposes `Cutout`, `Edges`, and `Background` plus committed undo/redo and Download.
- Public automatic modes are `Fast`, `Optimal`, and `Maximum quality (Beta)`. Model IDs, dtypes,
  byte counts, execution providers, prompt quotas, candidate scores, and diagnostic state names are
  removed from the primary UI. Maximum quality retains an accessible compatibility warning and a
  one-time fallback to Optimal.
- Cutout consolidates semantic and exact painting as `Magic`/`Manual`, automatically uses the
  intent-best mask, removes candidate/history-shaped result navigation and `Continue from this
  result`, and turns Apply into the explicit repeated-pass boundary. Clearing the final Magic mark
  over an existing base restores that base locally instead of trapping the user behind a disabled
  recompute action.
- Soft-alpha refinement and edge-colour cleanup become one `Edges` tool. Background becomes its own
  draft/apply tool. Toolbar history owns only committed document operations; active brush draft
  history stays local and icon-based.
- Phase 22 introduces a bounded browser-memory `EditDocument`/artifact/history kernel and separates
  orchestration from the current monolithic workspace before the visual migration. Phases 23–27
  then deliver the shell, Cutout, Edges/history, Background/export, and batch parity in order.
- Rich layers, free transforms, shadows, perspective, text, and templates are not mixed into this
  cycle. They require a separately loaded future Studio surface and a new approved spec; the
  current app remains focused on background removal and background finishing.

### Affected Phases / Consequences
- PHASE_22–27 — new pending sequential contracts own this redesign.
- PHASE_01–21 remain completed historical contracts and are not marked `NEEDS_REVIEW`; v1.14
  supersedes their public interaction only through future implementation and does not claim the
  current code already matches the new workflow.
- `STATE.md` § Current Contract remains unchanged until the relevant new phase is implemented,
  gated, and closed. There is no active blocker and no authorization to implement Studio features.

## 2026-07-23 — Phase 21 complete

**Type**: phase-completion
**Author**: AI (context-update)
**Triggered by**: PHASE_21 automated gate passed and the architect requested local commit, merge,
and context finalization without remote push or deployment

### Changes / Decision
- Replaced the primary Phase-17 point/box/layer interaction with one bilingual two-zone semantic
  brush: a hard inner `keep`/`remove` core plus a translucent local-influence halo. Legacy source
  remains available for compatibility and rollback but is no longer exposed in the production flow.
- Added bounded session-wide prompt sampling (maximum 32), explicit-recompute-only SlimSAM
  orchestration, intent-first candidate ranking, materially distinct alternatives, local
  automatic-base fusion, hard-constraint precedence, and monotonic lifecycle guards against stale
  inference or result application.
- Integrated direct, automatic-result, and selected-batch entry with the existing matting,
  foreground cleanup, exact correction, background, and download pipeline. No model asset, route,
  endpoint, analytics payload, environment variable, or persistent user data was added.
- Gate evidence passed: production container build/health and container-network smoke; generated
  code, TypeScript, Steiger, 290 unit tests, 67 focused tests, 264 deterministic cross-browser E2E
  tests with 4 expected feature-flag skips, the real IS-Net smoke, 36 focused Phase-21 browser
  tests, and both serialized real Phase-21 SlimSAM/WASM scenarios.

### Affected Phases / Consequences
- Phase 21 completes the approved brush-guided correction contract while preserving Phase-17
  implementation compatibility and the Phase-18–20 downstream pipeline.
- The planned roadmap is complete through Phase 21. No next phase, remote publication, or
  deployment is inferred.

## 2026-07-23 — Advanced interactive boundary algorithms explicitly deferred

**Type**: decision
**Author**: Architect
**Triggered by**: Phase 21 tolerant semantic-brush review

### Changes / Decision
- Phase 21 implements only the approved two-zone semantic brush: a firm inner core plus a
  translucent local tolerance halo.
- Edge-aware snapping, graph cuts/GrabCut, geodesic propagation, bilateral solvers, and additional
  interactive correction models are out of scope now and in future phases unless the architect
  explicitly reopens the decision.
- Do not implicitly schedule or prototype those techniques and do not add related dependencies,
  model assets, or runtime paths under the current contract.

### Affected Phases / Consequences
- PHASE_21 — finish the two-zone brush using the existing SlimSAM and local-fusion architecture
  only.
- Future phases — preserve this deferral as a scope constraint; a new explicit architect request is
  required before evaluating or implementing any listed advanced technique.

## 2026-07-23 — Brush-guided object correction approved

**Type**: spec-change
**Author**: AI (spec-sync)
**Triggered by**: architect manual review found Phase-17 points, boxes, semantic strokes, mask
scores, and manual object layers too difficult and unpredictable for the primary user journey, then
approved the proposed brush-only guided contract

### Changes / Decision
- `SPEC.md` v1.13 adds Phase 21 and makes one translucent semantic brush the primary guided UI:
  green `keep`, red `remove`, adjustable size, bounded undo/redo, clear, explicit recompute, visual
  mask alternatives, and continuation through matting, edge cleanup, exact correction, background,
  and download.
- SlimSAM remains the model and reuses the pinned q8/WASM graphs plus same-image embedding. Visible
  strokes become one compact constraint map and at most 32 balanced prompt samples for the entire
  session; the decoder receives no unbounded per-stroke prompt growth.
- Candidate ranking becomes intent-first and local: evaluate pre-hard-constraint agreement with
  green/red markings, use any finite raw `iou_scores` value only as an internal tie-breaker, prefer
  automatic-base continuity inside the brush-derived edit region, and collapse alternatives with
  local `differenceRatio < 0.001` (0.1%). The UI no longer exposes a SlimSAM score, percentage, or
  "estimate unavailable" message.
- Automatic-base fusion may change only the bounded brush-derived edit region; pixels outside stay
  byte-for-byte unchanged and explicit keep/remove constraints apply last. Direct guided entry
  requires at least one green stroke before recompute. Painting and history actions never trigger
  implicit inference.
- Phase-17 point/box/manual-layer source is retained for rollback and compatibility. Only legacy UI
  exports with no production callsite are marked `@deprecated`; reused worker/session/protocol code
  remains active and unmarked. No model asset, route, API, persistence, analytics payload, or
  environment variable is added.

### Affected Phases / Consequences
- PHASE_21 — new pending phase owns the brush UI, bounded sampling, candidate ranking, local fusion,
  legacy policy, deterministic cross-browser coverage, and available-host real-model evidence.
- PHASE_16–20 remain completed historical contracts and require no `NEEDS_REVIEW` marker. Phase 21
  supersedes only Phase 17's public interaction; it does not claim the existing implementation
  already behaves as brush-only.
- `STATE.md` § Current Contract remains unchanged until Phase 21 is implemented, gated, and closed.

## 2026-07-22 — Phase 20 complete

**Type**: phase-completion
**Author**: AI (context-update)
**Triggered by**: PHASE_20 automated gate passed and the architect requested documentation,
completion of all remaining fixes, and local fixation without a remote push

### Changes / Decision
- Added deterministic, off-main-thread foreground-colour estimation, conservative soft-edge
  decontamination, connected-component cleanup, dirty patches, cancellation/disposal, exact hard
  constraints, non-accumulating reruns, and one source for preview/download recomposition.
- Added bilingual optional cleanup controls with accessible applied/unchanged/recoverable-error
  outcomes across automatic, guided, refined, and selected settled-batch flows.
- Fixed the supplied large-image incident by bounding ViTMatte input to 1024×1024, restoring matte
  dimensions, and adding finite Balanced WebGPU→WASM and Maximum fp32→q8→q8/WASM recovery.
- Enforced the eight-category synthetic quality gate and available-host runtime thresholds. The
  exact serialized real run passed on WASM: automatic 20,929 ms; Balanced 4,947/158 ms cold/warm;
  Maximum 19,121/165 ms; cleanup 187 ms; generated 2500×2500 input bounded to 1024×1024 and restored
  in 15,710.4 ms without fallback. Memory remained honestly `unavailable`.
- COOP/COEP remains deferred because no isolated A/B benefit or complete production resource
  compatibility evidence justified changing headers. No backend, route, model asset, analytics
  payload, diagnostic intake, or persistent user data was added.
- Gate evidence passed: production container build/health/smoke, 252 unit tests, TypeScript, lint
  (zero errors; one pre-existing Fast Refresh warning), Prettier, Steiger, model-manifest sync, 248
  cross-browser E2E tests with 4 expected feature-flag skips, real IS-Net smoke, and the real Phase
  20 hybrid/runtime test.

### Affected Phases / Consequences
- Phase 20 closes the planned roadmap with an additive, client-only foreground-quality layer and
  durable large-input/fallback compatibility rules. No next phase is inferred.
- WebGPU on the available host and physical Firefox/Safari/iOS/Android devices remain unverified;
  deterministic engine coverage is not presented as a physical-device claim.

## 2026-07-22 — Large-image ViTMatte runtime incident accepted for Phase 20

**Type**: feedback
**Author**: architect + AI reproduction
**Triggered by**: a voluntarily supplied local image failed both Balanced and Maximum soft-edge
refinement while a smaller control image succeeded

### Changes / Decision
- Reproduced the failure without persisting the image or filename: a 2500×2500 source generated a
  2086×2253 focus crop, which Transformers.js padded to 2112×2272 and passed unchanged to ViTMatte;
  ONNX Runtime Web WASM then failed with `OrtRun`/`SafeIntOnOverflow`. A 400×400 control completed
  on Balanced/WASM with no fallback.
- Root cause is the missing inference-size bound, not upload misuse or a corrupt JPEG. The current
  processor pads to a multiple of 32 but does not resize, despite Phase 19's bounded-crop intent.
- Phase 20 review must bound and restore ViTMatte input, cover the large-input path without
  committing private fixtures, complete Balanced WebGPU→WASM recovery, and make foreground-cleanup
  applied/unchanged/error outcomes visible without raw diagnostics.
- The architect authorized conservative corpus/runtime thresholds and completion of all remaining
  Phase-20 work. Thresholds are release regression gates, not promises for untested hardware.

### Affected Phases / Consequences
- PHASE_20 owns the compatibility fix, focused regression, runtime evidence, and durable gotcha.
- PHASE_19 remains historically complete; its runtime evidence used a 1×1 fixture and therefore did
  not exercise source-sized ViTMatte memory/shape behavior.

## 2026-07-22 — Phase 19 complete

**Type**: phase-completion
**Author**: AI (context-update)
**Triggered by**: PHASE_19 automated gate passed with both production ViTMatte variants and the
selected-only lifecycle verified on the available host

### Changes / Decision
- Added production Distinctions-646 q8 `balanced` and fp32 `maximum` refinement over deterministic
  trimaps and bounded focus crops, with hard constraints re-applied after source-sized restoration.
- Integrated lazy bilingual refinement into automatic, accepted-guided, and selected settled-batch
  results while preserving exact correction, background replacement, individual/ZIP download, and
  reset flows.
- Added explicit automatic/guided/ViTMatte disposal acknowledgements, selected-only warm reuse,
  maximum → balanced → deterministic recovery, shared CDN-to-pinned-upstream loading, immutable
  manifest entries, and full-response-only Service Worker caching.
- Available-host evidence completed both q8/fp32 cold and warm WASM runs with no fallback, preserved
  the hard foreground constraint, and honestly recorded peak memory and WebGPU as unavailable.
- Gate evidence: production container build/health/smoke, generated code, TypeScript, Steiger, 228
  unit tests, 50 focused tests, 20 focused cross-browser refinement passes, 212 default-disabled
  cross-browser passes with 12 expected skips, real IS-Net inference, and serialized real q8/fp32
  ViTMatte refinement all passed.

### Affected Phases / Consequences
- PHASE_20 can consume the two production refinement modes, actual-path/fallback metadata, hard
  constraint precedence, and one-heavy-stage lifecycle for foreground-colour decontamination and
  final device/runtime hardening.
- No route, server endpoint, database, analytics payload, or persistent private image data was
  added. Production CDN deployment remains deferred under the existing local-only Phase 17–20
  decision.

## 2026-07-22 — Phase 18 complete

**Type**: phase-completion
**Author**: AI (context-update)
**Triggered by**: PHASE_18 automated gate passed after architect-supplied WebGPU evidence and final
dual-variant policy approval

### Changes / Decision
- Extended the opt-in model lab with pinned ViTMatte Composition-1k and Distinctions-646 q8/fp32
  variants, deterministic trimap/crop corpus generation, alpha/boundary metrics, classified runtime
  failures, sequential disposal/cancellation, and privacy-safe schema-v2 export.
- Recorded successful WASM and architect-supplied WebGPU matrices. Both paths completed all 32
  ViTMatte case/model runs; unavailable peak-memory APIs remain explicitly `unavailable`.
- Closed Phase 18 with Distinctions-646 q8 as Phase-19 `balanced`/fallback and fp32 as the
  WebGPU-oriented `maximum` mode. No Phase-18 production model/CDN mapping was changed.
- Gate evidence: production container build/health and smoke, generated code, TypeScript, Steiger,
  208 unit tests, 15 focused tests, 12 enabled-lab browser passes, 192 default-disabled
  cross-browser passes, real IS-Net inference, and the serialized real ViTMatte smoke passed.

### Affected Phases / Consequences
- PHASE_19 receives the dual-variant policy, pinned graph identities, resource disclosures, hard
  trimap constraints, selected-only lifecycle, and fp32 → q8 → deterministic fallback contract.
- PHASE_20 must validate both refinement modes and fallback behavior in the complete pipeline.
- The phase is additive and evaluation-only: no API, database, persistent user data, analytics
  payload, public route, or production model asset was added.

## 2026-07-22 — Dual-variant ViTMatte refinement approved

**Type**: spec-change
**Author**: `v.godlevskiy` (via AI spec-sync)
**Triggered by**: architect review of the Phase-18 WebGPU benchmark and explicit request to retain
both q8 and fp32 in the Phase-19 architecture

### Changes / Decision
- Phase 19 will expose Distinctions-646 q8 as the compact/WASM-safe `balanced` mode and fp32 as the
  best-soft-alpha `maximum` mode recommended on confirmed WebGPU when the user accepts the larger
  first download.
- These are selected-only alternatives, not an ensemble: no eager dual download, no concurrent
  residence, and no blending. Cache Storage may retain either graph after explicit use.
- The bounded recovery chain is fp32 → q8 → deterministic guided fusion. Each transition preserves
  source pixels, prompts, trimap, and the prior matte, disposes the failed pipeline, and never loops.

### Affected Phases / Consequences
- PHASE_18 — its evidence record now combines the automated WASM run with the architect-supplied
  WebGPU export and produces a production variant policy rather than a single winner.
- PHASE_19 — its future phase contract must include pre-load size disclosure, capability-aware mode
  recommendation, explicit user choice, selected-only lazy loading/disposal, refinement concurrency
  `1`, CDN pins for both graphs, and deterministic fallback/disposal tests.
- PHASE_20 — must validate both refinement modes and the fallback chain in the full hybrid pipeline.
- The shipped contract through PHASE_17 is unchanged; no endpoint, persistence, analytics payload,
  or Phase-18 production model asset is added by this specification update.

## 2026-07-16 — Phase 17 complete

**Type**: phase-completion
**Author**: AI (context-update)
**Triggered by**: PHASE_17 functional gate passed and the architect explicitly accepted the final
external-model gate exception, requesting local merge without deployment

### Changes / Decision
- Replaced one-shot guided selection with cumulative positive/negative points, target boxes,
  semantic keep/remove strokes, alternative mask candidates, multiple object layers, bounded
  delta-only undo/redo, and latest-revision-wins SlimSAM orchestration.
- Added deterministic fusion over the existing automatic matte, explicit constraint precedence,
  accessible/localized explanations for layers, mask scores and blue kept-area overlays, robust
  invalid-score handling, prompt-history hotkeys, and StrictMode-safe blob preview lifecycle.
- Gate evidence: production container build/health and container-network smoke passed; generated
  code, TypeScript, ESLint, Steiger, 198 unit tests, 26 focused tests, the 192-pass configured
  cross-browser matrix, the 8-pass Phase-17 matrix, and real IS-Net inference through the production
  CDN passed. The serialized real SlimSAM smoke also passed earlier on this host and is recorded in
  `PHASE_17_RUNTIME_EVIDENCE.md`.
- During the final repeat, Hugging Face returned 503/504/timeouts while SlimSAM was not yet present
  on the undeployed production CDN. The architect explicitly accepted that external outage as a
  non-blocking gate exception; no deployment or model sync was performed.

### Affected Phases / Consequences
- Additive client-only contract: no endpoint, persistent data, analytics payload, model pin, or
  environment variable was added.
- PHASE_18 may consume the completed iterative guided-editor baseline for browser matting research.
- Remote publication and deployment remain deferred under the 2026-07-15 local-only decision.

## 2026-07-15 — Phases 17–20 remain local until final manual acceptance

**Type**: decision
**Author**: `v.godlevskiy` (via AI agent)
**Triggered by**: architect requested completing all remaining phases and local verification before
publishing the accumulated work or deploying it

### Changes / Decision
- PHASE_17–20 are developed, gated, reviewed, committed, merged, and tagged locally. No branch,
  `main` commit, or phase tag is pushed to a remote during this sequence.
- No deployment is performed after an individual remaining phase. The architect manually tests the
  completed local pipeline through PHASE_20 first.
- Push to remote `main` and production deployment require explicit architect approval after all four
  phases are complete, their automated gates pass, and local manual acceptance is finished.

### Affected Phases / Consequences
- PHASE_17–20 — local commits, merges, tags, and phase lifecycle documentation continue normally;
  remote publication and deployment are deliberately deferred until the consolidated acceptance.
- CI/CD triggered by a push to `main` is intentionally not exercised during intermediate phases;
  host-only gates and local container-parity smoke checks remain mandatory as defined in STACK.md.

## 2026-07-13 — Device incident feedback remains fully manual

**Type**: decision
**Author**: AI (spec-sync)
**Triggered by**: architect clarification that users will report incidents directly in Telegram
and may attach a photo, without any product or infrastructure support workflow

### Changes / Decision
- `SPEC.md` v1.11 keeps device-compatibility feedback entirely manual through the existing Telegram
  channel. Users may voluntarily send the affected image, screenshot, and ordinary environment
  description outside the application's processing path.
- No diagnostic snapshot/export, incident form, upload endpoint, automated collection, device
  registry, new analytics event/payload, support storage, backend, or infrastructure is planned.
- When a report is reproducible, the normal development response is a focused regression test or
  documented compatibility rule; there is no separate incident subsystem.
- PHASE_20 retains runtime hardening but no longer includes a diagnostic-reporting feature or
  diagnostic infrastructure.

### Affected Phases / Consequences
- PHASE_17–20 — validation remains automated and available-host-based; real-device reports are
  handled manually and only generate product/test work when a concrete issue is reproduced.
- The v1.10 Project Log reference below to a locally generated diagnostic snapshot is superseded by
  this clarification. The physical-device matrix remains removed from release gates.
- Current runtime, API, analytics, persistence, and infrastructure contracts are unchanged.

## 2026-07-13 — Physical-device lab removed from release gates

**Type**: decision
**Author**: AI (spec-sync)
**Triggered by**: architect decision that the project has no resources for a representative
physical-device test lab and will investigate concrete devices from real-user feedback

### Changes / Decision
- `SPEC.md` v1.10 removes the representative physical weak/WASM and powerful/WebGPU matrix from
  phase, merge, and deployment prerequisites. Coverage claims remain limited to environments that
  actually ran.
- Inference changes instead require configured cross-browser E2E, available-host real-model smoke,
  focused capability/fallback/resource-disposal checks, and applicable quality, latency, and memory
  regression thresholds.
- Real-device compatibility becomes incident-first: voluntarily shared, locally generated,
  image-free diagnostics support reproduction; a reproduced incident must produce a focused
  regression or documented compatibility rule. Passive analytics remain aggregate-only.
- PHASE_20 is renamed **Foreground Edge Quality & Runtime Hardening** and owns this sustainable
  validation/incident-response contract plus edge-quality work, not a hardware inventory.

### Affected Phases / Consequences
- PHASE_16 — its available-host evidence remains valid; the previously deferred physical matrix is
  no longer an outstanding prerequisite.
- PHASE_17–20 — may proceed and deploy after their reproducible automated, quality, and
  available-host gates pass; unavailable physical hardware does not create a blocker.
- The earlier v1.9 Project Log statements that made Phase 20's physical matrix mandatory are
  superseded by this decision and retained below only as append-only history.
- Current runtime contract is unchanged; this changes future validation and release policy only.

## 2026-07-13 — Phase 16 complete

**Type**: phase-completion
**Author**: AI (context-update)
**Triggered by**: PHASE_16 gate passed and the architect requested a local merge without deployment

### Changes / Decision
- Replaced the two-option quality toggle with explicit IS-Net q8, IS-Net fp32, and opt-in BEN2 fp16
  production modes, truthful size/speed/capability copy, serialized model lifecycle, and a single
  capability/model/OOM fallback to IS-Net q8 that preserves the local image.
- Added a lazy SlimSAM q8 point-or-box guided flow with responsive coordinate mapping, same-image
  embedding reuse, source-sized `AlphaMatte` output, accessible controls, and continuation through
  the existing brush correction, background replacement, batch, and download pipeline.
- Added immutable BEN2/SlimSAM manifest entries and fixed the production worker's bootstrap source
  selection so IS-Net registry probes and weights also use its pinned commit SHA rather than
  `resolve/main`.
- Gate passed: production container build/health and container-network smoke; generated code,
  TypeScript, Steiger, manifest verification, ESLint, Prettier, 186 unit tests, deterministic
  cross-browser E2E (138 passed, 3 intentionally skipped), pinned real IS-Net inference, and the
  serialized Phase-16 real BEN2-fallback plus SlimSAM point/box smoke. Two Phase-12 language-link
  tests were also rerun in isolation (2/2 passed) after a transient Vite module-load failure under
  parallel Mobile Safari emulation.

### Affected Phases / Consequences
- Additive client-only contract: no image endpoint, server-side persistence, analytics payload,
  account, or new environment variable was introduced.
- Representative physical weak/WASM and powerful/WebGPU acceptance is deliberately not claimed by
  this local closeout. Per SPEC v1.9 it is consolidated into Phase 20 and remains mandatory before
  deploying the combined Phases 16–19 pipeline.
- PHASE_17 may build cumulative positive/negative prompts and semantic strokes on the completed
  single-point/box guided baseline.

## 2026-07-13 — Iterative guided matting pipeline approved

**Type**: spec-change
**Author**: AI (spec-sync)
**Triggered by**: architect approval of the researched multi-prompt, semantic-brush, trimap/matting,
and foreground-edge pipeline and request to plan it after Phase 16

### Changes / Decision
- `SPEC.md` v1.9 extends guided correction from Phase 16's one positive point or target box into a
  staged human-in-the-loop pipeline: cumulative positive/negative prompts and semantic strokes,
  multiple object layers, local progressive merge, confidence-aware trimaps, optional alpha
  refinement, and foreground-colour decontamination. The existing pixel brush remains the final
  exact correction layer.
- Added Phases 17–20: Iterative Guided Object Editor; Browser Interactive Matting Lab; Production
  Trimap & Alpha Refinement; Foreground Edge Quality & Device Hardening. Evaluation precedes any
  production model addition, non-production-compatible licenses are evidence-only, and failures
  retain a deterministic guided-fusion fallback.
- Phase 16 keeps its implemented one-point/box contract. Its available-host real-model smoke is the
  merge criterion for this no-deploy closeout; the explicitly unproven representative physical
  weak/powerful matrix is consolidated into Phase 20 and remains mandatory before Phases 16–19 are
  deployed together.

### Affected Phases / Consequences
- PHASE_16 — gate evidence wording is narrowed to what the development host actually proves; no
  product behavior or implementation scope is retroactively expanded.
- PHASE_17–20 — new pending phases own the approved iterative editor, evaluation, production
  refiner, edge quality, and consolidated physical-device acceptance.
- PHASE_01–15 remain valid; Current Contract is unchanged because the new entities are planned, not
  yet implemented.

## 2026-07-13 — Phase 15 complete

**Type**: phase-completion
**Author**: AI (context-update)
**Triggered by**: PHASE_15 gate passed and the architect completed the real WebGPU comparison

### Changes / Decision
- Added the opt-in, `noindex` `/dev/model-lab` with an immutable IS-Net q8/fp32, BEN2 fp16, and
  MVANet q4 registry, sequential worker execution, capability/timing/error capture, local result
  previews, pairwise preferences, and privacy-safe JSON export. Candidate weights remain outside
  production loading, the VPS manifest, sitemap, navigation, analytics, and persistent storage.
- Verified BEN2 and MVANet in real Chromium/WASM and evaluated 20 outputs from the architect's
  10-image light-on-light corpus. BEN2 led MVANet 6–1 with three ties and preserved the original
  pale album substrate substantially better.
- Verified all four models on the architect's Windows WebGPU device. BEN2 won two difficult images,
  IS-Net fp32 won two, and MVANet won none. Phase 16 will retain IS-Net q8/fp32, add BEN2 fp16 as
  an optional heavy automatic mode, exclude MVANet q4, and continue the approved SlimSAM guided
  selection work.
- Gate passed: production container build/health, TypeScript, 173 unit tests, seven focused tests,
  Steiger, model-lab cross-browser E2E, the existing UI matrix (with a clean 26/26 WebKit rerun
  after a transient Vite `ECONNRESET`), production real-model smoke, candidate real-model smoke,
  and container-network smoke.

### Affected Phases / Consequences
- Additive internal evaluation route, types, and build flag; no production inference behavior,
  public API, server-side persistence, or user-image privacy contract changed.
- PHASE_16 consumes BEN2 as the selected heavy automatic model and does not need to evaluate MVANet
  again.

## 2026-07-13 — Browser model evaluation and guided selection approved

**Type**: spec-change
**Author**: AI (spec-sync)
**Triggered by**: architect approval to retain both IS-Net modes, compare BEN2/MVANet objectively,
and add SlimSAM-guided object selection without domain fine-tuning

### Changes / Decision
- `SPEC.md` §1–§3, §5–§7: added an opt-in, client-only evaluation contract for IS-Net q8,
  IS-Net fp32, BEN2 fp16, and MVANet q4. Candidate models remain lazy, sequential, upstream-only,
  and outside production inference until a measured decision is recorded.
- `SPEC.md` §5 and §6: approved SlimSAM positive-point/bounding-box selection as a distinct guided
  recovery flow; it produces the existing `AlphaMatte` and remains fully in-browser.
- `SPEC.md` §8–§9: added Phase 15 (evaluation lab) and Phase 16 (production modes + SlimSAM),
  and removed SAM-style correction from the deferred backlog. Domain fine-tuning is explicitly out
  of scope.

### Affected Phases / Consequences
- PHASE_15 — new phase owns the typed registry, flagged lab, measurements, export, and model decision.
- PHASE_16 — new phase consumes the Phase-15 winner and implements guided SlimSAM selection.
- PHASE_01–14 remain valid: the existing IS-Net q8/fp32 production mapping and client-only privacy
  invariant do not change.

## 2026-07-13 — Phase 14 complete

**Type**: phase-completion
**Author**: AI (context-update)
**Triggered by**: PHASE_14 gate passed and the public Cloudflare/VPS rollout was verified

### Changes / Decision
- Published the manifest-pinned ISNet `q8`/`fp32` model and ONNX Runtime Web assets from the VPS at
  `cdn.cutbg.art/models`, with Let's Encrypt TLS, Cloudflare Cache Rules, CORS, immutable cache
  headers, byte ranges, and correct JavaScript/WASM MIME types.
- Replaced the obsolete BiRefNet/R2 upload path with a host-directory synchronizer and CI delivery
  of the deployment contract; production build variables and the Cloudflare Analytics token are
  configured in GitHub Actions without hardcoded credentials.
- Added serialized CDN-to-upstream loading with strict revision pinning, rejection-safe retry, and
  network-diagnostic real-model coverage. Public checks confirmed `200`, Range `206`, cache `HIT`,
  CDN-only inference, and successful pinned Hugging Face fallback with an unreachable CDN.
- Gate passed: production container build/health, TypeScript, 164 unit tests, ESLint (zero errors),
  formatting, Steiger, 111/111 cross-browser UI tests, serialized real-model smoke, and container
  smoke. No user image or inference result is stored by the CDN or VPS.

### Affected Phases / Consequences
- Phase plan is complete through PHASE_14; the VPS-backed model CDN is the preferred production
  path and the upstream sources remain an automatic resilience path.
- Additive public-static endpoint and runtime-source contract; no server-side product database or
  new environment key was introduced.

## 2026-07-13 — VPS-backed model CDN replaces the R2 requirement

**Type**: spec-change
**Author**: AI (spec-sync)
**Triggered by**: architect approval to plan and implement the card-free model delivery path as Phase 14

### Changes / Decision
- `SPEC.md` §4, §6, §6.1: production model/WASM delivery now prefers pinned assets on VPS disk,
  served by Nginx at proxied `cdn.cutbg.art` and cached by Cloudflare; R2 is no longer required.
- Runtime resilience is explicit: a failed private-CDN load retries the same pinned model revision
  through Hugging Face Hub and restores the upstream ONNX Runtime WASM source.
- `SPEC.md` §8: added Phase 14, including manifest sync, deploy automation/configuration, cache
  headers/rule, production env wiring, analytics token, and primary/fallback verification.

### Affected Phases / Consequences
- PHASE_14 — new phase owns the infrastructure and runtime implementation.
- Existing completed phases remain valid: their app behavior and client-only inference invariant does
  not change, and their upstream model path remains supported.

## 2026-07-13 — Phase 13 complete

**Type**: phase-completion
**Author**: AI (context-update)
**Triggered by**: PHASE_13 gate passed, production smoke passed, and GitHub Actions deployment completed

### Changes / Decision
- Published the production application at `https://cutbg.art` and `https://www.cutbg.art` with
  nginx, Let's Encrypt TLS, Umami/Postgres, Uptime Kuma, and healthy Docker Compose services.
- Replaced the four scenario-page placeholder presentations with the architect-provided final
  assets, preserving their intrinsic dimensions and aspect ratios with a responsive `40rem` cap;
  added bilingual Playwright coverage for square and portrait examples.
- Hardened first-certificate bootstrap with Certbot standalone issuance and aligned Compose/CI on
  `ghcr.io/avatarsik6699/cutbgart:latest`. GitHub Actions run `29211248810` verified lint/test →
  image build/GHCR publish → authenticated SSH deploy from `main` end to end.
- Added explicit clean-checkout generation for Paraglide and TanStack Router outputs before CI
  analysis/build. Cloudflare Web Analytics and the custom R2 model endpoint remain optional and
  unset until the Cloudflare zone and account resources are provisioned; upstream model fallback
  remains functional.

### Affected Phases / Consequences
- Phase plan is complete through PHASE_13; production deploy and launch contracts are active.
- No server-side product database, public API, or new application environment key was introduced.

## 2026-07-12 — Phase 12 complete

**Type**: phase-completion
**Author**: AI (context-update)
**Triggered by**: PHASE_12 gate passed and all Architect Review Notes resolved

### Changes / Decision
- Added full Russian/English localization with Paraglide JS: Russian remains the unprefixed base
  locale, English is served under `/en`, the language switcher preserves the current page, and all
  localized routes emit matching social metadata and `hreflang` alternates.
- Added `/privacy` and all English route counterparts, including localized scenario slugs; upgraded
  `/sitemap.xml` to emit both locales and their alternate links.
- Added the `cutbg` site identity, favicon/app-icon/manifest and social-image assets, shared
  header/footer/shell chrome, Telegram feedback links, and bilingual launch content.
- Extracted the duplicated image-tool composition into the responsive `widgets/tool-workspace`
  slice and completed the reviewed batch-workspace refinements. No persistent data, environment
  variable, or hand-authored domain-model contract was added.

### Affected Phases / Consequences
- Additive route, generated-locale, presentation, and composition changes; existing Russian URLs and
  client-side processing/privacy contracts remain compatible.
- PHASE_13 may proceed with hardening and launch.

## 2026-07-12 — Spec change: Phase 12 split into Localization/Branding/Launch Content (12) and Hardening & Launch (13); i18n scope added

**Type**: spec-change
**Author**: AI (spec-sync)
**Triggered by**: Architect request to flesh out the terse Phase 12 stub before launch — layout/grid
redesign, branding (public name "cutbg", wordmark logo, one accent color), value-prop/benefits
content, a Telegram feedback channel, favicon/OG/SEO metadata, and the still-unimplemented §7.2
privacy-policy page — plus, added mid-conversation, full bilingual (ru/en) internationalization
since the product targets both audiences, not just the Russian-SEO scenario-page audience Phase 06
built for.

### Changes / Decision
- `SPEC.md` §8: split the single-line Phase `12` into two phases — new `12` = "Localization,
  Branding & Launch Content" (everything below), and `13` = "Hardening & Launch" (verbatim previous
  `12` content, renumbered, unchanged).
- `SPEC.md` new §5.5 "Internationalization": Paraglide JS (`@inlang/paraglide-js`), chosen over
  `react-i18next` for its first-party, documented TanStack Start SSR integration (confirmed via
  Context7). URL strategy: `ru` = base/unprefixed locale (preserves the four existing Russian
  scenario slugs and `/`, `/about` exactly as-is), `en` = prefixed (`/en/...`). Language switcher in
  the new site header; `hreflang`/`x-default` alternates; locale-aware sitemap.
- `SPEC.md` §5.1: added `/privacy` + `/en/privacy` (Required, Phase 12) and noted every existing page
  also gets an `/en/...` counterpart; English scenario-page copy must be genuinely unique, not a
  mechanical translation.
- `SPEC.md` §5.2: new `widgets/tool-workspace` slice — first use of the `widgets` FSD layer
  (previously deliberately omitted; the reversal is scoped to this one slice), extracting the tool
  composition currently duplicated across `pages/home` and the four Phase-06 scenario pages and
  replacing the flat vertical stack with a responsive grid (single column mobile, two-column desktop);
  new `pages/privacy` slice; `shared/ui` gains `site-header`/`site-footer`/`site-shell`.
- `SPEC.md` §6: Architecture row updated to reflect the scoped `widgets` layer reversal; new `i18n`
  row for Paraglide JS.
- `SPEC.md` §7.2: cross-referenced `/privacy` as fulfilling the pre-existing "image never leaves your
  device" static-page requirement, which existed in the spec since v1.0 but was never implemented in
  Phases 01–11 — a genuine gap, not new scope.
- `SPEC.md` §7.5: added favicon/app-icon set + `site.webmanifest`, OpenGraph/Twitter Card meta, and
  `hreflang`/locale-aware-sitemap requirements.
- `SPEC.md` Metadata table: added the public brand name (`cutbg`, wordmark-only logo, no repo/
  `package.json` rename) and the Telegram feedback channel URL.
- Document Version `v1.4` → `v1.5`, Date → `2026-07-12`.
- No change to `docs/STATE.md` § Current Contract — nothing shipped changed; neither Phase 12 nor
  Phase 13 is scaffolded yet.

### Affected Phases / Consequences
- PHASE_01–PHASE_11 — unaffected (`✅ done`, no contracts of already-shipped phases changed). Note
  for future implementation: Phase 12's `widgets/tool-workspace` extraction will touch `pages/home`
  and the four Phase-06 scenario pages' composition/layout, but none of their already-shipped
  feature contracts change.
- PHASE_12, PHASE_13 — not yet scaffolded; `/phase-init 12` and `/phase-init 13` should target this
  entry's §8 numbering (`12` = Localization, Branding & Launch Content; `13` = Hardening & Launch,
  unchanged content carried over from the old single `12` row).

## 2026-07-12 — Phase 11 complete

**Type**: phase-completion
**Author**: AI (context-update)
**Triggered by**: PHASE_11 gate passed (type-check, unit tests, Steiger arch lint, Docker
bootstrap/smoke, and the full `pnpm e2e:full` suite — 63/63 deterministic cross-browser tests plus
the serialized real-model smoke — all green) and all Architect Review Notes resolved

### Changes / Decision
- Added the `features/background-replacement` slice and the `BackgroundFill` union (transparent /
  opaque color / two-stop linear-or-radial gradient preset / in-memory custom image), composited
  behind the cutout through the existing worker-side `OffscreenCanvas` pipeline without any new
  inference pass (SPEC.md §1.3, §2.2, §5.2–§5.4, §7.7, §8).
- Added a keyboard-operable, swatch-based background-fill selector (inline draggable color palette,
  six fixed gradient presets, custom-image file input) wired into both the single-image and
  selected-batch-item `result` flows; a fill choice is item-local in batch mode and survives
  result ⇄ correcting.
- Preview is fully decoupled from encoding: `preview()` only drives an instant local CSS update and
  marks the fill unsaved, with zero worker calls while browsing colors/gradients/images. An explicit
  "Save background" action performs the one PNG recomposite/encode on demand; individual/ZIP
  download and mask-correction entry are gated on the saved (non-`dirty`) state so neither ever
  serves a stale or preview-only file.
- Added Vitest coverage for fill selection and in-memory image lifecycle, plus Playwright coverage
  switching color → gradient → uploaded image in `result` and verifying the downloaded PNG reflects
  each selected fill. No server endpoint, persistence, analytics event, or environment variable was
  added — custom background blobs/object URLs stay client-side and are released on replace/reset.
- Five Architect Review Notes rounds resolved during implementation: continuous native-input preview
  without blocking, item-local fill rendering through the live correction canvas (brush/undo-redo/
  zoom/pan), circular swatches for scannability, checkerboard restricted to the transparent swatch
  only, the inline draggable palette replacing the native color picker (which closed on every click),
  and finally the preview/encode decoupling + explicit Save described above (the debounced-then-
  encode approach still put a full recomposite on the critical path of nearly every interaction).

### Affected Phases / Consequences
- No breaking contract change; `BackgroundFill` and the save/dirty gating are additive to the
  existing `ProcessedImage`/`BatchItem` result contract.
- `use-background-fill` tracks the last-saved fill via `useState`, not a ref read during render — see
  `docs/KNOWN_GOTCHAS.md` § "A hook value derived from a ref read during render silently freezes in
  `renderHook` tests" for the reusable pitfall this phase recorded.

## 2026-07-12 — Phase 11 background-fill runtime decisions

**Type**: decision
**Author**: AI (architect-delegated)
**Triggered by**: Architect delegated the unresolved Phase 11 color, gradient, and custom-image
contracts after `/phase-init 11`.

### Changes / Decision
- Background colors use opaque uppercase sRGB `#RRGGBB`. Transparency remains its own explicit fill
  variant; invalid color values fall back to transparent.
- MVP gradients use exactly two stops at offsets `0` and `1` and six fixed presets: three linear
  (`Sunset`, `Ocean`, `Mint`) and three radial (`Spotlight`, `Peach`, `Night`). Linear geometry is
  deterministic left-to-right; radial geometry is centered and extends to the farthest corner.
  Custom angles, stops, and gradient colors are deferred beyond Phase 11.
- Custom backgrounds accept the existing JPEG/PNG/WebP set up to 20 MB, are downscaled above 4096 px,
  and are rendered with centered aspect-preserving `cover` into the unchanged output dimensions.
  SVG/GIF/remote URLs are not accepted. Replaced resources are released immediately; decode failure
  retains the last valid fill and presents a recoverable error.
- Fill selection is item-local in batch mode. The same recomposited blob drives preview, individual
  download, and ZIP output; changing a fill never reruns inference and never leaves the device.

### Affected Phases / Consequences
- PHASE_11 — all `[TODO: verify]` markers are resolved; implementation and Playwright assertions can
  use deterministic pixel geometry and preset values.
- No server endpoint, persistence, analytics event, environment variable, or privacy-contract change.

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
