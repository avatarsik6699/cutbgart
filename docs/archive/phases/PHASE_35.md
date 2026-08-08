# PHASE 35 — Editor v2 Magic Cutout

<!-- TOKEN BUDGET: keep this file under 10,000 tokens. Be concise. -->

## Phase Metadata

| Field | Value |
|-------|-------|
| Phase | `35` |
| Title | Editor v2 Magic Cutout |
| Status | `✅ done` |
| Tag | `v0.35.0` |
| Depends on | PHASE_34 gate and architect acceptance passed |

---

## Phase Goal

Extend the accepted one-document v2 editor with guided Magic Cutout as specified by
[`SPEC.md`](../../SPEC.md#24-active-v2-scope--phase-35). Keep semantic strokes, embeddings, prompts,
candidate mattes, and pixels outside React/XState; separate draft input, prediction, preview, and
explicit Apply; and make Apply exactly one artifact-aware document-history commit. Use the second
tool to extract only proven shared lifecycle/scheduling boundaries while keeping `EditorSession` a
thin facade and tool-specific state cohesive.

---

## Scope

### Architecture and domain

- [x] `T1` Freeze the Phase-35 actor states, commands/events, Magic draft/prediction/commit
  lifecycles, artifact lease graph, stale-result matrix, global heavy-job scheduling, UI semantics,
  keyboard routing, accessibility behavior, and performance marks. Audit legacy guided selection
  signal by signal; rewrite only pure sampling, prompt-coordinate, constraint, candidate-ranking/
  fusion, and bounded-history policies—never legacy hooks, mutable workflow state, components, or
  worker lifecycle — _Depends on:_ —
- [x] `T2` Record a module/service ownership map before refactoring: the document actor stays the
  sole commit writer; `EditorSession` is a composition facade; Manual and Magic controllers own
  separate stateful runtimes; shared contracts/helpers require two concrete consumers; no generic
  event bus, inheritance hierarchy, catch-all utilities, or god-service. Update
  `ARCHITECTURE_V2.md` and `FRONTEND_CONVENTIONS.md` only where durable rules are proven —
  _Depends on:_ `T1`
- [x] `D1` Add framework-free discriminated Manual/Magic active-draft metadata, Magic IDs/modes,
  monotonic `draftRevision`, `magic-cutout` history kind, and pure decisions for begin, mutate,
  predict, preview, stale/cancel, apply, retry, and redo invalidation. Preserve exhaustive typed
  illegal outcomes and ID-only actor state — _Depends on:_ `T1`
- [x] `D2` Extend the document actor and narrow selectors with at most one active tool draft and one
  cancellable Magic prediction/commit identity. Prediction never changes document revision/history;
  only explicit Apply can create one operation; failure retains the draft; reset/dispose releases
  every owner — _Depends on:_ `D1`, `T2`

### Browser runtime

- [x] `R1` Extract a runtime `HeavyJobCoordinator` used by both automatic removal and Magic model
  work. It admits at most one heavy model initialization/inference job, reports queue state,
  forwards cancellation, rejects stale terminals, survives worker crash, and does not serialize
  Manual's non-inference commit behind an unrelated model job — _Depends on:_ `T2`
- [x] `R2` Implement a Magic draft repository/engine with source-space Keep/Remove strokes,
  distance-based point simplification, at most 50 live strokes, at most 512 points per committed
  stroke, bounded local Undo/Redo, monotonic draft revision, pointer-cancel rollback, and
  deterministic disposal. Strokes and prompt/constraint buffers never enter React props/state or
  actor snapshots — _Depends on:_ `D1`
- [x] `R3` Implement a versioned typed Magic worker/client protocol and pinned SlimSAM local adapter
  for source encoding and candidate prediction. Correlate document/draft/run/baseline/draft
  revisions, transfer eligible buffers, preserve the immutable model profile, expose truthful
  stages/progress, reject duplicate/foreign/stale terminals, and route all model work through `R1`
  — _Depends on:_ `R1`, `R2`
- [x] `R4` Add runtime-owned candidate storage, semantic constraint fusion, deterministic candidate
  selection/ranking, preview leases, and extract a shared non-inference snapshot committer for the
  now-proven Manual/Magic consumers. It composites/encodes the selected matte off the interaction
  path; Apply atomically promotes one snapshot/history operation; retry retains the draft; cancel/
  stale/reset/dispose releases candidates, previews, embeddings, and run leases without changing
  committed state — _Depends on:_ `D2`, `R3`
- [x] `R5` Refactor runtime composition so `EditorSession` delegates to cohesive Manual and Magic
  controllers/services and shared lifecycle helpers only where both use them. Keep public session
  commands/selectors narrow, preserve route-lifetime disposal, and add focused ownership tests
  rather than tests of file placement — _Depends on:_ `D2`, `R2`, `R4`

### Frontend

- [x] `F1` Add a bilingual accessible Magic workspace to the existing noindex v2 route using
  existing design tokens and cohesive presentation modules: Keep/Remove, brush size, visible
  source-space cursor/strokes, 50-stroke/512-point limits, Predict, candidate preview/refinement,
  explicit Apply/Cancel, and truthful queued/encoding/predicting/preview/applying/error states. Do
  not add fine-detail refinement, Enhancements, Background, batch, or public-route migration —
  _Depends on:_ `R3`, `R4`, `R5`
- [x] `F2` Implement deterministic draft behavior: each stroke is one local Undo step; Ctrl/Cmd+Z
  and redo variants target Magic while its draft is active; pointer capture/cancel/lost-capture is
  safe; new input invalidates an older prediction; Predict never commits; Apply commits exactly
  once; Cancel/navigation/reset cannot silently discard a dirty draft; all status and errors are
  announced and keyboard reachable — _Depends on:_ `F1`, `D2`

### Verification and infrastructure

- [x] `I1` Add table/model-based domain and actor tests for legal/illegal begin/mutate/predict/
  preview/apply/cancel, baseline and draft-revision staleness, prediction cancellation, failure/
  retry, one active draft, one committed operation, redo invalidation, reset/unmount, and randomized
  churn with zero reachable leaked leases — _Depends on:_ `D2`, `R4`
- [x] `I2` Add draft/worker/coordinator/commit contract tests for stroke/point bounds,
  simplification, Keep/Remove constraints, candidate ranking/fusion, transfer ownership, ordered
  progress, crash/cancel/correlation, global one-heavy-job admission, no binary React/XState
  payload, and no implicit commit or model-family/revision drift — _Depends on:_ `R1`, `R2`, `R3`, `R4`
- [x] `I3` Add deterministic bilingual Playwright for automatic result → Magic strokes → local
  Undo/Redo → Predict → refine/re-predict → Cancel/Apply → document Undo/Redo → export/reset,
  including keyboard, dirty guard, truthful progress, stale-candidate suppression, one-commit,
  zero-unrequested-inference, and cleanup assertions. Keep the mocked lane parallel-safe,
  zero-retry, and free of arbitrary sleeps — _Depends on:_ `F2`, `I1`, `I2`
- [x] `I4` Add one serialized real-SlimSAM smoke and target-device Windows Playwright MCP evidence
  for cold/warm encoding/prediction, interaction/scroll responsiveness during every heavy stage,
  Apply/Undo/Redo paint, shared automatic/Magic scheduling, bounded draft/resources, unchanged
  export, and zero leases after churn. Record unsupported signals rather than substituting host
  timing — _Depends on:_ `I3`
- [x] `I5` Run `/phase-gate 35`, production build/container smoke, dependency/license/model/security
  checks, Phase-35 suites, report verification, and architect affected-device review. Record
  versions, limitations, results, and unresolved review notes — _Depends on:_ `I4`

---

## Files

### Create / modify

~~~
docs/ARCHITECTURE_V2.md
docs/FRONTEND_CONVENTIONS.md
docs/PHASE_35.md
docs/STACK.md
docs/STATE.md
docs/audits/PHASE_35_RESULTS.md
src/v2/domain/ids.ts
src/v2/domain/document.ts
src/v2/domain/commands.ts
src/v2/domain/events.ts
src/v2/domain/document-history/
src/v2/domain/magic-cutout/
src/v2/application/document/
src/v2/application/processing/
src/v2/runtime-browser/editor-session/
src/v2/runtime-browser/manual-cutout/
src/v2/runtime-browser/magic-cutout/
src/v2/runtime-browser/processing/
src/v2/presentation/magic-cutout/
src/pages/editor-v2/
src/v2/testing/
src/shared/lib/inference/production-model-config.ts
messages/en.json
messages/ru.json
e2e/phase-35-magic-cutout.spec.ts
e2e/phase-35-magic-cutout.real.spec.ts
e2e/support/v2/
e2e/support/mock-editor-v2-worker.ts
scripts/profiling/v2/
package.json
pnpm-lock.yaml
~~~

Existing files may be split only along semantic ownership boundaries required by the phase. Every
new module exposes a narrow `index.ts`; imports outside the module use that public API. The existing
v2 route is the visual/design reference; no new external design asset was provided.

### Do NOT touch

- Legacy behavior/workspace/Cutout Magic except a documented rewrite/extraction of pure,
  framework-free policies with backward-compatible shared model-profile imports
- Main public/scenario routes, sitemap indexing policy, or legacy feature removal
- Fine-detail/foreground refinement, Enhancements, Background, batch/multi-document UI
- Accounts, auth, billing, payments, database, storage, queues, server upload/processing, generated
  backgrounds, model family/weights/revisions, CDN manifest, privacy behavior, or new env flags
- Comlink, workerpool/threads.js, canvas frameworks, generic event buses, speculative utilities, or
  a shared mutable tool store

---

## Contracts

> This section is the source of truth for `/context-update`. Fill it in **before** handing to AI.

### New persistent data (tables / collections / files)

Repository Phase-35 results/evidence documentation only. Magic strokes, embeddings, prompts,
constraint maps, candidates, previews, model sessions, history, and artifacts are browser-tab memory
only. No database, IndexedDB, image storage, account, remote job, or new `localStorage` key.

### New API endpoints / RPC methods / events

No server API/RPC endpoint. New commands/events are in-process only:

```ts
type MagicCutoutCommand =
  | { type: "BEGIN_MAGIC_CUTOUT"; documentId: DocumentId; expectedRevision: Revision }
  | { type: "MAGIC_DRAFT_CHANGED"; documentId: DocumentId; draftId: MagicDraftId;
      expectedRevision: Revision; draftRevision: Revision; dirty: boolean }
  | { type: "PREDICT_MAGIC_CUTOUT"; documentId: DocumentId; draftId: MagicDraftId;
      runId: RunId; expectedRevision: Revision; draftRevision: Revision }
  | { type: "SELECT_MAGIC_CANDIDATE"; documentId: DocumentId; draftId: MagicDraftId;
      candidateId: MagicCandidateId; expectedRevision: Revision; draftRevision: Revision }
  | { type: "APPLY_MAGIC_CUTOUT"; documentId: DocumentId; draftId: MagicDraftId;
      candidateId: MagicCandidateId; expectedRevision: Revision; draftRevision: Revision }
  | { type: "CANCEL_MAGIC_CUTOUT"; documentId: DocumentId; draftId: MagicDraftId };

type MagicCutoutEvent =
  | { type: "MAGIC_DRAFT_STARTED"; documentId: DocumentId; draftId: MagicDraftId;
      baselineRevision: Revision }
  | { type: "MAGIC_PREDICTION_STARTED"; documentId: DocumentId; draftId: MagicDraftId;
      runId: RunId; expectedRevision: Revision; draftRevision: Revision }
  | { type: "MAGIC_PREVIEW_READY"; documentId: DocumentId; draftId: MagicDraftId;
      runId: RunId; expectedRevision: Revision; draftRevision: Revision;
      candidates: readonly MagicCandidateSummary[] }
  | { type: "MAGIC_PREDICTION_FAILED"; documentId: DocumentId; draftId: MagicDraftId;
      runId: RunId; expectedRevision: Revision; draftRevision: Revision; error: ProcessingError }
  | { type: "MAGIC_COMMIT_SUCCEEDED"; documentId: DocumentId; draftId: MagicDraftId;
      expectedRevision: Revision; draftRevision: Revision; snapshot: DocumentSnapshot }
  | { type: "MAGIC_COMMIT_FAILED"; documentId: DocumentId; draftId: MagicDraftId;
      expectedRevision: Revision; draftRevision: Revision; error: ProcessingError }
  | { type: "MAGIC_DRAFT_CANCELLED"; documentId: DocumentId; draftId: MagicDraftId };
```

The versioned Magic worker protocol adds correlated source-encode, predict, cancel, and dispose
operations. Every request/result carries document, draft, run, expected document revision, and draft
revision. Candidate buffers and embeddings are transferable/runtime-only and never command/event
payloads to the document actor.

### New types / models / shared interfaces

```ts
type MagicCutoutMode = "keep" | "remove";
type MagicDraftId = string;
type MagicCandidateId = string;

type ManualCutoutDraft = {
  kind: "manual-cutout";
  draftId: ManualDraftId;
  documentId: DocumentId;
  baselineRevision: Revision;
  dirty: boolean;
};

type MagicCutoutDraft = {
  kind: "magic-cutout";
  draftId: MagicDraftId;
  documentId: DocumentId;
  baselineRevision: Revision;
  draftRevision: Revision;
  dirty: boolean;
  status: "ready" | "dirty" | "encoding" | "predicting" | "preview" | "error";
  selectedCandidateId: MagicCandidateId | null;
};

type ActiveToolDraft = ManualCutoutDraft | MagicCutoutDraft;

type MagicCandidateSummary = {
  candidateId: MagicCandidateId;
  score: number;
};

type DocumentHistoryEntry = {
  operationId: EditOperationId;
  kind: "manual-cutout" | "magic-cutout";
  before: DocumentSnapshot;
  after: DocumentSnapshot;
  estimatedHistoricalBytes: number;
};
```

Magic keeps at most 50 live strokes and 50 draft Undo entries, with at most 512 simplified points
per committed stroke. Committed document history retains the Phase-34 cap of 20 operations / 96 MiB.
`HeavyJobCoordinator` is an application/runtime port with one admitted model initialization or
inference job globally; it contains no binary payload or tool-specific state.

### New env vars

None. Reuse the pinned SlimSAM/browser model configuration and existing immutable CDN/upstream
policy; add no Magic, worker, backend, or feature flag.

---

## Gate Checks

Run focused checks after each dependency-complete group, then `/phase-gate 35`. The complete
[`STACK.md`](../../STACK.md#gate-commands) gate applies, plus:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm arch:lint
pnpm e2e e2e/phase-35-magic-cutout.spec.ts --project=chromium --workers=1
pnpm e2e:phase-35-real
pnpm profile:phase-35 -- --verify
pnpm build
```

Fail on an unbounded live draft or stroke; binary model/candidate/pixel state in React/XState;
first-stroke, encode, or prediction auto-commit; stale/cancelled candidate publication; duplicate or
non-explicit Apply; Cancel changing committed state; automatic and Magic bypassing shared heavy-job
admission; model profile drift; unreachable artifact/session/worker leak; missed action/freeze;
arbitrary sleep; retry-dependent pass; skipped real-model/target evidence; regression of Phase-33/34
contracts; or unresolved architect review note.

---

## Architect Review Notes

Use this section after manual product, UX, API, or workflow verification. The agent resolves each
unchecked item through `/impl-assist 35 review`; checked items alone may pass `/phase-gate 35`.

- [x] No architect review issues recorded

---

## Implementation Notes

- Target-device stage-specific paint timing and forced automatic/Magic overlap remain unsupported;
  the bounded evidence and executable coordinator contract are recorded in
  `docs/audits/PHASE_35_RESULTS.md` rather than replaced with host or MCP tool-call timing.

---

## Atomic Commit Message

```text
feat(phase-35): add v2 magic cutout
```

---

## Post-Phase Checklist

- [x] Scope completed in dependency order
- [x] Automated gates, real-model smoke, and target-device evidence green
- [x] Architect verifies Magic Cutout on the affected browser/device
- [x] Architect review notes resolved
- [x] Run `/context-update 35`
- [x] Commit on `feat/phase-35`
- [ ] Tag `v0.35.0` only after merge
