# BG Remove App v2 — Domain Model and Target Architecture

**Status:** proposed target, approved direction pending Phase 33 implementation

**Date:** 2026-08-01
**Purpose:** replace incremental repairs of the current editor with an architecture-led, testable
vertical-slice migration. This document describes the current system, the observed failure modes,
the target model, stack decisions, and migration boundaries. It is not evidence that v2 has already
been implemented.

## 1. Executive decision

The existing application remains a recoverable legacy implementation. New editor work proceeds as
a parallel v2 path and migrates one complete user outcome at a time. The first v2 slice is only:

```text
choose one image -> prepare -> remove background locally -> preview -> export PNG
```

Cutout, Enhancements, Background, batch processing, accounts, payments, and remote inference are not
part of that first slice. Each is added only after the preceding slice meets functional,
responsiveness, lifecycle, and real-browser acceptance checks.

The central architectural rule is **one authoritative document actor per image**. React renders
snapshots and sends commands; it does not coordinate workers, own operation identity, or hold large
image buffers. Local browser processing and future paid server processing implement the same
application port but have different privacy, capability, and lifecycle policies.

## 2. Current system — factual map

### 2.1 Runtime layers

| Area | Current implementation | Responsibility today |
|------|------------------------|----------------------|
| App/pages | TanStack Start, Router, React 19 | SSR shell, routes, page composition |
| UI composition | `widgets/tool-workspace` | Entire editor composition and cross-feature orchestration |
| Feature state | React hooks in `features/*/model` | UI state, workflow state, worker ownership, errors, retries |
| Domain data | `entities/processed-image`, `entities/edit-document` | source/matte/result types, artifact store, committed history |
| Heavy runtime | six dedicated Web Workers | upload preparation, automatic inference, guided selection, matte/foreground refinement, model lab |
| Persistence | browser memory, model Cache Storage, limited `localStorage` | session artifacts and preferences only |
| Server | TanStack Start/Nitro SSR shell | no image-processing API |

Feature-Sliced Design currently gives useful source-code import boundaries, but it does not define
runtime ownership. The editor's application workflow is still distributed across hooks.

### 2.2 Current data flow

```text
File
  -> upload preparation worker
  -> SourceImage
  -> automatic inference worker
  -> AlphaMatte + Blob outputs
  -> ProcessedImage
  -> EditDocumentScope { document, history, artifact store, workerOwnerId }
  -> Cutout / Manual / Enhancements / Background hooks
  -> worker result
  -> controller commit
  -> new document revision + artifacts
  -> canvas preview / PNG export
```

Batch mode repeats much of the automatic-processing lifecycle inside `useBatchProcessing`; each
completed item may own an `EditDocumentScope`, while the workspace controller separately tracks the
selected item and active tool state.

### 2.3 Current domain vocabulary

| Concept | Meaning | Current issue |
|---------|---------|---------------|
| `SourceImage` | validated browser-local source blob and dimensions | sound value object, but copied through several workflow APIs |
| `AlphaMatte` | mutable-sized alpha byte array | large payload; ownership/transfer is not expressed in the type |
| `ProcessedImage` | source plus result blobs, optional matte/foreground/fill | overlaps with `EditDocumentSnapshot` as a second representation of current truth |
| `EditDocumentScope` | document, history, artifact store, worker owner | closest thing to an aggregate, but controllers and feature hooks can all mutate/replace it |
| `BatchSession` / `BatchItem` | many processing items and selected item | also owns queue/worker state, making collection and processing concerns inseparable |
| tool hook state | draft, progress, errors, run identity | spread across React state and mutable refs; not serializable or inspectable as one transition graph |

### 2.4 Concrete structural evidence

- `use-tool-workspace-controller.ts` is roughly 684 lines and composes document publication,
  history, batch selection, quality mode, three editor tools, six cleanup paths, and retry routing.
- `use-object-selection.ts` is roughly 1,164 lines and contains two related selection workflows plus
  worker protocol state.
- `use-background-removal.ts` and `use-batch-processing.ts` are each roughly 700 lines and implement
  separate inference-worker ownership.
- Workflow correctness depends on React state plus many refs (`workerRef`, request/run/revision refs,
  pending maps, queues, artifact maps, target refs, release promises). Those refs are invisible to
  React and cannot be inspected as one coherent application state.
