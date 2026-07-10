# PHASE 02 — ML core

<!-- TOKEN BUDGET: keep this file under 10,000 tokens. Be concise. -->

## Phase Metadata

| Field | Value |
|-------|-------|
| Phase | `02` |
| Title | ML core |
| Status | `⏳ pending` |
| Tag | `v0.02.0` |
| Depends on | PHASE_01 gate passing |

---

## Phase Goal

Prove the background-removal ML pipeline works end to end, in isolation, before any product UI
exists. Deliver the `features/remove-background` slice on an undesigned test page: both models
(`BiRefNet_lite` fast / `BiRefNet` max) load in a Web Worker, WebGPU/WASM device detection selects
the inference path, the full §5.3 state machine and §7.3 error handling are wired, and model
weights are served from Cloudflare R2 via CDN rather than the app's own Nitro server. See
`docs/SPEC.md` §2.2, §5.2–§5.3, §6, §6.1, §7.3, §7.7, §8 (phase `02`).

---

## Scope

<!-- Group tasks by area (Backend / Frontend / Infra / Data, etc.).
     ID scheme: B=Backend · F=Frontend · I=Infra · D=Data · T=other (ungrouped)
     Each item: `ID` description — _Depends on:_ ID, ID or —
     IDs are stable after assignment — never renumber. Mark removed tasks as ~~BN~~ (removed). -->

### Frontend
- [ ] `F1` Define `entities/processed-image` domain types (`SourceImage`, `AlphaMatte`,
  `ProcessedImage`, `QualityMode`, `DeviceCapabilities` per SPEC.md §2.2) — _Depends on:_ —
- [ ] `F2` Scaffold `features/remove-background` slice skeleton (public API `index.ts`, internal
  `model/`, `lib/`, `ui/`, `worker/` dirs per FSD) — _Depends on:_ `F1`
- [ ] `F3` Implement `DeviceCapabilities` detection (`navigator.gpu.requestAdapter()`) selecting
  WebGPU (`fp16`) vs WASM (`q8`) inference path and the default `QualityMode` for weak devices —
  _Depends on:_ `F2`
- [ ] `F4` Implement a Web Worker hosting Transformers.js v4 model init + inference (never the main
  thread) for both `onnx-community/BiRefNet_lite-ONNX` (fast) and `onnx-community/BiRefNet-ONNX`
  (max quality) — _Depends on:_ `F2`, `I1`
- [ ] `F5` Implement the `useBackgroundRemoval` hook exposing the full state machine (SPEC.md §5.3:
  `idle → model-loading → ready → processing → result`, `error` reachable from every state) —
  _Depends on:_ `F3`, `F4`
- [ ] `F6` Implement `OffscreenCanvas` postprocessing/compositing in the worker (`SourceImage` +
  `AlphaMatte` → `ProcessedImage` exposed as `Blob`/`ImageBitmap`, explicit
  `URL.revokeObjectURL` release) — _Depends on:_ `F4`
- [ ] `F7` Wire mandatory error handling (SPEC.md §7.3): WebGPU-unavailable auto-fallback notice
  ("lightweight mode"), file size/resolution limit error, unsupported format error,
  model-load-failure retry action, device-out-of-memory message — _Depends on:_ `F5`
- [ ] `F8` Build an undesigned test route exercising the full slice end to end (stub file input →
  both models load → inference → result) to prove the pipeline in isolation — _Depends on:_ `F5`,
  `F6`, `F7`
- [ ] `F9` Unit + integration tests (Vitest, Testing Library): device-capability detection, error
  handling, pure postprocessing functions, `useBackgroundRemoval` against a mocked worker
  (SPEC.md §7.7) — _Depends on:_ `F3`, `F6`, `F7`

### Infra
- [ ] `I1` Add `@huggingface/transformers` v4 + ONNX Runtime Web dependencies; set
  `env.useWasmCache = true` (mandatory — otherwise WASM runtime files re-download every visit,
  SPEC.md §6.1) — _Depends on:_ —
