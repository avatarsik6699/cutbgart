# BG Remove App v2 — Domain Model and Target Architecture

**Status:** approved direction; Phases 33–35 accepted; Phase-36 finishing-tools contract frozen

**Date:** 2026-08-01
**Purpose:** replace incremental repairs of the current editor with an architecture-led, testable
vertical-slice migration. This document describes the current system, the observed failure modes,
the target model, stack decisions, and migration boundaries. It is not evidence that v2 has already
been implemented.

## 1. Executive decision

The existing application remains a recoverable legacy implementation. New editor work—including
presentation components and shared frontend infrastructure—proceeds as a parallel v2 path and
migrates one complete user outcome at a time. The first v2 slice is only:

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

V2 does not inherit the legacy component tree by default. It builds a small, reviewed UI foundation
for the first slice—Typography, optimized Image, status/progress composition, and SSR-safe config/
runtime wrappers—then grows it only from concrete consumers. Every new file follows
`docs/FRONTEND_CONVENTIONS.md`; architect review is a blocking phase gate.

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

### 5.5 V2 presentation and shared foundation

V2 consumes repository-wide presentation primitives from `src/shared/ui` and generic hooks from
the repository-wide `src/shared/lib` public API instead of composing the legacy editor's bespoke
components. A stable repository-wide primitive is reused only after a
Phase-33 compliance inventory confirms their API and implementation satisfy
`FRONTEND_CONVENTIONS.md`. Reuse happens through the module public API; legacy feature hooks and
state never cross into v2.

The first foundation includes:

- `Typography`: typed semantic element plus a finite visual-variant registry; no page-local
  recreation of heading/body/caption/label classes;
- `Image`: typed display presets and safe defaults for `alt`, dimensions/aspect ratio, object fit,
  `loading`, `decoding`, and fetch priority. It renders an already leased URL and never creates or
  revokes blob URLs itself;
- SSR-safe `env.ts` and `runtime.ts`, adapted from
  `patient_tracker/frontend/app/shared/config`: typed client/server namespaces, validation and URL
  normalization in config, and dynamic server/client/window detection in runtime;
- public-indexed browser/storage/router/image utilities only where the first slice has a real
  consumer and test. Direct `window`, `localStorage`, raw persisted JSON, `import.meta.env`, worker,
  object-URL, and image-decode access outside the owning wrapper is forbidden.

`src/shared/config` remains the single repository-wide environment boundary because two modules
reading `import.meta.env` would create divergent build contracts. Phase 33 may refactor it into the
typed `env.ts` + `runtime.ts` shape with backward-compatible legacy exports; v2 consumes only the
new namespaced API. Secrets are never exposed through client config.

## 6. Stack decision

### 6.1 Keep

| Technology | Decision |
|------------|----------|
| TypeScript strict mode | Keep across web, contracts, and control-plane API |
| React 19 | Keep as UI renderer, not workflow owner |
| TanStack Start/Router | Keep for SSR, SEO pages, routing, and web delivery |
| Tailwind + shadcn/ui/Base UI | Keep for presentation primitives |
| Paraglide | Keep bilingual URL/message contract |
| FSD | Keep one-way UI layer dependencies and strict entity/feature slice isolation; allow direct widget/page same-layer composition when it removes adapter-only indirection |
| Transformers.js + ONNX Runtime Web | Keep as the free local processing adapter |
| Vitest + Playwright | Keep; reorganize tests around contracts and vertical slices |

### 6.2 Add in v2 foundation

| Technology/pattern | Purpose |
|--------------------|---------|
| XState `5.32.5` + `@xstate/react` `6.1.0` | deterministic workspace/document actors and selector-only React bindings |
| framework-free domain/application modules | commands, events, reducers, ports, policies |
| unified typed worker protocol | correlation, cancellation, transfer ownership, terminal outcomes |
| explicit artifact repository | binary ownership, memory budget, URLs, cleanup |
| v2 Typography/Image primitives | consistent semantics, rendering presets, and image-loading policy |
| typed `env.ts` + `runtime.ts` boundary | validated environment access and SSR/browser capability checks |
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

### 6.5 Browser runtime platform-first decision

Phase 33 uses small, domain-specific adapters over browser primitives. It does not install,
prototype, benchmark, or integrate third-party worker/RPC/pool/canvas libraries. Candidate names are
retained only so a later phase can revisit them if the native implementation exposes a measured,
specific deficiency.

| Concern | Phase-33 direction | Candidate/tool decision |
|---------|--------------------|-------------------------|
| Compute isolation | Dedicated module Workers | Correct lifecycle for page-owned image jobs; do not use Service Worker for inference |
| Model asset caching | Existing Service Worker + Cache Storage | Keep network/cache responsibility isolated from editor compute and state |
| Message/RPC ergonomics | Explicit discriminated native protocol | Comlink is a deferred candidate only; no Phase-33 dependency, prototype, or comparison |
| Worker pool | Small processing coordinator around the typed protocol | workerpool and threads.js are deferred candidates only; no Phase-33 dependency, prototype, or comparison |
| Binary transfer | Native transferable `ArrayBuffer`, `ImageBitmap`, and capability-gated `OffscreenCanvas` | Ownership transfer is represented in protocol/artifact leases; structured clone of full-resolution buffers fails the contract |
| Canvas | Imperative Canvas 2D adapter; native OffscreenCanvas where required and supported | Keep pointer sampling and lightweight overlay on the interaction path; capability/fallback behavior is tested as our adapter contract, not as a library comparison |
| Canvas framework | None | Konva, Fabric, and Pixi remain deferred candidates until a later phase records a concrete missing capability |
| Shared memory | No `SharedArrayBuffer` initially | Add only with a proven copy bottleneck and an approved COOP/COEP, security, determinism, and fallback design |

