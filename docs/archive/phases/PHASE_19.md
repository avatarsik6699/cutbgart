# PHASE 19 — Production Trimap & Alpha Refinement

<!-- TOKEN BUDGET: keep this file under 10,000 tokens. Be concise. -->

## Phase Metadata

| Field | Value |
|-------|-------|
| Phase | `19` |
| Title | Production Trimap & Alpha Refinement |
| Status | `✅ done` |
| Tag | `v0.19.0` |
| Depends on | PHASE_18 gate passing |

---

## Phase Goal

Convert the current automatic or guided matte into a higher-quality soft alpha while preserving
hard user intent and every existing correction/background/download path. Add the Phase-18-selected
Distinctions-646 q8 `balanced` and fp32 `maximum` variants as selected-only, lazily loaded production
refiners over an adaptive trimap/focus crop, with a bounded fp32 → q8 → deterministic-fusion recovery
chain and one-heavy-stage-at-a-time lifecycle (SPEC.md §2.2, §3, §5.2–§5.3, §6.1, §7.1, §7.3,
§7.7, §8; `docs/MATTING_EVALUATION.md`).

No Figma screenshots or other design assets were supplied. Reuse the established bilingual
tool-workspace controls, status notices, and accessibility patterns.

---

## Scope

### Frontend

- [x] `F1` Add production `Trimap`, hard refinement-constraint, focus-crop, mode/profile, status,
  request/response, result, and classified-error contracts. Keep cross-feature domain values in
  `entities/processed-image`; the new `features/refine-matte` slice must not import another
  `features/*` slice directly — _Depends on:_ —
- [x] `F2` Implement deterministic confidence/disagreement trimap construction from the existing
  automatic matte, optional guided matte, and explicit keep/remove constraints; derive an adaptive
  unknown boundary band, apply the latest hard constraint last, and cover empty/full/disconnected,
  thin/translucent, holes, small-target, and dimension-mismatch cases — _Depends on:_ `F1`
- [x] `F3` Implement bounded target/focus-crop preparation and restoration: infer only the padded
  unknown region, retain the prior source-sized alpha outside it, resample alpha without turning it
  into a binary mask, and re-apply definite foreground/background constraints after restoration —
  _Depends on:_ `F2`
- [x] `F4` Add a production-only Distinctions-646 registry with the immutable Phase-18 revision,
  q8 `balanced` (~27.5 MB) and fp32 `maximum` (~103.9 MB) graph identities, WebGPU/WASM support,
  resource disclosures, and a capability recommendation that prefers maximum on confirmed WebGPU
  and balanced on WASM/unknown paths without using missing `deviceMemory` as a hard prohibition —
  _Depends on:_ `F1`
- [x] `F5` Add the matting worker and hook orchestration: no worker/model fetch before explicit
  refinement; latest-request-wins cancellation; real load progress; warm reuse of the selected
  variant; selected-only pipeline residency; deterministic disposal before mode/stage switches;
  and result metadata that reports requested/actual mode, inference path, and fallback — _Depends
  on:_ `F3`, `F4`, `I1`
- [x] `F6` Implement the bounded failure policy. Maximum-mode load/operator/WebGPU/inference/OOM
  failure disposes fp32 and retries q8 once; a WebGPU-specific failure makes that retry use WASM,
  while other failures may retain the viable detected path. A q8 failure disposes the model and
  returns deterministic guided fusion. Every branch preserves source, prompts, trimap, prior matte,
  background choice, and access to the exact pixel brush; no silent loop — _Depends on:_ `F5`
- [x] `F7` Expose explicit release/suspend hooks for the existing automatic and guided workers and
  orchestrate them from `widgets/tool-workspace`: settle/cancel current work and dispose the prior
  heavy model before loading ViTMatte; dispose ViTMatte before a new automatic/guided run. Do not
  create same-layer feature imports or allow automatic, SlimSAM, and ViTMatte inference to overlap —
  _Depends on:_ `F5`
