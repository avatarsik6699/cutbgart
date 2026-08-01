# PHASE 32 — Stability Baseline

Captured 2026-08-01 on `feat/phase-32` before Phase-32 source changes, at
`c2ea049b9abea6566593c062dbad1d1e1fb9c43f`. Host: WSL2/Linux 6.6, Node `v24.13.0`, pnpm
`v11.10.0`, Playwright Chromium 1.61.0, WASM inference (no GPU passthrough). Results are
host-specific and do not claim universal device performance.

## Fixtures and runs

| Run | Mode | Scenario | Result |
|-----|------|----------|--------|
| `pnpm vitest run …useBackgroundRemoval …use-batch-processing …use-object-selection …use-tool-workspace-controller` | deterministic | Current lifecycle/editor characterization | 4 files, 36 tests passed; reported edge cases are not covered |
| `pnpm profile:baseline` | deterministic mocked inference, production build | 40 single upload/reset cycles and 40 three-item batch/remove cycles | No long task; retained heap trend recorded below |
| `pnpm e2e:real-model` | real model/CDN, single | Upload → automatic result | Passed in 15.5 s, Hugging Face fallback source |
| `pnpm exec tsx scripts/profiling/measure-phase-32-baseline.ts` | real model/CDN, three-item batch | Three uploads → all results → select every completed item | 3/3 completed; next-paint 93.4/80.5/110.1 ms; no background-removal reinference observed on selection |

The deterministic browser suite uses `e2e/fixtures/sample.jpg` plus the existing inference worker
double. Worker crash/stale/error variants are injected by existing hook doubles; Phase-32 adds the
missing assertions before changing each path. The available-host real run uses the same image three
times deliberately: it isolates scheduling/state ownership from decode-format variability.

## Reproduction and root-cause map

| Report | Deterministic reproduction / code-path evidence | Root cause selected for correction |
|--------|--------------------------------------------------|------------------------------------|
| 1.1 upload/model/removal freezes | Multi-upload calls `Promise.all(validateAndPrepareUpload)`; each call decodes and may resize/encode on the UI realm. Model workers emit unthrottled progress/log updates into the full workspace tree. | Main-realm decode/downscale fan-out plus high-frequency progress commits; transfer-safe worker results are not used consistently. |
| 1.2a Magic Apply freeze | `apply()` consolidates strokes on the UI thread; the worker returns full-size candidate mattes without transfer, then ranking/fusion scan them on the UI thread before a second full matte recomposite request. | Full-image structured clones and O(image) candidate ranking/fusion on the main thread. |
| 1.2b Cancel/undo/redo | With no draft, `cancelGuidedBrushDraft`/manual `clearDraft` return the same state, producing no visible response. Document undo/redo restarts `guided.start`, which disposes/re-encodes the selected image. | Cancel has no terminal UX contract; history restoration is coupled to guided-model initialization. |
| 1.2c–e Magic/Manual sync, repeated Apply, missing controls | Manual canvas is seeded only on source decode while `originalMatte` and initialized-document refs are controller-global. Apply Promise ownership is split across UI/hook refs; tool transitions can leave a stale initialized flag or dirty guard. | Draft/session state is not fully document-owned; Apply/cancel terminals are not one single-flight state machine. |
| 1.3 Enhancements | `sameAlphaMatte` performs a full `Uint8ClampedArray.every` on the main thread. Stop invalidates refs but release completion is not awaited as a run terminal; navigation duplicates cancellation calls. | O(image) equality on main plus fragmented run/resource ownership. |
| 1.4 Background | Apply clones the matte to the inference worker and returns a `ProcessedImage` carrying the matte again. The inline picker sits inside `overflow-hidden` rail/fieldset with no collision-aware positioner or bounded scroll. | Avoidable full-array clone/return path; non-positioned inline popover inside a clipping ancestor. |
| 1.5 View controls/cursors/scroll | Correction layouts pass `canvasViewControls` even when Background/Enhancements is active. Both canvases call `preventDefault()` for plain wheel and pan internally. Geometry is cached while transforms change; Space state is split between React state/ref. | Visibility condition is too broad; wheel contract contradicts page scrolling; pointer geometry/cursor state has multiple owners. |
| 1.6 Batch failures/retry/details | One worker accepts up to two overlapping WebGPU calls; model-load errors without `requestId` never terminalize items. Errors are strings; pending Promise maps survive teardown; retry clears the document before proving a fresh run started. | Unsafe concurrency/error fan-out and no structured per-item run/error ownership. |
| 1.7 item switching reprocesses | Selecting a completed item cancels the shared guided session; the Cutout auto-entry effect calls `guided.start`, terminating/re-encoding again. Tool/UI drafts live in global maps/refs rather than the `BatchItem` session contract. | Automatic guided encoding on selection and incomplete per-item editor-session retention. |

The real three-item run did not reproduce the reported mass failure on this WASM host and small
fixture; that is a caveat, not evidence the bug is absent. The deterministic worker tests will force
model-load/request failures and overlapping responses so the scheduler fix is reproducible without
depending on a particular GPU driver.

## Baseline measurements

- Cold production load: 266 ms; FCP: 212 ms.
- Single upload/reset retained JS heap after forced GC: 6,781,244 → 10,096,156 bytes over 40
  cycles (+3,314,912 bytes).
- Three-item batch/remove retained JS heap after forced GC: 8,309,636 → 10,615,680 bytes over 40
  cycles (+2,306,044 bytes).
- Mocked churn recorded zero long tasks. This only excludes the React/DOM mock path; it does not
  clear real model, full-resolution clone or canvas paths.
- Real completed-item selection next-paint samples: 93.4, 80.5 and 110.1 ms; one sample already
  breaches the `<100 ms` acceptance target.

## Frozen acceptance matrix

| Area | Required result on this reproducible host |
|------|-------------------------------------------|
| Main thread | No application-attributable task `>=50 ms` in the measured interaction window |
| Interaction | Event-to-next-paint p95 `<100 ms` for pointer, plain wheel and completed-item selection |
| Run ownership | Apply is single-flight; cancel/stale/error/unmount cannot commit; every Promise reaches one terminal |
| History | One Apply creates at most one commit; undo/redo performs no automatic inference or synchronous full-image copy |
| Batch | Every valid item reaches result/error; retry affects one item; details are safe and localized |
| Cache | Selecting a completed item sends no automatic inference/encode request and restores its committed/draft/view state |
| Resources | After forced GC, repeated cancel/navigation/item churn has no monotonic worker, object-URL, pending-request or unreachable-artifact growth |
| Coverage | English and Russian; one and at least three uploads; deterministic double plus serialized real-model confirmation |

Each wave records the same focused metrics in `PHASE_32_RESULTS.md`. A single-host pass is evidence
for regression control only; Phase 33 owns physical-device breadth.