The candidate registry is informational, not Phase-33 work. Comlink may reduce RPC boilerplate;
workerpool/threads.js may provide generic pooling; canvas frameworks may provide richer scene
management. None currently justifies the integration, abstraction, bundle, lifecycle, and test cost.
OffscreenCanvas is a browser API rather than a library: the native adapter may use it when the first
slice requires off-thread render/encode and supplies a tested fallback, but it does not remove
GPU/driver contention.

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
src/shared/config/         # one repository-wide SSR-safe env/runtime boundary
src/shared/lib/react/      # repository-wide SSR-safe React utilities
src/shared/ui/{media,typography}/ # repository-wide Image and Typography primitives
```

Legacy FSD slices may be called through adapters, but v2 modules must not import legacy hooks or use
their React state as source of truth. When the architecture stabilizes, these directories may move
to workspace packages without changing their public contracts.

The rendered v1 editor is the migration's visual and interaction contract. Architecture isolation
does not imply a new product design. Reuse or extract controller-neutral presentation and connect it
to typed v2 projections/intents; do not fork an independently styled v2 copy, and do not pull legacy
hooks, stores, controllers, or worker ownership through the presentation seam.

## 9. Migration roadmap

### Completed slices

- **Phase 33:** v2 actor/artifact/worker/shared-UI foundation and one-image local automatic removal,
  preview, export, cancellation, cleanup, and target-device evidence.
- **Phase 34:** bounded committed document history and runtime-owned exact Manual Cutout with
  explicit Apply/Cancel, two-level Undo/Redo, artifact-aware pruning, and no reinference.
- **Phase 35:** guided Magic Cutout with bounded semantic strokes, runtime-owned prediction/
  candidates, explicit preview/apply separation, and shared automatic/Magic heavy-job admission.
- **Phase 36:** Background and ordered fine-detail/colour-halo Enhancements with runtime-owned
  previews/intermediates, atomic document publication, and shared heavy-job admission.
- **Phase 37:** batch/multi-document orchestration as a parent workspace actor over the proven
  document actor, with per-document runtime ownership, isolated retry/remove, cached selection,
  global heavy-job admission, and deterministic Download All.

### Validation result

1. **Phase 38:** produced a blocked readiness report. The isolated v2 workflow architecture passed
   substantial automation/real-model checks, but its presentation and several legacy-visible
   capabilities were not ready to replace the public editor.

### Active slice

1. **Phase 39:** reproduce the v1 main-page shell and one complete single-image input, quality,
   processing, result, export-size, and PNG flow over v2 ownership on the isolated bilingual routes.
   Public routes remain unchanged.

### Later slices

1. batch and editor-tool presentation slices using the same v1-faithful adapter boundary;
2. scenario/public-route migration with a controlled rollback boundary after full UI acceptance;
3. legacy editor removal only after public v2 acceptance;
4. paid backend foundation and one opt-in remote-processing slice;
5. generated backgrounds and other paid capabilities only after the backend/data/legal gates.

The old editor is removed only after the replacement has feature parity and the architect has
verified the target-device experience.

## 10. Test and performance architecture

### 10.1 Test portfolio

Each vertical slice must pass before the next begins:

1. pure domain transition/invariant tests;
2. model-based actor tests, including cancel/stale/retry/unmount and illegal commands;
3. worker protocol contract tests with transferable ownership and crash recovery;
4. adapter integration tests using deterministic inference fakes;
5. component tests for semantic rendering and UI-to-command translation;
6. bilingual deterministic Playwright for the exact user journey;
7. a small serialized real-model browser smoke;
8. target-device manual trace with scroll and unrelated controls exercised during every heavy stage;
9. memory/artifact lease audit after repeated import/cancel/remove;
10. production build/container smoke and existing security gates when release scope requires them.

Test boundaries mirror production boundaries. A fake `ProcessingGateway`, fake clock/ID source,
in-memory `ArtifactRepository`, and worker-protocol harness implement the same public contracts as
real adapters. Tests do not patch private hooks or reproduce the production state machine in a
second mock implementation.

### 10.2 Playwright architecture

Use a small test kit under `e2e/support/v2/`:

```text
fixtures/        typed test extension, isolated scenario state, automatic cleanup
drivers/         worker/model/artifact/network controls through supported test ports
components/      reusable component objects for upload, progress, preview, export
journeys/        business-level compositions only when shared by multiple specs
assertions/      domain-aware observable outcomes and resource invariants
assets/          minimal deterministic image corpus with declared purpose
```

Playwright's per-test browser context remains the isolation boundary. Typed fixtures install a
scenario before navigation and remove listeners/routes/storage/resources afterward. Component
objects or narrowly scoped Page Objects are used only when they own stable selectors and repeated
user operations; they must not become a giant application API or hide assertions/waits. Prefer role,
label, and stable contract test IDs, Playwright auto-waiting, and web-first assertions. Forbid
`waitForTimeout`, test-order dependence, conditional assertions, broad CSS/XPath, and retries used to
mask flakiness.

The fast lane replaces the local gateway/worker boundary with deterministic scenarios for progress,
failure, crash, cancel, and stale completion while retaining real routing, rendering, input,
selectors, and downloads. It is parallel-safe. The real-model lane is deliberately small,
serialized, separately reported, and never the source of ordinary UI coverage. Traces, screenshots,
console, protocol transcript, marks, and resource counts are retained on first retry/failure rather
than collected expensively for every passing test.

MSW is a deferred candidate for a future HTTP backend or true network-level integration cases. It is
not installed or evaluated in Phase 33 and does not mock the local worker protocol. Existing
Playwright routing remains sufficient for the few current network assertions.

### 10.3 Unit and contract test architecture

Vitest tests are colocated with their owned module unless a cross-module contract requires
`src/v2/testing/`. Use typed builders with minimal valid defaults, explicit scenario overrides,
table-driven transitions, model-based actor paths, and deterministic fake time/IDs. Reusable fixtures
must declare test/file/worker scope and cleanup; global mocks, timers, observers, listeners, object
URLs, workers, and repositories are restored after each test. Prefer state/output/event assertions
over call-order assertions. Snapshot tests are limited to stable serialized contracts where a diff is
the intended review surface.

The suite has a speed budget and reports slow files/tests. Expensive shared setup may use a longer-
lived read-only fixture only when isolation is proved; mutable domain state is test-scoped. Tests run
independently, in random order where supported, and repeated stress runs must have zero retries and
zero seed-dependent failures.

### 10.4 Performance evidence architecture

The useful ideas in the v1 profiling scripts are retained—Long Tasks observation, next-paint probes,
heap/trace diagnostics, worker-message counts, churn, and production-build execution—but the scripts are
duplicated, Chromium-specific, partially mock-only, and not one reusable measurement contract. They
are historical evidence, not a v2 library.

V2 establishes:

```text
src/v2/testing/performance/
  contracts.ts       metric names, units, samples, budgets, environment metadata
  marks.ts           typed User Timing stages; no free-form mark strings
  browser-collector  Long Tasks/Event Timing/paint/resource observation + support flags
  resource-probe     artifact leases, URLs, workers, sessions, listeners
  report             versioned JSON and percentile/budget evaluation
  test-adapter       deterministic clock and synthetic samples
scripts/profiling/v2/
  one orchestration shell over the same collector/report contracts
```

Use platform `PerformanceObserver`/User Timing for Phase-33 editor-stage evidence. `web-vitals`
remains a deferred candidate for field LCP/INP/CLS attribution when production telemetry is later in
scope; it is not installed or evaluated in Phase 33. A managed Playwright browser supplies target
trace diagnostics, not a cross-browser truth; attaching to a personal browser over CDP is excluded.
Lighthouse remains useful for navigation/SEO and page-level
audits, but is not the critical interaction oracle for local inference. Every report states browser,
device, GPU/runtime/model, cold/warm cache, support gaps, sample count, percentiles, and whether the
gateway was fake or real.

Automated headless timing is regression evidence, not proof of target-device smoothness. A phase
cannot claim responsiveness until the architect reproduces the measurement on the device/browser
where the original freeze occurs.

## 11. Phase-33 frozen implementation contract

This section is the normative `T1` boundary for Phase 33. Earlier examples describe the longer-term
editor; where their vocabulary is broader, this section's one-image subset wins for this phase.
Changes to these tables require an evidence entry in §11.9 before implementation continues.

### 11.1 Actor hierarchy and ownership

```text
editorV2WorkspaceActor (one root actor for the mounted v2 surface)
  +-- editorV2DocumentActor:<documentId> (exactly one per imported image; Phase 33 caps this at one)
  |     `-- processingRunActor:<runId> (invoked only while one run is active)
  `-- ProcessingCoordinator (application service, not an actor snapshot)
         `-- LocalProcessingGateway
                `-- one replaceable Dedicated Worker; one heavy job globally
```

- Machines use XState v5 `setup()` with declared actor/action/guard implementations. The workspace
  creates document children with `spawnChild` and removes them with `stopChild`; child refs are
  application values and are never serialized as domain snapshots.
- The workspace owns only the selected document ID, ordered document IDs, and child refs. Phase 33
  rejects a second import while a document exists rather than silently becoming batch mode.
- The document actor is the sole writer of its `DocumentState`; it owns revision, current committed
  snapshot IDs, active run metadata, progress metadata, and the last typed error/outcome.
- `processingRunActor` is a callback actor around `ProcessingGateway`. Its cleanup aborts the
  request and sends protocol cancellation. A Promise resolving late is still checked by correlation;
  stopping an actor alone is never treated as proof that external work stopped.
- `ProcessingCoordinator`, gateway, repository, worker, URLs, files, buffers, model handles, clocks,
  and ID generators are injected dependencies. None appears in serializable machine context.
- React creates/subscribes to the root actor through the presentation adapter, sends commands to an
  actor ref, and reads only primitive/ID/status view selectors with `useSelector`. React unmount is a
  disposal signal to the root actor, not a workflow transition or cancellation decision.

### 11.2 Phase-33 commands, events, outcomes, and snapshots

`IMPORT_IMAGE` is an application-edge command: its `File` is handed immediately to the importer and
artifact repository and is never forwarded to the pure domain reducer or stored in actor context.
All subsequent domain inputs contain IDs and small metadata only.

```ts
type EditorV2Command =
  | { type: "IMPORT_IMAGE"; file: File }
  | { type: "START_AUTOMATIC_REMOVAL"; documentId: DocumentId; backend: "local" }
  | { type: "CANCEL_ACTIVE_RUN"; documentId: DocumentId }
  | { type: "EXPORT_PNG"; documentId: DocumentId }
  | { type: "RESET_DOCUMENT"; documentId: DocumentId };

type DocumentCommand = Exclude<EditorV2Command, { type: "IMPORT_IMAGE" }>;

type CommandOutcome =
  | { status: "accepted"; command: EditorV2Command["type"] }
  | { status: "rejected"; command: EditorV2Command["type"]; reason:
      | "document-exists" | "document-not-found" | "not-ready" | "run-active"
      | "no-active-run" | "no-result" | "stale-revision" | "disposed" };

