# PHASE 16 — Production Model Modes & Guided Selection

<!-- TOKEN BUDGET: keep this file under 10,000 tokens. Be concise. -->

## Phase Metadata

| Field | Value |
|-------|-------|
| Phase | `16` |
| Title | Production Model Modes & Guided Selection |
| Status | `✅ done` |
| Tag | `v0.16.0` |
| Depends on | PHASE_15 gate passing |

---

## Phase Goal

Promote BEN2 fp16 from the Phase-15 lab into an optional production automatic mode while retaining
IS-Net q8/fp32, with truthful model characteristics and capability-aware recovery on weak devices.
Add a fully client-side SlimSAM point/box flow that produces the existing `AlphaMatte` and continues
through brush correction, result, background replacement, and download (SPEC.md §1.3, §5.2–§5.4,
§6–§7.7, §8).

No Figma or other design assets were supplied. New controls must extend the existing responsive,
accessible tool workspace and design system.

---

## Scope

### Frontend

- [x] `F1` Replace the two-option quality toggle with a user-facing processing-mode selector for IS-Net q8, IS-Net fp32, and BEN2 fp16; show localized approximate download size, relative speed, execution requirements, and memory warning for every mode while preserving the existing IS-Net preference behavior — _Depends on:_ —
- [x] `F2` Integrate BEN2 fp16 into the production worker with explicit-selection lazy loading, same-session warm reuse, one-heavy-pipeline-at-a-time disposal, truthful progress/status, and no eager fetch during SSR, hydration, upload, or selection of either IS-Net mode — _Depends on:_ `F1`, `I1`
- [x] `F3` Add capability-aware heavy-mode recovery: when WebGPU is absent, BEN2 initialization/inference fails, or device OOM is detected, dispose BEN2, retry once with IS-Net q8, preserve the image locally, and show an actionable localized fallback notice without looping or leaving stale GPU resources — _Depends on:_ `F2`
- [x] `F4` Apply model-aware batch scheduling: BEN2 and guided segmentation run sequentially with concurrency `1`; IS-Net retains the existing WebGPU `2` / WASM `1` limits; switching modes cancels/settles active work before releasing the old pipeline — _Depends on:_ `F2`, `F3`
- [x] `F5` Add a lazy `features/select-object` SlimSAM worker using `Xenova/slimsam-77-uniform` q8 at the pinned points-and-boxes revision; encode the source image once, reuse embeddings for repeated prompts on that image, accept one positive point or normalized bounding box, choose the best-IoU mask, convert it to the existing source-sized `AlphaMatte`, and dispose all model/tensor/image resources on exit/reset — _Depends on:_ `I1`
- [x] `F6` Add the accessible guided-selection UI inside the existing tool flow: explicit entry, point/box tool choice, pointer and keyboard-operable prompting, replace/retry/cancel actions, loading/error announcements, and coordinate mapping that remains correct on responsive/zoomed canvases — _Depends on:_ `F5`
- [x] `F7` Feed the accepted SlimSAM matte into the existing brush editor and preserve the established correction → result → background replacement → individual/ZIP download behavior without uploading or persisting image-derived data — _Depends on:_ `F6`
- [x] `F8` Add focused registry/lifecycle/fallback/prompt-coordinate/mask-conversion tests plus localized Playwright coverage for all three model modes, warm reuse, WebGPU→IS-Net fallback, OOM recovery, point and box prompts, and continuation through brush correction/download — _Depends on:_ `F3`, `F4`, `F7`
- [x] `F9` Run and record the serialized available-host real-browser check for guarded BEN2 fallback plus real SlimSAM point/box inference, and state precisely which runtime path the available host did and did not exercise without treating unavailable physical hardware as a future deploy gate — _Depends on:_ `F8`, `I2`

### Infra

