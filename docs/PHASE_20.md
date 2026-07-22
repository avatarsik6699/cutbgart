# PHASE 20 — Foreground Edge Quality & Runtime Hardening

<!-- TOKEN BUDGET: keep this file under 10,000 tokens. Be concise. -->

## Phase Metadata

| Field | Value |
|-------|-------|
| Phase | `20` |
| Title | Foreground Edge Quality & Runtime Hardening |
| Status | `✅ done` |
| Tag | `v0.20.0` |
| Depends on | PHASE_19 gate passing |

---

## Phase Goal

Remove residual colour spill and isolated edge artifacts after the Phase-19 alpha result without
weakening explicit user constraints or replacing the exact pixel brush. Establish maintainable
quality, latency, memory, fallback, and cross-browser release evidence for the complete Phase-16–19
hybrid pipeline while keeping every image client-side and making no unsupported physical-device
claim (SPEC.md §5.2, §7.1, §7.4, §7.7, §8).

No Figma screenshots or other design assets were supplied. Reuse the established bilingual
tool-workspace controls, status notices, and accessibility patterns.

---

## Scope

### Frontend

- [x] `F1` Add session-only foreground-refinement contracts for source-sized colour buffers,
  alpha-edge bounds, hard-constraint precedence, requested/actual cleanup path, classified
  fallback, timing, and unavailable memory observations. Keep shared image-domain values in
  `entities/processed-image`; `features/refine-foreground` must not import another `features/*`
  slice directly — _Depends on:_ —
- [x] `F2` Implement deterministic foreground-colour estimation and conservative decontamination
  only in soft/unknown edge pixels. Preserve source alpha, definite foreground/background, and the
  latest explicit keep/remove constraint byte-for-byte; never alter opaque interiors or invent a
  server/model dependency — _Depends on:_ `F1`
- [x] `F3` Add a bounded edge-aware fallback and connected-component cleanup for colour estimation
  failures, sparse boundaries, holes, thin/translucent objects, disconnected objects, and small
  targets. Cleanup must be conservative, constraint-aware, deterministic, and independently
  disableable so the original refined result and exact brush always remain reachable — _Depends
  on:_ `F1`, `F2`
- [x] `F4` Run foreground refinement off the main thread with one request at a time,
  latest-request-wins cancellation, explicit release, source-sized compact buffers, local edge
  bounds/dirty patches, and deterministic disposal of transferred buffers/object URLs on apply,
  replacement, reset, cancellation, unmount, and failed batch items — _Depends on:_ `F2`, `F3`
- [x] `F5` Add a bilingual, keyboard-accessible optional edge-cleanup control after alpha
  refinement and before exact correction. Integrate automatic, accepted-guided, refined, and
  selected settled-batch results; show applying/fallback state without exposing image-derived
  diagnostics; preserve background replacement, individual/ZIP download, and process-another
  flows — _Depends on:_ `F4`
- [x] `F6` Extend compositing so the decontaminated foreground pixels, current `AlphaMatte`, and
  selected `BackgroundFill` produce the same preview/download bytes. Re-running, skipping, or
  entering the brush must not accumulate colour transforms or discard the pre-cleanup source,
  refined matte, prompts, constraints, or batch isolation — _Depends on:_ `F4`, `F5`
- [x] `F7` Add a deterministic licensed/synthetic edge-quality corpus covering hair/fur,
  translucent and thin objects, holes, shadows, light-on-light edges, disconnected components,
  motion blur, and high-resolution small targets. Record baseline/delta alpha SAD, MSE, gradient,
  connectivity, boundary IoU, colour-spill error, interactions-to-accept, latency, and memory
  observation without committing private images — _Depends on:_ `F2`, `F3`, `F6`
- [x] `F8` Define and enforce the architect-authorized regression thresholds below for the corpus
  and complete hybrid flow: hard constraints and cleanup-disabled alpha bytes remain exact; no
  alpha error metric may regress by more than `1e-6`; boundary IoU may not regress by more than
  `1e-6`; mean colour-spill error must improve by at least `5%` with no case worsening by more than
  `1%`; acceptance takes at most `3` explicit interactions; deterministic 128px corpus cleanup is
  at most `2,000 ms` per case; a measured cleanup heap delta is at most `256 MiB`, while an absent
  memory API remains `unavailable`. Available-host real-model limits are `180 s` automatic,
  `120 s` cold/`30 s` warm refinement, and `10 s` foreground cleanup; unsupported paths are
  recorded, never guessed — _Depends on:_ `F7`
- [x] `F9` Add focused unit/integration tests for colour estimation, no-op/constraint invariants,
  component cleanup, dirty bounds, cancellation, disposal, fallback, non-accumulation, batch
  isolation, and threshold enforcement; add deterministic Playwright coverage across configured
  browser projects for the full automatic/guided → refinement → edge cleanup → brush →
  background → individual/ZIP download flow in both locales — _Depends on:_ `F4`–`F8`

### Infra