- Worker lifecycle is partly shared and partly bespoke. Cancellation, stale-result rejection,
  disposal, request correlation, transfer ownership, and error normalization are repeated.
- Switching a tool/item requires imperative cancellation and reset calls across multiple hooks.
  That is coordination by convention rather than an enforced domain transition.

## 3. Why Phase 32 did not solve the reported experience

Phase 32 improved several local protocols and tests, but the architect's real-browser verification
still observes freezes during model work and Magic Apply. It also observes an apparent automatic
Apply after the first Magic stroke.

The code does not directly commit a Magic edit from the stroke handler. It does, however, start an
`encode` worker request on the first marking when the worker is cold. That changes the guided
session to a busy state and locks interaction. From the user's perspective this is
indistinguishable from an automatic Apply. This is a domain/UI semantic defect: background
preparation and an explicit document commit share the same visible busy contract.

Moving JavaScript into a Web Worker also does not guarantee a responsive tab:

- structured cloning or accidental non-transfer of full-resolution buffers can still consume time;
- canvas decode/upload and browser image plumbing can still execute on the main/renderer process;
- WebGPU work submitted from a worker can contend with the renderer for the same GPU and driver;
- simultaneous model/session creation, inference, compositing, encoding, React commits, and canvas
  repaint have no global scheduler or backpressure policy;
- current profiling tests observe a particular automated host, not the architect's real device and
  interaction timing.

The remaining issue therefore cannot be honestly treated as one more isolated hook bug. The system
lacks a single workflow owner and a runtime-wide resource/scheduling model.

## 4. Target domain model

### 4.1 Aggregates and value objects

```ts
type ImageId = string;
type DocumentId = string;
type Revision = number;
type ArtifactId = string;
type RunId = string;

type ProcessingBackend = "local" | "remote";

type ImageDocument = {
  id: DocumentId;
  imageId: ImageId;
  source: ArtifactId;
  baseline: DocumentSnapshot;
  current: DocumentSnapshot;
  revision: Revision;
  history: OperationId[];
  future: OperationId[];
};

type DocumentSnapshot = {
  matte: ArtifactId;
  foreground: ArtifactId | null;
  composite: ArtifactId;
  background: BackgroundSpec;
};

type EditOperation = {
  id: OperationId;
  documentId: DocumentId;
  expectedRevision: Revision;
  kind: "automatic-remove" | "magic-cutout" | "manual-cutout" | "enhance" | "background";
  before: DocumentSnapshot;
  after: DocumentSnapshot;
};
```

Large `Blob`, `ImageBitmap`, `ArrayBuffer`, matte, tensor, and object-URL values are never stored in
the actor snapshot or React state. `ArtifactRepository` owns them and exposes opaque `ArtifactId`
references with explicit retain/release semantics.

### 4.2 Application commands

Commands express user intent and always identify the target:

```text
IMPORT_IMAGE(file)
START_AUTOMATIC_REMOVAL(documentId, backend)
SELECT_TOOL(documentId, tool)
UPDATE_DRAFT(documentId, tool, delta)
APPLY_DRAFT(documentId, tool, expectedRevision)
CANCEL_DRAFT(documentId, tool)
UNDO(documentId)
REDO(documentId)
SELECT_DOCUMENT(documentId)
EXPORT(documentId, settings)
REMOVE_DOCUMENT(documentId)
```

Only `APPLY_DRAFT` may commit a tool draft. Prefetching, model warm-up, source encoding, preview, or
candidate inference must never emit a document commit or reuse the same user-visible state label.

### 4.3 Domain events

```text
ImageImported
ProcessingQueued / Started / Progressed
ProcessingSucceeded / Failed / Cancelled
DraftChanged / PreviewReady / DraftCancelled
OperationCommitted / CommitRejectedAsStale
HistoryMoved
DocumentSelected / Removed
ArtifactRetained / Released
ExportSucceeded / Failed
```

Events are small metadata records. Pixel data remains in the artifact repository.

### 4.4 Required invariants