- [x] `I1` Add manifest-pinned BEN2 fp16 and SlimSAM q8 assets to the production VPS/CDN sync contract, retain immutable paths/CORS/range/cache headers and pinned upstream fallback, and verify that neither model is bundled into the app image or fetched before explicit use — _Depends on:_ —
- [x] `I2` Add a host-only serialized Phase-16 real-model Playwright command and runtime-evidence report; keep it out of Docker and CI while retaining the standard deterministic cross-browser suite — _Depends on:_ `I1`

<!-- Test execution is governed by `## Gate Checks` below + docs/STACK.md § Gate Commands. -->

---

## Files

### Create / modify

~~~
models.manifest.json
scripts/sync-model-assets.ts
scripts/sync-model-assets.test.ts
deploy/MODEL_CDN.md
src/entities/processed-image/model/types.ts
src/features/quality-mode-toggle/index.ts
src/features/quality-mode-toggle/model/use-quality-mode.ts
src/features/quality-mode-toggle/model/use-quality-mode.test.ts
src/features/quality-mode-toggle/ui/QualityModeToggle.tsx
src/features/quality-mode-toggle/ui/QualityModeToggle.test.tsx
src/features/remove-background/model/model-info.ts
src/features/remove-background/model/model-info.test.ts
src/features/remove-background/model/state-machine.ts
src/features/remove-background/model/state-machine.test.ts
src/features/remove-background/model/useBackgroundRemoval.ts
src/features/remove-background/model/useBackgroundRemoval.test.ts
src/features/remove-background/worker/inference.worker.ts
src/features/select-object/index.ts
src/features/select-object/model/types.ts
src/features/select-object/model/prompt-coordinates.ts
src/features/select-object/model/prompt-coordinates.test.ts
src/features/select-object/model/use-object-selection.ts
src/features/select-object/model/use-object-selection.test.ts
src/features/select-object/worker/select-object.worker.ts
src/features/select-object/ui/ObjectSelectionCanvas.tsx
src/features/select-object/ui/ObjectSelectionCanvas.test.tsx
src/features/batch-processing/model/use-batch-processing.ts
src/features/batch-processing/model/use-batch-processing.test.ts
src/widgets/tool-workspace/lib/describe-state.ts
src/widgets/tool-workspace/ui/ToolWorkspace.tsx
src/widgets/tool-workspace/ui/ToolWorkspace.test.tsx
messages/ru.json
messages/en.json
e2e/support/mock-inference.ts
e2e/processing-modes.spec.ts
e2e/guided-selection.spec.ts
e2e/phase-16.real.spec.ts
playwright.config.ts
package.json
docs/PHASE_16_DEVICE_MATRIX.md
docs/STACK.md
docs/PHASE_16.md
docs/STATE.md
~~~

### Do NOT touch

- `docs/SPEC.md` or completed Phase-15 decision/evidence
- Phase-15 `/dev/model-lab` behavior, MVANet evaluation code, or production navigation to the lab
- Server routes that accept images, product persistence, accounts, payments, or analytics payloads
- CI wiring for Playwright; real-model and E2E browser checks remain host-only
- Unrelated public/scenario content or visual redesign beyond the new tool controls

---

## Contracts

> This section is the source of truth for `/context-update`.

### New persistent data (tables / collections / files)

No server-side persistent data and no image-derived browser persistence. The existing
`localStorage.qualityMode: "fast" | "max"` contract remains for IS-Net preference compatibility;
BEN2 and guided-selection state are session-only. Public model weights are cacheable through the
existing Service Worker/CDN contract.

`docs/PHASE_16_DEVICE_MATRIX.md` records only device/browser/path, model lifecycle observations,
timings, classified failures, and qualitative pass/fail notes; it must not contain source images,
result pixels, filenames, or other image-derived data.

### New API endpoints / RPC methods / events

None. Model/config/ONNX assets are static public files under the existing
`GET|HEAD https://cdn.cutbg.art/models/{manifest-path}` contract; no endpoint accepts user images.

Worker-only messages may add load/select/dispose/progress/result/error commands. Raw source pixels,
embeddings, prompts, masks, and mattes remain inside the browser and never enter analytics.