- [x] `I1` Add a host-only serialized `pnpm e2e:phase-20-real` command and image-free runtime
  evidence for the available actual WebGPU/WASM path across the Phase-16–19 production adapters
  plus foreground cleanup. Record requested/actual paths, classified fallback, cold/warm timing,
  interaction count, threshold result, and `unavailable` memory honestly; keep it out of Docker and
  CI — _Depends on:_ `F8`, `F9`
- [x] `I2` Evaluate optional COOP/COEP WASM multithreading without changing production headers
  unless CDN assets, analytics, every public page, and the configured E2E/real-model paths all pass.
  Record an evidence-backed enable/defer decision; absence of a proven benefit keeps the current
  non-isolated deployment — _Depends on:_ `I1`
- [x] `I3` Apply incident-first compatibility policy: triage only voluntarily supplied Telegram
  reports, add the smallest focused regression or compatibility rule for reproducible incidents,
  and record environments not exercised as unverified. Add no diagnostic export/intake feature,
  backend, support storage, device registry, PII, image payload, or analytics event; if no report was
  supplied, record that fact rather than inventing one — _Depends on:_ `F9`, `I1`

<!-- No Backend or Data group: Phase 20 adds no custom API, database, server-side inference,
analytics payload, or persistent user data. -->

---

## Files

### Create / modify

~~~
src/entities/processed-image/model/types.ts
src/entities/processed-image/index.ts
src/features/refine-foreground/index.ts
src/features/refine-foreground/model/types.ts
src/features/refine-foreground/model/estimate-foreground.ts
src/features/refine-foreground/model/estimate-foreground.test.ts
src/features/refine-foreground/model/edge-cleanup.ts
src/features/refine-foreground/model/edge-cleanup.test.ts
src/features/refine-foreground/model/quality-thresholds.ts
src/features/refine-foreground/model/quality-thresholds.test.ts
src/features/refine-foreground/model/use-foreground-refinement.ts
src/features/refine-foreground/model/use-foreground-refinement.test.ts
src/features/refine-foreground/ui/ForegroundRefinementControls.tsx
src/features/refine-foreground/ui/ForegroundRefinementControls.test.tsx
src/features/refine-foreground/worker/refine-foreground.worker.ts
src/features/remove-background/lib/compositing.ts
src/features/remove-background/lib/compositing.test.ts
src/features/remove-background/model/useBackgroundRemoval.ts
src/features/remove-background/worker/inference.worker.ts
src/features/batch-processing/model/use-batch-processing.ts
src/widgets/tool-workspace/ui/ToolWorkspace.tsx
src/widgets/tool-workspace/ui/ToolWorkspace.test.tsx
src/features/model-lab/model/matting-corpus.ts
src/features/model-lab/model/matting-quality.ts
src/features/model-lab/model/matting-quality.test.ts
messages/ru.json
messages/en.json
package.json
playwright.config.ts
scripts/run-e2e.ts
e2e/guided-selection.spec.ts
e2e/iterative-guidance.spec.ts
e2e/foreground-refinement.spec.ts
e2e/hybrid-pipeline.spec.ts
e2e/phase-20.real.spec.ts
docs/PHASE_20_RUNTIME_EVIDENCE.md
docs/STACK.md
docs/PHASE_20.md
docs/STATE.md
docs/KNOWN_GOTCHAS.md
deploy/nginx/app.conf
~~~

`deploy/nginx/app.conf` is touched only if `I2` proves and enables cross-origin isolation. A defer
decision changes evidence/docs only. `docs/KNOWN_GOTCHAS.md` is touched only for a reproduced
incident with a durable compatibility rule.

### Do NOT touch

- Model registries/revisions/dtypes, `models.manifest.json`, or `deploy/model-assets/`; Phase 20
  adds no model and no model binary
- Phase-18 evaluation candidate selection or Phase-19 q8/fp32 fallback order
- Public routes, SEO copy/assets, sitemap, accounts, payments, analytics events/payloads, or any
  server endpoint
- Private/user images, filenames, prompts, mattes, pixel/colour samples, or diagnostic exports in
  repository evidence, logs, storage, or analytics
- Mandatory physical-device/device-registry infrastructure or unsupported compatibility claims

---

## Contracts

### New persistent data (tables / collections / files)

No database or persistent user data. Foreground samples, corrected colour buffers, edge/component
masks, dirty patches, thresholds, and worker sessions are browser-tab memory only and are discarded
on reset/reload. `docs/PHASE_20_RUNTIME_EVIDENCE.md` persists image-free technical observations
only.

### New API endpoints / RPC methods / events

No route, server endpoint, analytics event, or external RPC. The foreground worker protocol is an
in-browser module-internal contract:

```ts
type ForegroundRefinementWorkerRequest =
  | { type: "refine-foreground"; request: ForegroundRefinementRequest }
  | { type: "cancel"; requestId: string }
  | { type: "dispose"; requestId: string };

type ForegroundRefinementWorkerResponse =
  | { type: "progress"; requestId: string; percent: number | null }
  | { type: "result"; requestId: string; result: ForegroundRefinementResult }
  | { type: "fallback"; requestId: string; reason: string }
  | { type: "error"; requestId: string; error: ForegroundRefinementError }
  | { type: "disposed"; requestId: string };
```

### New types / models / shared interfaces

