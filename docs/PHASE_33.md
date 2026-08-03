# PHASE 33 — Editor v2 Foundation & First Vertical Slice

## Phase Metadata

| Field | Value |
|-------|-------|
| Phase | `33` |
| Title | Editor v2 Foundation & First Vertical Slice |
| Status | `✅ done` |
| Tag | `v0.33.0` |
| Depends on | PHASE_32 closed-incomplete by architect exception; no gate dependency |

---

## Phase Goal

Implement `docs/ARCHITECTURE_V2.md` as one separately reachable, fully tested local slice: choose
one image → prepare → remove background → preview → export PNG. Build its presentation and shared
foundation afresh—including Typography, optimized Image, and SSR-safe environment/runtime
wrappers—under the hard rules in `docs/FRONTEND_CONVENTIONS.md`. Prove workflow ownership, artifact
lifetime, worker isolation, and responsiveness on the architect's affected browser/device before
migrating any other editor capability. Keep the legacy editor available for comparison/rollback.

---

## Scope

### Other

- [x] `T1` Freeze the Phase-33 actor hierarchy, commands/events, legal transitions, artifact
  ownership, processing port, worker protocol, shared/config/UI boundaries, performance marks, and
  exclusions from `ARCHITECTURE_V2.md`. Add a file-by-file `FRONTEND_CONVENTIONS.md` compliance
  matrix, test-architecture map, performance-signal inventory, and every evidence-driven deviation.
  Record Comlink, workerpool/threads.js, canvas frameworks, MSW, and web-vitals as deferred
  candidates only: do not install, prototype, benchmark, or integrate them in this phase. Treat
  OffscreenCanvas, PerformanceObserver, User Timing, Playwright, and Vitest as the already selected
  platform/existing-tool boundaries — _Depends on:_ —
- [x] `T2` Baseline the legacy single-image flow on the architect's affected browser/device:
  import event-to-next-paint, long tasks, scroll/control response during model creation/inference,
  stage timings, GPU path, artifact leases, and cancellation. Headless-host evidence alone cannot
  satisfy this task — _Depends on:_ `T1`

### Domain and application

- [x] `D1` Add framework-free v2 IDs, snapshots, commands, events, processing contracts, artifact
  metadata, and capability types. Actor/domain snapshots contain IDs and small metadata only—never
  blobs, bitmaps, pixel/tensor buffers, object URLs, React values, workers, HTTP clients, or model-
  provider values — _Depends on:_ `T1`
- [x] `D2` Implement pure document transitions: one writer, one active commit, `{ documentId,
  runId, expectedRevision }` correlation, stale/cancel rejection, explicit terminal outcomes, and
  deterministic cleanup. Reject illegal commands as typed outcomes — _Depends on:_ `D1`
- [x] `D3` Implement XState v5 workspace/document actors and narrow React selectors. Workspace owns
  session selection and spawns one actor per image; each document actor owns import/removal state.
  React lifecycle is an adapter signal, not workflow truth — _Depends on:_ `D2`
- [x] `D4` Define a backend-neutral `ProcessingGateway` with progress, abort/cancel, terminal result,
  and release semantics. Implement only the local gateway; add no account, payment, upload, HTTP,
  remote job, or provider code — _Depends on:_ `D2`

### Browser runtime

- [x] `R1` Implement `ArtifactRepository`: opaque IDs, run/document leases, centralized object URLs,
  deterministic disposal, memory statistics/budget, and development assertions for leaks, double
  release, and access after release — _Depends on:_ `D1`
- [x] `R2` Implement one typed Phase-33 worker protocol and bounded local gateway for prepare →
  automatic removal → composite/encode. Correlate messages, transfer eligible buffers, expose stage
  timings, cancel between stages, recover from worker crash, and default to one heavy GPU job. Reuse
  immutable model configuration through a pure boundary, never legacy React hooks/state —
  _Depends on:_ `D4`, `R1`
- [x] `R3` Keep full-resolution decode, transforms, post-processing, compositing, and PNG encoding
  outside the main interaction path. Model preparation is distinct from document commit. Global
  backpressure must keep page scroll and unrelated controls responsive — _Depends on:_ `R2`
