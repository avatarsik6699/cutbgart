# Phase 42 Frontend Performance Research

Date: 2026-08-04
Scope: presentation-complete isolated v2 editor
Status: repository and managed-Windows interaction/resource audit complete; duration set incomplete

## Decision

Keep XState as the only editor workflow store. Do not add Redux, Zustand, another external store,
React Compiler, React Scan, Why Did You Render, or a Vite analysis plugin in Phase 42 without a
measured gap that the existing selector, Profiler, PerformanceObserver, CDP, and build evidence
cannot explain.

XState already provides the external-store behavior needed here. The defect was subscription and
state placement: broad session publication duplicated selected-actor notifications, while brush
size lived at the root of a large workspace component. Adding another store would duplicate truth
and leave both causes intact.

## Render and main-thread map

| Path | Finding | Disposition |
|---|---|---|
| Magic/Manual brush-size range | Every range step updated workspace-root React state, so the complete image stage and tool panel reconciled although only a numeric input and cursor diameter changed. | Fixed. The native uncontrolled range owns its displayed value; an imperative ref supplies pointer gestures, cursor CSS dimensions, and view-state persistence. Profiler tests lock zero additional React commits for a range change. |
| Pointer cursor and Magic live stroke paint | Cursor motion formerly crossed React and full-source canvas work ran per pointer event. | Fixed in the regression pass. Cursor movement is imperative; stroke display is capped and paints at most once per animation frame. Runtime/source coordinates and mutable strokes remain outside React/XState. |
| Selected document actor -> session -> page | `DocumentRuntime` republished a fresh active-session snapshot for every actor transition while active components also subscribed through `useSelector`. This caused a second top-level render wave. | Fixed. Actor-only changes notify workspace observers but not active-shell observers; runtime URL/controller changes still notify both. Single-document pages observe the active shell, while batch pages deliberately observe workspace summaries. |
| Active-page actor selectors | The outer active page subscribed through the aggregate fourteen-selector hook even though it only needed status/progress/revision/history availability and draft presence. The inner editor subscribed again. | Fixed. The outer boundary now uses only the six scalar selectors it renders; draft identity and tool details stay in the inner editor boundary. |
| Draft commit | One actor update at gesture commit still updates the active tool workspace and contextual toolbar history. | Accepted. This is semantic state, occurs at commit rather than pointer frequency, and is required to expose Undo/Redo and dirty state. |
| Automatic removal / Enhancement | Inference and image processing remain worker/coordinator owned. The presentation-era canvas mount and uninterrupted matte comparison were the measured main-thread regressions. | Fixed. The repeated managed-Windows production sample recorded zero Long Tasks, 72 ms Event Timing, 74 ms observed INP, CLS 0.00, and 7 ms forced reflow. |
| Magic candidate readiness | Raw worker output returned to the main thread, where constraint maps, ranking, fusion and three full-image candidate copies produced a 219 ms Long Task immediately before candidate readiness. | Fixed with explicit architect authorization. Internal protocol `v2` transfers the current base matte; the Magic worker returns already ranked/fused candidates. A repeat native production cycle recorded zero Long Tasks with prediction and commit counts unchanged. |
| Large binary values | No new image, matte, typed-array, or stroke collection is passed through React props/state or persisted in XState. | Pass by architecture/source audit. Artifact repositories, draft engines, workers, and canvas bindings retain ownership. |
| Resource lifetime | Existing actor/runtime/artifact/object-URL ownership tests and the Phase-42 real-model journey finish empty without reinference. | Pass. Three managed-Windows bilingual churn cycles and the post-fix Magic cycle ended with `0/0/0` artifact/lease/object-URL owners. |

## Tooling evaluation