- [x] `F8` Add bilingual, keyboard-accessible refinement UI before the first fetch: `balanced` and
  `maximum` choices with approximate sizes and capability-aware recommendation, progress/cancel,
  explicit skip-to-deterministic/brush action, and localized fallback notices. Support entry from an
  automatic result, accepted guided result, and selected completed batch item; successful output
  continues through the existing correction, background replacement, individual/ZIP download, and
  process-another-image flows — _Depends on:_ `F6`, `F7`
- [x] `F9` Keep refinement and refined batch work at concurrency `1`; isolate a failed batch item,
  reject stale results after item switches/resets, and release source-sized/crop buffers, tensors,
  object URLs, and workers on replacement, cancellation, unmount, or reset — _Depends on:_ `F7`,
  `F8`
- [x] `F10` Add focused unit/integration coverage for trimap/crop/constraint invariants, mode
  recommendation, graph selection, no eager or concurrent dual loading, warm reuse, lifecycle
  disposal, every fallback edge, stale response rejection, and batch isolation; add deterministic
  Playwright coverage across the configured browser matrix for automatic and guided refinement,
  both modes, fallback notices, correction/background/download continuation, localization, and
  accessibility — _Depends on:_ `F2`–`F9`

### Infra

- [x] `I1` Add `Xenova/vitmatte-small-distinctions-646` at revision
  `358d428c452e5e0cd52955011a8b51944731d28e` to `models.manifest.json` with `config.json`,
  `preprocessor_config.json`, `onnx/model_quantized.onnx`, and `onnx/model.onnx`; extend manifest
  validation/asset-plan tests and document VPS sync. Do not commit model binaries or preload either
  graph — _Depends on:_ —
- [x] `I2` Reuse the production CDN → pinned Hugging Face fallback and the generic Service Worker
  cache-first policy for both graphs. Verify that only the explicitly chosen URL is requested, each
  full response caches independently after use, range probes are not cached, and a CDN failure does
  not change the immutable model revision — _Depends on:_ `I1`, `F5`
- [x] `I3` Add a host-only serialized `pnpm e2e:phase-19-real` command and image-free runtime
  evidence for both production variants on the available actual WebGPU/WASM path. Record cold/warm
  timing, requested/actual path, classified fallback, and `unavailable` memory honestly; keep the
  command out of Docker and CI — _Depends on:_ `F10`, `I2`

<!-- No Backend or Data group: Phase 19 adds no custom API, database, server-side inference,
analytics payload, or persistent user data. -->

---

## Files

### Create / modify

~~~
src/entities/processed-image/model/types.ts
src/entities/processed-image/index.ts
src/features/refine-matte/index.ts
src/features/refine-matte/model/types.ts
src/features/refine-matte/model/model-registry.ts
src/features/refine-matte/model/model-registry.test.ts
src/features/refine-matte/model/trimap.ts
src/features/refine-matte/model/trimap.test.ts
src/features/refine-matte/model/focus-crop.ts
src/features/refine-matte/model/focus-crop.test.ts
src/features/refine-matte/model/deterministic-fusion.ts
src/features/refine-matte/model/deterministic-fusion.test.ts
src/features/refine-matte/model/use-matte-refinement.ts
src/features/refine-matte/model/use-matte-refinement.test.ts
src/features/refine-matte/ui/MatteRefinementControls.tsx
src/features/refine-matte/ui/MatteRefinementControls.test.tsx
src/features/refine-matte/worker/refine-matte.worker.ts
src/features/select-object/model/refinement-constraints.ts
src/features/select-object/model/refinement-constraints.test.ts
src/features/select-object/model/use-object-selection.ts
src/features/select-object/model/use-object-selection.test.ts
src/features/select-object/index.ts
src/features/remove-background/model/useBackgroundRemoval.ts
src/features/remove-background/model/useBackgroundRemoval.test.ts
src/features/remove-background/worker/inference.worker.ts
src/features/remove-background/index.ts
src/shared/lib/model-source-loader.ts
src/shared/lib/model-source-loader.test.ts
src/widgets/tool-workspace/lib/describe-state.ts
src/widgets/tool-workspace/ui/ToolWorkspace.tsx
src/widgets/tool-workspace/ui/ToolWorkspace.test.tsx
messages/ru.json
messages/en.json
models.manifest.json
scripts/sync-model-assets.ts
scripts/sync-model-assets.test.ts
public/sw.js
package.json
playwright.config.ts
e2e/matte-refinement.spec.ts
e2e/phase-19.real.spec.ts
docs/PHASE_19_RUNTIME_EVIDENCE.md
docs/STACK.md
docs/PHASE_19.md
docs/STATE.md
deploy/MODEL_CDN.md
~~~

