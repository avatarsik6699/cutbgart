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

## What was NOT measured this pass, and why

- **INP / long tasks under real interaction** — needs a scripted interaction trace (e.g.
  `page.evaluate` + `PerformanceObserver` for `longtask`/`event` entries) across the S2/S3 baseline
  scenarios; not built this pass.
- **Time-to-result, input/brush response** — needs the real ONNX/WebGPU inference path
  (`pnpm e2e:real-model`) instrumented with timing marks; this dev machine has no WebGPU passthrough,
  so any number captured here would be WASM-fallback-only and mislabeled as representative.
- **React commit counts/durations for hot interactions** — needs the React DevTools Profiler API
  (`Profiler` component or `react-dom/profiling` build) wired into a scripted interaction; not
  present in this codebase yet and out of scope to add as new production instrumentation per this
  phase's own "no always-on production profiling" rule (`I1`).
- **Heap/resource trend over repeated single and batch churn** — needs repeated upload/process/reset
  cycles with `performance.memory` or CDP heap snapshots compared before/after; not run this pass.

**Decision** (recorded in `PHASE_31_FINDINGS.md` F-08): these four remain `defer` — each needs
purpose-built scripted instrumentation (a real, non-trivial deliverable in its own right, matching
`T2`'s own scope) rather than something safely improvised inside this already-large session. The
chunk-size and cold-paint data above are real and reusable as-is for the next pass that adds this
tooling; they should not be re-captured from scratch.
