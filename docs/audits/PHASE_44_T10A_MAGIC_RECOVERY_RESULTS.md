# Phase 44 T10A — Magic recovery implementation results

Date: 2026-08-07

Status: **PASS — implementation verified against the architect-accepted recalibrated budget and
checkpoint manually accepted**

Scope: implemented quality recovery, deterministic/browser regression evidence, managed-Windows
real-model evidence, and the evidence-driven performance-budget amendment.

## Implemented recovery

- restored deterministic source-space centreline prompt sampling, fair Keep/Remove allocation under
  the 32-prompt bound, endpoint retention, and latest-stroke ownership;
- made automatic-base fusion model-boundary-aware throughout incidental brush overlap while
  preserving directional monotonicity and byte-exact pixels outside influence;
- retained direct no-base hard intent, correlation, cancellation, worker ownership, and the existing
  protocol/model/revision;
- materialized only the automatically selected best candidate and changed full-frame agreement and
  continuity passes to the bounded constraint index sets;
- retained immutable source encoding across document commits by removing mutable revision from its
  cache identity;
- added exact adversarial mask/prompt/cache fixtures and bilingual browser coverage for one atomic
  Magic commit and cleanup.

## Deterministic and browser evidence

| Check | Result |
|---|---|
| Magic/runtime/application focused suite | PASS — 17 files, 54 tests |
| Exact Remove subject-edge preservation | PASS |
| Exact Keep background-edge preservation | PASS |
| Mixed-density centreline allocation | PASS |
| Latest overlapping stroke ownership | PASS |
| Immutable-source encoding cache identity | PASS |
| Phase-44 Chromium flow | PASS — 5/5, including EN/RU Magic edge-recovery Apply |
| Production build | PASS |
| TypeScript and diff hygiene | PASS |
| Scoped Fallow audit | PASS for introduced dead code, complexity, duplication, and boundaries |

The final qualitative judgment for the two real images remains architect-owned because the accepted
T10 contract states that no licensed ground-truth masks exist. Managed Windows exercised the exact
fixtures and hashes below without a processing failure:

| Fixture | SHA-256 | Managed result |
|---|---|---|
| `subject-edge-irregular` (1024×1024) | `9e119248b71724ee63d452f5f043782e79e2a93b4eac75a5a415d847ba69cd0c` | 21 consecutive changed Magic Apply operations; one prediction and one commit each |
| `foreground-background-low-contrast` (600×400) | `205c6d945aa2571a222e239e67450ca63ce1f0ffb63791015dc70482b78e3b8e` | Mixed Keep/Remove changed Apply reached revision 2 with one prediction and one commit |

Reset after the real-model checks reported `artifacts/leases/objectUrls = 0/0/0`.

## Managed-Windows production timing

Environment:

- `navigator.platform`: `Win32`
- browser: Chrome `151.0.0.0`, Windows 10 x64 user agent
- logical processors: `16`
- WebGPU exposed: yes; the frozen guided profile still uses its accepted WASM path
- viewport: `1038×734`, DPR `1.2145832777023315`, fine pointer
- fixture: exact `subject-edge-irregular` 1024×1024 hash above
- production build, warm model/source encoding, one bounded stroke, no competing heavy job
- 20 measured Apply operations after one excluded warm-up

### Final bounded implementation

| Metric | Accepted | Observed | Result |
|---|---:|---:|---|
| Combined Apply p95 | `≤ 900 ms` | `861.7 ms` | PASS |
| Combined Apply maximum | `≤ 1000 ms` | `863.8 ms` | PASS |
| Candidate-ready → committed p95 | `≤ 100 ms` | `74.5 ms` | PASS |
| Candidate-ready → committed maximum | reported | `89.8 ms` | PASS |
| Main-thread Long Tasks ≥50 ms | `0` | `0` | PASS |
| Prediction / commit per changed Apply | `1 / 1` | `1 / 1` for all 20 | PASS |

Combined samples (milliseconds):

`861.7, 863.8, 848.6, 851.2, 849.0, 845.7, 851.4, 851.8, 850.6, 850.0,
847.3, 844.7, 850.4, 840.7, 855.3, 848.3, 848.5, 852.5, 854.5, 847.7`

Candidate-ready-to-commit samples (milliseconds):

`69.6, 89.8, 71.1, 74.3, 73.3, 68.0, 71.1, 66.7, 59.3, 69.7, 60.0, 72.2,
70.9, 74.5, 63.6, 69.5, 66.5, 68.0, 66.1, 67.3`

### Bounded optimization probe

One additional source-only probe ranked the three 256×256 decoder masks before upscaling and
upscaled only the selected mask. It changed neither the model, revision, protocol, dependency set,
nor inference timing. Its independent 20-sample distribution was worse (`p95 870.8 ms`, maximum
`880.3 ms`; commit p95 `100.2 ms`; zero Long Tasks), proving that full-resolution multi-candidate
post-processing is not the dominant gap. The probe was reverted and is not part of the working
implementation.

The separately observed cold model-load/first-encode Apply for that probe was `13,646.1 ms`; it is
not included in either warm percentile.

## Amendment conclusion

Approximately 770 ms elapses before candidate readiness even with a stable source-encoding cache;
the bounded ranking/materialization probe did not reduce it. The remaining dominant work is the
frozen WASM decoder path. The architect accepted option 1 on 2026-08-07: retain the fixed model and
recalibrate only the representative 1024×1024 combined-Apply budget to p95 `≤ 900 ms` and maximum
`≤ 1000 ms`.

The observed `861.7 ms` p95 and `863.8 ms` maximum now pass. The stricter candidate-to-commit,
responsiveness, singular-work, and cleanup requirements were not relaxed and also pass. T10A and
its bounded review fixes were manually accepted before T11 began.
