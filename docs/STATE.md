# STATE: BG Remove App Development Tracker

> Compact source of truth for current phase status, implemented runtime contract, blockers, and
> current decisions. Full history through Phase 32 is preserved at
> [`archive/contracts/STATE_THROUGH_PHASE_32_FULL.md`](./archive/contracts/STATE_THROUGH_PHASE_32_FULL.md).
> Historical detail is evidence, not active scope.

## Status legend

`⏳ pending` · `🔄 in-progress` · `✅ done` · `⏹ closed-incomplete` ·
`⚠️ NEEDS_REVIEW` · `❌ blocked`

## Phase status

| Phase | Status | Tag / gate | Contract |
|-------|--------|------------|----------|
| 01–29 | ✅ historical done | `v0.01.0`–`v0.29.0`; gates passed | Completed legacy increments in [`archive/phases/`](./archive/phases/) |
| 30 | ✅ historical done | `v0.30.0`; gate not run by architect decision | Design system/redesign; T19–T21 deferred |
| 31 | ✅ historical done | `v0.31.0`; gate passed | Whole-project audit/refactor |
| 32 | ⏹ closed-incomplete | no tag; gate explicitly waived | Legacy stability work accepted with unresolved browser freezes |
| 33 | ✅ done | gate passed; no tag | Editor v2 foundation and first local vertical slice |
| 34 | ✅ done | gate passed; no tag | [`PHASE_34.md`](./PHASE_34.md): document history + Manual Cutout |
| 35 | ✅ done | gate passed; no tag | [`PHASE_35.md`](./PHASE_35.md): guided Magic Cutout |
| 36 | ✅ done | gate passed; no tag | [`PHASE_36.md`](./PHASE_36.md): Background + Enhancements |
| 37 | ✅ done | gate passed; no tag | [`PHASE_37.md`](./PHASE_37.md): batch + multi-document workspace |
| 38 | ✅ done | gate passed; blocked cutover result; no tag | [`PHASE_38.md`](./PHASE_38.md): validation complete; public cutover not authorized |
| 39 | ✅ done | gate passed; `v0.39.0` | [`PHASE_39.md`](./PHASE_39.md): v1-faithful main-page single-image flow on isolated v2 routes |
| 40 | ✅ done | gate passed; `v0.40.0` | [`PHASE_40.md`](./PHASE_40.md): v1-faithful batch workspace on isolated v2 routes |
| 41 | ✅ done | `v0.41.0`; gate passed | [`PHASE_41.md`](./PHASE_41.md): v1-faithful editor tools on isolated v2 routes |
| 42 | ✅ done | gate failed; architect waiver accepted; `v0.42.0` after merge | [`PHASE_42.md`](./PHASE_42.md): regression closure complete; cutover readiness remains blocked |
| 43 | ✅ done | gate passed; tag after merge | [`PHASE_43.md`](./PHASE_43.md): final public v2 cutover, legacy removal, and pre-production readiness |

**Latest closed phase:** `43`

**Implementation in progress:** `—`

**Only active implementation scope:** `—`. Phase 43 is the final completed pre-production phase.
Production deployment remains a separate authorized-operator workflow.

## Current contract

This section describes the accepted contract through Phase 43. The v2 runtime is the sole public
editor and includes automatic removal, Manual Cutout, guided Magic Cutout, Background,
Enhancements, document history, and a batch/multi-document workspace. The superseded legacy
workflow is deleted. See [`ARCHITECTURE_V2.md`](./ARCHITECTURE_V2.md) and
[`PHASE_43.md`](./PHASE_43.md).

### Runtime status

- Before Phase 43, the deployed legacy editor was anonymous and browser-local. Its accepted
  capabilities are now served by the v2 public editor; the legacy implementation is removed.
- Source images and derived pixels are not sent to an app backend; the app owns no account, payment,
  image API, database, or result storage.
- Phase 32 added structured batch errors, per-item edit scopes, worker run guards, upload preparation,
  and resource-lifecycle work.
- Architect verification still reproduces model-load/removal and Magic Apply freezes that block page
  scroll and controls. Phase 32 therefore did not satisfy its responsiveness goal.
- Phases 33–42 kept legacy available while v2 grew one accepted capability slice at a time; Phase
  43 ended that migration state.
- The noindex v2 surface implements one-image import, local automatic removal, preview, PNG export,
  truthful cancel/retry/reset, and deterministic artifact cleanup. Its gate and architect target-
  device verification passed without reproducing the legacy freeze.
- The same v2 surface now implements runtime-owned Restore/Erase drafts, local gesture Undo/Redo,
  atomic Manual Apply/Cancel, and actor-owned committed document Undo/Redo without reinference.
- Guided Magic Cutout now adds bounded source-space Keep/Remove strokes, explicit prediction and
  candidate preview/refinement, and one explicit artifact-aware Apply without inference during
  commit, Undo/Redo, export, or reset.
- Background now adds transparent, colour, gradient, and validated artifact-backed image drafts
  with immediate uncommitted preview and one atomic materialized Apply.
- Fine-detail and colour-halo Enhancements run in registry order through the shared heavy-job
  coordinator and publish one changed snapshot or a truthful no-op without partial commits.
- The v2 workspace now admits up to 20 independently owned documents, prepares at most two imports
  concurrently, preserves per-document drafts/history/settings during selection, and exports
  committed results through deterministic privacy-neutral ZIP assembly.
- Phase 38 adds versioned fail-closed readiness/parity reports, bilingual automated accessibility
  coverage, full-workflow deterministic and real-model evidence, and repeatable performance/resource
  verification. Its technical gate passed, while its accepted product conclusion remains `blocked`
  until v1-visible input, quality, export, layout, and target-device evidence gaps are closed.
- Phase 42 closes the presentation-era v2 regressions, records bilingual deterministic/real-model
  and native-Windows complete-product evidence, and retains a fail-closed `blocked` cutover result.
  The Phase-42 gate had one waived legacy Phase-32 upload-preparation timing failure (129 ms against
  `<100 ms`); public cutover remains unauthorized.