type DocumentState = {
  documentId: DocumentId;
  source: ArtifactId;
  revision: Revision;
  committed: DocumentSnapshot | null;
  activeRun: { runId: RunId; expectedRevision: Revision } | null;
  stage: ProcessingStage | null;
  progress: number | null;
  error: ProcessingError | null;
};
```

The application/domain event union is metadata-only:

```text
SOURCE_REGISTERED
PREPARATION_STARTED / PREPARATION_SUCCEEDED / PREPARATION_FAILED
PROCESSING_QUEUED / PROCESSING_STARTED / PROCESSING_PROGRESS
PROCESSING_SUCCEEDED / PROCESSING_FAILED / PROCESSING_CANCEL_REQUESTED / PROCESSING_CANCELLED
COMMIT_ACCEPTED / COMMIT_REJECTED_STALE
EXPORT_REQUESTED / EXPORT_SUCCEEDED / EXPORT_FAILED
DOCUMENT_RESET / DOCUMENT_DISPOSED
```

Every run event carries `{ documentId, runId }`; success and commit events also carry
`expectedRevision`. Progress contains a typed stage, normalized fraction, and optional small timing
metadata. Exactly one of succeeded, failed, or cancelled is accepted as the run's terminal outcome.

### 11.3 Legal document transitions

The document actor uses these user-visible states; internal substates may split an implementation
stage but may not add a user-visible semantic state without updating this table.

| From | Input | Guard / action | To | Rejection or stale behavior |
|------|-------|----------------|----|-----------------------------|
| `preparing` | preparation progress | matching document | `preparing` | wrong document ignored and diagnosed in development |
| `preparing` | `PREPARATION_SUCCEEDED` | source lease exists; enqueue exactly one automatic run | `queued` | released/missing source -> `error` |
| `preparing` | `PREPARATION_FAILED` | typed error | `error` | — |
| `preparing` | cancel/reset | release import/run leases | `cancelling`/disposed | terminal cancel must follow before disposal completes |
| `ready` | `START_AUTOMATIC_REMOVAL` | no run; revision captured | `queued` | duplicate -> `run-active` |
| `queued` | gateway accepted | same run/revision | `model-loading` or `processing` | stale event releases its payload/leases |
| `queued` | cancel | send cancel once | `cancelling` | second cancel -> `no-active-run` |
| `model-loading` | progress/model ready | same run | `model-loading`/`processing` | progress never commits |
| `processing` | stage progress | same run; monotonic stage/fraction | `processing` | regressive/foreign progress ignored and diagnosed |
| `model-loading`/`processing` | cancel | send cancel once; retain run lease until terminal ack | `cancelling` | no optimistic result/error flash |
| `queued`/`model-loading`/`processing` | success | run and expected revision match | `committing` | stale/cancelled success releases all returned artifacts |
| `committing` | commit accepted | atomically promote run artifacts to document leases; increment revision | `result` | only writer performs promotion |
| `committing` | stale commit | release all run artifacts | prior stable state or `error` | returns `stale-revision` |
| active run state | failure | same run; release transient outputs | `error` | later terminal events ignored/released |
| `cancelling` | cancelled acknowledgement/failure | same run; release run leases | `ready` | late success is stale and released |
| `error` | retry/start | retryable; no active run | `queued` | non-retryable -> `not-ready` |
| `result` | export | committed composite and PNG lease exist/are derivable without processing | `result` | duplicate export may reuse bytes; never starts inference |
| `result`/`error`/`ready` | reset | release document/run/preview/export leases and stop child | disposed | repeated reset -> `disposed` |
| any | event for other run/revision/document | correlation mismatch | unchanged | no state mutation; owned payload is released |

Import automatically advances from preparation to one automatic removal. `ready` exists for a
cancelled or retryable document; it does not cause processing on remount or selection. `model-loading`
is model/session preparation, not a document commit. `cancelling` cannot transition directly to
`result`.

### 11.4 Artifact ownership and deterministic cleanup

`ArtifactRepository` is the only owner of binary values and object URLs. Its public application
surface accepts/returns opaque IDs, metadata, and explicit leases:

```ts
type ArtifactLeaseOwner =
  | { kind: "document"; documentId: DocumentId }
  | { kind: "run"; documentId: DocumentId; runId: RunId }
  | { kind: "preview"; documentId: DocumentId }
  | { kind: "export"; documentId: DocumentId };

type ArtifactStats = {
  artifacts: number;
  leases: number;
  objectUrls: number;
  estimatedBytes: number;
};
```

- Import stores the source under a document lease. Gateway inputs receive a run lease, not a copy
  in actor state. Worker transfers are checked out through a runtime-only adapter.
- Successful commit promotes matte/foreground/composite/PNG output from the run lease to the
  document lease atomically; failure, cancellation, crash, or stale completion releases the run.
- Preview and export URLs are repository-created leased views. Replacing/resetting/removing a
  document revokes those URLs before releasing their backing artifact.
- Export reuses the committed PNG/composite artifact. It may create a download URL/lease but must
  not invoke the gateway, decode, composite, or encode synchronously on the interaction path.
- Zero refcount makes an artifact unreachable and deterministically disposable. Development mode
  throws typed assertions for unknown ID, access after release, double release, invalid promotion,
  leaked URL, and budget overflow; production returns typed failures and performs safe cleanup.
- Warm model/runtime ownership belongs to `LocalProcessingGateway`, not a document lease. Reset may
  keep one warm runtime under the explicit one-worker memory policy; route disposal terminates it.

### 11.5 Processing port and local scheduling policy

```ts
type ProcessingStage =
  | "queued" | "model-loading" | "decode" | "automatic-remove"
  | "post-process" | "composite" | "encode-png";

type ProcessingRequest = {
  documentId: DocumentId;
  runId: RunId;
  expectedRevision: Revision;
  operation: "automatic-remove";
  source: ArtifactId;
};

type ProcessingProgress = {
  documentId: DocumentId;
  runId: RunId;
  stage: ProcessingStage;
  fraction: number | null;
};

type ProcessingRun = {
  runId: RunId;
  result: Promise<DocumentSnapshot>;
  subscribe(listener: (progress: ProcessingProgress) => void): () => void;
  cancel(): void;
  release(): void;
};

interface ProcessingGateway {
  start(request: ProcessingRequest, signal: AbortSignal): ProcessingRun;
  dispose(): Promise<void>;
}
```

The single application request represents the full automatic-removal transaction. Internal worker
stages are not separately commit-capable gateway operations. The local coordinator queues at most
one heavy job, reports queue time truthfully, never initializes two models concurrently, checks
cancellation between all stages, and replaces a crashed worker. A crash fails the active run once
with a retryable typed error; it does not silently repeat inference. User retry creates a new run ID.

### 11.6 Worker protocol and transfer rules

Only `src/v2/runtime-browser/worker/processing.worker.ts` and its gateway/client adapter may use the
native Worker messaging API. Protocol messages are discriminated and versioned:

```ts
type WorkerCommand =
  | { protocol: 1; type: "RUN"; correlation: RunCorrelation;
      source: TransferableArtifact; model: LocalModelConfig }
  | { protocol: 1; type: "CANCEL"; correlation: RunCorrelation }
  | { protocol: 1; type: "DISPOSE_RUNTIME" };

type WorkerEvent =
  | { protocol: 1; type: "ACCEPTED"; correlation: RunCorrelation }
  | { protocol: 1; type: "PROGRESS"; correlation: RunCorrelation;
      stage: ProcessingStage; fraction: number | null; timing: StageTiming | null }
  | { protocol: 1; type: "CANCELLED"; correlation: RunCorrelation }
  | { protocol: 1; type: "SUCCEEDED"; correlation: RunCorrelation;
      outputs: TransferableArtifactSet; timings: readonly StageTiming[] }
  | { protocol: 1; type: "FAILED"; correlation: RunCorrelation;
      error: ProcessingError; timings: readonly StageTiming[] };
