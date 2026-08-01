# PHASE 33 — Editor v2 Foundation & First Vertical Slice

## Phase Metadata

| Field | Value |
|-------|-------|
| Phase | `33` |
| Title | Editor v2 Foundation & First Vertical Slice |
| Status | `⏳ pending` |
| Tag | `v0.33.0` |
| Depends on | PHASE_32 closed-incomplete by architect exception; no gate dependency |

---

## Phase Goal

Implement `docs/ARCHITECTURE_V2.md` as one separately reachable, fully tested local slice: choose
one image → prepare → remove background → preview → export PNG. Prove workflow ownership, artifact
lifetime, worker isolation, and responsiveness on the architect's affected browser/device before
migrating any other editor capability. Keep the legacy editor available for comparison/rollback.

---

## Scope

### Other

- [ ] `T1` Freeze the Phase-33 actor hierarchy, commands/events, legal transitions, artifact
  ownership, processing port, worker protocol, performance marks, and exclusions from
  `ARCHITECTURE_V2.md`. Record any evidence-driven deviation before implementation — _Depends on:_ —
- [ ] `T2` Baseline the legacy single-image flow on the architect's affected browser/device:
  import event-to-next-paint, long tasks, scroll/control response during model creation/inference,
  stage timings, GPU path, artifact leases, and cancellation. Headless-host evidence alone cannot
  satisfy this task — _Depends on:_ `T1`

### Domain and application

- [ ] `D1` Add framework-free v2 IDs, snapshots, commands, events, processing contracts, artifact
  metadata, and capability types. Actor/domain snapshots contain IDs and small metadata only—never
  blobs, bitmaps, pixel/tensor buffers, object URLs, React values, workers, HTTP clients, or model-
  provider values — _Depends on:_ `T1`
- [ ] `D2` Implement pure document transitions: one writer, one active commit, `{ documentId,
  runId, expectedRevision }` correlation, stale/cancel rejection, explicit terminal outcomes, and
  deterministic cleanup. Reject illegal commands as typed outcomes — _Depends on:_ `D1`
- [ ] `D3` Implement XState v5 workspace/document actors and narrow React selectors. Workspace owns
  session selection and spawns one actor per image; each document actor owns import/removal state.
  React lifecycle is an adapter signal, not workflow truth — _Depends on:_ `D2`
- [ ] `D4` Define a backend-neutral `ProcessingGateway` with progress, abort/cancel, terminal result,
  and release semantics. Implement only the local gateway; add no account, payment, upload, HTTP,
  remote job, or provider code — _Depends on:_ `D2`

### Browser runtime

- [ ] `R1` Implement `ArtifactRepository`: opaque IDs, run/document leases, centralized object URLs,
  deterministic disposal, memory statistics/budget, and development assertions for leaks, double
  release, and access after release — _Depends on:_ `D1`
- [ ] `R2` Implement one typed Phase-33 worker protocol and bounded local gateway for prepare →
  automatic removal → composite/encode. Correlate messages, transfer eligible buffers, expose stage
  timings, cancel between stages, recover from worker crash, and default to one heavy GPU job. Reuse
  immutable model configuration through a pure boundary, never legacy React hooks/state —
  _Depends on:_ `D4`, `R1`
- [ ] `R3` Keep full-resolution decode, transforms, post-processing, compositing, and PNG encoding
  outside the main interaction path. Model preparation is distinct from document commit. Global
  backpressure must keep page scroll and unrelated controls responsive — _Depends on:_ `R2`

### Frontend

- [ ] `F1` Add a noindex, separately reachable bilingual v2 surface using the existing design
  system. Present only one-image upload, truthful progress, cancel/retry, preview, PNG export, and
  reset. UI sends commands/subscribes through selectors and owns no worker/run/artifact lifetime —
  _Depends on:_ `D3`, `R3`
- [ ] `F2` Distinguish preparing, model loading, queued, processing, cancelling, result, and error.
  Cancel reaches a terminal state; stale work cannot flash; scroll/unrelated controls work during
  heavy stages. Render no Cutout, Enhancements, Background, or batch control — _Depends on:_ `F1`
- [ ] `F3` Export the committed composite through `ArtifactRepository` without reinference or a
  synchronous full-image reconstruction. Reset/remove releases all document/run/preview/export
  leases and retains a warm runtime only according to explicit policy — _Depends on:_ `F2`

### Verification and infrastructure

- [ ] `I1` Add pure transition/invariant and model-based actor tests for all legal/illegal Phase-33
  paths: duplicate start, cancel at every stage, stale result, crash, retry, reset, unmount/remount,
  and release, using deterministic fake time/adapters — _Depends on:_ `D3`, `D4`, `R1`
- [ ] `I2` Add worker/browser-adapter contract tests for correlation, transfer ownership, progress
  order, cancellation acknowledgement, crash recovery, exactly-one result, and zero reachable
  leases after repeated churn — _Depends on:_ `R3`
- [ ] `I3` Add bilingual deterministic Playwright plus serialized real-model smoke. Assert one
  automatic run, no duplicate export/inference, truthful cancel/retry, working scroll/unrelated
  controls during every heavy stage, and cleanup after churn — _Depends on:_ `F3`, `I1`, `I2`
- [ ] `I4` Capture final target-device evidence: zero application-attributable main-thread tasks
  `>=50 ms`, pointer/scroll/control event-to-next-paint p95 `<100 ms`, no missed action, bounded
  artifact/resource counts after ten import/cancel/reset cycles, and no preview/export reinference.
  A failing budget or reproduced freeze blocks migration — _Depends on:_ `I3`
