# PHASE 15 — Browser Model Evaluation Lab

<!-- TOKEN BUDGET: keep this file under 10,000 tokens. Be concise. -->

## Phase Metadata

| Field | Value |
|-------|-------|
| Phase | `15` |
| Title | Browser Model Evaluation Lab |
| Status | `✅ done` |
| Tag | `v0.15.0` |
| Depends on | PHASE_14 gate passing |

---

## Phase Goal

Select BEN2 fp16, MVANet q4, or neither as the optional heavy automatic model using repeatable
in-browser evidence. Production IS-Net q8/fp32 behavior and the VPS model manifest remain unchanged
throughout this phase (SPEC.md §2.2, §5.1–§5.2, §6.1, §7.1, §7.7, §8).

No Figma assets were supplied. The internal lab reuses the existing design system; the architect's
light-on-light album example defines a required benchmark category, not a UI design reference.

---

## Scope

### Frontend

- [x] `F1` Add a typed, immutable evaluation registry for IS-Net q8/fp32, BEN2 fp16, and MVANet q4 with pinned revisions, approximate download sizes, licenses, execution-path declarations, and resource warnings — _Depends on:_ —
- [x] `F2` Add a dedicated model-lab worker that loads candidates only after an explicit run, processes models sequentially, separates load/inference timings, disposes the previous pipeline before switching, and returns preview/matte or classified errors without changing the production worker — _Depends on:_ `F1`
- [x] `F3` Add model-lab orchestration for one or more local images, deterministic run ordering, capability capture, pairwise preference, cancellation/reset, object-URL cleanup, and image-free/filename-free benchmark JSON export — _Depends on:_ `F2`
- [x] `F4` Add the `noindex` `/dev/model-lab` page behind `VITE_ENABLE_MODEL_LAB=true`: opt-in explanation, local file selection, model characteristics, sequential progress, side-by-side previews, simple preference controls, errors, and JSON export; disabled builds must never create the worker or fetch candidates — _Depends on:_ `F3`, `I1`
- [x] `F5` Add focused registry/export/orchestration tests and Playwright coverage with mocked inference for enablement, sequential comparison, preference selection, reset, and privacy-safe export — _Depends on:_ `F4`
- [x] `F6` Run real-browser smoke comparisons on the repository's available representative images plus the architect's light-on-light example when supplied; record WebGPU/WASM compatibility, cold/warm timings, failures, qualitative rubric results, and the BEN2/MVANet/neither decision for Phase 16 — _Depends on:_ `F5`

### Infra

- [x] `I1` Add typed `VITE_ENABLE_MODEL_LAB` build configuration defaulting off; keep candidate weights out of `models.manifest.json`, production CDN sync, eager loading, sitemap, and public navigation — _Depends on:_ —

<!-- Test execution is governed by `## Gate Checks` below + docs/STACK.md § Gate Commands. -->

---

## Files

### Create / modify

~~~
src/shared/config/env.ts
src/features/model-lab/index.ts
src/features/model-lab/model/types.ts
src/features/model-lab/model/model-registry.ts
src/features/model-lab/model/model-registry.test.ts
src/features/model-lab/model/benchmark-export.ts
src/features/model-lab/model/benchmark-export.test.ts
src/features/model-lab/model/use-model-lab.ts
src/features/model-lab/model/use-model-lab.test.ts
src/features/model-lab/worker/model-lab.worker.ts
src/features/model-lab/ui/ModelLab.tsx
src/pages/model-lab/index.ts
src/pages/model-lab/ui/ModelLabPage.tsx
src/routes/dev.model-lab.tsx
e2e/model-lab.spec.ts
e2e/model-lab.real.spec.ts
playwright.config.ts
package.json
scripts/generate-sitemap.test.ts
docs/MODEL_EVALUATION.md
docs/STACK.md
docs/PHASE_15.md
docs/STATE.md
docs/SPEC.md
~~~

### Do NOT touch

- Production `QualityMode` mapping, `features/remove-background` worker/hook, or public tool UI
- `models.manifest.json`, `deploy/model-assets/`, Nginx/CDN configuration, or Service Worker cache
- Phase 16 SlimSAM implementation
- User images, server upload endpoints, analytics payloads, or persistent browser storage
- The architect's existing `.gitignore` change

---

## Contracts

### New persistent data (tables / collections / files)