- [x] `R4` Establish a reusable typed performance subsystem: stage-mark registry, browser collector,
  support/capability reporting, resource probe, versioned JSON schema, percentile/budget evaluator,
  deterministic adapter, and one orchestration shell. Review v1 profiling scripts signal by signal;
  port useful probes without copying duplicated orchestration or claiming mock/CDP results as
  cross-browser truth — _Depends on:_ `R2`, `T2`

### Shared frontend foundation

- [x] `S1` Refactor the repository-wide `shared/config` boundary into typed `env.ts` and
  `runtime.ts`, adapted from `patient_tracker/frontend/app/shared/config`. Only these modules may
  read `import.meta.env`; server/client values are separated and validated, runtime detection is
  SSR-safe and dynamically testable, server secrets cannot enter client output, and existing
  legacy imports remain compatible — _Depends on:_ `T1`
- [x] `S2` Add v2 `Typography` and `Image` primitives with public APIs and tests. Typography owns a
  finite semantic/visual variant registry without confusing heading level and appearance. Image
  owns typed content/hero/preview/thumbnail presets, intrinsic/aspect/object-fit policy, accessible
  alt/decorative semantics, and deliberate loading/decoding/fetch-priority defaults; object-URL
  lifetime remains in `ArtifactRepository` — _Depends on:_ `S1`, `R1`
- [x] `S3` Inventory the first slice's cross-cutting needs and establish only consumed, tested
  wrappers/utilities under v2 `shared/lib` or the existing repository-wide public API: class merge,
  storage/JSON, router, browser capability, image metadata/decode, object URL, abort/error, and
  worker access. Record reuse versus rewrite; forbid direct platform access outside the owning
  wrapper and do not create speculative helpers — _Depends on:_ `S1`, `R1`
- [x] `S4` Add unit/component tests for every new shared config/runtime/UI/lib public API,
  including SSR without `window`, client/server env separation and invalid values, semantic
  Typography output, Image preset/accessibility/loading behavior, and wrapper failure paths. Assert
  v2 source contains no forbidden direct platform/env/image/worker access — _Depends on:_ `S2`, `S3`

### Frontend

- [x] `F1` Add a noindex, separately reachable bilingual v2 surface using the existing design
  system through the new v2 Typography/Image/shared primitives. Present only one-image upload,
  truthful progress, cancel/retry, preview, PNG export, and reset. UI sends commands/subscribes
  through selectors and owns no worker/run/artifact lifetime — _Depends on:_ `D3`, `R3`, `S4`
- [x] `F2` Distinguish preparing, model loading, queued, processing, cancelling, result, and error.
  Cancel reaches a terminal state; stale work cannot flash; scroll/unrelated controls work during
  heavy stages. Render no Cutout, Enhancements, Background, or batch control — _Depends on:_ `F1`
- [x] `F3` Export the committed composite through `ArtifactRepository` without reinference or a
  synchronous full-image reconstruction. Reset/remove releases all document/run/preview/export
  leases and retains a warm runtime only according to explicit policy — _Depends on:_ `F2`

### Verification and infrastructure

- [x] `I0` Add the v2 test foundation: typed Vitest builders/fixtures/fake clock and IDs; Playwright
  test extension with isolated setup/cleanup; worker/gateway scenario driver; narrow upload/progress/
  preview/export component objects; shared observable assertions; and a minimal declared image
  corpus. Prohibit arbitrary sleeps, order dependence, global mutable state, brittle CSS/XPath,
  hidden assertions in page objects, retry-masked flakes, and duplicated real-model coverage. Record
  suite/slow-test budgets and failure-only diagnostic policy — _Depends on:_ `T1`, `R4`
- [x] `I1` Add pure transition/invariant and model-based actor tests for all legal/illegal Phase-33
  paths: duplicate start, cancel at every stage, stale result, crash, retry, reset, unmount/remount,
  and release, using the deterministic builders, fake time/IDs, gateways, and repositories. Prove
  isolation and cleanup under repeated/randomized execution — _Depends on:_ `D3`, `D4`, `R1`, `I0`
