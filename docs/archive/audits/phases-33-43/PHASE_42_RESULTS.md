# Phase 42 complete-product readiness results

Date: 2026-08-05
Schema: `phase-42.readiness.v1`
Current conclusion: **blocked, architect-accepted and phase closed by explicit gate exception**

The implementation-level regression closure is complete, but Phase 42 cannot yet publish its final
architect-accepted cutover-readiness decision. The frozen matrix has been re-audited against
Phases 38–41 and the versioned evaluator fails closed while absolute mocked/host/target duration
signals remain unsupported. The architect accepted this `blocked` conclusion on 2026-08-05 and
later directed Phase-42 closure without fixing the single failed Phase-32 gate measurement.

## Closed regression set

- Automatic removal no longer mounts Magic as an implicit completion side effect.
- Enhancement comparison yields in bounded chunks and the selected tool/result remains visible.
- Manual/Magic share one contained stage, source-coordinate mapping, proportional cursor contract,
  imperative pointer/pan ownership and common contextual history.
- Magic product UI exposes Apply/Cancel; prediction and best-candidate selection remain internal to
  the existing correlated runtime flow.
- Active-shell and workspace notifications are separated; brush size and cursor motion produce no
  editor-shell React publication.
- Cutout containment, Hand/Space panning, current committed artifact binding and hidden toolbar
  scrollbar chrome are covered by focused deterministic evidence.
- Magic candidate ranking/fusion and full-image reconstruction now execute inside the existing
  worker. The internal transferable protocol is versioned to `v2`; document correlations,
  algorithm, model policy and automatic-best Apply behavior are unchanged.

Detailed root causes and bounded evidence are recorded in
`PHASE_42_REGRESSION_FINDINGS.md` and `PHASE_42_PERFORMANCE_RESEARCH.md`.

## Current blockers

- `/phase-gate 42` completed with one failure: the Phase-32 English upload-preparation sample
  measured a 129 ms main-thread task against its `<100 ms` budget. The architect explicitly waived
  this failure for Phase-42 closure; it is not represented as a passing measurement.
- The performance evaluator remains `inconclusive`, not failed: required interaction/resource
  observations pass, but absolute cold-input, warm-input and full-workflow duration fields remain
  unsupported in one or more required environments.

## Current local evidence

- The zero-retry deterministic Chromium journey passes in both locales across drop, paste,
  picker, single/batch processing, every editor tool, history, recovery, PNG/ZIP export,
  accessibility, narrow reflow and three cleanup cycles.
- Phase 39–41 exact visual and behavioral regressions pass after the accepted Phase-42 committed
  result presentation was recorded in the v2 result baselines; v1 reference baselines are
  unchanged.
- The serialized real-model journey passes for cold/warm batch work, Maximum quality with the
  environment's accepted runtime selection/fallback, every editor tool, history, selection,
  selected PNG/ZIP, recovery, no unrequested inference and zero final resources.
- Windows Playwright and Chrome DevTools MCP were revalidated after the browser-boundary
  correction: native Windows Chrome 150 reported `Win32`, AMD RDNA3 WebGPU, fine pointer,
  1041×735 CSS pixels and no coarse pointer. Three bilingual import/edit/remove/reset cycles each
  admitted one automatic inference, exposed equivalent announcements, remained horizontally
  contained and ended at `0/0/0` resources. Fine-pointer and keyboard alternatives passed; coarse
  input is explicitly unavailable on this managed device rather than emulated.
- Actual 200% browser zoom was applied through the native Chrome window: DPR changed from
  `1.21458` to `2.42916`, the layout viewport narrowed from 1041 to 520 CSS px, controls remained
  operable, and document width stayed contained (`513/513`).
- A full product cycle covered Automatic, Magic, Manual, Background, Enhancements, history and PNG
  export. Its first capture isolated a 219 ms Long Task between Magic worker prediction and
  candidate readiness. After moving ranking/fusion to the worker, the same native production path
  completed with automatic/prediction/commit counts `1/1/1`, zero Long Tasks, no horizontal
  overflow and final cleanup `0/0/0`. Across accepted target samples Event Timing was at most
  144 ms; the toolbar trace retained 74 ms observed INP, CLS 0.00 and 7 ms forced reflow.

The remaining missing signals are represented as `unsupported` in `PHASE_42_REPORTS.json`. The
report must remain `blocked`; it is invalid to infer absolute duration values or final architect
acceptance from Phase-38–41 runs or from WSL/headless evidence.

## Gate disposition

The 2026-08-05 gate passed Docker build/health, TypeScript, 181 Vitest files with 695 tests, ESLint
without errors, Steiger, Fallow, Phase-42 deterministic and real-model journeys, the general
real-model smoke, report verification, production build, container smoke, and all Architect Review
Notes. The full deterministic suite reported 133 passed, 3 skipped, and the one Phase-32 performance
budget failure above. Overall gate status is **FAIL — architect waiver accepted for blocked phase
closure**.

## Browser MCP environment contract

Playwright MCP and Chrome DevTools MCP are registered through Windows PowerShell wrappers under
`C:\Users\user\AppData\Local\cutbg-tools`. WSL owns the repository and app server only. Both active
channels reported `Win32` in this capture. Chrome DevTools rejected both the Windows fixture path
and the WSL UNC path under its configured workspace roots, so its trace admitted the exact public
repository fixture through a privacy-safe same-origin `/og-image.png` fetch. No Linux browser
observation is retained as target evidence.

## Route and architecture disposition

Public `/`, `/en`, scenario routes, indexing, analytics and legacy ownership remain unchanged. No
new domain/application/runtime protocol, persistence, environment variable, model policy or public
API was introduced by the evidence model. A later accepted `ready` result would authorize planning
a separate cutover phase only.