1. One document actor is the only writer for one `ImageDocument`.
2. At most one committing operation is active per document.
3. Every asynchronous result carries `{ documentId, runId, expectedRevision }`.
4. A stale/cancelled result cannot publish artifacts or mutate history.
5. Draft, preview, committed result, and background preparation are distinct states.
6. A stroke changes only draft state; Apply occurs only from an explicit command.
7. Selecting a completed document never triggers automatic processing.
8. React state contains view state and small selected snapshots, never image buffers.
9. Every artifact has an owner and deterministic release point.
10. Local and remote processing return the same application-level result contract while retaining
    different privacy and cancellation policies.

## 5. Target runtime architecture

```text
React/TanStack Start UI
        |
        | commands / selectors
        v
Workspace actor
  +-- one ImageDocument actor per image
  |     +-- active tool actor (draft only)
  |     +-- history reducer
  |     `-- active operation identity
  +-- session selection/order
  `-- processing coordinator
         +-- LocalProcessingAdapter -> bounded browser worker pool
         `-- RemoteProcessingAdapter -> paid API/job client (future)

ArtifactRepository <-> worker transfer boundary / preview renderer / exporter
```

### 5.1 State and orchestration

Use **XState v5 + `@xstate/react`** for application workflows and actor ownership. One child actor
per image gives isolation, explicit legal transitions, inspectable snapshots, and automatic child
lifecycle under a parent session. React consumes narrow selectors rather than a giant hook result.

XState context stores identifiers and small metadata only. Persisted actor snapshots are useful for
workflow metadata, but must not contain image bytes. Promise actors are suitable for one-shot jobs;
callback/machine actors are required where progress, cancellation, or two-way worker communication
is needed. Stopping an actor is not assumed to cancel an arbitrary Promise; adapters must consume an
`AbortSignal` or implement explicit worker cancellation.

Rejected alternatives:

- **More React hooks/Context:** retains the current hidden-ref coordination problem.
- **Zustand alone:** concise storage, but does not by itself enforce legal workflow transitions,
  child ownership, cancellation, or stale-result rules.
- **Redux Toolkit alone:** strong reducer/event tooling, but the editor naturally maps to
  independently owned image actors; global middleware would still need a custom actor/resource
  model. It remains viable if XState proves unsuitable in the Phase-33 spike.

### 5.2 Artifact and rendering layer

`ArtifactRepository` is a framework-free TypeScript service:

- opaque IDs and metadata on the application side;
- transferable `ArrayBuffer`/`ImageBitmap` ownership at worker boundaries;
- reference counting or explicit document/run leases;
- object URL creation/revocation in one adapter;
- development assertions for leaked or double-released artifacts;
- configurable memory budget and deterministic eviction of unreachable previews.

Canvas rendering is imperative and isolated from React reconciliation. Pointer samples are
accumulated in a small input buffer and painted at most once per animation frame. A transient stroke
overlay never performs inference or commits. Expensive preview generation is cancellable and may be
coalesced; committed full-resolution output is produced only on Apply/export.

### 5.3 Local processing runtime

Use one typed protocol and a bounded worker pool rather than a separate lifecycle implementation in
each hook. The protocol has explicit operations, progress, cancellation, release, terminal outcomes,
and ownership:

```ts
type ProcessingRequest = {
  runId: RunId;
  documentId: DocumentId;
  expectedRevision: Revision;
  operation: ProcessingOperation;
  inputs: ArtifactTransfer[];
};
```

The coordinator enforces:

- one heavy GPU job at a time by default;
- bounded CPU/WASM concurrency based on measured capability;
- no concurrent model initialization for unrelated tools;
- a warm automatic-removal runtime that is not destroyed merely because the UI tool changed;
- explicit priority: pointer/render work > interactive preview > user Apply > background batch;
- cooperative cancellation between expensive stages, with hard worker termination as recovery;
- performance marks for queue, transfer, decode, inference, composite, encode, commit, and paint.

### 5.4 Server state and future paid processing

When a backend is introduced, use **TanStack Query v5 only for remote server state**: account,
entitlements, balance/subscription, job metadata, status, and result manifests. It must not become
the local editor store or hold full image artifacts. Query functions consume the provided
`AbortSignal`; mutations require an explicit cancellation/idempotency design because mutation
cancellation is not automatic.

The processing port is stable from the first v2 slice:

```ts
interface ProcessingGateway {
  start(command: ProcessingCommand, signal: AbortSignal): ProcessingRun;
}
```

`LocalProcessingGateway` wraps the browser runtime. A future `RemoteProcessingGateway` creates and
observes server jobs. UI and document actors select a backend through capabilities/entitlements;
they do not branch on HTTP or model-provider details.

## 6. Stack decision

### 6.1 Keep

| Technology | Decision |
|------------|----------|
| TypeScript strict mode | Keep across web, contracts, and control-plane API |
| React 19 | Keep as UI renderer, not workflow owner |
| TanStack Start/Router | Keep for SSR, SEO pages, routing, and web delivery |
| Tailwind + shadcn/ui/Base UI | Keep for presentation primitives |
| Paraglide | Keep bilingual URL/message contract |
| FSD | Keep for UI-facing source organization; add domain/application/runtime packages beneath it |
| Transformers.js + ONNX Runtime Web | Keep as the free local processing adapter |
| Vitest + Playwright | Keep; reorganize tests around contracts and vertical slices |

### 6.2 Add in v2 foundation

| Technology/pattern | Purpose |
|--------------------|---------|
| XState v5 + `@xstate/react` | deterministic workspace/document/tool actors and selectors |
| framework-free domain/application modules | commands, events, reducers, ports, policies |
| unified typed worker protocol | correlation, cancellation, transfer ownership, terminal outcomes |
| explicit artifact repository | binary ownership, memory budget, URLs, cleanup |
| browser performance harness | long tasks, interaction latency, stage timing, resource leases |

### 6.3 Reserve for paid backend; do not implement in Phase 33

| Area | Direction | Reason |
|------|-----------|--------|
| Public control-plane API | TypeScript modular monolith, Fastify candidate | plugin encapsulation, schema validation, typed routes, cheap VPS operation |
| API contract | versioned OpenAPI plus generated client/types | prevents web/API drift |
| Durable data | PostgreSQL | accounts, entitlements, billing ledger, job metadata |
| Binary storage | S3-compatible object storage with short TTL | avoids database blobs; explicit deletion/retention |
| Job execution | queue port; concrete Redis/Postgres choice deferred to load evidence | do not add infrastructure before concurrency/recovery requirements are known |
| GPU inference | isolated Python worker service/container | strongest model ecosystem; not exposed as the public API |
| Job progress | polling first, SSE when justified | simpler recovery semantics than mandatory WebSockets |
| Server-state client | TanStack Query v5 | cache/synchronization for remote resources only |

Fastify is a candidate, not yet a dependency. The backend phase must compare its operational and
security implications against using TanStack Start server functions or another framework before
locking the choice.

### 6.4 Do not add

- A canvas framework until a measured renderer requirement cannot be met with Canvas 2D and an
  imperative adapter.
- A generic event bus. Actor references and typed ports are the communication boundary.
- Binary payloads in XState, React, TanStack Query, logs, analytics, or persisted snapshots.
- Accounts/payment/provider SDKs before product, legal, data-retention, and threat-model contracts
  are approved.

## 7. Paid/server capability boundary

The free mode remains anonymous and local: source images and derived pixels do not leave the device.
Remote processing is an explicit paid capability with separate disclosure and consent. Candidate
future features include faster/higher-quality removal and generated backgrounds from a user prompt
or from the detected subject/context.

Conceptual remote flow:

```text
authenticated entitled user
  -> create idempotent processing job
  -> upload encrypted-in-transit source to short-lived object storage
  -> queue job
  -> isolated GPU worker claims job
  -> result manifest/artifact
  -> client imports result into the same ImageDocument actor
  -> automatic expiry/deletion + user delete control