- [x] `I2` Add worker/browser-adapter contract tests for correlation, transfer ownership, progress
  order, cancellation acknowledgement, crash recovery, exactly-one result, and zero reachable
  leases after repeated churn, using the production protocol and test adapters rather than a second
  mock state machine — _Depends on:_ `R3`, `I0`
- [x] `I3` Add bilingual deterministic Playwright through the v2 fixtures/component objects plus a
  separate serialized real-model smoke. Assert one automatic run, no duplicate export/inference,
  truthful cancel/retry, working scroll/unrelated controls during every heavy stage, and cleanup
  after churn. The mocked lane must remain parallel-safe, fast, zero-retry, and independent of
  model/CDN/WebGPU; traces and heavy diagnostics are retained on failure/retry only — _Depends on:_
  `F3`, `I1`, `I2`
- [x] `I4` Capture final target-device evidence: zero application-attributable main-thread tasks
  `>=50 ms`, pointer/scroll/control event-to-next-paint p95 `<100 ms`, no missed action, bounded
  artifact/resource counts after ten import/cancel/reset cycles, and no preview/export reinference.
  Produce the same versioned report shape for fake, real-model, cold/warm, and target-device runs;
  a failing budget, unsupported metric presented as zero, or reproduced freeze blocks migration —
  _Depends on:_ `I3`, `R4`
- [x] `I5` Run `/phase-gate 33`, production build/container smoke, dependency/license/model/security
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
src/v2/shared/ui/
src/v2/shared/lib/
src/v2/testing/
src/v2/testing/performance/
src/shared/config/env.ts
src/shared/config/runtime.ts
src/shared/config/index.ts
src/pages/editor-v2/
src/routes/dev.editor-v2.tsx
messages/ru.json
messages/en.json
e2e/phase-33-editor-v2.spec.ts
e2e/phase-33-editor-v2.real.spec.ts
e2e/support/v2/
scripts/profiling/v2/
package.json
pnpm-lock.yaml
docs/STACK.md
docs/PHASE_33.md
~~~

A minimal pure model/config module may be extracted from legacy inference code only to avoid
duplicate model assets; document that exception before touching legacy source.

### Do NOT touch

- Legacy behavior/workspace/Cutout/Manual/Enhancements/Background/batch/public routes, except the
  narrow pure model/config extraction and backward-compatible shared/config refactor above
- Accounts, auth, entitlements, billing, payments, databases, storage, queues, server uploads,
  remote processing, Python services, generated backgrounds, or public API
- Production model family/weights/revisions, CDN manifest, quality mapping, or privacy behavior
- Former Phase-33/34 accessibility/legal implementation
- Broad monorepo conversion, canvas framework, generic event bus, or legacy cleanup
- Comlink, workerpool, threads.js, Konva, Fabric, Pixi, MSW, web-vitals, or another third-party
  worker/RPC/pool/canvas/mock/performance dependency, prototype, or comparative benchmark

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

type TypographyVariant =
  | "display"
  | "heading-1"
  | "heading-2"
  | "heading-3"
  | "body"
  | "body-small"
  | "caption"
  | "label"
  | "code";

