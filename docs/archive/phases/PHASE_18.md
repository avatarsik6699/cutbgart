# PHASE 18 — Browser Interactive Matting Lab

<!-- TOKEN BUDGET: keep this file under 10,000 tokens. Be concise. -->

## Phase Metadata

| Field | Value |
|-------|-------|
| Phase | `18` |
| Title | Browser Interactive Matting Lab |
| Status | `✅ done` |
| Tag | `v0.18.0` |
| Depends on | PHASE_17 gate passing |

---

## Phase Goal

Select or reject a browser-side trimap/alpha refiner and any lightweight prompt-model alternative
using reproducible evidence before Phase 19 changes production inference. Extend the existing
opt-in model lab to compare pinned ViTMatte-small Composition-1k and Distinctions-646 q8/fp32
variants, measure quality and runtime behavior, and record an evidence-backed production variant
policy without fetching candidates from public flows or changing the current automatic/guided
pipeline (SPEC.md §5.2, §6–§7.7, §8, §10).

No design references were supplied. The internal lab must reuse the existing design system and
Phase-15 model-lab interaction patterns.

---

## Scope

### Frontend

- [x] `F1` Verify and pin the ViTMatte-small Composition-1k/Distinctions-646 q8/fp32,
  EfficientSAM-Ti, and MobileSAM ViT-T repositories, immutable revisions, graph files,
  preprocessing contracts, and Apache-2.0 license provenance; retain SlimSAM q8 as the existing
  promptable baseline and exclude EdgeSAM (NTU S-Lab License 1.0) plus any
  research-only/non-commercial candidate from production eligibility — _Depends on:_ —
- [x] `F2` Extend the typed model-lab registry and worker protocol for trimap/alpha and promptable
  candidate families, explicit input/output contracts, immutable revisions, sequential lazy
  loading, previous-pipeline disposal, latest-request-wins cancellation, and classified
  load/operator/OOM/inference failures — _Depends on:_ `F1`
- [x] `F3` Add deterministic lab-only trimap/crop preparation plus a licensed-or-synthetic local
  quality corpus covering hair/fur, transparent and thin objects, holes, shadows,
  light-on-light, multiple objects, motion blur, and high-resolution small targets; do not wire
  this evaluation path into `features/refine-matte` production behavior — _Depends on:_ `F2`
- [x] `F4` Add alpha/boundary scoring for IoU, boundary IoU, SAD, MSE, Gradient, and Connectivity,
  plus quantization deltas and interactions-to-accept; keep metric inputs and preview pixels local
  and export only aggregate/image-ordinal evidence — _Depends on:_ `F3`
- [x] `F5` Extend `/dev/model-lab` using the existing design system with an explicit interactive-
  matting opt-in, candidate/license/resource disclosures, sequential corpus runs, comparable alpha
  and boundary previews, progress/cancel/reset states, quality/runtime tables, and a clear
  unsupported/error outcome; disabled builds must never create a worker or fetch candidates —
  _Depends on:_ `F2`, `F4`, `I1`
- [x] `F6` Extend the image-free benchmark export with candidate pins, corpus case ordinals,
  quality scores, cold/warm timing, requested/actual execution path, operator compatibility,
  quantization deltas, classified OOM/failures, and peak-memory observations that explicitly say
  `unavailable` when the browser cannot measure them — _Depends on:_ `F4`, `F5`
- [x] `F7` Add focused registry/license/trimap/metric/export/orchestration tests and deterministic
  Playwright coverage for opt-in, sequential execution, cancellation/stale-result rejection,
  comparison, privacy-safe export, unsupported candidates, and OOM recovery — _Depends on:_ `F6`
- [x] `F8` Run the serialized available-host real-browser matrix for every eligible ViTMatte and
  lightweight prompt candidate on WebGPU and/or WASM as actually supported; record cold/warm
  latency, peak-memory evidence, operator/quantization/quality results, failures, and a written
  ViTMatte variant/prompt-candidate/none policy that gives Phase 19 explicit production inputs —
  _Depends on:_ `F7`, `I2`

### Infra

- [x] `I1` Keep Phase-18 candidates evaluation-only behind the existing
  `VITE_ENABLE_MODEL_LAB` flag: no eager loading, production manifest/CDN entry, Service Worker
  preload, sitemap entry, public navigation, analytics payload, or server upload path —
  _Depends on:_ `F1`
- [x] `I2` Add a host-only serialized Phase-18 real-model Playwright command and image-free
  evidence document; keep it out of Docker, CI, and the normal parallel browser matrix —
  _Depends on:_ `F2`, `F3`, `I1`

