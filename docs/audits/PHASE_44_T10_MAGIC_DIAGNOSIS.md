# Phase 44 T10 — Magic Cutout diagnosis and recovery plan

Date: 2026-08-07

Status: **architect accepted**

Scope: diagnosis, fixtures, objective quality criteria, Apply target, and T10A plan only

Production algorithm changes: **none**

## Decision requested

Approve or reject the diagnosis, the fixture/quality contract, the performance target, and the
bounded T10A recovery plan below. T10A must not start until all four are explicitly accepted.

## Evidence traced

| Evidence | What it establishes | Limitation |
|---|---|---|
| `6b1502c` / Phase 27 accepted legacy | A 35% hard core, full-radius influence halo, centreline prompt sampling balanced across Keep/Remove, directional fusion, local continuity ranking, and adversarial boundary tests were the last accepted legacy policy. | Its hard core still overwrote candidate alpha; it is not proof that every accidental core crossing was semantically safe. |
| `cae8e32` / Phase 35 v2 port | v2 retained source-space hard/influence maps and directional `max`/`min` fusion, but replaced centreline/label-balanced prompt sampling with bounded sampling of stored pointer points. Its candidate tests cover only small uniform arrays. | The real-model smoke used a 1×1 fixture and explicitly did not claim segmentation quality or large-image pressure. |
| Phase 35 Windows result | Fresh-worker prediction was approximately 10 s, warm prediction 347 ms, and candidate Apply 34 ms; one 55 ms long task was observed. | One target-device observation, and the temporary fixture/cache provenance were not retained. It is a calibration point, not a percentile. |
| `d779ad9` / Phase 42 | Moving full-image candidate ranking/fusion into the existing Magic worker removed a measured 219 ms main-thread Long Task; the repeated target path had zero Long Tasks and one prediction/commit. | Absolute cold/warm/full-flow durations remained unsupported. The move protected responsiveness, not total Apply wall time. |
| Current `magic-cutout-connector.tsx` | One visible Apply first predicts, automatically selects the top candidate, then starts snapshot commit. | The button duration now includes work that Phase 35 exposed as separate Predict and Apply actions. |
| Current candidate/prompt policies | Directional halo fusion is present, but the final hard-map pass writes `255` for Keep and `0` for Remove unconditionally; prompts depend on captured pointer density rather than source-space centreline coverage. | Existing tests prove directional monotonicity, not subject/background discrimination where a visible brush overlaps an edge. |

## Diagnosis

### Quality

This is not a wholesale loss of the Phase-27 algorithm: the current worker still owns the 35%
hard core, outer influence halo, latest-stroke overlap, local directional `max`/`min` fusion, and
intent/continuity/model-score ranking. Reverting the complete v2 implementation to legacy code
would therefore be both inaccurate and unsafe.

Two concrete gaps explain why the current contract can produce the reported result:

1. The final hard-core write is label-authoritative rather than model-boundary-aware. If the core,
   not merely the halo, crosses the subject edge, Remove forces those subject pixels to zero and
   Keep forces crossed background pixels to 255 even when the selected candidate correctly
   distinguishes them. Directional halo fusion cannot repair that later because the hard pass is
   last.
2. The v2 prompt port lost the accepted source-space centreline sampling and balanced Keep/Remove
   allocation. The 32 prompts now reflect pointer-event density. A dense short stroke can consume
   capacity while a long sparse stroke is underrepresented; mixed modes only reserve their final
   endpoints. That can change SlimSAM's selected boundary before fusion.

The verified regression is therefore a **quality-contract and coverage regression**, plus a
plausible prompt-distribution regression. Git evidence does not prove that a previously accepted
algorithm could safely ignore an intentional hard-core instruction: Phase 27 also made the core
authoritative. T10A should implement the newly explicit subject/background outcome below instead
of claiming a byte-for-byte restoration.

The current ranking path also retains up to three full source-sized fused mattes and repeatedly
scans full-size constraint arrays. This is bounded and off-main-thread, but it is unnecessary for
the product's automatic-best single-result UI and can add wall time and memory pressure.

