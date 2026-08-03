# PHASE 36 — Editor v2 Background and Enhancements

<!-- TOKEN BUDGET: keep this file under 10,000 tokens. Be concise. -->

## Phase Metadata

| Field | Value |
|-------|-------|
| Phase | `36` |
| Title | Editor v2 Background and Enhancements |
| Status | `✅ done` |
| Tag | `v0.36.0` |
| Depends on | PHASE_35 gate and architect acceptance passed |

---

## Phase Goal

Complete the isolated one-document v2 finishing workflow with Background and the existing local
fine-detail/colour-halo Enhancements defined in [`SPEC.md`](./SPEC.md#25-active-v2-scope--phase-36).
Keep previews and intermediate pixels runtime-owned, make each explicit Apply one atomic document-
history operation, and route heavy Enhancement work through the proven global admission boundary
without turning `EditorSession` or a generic tool abstraction into a god-object.

The existing `/editor-v2` route and approved design system are the visual reference. No external
design asset or new screen was provided.

---

## Scope

### Architecture and domain

- [x] `T1` Freeze Background/Enhancement actor states, commands/events, fill validation, preview/
  Apply/Cancel/no-op semantics, Enhancement registry order, worker correlations, snapshot evolution,
  artifact lease graph, stale-result matrix, UI/keyboard/accessibility behavior, and performance
  marks. Audit legacy behavior signal by signal; rewrite only reviewed pure policies, model profiles,
  and algorithms—never legacy hooks, components, mutable workflow state, or worker lifecycle —
  _Depends on:_ —
- [x] `T2` Record the Phase-36 ownership map before refactoring: the document actor remains the sole
  commit writer; Background and Enhancement controllers own separate cohesive runtimes; the shared
  snapshot materializer may evolve only for proven Manual/Magic/Background/Enhancement inputs;
  `EditorSession` stays a composition facade. Update `ARCHITECTURE_V2.md` or conventions only for
  durable rules proven by the slice — _Depends on:_ `T1`
- [x] `D1` Add framework-free validated background descriptors, Background/Enhancement IDs and
  discriminated drafts, Enhancement operation IDs, `background`/`enhance` history kinds, and an
  ID-only committed background field on every snapshot. Preserve exhaustive typed illegal outcomes
  and keep blobs, URLs, buffers, workers, and provider values outside domain/actor state —
  _Depends on:_ `T1`
- [x] `D2` Extend pure transitions, the document actor, artifact effects, and narrow selectors for
  at most one active finishing-tool draft and one correlated commit/run. Preview and intermediate
  Enhancement stages never change revision/history; only a successful explicit non-no-op Apply can
  commit; reset/dispose/history pruning deterministically release every new owner —
  _Depends on:_ `D1`, `T2`

### Browser runtime

- [x] `R1` Implement a Background draft controller/repository with normalized transparent, colour,
  two-stop linear/radial gradient, and artifact-backed image fills. Preview changes are immediate
  and encode-free; image preparation validates JPEG/PNG/WebP, 20 MiB, and 4096 px in a worker;
  replacement/Cancel/stale/reset/dispose release draft artifacts and URLs exactly once —
  _Depends on:_ `D1`
- [x] `R2` Evolve the versioned snapshot materializer/compositor for committed background
  descriptors and optional foreground artifacts. Background Apply materializes one composite/PNG
  off the interaction path and atomically promotes one `background` history entry; Undo/Redo/export
  restore/read the committed descriptor without reinference or recomposition —
  _Depends on:_ `D2`, `R1`, `T2`
- [x] `R3` Implement a typed Enhancement registry and runtime-owned draft for `fine-detail` then
  `colour-halo`. Capture one committed baseline, reject an empty/stale request, retain a retryable
  draft, and keep intermediate matte/foreground/pixel buffers outside React/XState —
  _Depends on:_ `D1`, `T1`
- [x] `R4` Implement versioned Enhancement worker/client protocols by rewriting the reviewed pure
  matte-refinement, deterministic-fusion, and foreground-cleanup policies behind v2 boundaries.
  Reuse pinned model families/revisions, transfer eligible buffers, expose ordered truthful stages,
  and correlate/cancel/crash-recover every request without importing legacy lifecycle code —
  _Depends on:_ `R3`
- [x] `R5` Implement an Enhancement controller/service that admits every model- or memory-heavy
  stage through the existing FIFO `HeavyJobCoordinator`, executes selected operations in registry
  order, materializes the final snapshot once, and publishes exactly one `enhance` operation only
  when changed. Cancel/failure/stale/no-op publishes no partial state and releases all run resources
  — _Depends on:_ `D2`, `R2`, `R4`
- [x] `R6` Extend runtime composition so `EditorSession` delegates Background and Enhancement work
  to their cohesive controllers and shared lifecycle collaborators only where real consumers prove
  them. Keep session commands/selectors narrow, preserve route-lifetime disposal, and test ownership
  and behavior rather than class/file placement — _Depends on:_ `R2`, `R5`

### Frontend

- [x] `F1` Add a bilingual accessible Background workspace to the existing noindex v2 route using
  current tokens/primitives: transparent, colour, existing gradient presets, validated custom image,
  immediate committed-vs-draft preview, preparing/error states, and explicit Apply/Cancel. Export
  must visibly remain bound to the committed snapshot — _Depends on:_ `R1`, `R2`, `R6`
- [x] `F2` Add a bilingual accessible Enhancements workspace for fine detail and colour-halo with
  operation help/selection, explicit Apply/Cancel/retry, and truthful queued/running stage/progress/
  applying/no-change/error outcomes. Never expose raw model scores or imply that a no-op committed
  — _Depends on:_ `R4`, `R5`, `R6`
- [x] `F3` Integrate deterministic tool routing, focus, shortcuts, live-region announcements, dirty-
  draft guards, reset/navigation behavior, and document-history controls. Background/Enhancement
  drafts own only their local controls; document Undo/Redo is unavailable until Apply/Cancel, and
  unrelated page controls remain responsive during all heavy stages — _Depends on:_ `F1`, `F2`, `D2`

### Verification and infrastructure

- [x] `I1` Add table/model-based domain and actor tests for descriptor validation, legal/illegal
  begin/change/apply/cancel/retry, one active draft, baseline/run/draft staleness, no-op, exactly-one
  history entry, redo invalidation, Undo/Redo descriptor restoration, reset/unmount, and randomized
  churn with zero reachable leaked leases — _Depends on:_ `D2`, `R2`, `R5`
- [x] `I2` Add Background repository/preparation/materializer contract tests for file/type/size/
  dimension validation, encode-free previews, descriptor/image ownership, transfer/correlation,
  replace/cancel/failure cleanup, single encode/commit, and unchanged export before Apply —
  _Depends on:_ `R1`, `R2`
- [x] `I3` Add Enhancement registry/worker/coordinator/controller contract tests for deterministic
  ordering/fusion/foreground alpha authority, progress, fallback, OOM/crash/cancel/retry/staleness,
  global one-heavy-job admission, atomic/no-op publication, model-profile stability, and zero binary
  React/XState payloads or leaked sessions/artifacts — _Depends on:_ `R3`, `R4`, `R5`
- [x] `I4` Add deterministic bilingual Playwright for automatic result → Background preview/Cancel/
  Apply → history/export → Enhancements select/Cancel/retry/no-op/Apply → history/export/reset,
  including custom-image validation, keyboard/dirty guards, truthful progress, stale suppression,
  one-commit, zero unrequested inference, and cleanup. Keep the mocked lane parallel-safe, zero-
  retry, and free of arbitrary sleeps — _Depends on:_ `F3`, `I1`, `I2`, `I3`
- [x] `I5` Add serialized real-model and target-device Windows Playwright MCP evidence for cold/
  warm fine-detail/colour-halo stages, automatic/Magic/Enhancement scheduling, Background image
  preparation/Apply, scroll/control responsiveness, Undo/Redo/export paint, and bounded resources
  after churn. Record unsupported signals rather than substituting host timing — _Depends on:_ `I4`
- [x] `I6` Run `/phase-gate 36`, production build/container smoke, dependency/license/model/security
  checks, Phase-36 suites, report verification, and architect affected-device review. Record
  versions, limitations, results, and unresolved review notes — _Depends on:_ `I5`

---

## Files

### Create / modify

~~~
docs/ARCHITECTURE_V2.md
docs/FRONTEND_CONVENTIONS.md
docs/PHASE_36.md
docs/README.md
docs/STACK.md
docs/STATE.md
docs/audits/PHASE_36_RESULTS.md
src/v2/domain/ids.ts
src/v2/domain/artifacts.ts
src/v2/domain/document.ts
src/v2/domain/commands.ts
src/v2/domain/events.ts
src/v2/domain/document-history/
src/v2/domain/background/
src/v2/domain/enhancements/
src/v2/application/document/
src/v2/application/processing/
src/v2/runtime-browser/artifacts/
src/v2/runtime-browser/background/
src/v2/runtime-browser/enhancements/
src/v2/runtime-browser/snapshot-commit/
src/v2/runtime-browser/editor-session/
src/v2/runtime-browser/processing/
src/v2/presentation/background/
src/v2/presentation/enhancements/
src/pages/editor-v2/
src/v2/testing/
src/shared/lib/inference/
messages/en.json
messages/ru.json
e2e/phase-36-finishing-tools.spec.ts
e2e/phase-36-finishing-tools.real.spec.ts
e2e/support/v2/
e2e/support/mock-editor-v2-worker.ts
scripts/profiling/v2/
package.json
pnpm-lock.yaml
~~~

Existing files may be split only along semantic ownership boundaries required by the phase. Every
new module exposes a narrow `index.ts`; imports outside the module use that public API. Legacy pure
model configuration/policies may move behind a backward-compatible shared boundary only when the v2
consumer proves the need.

### Do NOT touch

- Legacy behavior/workspace Background/Enhancements except documented rewrite/extraction of pure,
  framework-free policy/model-profile code with backward-compatible legacy imports
- Main public/scenario routes, sitemap/indexing policy, batch/multi-document UI, or legacy removal
- Accounts, auth, billing, payments, database, storage, queues, server upload/processing, generated
  backgrounds, arbitrary adjustment filters, model family/weights/revisions, CDN manifest, privacy
  behavior, or new env flags
- Comlink, workerpool/threads.js, canvas frameworks, generic tool engines/event buses, inheritance
  hierarchies, speculative utilities, shared mutable draft stores, or god-services

---

## Contracts

> This section is the source of truth for `/context-update`.

### New persistent data (tables / collections / files)

Repository Phase-36 results/evidence documentation only. Background images, draft previews,
Enhancement inputs/intermediates, model sessions, histories, and artifacts are browser-tab memory
only. No database, IndexedDB, image storage, account, remote job, or new `localStorage` key.

### New API endpoints / RPC methods / events

No server API/RPC endpoint. New commands/events are in-process only:

```ts
type FinishingToolCommand =
  | { type: "BEGIN_BACKGROUND"; documentId: DocumentId; expectedRevision: Revision }
  | { type: "CHANGE_BACKGROUND"; documentId: DocumentId; draftId: BackgroundDraftId;
      expectedRevision: Revision; draftRevision: Revision; fill: BackgroundFillDescriptor }
  | { type: "APPLY_BACKGROUND"; documentId: DocumentId; draftId: BackgroundDraftId;
      expectedRevision: Revision; draftRevision: Revision }
  | { type: "CANCEL_BACKGROUND"; documentId: DocumentId; draftId: BackgroundDraftId }
  | { type: "BEGIN_ENHANCEMENTS"; documentId: DocumentId; expectedRevision: Revision }
  | { type: "CHANGE_ENHANCEMENTS"; documentId: DocumentId; draftId: EnhancementDraftId;
      expectedRevision: Revision; operationIds: readonly EnhancementOperationId[] }
  | { type: "APPLY_ENHANCEMENTS"; documentId: DocumentId; draftId: EnhancementDraftId;
      runId: RunId; expectedRevision: Revision }
  | { type: "CANCEL_ENHANCEMENTS"; documentId: DocumentId; draftId: EnhancementDraftId };

type FinishingToolEvent =
  | { type: "BACKGROUND_COMMIT_SUCCEEDED"; documentId: DocumentId;
      draftId: BackgroundDraftId; expectedRevision: Revision; draftRevision: Revision;
      snapshot: DocumentSnapshot; estimatedHistoricalBytes: number }
  | { type: "BACKGROUND_COMMIT_FAILED"; documentId: DocumentId;
      draftId: BackgroundDraftId; expectedRevision: Revision; draftRevision: Revision;
      error: ProcessingError }
  | { type: "ENHANCEMENT_QUEUED" | "ENHANCEMENT_STARTED"; documentId: DocumentId;
      draftId: EnhancementDraftId; runId: RunId; expectedRevision: Revision }
  | { type: "ENHANCEMENT_COMMIT_SUCCEEDED"; documentId: DocumentId;
      draftId: EnhancementDraftId; runId: RunId; expectedRevision: Revision;
      snapshot: DocumentSnapshot; estimatedHistoricalBytes: number }
  | { type: "ENHANCEMENT_UNCHANGED" | "ENHANCEMENT_CANCELLED"; documentId: DocumentId;
      draftId: EnhancementDraftId; runId: RunId; expectedRevision: Revision }
  | { type: "ENHANCEMENT_FAILED"; documentId: DocumentId; draftId: EnhancementDraftId;
      runId: RunId; expectedRevision: Revision; error: ProcessingError };
```

Background preparation/materialization and Enhancement refinement use versioned typed worker
protocols. Every terminal carries document, draft, run where applicable, expected document revision,
and Background draft revision where applicable. Binary inputs/outputs are transferable/runtime-only
and never document actor commands or React props/state.

### New types / models / shared interfaces

```ts
type HexColor = `#${string}`;
type BackgroundDraftId = string;
type EnhancementDraftId = string;
type EnhancementOperationId = "fine-detail" | "colour-halo";

type BackgroundFillDescriptor =
  | { type: "transparent" }
  | { type: "color"; value: HexColor }
  | { type: "gradient"; kind: "linear" | "radial";
      stops: readonly [{ offset: 0; color: HexColor }, { offset: 1; color: HexColor }] }
  | { type: "image"; artifactId: ArtifactId };

type DocumentSnapshot = {
  matte: ArtifactId;
  foreground: ArtifactId | null;
  composite: ArtifactId;
  background: BackgroundFillDescriptor;
};

type BackgroundDraft = {
  kind: "background";
  draftId: BackgroundDraftId;
  documentId: DocumentId;
  baselineRevision: Revision;
  draftRevision: Revision;
  fill: BackgroundFillDescriptor;
  dirty: boolean;
  status: "ready" | "preparing-image" | "applying" | "error";
};

type EnhancementDraft = {
  kind: "enhance";
  draftId: EnhancementDraftId;
  documentId: DocumentId;
  baselineRevision: Revision;
  selectedOperationIds: readonly EnhancementOperationId[];
  dirty: boolean;
  status: "ready" | "queued" | "running" | "applying" | "error";
};

type DocumentHistoryEntry = {
  operationId: EditOperationId;
  kind: "manual-cutout" | "magic-cutout" | "background" | "enhance";
  before: DocumentSnapshot;
  after: DocumentSnapshot;
  estimatedHistoricalBytes: number;
};
```

Committed document history retains the cap of 20 operations / 96 MiB. Custom background images
reuse the 20 MiB input and 4096 px longest-side bounds. `HeavyJobCoordinator` still admits one heavy
job globally and contains no binary payload or tool-specific mutable state.

### New env vars

None. Reuse pinned local refinement/cleanup model configuration and immutable model assets; add no
Background, Enhancement, worker, backend, or feature flag.

---

## Gate Checks

Run focused checks after each dependency-complete group, then `/phase-gate 36`. The complete
[`STACK.md`](./STACK.md#gate-commands) gate applies, plus:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm arch:lint
pnpm e2e e2e/phase-36-finishing-tools.spec.ts --project=chromium --workers=1
pnpm e2e:phase-36-real
pnpm profile:phase-36 -- --verify
pnpm build
```

Fail on binary Background/Enhancement state in React/XState; preview mutating committed export;
invalid/unbounded custom-image preparation; stale/duplicate/non-explicit Apply; more than one encode
or history operation; partial/no-op/cancelled Enhancement commit; heavy-stage admission bypass;
model-profile drift; leaked artifact/session/worker/URL; missed action/freeze; arbitrary sleep;
retry-dependent pass; skipped real-model/target evidence; regression of Phase-33–35 contracts; or an
unresolved architect review note.

---

## Architect Review Notes

- [x] Reject Background/Enhancement changes and duplicate Apply while the matching commit is in
  flight; keep the invoke correlation immutable through settlement, and cover the command, actor,
  and `Ctrl`/`Cmd`+`Enter` paths so an earlier result cannot be relabelled with a later operation or
  run ID.
- [x] Make Background preparation and Enhancement execution depend on narrow runtime ports, and
  make the `EditorSession` Enhancement injection graph coherent so the actor committer and the UI
  runtime snapshot cannot come from different services. Replace unsafe concrete-class test casts
  with typed fakes.
- [x] Harden the Enhancement worker boundary: validate the exact `ProcessingErrorCode` union and
  correlate output matte dimensions/byte length with the active request before accepting it; add
  malformed error/output contract tests.
- [x] Route the new Enhancement worker's production-model imports through the `shared/lib` public
  API, including the shared matting mode type, rather than sidestepping the semantic module index.
- [x] Resolve every Phase-36 production and test lint error without disabling rules, including
  nested ternaries, unnecessary assertions, unbound methods, unused parameters, and unsafe test
  doubles; `pnpm lint` must pass before the review is closed.

---

## Implementation Notes

None

---

## Atomic Commit Message

```text
feat(phase-36): add v2 backgrounds and enhancements
```

---

## Post-Phase Checklist

- [x] Scope completed in dependency order
- [x] Automated gates, real-model smoke, and target-device evidence green
- [x] Architect verifies Background and Enhancements on the affected browser/device
- [x] Architect review notes resolved
- [x] Run `/context-update 36`
- [x] Commit on `feat/phase-36`
- [ ] Tag `v0.36.0` only after merge