- SPEC v1.42 authorized Phase 43 as the final pre-production cutover contract: close public-path
  readiness evidence without a waived gate, bind every public/scenario editor route to v2, remove
  the legacy workflow by proven reachability, and rehearse rollback to the previous immutable
  release before deployment.
- Phase 43 completed that unconditional cutover. `src/widgets/public-editor` owns the sole
  route-neutral composition; roots and eight scenario routes use it, former v2 routes redirect by
  locale, and the legacy development harness and workflow graph are removed.
- The Phase-43 report concludes `ready` with zero blocker, missing evidence, serious accessibility
  finding, or reachable legacy entry. Full gate, real-model, managed-Windows, security, build,
  container smoke, and disposable immutable-release rollback evidence passed without waiver.

### Core models

```ts
type QualityMode = "fast" | "max";
type InferencePath = "webgpu" | "wasm";

interface SourceImage {
  blob: Blob;
  width: number;
  height: number;
  format: "image/jpeg" | "image/png" | "image/webp";
}

interface AlphaMatte {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

interface ProcessedImage {
  source: SourceImage;
  result: Blob;
  qualityMode: QualityMode;
}

type EditOperationKind = "cutout" | "manual" | "enhance" | "background";

interface EditDocumentScope {
  document: EditDocument;
  history: EditHistory;
  artifacts: EditorArtifactStore;
  workerOwnerId: string;
}

type BatchItemError = {
  code: string;
  message: string;
  detail: string;
  retryable: boolean;
};
```

Each successful single result and completed batch item owns an independent in-memory edit document,
artifact store, bounded committed history, tool drafts/settings, and preview state. Committed history
is limited to 20 entries / 96 MiB of avoidable historical artifacts. Async work is guarded by owner,
run, item, and revision identity; stale, failed, or cancelled work must not commit. Exact legacy
types and phase additions remain available in the archived full STATE.

The Phase-33 v2 contract adds opaque identity and correlation types (`DocumentId`, `ArtifactId`,
`RunId`, `Revision`), ID-only `DocumentSnapshot` values, in-process editor commands and terminal
processing events, and a backend-neutral `ProcessingGateway`. XState actors own workflow state;
`ArtifactRepository` owns binary artifacts, leases, object URLs, budgets, and disposal. The only
implemented gateway is the bounded local browser-worker adapter.

Phase 34 adds `ManualDraftId`, `EditOperationId`, `ManualCutoutDraft`, `DocumentHistoryEntry`, and
`DocumentHistory`. Actor snapshots retain only IDs and bounded metadata; full alpha planes and
dirty-rectangle gesture patches remain runtime-owned. Committed history is capped at 20 operations
and 96 MiB, while draft gesture history is independently capped at 20 patches.

Phase 35 extends that vocabulary with a discriminated active-tool draft,
`MagicDraftId`, `MagicCandidateId`, `MagicCutoutMode`, a monotonic Magic `draftRevision`, and
`"magic-cutout"` history entries. Source embeddings, prompts, candidate mattes, and preview pixels
remain runtime-owned; prediction correlates both committed baseline and draft revision before it can
publish, while actor snapshots contain only IDs and bounded metadata.

Phase 36 adds ID-only `BackgroundFillDescriptor`, `BackgroundDraft`, `EnhancementDraft`, and
finishing-tool command/event correlations. Background image bytes, preview URLs, Enhancement
baselines/intermediates, worker buffers, and model sessions remain runtime-owned. Duplicate or
stale Apply/Change commands cannot replace the immutable correlation of an in-flight operation.

Phase 37 adds `WorkspaceItemId`, ordered ID-only workspace membership/selection, exhaustive
`WorkspaceCommand` outcomes, bounded `WorkspaceItemSummary`/`EditorWorkspaceSnapshot` projections,
and `BatchExportSnapshot`. The workspace actor owns child lifecycle but never document truth;
per-document runtimes own controllers and local view state, while the artifact repository, one
FIFO heavy-job coordinator, gateways, and warm workers remain shared collaborators.

Phase 40 preserves `model-loading` as a distinct `WorkspaceItemStatus` projection instead of
collapsing it into generic processing; this is an additive presentation truth and does not change
the document actor or scheduling contract.

Phase 39 adds `AutomaticModelMode`, neutral `ExportSize`, `MainPageEditorProjection`, and
`MainPageEditorIntent`. The immutable projection includes runtime-owned dimensions, effective
model/path/fallback, revision/history availability, export lifecycle, admission error, and focus
restoration signals; presentation emits typed intents and never owns workflow state.

Phase 40 adds bounded `BatchMainPageItemProjection`,
`BatchMainPageProjection`, and `BatchMainPageIntent` presentation values over the already implemented
Phase-37 workspace runtime. Item summaries include the captured model mode; capacity rejection is an
explicit bounded presentation error. Files, pixels, workers, controllers, actors, and mutable
workflow state remain outside presentation snapshots.

Phase 41 adds immutable `EditorToolWorkspaceProjection` and typed
`EditorToolWorkspaceIntent` presentation values over the accepted tool controllers. Manual and
Magic canvas work stays behind bounded semantic interaction ports; pixels, canvases, pointer events,
mutable draft engines, actors, sessions, workers, and binary values remain outside controller-neutral
presentation.

Phase 42 versions the internal Magic worker protocol to `v2` so the current base matte crosses the
transferable boundary and candidate ranking/fusion remains off the interaction thread. It also adds
versioned privacy-safe Phase-42 readiness/performance evidence files; no domain command, public API,
endpoint, persistence, environment key, model policy, export format, or public route changes.

### Active endpoints and pages

There is no image-processing API.