```ts
type ForegroundRefinementStatus =
  | "idle"
  | "preparing"
  | "refining"
  | "applying"
  | "fallback"
  | "result"
  | "error";

type ForegroundCleanupPath = "decontaminate" | "edge-aware-fallback" | "unchanged";

interface DirtyPixelPatch {
  bounds: PixelRect;
  rgba: Uint8ClampedArray;
}

interface ForegroundRefinementRequest {
  requestId: string;
  source: SourceImage;
  matte: AlphaMatte;
  constraints: RefinementConstraintMap | null;
}

interface ForegroundRefinementResult {
  foreground: Blob;
  matte: AlphaMatte;
  dirtyPatch: DirtyPixelPatch | null;
  requestedPath: "decontaminate";
  actualPath: ForegroundCleanupPath;
  fallback: "none" | "no-soft-edge" | "no-background-samples" | "processing-failed";
  fallbackReason?: string;
  durationMs: number;
  memoryBytes: number | "unavailable";
}

interface ForegroundRefinementError {
  code: "invalid-input" | "processing-failed" | "device-out-of-memory" | "cancelled";
  message: string;
  recoverable: boolean;
}
```

`ProcessedImage` may gain an optional foreground-colour source used by recomposition. The original
`SourceImage`, current alpha, and pre-cleanup result remain available so cleanup is reversible and
never accumulates across re-runs.

### New env vars

None. Phase 20 does not add a diagnostic, analytics, model, or support-ingestion flag. Any COOP/COEP
decision is an HTTP-header configuration decision, not a client env variable.

---

## Gate Checks

Run `/phase-gate 20` only after all thresholds in `F8` are architect-verified and all scope items
are checked. Standard commands come from `docs/STACK.md`, plus:

```bash
pnpm generate:code
pnpm vitest run src/features/refine-foreground src/features/refine-matte src/features/select-object src/features/model-lab src/widgets/tool-workspace
VITE_ENABLE_MODEL_LAB=false pnpm e2e e2e/foreground-refinement.spec.ts e2e/hybrid-pipeline.spec.ts
pnpm e2e:phase-20-real
pnpm tsc --noEmit
pnpm exec steiger ./src
```

The deterministic Playwright flow must cover both locales and every configured browser project.
The serialized real test is host-only and may claim only its actual path. Record unavailable memory
APIs as `unavailable`; do not infer values. The default container-network smoke remains sufficient
because Phase 20 adds no route or API. If `I2` enables COOP/COEP, additionally verify every public
route, CDN model CORS/CORP behavior, Umami/Cloudflare analytics loading, and all real-model commands
before gate closure.

---

## Architect Review Notes

Use this section after manual product, UX, API, or workflow verification. Resolve unchecked items
through `/impl-assist 20 review` before the phase closes.

- [x] Large-image refinement must not send an unbounded ViTMatte tensor. The supplied 2500×2500
  incident image produced a 2086×2253 focus crop (padded by Transformers.js to 2112×2272) and
  reproducibly failed on WASM with `OrtRun ... SafeIntOnOverflow`; the supplied 400×400 control
  completed on Balanced/WASM. Bound inference input, restore soft alpha to the source crop, and add
  image-free unit plus host-only real-browser regression coverage without committing either user
  image or filename.
- [x] A WebGPU execution failure must retry the same selected Balanced model on WASM once; Maximum
  must remain bounded to fp32 → q8 and then, when q8 WebGPU execution also fails, q8/WASM before the
  deterministic fallback. Dispose failed sessions and never loop or hide the actual path.
- [x] Foreground cleanup must expose a localized, accessible terminal outcome: applied, unchanged
  because no safe soft-edge change was needed, or recoverable error. Do not expose raw/image-derived
  diagnostics; keep retry, skip-to-brush, background, batch, and download flows available.

---

## Implementation Notes

- The architect's 2026-07-22 instruction to document the supplied incident and execute all remaining
  Phase-20 work authorizes the conservative F8 thresholds above. They are regression gates for this
  corpus and available host, not performance promises for untested physical devices.
- The incident input remains local and gitignored. Persistent evidence records only dimensions,
  execution path, classified failure, bounded-input result, timing, and memory availability.
- COOP/COEP remains deferred: the available non-isolated WASM run passed, but no A/B benefit or
  complete production CDN/analytics/public-route compatibility evidence justified changing headers.
- The full gate also corrected two stale E2E assumptions exposed by the new optional cleanup panel:
  brush transitions now target their owning panel, and the runner loads Vite's public `.env` flags
  before Playwright selects feature-flagged tests. Explicit shell overrides still take precedence.

---

## Atomic Commit Message

```
feat(phase-20): improve foreground edges and runtime confidence
```

---

## Post-Phase Checklist

- [x] All Scope checkboxes checked (or deferred in Architect Review Notes)
- [x] All automated gate checks green
- [x] All architect review notes resolved
- [x] `docs/STATE.md` updated — run `/context-update 20`
- [x] Committed atomically on `feat/phase-20` branch
- [x] Tag created after merge to `main`: `git tag -a v0.20.0 -m "Phase 20: Foreground Edge Quality & Runtime Hardening"`
