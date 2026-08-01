# PHASE 31 — T2 Performance Measurements

<!-- TOKEN BUDGET: keep this file under 10,000 tokens. Be concise. -->

Scope: `T2`. Captured 2026-07-30 on this dev machine only (WSL2, no discrete GPU passthrough, no
network throttling). **Single-machine data points, not universal device claims** — matches `T2`'s
own instruction and `SPEC.md §7.1`'s "no performance claim is accepted from code inspection alone."

## What was measured this pass

### Initial/lazy chunk sizes (production build, `pnpm build`)

| Asset | Raw | Gzip | Loaded on cold `/en`? |
|---|---|---|---|
| `index-*.js` (app entry: React, TanStack Router, @base-ui, i18n runtime) | 554.5 KB | 173.2 KB | Yes |
| `globals-*.css` | 93.5 KB | 16.0 KB | Yes |
| `home-*.js` (route chunk) | 4.0 KB | ~2 KB | Yes |
| `tool-workspace-*.js` (editor widget) | 227.0 KB | 66.3 KB | **No** — confirmed lazy |
| `inference.worker-*.js` | 512.9 KB | 146.4 KB | **No** — worker, loaded on first process |
| `model-lab.worker-*.js`, `refine-matte.worker-*.js`, `select-object.worker-*.js` | ~507–517 KB each | ~145–147 KB each | **No** — per-tool workers |
| `client-zip-*.js` | 6.2 KB | 2.6 KB | **No** — export-time only |

Measured via a throwaway script serving the real `.output/server` production build on
`127.0.0.1:4173` and driving it with Playwright (`page.on("response")`, response body byte counts).
Confirms the lazy-loading boundaries `docs/FRONTEND_CONVENTIONS.md` §9 and `PHASE_31_FINDINGS.md`
assume are real: the ~2 MB of per-tool ML workers never load on a cold visit, only the 554.5 KB app
shell + 4 KB route chunk (~603.6 KB JS / ~774 KB total transfer including fonts/CSS/beacon).

### Cold `/en` paint timing (same script, single run, localhost, no throttling)

| Metric | Value |
|---|---|
| First Contentful Paint | 304 ms |
| `domContentLoadedEventEnd` | 364 ms |
| `loadEventEnd` | 364 ms |
| Total page `load` event | 373 ms |

These numbers reflect zero network latency and a dev machine with no thermal/background
contention — **not a substitute for a real-device/real-network LCP/INP measurement**, which needs a
Lighthouse/WebPageTest run against a deployed build. Reported here only to establish that the
lazy-loading split above is doing its job (no multi-megabyte worker payload blocks first paint), not
as a production performance claim.

## Long tasks and heap trend over repeated churn (`scripts/profiling/measure-baseline.ts`, added 2026-07-30)

Built `pnpm profile:baseline` (see `docs/STACK.md` § Performance profiling): serves the real
production build, drives it with Playwright, and uses a raw CDP session
(`Performance.getMetrics` for JS heap, `HeapProfiler.collectGarbage` before each sample so numbers
reflect retained memory, not just not-yet-collected garbage) plus a `PerformanceObserver` for
`longtask` entries. Uses the same mocked-worker double as `pnpm e2e`, so results isolate
React/DOM/resource-lifecycle cost from real ONNX inference time — the right isolation for a
leak-detection question, the wrong one for a real-model timing question (still not measured, see
below).

### Long tasks

**Zero long tasks recorded across every run** (40-iteration single-upload churn, 60-iteration batch
churn, cold start) — expected, since the mocked worker returns near-instantly and this measurement
deliberately isolates from real ONNX compute time, which is where actual long tasks would occur.
Not a claim about real-inference long-task behavior.

### JS heap trend, repeated single-upload churn (upload → automatic result → back to upload)

| Sample size | First iteration | Last iteration | Avg Δ, first 10 | Avg Δ, last 10–20 | Negative Δs (real GC reclaiming) |
|---|---|---|---|---|---|
| 40 iterations | 6.70 MB | 9.96 MB | +195.8 KB/iter | +18.7 KB/iter (last 20) | 9 of 39 |
| 100 iterations (confirmation run) | 6.71 MB | 10.83 MB | +195.8 KB/iter | +19.1 KB/iter (last 10) | 9 of 99 |

Growth rate decelerates ~10x from the first 10 iterations to the last 10–20, in both a 40- and a
100-iteration run — consistent with one-time warm-up (lazy module init, memoized registries
stabilizing), not a constant-rate leak. ~9% of iterations showed the heap **decrease** even after
forced GC, confirming the allocator is actually reclaiming freed memory, not just failing to
collect. The 100-iteration run's ~19 KB/iteration residual growth in the tail (if it continued
linearly indefinitely, which the decelerating trend argues against) would only reach ~19 MB over
1,000 iterations — not evidence of a leak worth chasing further without a stronger signal.

### JS heap trend, repeated batch-upload churn (3-image upload → remove each item → back to upload)

| Sample size | First iteration | Last iteration | Avg Δ, first 10 | Avg Δ, last 10–20 | Negative Δs |
|---|---|---|---|---|---|
| 60 iterations | 8.22 MB | 10.65 MB | +109.9 KB/iter | +12.0 KB/iter (last 20) | 5 of 59 |

Same decelerating pattern and a comparable (~8%) negative-delta rate as the single-upload run.
Slightly higher absolute per-iteration cost than single upload, unsurprising given 3x the
documents/worker calls per iteration and the per-item "Remove image" teardown path exercised
directly (not a bulk/internal reset).

**Decision** (`PHASE_31_FINDINGS.md` F-15): `reject` — no leak found in either single or batch
upload/teardown churn, evidenced by two independent sample sizes for the single-upload case and a
consistent pattern for batch. This does not rule out a much slower leak below this measurement's
noise floor, or a leak in a flow not exercised here (e.g. repeated tool-switching within one
document, repeated background-fill changes, manual mask correction churn) — those remain untested
and are named explicitly in `PHASE_31_FINDINGS.md` as out of this pass's scope, not silently assumed
clean.

## What was NOT measured this pass, and why

- **INP under real interaction** — the long-task observer above covers the "long tasks" half of
  this `T2` line item; true INP (event-to-paint latency) needs per-interaction `event` timing
  entries, not built this pass — lower priority given zero long tasks were observed to correlate
  against.
- **Time-to-result, input/brush response** — needs the real ONNX/WebGPU inference path
  (`pnpm e2e:real-model`) instrumented with timing marks; this dev machine has no WebGPU passthrough,
  so any number captured here would be WASM-fallback-only and mislabeled as representative.
- **React commit counts/durations for hot interactions** — needs the React DevTools Profiler API
  (`Profiler` component or `react-dom/profiling` build) wired into a scripted interaction; not
  present in this codebase yet. Given the heap-churn and long-task data above show no red flags, and
  `F-11`'s effect spot-check found no defects, the a-priori value of building this specific
  instrumentation dropped — still named as a candidate for a future pass, not ruled out, just not
  prioritized given what the cheaper measurements already show.

**Decision** (`PHASE_31_FINDINGS.md` F-08, updated): heap/resource trend and long-task tracking are
now measured (`F-15`, `reject` — no leak found). Real-model timing and React commit profiling remain
`defer` — both need infrastructure (a WebGPU-capable measurement host; a Profiler-instrumented
build) this session cannot responsibly stand up and validate in the time remaining.
