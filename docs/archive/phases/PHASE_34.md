# PHASE 34 — Editor v2 Document History & Manual Cutout

<!-- TOKEN BUDGET: keep this file under 10,000 tokens. Be concise. -->

## Phase Metadata

| Field | Value |
|-------|-------|
| Phase | `34` |
| Title | Editor v2 Document History & Manual Cutout |
| Status | `✅ done` |
| Tag | `v0.34.0` |
| Depends on | PHASE_33 gate and architect acceptance passed |

---

## Phase Goal

Extend the accepted v2 one-image slice with bounded committed document history and deterministic
Manual Cutout, as specified by [`SPEC.md`](../../SPEC.md#23-active-v2-scope--phase-34). Keep large alpha,
canvas, and patch buffers outside React/XState; make Apply one atomic artifact-aware history commit,
Cancel a true no-op on committed state, and Undo/Redo safe under pruning and stale revisions. Preserve
the Phase-33 automatic-removal, export, responsiveness, SSR, and cleanup guarantees.

---

## Scope

### Architecture and domain

- [x] `T1` Freeze the Phase-34 command/event/state chart, draft/runtime ownership, two-level history
  semantics, artifact lease graph, pruning policy, keyboard routing, accessibility behavior, and
  performance marks. Audit the legacy Manual/history implementation signal by signal; record pure
  policies eligible for extraction, but import no legacy React hook/store/workflow state — _Depends on:_ —
- [x] `T2` Add framework-free Manual draft/history vocabulary and pure decisions for begin, dirty,
  cancel, apply, document undo/redo, stale revision, redo invalidation, and 20-operation/96-MiB
  pruning. Actor state remains ID-only and exhaustive illegal outcomes stay typed — _Depends on:_ `T1`
- [x] `T3` Extend the document XState actor and narrow selectors with one manual draft and committed
  history. Apply is one invoked, cancellable commit; failure retains the draft for retry/cancel;
  reset/dispose releases draft/history ownership; no additional stateful orchestration service is
  introduced around the actor — _Depends on:_ `T2`

### Browser runtime

- [x] `T4` Extend `ArtifactRepository` with explicit draft/history lease owners and atomic snapshot
  promotion. Pruning or redo invalidation releases only unreachable artifacts; baseline, current,
  preview, export, past, and future owners remain independently auditable — _Depends on:_ `T2`
- [x] `T5` Implement a runtime-owned Manual draft repository/engine: source-space Restore/Erase,
  deterministic hardness falloff, untouched-byte preservation, pointer-cancel rollback, bounded
  dirty-rectangle gesture patches, and draft Undo/Redo. Full alpha planes and patches never enter
  React props/state or actor snapshots — _Depends on:_ `T4`
- [x] `T6` Extend the typed worker/gateway boundary with `manual-cutout-commit` to composite and
  encode accepted draft alpha without inference. Transfer eligible buffers, correlate revision and
  draft identity, return exactly one snapshot, and preserve the editable draft on retryable failure
  while releasing stale/cancelled outputs — _Depends on:_ `T3`, `T5`

### Frontend

- [x] `F1` Add the bilingual Manual workspace to the existing noindex v2 route using cohesive v2
  presentation modules and existing design tokens: Restore/Erase, brush size, zoom/pan/fit, visible
  source-space cursor, checkerboard preview, explicit Apply/Cancel, and truthful applying/error state.
  Do not add Magic, Enhancements, Background, batch, or public-route migration — _Depends on:_ `T5`
- [x] `F2` Implement accessible draft behavior: each gesture is one local undo step; Ctrl/Cmd+Z and
  redo variants target draft history while Manual is open; pointer capture/cancel is deterministic;
  dirty reset/navigation is guarded; Cancel restores the committed preview and revision exactly;
  Apply commits once and closes/refreshes the draft baseline — _Depends on:_ `F1`, `T6`
- [x] `F3` Add committed document Undo/Redo controls and announcements. Outside an active Manual
  draft shortcuts target document history; Undo/Redo updates preview/export without inference,
  increments revision, invalidates stale work, and disables honestly at history boundaries —
  _Depends on:_ `T3`, `T4`, `F2`

### Verification and infrastructure

- [x] `I1` Add table/model-based domain and actor tests for legal/illegal begin/apply/cancel,
  multi-gesture single commit, stale apply, apply failure/retry, undo/redo boundaries, redo branch
  invalidation, pruning, reset/unmount, and randomized history churn with zero reachable leaked
  leases — _Depends on:_ `T3`, `T4`
- [x] `I2` Add draft/canvas/worker contract tests for exact untouched alpha, Restore/Erase output,
  hardness footprint, source-space geometry across zoom/pan, pointer cancellation, patch bounds,
  transfer/correlation, no inference, and no full-image React/XState payload — _Depends on:_ `T5`, `T6`
- [x] `I3` Add deterministic bilingual Playwright for automatic result → Manual draft → local
  undo/redo → Cancel/Apply → document undo/redo → export/reset, including keyboard, dirty guard,
  viewport controls, one-commit/zero-reinference assertions, and artifact cleanup. Keep the lane
  parallel-safe, zero-retry, and free of arbitrary sleeps — _Depends on:_ `F3`, `I1`, `I2`
- [x] `I4` Add one serialized real-model/manual smoke and target-device evidence for brush/action
  responsiveness, Apply/Undo/Redo paint latency, unchanged automatic/export behavior, bounded
  history resources at both caps, and zero leases after churn. Unsupported signals remain explicit —
  _Depends on:_ `I3`
- [x] `I5` Run `/phase-gate 34`, production build/container smoke, dependency/license/model/security
  checks, Phase-34 suites, report verification, and architect affected-device review. Record versions,
  limitations, results, and unresolved review notes — _Depends on:_ `I4`

---

## Files

### Create / modify

~~~
docs/ARCHITECTURE_V2.md
docs/PHASE_34.md
docs/SPEC.md
docs/STACK.md
docs/STATE.md
docs/audits/PHASE_34_RESULTS.md
src/v2/domain/document.ts
src/v2/domain/commands.ts
src/v2/domain/events.ts
src/v2/domain/document-history/
src/v2/application/document/
src/v2/runtime-browser/artifacts/
src/v2/runtime-browser/manual-cutout/
src/v2/runtime-browser/processing/
src/v2/presentation/manual-cutout/
src/pages/editor-v2/
src/v2/testing/
messages/en.json
messages/ru.json
e2e/phase-34-manual-cutout.spec.ts
e2e/phase-34-manual-cutout.real.spec.ts
e2e/support/v2/
scripts/profiling/v2/
package.json
pnpm-lock.yaml
~~~

Existing files may be split only along semantic ownership boundaries required by this phase. Every
new module exposes a narrow `index.ts`; imports outside the module use that public API.

### Do NOT touch

- Legacy behavior/workspace/Cutout/Manual/history except a documented extraction of pure,
  framework-free geometry/pixel policy with backward-compatible imports
- Main public/scenario routes, sitemap indexing policy, or legacy feature removal
- Magic Cutout, matting/foreground refinement, Enhancements, Background, batch/multi-document UI
- Accounts, auth, billing, payments, database, storage, queues, server upload/processing, generated
  backgrounds, model family/weights/revisions, CDN manifest, privacy behavior, or new env flags
- Comlink, workerpool/threads.js, canvas frameworks, generic event buses, or speculative utilities

---

## Contracts

> This section is the source of truth for `/context-update`. Fill it in **before** handing to AI.

### New persistent data (tables / collections / files)

Repository Phase-34 results/evidence documentation only. Draft, patch, history, alpha, snapshot, and
artifact state is browser-tab memory only. No database, IndexedDB, image storage, account, remote
job, or new `localStorage` key.

### New API endpoints / RPC methods / events

No server API/RPC endpoint. New commands/events are in-process only:

```ts
type ManualCutoutCommand =
  | { type: "BEGIN_MANUAL_CUTOUT"; documentId: DocumentId; expectedRevision: Revision }
  | { type: "APPLY_MANUAL_CUTOUT"; documentId: DocumentId; draftId: ManualDraftId;
      expectedRevision: Revision; draftMatte: ArtifactId }
  | { type: "CANCEL_MANUAL_CUTOUT"; documentId: DocumentId; draftId: ManualDraftId }
  | { type: "UNDO_DOCUMENT"; documentId: DocumentId; expectedRevision: Revision }
  | { type: "REDO_DOCUMENT"; documentId: DocumentId; expectedRevision: Revision };

type ManualCutoutEvent =
  | { type: "MANUAL_DRAFT_STARTED"; documentId: DocumentId; draftId: ManualDraftId;
      baselineRevision: Revision }
  | { type: "MANUAL_DRAFT_DIRTY_CHANGED"; documentId: DocumentId; draftId: ManualDraftId;
      dirty: boolean }
  | { type: "MANUAL_COMMIT_SUCCEEDED"; documentId: DocumentId; draftId: ManualDraftId;
      expectedRevision: Revision; snapshot: DocumentSnapshot }
  | { type: "MANUAL_COMMIT_FAILED"; documentId: DocumentId; draftId: ManualDraftId;
      expectedRevision: Revision; error: ProcessingError }
  | { type: "MANUAL_DRAFT_CANCELLED"; documentId: DocumentId; draftId: ManualDraftId };
```

The worker protocol adds one correlated `manual-cutout-commit` operation. It composites/encodes but
must never load or invoke an inference model.

### New types / models / shared interfaces

```ts
type ManualCutoutMode = "restore" | "erase";
type ManualDraftId = string;
type EditOperationId = string;

type ManualCutoutDraft = {
  draftId: ManualDraftId;
  documentId: DocumentId;
  baselineRevision: Revision;
  dirty: boolean;
};

type DocumentHistoryEntry = {
  operationId: EditOperationId;
  kind: "manual-cutout";
  before: DocumentSnapshot;
  after: DocumentSnapshot;
  estimatedHistoricalBytes: number;
};

type DocumentHistory = {
  past: readonly DocumentHistoryEntry[];
  future: readonly DocumentHistoryEntry[];
  retainedHistoricalBytes: number;
};

type ManualCutoutPatch = {
  box: { minX: number; minY: number; maxX: number; maxY: number };
  before: Uint8ClampedArray;
  after: Uint8ClampedArray;
}; // runtime-only; forbidden in actor/React snapshots
```

Committed history is capped at 20 operations and 96 MiB retained historical artifacts. Gesture
patch history is separately capped at 20 patches per draft.

### New env vars

None. Reuse current browser/model configuration; add no history, worker, backend, or feature flag.

---

## Gate Checks

Run focused checks after each dependency-complete group, then `/phase-gate 34`. The complete
[`STACK.md`](../../STACK.md#gate-commands) gate applies, plus:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm arch:lint
pnpm e2e e2e/phase-34-manual-cutout.spec.ts --project=chromium --workers=1
pnpm e2e:phase-34-real
pnpm profile:phase-34 -- --verify
pnpm build
```

Fail on altered untouched alpha, full-image React/XState payload, duplicate/no-op history commit,
silent dirty-draft loss, stale commit, redo resurrection, unreachable artifact leak, history cap
violation, inference during Manual Apply/Undo/Redo/export, missed action/freeze, arbitrary sleep,
retry-dependent pass, skipped real-model/target evidence, or unresolved architect review note.

---

## Architect Review Notes

Use this section after manual product, UX, API, or workflow verification. The agent resolves each
unchecked item through `/impl-assist 34 review`; checked items alone may pass `/phase-gate 34`.

- [x] No architect review issues recorded

---

## Implementation Notes

- Precise target event-to-paint latency was unsupported in the Windows MCP capture. The evidence
  records successful observable actions and zero misses, with an empty unsupported latency sample;
  it does not substitute MCP call duration. Export was verified in host mocked/real-model lanes but
  was not repeated in that target capture.
- Full host E2E initially attached to an already-running ordinary dev server on port 3000 and failed
  environment-dependent English routes/mock downloads. After identifying and stopping that exact
  process tree, the canonical gate-owned `--mode e2e` rerun passed 92 tests with 3 opt-in skips.

---

## Atomic Commit Message

```text
feat(phase-34): add v2 manual cutout and document history
```

---

## Post-Phase Checklist

- [x] Scope completed in dependency order
- [x] Automated gates, real-model smoke, and target-device evidence green
- [x] Architect verifies Manual/history on the affected browser/device
- [x] Architect review notes resolved
- [x] Run `/context-update 34`
- [x] Commit on `feat/phase-34`
- [ ] Tag `v0.34.0` only after merge