### Apply latency

The 34 ms Phase-35 measurement covered candidate commit only. The current single Apply action also
contains queue admission, possible Magic model load, source encoding, decoder prediction,
ranking/fusion, candidate transfer/registration, and snapshot PNG materialization. Comparing the
current button duration with 34 ms is therefore an apples-to-oranges regression claim.

There are still two actionable latency gaps:

- the UI has no retained stage-to-stage Apply measurement, so model time, policy time, transfer,
  and commit cannot be distinguished;
- ranking/fusion performs full-frame work for every returned candidate even though only the best
  candidate is public.

Cold first use remains a separately reported model-load/encode case. It must stay cancellable and
truthful, but the historical approximately 10 s observation is not accepted as the interactive
warm-Apply target.

## Frozen fixtures and quality criteria

### Deterministic mask fixtures

T10A must encode these as small source-space arrays with an explicit ground-truth subject map. A
stroke has a 35% core and a full-radius halo; the named incidental zone is overlapped by the visible
brush but is not the intended correction target.

| ID | Setup | Required output |
|---|---|---|
| `remove-crosses-subject-edge` | The base contains a background false-positive next to correct subject alpha. A Remove stroke targets the false-positive while its halo, and one adversarial variant of its core, crosses the subject boundary. The model candidate removes only the false-positive. | Target background becomes `0`; every ground-truth subject byte remains byte-exact; no pixel gains alpha; pixels outside influence remain byte-exact. |
| `keep-crosses-background-edge` | The base misses a subject fragment next to correct transparent background. A Keep stroke targets the fragment while its halo, and one adversarial variant of its core, crosses background. The model candidate restores only the fragment. | Target subject becomes `255`; every ground-truth background byte remains `0`; no pixel loses alpha; pixels outside influence remain byte-exact. |
| `mixed-density-centrelines` | One dense short Keep stroke and one sparse long Remove stroke exceed the 32-prompt budget together. | Prompts are deterministic source-space centreline samples, include both modes, allocate capacity fairly when both exist, and include the latest valid endpoint of each mode. |
| `latest-overlap-wins` | Keep and Remove footprints overlap in both orders. | The latest stroke controls prompt/constraint intent in the overlap without changing pixels outside the union of the two influence zones. |

For automatic-base flows the acceptance metrics are exact, not visual estimates:

- Remove subject-alpha loss in the crossed subject zone: `0` bytes and `0` pixels;
- Remove alpha gain anywhere: `0` bytes and `0` pixels;
- Keep background-alpha gain in the crossed background zone: `0` bytes and `0` pixels;
- Keep alpha loss anywhere: `0` bytes and `0` pixels;
- intended target correction: every labelled target reaches the fixture's expected `0` or `255`;
- outside-influence delta: `0` bytes and `0` pixels.

### Representative real-image fixtures

The local benchmark corpus is ignored by Git, so each input is frozen here by path and SHA-256.
T10A must not silently substitute a different file. Before retaining either in tracked automated
evidence, confirm its provenance; otherwise replace it with an architect-provided licensed image
and record the replacement hash in this document.

| ID | Input | SHA-256 | Exercise |
|---|---|---|---|
| `subject-edge-irregular` | `sample/benchmark_images/yc3gukCwg2AaTcjIUHF5Shvic3H8Fn9LbHih6PKpS4yM0UYJa1LAGOjjtYInTj8SWmaFoKgcLI9S2Tghz6HYqB2f.jpg` (1024×1024) | `9e119248b71724ee63d452f5f043782e79e2a93b4eac75a5a415d847ba69cd0c` | Remove across the bag/head silhouette and Keep across the eye/snout openings; check thin and irregular subject edges. |
| `foreground-background-low-contrast` | `sample/benchmark_images/white-on-white-bleached.webp` (600×400) | `205c6d945aa2571a222e239e67450ca63ce1f0ffb63791015dc70482b78e3b8e` | Keep across the white cup/saucer edge and Remove across the adjacent white background; check that low contrast does not turn visible brush overlap into blanket alpha. |