`public/sw.js` is expected to need verification/tests rather than a policy rewrite: its existing
content-hashed cache rule already covers pinned `/resolve/` assets. Extract the generic model-source
loader from `features/remove-background` into `shared/lib` without changing existing automatic-model
behavior; keep a compatibility re-export only if current imports/tests require it.

### Do NOT touch

- Phase-18 `features/model-lab` registry/worker or use it as a production runtime dependency
- Production IS-Net/BEN2/SlimSAM model mappings, quality-mode persistence, or automatic defaults
- Phase-20 foreground-colour estimation/decontamination and connected-component cleanup
- Public routes, SEO content, sitemap, analytics events/payloads, or any server endpoint
- `deploy/model-assets/` binaries; populate the VPS/host asset directory only through model sync
- User/private images, filenames, benchmark pixels, prompt coordinates, or persistent browser data

---

## Contracts

### New persistent data (tables / collections / files)

No database or persistent user data. `MattingRefinementMode`, trimap, constraints, crops, fallback
state, refined mattes, and model sessions are browser-tab memory only and are discarded on reset or
reload.

The existing Service Worker Cache Storage may independently retain the two public, immutable model
graphs after explicit use. It never caches images, mattes, prompts, or refinement settings.
`models.manifest.json` gains the pinned public model assets, and
`docs/PHASE_19_RUNTIME_EVIDENCE.md` records image-free technical evidence only.

### New API endpoints / RPC methods / events

No route, server endpoint, analytics event, or external RPC. The new matting worker protocol is an
in-browser module-internal contract:

```ts
type MatteRefinementWorkerRequest =
  | { type: "refine"; request: MatteRefinementRequest }
  | { type: "cancel"; requestId: string }
  | { type: "dispose"; requestId: string };

type MatteRefinementWorkerResponse =
  | { type: "progress"; requestId: string; stage: "loading" | "refining"; percent: number | null }
  | { type: "fallback"; requestId: string; from: "maximum"; to: "balanced"; reason: string }
  | { type: "result"; requestId: string; result: MattingRefinementResult }
  | { type: "error"; requestId: string; error: MattingRefinementError }
  | { type: "disposed"; requestId: string };
```

Existing automatic/guided worker protocols gain only the internal release/dispose acknowledgement
needed for the one-heavy-stage lifecycle. No worker message crosses the browser boundary.

### New types / models / shared interfaces