<!-- No Backend or Data group: Phase 18 adds no custom API, database, production persistence, or
production model asset. Test execution is governed by Gate Checks + docs/STACK.md. -->

---

## Files

### Create / modify

~~~
src/features/model-lab/index.ts
src/features/model-lab/model/types.ts
src/features/model-lab/model/model-registry.ts
src/features/model-lab/model/model-registry.test.ts
src/features/model-lab/model/matting-quality.ts
src/features/model-lab/model/matting-quality.test.ts
src/features/model-lab/model/benchmark-export.ts
src/features/model-lab/model/benchmark-export.test.ts
src/features/model-lab/model/use-model-lab.ts
src/features/model-lab/model/use-model-lab.test.ts
src/features/model-lab/worker/model-lab.worker.ts
src/features/model-lab/ui/ModelLab.tsx
e2e/model-lab.spec.ts
e2e/matting-lab.real.spec.ts
e2e/fixtures/matting/
package.json
docs/MATTING_EVALUATION.md
docs/STACK.md
docs/PHASE_18.md
docs/STATE.md
~~~

Exact candidate-specific adapter/config files may be added under `src/features/model-lab/` after
`F1` establishes the pinned repositories and graph contracts.

### Do NOT touch

- Production `QualityMode`/`ProcessingMode` mappings or the public processing-mode selector
- Production workers/hooks in `features/remove-background` and `features/select-object`
- `features/refine-matte` production integration — owned by Phase 19
- `models.manifest.json`, `deploy/model-assets/`, Nginx/CDN configuration, or public Service Worker
  asset policy
- Public routes, sitemap, navigation, analytics events, or any server endpoint
- User/private images, filenames, image bytes, or persistent browser storage
- Phase-20 foreground decontamination and cross-origin-isolation research

---

## Contracts

### New persistent data (tables / collections / files)

No automatic runtime persistence. `docs/MATTING_EVALUATION.md` is a repository evidence record
containing only candidate identity/license/pins, corpus category/ordinal, browser/device capability
summary, requested/actual execution path, quality/runtime/memory observations, classified failures,
and the evidence-backed Phase-19 production variant policy.

An explicit user download may export the same image-free JSON evidence. Neither record may contain
source/result/ground-truth pixels, blobs/data URLs, filenames, EXIF/file metadata, prompt
coordinates, or other image-derived identifiers. Licensed/synthetic test fixtures may live only in
the repository corpus declared in Scope; no private user image may be added.

### New API endpoints / RPC methods / events

No new route, server endpoint, analytics event, or external RPC. The existing `GET /dev/model-lab`
shell and its exact `VITE_ENABLE_MODEL_LAB=true` gate are extended client-side; all images,
trimaps, alpha mattes, prompts, scoring, and export assembly remain inside the browser.

The model-lab worker protocol gains trimap/alpha evaluation request, progress, result, cancellation,
and classified-error messages. These are module-internal browser Worker messages, not network APIs.

### New types / models / shared interfaces

```ts
type MattingEvaluationModelId =
  | "vitmatte-small-composition1k-q8"
  | "vitmatte-small-composition1k-fp32"
  | "vitmatte-small-distinctions646-q8"
  | "vitmatte-small-distinctions646-fp32";

type LightweightPromptEvaluationModelId = "efficient-sam-ti" | "mobile-sam-vit-t";

type InteractiveEvaluationModelId =
  | MattingEvaluationModelId
  | LightweightPromptEvaluationModelId;

type CandidateEligibility =
  | "production-eligible"
  | "evidence-only"
  | "rejected-license";

interface InteractiveEvaluationModelProfile {
  id: InteractiveEvaluationModelId;
  family: "matting" | "promptable";
  modelId: string;
  revision: string;
  graphFiles: readonly string[];
  dtype: "q8" | "fp32" | "fp16" | "q4";
  license: string;
  eligibility: CandidateEligibility;
  supportedPaths: readonly InferencePath[];
  approximateBytes: number;
  resourceWarning: string;
}

interface MattingQualityMeasurement {
  caseOrdinal: number;
  modelId: InteractiveEvaluationModelId;
  iou: number | null;
  boundaryIou: number | null;
  sad: number | null;
  mse: number | null;
  gradient: number | null;
  connectivity: number | null;
  interactionsToAccept: number | null;
}

interface InteractiveRuntimeMeasurement {
  caseOrdinal: number;
  modelId: InteractiveEvaluationModelId;
  requestedPath: InferencePath;
  actualPath: InferencePath;
  status: "success" | "unsupported" | "error";
  coldLoadMs: number;
  warmInferenceMs: number;
  peakMemoryBytes: number | null;
  memoryObservation: "measured" | "estimated" | "unavailable";
  fallbackReason?: string;
  errorCode?:
    | "license-rejected"
    | "operator-unsupported"
    | "model-load-failed"
    | "device-out-of-memory"
    | "processing-failed";
}

interface InteractiveMattingBenchmarkExport {
  schemaVersion: 2;
  createdAt: string;
  capabilities: ModelLabCapabilities;
  candidates: InteractiveEvaluationModelProfile[];
  corpusCaseCount: number;
  quality: MattingQualityMeasurement[];
  runtime: InteractiveRuntimeMeasurement[];
  decision: InteractiveEvaluationModelId | "none";
}
```