| Method/surface | Current behavior |
|----------------|------------------|
| `GET /`, `GET /en` | Localized main page composing the sole v2 public editor |
| Four Russian scenario routes plus four `/en/...` routes | Localized scenario content composing the same v2 public editor |
| `/about`, `/en/about`, `/privacy`, `/en/privacy` | Static localized pages |
| `/dev/remove-background` | Removed; normal not-found response |
| `/dev/model-lab` | Internal noindex lab; active only with `VITE_ENABLE_MODEL_LAB=true` |
| `/editor-v2`, `/en/editor-v2` | Permanent locale-preserving redirects to `/` and `/en/` |
| `/sitemap.xml`, `/robots.txt`, `/.well-known/security.txt` | Discovery/security assets |
| `cdn.cutbg.art/models/{manifest-path}` | Immutable public model/runtime assets with CORS and byte ranges |

### Completed Phase-43 public cutover

- `/`, `/en`, and all localized scenario routes compose the accepted v2 editor while retaining
  existing content, locale, metadata, structured data, analytics, and accessibility contracts.
- `/editor-v2` and `/en/editor-v2` redirect to the matching public root; the legacy
  `/dev/remove-background` harness is removed, while the explicitly enabled model lab remains.
- Superseded legacy workflow code was deleted after retained entry-point reachability was proven.
  Rollback uses the previous immutable release rather than dormant legacy code.

### Persistence and ownership

- **App DB/tables/migrations/seeds:** none.
- **Browser tab memory:** source images, mattes, prompts, Magic embeddings/candidates/strokes,
  edits, composites, object URLs, histories, v2 actors/artifacts/runs, and exports.
- **`localStorage`:** legacy `qualityMode` only.
- **Cache Storage:** immutable public model and ONNX Runtime assets only; never user images/artifacts.
- **Umami PostgreSQL:** externally managed analytics schema, not app-owned persistence.
- **Operations:** bounded non-secret release/config records and approved operational backups exclude
  source images, masks, composites, and editor state.

### Environment

| Key | Ownership |
|-----|-----------|
| `VITE_MODEL_CDN_BASE_URL` | Public client model source configuration |
| `VITE_ENABLE_MODEL_LAB` | Public build-time lab flag; only exact `true` enables it |
| `VITE_UMAMI_SCRIPT_URL`, `VITE_UMAMI_WEBSITE_ID`, `VITE_CF_BEACON_TOKEN` | Public analytics configuration |
| `UMAMI_APP_SECRET`, `UMAMI_DATABASE_URL`, `POSTGRES_PASSWORD` | Server-only analytics service configuration |
| `APP_BUILD_ID`, `APP_COMMIT_SHA` | Production release identity |
| `PORT`, `NODE_ENV` | Standard server runtime |

Phases 33–39 added no key. Typed `shared/config/env.ts` and SSR-safe `runtime.ts` centralize access
without changing values or exposing server secrets.

### Current Editor v2 contract

The implemented v2 editor is public and local-processing-only:

- `src/v2/{domain,application,runtime-browser,presentation,shared/ui,shared/lib,testing}`;
- one workspace actor over ordered membership/selection and one document actor/runtime per image;
- IDs/revisions in domain state, binary values in `ArtifactRepository`;
- `{ documentId, runId, expectedRevision }` correlation and explicit terminal outcomes;
- backend-neutral `ProcessingGateway`, with only a bounded local worker adapter implemented;
- rewritten Typography/Image primitives and tested platform/config wrappers;
- bounded multi-image import → isolated local editing → selected PNG or deterministic ZIP export;
- fixture-driven modular Vitest/Playwright architecture with a fast deterministic lane, a small
  serialized real-model lane, and zero tolerance for retry-masked flakes or arbitrary sleeps;
- a typed reusable performance collector/report contract, with v1 profiling retained only after
  signal-by-signal validation;
- native typed Dedicated Worker/Canvas adapters as the Phase-33 implementation; OffscreenCanvas is
  capability-gated, while Comlink, worker-pool, and canvas libraries remain untested future
  candidates with no Phase-33 dependency or evaluation work;
- Manual Cutout with Restore/Erase, explicit Apply/Cancel, local gesture history, and committed
  document Undo/Redo;
- guided Magic Cutout with Keep/Remove, explicit Predict/preview/refinement/Apply/Cancel, bounded
  local stroke history, and globally serialized automatic/Magic model work;
- Background drafts for transparent/colour/gradient/custom image fills with explicit Apply/Cancel;
- fine-detail and colour-halo Enhancement drafts with ordered globally admitted heavy stages and
  atomic changed/no-op/failure/cancel outcomes;
- the complete v1-faithful result stage, toolbar, tool rail, Cutout Manual/Magic, Background, and
  Enhancements presentation on every bilingual public editor route through bounded projection,
  typed-intent, and tool-interaction seams;
- up to 20 live workspace items, at most two concurrent import preparations, and one globally
  admitted heavy job across all documents;
- no auth, billing, server upload, remote jobs, or generation;
- deterministic automated tests, serialized real-model smoke, and mandatory target-device evidence.

Further capabilities are not implied by this contract. Auth, billing, backend processing, and
production deployment remain separately authorized work.

The completed Phase-39 slice preserves the rendered v1 main-page UI while replacing its workflow
ownership with v2. `AutomaticModelMode`, `ExportSize`, `MainPageEditorProjection`, and
`MainPageEditorIntent` form the narrow presentation/controller contract. The isolated bilingual
noindex routes receive the first single-image slice; public/scenario route bindings remain legacy
until all UI slices are accepted. SPEC v1.36 explicitly accepts dedicated reviewed snapshots for
only two slice-boundary differences: truthful single-image copy and the existing deferred v2 tool
workspace presentation. Phase-37/38 route-level batch-presentation journeys are historical during
this slice, while their actor/runtime/tool/resource contracts remain regression requirements.

## Phase-34 contract

The completed isolated v2 slice adds one runtime-owned Manual Cutout draft per document, bounded
dirty-rectangle gesture history, and actor-owned committed document history. Apply produces one
`manual-cutout` operation over ID-only snapshots; Cancel produces none. Document Undo/Redo increments
revision and maintains deterministic artifact leases under limits of 20 operations / 96 MiB.