```ts
type MattingRefinementMode = "balanced" | "maximum";
type MattingModelVariantId =
  | "vitmatte-small-distinctions646-q8"
  | "vitmatte-small-distinctions646-fp32";
type TrimapValue = 0 | 128 | 255;
type HardConstraintValue = -1 | 0 | 1; // unset | background | foreground

interface PixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Trimap {
  width: number;
  height: number;
  data: Uint8ClampedArray; // values are restricted to TrimapValue
  unknownBounds: PixelRect | null;
}

interface RefinementConstraintMap {
  width: number;
  height: number;
  data: Int8Array; // values are restricted to HardConstraintValue
}

interface MattingModelProfile {
  id: MattingModelVariantId;
  mode: MattingRefinementMode;
  modelId: "Xenova/vitmatte-small-distinctions-646";
  revision: "358d428c452e5e0cd52955011a8b51944731d28e";
  graphFile: "onnx/model_quantized.onnx" | "onnx/model.onnx";
  dtype: "q8" | "fp32";
  approximateBytes: 27_499_369 | 103_885_865;
  supportedPaths: readonly ["webgpu", "wasm"];
  license: "Apache-2.0";
}

type MattingRefinementStatus =
  | "idle"
  | "preparing"
  | "loading-model"
  | "refining"
  | "applying"
  | "fallback"
  | "result"
  | "error";

interface MatteRefinementRequest {
  requestId: string;
  source: SourceImage;
  priorMatte: AlphaMatte;
  guidedMatte: AlphaMatte | null;
  constraints: RefinementConstraintMap | null;
  trimap: Trimap;
  crop: PixelRect;
  requestedMode: MattingRefinementMode;
  requestedPath: InferencePath;
}

type MattingFallback = "none" | "balanced" | "deterministic";

interface MattingRefinementResult {
  matte: AlphaMatte;
  requestedMode: MattingRefinementMode;
  actualMode: MattingRefinementMode | "deterministic";
  actualPath: InferencePath | null;
  fallback: MattingFallback;
  fallbackReason?: string;
}

type MattingRefinementErrorCode =
  | "invalid-input"
  | "model-load-failed"
  | "operator-unsupported"
  | "webgpu-failed"
  | "device-out-of-memory"
  | "processing-failed"
  | "cancelled";

interface MattingRefinementError {
  code: MattingRefinementErrorCode;
  message: string;
  recoverable: boolean;
}
```

Constraint precedence is invariant: the latest explicit keep/remove stroke wins on overlap, every
hard foreground/background value is applied after model output, and ViTMatte may change only the
trimap's unknown crop. Outside the crop, the prior matte remains byte-for-byte unchanged.

### New env vars

None. Reuse `VITE_MODEL_CDN_BASE_URL`; do not add a refiner-specific host or feature flag.

---

## Gate Checks

Run `/phase-gate 19` only after both production graphs have manifest/license/revision evidence and
all fallback/lifecycle tests are green. Standard commands come from `docs/STACK.md`, plus:

```bash
pnpm generate:code
pnpm vitest run src/features/refine-matte src/features/select-object src/widgets/tool-workspace scripts/sync-model-assets.test.ts
VITE_ENABLE_MODEL_LAB=false pnpm e2e e2e/matte-refinement.spec.ts
pnpm tsx scripts/sync-model-assets.ts --check
pnpm e2e:phase-19-real
pnpm tsc --noEmit
pnpm exec steiger ./src
```

The deterministic Playwright flow must exercise both locales and configured browser projects with
mocked workers. The serialized real test is host-only and may claim only its actual path; it must
exercise both q8/fp32 production adapters sequentially, verify hard constraints and disposal, and
record unavailable peak memory without inferring a value. Refinement may not close the phase if either graph
is eagerly fetched, both are simultaneously resident, fallback loops, user work is lost, or the
existing correction/background/download flow regresses.

The standard container-network smoke is sufficient because this phase adds no route or server
endpoint. Production CDN deployment remains deferred under the existing local-only Phase 17–20
decision.

---

## Architect Review Notes

Use this section after manual product, UX, API, or workflow verification. Resolve unchecked items
through `/impl-assist 19 review` before the phase closes.

- [x] No architect review issues recorded

---

## Implementation Notes

None

---

## Atomic Commit Message

```
feat(phase-19): add dual-mode alpha refinement
```

---

## Post-Phase Checklist

- [x] All Scope checkboxes checked (or deferred in Architect Review Notes)
- [x] All automated gate checks green
- [x] All architect review notes resolved
- [x] `docs/STATE.md` updated — run `/context-update 19`
- [x] Committed atomically on `feat/phase-19` branch
- [x] Tag created after merge to `main`: `git tag -a v0.19.0 -m "Phase 19: Production Trimap & Alpha Refinement"`
