# Phase 18 interactive matting evidence

Date: 2026-07-22

Decision: retain Distinctions-646 q8 as Phase-19 `balanced` and fp32 as `maximum`; load only the
selected variant, with q8 as the bounded model fallback.

## Candidate provenance and license gate

| Candidate | Immutable source | Graphs | License verdict | Lab verdict |
|---|---|---|---|---|
| ViTMatte-small Composition-1k q8/fp32 | `Xenova/vitmatte-small-composition-1k@6bc1297f6140f055a227b6d2cfe8c093281f35d2` | `onnx/model_quantized.onnx`, `onnx/model.onnx` | Apache-2.0 base model; conversion identifies the pinned `hustvl` base | Eligible |
| ViTMatte-small Distinctions-646 q8/fp32 | `Xenova/vitmatte-small-distinctions-646@358d428c452e5e0cd52955011a8b51944731d28e` | `onnx/model_quantized.onnx`, `onnx/model.onnx` | Apache-2.0 base model; conversion identifies the pinned `hustvl` base | Eligible |
| EfficientSAM-Ti | `yformer/EfficientSAM@d525f622e6f640acf5a0fc37c7ca1f243da5bde0` | Official export code, no immutable first-party hosted ONNX graph | Apache-2.0 source | Evidence-only / unsupported |
| MobileSAM ViT-T | `ChaoningZhang/MobileSAM@f706ad9c4eb7f219c00d9050e46328518ffb65d2` | Official export code, no immutable first-party hosted ONNX graph | Apache-2.0 source | Evidence-only / unsupported |
| SlimSAM q8 | Existing production pin `Xenova/slimsam-77-uniform@7c8459c48dabad6291b384c97be46c451c25d6c4` | Existing Phase-16/17 encoder + decoder graphs | Apache-2.0 | Existing promptable baseline; not duplicated in the matting worker |
| EdgeSAM | No graph admitted | — | NTU S-Lab License 1.0 | Excluded from production eligibility |