The existing bilingual noindex route gains Restore/Erase, brush size, zoom/pan/fit, explicit
Apply/Cancel, draft and document Undo/Redo, shortcuts, dirty-draft protection, and accessible status.
Full alpha planes, canvas buffers, patches, blobs, and URLs remain outside React/XState. Automatic
removal/export/reset and Phase-33 responsiveness/resource guarantees must not regress. Magic,
Enhancements, Background, batch, public-route migration, backend, and paid capabilities remain out
of scope.

## Phase-35 contract

The completed isolated v2 slice adds one runtime-owned Magic draft per document with at most 50
source-space Keep/Remove strokes, 512 simplified points per stroke, and 50 local Undo entries.
Prediction is explicitly separate from commit, correlates document/draft/run/baseline/draft
revisions, and publishes only candidate IDs/scores to the actor. Embeddings, prompts, constraint
maps, matte buffers, previews, and pixels remain in browser-runtime services.

Automatic removal and Magic inference share one FIFO `HeavyJobCoordinator`; Manual and Magic share
only a versioned non-inference snapshot committer and proven artifact-history lifecycle helper.
Explicit Magic Apply creates exactly one `magic-cutout` document-history operation. Cancel, stale
results, retry, reset, worker failure, and disposal preserve committed state and release their owned
runtime resources. The bilingual noindex route exposes accessible Keep/Remove, brush size, local
Undo/Redo, Predict, candidate selection/refinement, Apply/Cancel, and truthful queued/model/encode/
prediction states.

## Phase-36 contract

The completed isolated v2 slice adds one Background or Enhancement draft at a time. Background
supports transparent, colour, two-stop linear/radial gradients, and validated artifact-backed
JPEG/PNG/WebP images up to 20 MiB and 4096 px. Preview is immediate and uncommitted; explicit Apply
materializes one snapshot and creates exactly one `background` history operation.

Enhancements capture one committed baseline and execute selected `fine-detail` then `colour-halo`
operations through the shared FIFO `HeavyJobCoordinator`. Intermediate mattes, foreground pixels,
model sessions, and URLs stay runtime-owned. A changed explicit Apply creates exactly one `enhance`
operation; no-op, cancel, stale, duplicate, and failed work creates none. Undo/Redo/export restore
the committed descriptor and pixels without reinference. The bilingual noindex route exposes
accessible controls, dirty-draft guards, truthful stages/progress, retry, and keyboard behavior.

## Phase-37 contract

The completed isolated v2 slice adds ordered multi-document membership and selection while each
document actor remains the sole writer of its revision, history, draft, processing, and error truth.
One focused runtime per document owns controllers, projections, labels, dimensions, and view
settings. Selection changes projection identity only: it does not decode, infer, materialize,
recreate actors, or churn object URLs.

JPEG/PNG/WebP imports remain bounded by 20 MiB and 4096 px; the workspace holds at most 20 live
items and prepares at most two concurrently. Automatic, Magic, and Enhancement work across all
documents shares one FIFO `HeavyJobCoordinator` and bounded warm workers. Remove/reset/dispose
cancel only correlated owners and release their runtime/artifact graph. Download All leases only
committed PNG composites, preserves document order, uses privacy-neutral names/fixed timestamps,
skips unfinished/error items truthfully, and releases temporary leases/URLs on every terminal path.

## Phase-39 contract

The bilingual noindex v2 routes now render the v1-faithful shell, hero, quality selector,
single-image picker/drop/paste, preparation/model/processing/error/result states, comparison surface,
and Original/2048/1024 transparent PNG export through a controller-neutral projection/intent seam.
Runtime owners retain files, artifacts, workers, correlations, cancellation, model fallback, and
export lifecycle. Resized export never reruns inference; import/reset/dispose cancel correlated work
and release workers, leases, and object URLs deterministically.

Exact desktop/narrow v1 comparison remains required for slice-owned presentation. SPEC v1.36
accepts dedicated reviewed snapshots only for truthful single-image copy and the deferred existing
v2 tool-workspace presentation. Public/scenario routes remain legacy. Batch/tool visual migration,
managed-Windows complete-product acceptance, public cutover, and legacy removal remain later slices.

SPEC v1.37 approves Phase 40 as the batch presentation slice. It restores v1 multi-file copy,
admission, counters, item rail/actions, selection, and Download All over Phase-37 ownership. The
deferred v2 editor-tool presentation remains the only accepted visual difference; public/scenario
routes and cutover remain out of scope.

SPEC v1.38 defines Phase 41 as the final isolated presentation slice. The completed phase restores
the complete v1 editor stage, toolbar, Cutout Manual/Magic, Enhancements, and Background UI over the
accepted v2 tool controllers through bounded projection/intent and semantic interaction seams. The
full gate, exact bilingual browser evidence, architecture review, and serialized real-model journey
passed. Public/scenario routes remain legacy, and managed-Windows acceptance and cutover remain
separately gated work.

## Active blockers and residual risks

| Scope | State |
|-------|-------|
| Legacy editor | Removed from the Phase-43 source/build graph; previous immutable release remains the rollback unit |
| Phase 33 | Complete; gate, real-model evidence, and architect target-device acceptance passed |
| Phase 34 | Complete; gate, real-model evidence, and architect acceptance passed |
| Phase 35 | Complete; gate, real-model/Windows evidence, security scans, and architect acceptance passed |
| Phase 36 | Complete; gate, real-model/Windows evidence, security scans, and architect acceptance passed |
| Phase 37 | Complete; gate, real-model/Windows evidence, security scans, and architect acceptance passed |
| Phase 38 | Complete; technical gate passed, but public cutover remains blocked by documented product/evidence gaps |
| Phase 39 | Complete; gate passed and `v0.39.0` tags the locally merged implementation |
| Phase 40 | Complete; full gate, exact bilingual batch evidence, and real-model FIFO/export journey passed |
| Phase 41 | Complete; architect verification, architecture review fixes, full gate, exact bilingual evidence, and serialized real-model journey passed |
| Phase 42 | Complete with architect-accepted `blocked` readiness; one legacy timing gate failure was waived and unsupported absolute-duration signals remain recorded |
| Phase 43 | Complete; full gate passed, readiness `ready`, public v2-only cutover and immutable-release rollback verified |
| Future paid tier | Architecture direction only; backend/auth/billing/data/security/legal contracts are intentionally undecided |

