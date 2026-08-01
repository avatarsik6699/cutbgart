# PHASE 32 — Critical Bugs, Performance & Stability

<!-- TOKEN BUDGET: keep this file under 10,000 tokens. Be concise. -->

## Phase Metadata

| Field | Value |
|-------|-------|
| Phase | `32` |
| Title | Critical Bugs, Performance & Stability |
| Status | `⏹ closed — accepted incomplete` |
| Tag | `v0.32.0` |
| Depends on | PHASE_31 gate passing |

---

## Phase Goal

Remove the reported freezes, state loss and batch failures so the existing editor remains responsive
from upload/model initialization through export. Every correction must work for one upload and for
the selected item in a multiple-upload session, preserve the user's last committed document, and
leave no active work or resources behind after cancel, navigation or item switching. Delivery is
wave-gated: a wave's focused tests and measurements pass before implementation moves to the next
wave (SPEC.md §2.2, §7.1, §7.3, §7.7).

---

## Scope

### Other

- [x] `T1` Build `docs/audits/PHASE_32_BASELINE.md`: reproduce every 1.1–1.7 symptom with
  deterministic fixtures and an available-host real-model run for both single and multiple uploads.
  Capture browser/build/hardware, exact steps, main-thread tasks, event-to-next-paint, worker traffic,
  React commits, memory/resources and state transitions; map each symptom to its root cause before
  selecting a fix — _Depends on:_ —
- [x] `T2` Freeze the acceptance matrix in that baseline: no application-attributable main-thread
  task `>=50 ms`, event-to-next-paint `p95 <100 ms` for pointer/scroll/cached-item selection, no
  reinference when selecting a completed item, no duplicate commit, and no resource growth after
  repeated cancel/navigation/item churn. Record measurement caveats; do not claim universal device
  performance from one host — _Depends on:_ `T1`
- [x] `T3` Implement in four ordered waves and append focused before/after evidence to
  `docs/audits/PHASE_32_RESULTS.md` after each wave. Do not begin the next wave until the current
  wave's affected unit/integration/E2E/performance checks pass: W1 lifecycle+initialization (`F1`–`F2`),
  W2 Cutout (`F3`–`F4`), W3 Enhancements+Background+viewport (`F5`–`F7`), W4 batch+cache (`F8`–`F10`) —
  _Depends on:_ `T2`

### Frontend

- [x] `F1` Establish explicit run ownership for the affected async paths: one active run identity,
  single-flight Apply, abort/stale/error terminals, and cleanup on tool/item/route change or unmount.
  A cancelled, stale or failed run cannot mutate the visible document/history; reuse existing shared
  worker lifecycle helpers only where their protocol genuinely matches — _Depends on:_ `T2`
- [x] `F2` Remove upload/model-initialization blocking for single and multiple uploads. Keep model
  fetch/session creation, inference, full-resolution transforms, compositing and PNG encoding off the
  main thread (or cooperatively chunked only where a worker is impossible); keep progress, navigation
  and editor controls responsive while bounded work continues — _Depends on:_ `F1`
- [x] `F3` Fix Cutout Magic and committed history: Apply is single-flight and produces exactly one
  current-document commit; Cancel always gives visible feedback and exits/clears the draft even when
  there are no strokes; undo/redo never performs synchronous full-image copies and preserves coherent
  base/current artifacts across repeated passes — _Depends on:_ `F2`
- [x] `F4` Fix Cutout Manual and tool synchronization: Magic and Manual always render the selected
  item's latest committed document; Manual Apply cannot be invoked repeatedly while pending, commits
  durably, clears the dirty guard on success, and survives tool/item switching. Brush controls and
  size slider remain mounted/populated after any Background → Enhancements → Cutout sequence —
  _Depends on:_ `F3`
- [x] `F5` Make Enhancement Apply non-blocking and single-flight. Stop cancels/invalidates the active
  run, preserves the last committed result and the user's current checkbox selection, releases
  run-owned resources, and reports cancellation truthfully without claiming a partial result was
  saved. Tool/route/item navigation during a run cannot leak or publish stale output — _Depends on:_ `F4`
- [x] `F6` Make Background Apply non-blocking and single-flight. Fix the custom-colour popover so the
  palette and Done action are never clipped or overlaid at supported breakpoints/zoom: collision-aware
  placement plus a bounded scrollable content area keeps every control reachable — _Depends on:_ `F5`
- [x] `F7` Show view controls only in Cutout. While Space-pan is active render only the hand cursor;
  update brush position through the imperative canvas/pointer path so it remains cursor-aligned during
  zoom/pan. Plain wheel continues page scrolling; explicit canvas zoom (Ctrl/Meta+wheel) captures the
  gesture and visibly highlights/labels the stage boundary while capture is active — _Depends on:_ `F6`
- [x] `F8` Stabilize multiple-file enqueue/add scheduling so every valid image reaches an independent
  terminal result/error under bounded WebGPU/WASM concurrency. Adding files while a batch exists must
  not corrupt queues, worker requests, selection or completed siblings — _Depends on:_ `F7`
- [x] `F9` Replace `BatchItem.error?: string` with `BatchItemError`; expose a localized per-tile
  summary and expandable safe detail. Retry starts a fresh bounded run from the retained source,
  clears only that item's transient error/work, works after both initial and add-image failures, and
  never requeues or discards successful siblings — _Depends on:_ `F8`
