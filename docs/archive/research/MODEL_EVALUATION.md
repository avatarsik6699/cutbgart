# Browser Model Evaluation — Phase 15

## Decision status

`DECIDED` — retain IS-Net q8/fp32 and add `BEN2 fp16` as the optional heavy automatic model in
Phase 16. `MVANet q4` is rejected: its smaller download does not compensate for weaker quality on
the architect's difficult light-on-light images.

The production IS-Net q8/fp32 mapping is unchanged.

## Candidates

| Variant | Immutable revision | Approx. first download | License |
|---------|--------------------|------------------------|---------|
| IS-Net q8 | `3fe6e3db3e32c69aadde61fe388ddb1a0574440c` | 44 MB | AGPL-3.0 |
| IS-Net fp32 | `3fe6e3db3e32c69aadde61fe388ddb1a0574440c` | 176 MB | AGPL-3.0 |
| BEN2 fp16 | `c552aa82688edce09f0ac9d2e31ad53d9d629010` | 219 MB | MIT |
| MVANet q4 | `43ec3427514b8d9164eea02df93ca2f1b036bb7b` | 125 MB | MIT |

## Protocol

1. Start the internal lab with `VITE_ENABLE_MODEL_LAB=true pnpm dev`, open
   `/dev/model-lab`, and select the same local images for every candidate.
2. Include at least: light object on white, light-gray interior that must remain, hair/fur, thin
   structures, real holes, reflective/transparent object, shadow, and multiple objects.
3. Run candidates sequentially. Record requested/actual execution path, cold load, warm inference,
   WebGPU→WASM fallback, OOM, and processing failure. Do not compare parallel runs.
4. Judge each anonymized result using the rubric below; select `tie`/`neither` when appropriate.
5. Export JSON. The export contains no image bytes, names, blob/data URLs, or image metadata.

For the repeatable automated compatibility smoke use `pnpm e2e:model-lab-real`. It forces WASM in
headless Chromium, processes the repository fixture and product example twice per candidate (cold +
warm), and prints the image-free report. WebGPU must additionally be run manually on a real adapter.

## Quality rubric

Score each item `0` (broken), `1` (noticeable correction needed), or `2` (acceptable):

- foreground retention — light/gray regions belonging to the object remain opaque;
- large interior integrity — no unintended holes inside a solid object;
- boundary quality — no strong halo or visibly clipped contour;
- fine structures — hair, branches, wires, and typography survive;
- background rejection — outside background is actually removed;
- correction effort — result can be accepted or repaired quickly with the existing brush.

Foreground retention and large interior integrity are blocking criteria for the architect's album
case: a candidate scoring `0` on either cannot win based on edge quality alone.

## Results

### Automated headless Chromium / WASM

Run on 2026-07-13 with headless Chromium 149, 6 reported hardware threads, 16 GB reported device
memory, `crossOriginIsolated=false`, requested/actual path `wasm`. Inputs were the repository's JPEG
fixture and product-photo WebP example. Both candidates completed without fallback, OOM, or runtime
error:

| Candidate | Cold load | Inference image 1 | Warm inference image 2 | Result |
|-----------|-----------|-------------------|-------------------------|--------|
| BEN2 fp16 | 16.834 s | 66.876 s | 67.213 s | success |
| MVANet q4 | 11.642 s | 60.938 s | 60.251 s | success |

Conclusion: both graphs are browser-WASM compatible in the tested environment, but roughly one
minute per image is not acceptable as an ordinary production fallback. MVANet was 5.2 s faster to
load, 5.9–7.0 s faster per inference, and its published q4 weight is approximately 94 MB smaller.
These facts favor MVANet on resource cost only; they do not establish better segmentation quality.

### Real WebGPU device

Manual run completed on 2026-07-13 in Yandex Browser 26.6 (Chromium 148) on Windows 10, with 16
reported hardware threads and 32 GB reported device memory. All 16 measurements requested and used
WebGPU; no fallback or processing failure was recorded. The browser export does not expose the GPU
adapter name.

| Candidate | Cold load | Mean inference (4 images) | Inference range | Result |
|-----------|-----------|---------------------------|-----------------|--------|
| IS-Net q8 | 0.938 s | 19.656 s | 17.358–23.235 s | success |
| IS-Net fp32 | 0.373 s | 0.769 s | 0.585–0.995 s | success |
| BEN2 fp16 | 0.965 s | 4.663 s | 4.210–5.125 s | success |
| MVANet q4 | 1.141 s | 5.655 s | 5.051–6.357 s | success |

The architect's preferences were BEN2 on images 1 and 4, and IS-Net fp32 on images 2 and 3.
MVANet won none of the four comparisons. These device-specific timings are not a universal model
benchmark, but they prove that BEN2's fp16 graph runs successfully through the intended WebGPU path
and is fast enough to be offered as an explicitly heavier quality option.