## Current decisions and project log

Newest first. Earlier phase completions, spec changes, incidents, accepted risks, and superseded
decisions remain append-only in the [full archived tracker](./archive/contracts/STATE_THROUGH_PHASE_32_FULL.md).

### 2026-08-05 — Phase 43 complete: public v2 cutover ready

**Type:** phase-completion

**Author:** AI (`/context-update 43`)

**Triggered by:** Phase-43 gate passed with a `ready` report and no unchecked architect review item

#### Changes / Decision

- Switched both public roots and all eight localized scenario routes to the sole route-neutral v2
  editor, replaced the former v2 routes with permanent locale redirects, and removed the legacy
  development harness.
- Deleted the superseded legacy controller/store/worker/test graph; retained presentation now has
  explicit v2 ownership, while service-worker registration moved to the application shell.
- Full deterministic and real-model browser checks, managed-Windows evidence, security/supply-chain,
  production build/container smoke, and disposable previous-release rollback passed. The versioned
  Phase-43 report concludes `ready` with zero blocker or reachable legacy entry.

#### Affected Phases / Consequences

- Phase 43 is the final completed pre-production phase. Production deployment remains a separate
  authorized-operator action; rollback uses the previous immutable release, not dormant legacy code.

### 2026-08-05 — Final public v2 cutover and legacy removal approved

**Type:** spec-change

**Author:** AI (`/spec-sync`)

**Triggered by:** architect designated Phase 43 as the final phase before production deployment

#### Changes / Decision

- SPEC v1.42 authorizes one final pre-production phase to close public-path readiness evidence,
  switch all public and scenario editor routes to v2, and remove the superseded legacy workflow.
- Migration routes become locale-preserving public-root redirects; the legacy remove-background
  harness is removed, while retained internal model tooling stays explicitly noindex.
- Rollback is release-based through the previous immutable image. Phase 43 prepares but does not
  execute the production deployment, and its readiness report must conclude `ready` without waiver.

#### Affected Phases / Consequences

- Phase 43 requires a new phase contract before implementation.
- Phases 33–42 remain completed historical contracts and do not require review; Phase 42's blocked
  report and waived legacy timing failure remain unchanged evidence.

### 2026-08-05 — Phase 42 closed with blocked readiness and gate exception

**Type:** phase-completion / accepted risk

**Author:** AI (`/context-update 42`)

**Triggered by:** architect accepted the fail-closed `blocked` conclusion and explicitly waived the
single failed Phase-32 performance-budget gate measurement

#### Changes / Decision

- Closed the architect-reported v2 presentation, Cutout geometry/input, finishing-result,
  subscription, toolbar-reflow, and Magic candidate main-thread regressions.
- Captured bilingual deterministic and real-model journeys plus native Windows zoom, interaction,
  announcement, Long Task, and three-cycle zero-owner evidence; public cutover remains blocked by
  explicitly unsupported absolute duration signals.
- `/phase-gate 42` passed every required check except the Phase-32 English upload-preparation sample,
  which measured 129 ms against `<100 ms`. The architect directed no Phase-42 fix and accepted this
  recorded FAIL as a closure exception.

#### Affected Phases / Consequences

- Phase 42 is complete with an accepted `blocked` readiness result; it does not authorize public
  cutover or legacy removal.
- Any future cutover or performance follow-up requires a separately initialized phase.

### 2026-08-04 — Phase 41 complete

**Type:** phase-completion

**Author:** AI (`/context-update 41`)

**Triggered by:** Phase-41 gate passed and architect acceptance completed

#### Changes / Decision

- Restored the complete bilingual v1 result-editor stage, toolbar, tool rail, Manual/Magic Cutout,
  Background, and Enhancements UI on the isolated v2 routes.
- Kept actor/session/controller and mutable draft engines in the page/runtime adapter; presentation
  consumes immutable projections, typed intents, and bounded semantic interaction ports.
- Full Docker, TypeScript, architecture, unit, exact visual/behavioral browser, and serialized
  real-model verification passed with all architect review notes resolved.

#### Affected Phases / Consequences

- Phase 41 is complete; the isolated v2 routes now contain all incrementally migrated v1 UI slices.
- Public/scenario cutover, managed-Windows complete-product acceptance, and legacy removal remain
  separately scoped decisions; no next implementation phase is active.

### 2026-08-04 — Phase 41 architecture review corrections verified

**Type:** implementation-review

**Author:** AI (`/impl-assist 41 review`)

- Replaced mutable Manual/Magic engine exposure in controller-neutral views with bounded semantic
  interaction ports; XState/controller commands remain the sole committed-state path.
- Extracted concrete tool rendering from the page adapter and corrected touched shared components
  to the frontend conventions without changing accepted screenshots.
- Typecheck, lint, Steiger, 674 unit tests, exact Phase-41 browser evidence, Phase-38 accessibility/
  isolation, and the serialized real-model journey pass. Architect manual behavior verification and
  all review notes are resolved; `/phase-gate 41` is next.

### 2026-08-04 — Phase 41 implementation checkpoint

**Type:** implementation

**Author:** AI (`/impl-assist 41`)

- Restored the v1 editor shell on isolated v2 routes through a bounded projection/intent boundary
  and tool-specific interaction ports; actor/runtime ownership is unchanged.
- Exact bilingual desktop/narrow evidence, accessibility, 673 unit tests, the Phase-33–41 browser
  regression, and one serialized real-model all pass without retries.
- Architect manual verification is the next lifecycle step. Gate, context update, commit, merge,
  tag, managed-Windows acceptance, and public cutover have not been performed.

### 2026-08-04 — Phase 41 editor-tool presentation approved

**Type:** spec-change

**Author:** AI (spec-sync)

**Triggered by:** architect directed continued iterative v1-faithful UI migration after Phase 40

#### Changes / Decision

- SPEC v1.38 makes the complete v1 editor-tool workspace the next isolated v2 slice: shared stage,
  toolbar, Cutout Manual/Magic, Enhancements, Background, history, draft guards, and responsive UI.