### New types / models / shared interfaces

```ts
type AutomaticModelMode = "isnet-q8" | "isnet-fp32" | "ben2-fp16";

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

Production model pins:

- IS-Net q8/fp32: `onnx-community/ISNet-ONNX` revision
  `3fe6e3db3e32c69aadde61fe388ddb1a0574440c` (~44 MB / ~176 MB).
- BEN2 fp16: `onnx-community/BEN2-ONNX` revision
  `c552aa82688edce09f0ac9d2e31ad53d9d629010` (~219 MB), WebGPU-required in the
  public selector; absent/failed WebGPU or OOM falls back once to IS-Net q8.
- SlimSAM q8: the points-and-boxes revision above (~13.8 MB ONNX weights). It intentionally uses
  the quantized WASM path because that pinned branch has fp32/quantized graphs but no fp16 graphs;
  the available-host real-browser compatibility and mask geometry check passed in `F9`. No broader
  physical-device claim is made; SPEC v1.11 handles device-specific gaps from user incidents rather
  than a mandatory laboratory matrix.

Pipeline lifecycle invariant: one automatic pipeline and at most one explicitly entered guided
pipeline may exist, but heavy work is never concurrent. Before switching a heavy model, await
`dispose()` and release ONNX sessions/GPU tensors/embeddings/object URLs; already loaded same-mode
pipelines and same-image SlimSAM embeddings are reused within the session.

### New env vars

None. `VITE_MODEL_CDN_BASE_URL` continues to select the production CDN base and pinned upstream
fallback; Phase 16 adds manifest entries, not configuration keys.

---

## Gate Checks

Run `/phase-gate 16` before committing. Standard commands come from `docs/STACK.md`, plus focused
implementation checks:

```bash
pnpm generate:code
pnpm vitest run src/features/quality-mode-toggle src/features/remove-background src/features/select-object src/features/batch-processing scripts/sync-model-assets.test.ts
pnpm e2e e2e/processing-modes.spec.ts e2e/guided-selection.spec.ts
pnpm e2e:phase-16-real
pnpm tsc --noEmit
pnpm exec steiger ./src
pnpm sync-model-assets --check
```

`pnpm e2e:phase-16-real` is host-only and serialized; never run it in Docker or CI. Record the
available-host result and its actual capability path in `docs/PHASE_16_DEVICE_MATRIX.md`. Phase 16
closed after this smoke passed. SPEC v1.11 supersedes the earlier deferred-matrix rule: unavailable
physical hardware is not a later deployment prerequisite, while reproducible device-specific user
reports must be converted into focused regression coverage or a documented compatibility rule.

The default container-network smoke remains sufficient because Phase 16 adds no route or server
endpoint.

---

## Architect Review Notes

- [x] No architect review issues recorded

---

## Implementation Notes

- The official SlimSAM model card documents positive-point processing. The repository's immutable
  `points-and-boxes` revision is selected because Phase 16 also requires bounding-box prompts. Its
  q8 graphs minimize download and memory pressure; actual browser support remains a gate result,
  not an assumption.
- The architect approved closing Phase 16 locally without deployment on the available-host real
  smoke. Representative physical weak/powerful hardware coverage is not claimed. The former SPEC
  v1.9 plan to consolidate that matrix into Phase 20 was superseded by SPEC v1.11's available-host
  and incident-driven compatibility policy.

---

## Atomic Commit Message

```
feat(phase-16): add production model modes and guided selection
```

---

## Post-Phase Checklist

- [x] All Scope checkboxes checked (or deferred in Architect Review Notes)
- [x] All automated gate checks green
- [x] All architect review notes resolved
- [x] `docs/STATE.md` updated — run `/context-update 16`
- [x] Committed atomically on `feat/phase-16` branch
- [x] Tag created after merge to `main`: `git tag -a v0.16.0 -m "Phase 16: Production Model Modes & Guided Selection"`