- [ ] `I5` Run `/phase-gate 33`, production build/container smoke, dependency/license/model/security
  checks, and Phase-33 suites. Record versions, device/browser/GPU, limitations, and results; skipped
  target-device or real-model evidence is not PASS — _Depends on:_ `I4`

---

## Files

### Create / modify

~~~
docs/ARCHITECTURE_V2.md
docs/audits/PHASE_33_BASELINE.md
docs/audits/PHASE_33_RESULTS.md
src/v2/domain/
src/v2/application/
src/v2/runtime-browser/
src/v2/presentation/
src/v2/testing/
src/pages/editor-v2/
src/routes/dev.editor-v2.tsx
messages/ru.json
messages/en.json
e2e/phase-33-editor-v2.spec.ts
e2e/phase-33-editor-v2.real.spec.ts
package.json
pnpm-lock.yaml
docs/STACK.md
docs/PHASE_33.md
~~~

A minimal pure model/config module may be extracted from legacy inference code only to avoid
duplicate model assets; document that exception before touching legacy source.

### Do NOT touch

- Legacy behavior/workspace/Cutout/Manual/Enhancements/Background/batch/public routes, except the
  narrow pure model/config extraction above
- Accounts, auth, entitlements, billing, payments, databases, storage, queues, server uploads,
  remote processing, Python services, generated backgrounds, or public API
- Production model family/weights/revisions, CDN manifest, quality mapping, or privacy behavior
- Former Phase-33/34 accessibility/legal implementation
- Broad monorepo conversion, canvas framework, generic event bus, or legacy cleanup

---

## Contracts

### New persistent data (tables / collections / files)

Repository architecture/baseline/results documentation only. V2 document, actor, artifact, and
processing state is browser-tab memory only. No database, IndexedDB, image storage, account,
payment, remote job, or new localStorage key.

### New API endpoints / RPC methods / events

No server API/RPC endpoint. New commands/events are in-process only:

```ts
type EditorCommand =
  | { type: "IMPORT_IMAGE"; file: File }
  | { type: "START_AUTOMATIC_REMOVAL"; documentId: DocumentId; backend: "local" }
  | { type: "CANCEL_ACTIVE_RUN"; documentId: DocumentId }
  | { type: "EXPORT_PNG"; documentId: DocumentId }
  | { type: "RESET_DOCUMENT"; documentId: DocumentId };

type ProcessingTerminalEvent =
  | { type: "PROCESSING_SUCCEEDED"; documentId: DocumentId; runId: RunId;
      expectedRevision: Revision; snapshot: DocumentSnapshot }
  | { type: "PROCESSING_FAILED"; documentId: DocumentId; runId: RunId;
      error: ProcessingError }
  | { type: "PROCESSING_CANCELLED"; documentId: DocumentId; runId: RunId };
```

### New types / models / shared interfaces

```ts
type DocumentId = string;
type ArtifactId = string;
type RunId = string;
type Revision = number;
type ProcessingBackend = "local" | "remote"; // remote reserved, not implemented

type DocumentSnapshot = {
  matte: ArtifactId;
  foreground: ArtifactId | null;
  composite: ArtifactId;
};

type ProcessingRequest = {
  documentId: DocumentId;
  runId: RunId;
  expectedRevision: Revision;
  operation: "prepare" | "automatic-remove" | "composite" | "encode-png";
  inputs: readonly ArtifactId[];
};

type ProcessingError = { code: string; message: string; retryable: boolean };

interface ProcessingRun {
  readonly runId: RunId;
  readonly result: Promise<DocumentSnapshot>;
  cancel(): void;
}

interface ProcessingGateway {
  start(request: ProcessingRequest, signal: AbortSignal): ProcessingRun;
}
```

`T1` may refine exact unions, but IDs, revision guard, terminal outcomes, no binary actor state, and
local-only Phase-33 execution are invariant.

### New env vars

None. Reuse current public model/CDN configuration; add no backend/provider flag.

---

## Gate Checks

Run focused checks after each dependency-complete group, then `/phase-gate 33`. The complete
`docs/STACK.md` gate applies, plus:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm arch:lint
pnpm e2e e2e/phase-33-editor-v2.spec.ts --project=chromium --workers=1
pnpm e2e e2e/phase-33-editor-v2.real.spec.ts --project=chromium --workers=1
pnpm build
```

Attach `I4` target-device trace and artifact audit. Fail on a freeze, missed action, timing-budget
failure, duplicate/stale result, binary actor/React state, leaked lease, skipped real-model smoke,
or missing target-device evidence.

---

## Architect Review Notes

- [x] No architect review issues recorded

## Implementation Notes

- Phase 32's host-specific timing did not predict the architect's browser. Target-environment
  evidence is therefore required product acceptance, not optional support.

## Atomic Commit Message

```text
feat(phase-33): establish editor v2 local vertical slice
```

## Post-Phase Checklist

- [ ] Scope completed in dependency order
- [ ] Automated gates, real-model smoke, and target-device evidence green
- [ ] Architect verifies the affected browser/device without a reproduced freeze
- [ ] Architect review notes resolved
- [ ] Run `/context-update 33`
- [ ] Commit on `feat/phase-33`; tag `v0.33.0` only after merge