- The slice consumes the accepted Phase-34–36 controllers through one immutable bounded projection/
  typed-intent boundary; it does not import legacy workflow state or create per-tab adapters.
- The deferred-tool visual exception ends inside Phase 41. Public/scenario routes, managed-Windows
  complete-product acceptance, cutover, and legacy removal remain separately gated follow-up work.

#### Affected Phases / Consequences

- Phase 41 — approved for initialization; its presentation contract and gate boundary are new.
- Phases 33–40 remain complete and unchanged because the addition consumes, rather than revises,
  their accepted domain/runtime contracts.

### 2026-08-04 — Phase 40 complete

**Type:** phase-completion

**Author:** AI (context-update)

**Triggered by:** Phase-40 gate passed and architect-directed continuation completed

#### Changes / Decision

- Restored the bilingual v1 batch workspace on the isolated v2 routes through immutable bounded
  projection values and typed intents over Phase-37 runtime ownership.
- Added ordered admission/capacity feedback, truthful item status and quality capture, selection,
  per-item retry/remove/PNG, guarded clear, and deterministic privacy-neutral ZIP presentation.
- Shared the controller-neutral v1 rail/status UI with the legacy adapter, fixed invalid-item reset,
  reactivated Phase-37/38 browser coverage, and froze exact desktop/narrow visual evidence.

#### Affected Phases / Consequences

- Phase 40 is complete; full gate and both architecture review notes passed.
- Editor-tool presentation, managed-Windows complete-product acceptance, public cutover, and legacy
  removal remain separately approved future work.

### 2026-08-04 — Phase 40 batch presentation approved

**Type:** spec-change

**Author:** AI (spec-sync)

**Triggered by:** architect directed continued iterative v1-faithful UI migration after Phase 39

#### Changes / Decision

- SPEC v1.37 makes the v1-faithful batch workspace the next isolated v2 slice, using the accepted
  Phase-37 workspace/runtime and Phase-39 presentation seam.
- The slice restores multi-file admission, batch status/selection/actions, individual export, and
  privacy-neutral ZIP presentation without changing workflow ownership.
- `model-loading` remains a distinct bounded workspace status so presentation does not mislabel
  model preparation as inference processing.
- Editor-tool visual migration, public/scenario route cutover, legacy removal, and paid work remain
  later separately approved phases.

#### Affected Phases / Consequences

- Phase 40 — approved for initialization; its presentation contracts and gate boundary are new.
- Phases 33–39 remain complete and unchanged because the new contract is additive and consumes their
  accepted runtime boundaries.

### 2026-08-04 — Phase 39 complete

**Type:** phase-completion

**Author:** AI (context-update)

**Triggered by:** Phase-39 gate passed and architect-directed acceptance completed

#### Changes / Decision

- Added the bilingual v1-faithful main-page single-image journey to the isolated v2 routes through
  a strict projection/intent boundary over actor/runtime ownership.
- Added explicit automatic model selection/fallback, cancellable import preparation, observable
  resized-export lifecycle, transparent PNG sizing, deterministic cleanup, and result history
  shortcuts without reinference.
- Recorded exact visual evidence plus the two SPEC-approved slice-boundary baselines; public and
  scenario routes remain unchanged on legacy.

#### Affected Phases / Consequences

- Phase 39 is complete; full gate and all seven architecture review notes passed.
- The next approved slice may restore batch presentation or migrate tool UI. Public cutover remains
  blocked until all visible capabilities and affected-device evidence are accepted together.

### 2026-08-04 — Phase 39 incremental visual boundary clarified

**Type:** spec-change

**Author:** AI (spec-sync)

**Triggered by:** architect directed continuation after review exposed contradictory Phase-39 visual
and historical route-presentation requirements

#### Changes / Decision

- SPEC v1.36 keeps exact v1 comparison for presentation owned by the Phase-39 slice and explicitly
  accepts dedicated reviewed snapshots only for truthful single-image copy and deferred v2 tool UI.
- Phase-37/38 route-level batch-presentation journeys are historical while the isolated route hosts
  this single-image slice; their architecture, runtime, tool, export, SSR, and resource contracts
  remain required regressions.
- Phase 39 requires a serialized local real-model journey. Managed-Windows complete-product
  acceptance remains mandatory at the later full-UI/public-cutover gate.

#### Affected Phases / Consequences

- Phase 39 was reviewed and surgically updated in the same sync; it remains `in-progress` and is not
  left `NEEDS_REVIEW`.
- Phases 33–38 remain complete; no implemented domain/runtime contract changes.
- Later batch/tool UI phases and the public-cutover gate retain their full visual/device obligations.

### 2026-08-04 — Phase 38 validation complete with blocked cutover result

**Type:** phase-complete

**Author:** AI (context-update)

**Triggered by:** Phase-38 scope, architect review, and full gate checks completed

#### Changes / Decision

- Published the typed parity matrix, machine-readable report, and human results with one fail-closed
  `blocked` conclusion; the architect accepted that conclusion and iterative v1-faithful migration.
- Closed accessibility/focus defects within the Phase-33–37 contracts and added deterministic,
  real-model, resource/performance, release, and security evidence without changing public routes.
- The full gate passed. Validation completion is not public-cutover approval: missing v1-visible
  outcomes and unsupported target-device/performance signals remain explicit blockers.

#### Affected Phases / Consequences

- Phase 38 is complete; its public-cutover conclusion remains `blocked`.
- Phase 39 is the only active implementation scope and begins the isolated v1-faithful main-page
  single-image migration. Public/scenario routes remain legacy.

### 2026-08-04 — V1 presentation preserved during v2 migration

**Type:** spec-change

**Author:** AI (spec-sync)

**Triggered by:** architect clarified that v2 rewrites architecture, data flow, and processing while
the established v1 visual presentation and user-visible capabilities remain the product contract

#### Changes / Decision

- SPEC v1.35 makes the rendered bilingual v1 main page the visual and interaction reference for v2;
  unexplained UI drift is a contract failure rather than an accepted redesign.