| Tool | Use in this project | Decision |
|---|---|---|
| React Developer Tools Profiler / Performance tracks | Component commits, render causes, component timing, and StrictMode-aware manual diagnosis. | Primary manual React diagnostic. Compare a production build before declaring a dev-only symptom a product regression. |
| React `Profiler` in Vitest | Deterministic commit-boundary assertions around known hot controls. | Added for Magic and Manual brush-size regressions. It complements rather than replaces browser timing. |
| XState `useSelector` | Fine-grained actor subscriptions with scalar/reference comparison. | Keep. Prefer selectors at the consuming boundary; do not pass a changing aggregate snapshot down the page tree. |
| PerformanceObserver + CDP | Long tasks, event timing where supported, resources, heap/resource ownership, and browser metrics. | Keep and version through Phase-42 I5 reports. Unsupported signals remain explicit, never inferred as zero. |
| Vite `--profile` / `--debug plugin-transform` | Dev/build transform and plugin CPU diagnosis. | Run only when Vite startup/build is slow. It cannot diagnose React component renders. |
| `vite-plugin-inspect` | Inspect plugin transforms and middleware. | Not added: no transform-time bottleneck is currently evidenced. |
| `rollup-plugin-visualizer` | Explain bundle composition and duplicate/large modules. | Not added yet: useful only if production output budgets identify a bundle regression; it does not measure runtime responsiveness. |
| React Scan | Visual overlay and render callbacks. | Optional one-off local experiment, not a product dependency. It instruments runtime behavior and is unnecessary while Profiler plus repository tests reproduce the defect. |
| Why Did You Render | Logs avoidable renders and prop identity changes. | Not added: setup/instrumentation cost overlaps the current Profiler workflow and deterministic boundary tests. |
| React Compiler | Automatic memoization when code follows the Rules of React. | Not added during defect closure. Compiler adoption changes the build and needs its own compatibility/bundle/behavior evidence; it must not hide incorrect state ownership. |
| Build Web Apps Codex plugin | Current React performance-review and browser-debugging workflows for the agent. | Installed in the local Codex environment. It supplements, but cannot override, the repository SDD and v2 architecture contracts. |
| Chrome DevTools MCP 1.6.0 | Agent-driven performance traces, long-task/main-thread attribution, network inspection, and heap diagnostics. | Installed with an isolated profile, usage statistics disabled, and CrUX lookups disabled. MCP handshake, tool discovery, and an isolated `list_pages` browser call passed. |
| Fallow 3.14.0 CLI/MCP | Changed-code audit, complexity/duplication/style evidence, symbol tracing, and explicit v2 boundary enforcement. | Added as an exact dev dependency and local Codex MCP. The new-only gate passes with zero introduced dead-code, complexity, duplication, or boundary findings; inherited findings remain visible. |
| `review-v2-architecture` skill | Compose SDD scope, v2 ownership, static checks, React/runtime evidence, lifecycle, and test requirements into one review workflow. | Added under `.agents/skills` and validated with the official skill validator. It never auto-fixes or treats static evidence as runtime proof. |

## Bounded evidence

- Magic and Manual Profiler tests: changing the brush range produces zero React commits after the
  pre-interaction baseline while view-state persistence and cursor dimensions update.
- Editor-session subscription test: opening/cancelling an actor-owned draft notifies the workspace
  channel and produces zero active-shell notifications.
- Focused regression set: 15 tests passed after the subscription and brush changes.
- TypeScript and focused ESLint checks passed.
- Production build passed. Current client output keeps the v2 editor and tool workspace in separate
  chunks (238.91 kB and 209.69 kB uncompressed respectively); model workers remain separately
  emitted/lazy runtime assets. These are environment-specific observations, not a new universal
  bundle budget.
- Existing Phase-41 deterministic visual/behavior and serialized real-model evidence remains the
  functional baseline. The affected Phase-41 journey reran 9/9, and focused Phase-34/35 behavioral
  journeys reran 5/5 after this closure.
- Fallow recognized eight explicit v2 zones with zero boundary violations. Its first new-only audit
  found one unnecessary public type re-export and one overly branchy scalar subscription reader;
  both were corrected before the repeat audit passed. Two introduced styling heuristics remain
  advisory pending their normal UI review and do not authorize a styling rewrite.

## Remaining evidence

Target-device interaction and resource evidence now passes, including cold/warm work, tool
interaction, three churn cycles, actual 200% zoom and final zero-owner cleanup. The machine-readable
performance evaluator intentionally remains `inconclusive`: absolute cold-input, warm-input and
full-workflow duration fields are still unavailable in one or more required environments. These
nulls are unsupported signals, not inferred zeroes; final architect acceptance and the phase gate
remain separate requirements.

Both browser MCPs ran as native Windows processes through their PowerShell wrappers and reported
`navigator.platform === "Win32"`. The architect authorized the shared legacy/v2 toolbar scope.
Replacing synchronous `scrollWidth`/`clientWidth` reads with boundary observation removed that
path; a first repeat exposed panel autofocus as the remaining 29 ms synchronous layout trigger.
Scheduling the existing focus for the next animation frame preserved focus while the final repeat
recorded zero Long Tasks, 72 ms Event Timing, 74 ms observed INP, CLS 0.00, and 7 ms forced reflow.
The earlier compositor-only Cutout cursor experiment remains reverted because it did not change
the original trace attribution. A later complete-product capture found an independent 219 ms Magic
candidate-readiness task. Moving ranking/fusion and base-matte reconstruction into the existing
Magic worker removed it; the repeated native Windows production path recorded zero Long Tasks,
exactly one automatic inference, one prediction, one commit and `0/0/0` owners after cleanup.
