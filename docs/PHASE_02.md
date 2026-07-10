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
- [x] `F1` Define `entities/processed-image` domain types (`SourceImage`, `AlphaMatte`,
  `ProcessedImage`, `QualityMode`, `DeviceCapabilities` per SPEC.md §2.2) — _Depends on:_ —
- [x] `F2` Scaffold `features/remove-background` slice skeleton (public API `index.ts`, internal
  `model/`, `lib/`, `ui/`, `worker/` dirs per FSD) — _Depends on:_ `F1`
- [x] `F3` Implement `DeviceCapabilities` detection (`navigator.gpu.requestAdapter()`) selecting
  WebGPU (`fp16`) vs WASM (`q8`) inference path and the default `QualityMode` for weak devices —
  _Depends on:_ `F2`
- [x] `F4` Implement a Web Worker hosting Transformers.js v4 model init + inference (never the main
  thread) for both `onnx-community/BiRefNet_lite-ONNX` (fast) and `onnx-community/BiRefNet-ONNX`
  (max quality) — _Depends on:_ `F2`, `I1`
- [x] `F5` Implement the `useBackgroundRemoval` hook exposing the full state machine (SPEC.md §5.3:
  `idle → model-loading → ready → processing → result`, `error` reachable from every state) —
  _Depends on:_ `F3`, `F4`
- [x] `F6` Implement `OffscreenCanvas` postprocessing/compositing in the worker (`SourceImage` +
  `AlphaMatte` → `ProcessedImage` exposed as `Blob`/`ImageBitmap`, explicit
  `URL.revokeObjectURL` release) — _Depends on:_ `F4`
- [x] `F7` Wire mandatory error handling (SPEC.md §7.3): WebGPU-unavailable auto-fallback notice
  ("lightweight mode"), file size/resolution limit error, unsupported format error,
  model-load-failure retry action, device-out-of-memory message — _Depends on:_ `F5`
- [x] `F8` Build an undesigned test route exercising the full slice end to end (stub file input →
  both models load → inference → result) to prove the pipeline in isolation — _Depends on:_ `F5`,
  `F6`, `F7`
- [x] `F9` Unit + integration tests (Vitest, Testing Library): device-capability detection, error
  handling, pure postprocessing functions, `useBackgroundRemoval` against a mocked worker
  (SPEC.md §7.7) — _Depends on:_ `F3`, `F6`, `F7`

### Infra
- [x] `I1` Add `@huggingface/transformers` v4 + ONNX Runtime Web dependencies; set
  `env.useWasmCache = true` (mandatory — otherwise WASM runtime files re-download every visit,
  SPEC.md §6.1) — _Depends on:_ —
- [x] `I2` GitHub Actions workflow uploading `.onnx` model weights + ONNX Runtime WASM binaries to
  Cloudflare R2 at a content-hashed path, separate from the code-deploy workflow (SPEC.md §6
  CI/CD). Trigger: `push` to `main` with a `paths` filter on `models.manifest.json` (a checked-in
  file declaring HF model repo IDs + revisions — the `.onnx` binaries themselves are never
  committed), plus manual `workflow_dispatch` for a forced re-sync — _Depends on:_ —
- [x] `I3` Service Worker (`public/sw.js`) cache-first caching of model weights/WASM binaries
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
| `VITE_MODEL_CDN_BASE_URL` | `https://cdn.cutbg.art/models` | required for production builds (set via Docker build arg once R2 is populated) — base URL the worker/service worker prepend to content-hashed model weight & WASM binary paths (SPEC.md §6, §6.1). Intentionally **unset in local dev**: `src/features/remove-background/worker/inference.worker.ts` only overrides Transformers.js's `env.remoteHost`/`wasm.wasmPaths` when this is actually configured — otherwise it stays on Transformers.js's own upstream defaults (HF Hub + jsDelivr), so `pnpm dev` works without R2 ever being populated. Found necessary during manual verification: without this guard, local dev silently pointed at the still-empty R2 CDN. `VITE_` prefix required for client-exposed Vite env vars (build-time inlined, not a server secret — the CDN base URL is not sensitive). R2 write credentials for `I2`'s upload workflow are GitHub Actions secrets, not an app env var, and are out of scope here. |

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
curl -s http://localhost:3000/dev/remove-background | grep -a -q 'data-testid="remove-background-test-harness"'
# expected: match found (exit 0) — confirms the test-harness shell rendered, not a generic 404/error page
# `-a`: TanStack Start's hydration payload embeds NUL bytes, which makes plain
# grep treat the response as binary and silently find nothing (docs/KNOWN_GOTCHAS.md)
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

- WASM dtype is `fp32`, not `q8`. §6.1's "q8 on the WASM fallback" is a general
  Transformers.js default, but the actual published repos
  (`onnx-community/BiRefNet{,_lite}-ONNX`) only ship `model.onnx` (fp32) and
  `model_fp16.onnx` — verified against the HF API file tree. Requesting `q8`
  would 404 at runtime.
- `models.manifest.json` pins both model revisions to their resolved commit
  SHAs (not `main`), so the R2 object path is content-hashed by construction
  without inventing a custom hashing scheme.
- The state machine's `error` status now also accepts `SELECT_FILE` (not just
  `idle`/`result`), so `useBackgroundRemoval`'s `retry()` can actually restart
  the FSM after a failure — SPEC.md §5.3's diagram only draws arrows into
  `error`, not the way back out.