- [x] `F10` Retain each completed item's `EditDocument`, committed history, tool-local draft/settings,
  viewport and preview artifacts for the session. Selecting a completed item restores them immediately
  without upload/decode/automatic reinference; eviction/removal/reset releases only unreachable
  artifacts. Prove isolation and parity across at least three items with edits in different tools —
  _Depends on:_ `F9`

### Infra

- [x] `I1` Add characterization/unit/integration tests before each behavior change, including worker
  crash/stale/cancel/unmount, Apply re-entry, no-stroke Cancel, history integrity, route/tool/item churn,
  batch add/retry/error details and item-owned cache eviction — _Depends on:_ `T2`
- [x] `I2` Add/extend bilingual Playwright flows for every reported behavior in both single and
  multiple-upload modes. Instrument deterministic inference request counts and CDP traces so tests
  assert no completed-item reinference and the Phase-32 responsiveness budgets, not only final DOM —
  _Depends on:_ `I1`, `F10`
- [x] `I3` Run the complete host gate and serialized real-model smoke after the four waves; repeat the
  baseline churn and record final task/paint/memory/resource evidence. No listed 1.1–1.7 defect may be
  deferred to Phase 33; a failing budget or unresolved architect note blocks Phase 32 —
  _Depends on:_ `T3`, `I2`

---

## Files

### Create / modify

~~~
docs/audits/PHASE_32_BASELINE.md
docs/audits/PHASE_32_RESULTS.md
src/features/remove-background/
src/features/upload-image/
src/features/batch-processing/
src/features/select-object/
src/features/correct-mask/
src/features/editor-history/
src/features/refine-matte/
src/features/refine-foreground/
src/features/background-replacement/
src/entities/edit-document/
src/widgets/tool-workspace/
src/shared/lib/ (only an evidence-justified reusable lifecycle/performance primitive)
messages/ru.json
messages/en.json
e2e/phase-32-stability.spec.ts
e2e/support/
scripts/profiling/
docs/PHASE_32.md
~~~

Only files tied to a reproduced root cause may be changed; this list is an ownership boundary, not
authorization for a blanket rewrite.

### Do NOT touch

- Model families, weights, revisions, inference quality or privacy/client-only invariants
- Server APIs, analytics events, persistence, env vars, accounts, payments or Studio capability
- Phase-33 accessibility/device research or Phase-34 legal/consent implementation
- Unrelated FSD/style cleanup, package churn or speculative worker abstraction

---

## Contracts

### New persistent data (tables / collections / files)

Repository-only baseline/results evidence. No runtime persistence is added; image/document caches
remain bounded browser-memory session state.

### New API endpoints / RPC methods / events

None.

### New types / models / shared interfaces

```ts
type BatchItemError = {
  code: string;
  message: string;
  detail: string;
  retryable: boolean;
};

type BatchItem = {
  // existing fields unchanged
  error?: BatchItemError;
  editDocument?: EditDocumentScope;
};
```

`detail` is localized/safe for user display and never contains image bytes, derived pixels,
filenames beyond the tile's existing local label, object URLs, stack traces with local paths, or
analytics-bound identifiers. Tool-run identities and abort handles stay internal to their owning
slice unless root-cause evidence proves one genuinely shared contract.

### New env vars

None.

---

## Gate Checks

Run targeted checks after every wave, then `/phase-gate 32` before committing. The complete
`docs/STACK.md` gate applies; Playwright remains host-only.

```bash
pnpm lint
pnpm tsc --noEmit
pnpm vitest run
pnpm exec steiger ./src
pnpm e2e e2e/phase-32-stability.spec.ts --project=chromium --workers=1
pnpm profile:baseline
pnpm e2e:full
```

Attach `PHASE_32_RESULTS.md` evidence for all four waves and both single/multiple upload scenarios.
Fail the gate on any reproduced 1.1–1.7 defect, application-attributable task `>=50 ms`, interaction
`p95 >=100 ms`, reinference on completed-item selection, duplicate/stale commit, lost item state,
unexplained batch failure, or resource growth after repeated cancel/navigation/item churn.

---

## Architect Review Notes

- [x] Manual verification on 2026-08-01 still reproduces UI freezes during image/model processing
  and Magic Apply. The first Magic stroke can enter a busy encode/preparation state that appears to
  apply automatically. Architect explicitly accepted closing the legacy phase without another test
  run or gate; these defects move to the architecture-led v2 program and are not represented as
  fixed.

---

## Implementation Notes

- Phase 32 delivered local lifecycle and state changes, but its principal responsiveness goal was
  not achieved on the architect's real browser/device. Automated evidence in
  `docs/audits/PHASE_32_RESULTS.md` is host-specific and is superseded for product acceptance by the
  failed manual verification above.
- Closure is a deliberate roadmap transition, not a successful stability claim. `/phase-gate 32`
  was waived by explicit architect direction on 2026-08-01; no release tag should be created for
  this phase.

---

## Atomic Commit Message

```text
chore(phase-32): close incomplete legacy stabilization
```

---

## Post-Phase Checklist

- [x] All Scope checkboxes checked; every wave's focused checks recorded before the next wave
- [x] Closing gate explicitly waived by architect on 2026-08-01; no final test run performed
- [x] All architect review notes resolved
- [x] `docs/STATE.md` updated — `/context-update 32` with accepted-incomplete exception
- [ ] Committed atomically on `feat/phase-32`
- [x] No `v0.32.0` tag by architect-approved exception: the phase did not pass product acceptance