The real-image pass is architect-reviewed and qualitative because no licensed ground-truth masks
exist for these files. It supplements but never replaces the exact deterministic mask assertions.

## Accepted Apply-performance target for T10A

Measure a production build on the managed Windows Chrome boundary using one fixed 1024×1024
fixture, a warm Magic model/source encoding, one bounded stroke, and no competing heavy job. Record
20 Apply samples from click to publication of the committed result URL/revision, plus the
prediction-ready and commit-complete marks already observable at the application boundary.

The original target was:

- warm combined Apply p95 `≤ 500 ms` and maximum `≤ 750 ms`;
- candidate-ready to committed-result publication p95 `≤ 100 ms`;
- zero main-thread Long Tasks `≥ 50 ms`, zero missed actions, and page scroll/control response
  during Apply;
- exactly one prediction and one commit per changed Apply, maximum one heavy job, and final
  artifacts/leases/object URLs `0/0/0` after Reset;
- cold model-load/first-encode samples reported separately and never mixed into the warm percentile.

The 500 ms target gave approximately 31% headroom over the only accepted warm calibration
(`347 ms` prediction + `34 ms` commit = `381 ms`). The 100 ms commit target gives nearly 3×
headroom over the accepted 34 ms sample. T10A subsequently proved that the calibration was not
representative of the current combined Apply on the fixed 1024×1024 fixture: managed Windows Chrome
measured `861.7 ms` p95 and `863.8 ms` maximum while every responsiveness and commit-boundary target
passed.

On 2026-08-07 the architect accepted the evidence-driven recalibration:

- warm combined Apply p95 `≤ 900 ms` and maximum `≤ 1000 ms`;
- candidate-ready to committed-result publication p95 remains `≤ 100 ms`;
- the zero-Long-Task, singular prediction/commit, responsiveness, and cleanup requirements remain
  unchanged.

This amendment changes only the acceptance budget. It does not authorize another model, inference
device, worker protocol, dependency, or background prediction.

## Bounded T10A recovery plan

1. Add the four deterministic fixtures and a real-model fixture manifest. Capture the current
   quality failures and the pre-edit warm Apply distribution using the protocol above.
2. Restore deterministic, source-space centreline prompt sampling with fair Keep/Remove allocation
   under the existing 32-prompt bound. Do not change the model, revision, assets, domain commands,
   or worker protocol.
3. For automatic-base fusion, use the model candidate to preserve the semantic boundary throughout
   incidental brush overlap: Remove may only decrease alpha where the candidate identifies
   removable pixels; Keep may only increase alpha where it identifies restorable subject pixels.
   Retain latest-stroke ownership, directional monotonicity, and byte-exact preservation outside
   influence. Do not add edge snapping, graph cut, geodesic/bilateral processing, another model,
   or a dependency.
4. Rank in the bounded edit/influence region and materialize only the public best safe result when
   consumer tracing confirms no candidate-selection path remains. Keep cancellation checks between
   bounded passes and preserve the current transferable worker boundary and correlation tuple.
5. Cover deterministic policy, worker transfer/cancellation, application stale rejection, one
   atomic commit, bilingual browser interaction, and real-model subject-edge/low-contrast review.
   Re-run the 20-sample managed-Windows production timing capture and resource churn.

## Stop conditions

Stop and request a phase amendment before T10A if meeting the accepted result requires a new model
or asset, a worker-protocol change, background inference before explicit Apply, an unbounded
full-image main-thread pass, or a new runtime dependency. Stop and return to diagnosis if the
pre-edit representative baseline does not reproduce either quality failure or cannot produce a
supported timing distribution.

## Architect acceptance

- [x] Diagnosis accepted
- [x] Fixtures and objective quality criteria accepted
- [x] Apply-performance target accepted
- [x] T10A recovery plan accepted