```

Required before implementation:

- explicit local-versus-remote choice and truthful privacy copy;
- authentication, authorization, entitlement, idempotency, quota, abuse, and rate-limit contracts;
- payment provider and webhook threat model;
- input/output/prompt data classification, region, encryption, retention, deletion, backups, and
  model-provider subprocessors;
- job retry/cancellation semantics and charging rules;
- generated-content safety and acceptable-use policy;
- licensing review for every commercial server model. The current IS-Net AGPL choice must be
  revisited before commercial use.

## 8. Repository boundaries for v2

Start inside the existing repository so migration can reuse routes, design system, localization,
and deployment. Prefer these boundaries; a pnpm workspace split is optional until it pays for
itself:

```text
src/v2/domain/             # pure entities, value objects, commands, events, invariants
src/v2/application/        # actors/use cases, ports, policies, selectors
src/v2/runtime-browser/    # worker pool, local processing adapter, artifact repository adapters
src/v2/presentation/       # React bindings and v2 UI composition
src/v2/testing/            # deterministic fakes, model-based test helpers
```

Legacy FSD slices may be called through adapters, but v2 modules must not import legacy hooks or use
their React state as source of truth. When the architecture stabilizes, these directories may move
to workspace packages without changing their public contracts.

## 9. Migration roadmap

### Phase 33 — v2 foundation and first vertical slice

- Freeze the v2 commands/events/invariants and actor hierarchy.
- Add artifact repository and unified worker protocol with deterministic fakes.
- Implement a separately reachable v2 single-image flow: import, local automatic removal, preview,
  PNG export.
- Instrument stage timings and prove scroll/control responsiveness during model initialization and
  inference on the architect's target browser/device.
- Keep the legacy route available for comparison and rollback.
- Do not migrate Magic, Manual, Enhancements, Background, or batch yet.

### Later slices

1. document history and exact Manual Cutout;
2. Magic Cutout with draft/preview/apply separation;
3. Background and Enhancements;
4. batch as a parent actor spawning the already-proven per-image actor;
5. accessibility/device/product validation;
6. paid backend foundation and one opt-in remote-processing slice;
7. generated backgrounds and other paid capabilities only after the backend/data/legal gates.

The old editor is removed only after the replacement has feature parity and the architect has
verified the target-device experience.

## 10. Test strategy and release gates

Each vertical slice must pass before the next begins:

1. pure domain transition/invariant tests;
2. model-based actor tests, including cancel/stale/retry/unmount and illegal commands;
3. worker protocol contract tests with transferable ownership and crash recovery;
4. adapter integration tests using deterministic inference fakes;
5. bilingual Playwright for the exact user journey;
6. serialized real-model browser smoke;
7. target-device manual trace with scroll and unrelated controls exercised during every heavy stage;
8. memory/artifact lease audit after repeated import/cancel/remove;
9. production build/container smoke and existing security gates when release scope requires them.

Automated headless timing is regression evidence, not proof of target-device smoothness. A phase
cannot claim responsiveness until the architect reproduces the measurement on the device/browser
where the original freeze occurs.

## 11. Decision log and research basis

| Decision | Basis |
|----------|-------|
| Actor model for workflow ownership | XState v5 supports parent/child actors, invoked actors, snapshots, and selector-based React subscriptions. Cancellation still has to be implemented by adapters. |
| TanStack Query only for server state | Query cancellation uses a consumed `AbortSignal`; mutations do not receive automatic cancellation. This fits remote resources, not local image editing. |
| Fastify as backend candidate | Current Fastify guidance supports encapsulated plugins, schema-based typed routes, lifecycle hooks, and injection testing. GPU inference remains a separate internal worker. |
| No binary state in state managers | avoids accidental cloning, serialization, broad subscriptions, and unbounded cache retention |
| Parallel vertical-slice migration | preserves a working fallback and makes each domain boundary testable before feature breadth returns |

Primary references:

- [XState actors and invoked services](https://github.com/statelyai/xstate/blob/xstate@5.20.1/docs/guides/actors.md)
- [XState React actor-selector tests](https://github.com/statelyai/xstate/blob/main/packages/xstate-react/test/useActorRef.test.tsx)
- [TanStack Query cancellation](https://github.com/TanStack/query/blob/v5.90.3/docs/framework/react/guides/query-cancellation.md)
- [TanStack Query mutations](https://github.com/TanStack/query/blob/v5.90.3/docs/framework/react/guides/mutations.md)
- [Fastify encapsulation](https://github.com/fastify/fastify/blob/main/docs/Reference/Encapsulation.md)
- [Fastify TypeScript](https://github.com/fastify/fastify/blob/main/docs/Reference/TypeScript.md)

## 12. Open decisions — deliberately deferred

- exact backend framework after a focused spike;
- auth and payment providers;
- database access library/migrations;
- Redis versus PostgreSQL-backed job queue;
- object-storage provider and region;
- server model families and commercial licenses;
- whether remote job progress needs SSE beyond polling;
- exact v2 route/feature-flag exposure during migration.

These do not block the first local v2 vertical slice because every future integration sits behind a
port defined at the application boundary.