### Architect light-on-light corpus

Run on 2026-07-13 against the 10 original files in the architect-supplied, gitignored
`sample/benchmark_images/` corpus. It covers the original round album, fine flowers, a white bottle,
off-white material swatches, a white wall fixture, multiple white mugs, wood-panel samples, a white
cup and saucer, a white fluted panel, and an irregular paper object. Both candidates completed all
20 WASM inferences without model, OOM, or processing failures.

The run was intentionally sequential and split only to resume artifact download after inference.
Across the 10 representative measurements, BEN2 averaged 67.45 s/image (65.08–69.07 s) and MVANet
61.73 s/image (60.60–63.12 s). Cold loads observed across the runs were 15.94–16.06 s for BEN2 and
11.15–14.64 s for MVANet. The headless renderer peaked at approximately 4.0–4.2 GiB RSS while
processing the 2500×2500 and 6000×4000 sources. All 20 full-resolution PNG outputs were verified on
disk; the first automation attempt exposed a 10 s large-blob download timeout, and the resumed run
exposed Chromium's multiple-download blocking only after all result PNGs were saved. The real-E2E
helper now exports JSON before result downloads, allows a 120 s result-download timeout, and can
resume a corpus by ordinal.

Manual visual scoring uses the rubric order `foreground retention / interior integrity / boundary
quality / fine structures / background rejection / correction effort`. Scores have no ground-truth
masks and are therefore comparative review evidence, not an accuracy benchmark:

| # | Challenge | BEN2 | MVANet | Preference | Main observation |
|---|-----------|------|--------|------------|------------------|
| 1 | Round album, pale-gray solid interior | `2/1/2/2/2/1` | `1/0/1/1/2/0` | BEN2 | BEN2 keeps the circular substrate nearly intact; MVANet creates large holes around typography, artwork, and the rim. |
| 2 | Fine white flowers and stems | `2/2/1/2/2/2` | `2/2/1/2/2/2` | tie | Both preserve the flowers and thin stems with comparable edge softness. |
| 3 | White pump bottle and gray typography | `2/2/2/2/2/2` | `1/2/1/0/2/1` | BEN2 | MVANet removes the main `m/f` mark and weakens the pump contour. |
| 4 | Off-white swatches and branding | `2/2/1/1/2/1` | `1/1/1/1/2/1` | BEN2 | Both find the swatches, but MVANet leaves much less of the light material fully opaque. |
| 5 | White circular wall fixture | `2/2/2/1/2/2` | `2/2/2/1/2/2` | tie | Both isolate the low-contrast circular subject successfully. |
| 6 | Two white mugs | `2/2/1/2/2/1` | `2/2/1/2/2/1` | tie | Both retain both mugs and handles; each leaves a small background artifact. |
| 7 | Multiple wood-panel samples | `2/2/1/1/2/1` | `2/2/2/1/2/2` | MVANet | MVANet is slightly cleaner around the separated samples and joins. |
| 8 | White cup, saucer, and soft shadow | `2/2/1/1/2/1` | `1/1/0/1/2/0` | BEN2 | BEN2 keeps substantially more of the saucer; MVANet clips its left half and adds long artifacts. |
| 9 | White fluted panel on warm-white wall | `2/1/1/1/2/1` | `0/0/0/0/1/0` | BEN2 | BEN2 has one local interior defect; MVANet removes several light ribs and retains broad background fragments. |
| 10 | Irregular paper object | `2/2/2/2/2/2` | `1/1/1/2/2/1` | BEN2 | Both preserve the outline, but MVANet makes much more of the solid object semi-transparent. |

Preference tally: BEN2 `6`, MVANet `1`, tie `3`, neither `0`. Alpha inspection supports the visual
finding but is not treated as ground truth: on the album BEN2 kept 33.06% of the canvas fully opaque
versus MVANet's 25.54%; on the fluted panel the values were 32.54% versus 10.70%. Higher opacity is
useful here because those areas are known solid foreground, but would not be a universal quality
metric.

Recommendation: choose `BEN2 fp16` as the optional heavy automatic model. It is about
94 MB larger and around 5.7 s slower per WASM inference in this environment, but it wins the
phase's blocking requirement—retaining low-contrast light interiors—by a large qualitative margin.
MVANet's speed and size do not compensate for repeating the exact destructive-hole failure that
motivated this evaluation.

## Phase 16 decision

- Retain `IS-Net q8` and `IS-Net fp32` as the existing production modes.
- Add `BEN2 fp16` as an optional heavy automatic mode; its production selector/CDN integration is
  Phase 16 scope, not part of this evaluation phase.
- Do not ship `MVANet q4`.
- Continue with the separately approved SlimSAM guided-selection flow for ambiguous cases.