- Migration proceeds through isolated vertical UI slices over typed v2 projections/intents, without
  importing legacy hooks, mutable workflow state, stores, or worker ownership.
- Phase 39 covers the main-page shell plus single-image picker/drop/paste, quality, processing,
  result, export-size, and PNG flow on the existing noindex v2 routes. Public routes stay legacy.

#### Affected Phases / Consequences

- Phase 38 is `NEEDS_REVIEW`: its blocked evidence remains valid, but any disposition that accepted
  visible v1/v2 UI drift must be re-evaluated under the stricter preservation contract.
- Phases 33–37 remain complete because their domain/runtime contracts are not changed.
- Phase 39 may be initialized by explicit architect direction despite Phase 38 not being complete;
  it resolves blockers iteratively and does not authorize public cutover.

### 2026-08-04 — Phase 38 cutover-readiness validation approved

**Type:** spec-change

**Author:** AI (spec-sync)

**Triggered by:** architect directed continuation of the v2 migration after accepting Phase 37

#### Changes / Decision

- SPEC v1.34 records Phase 37 as complete and scopes Phase 38 to bilingual product-parity,
  accessibility, responsiveness, resource, real-browser, and target-device validation.
- Every legacy/v2 difference must be classified as required parity, an explicitly accepted product
  difference, or a public-cutover blocker; new product capabilities do not enter through a
  validation-only defect fix.
- Phase 38 keeps the isolated routes noindex and produces a versioned `ready`/`blocked` report.

#### Affected Phases / Consequences

- Phase 38 requires a new phase contract before implementation.
- Phases 33–37 remain complete and unchanged. Public-route migration may start only after a `ready`
  Phase-38 result; legacy removal remains a later post-cutover decision.

### 2026-08-04 — Phase 37 complete

**Type:** phase-completion

**Author:** AI (context-update)

**Triggered by:** PHASE_37 gate passed and architect batch/multi-document acceptance completed

#### Changes / Decision

- Added bounded multi-file import and ordered workspace membership/selection over isolated document
  actors and focused per-document runtimes.
- Preserved drafts, history, settings, processing ownership, and cleanup across selection/retry/
  remove/reset while every heavy job continues through one shared FIFO admission boundary.
- Added accessible bilingual contact-sheet controls, selected PNG and deterministic privacy-neutral
  Download All, plus mocked/real/Windows evidence and complete production/security gates.

#### Affected Phases / Consequences

- The isolated v2 editor now covers the planned local editing and batch workspace capabilities.
- Public-route parity validation, cutover, and eventual legacy removal remain later explicitly
  scoped phases; backend and paid capabilities remain undecided.

### 2026-08-03 — Phase 37 batch and multi-document slice approved

**Type:** spec-change

**Author:** AI (spec-sync)

**Triggered by:** architect directed planning of the next v2 migration phase after accepting
Phase 36

#### Changes / Decision

- SPEC v1.33 records Phase 36 as complete and scopes Phase 37 to batch/multi-document orchestration
  on the isolated bilingual v2 route.
- The workspace actor owns ordered membership, selection, aggregate bounded status, and child
  lifecycle; existing document actors remain sole document writers.
- Runtime composition splits per-document lifecycle from the workspace facade, retains one global
  heavy-job boundary, and adds isolated retry/remove plus deterministic Download All.

#### Affected Phases / Consequences

- Phase 37 requires a new phase contract before implementation.
- Phases 33–36 remain complete and unchanged; parity validation, public-route migration, legacy
  removal, backend, and paid capabilities remain later slices.

### 2026-08-03 — Phase 36 complete

**Type:** phase-completion

**Author:** AI (context-update)

**Triggered by:** PHASE_36 gate passed and architect Background/Enhancements acceptance completed

#### Changes / Decision

- Added atomic Background drafts for transparent, colour, gradient, and validated custom-image
  fills to the isolated bilingual v2 editor.
- Added ordered fine-detail/colour-halo Enhancements behind the shared FIFO heavy-job boundary,
  with runtime-owned intermediates and correlated changed/no-op/failure/cancel settlement.
- Added domain/actor/worker/ownership tests, bilingual browser coverage, serialized real-model and
  Windows target evidence, profiling reports, production container smoke, and security scans.

#### Affected Phases / Consequences

- No later phase is initialized; the next v2 migration slice requires explicit SPEC approval and a
  new phase contract.
- Batch, public-route migration, legacy removal, backend, and paid capabilities remain later work.

### 2026-08-03 — Phase 36 Background and Enhancements slice approved

**Type:** spec-change

**Author:** AI (spec-sync)

**Triggered by:** architect directed continuation of the v2 architecture migration after accepting
Phase 35

#### Changes / Decision

- SPEC v1.32 scopes Phase 36 to Background and the existing local fine-detail/colour-halo
  Enhancements on the isolated bilingual v2 route.
- Committed snapshots gain an ID-only background descriptor; custom background bytes remain
  artifact-owned, preview remains uncommitted, and explicit Apply creates one history operation.
- Enhancement stages execute from one captured baseline and publish atomically through the document
  actor, while heavy stages join the existing automatic/Magic admission boundary.

#### Affected Phases / Consequences

- Phase 36 requires a new phase contract before implementation.
- Phases 33–35 remain complete and unchanged; batch, public-route migration, legacy removal,
  backend, and paid capabilities remain later slices.

### 2026-08-03 — Phase 35 complete

**Type:** phase-completion

**Author:** AI (context-update)

**Triggered by:** PHASE_35 gate passed and architect Magic Cutout acceptance completed

#### Changes / Decision

- Added guided Magic Cutout to the isolated bilingual v2 editor with bounded runtime-owned
  Keep/Remove strokes, explicit prediction/candidate refinement, and one atomic Apply operation.
- Added a shared FIFO heavy-model coordinator, correlated SlimSAM worker lifecycle, runtime-owned
  embeddings/candidates/previews, and a shared versioned non-inference snapshot committer for
  Manual and Magic.
