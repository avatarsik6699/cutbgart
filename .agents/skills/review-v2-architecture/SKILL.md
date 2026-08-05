---
name: review-v2-architecture
description: Review BG Remove App frontend changes with a lightweight changed-surface mode during implementation and a full evidence mode before a phase gate or when diagnosing a reproduced runtime problem. Use for v2 ownership, React render boundaries, XState/data flow, browser-resource lifecycle, and final performance verification without forcing full-project diagnostics on every refactor.
---

# Review V2 Architecture

Protect the few ownership rules whose violation creates correctness or lifecycle bugs. Allow broad
refactoring freedom inside those boundaries. Keep static analysis, runtime evidence, and
architectural judgment distinct.

## Choose the review mode

- **Focused** — default for an implementation task or checkpoint. Review only changed files, their
  direct callers, and the behavior being changed. Do not require a pre-change trace, whole-project
  audit, real-model run, heap snapshot, or full phase gate.
- **Final** — use before the phase gate or when explicitly requested. Review the complete changed
  phase surface and collect the performance/resource evidence required by the phase contract.
- **Diagnostic** — use for a reproduced freeze, render storm, long task, or leak. Reproduce the
  exact interaction and collect only the runtime evidence needed to attribute that problem.

## Establish scope

Read the active phase, relevant current contracts and frontend conventions, then inspect the diff
and preserve unrelated changes. Consult current primary documentation before judging a
third-party API. A phase may explicitly defer broad performance measurement to its final task.

## Minimum invariants

1. Keep one workflow source of truth. XState/application owns commands and durable document state;
   presentation must not mirror it in React, MobX, or another store.
2. Keep browser resources outside React and actor snapshots. Runtime-browser owns blobs, pixels,
   canvases, object URLs, workers, cancellation, correlation, and cleanup.
3. Prevent stale publication. Async completion must not apply after cancellation, replacement,
   reset, disposal, revision change, or document/tool switch.
4. Subscribe near the consumer. Prefer primitive or stable-identity selectors; do not make a large
   parent observe state needed only by one leaf.
5. Keep high-frequency interaction state local or imperative when no other React consumer needs it.
6. Preserve deterministic release paths when changed code touches artifacts, URLs, workers,
   listeners, subscriptions, or canvases.
7. Add focused automated coverage for changed behavior; user-visible changes require a narrow
   Playwright journey unless the active phase explicitly assigns it to a later integration task.

Do not reject a refactor merely because it changes component boundaries, introduces a small
adapter, or lacks pre-change measurements. Recommend memoization, a compiler, or another state
manager only when it has a clear owner, does not duplicate workflow truth, and addresses an
observed remaining problem.

## Focused review

1. Run `fallow guard <changed-files> --format json --quiet` when architecture-zoned files change.
2. Inspect changed subscriptions, projections, callback identities, resource ownership, and direct
   callers.
3. Run only the tests and lint/type checks relevant to the checkpoint.
4. Report findings with file/line, impact, and the smallest in-scope remediation. State which broad
   checks were intentionally deferred; their absence is not a finding.

## Final or diagnostic evidence

In final mode, run the checks required by the phase and `docs/STACK.md`, including architecture and
Fallow gates. Exercise the accepted user flows with Playwright. Use Chrome DevTools traces or heap
evidence only for the final performance/resource acceptance contract or to attribute a reproduced
problem. Distinguish React rendering, JavaScript, layout/paint, canvas, worker messaging, decode,
and inference costs.

## Report

Lead with material findings ordered by severity. Then list checks run, runtime evidence collected
or intentionally deferred, verified strengths, and remaining final-gate work. If no material
finding remains, say so without claiming that focused static checks prove runtime performance.