Exact ViTMatte and prompt-candidate repository revisions, graph filenames, and
preprocessing/trimap tensor shapes are intentionally assigned to `F1`: Phase 18 must pin and verify
the browser artifacts before adding them to the registry. The candidate list and license gate are
already closed; implementation does not require an additional architect decision.

### New env vars

None. Phase 18 reuses `VITE_ENABLE_MODEL_LAB`; candidates remain upstream, opt-in evaluation assets
and are not added to the production CDN configuration in this phase.

---

## Gate Checks

Run `/phase-gate 18` only after all candidates have a recorded license verdict and `F8` records an
explicit production variant policy. Standard commands come from `docs/STACK.md`, plus focused checks:

```bash
pnpm generate:code
pnpm vitest run src/features/model-lab
VITE_ENABLE_MODEL_LAB=true pnpm e2e e2e/model-lab.spec.ts
pnpm e2e:matting-lab-real
pnpm tsc --noEmit
pnpm exec steiger ./src
```

The deterministic model-lab flow must be covered across the configured browser matrix. Real-model
verification is host-only and serialized, never Docker or CI, and may claim compatibility only for
the paths actually exercised. Record unavailable memory APIs as `unavailable`; do not infer a peak
number. A candidate with an incompatible license, unsupported graph/operators, unacceptable alpha
quality/quantization loss, OOM behavior, or unsafe weak-device fallback remains evidence-only or is
rejected; Phase 18 is successful even when the defensible decision is `none`.

The default container-network smoke remains sufficient because this phase adds no route or server
contract.

---

## Architect Review Notes

- [x] No architect review issues recorded

---

## Implementation Notes

- Initial promptable shortlist: EfficientSAM-Ti and MobileSAM ViT-T, both Apache-2.0 in their
  official repositories. Existing Apache-2.0 SlimSAM q8 is the comparison baseline, not a new
  candidate. EdgeSAM is excluded from the production-eligible shortlist because its official
  repository uses the separate NTU S-Lab License 1.0. `F1` still owns immutable artifact pins and
  must reject any redistributed ONNX file whose provenance or license cannot be verified.
- F1 found no immutable first-party hosted ONNX graph for EfficientSAM-Ti or MobileSAM ViT-T, so
  both remain visible evidence-only candidates with classified `operator-unsupported` outcomes;
  unverified third-party weights were intentionally not loaded.
- The automated Chromium host exercised WASM; the architect then supplied a Yandex/Chromium WebGPU
  export from `2026-07-22`. All 32 ViTMatte case/model runs succeeded on each exercised path; peak
  memory remained honestly unavailable. `docs/MATTING_EVALUATION.md` selects both Distinctions-646
  variants for Phase 19: q8 as the compact/WASM-safe `balanced` mode and fallback, fp32 as the
  best-soft-alpha `maximum` mode recommended on confirmed WebGPU. They are selected-only
  alternatives, never an eagerly loaded or concurrently resident ensemble.
- Final gate: production container build/health and container-network smoke passed; generated code,
  TypeScript, Steiger, 208 unit tests, 15 focused model-lab tests, the enabled-lab 12-pass/4-skip
  matrix, the default-disabled 192-pass/12-skip cross-browser matrix, real IS-Net inference, and the
  serialized real ViTMatte WASM matrix all passed. Because local `.env` intentionally enables the
  lab for manual work, the default-disabled matrix used an explicit
  `VITE_ENABLE_MODEL_LAB=false`; the corresponding enabled-lab matrix was tested separately.

---

## Atomic Commit Message

```
feat(phase-18): evaluate browser matting candidates
```

---

## Post-Phase Checklist

- [x] All Scope checkboxes checked (or deferred in Architect Review Notes)
- [x] All automated gate checks green
- [x] All architect review notes resolved
- [x] `docs/STATE.md` updated — run `/context-update 18`
- [x] Committed atomically on `feat/phase-18` branch
- [x] Tag created after local merge to `main`: `git tag -a v0.18.0 -m "Phase 18: Browser Interactive Matting Lab"`
