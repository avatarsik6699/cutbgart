# Phase 44 T1 final verification

Date: 2026-08-08  
Branch: `feat/phase-44`  
Checkpoint reviewed: `b034f51`

## Outcome

T1 and the separate Phase 44 gate passed. The end-state keeps one editor workflow owner,
leaf-level XState/external-store selectors, imperative high-frequency canvas state, bounded artifact
ownership, and no retained state-manager experiment. This report records end-state evidence only;
it does not claim a numeric improvement against a pre-refactor baseline.

## Render and subscription review

- `EditorModel` remains the React composition boundary. React consumers read stable cached
  snapshots through `useSyncExternalStore`; document workflow reads stay on focused XState
  selectors at the connector that renders them.
- Manual and Magic pointer, pan, zoom, and brush-size paths stay inside their imperative viewport
  boundary. React `Profiler` regressions prove brush-size and drag gestures add no workspace commit.
- The selected-value external-store regression proves unrelated model publications do not commit a
  consumer whose selected value is unchanged.
- Projection subscriptions own URL replacement and disposal exactly once. Reset/churn tests retain
  the `artifacts=0`, `leases=0`, `objectUrls=0` terminal invariant.
- Opt-in `pnpm dev:profile` initialized Why Did You Render before hydration in native Chrome. Its
  startup diagnostics were present only in profile mode; the production `.output` contained
  neither the activation marker nor the package import. Startup reports were limited to equal-prop
  icon hydration noise and did not expose an editor workflow ownership issue.

Frontend contract: PASS

## Managed Windows Chrome evidence

The production build ran in Chrome 151 on native Windows (`navigator.platform=Win32`) with the AMD
Radeon 780M D3D11 ANGLE renderer. WebGPU adapter acquisition succeeded, including the required
buffer limit and feature enumeration.

A DevTools performance recording covered a cold BEN2 Maximum WebGPU run, a cached rerun, Cutout
Magic/Manual switching, Background/Enhancements switching, and reset. The recording was inspected
in-session; no numeric before/after claim is made. The MCP bridge could not retain the raw trace
because its stop response exceeded the bridge string limit.

Resource observations:

| Point | Artifacts | Leases | Object URLs | JS heap used |
|---|---:|---:|---:|---:|
| BEN2 result ready | 3 | 7 | 2 | 10,217,917 bytes |
| After cached rerun and tool churn | 3 | 7 | 2 | 11,262,031 bytes |
| After reset | 0 | 0 | 0 | 8,453,074 bytes |

The only production-console failure was the expected loopback Cloudflare analytics CORS rejection;
no source image or inference request left the browser.

## Architecture and cleanup

- Steiger: no problems.
- Fallow new-only gate: `warn` with zero introduced complexity, duplication, circular dependency,
  boundary, or error-level dead-code findings. Remaining introduced findings are advisory private
  type-surface and theme-token checks.
- Fallow graph review snapshot `graph:15158ce060ad221b`: all four surfaced public-contract anchors
  post-validated (`accepted=4`, `rejected=0`, `stale=false`).
- Removed proven-unused barrel exports, two unused UI modules, and unused model methods. Three
  runtime/type-aware false positives carry narrow suppressions at their actual ownership boundary.

## Verification matrix

| Check | Result |
|---|---|
| ESLint, TypeScript, Vitest, Steiger | PASS |
| Focused Phase 44 Chromium | PASS — 9/9 |
| Deterministic full browser matrix | PASS — 35 passed, 3 opt-in model-lab scenarios skipped |
| Serialized real-model Chromium journey | PASS — 1/1 |
| Production build and production WDYR exclusion | PASS |
| Production dependency audit | PASS — no known vulnerabilities |
| Production license policy | PASS — 12 reviewed expressions |
| Pinned model manifest | PASS — `v0.22.0` valid |
| Release operation tests | PASS — 6/6 |
| Disposable Docker deploy/rollback/idempotence/lock suite | PASS |

The dependency audit initially identified CVE-2026-59870 in transitive `js-yaml@4.3.0`. The root
workspace now pins `js-yaml@4.3.1`; the lockfile, production build, and audit were regenerated and
rechecked.