```

`RunCorrelation` always contains document, run, and expected revision. Eligible `ArrayBuffer` and
`ImageBitmap` values travel in transfer lists; a sender relinquishes ownership immediately and the
repository records the checkout/return. The worker emits monotonic progress and exactly one terminal
message. `CANCELLED` is an acknowledgement, not merely a request. Unknown protocol versions,
duplicate terminals, foreign correlations, invalid progress order, and worker `error`/`messageerror`
become typed gateway failures. Full-resolution decode, transforms, post-processing, compositing, and
PNG encode remain inside the worker; capability-gated `OffscreenCanvas` has a tested worker fallback.

### 11.7 Shared/config/UI boundaries

| Boundary | Sole owner | Forbidden elsewhere |
|----------|------------|---------------------|
| Vite env parsing and validation | `src/shared/config/env.ts` | `import.meta.env`, client exposure of server-only values |
| SSR/client/window/mode detection | `src/shared/config/runtime.ts` | scattered `typeof window`, `process.env`, mode checks |
| Object URL creation/revocation | runtime artifact URL adapter | direct `URL.createObjectURL`/`revokeObjectURL` |
| Worker creation/messaging/termination | v2 worker factory/client/gateway | direct `new Worker`, `postMessage`, `terminate` in React/domain |
| Decode and image metadata | v2 image adapter | raw image-element/createImageBitmap decode in UI/application |
| Capability observation | v2 browser-capability adapter | direct `navigator.gpu`, `OffscreenCanvas`, observer probing |
| Persisted JSON/storage | existing `@/shared/lib/storage` public API | direct localStorage/raw persisted JSON; v2 adds no key |
| Routing | existing `@/shared/lib/use-router` | direct TanStack routing hooks in page/feature code |
| UI date/time formatting | `src/shared/lib/formatting` | direct native date construction/formatting in presentation components |
| Typography styles | `src/shared/ui/typography` | repeated text-style clusters in presentation |
| Content images | `src/shared/ui/media` | raw `<img>` in presentation; object-URL ownership in Image |
| Performance APIs | v2 performance collector/mark adapter | free-form marks or observer setup in pages/tests |

`src/shared/config/index.ts` keeps current legacy exports while adding typed `env` and `runtime`.
V2 imports the new namespaced API only. No env key, persistence key, API endpoint, or server secret is
added.

### 11.8 File-by-file `FRONTEND_CONVENTIONS.md` compliance matrix

The matrix is a pre-implementation manifest. If a consumer proves another file necessary, add its
row and review the boundary before creating it; do not create a speculative helper.

| File | Profile | File-specific review |
|------|---------|----------------------|
| `src/v2/domain/ids.ts` | D | branded opaque IDs and injected generation contract only |
| `src/v2/domain/artifacts.ts` | D | artifact metadata/lease types contain no binary value |
| `src/v2/domain/document.ts` | D | snapshot/revision types contain IDs and small metadata only |
| `src/v2/domain/commands.ts` | D | pure document commands; browser `File` excluded |
| `src/v2/domain/events.ts` | D | metadata-only discriminated events and terminal outcomes |
| `src/v2/domain/processing.ts` | D | processing correlation, progress, errors, and terminal contracts |
| `src/v2/domain/capabilities.ts` | D | small browser-processing support metadata only |
| `src/v2/domain/transitions.ts` | D | pure legal transition and typed rejection function |
| `src/v2/domain/index.ts` | D | explicit domain public API only |
| `src/v2/application/workspace-machine.ts` | A | `setup()` parent and `spawnChild`/`stopChild`; one document cap |
| `src/v2/application/document-machine.ts` | A | sole document writer; injected processing actor; ID-only context |
| `src/v2/application/processing-gateway.ts` | A | backend-neutral port with progress/cancel/release/dispose |
| `src/v2/application/selectors.ts` | A | narrow primitive/ID/status selectors; no binary/actor internals |
| `src/v2/application/index.ts` | A | explicit application public API only |
| `src/v2/runtime-browser/artifact-repository.ts` | B | deterministic leases, promotion, stats, budget, assertions |
| `src/v2/runtime-browser/artifact-id-source.ts` | B | sole browser randomness owner for opaque artifact IDs |
| `src/v2/runtime-browser/artifact-url-adapter.ts` | B | sole object URL creation/revocation owner |
| `src/v2/runtime-browser/browser-capabilities.ts` | B | sole dynamic browser/GPU/OffscreenCanvas capability owner |
| `src/v2/runtime-browser/local-processing-gateway.ts` | B | one-heavy-job queue and warm-runtime policy |
| `src/v2/runtime-browser/processing-cancellation.ts` | B | sole actor-facing AbortController factory; application receives a typed cancellation port |
| `src/v2/runtime-browser/editor-id-source.ts` | B | sole session/document/image/run randomness adapter |
| `src/v2/runtime-browser/download-adapter.ts` | B | sole native download interaction; URL lifetime stays in repository |
| `src/v2/runtime-browser/editor-session.ts` | B | workspace composition root; import, preview/export lease, and route-disposal ownership |
| `src/v2/runtime-browser/worker-client.ts` | B | correlation, progress order, terminal/crash/transfer enforcement |
| `src/v2/runtime-browser/worker-factory.ts` | B | sole `new Worker`/termination owner outside the worker global |
| `src/v2/runtime-browser/worker-protocol.ts` | D | pure versioned discriminated message/transfer types |
| `src/v2/runtime-browser/model-config.ts` | D | immutable existing model asset configuration only |
| `src/v2/runtime-browser/worker/processing.worker.ts` | W | sole worker implementation and full-resolution compute owner |
| `src/v2/runtime-browser/index.ts` | B | explicit runtime public API; no leaked native worker/repository internals |
| `src/shared/ui/typography/typography.tsx` | U | one function component, finite variants, explicit semantics/ref/attributes |
| `src/shared/ui/typography/typography.test.tsx` | X | semantic element/variant/ref/attribute behavior |
| `src/shared/ui/media/image.tsx` | U | one function component, sole presentation-owned raw `<img>`, no URL lifetime |
| `src/shared/ui/media/image.test.tsx` | X | preset/accessibility/loading/decoding/fetch-priority behavior |
| `src/shared/ui/{media,typography}/index.ts` | U | explicit capability public APIs re-exported by root `shared/ui` |
| `src/shared/ui/data-display/` | U | reusable semantic description-list primitives with native `dl`/`dt`/`dd` ownership |
| `src/shared/lib/formatting/` | U | validated presentation date/time and byte formatting behind the root `shared/lib` API |
| `src/shared/config/env.ts` | C | sole Vite env parser; typed client/server separation; no secret export |
| `src/shared/config/env.test.ts` | X | valid/invalid values and client/server separation |
| `src/shared/config/runtime.ts` | C | sole dynamic SSR/client/window/mode detection owner |
| `src/shared/config/runtime.test.ts` | X | SSR without window and dynamically changed globals |
| `src/shared/config/index.ts` | C | typed API plus backward-compatible legacy exports |
| `src/v2/presentation/use-document-actor-selectors.ts` | P | selector-only `@xstate/react` binding over narrow application selectors |
| `src/v2/presentation/use-editor-session.ts` | P | React route-lifetime signal plus external-store subscription; runtime remains owner |
| `src/v2/presentation/index.ts` | P | explicit presentation public API only |
| `src/widgets/public-editor/ui/public-editor.tsx` | P | sole public editor session lifetime and workspace composition |
| `src/widgets/public-editor/ui/public-editor-diagnostics.tsx` | P | editor-owned diagnostics trigger composed into the site header without portal state |
| `src/widgets/public-editor/ui/editor-v2-stage.tsx` | P | one-image input and leased Typography/Image preview only |
| `src/widgets/public-editor/ui/editor-v2-active-document.tsx` | P | active-document connector and accepted tool/canvas composition |
| `src/widgets/public-editor/ui/editor-v2-main-page-active.tsx` | P | main-page result and processing composition |
| `src/widgets/public-editor/ui/editor-v2-tool-workspace.tsx` | P | active tool workspace composition |
| `src/shared/ui/scenario/` | U | shared static localized scenario layout with an explicit editor slot |
| `src/widgets/site-shell/` | P | route-neutral application shell that composes the site header/footer widgets directly |
| `src/widgets/site-header/` | P | application brand, navigation, locale, and PascalCase header-composition slot |
| `src/widgets/site-footer/` | P | application footer navigation, trust, and feedback composition |
| `src/shared/ui/site/site-link.tsx` | U | typed TanStack `createLink` boundary with finite presentation presets |
| `src/shared/ui/site/feedback-link.tsx` | U | sole Telegram URL, safe external attributes, icon, and presentation variants |
| `src/shared/lib/react/use-is-hydrated.ts` | U | repository-wide SSR/client hydration snapshot via `useSyncExternalStore` |
| `src/v2/presentation/shared/diagnostics/` | P | main diagnostics overlay plus capability-root API/types/utils; child UI in `components/`, including declarative `react-error-boundary` plus React `lazy`/`Suspense` chunk containment |
| `src/v2/presentation/shared/tests/` | X | shared-presentation unit/component tests kept outside production capability folders |
| `src/v2/presentation/shared/` | P | remaining controller-neutral toolbar, canvas, panel, registry, and execution presentation pending consumer-led grouping in T5/T6 |
| `src/routes/index.tsx` and localized/scenario routes | R | public page/SEO composition; never workflow ownership |
| `src/routes/editor-v2.tsx` | R | TanStack filename exception; permanent redirect to `/` only |
| `src/routes/en/editor-v2.tsx` | R | TanStack filename exception; permanent redirect to `/en/` only |
| `src/v2/testing/builders.ts` | T | minimal valid typed values and explicit overrides |
| `src/v2/testing/fake-clock.ts` | T | deterministic application clock, no ambient fake timer leak |
| `src/v2/testing/fake-ids.ts` | T | deterministic ID source, reset per test |
| `src/v2/testing/fake-processing-gateway.ts` | T | implements production port, not a second state machine |
| `src/v2/testing/worker-scenario-driver.ts` | T | drives production protocol and observable scenarios |
| `src/v2/testing/index.ts` | T | test-only public API with explicit cleanup contracts |
| `src/v2/testing/performance/contracts.ts` | M | typed signals, support flags, budgets, versioned report schema |
| `src/v2/testing/performance/marks.ts` | M | finite mark registry and injected performance adapter |
| `src/v2/testing/performance/browser-collector.ts` | M | sole observer/Event Timing/User Timing collector owner |
| `src/v2/testing/performance/resource-probe.ts` | M | repository/worker/session/listener counts only |
| `src/v2/testing/performance/report.ts` | M | percentile and unsupported-aware budget evaluator |
| `src/v2/testing/performance/test-adapter.ts` | T | deterministic samples/clock without browser globals |
| `e2e/support/v2/fixtures.ts` | E | typed context-isolated setup and automatic cleanup |
| `e2e/support/v2/scenario-driver.ts` | E | supported test port; no direct private hook patching |
| `e2e/support/v2/upload.ts` | E | narrow upload component object; actions only |
| `e2e/support/v2/progress.ts` | E | narrow progress component object; no hidden assertions |
| `e2e/support/v2/preview.ts` | E | narrow preview component object; no CSS/XPath |
| `e2e/support/v2/export.ts` | E | narrow export component object; observable download action |
| `e2e/phase-33-editor-v2.spec.ts` | E | bilingual deterministic parallel-safe journey |
| `e2e/support/mock-editor-v2-worker.ts` | E | deterministic production-protocol adapter; no model/CDN/GPU dependency |
| `e2e/phase-33-editor-v2.real.spec.ts` | E | one serialized real boundary smoke; no duplicate UI coverage |
| `scripts/profiling/v2/run-phase-43.mjs` | M | final cutover report-contract orchestration shell; no product logic |

Profiles expand to mandatory rules: **D** framework-free pure TypeScript, kebab-case, type aliases,
no React/browser/worker/provider/binary values; **A** D plus injected ports and XState ID-only
context; **B** tested browser adapter with one platform owner and deterministic cleanup/failures;
**W** typed protocol, transferable ownership, no React/DOM UI/env access; **U/P** one function
component per file, local `Props` type, no prop/hook destructuring or inline JSX variables, named
`useEffect` callbacks, and v2 Typography/Image use; **C/L** SSR-safe typed public boundary with no
direct consumer platform access; **T/X** observable behavior, isolated fakes/globals, fake time/IDs
where applicable, complete cleanup; **M** typed support-aware measurement with no free-form marks;
**E** role/label locators, web-first assertions, no hidden assertions/sleeps/global state/retries;
**R** the framework-authorized route naming exception only.

The manifest does not require speculative files: helpers such as `class-names.ts` and
`abort-error.ts` are created only if a Phase-33 consumer exists. Tests for domain/application/runtime
modules are colocated as `<module>.test.ts` and inherit profile X in addition to the source profile.

### 11.9 Performance signals, marks, and evidence-driven deviations

Typed marks are limited to `v2:<runId>:{queued,worker-transfer,decode,model-load,inference,
post-process,composite,encode,commit,preview-paint}:start|end`. Collector code maps them to the
following version-1 report inventory:

| Signal | Source / support rule | Claim and Phase-33 budget |
|--------|-----------------------|---------------------------|
| stage duration and queue delay | typed User Timing measures; always supported when runtime runs | report cold/warm samples and percentiles; no hidden merged stages |
| long task count/duration | `PerformanceObserver("longtask")`; explicit unsupported flag outside supporting engines | zero application-attributable tasks `>=50 ms` on target evidence |
| interaction event-to-next-paint | Event Timing when supported plus controlled next-paint probe | target p95 `<100 ms`; unsupported is `null`, never zero |
| scroll/control action result | Playwright/manual action timestamp + next observable paint/state | zero missed actions during every heavy stage |
| resource/lease counts | `ArtifactRepository.stats()` plus worker/session/listener probe | bounded counts and zero reachable document/run leases after ten churn cycles |
| worker protocol traffic | gateway diagnostic adapter | one run, ordered progress, exactly one terminal, no preview/export reinference |
| heap/trace diagnostics | managed Playwright browser on Chromium only | diagnostic evidence only; never a cross-browser budget claim |
| browser/device/GPU/model/cache | capability reporter and run metadata | mandatory environment metadata; unsupported capabilities explicit |

Evidence-driven deviations and rejected upgrades:

| Decision | Evidence and consequence |
|----------|--------------------------|
| `File` exists only in the application-edge import command | Browser import necessarily begins with a `File`; it is stored immediately and never enters domain/actor snapshots, preserving the no-binary-state invariant |
| Routes are `/editor-v2` and `/en/editor-v2` | both are separately reachable and noindex; TanStack file-route naming remains the documented kebab-case exception |
| Presentation is split between a thin hook and page-owned components | the runtime composition root proved to be browser infrastructure rather than a React provider; one component per file and selector-only workflow reads remain intact |
| Raw `<img>` exists only in `image.tsx` | `FRONTEND_CONVENTIONS.md` explicitly reserves this implementation exception for the Image primitive |
| Platform globals exist only in named adapters | Worker, object URL, decode, capability, env, and performance access require real browser boundaries; callers consume typed ports |
| XState upgraded from the earlier research snapshot | npm stable versions `xstate@5.32.5` and `@xstate/react@6.1.0` are mutually compatible and support React 19; implementation follows current `setup()`/selector APIs |
| TypeScript 7 deferred | npm stable is `7.0.2`, but current `typescript-eslint@8.65.0` and its canary require TypeScript `<6.1.0`; Phase 33 keeps `6.0.3` rather than putting mandatory lint outside its supported peer contract |
| Comlink, workerpool/threads.js, Konva/Fabric/Pixi, MSW, and web-vitals deferred | no measured Phase-33 deficiency justifies dependency/prototype cost; they are not installed, benchmarked, or compared |

No other deviation from `FRONTEND_CONVENTIONS.md` is approved. OffscreenCanvas,
PerformanceObserver, User Timing, Playwright, and Vitest are selected platform/existing-tool
boundaries rather than candidates.

### 11.10 First-slice shared utility inventory

The inventory is consumer-led. “R2 owner” means the capability is part of the production worker
adapter and must not be pre-created as a generic helper in `shared/lib`.

| Concern | Decision | Public owner / evidence |
|---------|----------|-------------------------|
| class merge | reuse | repository-wide `@/shared/lib` exports the existing `cn` (`clsx` + `tailwind-merge`); v2 Typography/Image consume it and conflict behavior is tested |
| storage / persisted JSON | reuse when needed, not consumed in Phase 33 | existing `@/shared/lib/storage` owns SSR-safe localStorage and guarded JSON with tests; v2 adds no persistence key and therefore imports neither |
| router | reuse when a v2 consumer needs imperative route state | existing `@/shared/lib` exports `useRouter`; the file route itself needs no router hook, so no v2 wrapper is added |
| browser capability | R2 owner | `runtime-browser/browser-capabilities.ts` reports Worker, OffscreenCanvas, WebGPU/WASM and support flags through one tested adapter; no component probes globals |
| encoded image metadata | reuse | `@/shared/lib` exports tested `inspectEncodedImageDimensions`; import validation may consume it without decoding pixels |
| full image decode/transform | R2 owner | full-resolution decode and transform stay in the production worker adapter; no main-thread decode helper is created |
| object URL | v2-owned complete | `artifact-url-adapter.ts` is the sole native URL owner; `ArtifactRepository` owns URL leases/revocation and tests all cleanup paths |
| abort/error | v2-owned complete | `LocalProcessingGateway` owns AbortController linkage and normalizes typed processing terminal outcomes; no generic error-catcher utility is introduced |
| worker access | rewrite in R2 | legacy `useWorkerLifecycle` is React/request-ID specific and is not reused; v2 uses one native typed worker factory/client behind `ProcessingGateway` |

Direct `import.meta.env`, runtime globals, object URLs, worker construction/messaging, decode, and
performance observation remain forbidden outside the named owners. This table authorizes no blanket
legacy migration: existing legacy call sites remain governed by the prospective-only convention.

## 12. Decision log and research basis

| Decision | Basis |
|----------|-------|
| Actor model for workflow ownership | XState v5 supports parent/child actors, invoked actors, snapshots, and selector-based React subscriptions. Cancellation still has to be implemented by adapters. |
| TanStack Query only for server state | Query cancellation uses a consumed `AbortSignal`; mutations do not receive automatic cancellation. This fits remote resources, not local image editing. |
| Fastify as backend candidate | Current Fastify guidance supports encapsulated plugins, schema-based typed routes, lifecycle hooks, and injection testing. GPU inference remains a separate internal worker. |
| No binary state in state managers | avoids accidental cloning, serialization, broad subscriptions, and unbounded cache retention |
| Parallel vertical-slice migration | preserves a working fallback and makes each domain boundary testable before feature breadth returns |
| Native typed Worker protocol as Phase-33 choice | preserves explicit correlation, progress, transfer, cancellation, terminal outcomes, and resource ownership without spending the foundation phase on library prototypes |
| Isolated fixture-driven tests | Playwright browser contexts and typed fixtures provide deterministic setup/teardown; component/page objects are used narrowly to remove stable duplication |
| Rebuilt v2 performance harness | current scripts contain useful probes but duplicate orchestration and mix mock/real/host-specific claims; shared typed collectors/reports make evidence comparable |

Primary references (package versions are verified against npm at implementation time):

- [XState actors and invoked services](https://github.com/statelyai/xstate/blob/xstate@5.32.5/docs/guides/actors.md)
- [XState React actor-selector tests](https://github.com/statelyai/xstate/blob/main/packages/xstate-react/test/useActorRef.test.tsx)
- [TanStack Query cancellation](https://github.com/TanStack/query/blob/v5.90.3/docs/framework/react/guides/query-cancellation.md)
- [TanStack Query mutations](https://github.com/TanStack/query/blob/v5.90.3/docs/framework/react/guides/mutations.md)
- [Fastify encapsulation](https://github.com/fastify/fastify/blob/main/docs/Reference/Encapsulation.md)
- [Fastify TypeScript](https://github.com/fastify/fastify/blob/main/docs/Reference/TypeScript.md)
- [Playwright fixtures](https://github.com/microsoft/playwright/blob/v1.61.0/docs/src/test-fixtures-js.md)
- [Playwright page-object guidance](https://github.com/microsoft/playwright/blob/v1.61.0/docs/src/pom.md)
- [Web Workers and transferable ownership](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers)
- [OffscreenCanvas worker rendering](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvasRenderingContext2D)
- [Comlink RPC and transfer/release semantics](https://github.com/GoogleChromeLabs/comlink)
- [workerpool cancellation, events, and transfers](https://github.com/josdejong/workerpool)
- [Vitest test context and fixtures](https://vitest.dev/guide/test-context)
- [web-vitals measurement API](https://github.com/GoogleChrome/web-vitals)

## 13. Open decisions — deliberately deferred

- exact backend framework after a focused spike;
- auth and payment providers;
- database access library/migrations;
- Redis versus PostgreSQL-backed job queue;
- object-storage provider and region;
- server model families and commercial licenses;
- whether remote job progress needs SSE beyond polling;
- exact v2 route/feature-flag exposure during migration.
- whether a later measured deficiency justifies Comlink, workerpool/threads.js, a canvas framework,
  or another worker/rendering library.

These do not block the first local v2 vertical slice because every future integration sits behind a
port defined at the application boundary.

## 14. Phase-34 Manual Cutout and history boundary

Phase 34 preserves the single document actor as the only committed-workflow writer. The actor owns
one `ManualCutoutDraft` descriptor, the committed `DocumentHistory`, revision checks, and the
cancellable invoked Apply. It never owns alpha planes, brush patches, blobs, canvas values, or URLs.

The two histories have deliberately different owners:

- `ManualDraftEngine` owns mutable source-space alpha and at most 20 dirty-rectangle gesture patches.
  Pointer cancel restores the in-progress gesture; draft Undo/Redo never changes document revision.
- The document actor owns at most 20 atomic operations and 96 MiB of retained historical artifacts.
  Apply adds exactly one `manual-cutout` operation; Cancel adds none; document Undo/Redo increments
  revision and invalidates stale work.

`ArtifactRepository` represents baseline/current/preview/export/run/manual-draft/history reachability
as independent leases. A Manual Apply first registers a draft matte under the draft owner, invokes a
dedicated `MANUAL_CUTOUT_COMMIT` worker operation, then atomically moves the returned matte/composite
to document and history ownership. The worker only decodes, composites, and encodes; it has no model
configuration or inference branch. Pruning and redo invalidation release operation owners only after
the remaining document/history graph is retained.

Legacy audit outcome: the reusable signal was limited to pure brush geometry, deterministic hardness
falloff, source-space interpolation, dirty rectangles, and the proven 20-step/96-MiB limits. Those
policies were rewritten behind v2 module boundaries. No legacy React hook, editor store, worker
lifecycle, workflow state, or component crosses into v2.

## 15. Phase-35 Magic Cutout and second-tool boundary

Phase 35 keeps the document actor as the only committed-workflow writer and adds one discriminated
active-tool descriptor. Manual and Magic do not share mutable runtime draft storage: each controller
owns its tool-specific engine/repository, while `EditorSession` composes them behind a thin route-
lifetime facade. A common helper or lifecycle contract is extracted only when both tools use it;
inheritance, a generic event bus, a catch-all utility layer, and a stateful god-service are excluded.

Magic has three deliberately separate lifecycles:

1. **Draft input:** Keep/Remove strokes mutate only a runtime draft. The live draft is capped at 50
   strokes, each committed stroke at 512 simplified source-space points, with bounded local
   Undo/Redo. Each mutation increments `draftRevision`.
2. **Prediction:** an explicit user action encodes the source as needed and requests candidates.
   Embeddings, prompts/constraints, candidate mattes, and preview pixels remain runtime-owned. A
   result may publish only when `{ documentId, draftId, runId, expectedRevision, draftRevision }`
   still matches; cancellation, further input, document revision changes, and disposal make it
   stale. Prediction never increments document revision or history.
3. **Commit:** explicit Apply materializes the selected candidate through an off-main-path commit
   adapter and asks the document actor to create exactly one `magic-cutout` history operation.
   Failure retains the draft for retry/cancel; Cancel releases Magic ownership without changing the
   committed snapshot, revision, history, or redo branch.

Automatic removal and Magic may keep distinct typed protocols and model sessions, but both enter one
runtime `HeavyJobCoordinator`. It owns admission order, truthful queued state, cancellation, and the
one-heavy-model-job limit; a tool-specific worker cannot initialize or infer outside it. Manual's
non-inference commit worker remains outside the heavy-model lane while still obeying artifact,
correlation, cancellation, and disposal contracts.

The legacy guided-selection implementation is research input, not an adapter target. Pure stroke
sampling, source-coordinate prompt construction, semantic constraints, candidate ranking/fusion,
and bounded local history may be rewritten with focused tests. Legacy React hooks, component state,
mutable refs, worker lifecycle, and first-stroke warm-up semantics do not cross the v2 boundary.

### 15.1 Ownership and module map

| Concern | Owner | Contract |
|---------|-------|----------|
| committed snapshot, revision, active-tool descriptor, history | document actor | sole writer; IDs and bounded metadata only |
| route/session composition | `EditorSession` | thin facade; delegates, subscribes, and disposes collaborators |
| Manual mutable alpha/patches | Manual controller + draft repository | existing Phase-34 behavior; no Magic state |
| Magic strokes/prompts/draft revision | Magic controller + draft repository | bounded runtime state; actor receives metadata updates only |
| embeddings/model session/candidate buffers | Magic prediction runtime | never exposed through React/XState or generic artifacts until candidate preview registration |
| automatic and Magic heavy-job admission | `HeavyJobCoordinator` | one model init/inference globally; cancellation and truthful queue ownership |
| matte-to-snapshot materialization | shared snapshot committer | second-consumer extraction from Manual; no inference/model dependency |
| preview/history/document binary reachability | `ArtifactRepository` | independently auditable leases and deterministic release |
| canvas/input semantics | tool presentation adapter | source coordinates, pointer capture, at most one committed stroke per gesture |

Controllers/services are composed objects only where they own state or lifecycle. Pure point
simplification, constraints, ranking, fusion, and transition decisions remain functions in named
capability modules; they are not wrapped in classes for visual uniformity.

### 15.2 Magic lifecycle and stale-result matrix

| Current state | Input/result | Accepted result | Stale/rejected behavior |
|---------------|--------------|-----------------|-------------------------|
| committed result | Begin Magic at current revision | clean draft, revision 0 | other active draft or wrong revision rejected |
| ready/dirty draft | pointer gesture | one bounded stroke; increment draft revision | cancelled/lost gesture adds nothing |
| dirty/preview draft | Predict | correlated queued/encoding/predicting run | no strokes, active run, or stale baseline rejected |
| predicting | draft mutation/cancel/reset | cancel run and invalidate its draft revision | late progress/terminal cannot publish |
| predicting | matching candidates | runtime registers candidates; actor stores summaries/selection | foreign run/document/draft or mismatched revision releases outputs |
| preview | select/refine | select ID or invalidate preview and increment draft revision | unknown candidate rejected |
| preview | Apply | one invoked snapshot materialization | wrong baseline/draft/candidate rejected |
| applying | matching success | one `magic-cutout` history commit; increment document revision | duplicate/late success released |
| applying | retryable failure | retain draft/candidate and expose error | committed state/history unchanged |
| any Magic draft | Cancel | release draft/run/candidate/preview owners | committed state/history/revision unchanged |

Document Undo/Redo is unavailable while either tool draft is active. Magic Undo/Redo changes only
its stroke history and `draftRevision`; it cannot move committed history. Apply and Cancel remain
the only exits that respectively commit or discard a draft.

### 15.3 Legacy signal audit

| Legacy signal | Phase-35 decision |
|---------------|-------------------|
| `GUIDED_MODEL` immutable ID/revision/dtype/size/path/license | move behind the existing shared production-model config with backward-compatible legacy import |
| source-space sampling and minimum-distance simplification | rewrite as pure Magic geometry policy with 512-point cap |
| Keep/Remove semantic strokes and prompt coordinates | rewrite as typed framework-free values/policies |
| refinement constraints that make Keep additive and Remove subtractive | rewrite and test against non-uniform baseline mattes |
| multiple decoder candidates, score ordering, and directional fusion | rewrite as deterministic policy; candidate bytes stay runtime-owned |
| bounded local draft Undo/Redo | rewrite with independent 50-stroke live/history bounds |
| `use-object-selection.ts`, `use-guided-cutout.ts`, React refs/state | reject; no import or adapter |
| first-stroke model encode and shared busy label | reject; only explicit Predict enters the heavy-job lifecycle |
| legacy worker construction/message/reset/dispose lifecycle | reject; v2 owns a correlated versioned protocol and disposal |
| raw `SourceImage`/`AlphaMatte` transfer in UI-facing types | reject; runtime checkout/transfer and opaque IDs only |

### 15.4 Performance and evidence contract

Phase-35 typed stages add `magic-queued`, `magic-model-loading`, `magic-encode`,
`magic-predict`, `magic-candidate-register`, and `magic-commit`. Marks use the existing
`v2:<runId>:<stage>:start|end` registry; free-form page marks are forbidden. Reports distinguish
automatic and Magic queue delay, cold/warm model state, draft revision, candidate count, gateway
kind, and supported/unsupported interaction signals without recording points or image data.

Acceptance retains zero application-attributable long tasks of at least 50 ms and interaction-to-
next-paint p95 below 100 ms on target evidence. It additionally requires one admitted heavy model
job, zero missed scroll/control/stroke actions during every Magic stage, zero inference on Apply/
Undo/Redo/export, bounded live draft/candidates, and zero reachable Magic leases/model sessions/
workers after repeated cancel/reset/dispose churn.

## 16. Phase-36 Background and Enhancements boundary

Phase 36 completes the isolated single-document finishing workflow without introducing one generic
tool runtime. The document actor remains the sole committed-state writer and gains only bounded,
discriminated Background/Enhancement metadata. Binary draft values, prepared background images,
intermediate mattes/foregrounds, preview URLs, model sessions, and worker values remain owned by
browser-runtime collaborators.

Committed snapshots now contain a `BackgroundFillDescriptor`. Transparent/colour/gradient values
are validated scalar metadata; a custom image is an `ArtifactId`. The descriptor is part of every
baseline/current/history snapshot so Undo/Redo and reopening Background restore truthful state
without inspecting composite pixels. Automatic removal initializes transparent; Manual, Magic, and
Enhancement commits preserve the current descriptor; Background Apply replaces only the descriptor
and composite/PNG values.

### 16.1 Ownership and module map

| Concern | Owner | Contract |
|---------|-------|----------|
| committed snapshot/background, revision, active draft, history | document actor | sole writer; IDs and bounded metadata only |
| route/session composition | `EditorSession` | delegates commands/subscriptions/disposal; no tool buffers or orchestration state |
| Background fill/draft revision and preview lease | Background controller + draft repository | one baseline-bound draft; preview never changes export/history |
| custom background bytes/preparation | Background preparation worker + `ArtifactRepository` | JPEG/PNG/WebP, 20 MiB, 4096 px; replace/cancel/stale/dispose cleanup |
| Enhancement selection/run sequencing | Enhancement controller + operation registry | fixed `fine-detail` then `colour-halo`; one captured baseline and terminal publication |
| matte refinement/model session/intermediate matte | fine-detail worker runtime | correlated transferable values; no partial document publication |
| foreground cleanup/intermediate foreground | colour-halo worker runtime | matte stays alpha authority; output remains run-owned until commit |
| automatic/Magic/Enhancement heavy admission | `HeavyJobCoordinator` | one admitted model/memory-heavy job; FIFO, truthful queue, cancellation |
| snapshot compositing/PNG materialization | shared versioned snapshot committer | Manual/Magic/Background/Enhancement consumer; no model/session ownership |
| document/history/draft/run/preview/export reachability | `ArtifactRepository` | independent leases and deterministic release/pruning |
| tool controls/focus/announcements | focused presentation adapters | selector-only reads and intent commands; no workflow truth |

Stateful controllers are composed services because they own a draft/run lifecycle and explicit
disposal. Fill normalization, descriptor equality, operation ordering, deterministic fusion,
foreground cleanup decisions, and transition policies remain named pure functions. There is no
base tool class, shared mutable draft store, generic event bus, or catch-all service; shared code is
limited to the already-proven artifact, heavy-job, and snapshot-materialization boundaries.

### 16.2 Background lifecycle and stale-result matrix

| Current state | Input/result | Accepted result | Stale/rejected behavior |
|---------------|--------------|-----------------|-------------------------|
| committed result | Begin Background at current revision | draft seeded from committed descriptor | active draft or wrong revision rejected |
| ready/dirty draft | choose scalar fill | increment draft revision; replace preview lease | invalid colour/gradient rejected; no encode/commit |
| ready/dirty draft | choose custom image | correlated preparation; prepared artifact becomes draft-owned | invalid/oversize/failed/late output released |
| dirty draft | Apply | one correlated snapshot materialization | clean/stale/busy draft rejected |
| applying | matching success | one `background` history operation and revision increment | duplicate/late result released |
| applying | failure | retain valid draft and expose retryable error | committed descriptor/composite unchanged |
| any Background draft | Cancel/reset/dispose | release prepared image and preview owners | committed snapshot/history/export unchanged |

Preview rendering may use CSS/canvas composition and leased URLs, but must not encode a PNG on each
selection. Export always reads the committed composite. Background Undo/Redo swaps already-
materialized snapshots and descriptor/artifact leases; it never reruns preparation or compositing.

### 16.3 Enhancement lifecycle and stale-result matrix

| Current state | Input/result | Accepted result | Stale/rejected behavior |
|---------------|--------------|-----------------|-------------------------|
| committed result | Begin Enhancements at current revision | draft with registry defaults | active draft or wrong revision rejected |
| ready draft | change selection | bounded scalar metadata only | empty selection cannot Apply |
| dirty draft | Apply | one correlated run queued through heavy coordinator | stale baseline or active run rejected |
| queued/running | progress/stage result | runtime advances fixed registry sequence | foreign/late/cancelled event cannot publish |
| running | all selected stages complete | materialize one final snapshot once | intermediate artifacts remain run-owned |
| applying | matching changed result | one `enhance` history operation and revision increment | duplicate/late success released |
| applying | matching no-op | no revision/history change; release intermediates | never represented as a successful commit |
| queued/running/applying | cancel/failure | retain valid draft for retry/cancel; release run outputs | committed state and redo branch unchanged |
| any Enhancement draft | Cancel/reset/dispose | cancel admission/worker and release draft/run owners | late terminals are stale and released |

The entire selected Enhancement sequence observes one baseline. `fine-detail` may replace the matte;
`colour-halo` may replace the foreground while using the latest runtime matte, but neither stage is
visible to the actor until final materialization succeeds. Safe no-op detection compares artifact-
independent result semantics before document publication.

### 16.4 Legacy signal and performance contract

Reusable legacy input is limited to validated fill presets/normalization, pinned refinement model
configuration, trimap/focus-crop/runtime policies, deterministic fusion, edge cleanup, foreground
estimation, and tested quality thresholds. These are rewritten or extracted as framework-free pure
modules with backward-compatible legacy imports. Legacy React hooks, tool panels, refs, mutable
workspace state, and worker lifecycle never cross into v2.

Typed Phase-36 stages add `background-image-prepare`, `background-preview`, `background-commit`,
`enhancement-queued`, `enhancement-model-loading`, `enhancement-fine-detail`,
`enhancement-colour-halo`, and `enhancement-commit`. Evidence retains the Phase-33 interaction/long-
task budgets and records cold/warm model state, queue delay, fallback, selected operation IDs, no-op
outcome, and resource counts without filenames, colours, images, pixels, or other user content.
Acceptance requires one admitted heavy job, no preview/export confusion, no partial Enhancement
publication, no reinference on Background Apply/history/export, and zero reachable finishing-tool
leases/sessions/workers after repeated cancel/reset/dispose churn.

## 17. Phase-37 Batch and Multi-Document Boundary

Phase 37 removes the initial one-document guard by completing the actor tree already established in
Phase 33. The workspace actor becomes a real parent coordinator, but never becomes a second source
of document truth. It owns ordered membership, selection, aggregate bounded status, and child
lifecycle; each existing document actor continues to own its revision, processing correlation,
active draft, committed snapshot, history, and error.

### 17.1 Composition and ownership

| Concern | Owner | Contract |
|---------|-------|----------|
| ordered IDs, selected ID, child actor spawn/stop | workspace actor | bounded metadata and actor refs only; no files, pixels, URLs, tool state, or history copies |
| pending/failed item identity, import preparation and per-file terminal | workspace import coordinator | runtime-only item ID before `DocumentId`; independent correlated preparation; invalid/late results cannot affect siblings |
| per-document projections/controllers/subscriptions | document runtime | one lifecycle object per document; owns tool adapters and delegates commands to its actor |
| runtime membership and selected-document facade | editor workspace session | composes workspace actor, document-runtime registry, global collaborators, and subscriptions |
| automatic/Magic/Enhancement admission | one workspace `HeavyJobCoordinator` | FIFO, one admitted heavy job globally, cancellation by document/run owner |
| source/result/history/tool artifacts and URLs | `ArtifactRepository` | document-scoped owners; remove releases only one reachability graph, dispose releases all |
| batch list/filmstrip and selected editor | presentation | selector/external-store reads plus intent commands; no duplicated workflow state |
| selected PNG and Download All ZIP | export coordinator + download adapter | committed artifacts only; deterministic names/timestamps; no inference or hidden source metadata |

`EditorSession` must not grow a map-shaped version of every existing field. Split its current
single-document lifecycle into a focused per-document runtime and keep the workspace-facing session
as a composition facade. This is composition, not inheritance: document runtimes share explicit
global collaborators but own independent controllers, projections, subscriptions, and disposal.

### 17.2 Actor and runtime lifecycle

```text
editorV2WorkspaceActor
  +-- editorV2DocumentActor:<documentId A>
  +-- editorV2DocumentActor:<documentId B>
  +-- editorV2DocumentActor:<documentId N>