Primary provenance checked against the [Transformers.js ViTMatte conversion](https://huggingface.co/Xenova/vitmatte-small-distinctions-646), the [official ViTMatte model](https://huggingface.co/hustvl/vitmatte-small-composition-1k), [EfficientSAM](https://github.com/yformer/EfficientSAM), and [MobileSAM](https://github.com/ChaoningZhang/MobileSAM). Third-party prompt-model ONNX uploads were not treated as inheriting an upstream source-code license.

## Corpus and metrics

The repository generates eight deterministic, local, filename-free cases: hair/fur,
transparent/thin, holes, shadows, light-on-light, multiple objects, motion blur, and a
high-resolution/small-target proxy. Each case owns an exact synthetic alpha ground truth; the
trimap is derived deterministically with hard foreground/background constraints and an unknown
boundary band.

Reported metrics are binary IoU, dilated boundary IoU, normalized SAD, MSE, gradient error, a
largest-connected-component disagreement score, and interactions-to-accept. Lower is better for
SAD/MSE/gradient/connectivity; higher is better for IoU/boundary IoU. Automated corpus runs have no
human correction pass, so `interactionsToAccept` is `null` rather than an inferred value.

## Automated-host WASM real-browser result

- Command: `pnpm e2e:matting-lab-real`
- Browser: Chromium 149, headless
- Capabilities: 6 logical threads, `deviceMemory=16`, `crossOriginIsolated=false`
- Actual execution path: WASM (WebGPU was unavailable to this browser run)
- Peak memory: `unavailable` (the browser exposed no reliable per-model peak-memory API)
- Result: all 32 ViTMatte case/model runs succeeded; no OOM or operator failure.

| Model | Download | Cold load observed | Median warm | Mean IoU | Mean boundary IoU | Mean SAD |
|---|---:|---:|---:|---:|---:|---:|
| Composition-1k q8 | 27.5 MB | 7,760 ms | 167 ms | 0.8736 | 0.8537 | 0.2811 |
| Composition-1k fp32 | 103.9 MB | 9,152 ms | 226 ms | 0.8805 | 0.8742 | 0.2579 |
| Distinctions-646 q8 | 27.5 MB | 3,425 ms | 144 ms | 0.8688 | 0.8204 | 0.1717 |
| Distinctions-646 fp32 | 103.9 MB | 32,847 ms | 231.5 ms | 0.8750 | 0.8486 | 0.1215 |

Cold-load values include current network/cache conditions and must not be treated as stable model
benchmarks. Warm timings and quality deltas are the stronger within-run evidence. The transparent/
thin case was difficult for all four variants; Distinctions-646 materially reduced its alpha error,
which is important for a refiner even though Composition-1k produced the stronger binary boundary
average.

## Architect-supplied WebGPU real-browser result

- Source: explicit image-free export `cutbg-matting-benchmark-2026-07-22.json`, generated manually
  from `/dev/model-lab` and kept outside the product/runtime path.
- Browser: Yandex Browser / Chromium 148
- Capabilities: 16 logical threads, `deviceMemory=32`, `crossOriginIsolated=false`
- Actual execution path: WebGPU
- Peak memory: `unavailable`
- Result: all 32 ViTMatte case/model runs succeeded; all 24 EfficientSAM/MobileSAM/SlimSAM lab rows
  reported the expected unsupported status rather than a matting-runtime failure.

| Model | Download | Cold load observed | Median warm | Mean IoU | Mean boundary IoU | Mean SAD |
|---|---:|---:|---:|---:|---:|---:|
| Composition-1k q8 | 27.5 MB | 6,354 ms | 555 ms | 0.8737 | 0.8534 | 0.2808 |
| Composition-1k fp32 | 103.9 MB | 9,673 ms | 128 ms | 0.8805 | 0.8742 | 0.2579 |
| Distinctions-646 q8 | 27.5 MB | 3,835 ms | 514 ms | 0.8690 | 0.8228 | 0.1701 |
| Distinctions-646 fp32 | 103.9 MB | 18,619 ms | 130 ms | 0.8750 | 0.8486 | 0.1215 |

On this WebGPU path, Distinctions-646 fp32 combined the best soft-alpha score with roughly four
times lower median warm inference time than its q8 graph. This is measured behavior of the
exercised browser/runtime, not a general claim that fp32 is computationally cheaper. The WASM run
shows the complementary result: q8 is smaller and faster there.

## Production variant policy for Phase 19

Retain both Distinctions-646 variants as alternatives within one refinement feature:

- `balanced` → `vitmatte-small-distinctions646-q8` (~27.5 MB). It is the initial recommendation on
  WASM and unknown/weak paths and the single model fallback from fp32.
- `maximum` → `vitmatte-small-distinctions646-fp32` (~103.9 MB). It is recommended on a confirmed
  WebGPU path when the user accepts the larger first download in exchange for the best measured
  soft-alpha quality.
- The variants are not blended and are never loaded together for one result. Phase 19 must disclose
  approximate first-download size before fetching, lazily fetch only the selected graph, reuse it
  warm in the same session, and dispose the old pipeline/tensors before switching variants.
- If maximum-mode loading, WebGPU execution, inference, or memory allocation fails, Phase 19
  preserves source/prompts/trimap/prior matte, disposes fp32, and retries q8 once. If q8 fails, it
  continues with deterministic no-new-model fusion and the existing pixel brush; no fallback loop.
- Both variants may be pinned in the production CDN manifest and independently retained by the
  Service Worker after explicit use. This policy does not authorize a Phase-18 production manifest
  change or an eager page-load fetch.
- Exact trimap foreground/background constraints remain hard, matting changes only the unknown
  crop, and refinement/batch concurrency is `1`.
- Peak memory and real high-resolution/non-synthetic visual acceptance remain Phase-19 integration
  measurements. The browser reports do not invent values for unavailable memory APIs.