type ImagePreset = "content" | "hero" | "preview" | "thumbnail";
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
pnpm e2e:phase-33-real
pnpm build
```

Attach `I4` target-device trace and artifact audit. Fail on a freeze, missed action, timing-budget
failure, duplicate/stale result, binary actor/React state, leaked lease, skipped real-model smoke,
missing target-device evidence, retry-dependent E2E pass, arbitrary test sleep, unclean fixture,
duplicated real-model scenario, or performance report that hides unsupported metrics.

---

## Architect Review Notes

- [x] `AR-01` Replace the current flat, implementation-detail-heavy v2 layout with cohesive semantic
  modules where the code volume and dependency graph justify them. In particular, review
  `runtime-browser` as parent/core boundary with focused `editor-session`, `artifacts`, `processing`
  and platform-adapter submodules, and review equivalent `document`, `workspace`, and processing
  boundaries in `application`. Each module must expose a narrow public `index.ts`; external consumers
  must not deep-import its internals. Do not create one-file directories or generic `types`, `hooks`,
  `helpers`, `common`, or `utils` segments merely to make the tree symmetrical.
- [x] `AR-02` Add a durable module/implementation-role policy to `FRONTEND_CONVENTIONS.md` and apply it
  to touched Phase-33 code: pure domain decisions and transformations remain functions; XState
  orchestration remains typed machine/actor logic; objects with identity, mutable state, invariants,
  or explicit disposal may be classes; stateless platform adapters may remain factories. Prefer
  composition and delegation to cohesive collaborators/services over inheritance. A core facade may
  assemble or receive collaborators and coordinate a use case, but must not absorb their state and
  behavior into a new god object. Do not introduce a service/class when a named pure helper is the
  smaller honest abstraction.
- [x] `AR-03` Decompose `runtime-browser/editor-session.ts` by responsibility while preserving the
  `EditorSession` public contract and dependency-injection test seam. Keep production dependency
  assembly, image import/preparation, artifact/download effects, actor/session projection, and
  lifecycle cleanup independently understandable and testable. If a `BrowserEditorSession` class is
  introduced, it must be a thin stateful facade that delegates to injected cohesive collaborators;
  every mutable value and disposable resource must have exactly one explicit owner.
- [x] `AR-04` Remove the ambiguous duplicated status/error authority between `EditorSessionSnapshot`
  and the document actor. The current page-level repair
  `snapshot.error !== null && snapshot.actor !== null ? "error" : snapshot.status` must not be kept
  or explained only by a comment. Model pre-document import state separately from actor-owned
  document state (prefer a discriminated snapshot where it makes illegal combinations
  unrepresentable), and read active-document status/error/progress through narrow actor selectors.
- [x] `AR-05` Split `application/document-machine.ts` into a readable declarative machine core plus
  separately testable actor types, processing-run callback actor logic, and artifact-effect
  execution. Use XState v5 `setup()`/provided actor implementations and explicit invoked-actor
  lifecycle rather than wrapping the machine in an additional stateful service. Preserve actor
  hierarchy, correlation, cancellation acknowledgement, cleanup, and one-writer guarantees.
- [x] `AR-06` Split the large pure domain transition module along behavior boundaries: command
  decisions, domain-event transitions, and shared transition/correlation policies. Keep the public
  domain vocabulary framework-free and keep transitions pure; do not replace exhaustive typed
  functions with stateful classes. Preserve all legal/illegal/stale transition and invariant tests.
- [x] `AR-07` Decompose the large worker client/worker entrypoint only around real ownership boundaries:
  worker lifecycle, source transfer, protocol validation/correlation, output registration, pipeline
  stages, and error normalization. Keep `ArtifactRepository`, `LocalProcessingGateway`, and worker
  execution as focused stateful resource owners where classes clarify identity and disposal, but
  extract cohesive policies/collaborators instead of growing those classes or splitting by line
  count. Preserve the one-heavy-job policy, transfer semantics, stale-result rejection, deterministic
  release, and bounded worker disposal.
- [x] `AR-08` Use `<module>.types.ts` only for a vocabulary shared by multiple files in that module;
  keep implementation-local types beside their sole consumer and keep cross-layer domain contracts
  as direct named exports. Prefer modern ES-module type grouping (`import type` or
  `import type * as EditorSessionTypes`) over adding TypeScript `namespace` wrappers to ES modules.
  Update the existing namespaced-types convention accordingly. Use kebab-case semantic filenames,
  and use `*.config.ts` only for actual configuration/policy—not as a destination for arbitrary
  constants.
- [x] `AR-09` Replace the repeated hydration state/effect workaround on the v2 surface with a small,
  tested, SSR-correct `useIsHydrated`-style abstraction whose name documents that it represents
  completed client hydration, not generic browser detection. Preserve the explicit E2E readiness
  signal and verify server/first-client markup consistency without arbitrary timing or sleeps; do
  not expand this review into a mechanical legacy migration.
- [x] `AR-10` Rewrite the v2 `Typography` and `Image` implementations with idiomatic JSX, preserving
  their current semantic/accessibility/preset/ref contracts. Remove the `_prop` plus `void _prop`
  unused-variable workaround through a reviewed `@typescript-eslint/no-unused-vars`
  `ignoreRestSiblings` configuration scoped as narrowly as needed; do not weaken unrelated unused
  variable detection or add a speculative generic omit utility.
- [x] `AR-11` Remove nested ternary expressions from Phase-33 production code and replace inline
  bilingual branches with named presentation policies and the existing Paraglide message boundary
  where the value is user-facing copy. Enable the existing ESLint core `no-nested-ternary` rule for
  `src/v2` and the v2 page surface so the pattern cannot regress, without forcing an unauthorized
  repository-wide legacy rewrite. Prettier remains formatting-only and must not be treated as an
  architecture/readability check.
- [x] `AR-12` Give `useSyncExternalStore` stable `subscribe`, `getSnapshot`, and `getServerSnapshot`
  function identities without relying on an accidentally safe unbound method. The solution must
  remain correct if the session facade is class-based, preserve cached snapshot identity between
  publishes, and retain deterministic SSR/hydration behavior and cleanup tests.
- [x] `AR-13` Re-run and preserve all Phase-33 domain, actor, repository, worker, presentation,
  component, mocked E2E, real-model, performance, resource-churn, type, lint, architecture, build,
  and target-device guarantees after the structural refactor. Add focused tests for every extracted
  public module/service and ownership boundary; do not duplicate tests that only assert file
  placement. Once every review decision from `FIX_AFTER_REVIEW.md` is represented durably in code,
  lint, tests, and `FRONTEND_CONVENTIONS.md`, remove that temporary root review file.

## Implementation Notes

- Phase 32's host-specific timing did not predict the architect's browser. Target-environment
  evidence is therefore required product acceptance, not optional support.
- `R2` uses the phase's narrow legacy exception: immutable automatic-model profiles are extracted
  into a framework-free shared config module, while legacy imports remain backward-compatible; no
  legacy hook, worker state, quality mapping, model ID, revision, or weight changes.
- XState is pinned to `5.32.5` and `@xstate/react` to `6.1.0`. TypeScript `7.0.2` remains deferred:
  the installed `typescript-eslint` line declares TypeScript support only below `6.1.0`, so adopting
  TS 7 would put the mandatory lint gate outside its supported peer contract.
- Final I4 evidence uses the isolated Windows Chrome owned by Playwright MCP, not a CDP attachment
  to a personal browser. Cold/warm real-model runs passed responsiveness budgets, export caused no
  reinference, and ten acknowledged cancel/reset cycles ended at zero artifacts, leases, and object
  URLs. Worker-originated model Resource Timing remains explicitly unsupported in the page realm.
- I5 passed on 2026-08-03 under WSL2 with Node `24.13.0`, pnpm `11.10.0`, Docker `29.6.2`, and
  Docker Compose `5.3.1`. The complete repository gate, Phase-33 mocked and real-model lanes,
  production container/smoke, report verifier, dependency/license/model checks, and pinned Trivy
  filesystem/image scans were green. Durable browser/device/GPU evidence and limitations are
  recorded in `docs/audits/PHASE_33_RESULTS.md`.
- The architect completed the required manual affected-device verification on 2026-08-03 and
  accepted the v2 slice without a reproduced freeze.

## Atomic Commit Message

```text
feat(phase-33): establish editor v2 local vertical slice
```

## Post-Phase Checklist

- [x] Scope completed in dependency order
- [x] Automated gates, real-model smoke, and target-device evidence green
- [x] Architect verifies the affected browser/device without a reproduced freeze
- [x] Architect reviews the domain, shared/config, shared UI/utilities, SSR behavior, and
  `FRONTEND_CONVENTIONS.md` compliance; every review note is resolved
- [x] Architect review notes resolved
- [x] Run `/context-update 33`
- [x] Commit on `feat/phase-33`; tag `v0.33.0` only after merge