editorWorkspaceSession
  +-- documentRuntime:<documentId A>
  +-- documentRuntime:<documentId B>
  +-- documentRuntime:<documentId N>
  +-- shared ArtifactRepository / HeavyJobCoordinator / worker gateways
```

Each selected input first receives a runtime-owned `WorkspaceItemId`; an invalid/pending item is not
a fake document and never spawns a child. Registration spawns one stable-ID child and one matching runtime only after source preparation and
artifact registration succeed. Selection changes only `selectedDocumentId`; it does not recreate,
stop, decode, infer, materialize, or transfer the child/runtime. Removing a document first
invalidates its queued/running correlations, then disposes its tool runtimes/projections, stops its
child, and releases its document-owned artifact graph. Workspace dispose applies that sequence to
every child before disposing shared workers/coordinators/repositories exactly once.

A document may continue queued/running work while unselected. Its progress and terminal remain
owned by its actor/runtime and update only its bounded summary. Selecting it later projects the
already-owned state. A retained dirty tool draft remains attached to that document; selection does
not silently apply or cancel it. Remove/reset/navigation uses the existing explicit dirty-draft
guard before destroying its owner.

### 17.3 Batch state and scheduling

Workspace summaries contain item ID, optional document ID, local display label, status, safe error,
and bounded progress only. Aggregate counts/queue positions are derived selectors, not independently mutable
truth. The heavy-job coordinator remains the sole admission authority across every document and
tool. A workspace owns at most 20 live items (pending, failed, or registered) and admits at most two import preparations at a
time; the existing 512 MiB artifact-repository budget remains the stricter byte-level authority.
Overflow is rejected before file/artifact ownership. Import decode/preparation cannot create an
unbounded `Promise.all`, duplicate the model queue, or hold transferable pixels in the actor.

Retry creates a fresh run for one failed document at its current source/revision. Add-image appends
new children without resetting existing actors, workers, histories, selection, or tool settings.
One crash may terminalize work owned by the crashed shared worker boundary, but recovery and retry
must preserve unaffected committed documents and must not relabel a stale terminal for a new run.

Automatic, Magic, and Enhancement gateways are shared at the workspace boundary rather than
multiplied per document. Their request/cancel/reset APIs must be document/run-scoped: removing one
owner cannot terminate or relabel a sibling's queued/active work. Shared gateways retain at most the
already-proven bounded warm worker/session lifecycle instead of one model session per document.

### 17.4 Export and evidence

Selected export delegates to the selected document's existing committed PNG effect. Download All
leases the current committed PNG artifact of each completed document for the duration of one
client-side ZIP operation, emits collision-safe privacy-neutral names with fixed timestamps, skips
unfinished/error items truthfully, and releases every temporary lease/URL on success, failure, or
cancel. ZIP creation is runtime work behind a narrow port; React receives progress/terminal metadata
only.

Acceptance adds randomized multi-document actor/runtime churn, cross-item stale-result matrices,
selection-without-reinference assertions, isolated draft/history restoration, global heavy-job FIFO
evidence, per-item retry/remove cleanup, deterministic ZIP contracts, bilingual mocked E2E, one
serialized real multi-document smoke, and affected Windows target-device evidence. No retry-masked
flake, arbitrary sleep, sibling mutation, unbounded import/scheduling, or residual document runtime
may pass.