- [ ] `I2` GitHub Actions workflow uploading `.onnx` model weights + ONNX Runtime WASM binaries to
  Cloudflare R2 at a content-hashed path, separate from the code-deploy workflow (SPEC.md §6
  CI/CD). Trigger: `push` to `main` with a `paths` filter on `models.manifest.json` (a checked-in
  file declaring HF model repo IDs + revisions — the `.onnx` binaries themselves are never
  committed), plus manual `workflow_dispatch` for a forced re-sync — _Depends on:_ —
- [ ] `I3` Service Worker (`public/sw.js`) cache-first caching of model weights/WASM binaries
  fetched from the R2 CDN URL, content-hash-versioned; `lite` and full variants cache
  independently (SPEC.md §6.1) — _Depends on:_ `I1`, `I2`

<!-- No Backend or Data groups: this phase adds no server-side API surface or persistent store
     (SPEC.md §3, §4, architectural invariant — no endpoint anywhere accepts an uploaded image). -->

<!-- Test execution is governed by `## Gate Checks` below + docs/STACK.md § Gate Commands.
     Do not duplicate that list here. -->

---

## Files

### Create / modify
~~~
package.json                                          # add @huggingface/transformers, onnxruntime-web
pnpm-lock.yaml
vitest.config.ts                                       # passWithNoTests: false — real tests land this phase
src/entities/processed-image/model/types.ts             # SourceImage, AlphaMatte, ProcessedImage, QualityMode, DeviceCapabilities
src/entities/processed-image/index.ts
src/features/remove-background/model/device-capabilities.ts
src/features/remove-background/model/state-machine.ts
src/features/remove-background/model/useBackgroundRemoval.ts
src/features/remove-background/model/*.test.ts
src/features/remove-background/worker/inference.worker.ts
src/features/remove-background/lib/compositing.ts       # OffscreenCanvas postprocessing
src/features/remove-background/lib/compositing.test.ts
src/features/remove-background/ui/RemoveBackgroundTestPanel.tsx   # undesigned test harness UI
src/features/remove-background/index.ts
src/routes/dev.remove-background.tsx                    # TanStack Router flat-route: dots→path segments, maps to /dev/remove-background
src/pages/dev-remove-background/ui/DevRemoveBackgroundPage.tsx
src/pages/dev-remove-background/index.ts
src/shared/config/env.ts                                 # read model CDN base URL env var
public/sw.js
.github/workflows/upload-model-weights.yml               # triggers on push to main touching models.manifest.json, plus manual workflow_dispatch
models.manifest.json                                      # checked-in: HF model repo IDs + revisions to sync (the .onnx files themselves are never committed)
scripts/upload-model-weights.ts                           # reads models.manifest.json, pushes .onnx + WASM binaries to R2 with content-hash path
~~~

### Do NOT touch
- `src/features/upload-image/`, `src/features/quality-mode-toggle/`, `src/features/download-result/`
  — Phase 03/04
- `src/pages/home/` — real composition arrives Phase 04; the hello-world stub stays as-is
- `src/shared/ui/` (shadcn/ui components) — Phase 03
- Umami/analytics container config and event wiring — Phase 05
- SEO scenario pages, `scripts/generate-sitemap.ts` — Phase 06

---

## Contracts

> This section is the source of truth for `/context-update`. Fill it in **before** handing to AI.

### New persistent data (tables / collections / files)

```text
Cache Storage (Service Worker, public/sw.js) — cache-first, content-hashed, effectively permanent:
  model weights (.onnx files, both `BiRefNet_lite` and full `BiRefNet`)
  ONNX Runtime WASM binaries
```
<!-- Verbatim from SPEC.md §3. localStorage `qualityMode` is not introduced until Phase 03
     (quality-mode-toggle feature, SPEC.md §8). -->

### New API endpoints / RPC methods / events

| Method | Path / Topic | Auth | Response / Payload |
|--------|--------------|------|---------------------|
| `GET` | `/dev/remove-background` | none | SSR HTML shell hosting the isolated `remove-background` test harness; response body includes `<div data-testid="remove-background-test-harness">`. Undesigned, no SEO meta, `noindex` — not one of the launch pages in SPEC.md §5.1, exists only to exercise the pipeline before `pages/home` composition lands in Phase 04. |

### New types / models / shared interfaces

```ts
// src/entities/processed-image/model/types.ts — derived from SPEC.md §2.2 Key Entities;
// field names/shape below are the finalized contract for this phase, not illustrative.

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
  // single-channel alpha output of the ML model — preserves soft edges (hair/fur/translucent)
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

### New env vars

| Key | Example value | Required |
|-----|---------------|----------|
| `VITE_MODEL_CDN_BASE_URL` | `https://cdn.cutbg.art/models` | yes — base URL the worker/service worker prepend to content-hashed model weight & WASM binary paths (SPEC.md §6, §6.1). `VITE_` prefix required for client-exposed Vite env vars (build-time inlined, not a server secret — the CDN base URL is not sensitive). R2 write credentials for `I2`'s upload workflow are GitHub Actions secrets, not an app env var, and are out of scope here. |

---

## Gate Checks

> **Before running gate:** confirm all Scope checkboxes are checked (or explicitly deferred in
> Architect Review Notes). Unchecked items appear in the gate report as a warning, not a hard block.

Run `/phase-gate 02` before committing.

`/phase-gate` returns full PASS only when:
- Automated checks are green
- All architect review items below are resolved (checked off)

Use the commands in [docs/STACK.md](./STACK.md#gate-commands) as the source of truth for:
- infrastructure / bootstrap
- migrations — `n/a`, no database in this project
- backend / unit tests — `n/a`, folded into frontend unit tests (single TS/React codebase)
- frontend prep, type-check, unit tests — this phase adds the first real Vitest suite
  (`features/remove-background`); `vitest.config.ts`'s `passWithNoTests` should flip to reflect
  that
- e2e — `n/a` until Phase 04 (STACK.md)
- the default smoke check

If this phase needs a custom smoke target or other phase-specific note, record it here:

```bash
# Optional phase-specific smoke override
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/dev/remove-background
# expected: 200
curl -s http://localhost:3000/dev/remove-background | grep -q 'data-testid="remove-background-test-harness"'
# expected: match found (exit 0) — confirms the test-harness shell rendered, not a generic 404/error page
```

---

## Architect Review Notes

Use this section after manual product, UX, API, or workflow verification. This is the human-facing
channel for post-implementation fixes.

Add one unchecked checkbox per issue the agent must fix before the phase can close. Keep each item
independently fixable and describe observed behavior plus expected behavior. If the fix may change
SPEC/API/schema/security behavior, say so explicitly in the note.

The agent resolves these items through `/impl-assist 02 review`. Leave an item unchecked while it
is still open. Check it off only after the fix is implemented and re-verified. If manual
verification found nothing, keep the default checked line below.

- [x] No architect review issues recorded

---

## Implementation Notes

<!-- Optional. The agent adds a short bullet here only when something isn't already visible from
     the code or commit history: an intentional deviation from the plan, a residual risk, a
     rejected alternative. Leave empty when nothing needs recording — this is not a mandatory
     per-task log. -->

None

---

## Atomic Commit Message

```
feat(phase-02): ml core — background-removal worker pipeline
```

---

## Post-Phase Checklist

- [ ] All Scope checkboxes checked (or deferred in Architect Review Notes)
- [ ] All automated gate checks green
- [ ] All architect review notes resolved
- [ ] `docs/STATE.md` updated — run `/context-update 02`
- [ ] Committed atomically on `feat/phase-02` branch
- [ ] Tag created after merge to develop: `git tag -a v0.02.0 -m "Phase 02: ML core"`