No automatic persistence. An explicit export downloads JSON containing schema version, timestamp,
browser capability summary, anonymous image ordinal, model IDs, load/inference timings, status/error
code, and pairwise preference. It must contain no source/result bytes, data/blob URLs, filename,
file metadata, or image-derived labels.

### New API endpoints / RPC methods / events

| Method | Path / Topic | Auth | Response / Payload |
|--------|--------------|------|---------------------|
| `GET` | `/dev/model-lab` | none | `noindex` SSR shell; enabled only for the exact build flag value `true`, otherwise an unavailable state. Excluded from sitemap and public navigation. |

No endpoint accepts images; inference and export assembly remain client-side.

### New types / models / shared interfaces

```ts
type EvaluationModelId = "isnet-q8" | "isnet-fp32" | "ben2-fp16" | "mvanet-q4";
type EvaluationStatus = "queued" | "loading" | "processing" | "success" | "error";

interface EvaluationModelProfile {
  id: EvaluationModelId;
  label: string;
  modelId: string;
  revision: string;
  dtype: "q8" | "fp32" | "fp16" | "q4";
  approximateBytes: number;
  supportedPaths: InferencePath[];
  license: "AGPL-3.0" | "MIT";
  resourceWarning: string;
}

interface BenchmarkMeasurement {
  imageOrdinal: number;
  modelId: EvaluationModelId;
  requestedPath: InferencePath;
  actualPath: InferencePath;
  status: "success" | "error";
  loadMs: number;
  inferenceMs: number;
  errorCode?: "model-load-failed" | "device-out-of-memory" | "processing-failed";
}

interface BenchmarkPreference {
  imageOrdinal: number;
  preferredModelId: EvaluationModelId | "tie" | "neither";
}
```

The worker protocol may add progress/result/error messages, but raw images and mattes stay inside the
browser and never enter exported records or analytics.

### New env vars

| Key | Example value | Required |
|-----|---------------|----------|
| `VITE_ENABLE_MODEL_LAB` | `true` | optional; exact `true` enables the internal route, otherwise disabled |

---

## Gate Checks

Run focused checks during `/impl-assist 15`; run `/phase-gate 15` only after the architect has
reviewed the real comparison and `F6` records a decision. Standard commands come from
`docs/STACK.md`, plus:

```bash
pnpm generate:code
pnpm vitest run src/features/model-lab scripts/generate-sitemap.test.ts
VITE_ENABLE_MODEL_LAB=true pnpm e2e e2e/model-lab.spec.ts
pnpm e2e:model-lab-real
pnpm tsc --noEmit
pnpm exec steiger ./src
```

Real-model verification is host-only and serialized. It must exercise both candidates in a real
browser with candidate loading initiated by the user; do not add it to the normal parallel
Playwright matrix or CI. Record device/browser/path and failures in `docs/MODEL_EVALUATION.md`.

---

## Architect Review Notes

- [x] No architect review issues recorded

---

## Implementation Notes

- Candidate sizes and graph compatibility are evaluation inputs, not guarantees. BEN2 fp16 is
  approximately 219 MB; MVANet q4 approximately 125 MB. Both use pinned Hugging Face revisions and
  must prove their actual browser backends before Phase 16 selects either one.
- Headless Chromium/WASM compatibility passed for both candidates, but inference took roughly one
  minute per image (`docs/MODEL_EVALUATION.md`). The supplied 10-image light-on-light corpus gave
  BEN2 a 6–1 qualitative lead with three ties, including a decisive win on the original album.
  The architect's real Windows WebGPU run completed all four models on four difficult images:
  BEN2 won two, IS-Net fp32 won two, and MVANet won none. Phase 16 therefore retains both IS-Net
  modes, adds BEN2 fp16 as the optional heavy automatic model, and excludes MVANet q4.

---

## Atomic Commit Message

```
feat(phase-15): add browser model evaluation lab
```

---

## Post-Phase Checklist

- [x] All Scope checkboxes checked (or deferred in Architect Review Notes)
- [x] All automated gate checks green
- [x] All architect review notes resolved
- [x] `docs/STATE.md` updated — run `/context-update 15`
- [x] Committed atomically on `feat/phase-15` branch
- [x] Tag created after merge to `main`: `git tag -a v0.15.0 -m "Phase 15: Browser Model Evaluation Lab"`