- Added domain/actor/worker/ownership tests, bilingual browser coverage, real SlimSAM cold/warm
  evidence, Windows target-device evidence, resource-churn reports, container smoke, and security
  scans.

#### Affected Phases / Consequences

- Phase 36 must be explicitly scoped and initialized before another v2 capability is implemented.
- Background, Enhancements, batch, public-route migration, backend, and paid capabilities remain
  later slices; the legacy editor remains public until accepted v2 parity.

### 2026-08-03 — Phase 35 Magic Cutout slice approved

**Type:** spec-change

**Author:** AI (spec-sync)

**Triggered by:** architect directed continuation of the v2 architecture migration after accepting
Phase 34

#### Changes / Decision

- SPEC v1.31 scopes Phase 35 to guided Magic Cutout on the existing isolated v2 route.
- Prediction remains distinct from document commit; runtime owns embeddings/prompts/candidates,
  while correlated actor metadata includes both committed and draft revision.
- The second tool authorizes a narrow shared lifecycle and heavy-job admission boundary, while
  tool-specific controllers/services remain cohesive and no generic event bus or god-service is
  introduced.

#### Affected Phases / Consequences

- Phase 35 requires a new phase contract before implementation.
- Phases 33–34 remain complete and unchanged; Background, Enhancements, batch, public-route
  migration, backend, and paid capabilities remain later slices.

### 2026-08-03 — Phase 34 complete

**Type:** phase-completion

**Author:** AI (context-update)

**Triggered by:** PHASE_34 gate passed and architect Manual/history acceptance completed

#### Changes / Decision

- Added bounded committed document history and deterministic runtime-owned Manual Cutout to the
  isolated bilingual v2 editor route.
- Added atomic Apply/Cancel, draft and document Undo/Redo, independent artifact leases, a dedicated
  no-inference commit worker, and 20-operation/96-MiB pruning.
- Added unit, actor, randomized churn, bilingual browser, serialized real-model, target-device,
  resource-lifetime, container, and security evidence.

#### Affected Phases / Consequences

- Phase 35 must be explicitly scoped and initialized before another v2 capability is implemented.
- Magic Cutout, Enhancements, Background, batch, public-route migration, backend, and paid
  capabilities remain future slices.

### 2026-08-03 — Phase 34 history and Manual Cutout slice approved

**Type:** spec-change

**Author:** AI (spec-sync)

**Triggered by:** architect directed the next SDD phase after accepting Phase 33

#### Changes / Decision

- SPEC v1.30 scopes Phase 34 to bounded committed document history and exact Manual Cutout on the
  existing v2 route.
- It separates runtime-owned patch/draft buffers from actor-owned ID-only workflow state and defines
  atomic Apply/Cancel plus artifact-aware Undo/Redo limits.

#### Affected Phases / Consequences

- Phase 34 requires a new phase contract before implementation.
- Phase 33 remains complete and unchanged; Magic, other editor tools, batch, and public migration
  remain future slices.

### 2026-08-03 — Phase 33 complete

**Type:** phase-completion

**Author:** AI (context-update)

**Triggered by:** PHASE_33 gate passed, implementation committed, and architect target-device
acceptance completed

#### Changes / Decision

- Added the isolated editor v2 foundation and bilingual noindex one-image automatic-removal slice.
- Established XState workflow actors, framework-free domain transitions, backend-neutral processing
  contracts, browser-worker execution, and explicit artifact ownership/lifecycle.
- Added typed shared config/runtime and v2 Typography/Image primitives plus deterministic unit,
  browser, real-model, performance, resource, container, and security evidence.

#### Affected Phases / Consequences

- Phase 34 remains `NEEDS_REVIEW` and must be re-scoped as the next capability slice before
  implementation. The legacy editor remains the public product until v2 reaches accepted parity.

### 2026-08-01 — Active contracts compacted without history loss

**Type:** decision

**Author:** Architect + AI

- `SPEC.md` and `STATE.md` now hold only current normative intent, runtime truth, active status, and
  current decisions.
- Their complete pre-compaction contents were frozen under `archive/contracts/`; phase and evidence
  archives plus Git history retain traceability.
- This is a documentation-structure change only: no model, endpoint, env, phase scope, runtime, or
  acceptance contract changed, so no phase is newly marked `NEEDS_REVIEW`.

### 2026-08-01 — Active documentation surface reduced for editor v2

**Type:** decision

- Only active contracts, operational docs, and Phase 33 remain in the primary documentation surface.
- Completed/superseded phases, plans, audits, evaluations, legal baselines, and design evidence moved
  to indexed archives and cannot be inferred as active scope.

### 2026-08-01 — V2 frontend foundation and architect review made explicit

**Type:** decision

- Phase 33 rewrites shared Typography/Image primitives and establishes typed SSR-safe env/runtime and
  consumed shared wrappers under `FRONTEND_CONVENTIONS.md`.
- Architect review of domain boundaries, shared APIs, SSR behavior, code quality, and browser behavior
  is a blocking post-phase acceptance step.

### 2026-08-01 — Phase 32 closed incomplete by architect exception

**Type:** phase-complete / accepted risk

- The architect directed closure without tests/gate despite reproduced freezes. No `v0.32.0` tag is
  authorized; the code is retained only as the legacy baseline.

### 2026-08-01 — Architecture-led v2 and future paid processing approved

**Type:** decision

- New capability work moves to an isolated v2 architecture with explicit document actors, artifact
  ownership, and processing ports, delivered in small tested slices.
- The free tier remains local/private. A future explicit paid tier may add faster models and generated
  backgrounds only through dedicated backend, security, legal, and product phases.

## Maintenance rules

- Update phase status and Current Contract through `/context-update` after an accepted phase.
- Run `/spec-sync` immediately after a SPEC change. Mark only genuinely affected future phases
  `NEEDS_REVIEW`; docs-only compaction does not change contracts.
- Keep current decisions concise. Before rotating older entries, freeze a complete dated snapshot in
  `archive/contracts/` and link it here; never erase the only copy of project history.
- Archived material explains prior decisions but never expands active scope.