- `docs/KNOWN_GOTCHAS.md` gained an entry: plain `grep` over a full SSR page
  response silently matches nothing because TanStack Start's hydration
  payload embeds NUL bytes (needs `grep -a`). This phase's own smoke-check
  command above was updated accordingly.
- Manual browser verification (`pnpm dev` + a temporary Playwright script,
  removed afterward — Playwright itself isn't a project dependency until
  Phase 04) found and fixed two more real bugs, beyond what unit tests alone
  caught:
  - `detectDeviceCapabilities()` treated any non-null WebGPU adapter as
    usable, but some adapters (observed: headless/software WebGPU) lack the
    `shader-f16` feature that SPEC.md §6.1's mandatory `fp16` dtype needs —
    Transformers.js throws `"does not support fp16"` at model-load instead of
    degrading gracefully. Fixed by checking `adapter.features.has("shader-f16")`
    and falling back to WASM when absent, which is exactly the auto-fallback
    SPEC.md §7.3 already mandates for "WebGPU unavailable".
  - `loadSegmenter` could resolve with a pipeline whose `processor` is `null`
    (Transformers.js doesn't throw in this case) and only fail much later,
    misclassified as a processing error — see the new
    `docs/KNOWN_GOTCHAS.md` entry. Fixed with a post-resolve check plus
    cache eviction on failure so `retry()` actually re-attempts instead of
    re-rejecting a permanently-cached failed promise.
  - Residual risk: the full pipeline (real model download → inference →
    result) was not observed completing successfully end-to-end in this
    sandbox — it consistently failed ~20-35s into model loading with the
    `processor: null` symptom above, which investigation traced to the
    sandbox's network behavior under concurrent large-file load, not the
    application code (see KNOWN_GOTCHAS for what was ruled out). Manual
    verification of a full successful run, and of the real R2 CDN path once
    `upload-model-weights` has actually run with real credentials, is still
    outstanding.
- Architect ran `pnpm dev` locally (unconstrained network, real browser) and
  hit `Uncaught (in promise) TypeError: Failed to fetch` at `sw.js:38`, on a
  request to `https://cdn.cutbg.art/models/...`. Two real issues found and
  fixed:
  - `shared/config/env.ts` defaulted `modelCdnBaseUrl` to the documented
    placeholder R2 URL even when `VITE_MODEL_CDN_BASE_URL` was unset, so
    plain local `pnpm dev` silently pointed at a CDN with nothing uploaded to
    it yet. Changed to leave it `undefined` when unset; the worker now only
    overrides `env.remoteHost`/`wasm.wasmPaths` when a CDN base is actually
    configured, otherwise Transformers.js uses its own upstream defaults (HF
    Hub + jsDelivr) — see the updated `Contracts § New env vars` note above.
  - `public/sw.js`'s fetch handler had no error handling around the network
    `fetch(request)` call — a hard failure (offline, DNS, CDN not yet
    populated) rejected the promise passed to `respondWith()` with nothing
    catching it, producing exactly this unhandled-rejection console error
    instead of a failure the app's own error handling could classify. Fixed
    by catching and returning a normal error `Response` instead.
- Second real-browser round after the fix above (real network, huggingface.co
  reachable, ~495MB actually transferred over the wire — confirmed the
  network path itself is fine) surfaced the actual root cause behind the
  earlier `processor: null` mystery (see `docs/KNOWN_GOTCHAS.md`): `sw.js`
  checked `response.ok` (true for 206 too) before `cache.put()`, and the Cache
  Storage API rejects partial (206) responses outright — which is exactly
  what Transformers.js's per-file `Range: bytes=0-0` existence/size probe
  returns. That crash was then compounded by this session's own earlier fix:
  the fallback error `Response`'s `statusText` contained an em dash, which
  isn't valid ISO-8859-1, so constructing it threw a *second*, actually
  unhandled error. Fixed by gating `cache.put()` on `status === 200` and
  using a plain-ASCII fallback `statusText`.
- Third real-browser round (after the sw.js fix, on real GPU hardware) got
  past model loading into actual inference and hit a genuine ONNX Runtime Web
  WebGPU limitation: `Too many storage buffers in shader. Current: 17, Max is
  16` — a specific model op needs more storage-buffer bindings than this
  device's WebGPU shader-stage limit, undetectable by the adapter/fp16 check
  done at device-capability-detection time (see
  `docs/KNOWN_GOTCHAS.md`). Added a mid-inference auto-fallback to WASM in
  `handleProcess` (new `fallback-to-wasm` worker message, surfaced as the
  existing lightweight-mode UI notice) instead of just erroring out — this
  required re-keying the segmenter cache on `(qualityMode, inferencePath)`
  instead of just `qualityMode`, since a single session can now legitimately
  need both a webgpu and a wasm pipeline for the same quality mode.
  Known gap: the WASM fallback model loads lazily mid-"processing" with no
  visible progress bar (the state machine only surfaces `MODEL_PROGRESS`
  while in `model-loading`), so the UI just shows "processing…" for longer
  than usual on first fallback. Acceptable for this phase's dev harness; would
  be worth a dedicated loading sub-state if this recurs often in Phase 04.

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
