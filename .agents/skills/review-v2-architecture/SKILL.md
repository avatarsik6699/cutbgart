---
name: review-v2-architecture
description: Review BG Remove App v2 changes for architecture, XState/data-flow, artifact ownership, React render ownership, browser performance, resource lifecycle, legacy leakage, and verification gaps. Use before merging v2 work, after migrating UI into v2, when diagnosing render or main-thread regressions, or when asked whether a diff follows ARCHITECTURE_V2.md and frontend best practices.
---

# Review V2 Architecture

Produce an evidence-backed review of the changed v2 surface. Keep static findings, runtime
measurements, and architectural judgment separate; no one tool proves all three.

## 1. Establish the contract

1. Read `AGENTS.md`, `docs/STACK.md`, `docs/FRONTEND_CONVENTIONS.md`,
   `docs/ARCHITECTURE_V2.md`, `docs/STATE.md` Current Contract, the active `docs/PHASE_XX.md`, and
   relevant `docs/KNOWN_GOTCHAS.md` entries.
2. Inspect `git status`, the diff against local `main`, and recent history. Preserve unrelated and
   user-owned changes.
3. Reject findings or fixes outside the active phase. Record new capability or contract work as a
   blocker/follow-up instead of implementing it.
4. Consult current primary documentation before judging third-party React, XState, Vite, TanStack,
   Playwright, or browser APIs, following `AGENTS.md`'s documentation lookup order and call cap.

## 2. Collect deterministic evidence

Run read-only checks from the repository root. Fallow exit code 1 means findings, not tool failure.

```bash
pnpm arch:lint
pnpm quality:fallow
pnpm quality:fallow:review
```

Before changing or judging a v2 file, run `fallow guard <changed-files> --format json --quiet` and
read the applicable boundary rules. Trace a reported symbol, dependency, or duplicate before
recommending deletion or consolidation. Never run `fallow fix` during review.

Treat Fallow as graph/complexity/duplication/style evidence, Steiger as FSD enforcement, TypeScript
as compiler evidence, and ESLint as source-rule evidence. Do not present any one as proof of runtime
correctness.

## 3. Review the ownership boundaries

Check every changed path and its callers for these invariants:

- `domain` stays framework/platform/binary-free and owns pure commands, events, policies, and legal
  transitions.
- `application` owns XState workflow and ports; actor snapshots contain IDs and metadata, never
  `Blob`, `File`, pixels, canvas, object URLs, workers, or mutable drafts.
- `runtime-browser` owns artifacts, object URLs, browser workers, canvas-heavy processing,
  correlation, cancellation, cleanup, and external-store publication.
- `presentation` and `pages/editor-v2` select the narrowest scalar/identity state and emit semantic
  intents. They do not recreate workflow truth, retain binary state, or import legacy hooks,
  controllers, stores, worker ownership, or processing logic.
- `v2/shared` remains dependency-light and consumer-proven. External callers use semantic public
  APIs rather than deep imports.
- A tool always reads the current committed artifact. Async completion is correlated to document,
  revision, run, and draft identities and cannot publish after cancellation, replacement, reset,
  disposal, or tool/document switch.

Search changed v2 production files for legacy imports and direct platform ownership. Explain every
match; do not accept an adapter merely because its name contains `v2`.

## 4. Review React and interaction performance

Require measured evidence before recommending memoization, React Compiler, another state manager,
or a Vite plugin.

- Keep durable workflow state in XState and runtime resources outside React.
- Select primitive or stable-identity actor/external-store values. Flag subscriptions returning
  broad snapshots or freshly allocated objects without equality control.
- Keep pointer movement, brush preview, pan/zoom, animation frames, and other high-frequency
  transient values imperative or locally isolated when no other React consumer needs them.
- Flag render-time mutation, duplicated subscriptions/publications, unstable prop fan-out, and
  synchronous full-image work on input handlers.
- Distinguish StrictMode/development diagnostics from production behavior.

For a reported runtime problem, reproduce the exact interaction with Playwright and capture a
Chrome DevTools performance trace. Attribute long tasks to React commit/render work, JavaScript,
layout/paint, canvas, decode, worker messaging, or inference before proposing a fix. Capture heap
evidence for suspected leaks. If Chrome DevTools MCP is unavailable, report the missing evidence;
do not infer a trace from wall-clock command duration.

## 5. Review lifecycle and verification

Check artifact leases, object URL revocation, worker/canvas disposal, stale async settlement,
listener/subscription cleanup, and repeated import/edit/reset/dispose churn. Require:

- focused Vitest coverage for changed contracts and failure paths;
- Playwright coverage for changed user-visible behavior;
- zero arbitrary sleeps and retry-dependent success;
- real-model and managed-device evidence when the phase contract requires them;
- privacy-safe diagnostics with no filenames, image content, prompts, pixels, or object URLs.

## 6. Report

Lead with findings ordered by severity. For each finding provide the file/line, violated contract,
concrete evidence, user or architecture impact, and smallest in-scope remediation. Then list:

1. checks run and their results;
2. runtime evidence captured or explicitly missing;
3. verified strengths that materially reduce risk;
4. residual risks and phase blockers.

If no material finding remains, state that explicitly without claiming that static analysis proves
runtime performance or manual product acceptance.
