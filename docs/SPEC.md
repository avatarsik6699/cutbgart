# TECHNICAL SPECIFICATION: BG Remove App

> Active product and system contract. Read this document, [`STATE.md`](./STATE.md),
> [`ARCHITECTURE_V2.md`](./ARCHITECTURE_V2.md), and the active phase before implementation.
> The complete pre-compaction v1.27 specification is preserved at
> [`archive/contracts/SPEC_V1_27_FULL.md`](./archive/contracts/SPEC_V1_27_FULL.md).
> Run `/spec-sync` whenever this file changes.

## Metadata

| Field | Value |
|-------|-------|
| Version | `v1.43` |
| Date | `2026-08-05` |
| Architect / owner | `v.godlevskiy` |
| Product | `cutbg` at `cutbg.art` |
| Internal project | `bg_remove_app` / BG Remove App |
| Stack | [`STACK.md`](./STACK.md) |
| Current contract/status | [`STATE.md`](./STATE.md) |
| Feedback | Telegram `https://t.me/+HaqBWI1A3vg4MWJi` |
| Privacy/legal contact | `avatarsik6699@gmail.com` |

## 1. Product contract

BG Remove App removes image backgrounds and supports finishing/export workflows. The deployed
editor is an anonymous browser-local product implemented solely by the accepted v2 domain,
application, browser-runtime, and presentation architecture.

Three invariants govern every decision:

1. **The free tier is private and local by default.** Source images and derived pixels never leave
   the device. Remote processing may only be an explicit, disclosed paid action.
2. **Accounts, billing, and server image processing do not exist in the current product.** Each
   requires dedicated entitlement, security, legal/data, retention, deletion, abuse, and operations
   contracts before implementation.
3. **Responsiveness, indexability, and accessibility are functionality.** A visually correct result
   does not pass if the page freezes, actions are lost, resources leak, or public pages regress.

The accepted v2 implementation now covers the complete browser-local workflow: automatic removal,
bounded committed history, Manual and Magic Cutout, Background, fine-detail/colour-halo
Enhancements, multi-document orchestration, preview/export, deterministic ZIP export, and safe
cancel/retry/reset. Phases 39–42 reconnected that architecture to the established v1 presentation
and completed the isolated-route migration evidence. Phase 43 switched every public and scenario
editor route to v2, removed the superseded legacy workflow, and proved release/rollback readiness.
Phase 44 now refactors the retained public frontend in one architect-reviewed phase: it decomposes
large compositions, narrows subscriptions and render ownership, removes confirmed obsolete
surfaces, and verifies the completed application without changing product capability or ownership.

## 2. Scope and boundaries

### 2.1 Current public capability

The repository currently contains:

- JPEG/PNG/WebP import, validation, clipboard/drop input, 20 MiB limit, and client downscale above
  4096 px on the longest side;
- browser inference through WebGPU with WASM fallback and immutable model assets from the model CDN;
- single and batch workflows, Cutout Magic/Manual correction, Enhancements, Background, committed
  undo/redo, transparent PNG export, size selection, and client-generated ZIP;
- Russian/English public and scenario pages, privacy/about pages, SEO metadata, analytics, security,
  deployment, rollback, and incident infrastructure;
- browser model/matting evaluation surfaces kept as internal, noindex tooling.

The Phase-32 legacy implementation did not eliminate real-browser model-load and Magic Apply
freezes. It is closed incomplete and removed from the current product; its history is retained only
in Git and archived evidence.

### 2.2 Implemented v2 foundation through Phase 37

Phases 33–37 built an isolated implementation under `src/v2/` and a separate noindex route. It
includes:

- framework-free IDs, snapshots, commands, events, invariants, and processing ports;
- one workspace actor and one XState document actor per imported image;
- an artifact repository for binary ownership and deterministic disposal;
- one typed worker protocol and a bounded local processing gateway;
- rewritten shared Typography and Image primitives;
- typed SSR-safe `shared/config/env.ts` and `runtime.ts`, plus only consumed/tested wrappers;
- bounded committed document history and runtime-owned exact Manual Cutout drafts;
- runtime-owned guided Magic drafts, correlated prediction/candidates, and explicit Apply;
- runtime-owned Background and Enhancement drafts with explicit atomic Apply/Cancel;
- one shared FIFO heavy-job coordinator for automatic-removal, Magic, and Enhancement work;
- bounded multi-document import/selection over independently owned document runtimes and actors;
- isolated per-item retry/remove plus deterministic committed-result ZIP export;
- deterministic unit, actor, worker, component, Playwright, real-model, and target-device evidence.

Their historical checklists and acceptance gates live in
[`archive/phases/PHASE_33.md`](./archive/phases/PHASE_33.md) through
[`archive/phases/PHASE_37.md`](./archive/phases/PHASE_37.md).

### 2.3 Implemented v2 slice — Phase 34

Phase 34 migrated bounded document history and exact Manual Cutout onto the accepted v2 foundation:

- one manual draft belongs to one document and captures the committed baseline revision;
- Restore and Erase edit alpha deterministically in source-image coordinates; untouched alpha bytes
  remain bit-exact, and brush falloff never invokes inference or changes pixels outside its footprint;
- gesture-level draft undo/redo uses bounded dirty-rectangle patches outside React/XState state;
- Cancel discards the entire draft without changing the document revision or committed artifacts;
- Apply materializes matte/composite/PNG artifacts outside the interaction path and commits exactly
  one `manual-cutout` history operation through the document actor;
- document Undo/Redo moves between committed ID-only snapshots, increments revision, invalidates the
  redo branch after a new commit, and deterministically retains/releases history artifact leases;
- history is bounded to 20 committed operations and 96 MiB of retained historical artifacts, pruning
  the oldest entries without releasing artifacts still reachable from baseline/current/redo;
- the bilingual v2 route adds accessible Manual, Apply, Cancel, draft Undo/Redo, document Undo/Redo,
  brush mode/size, zoom/pan/fit, keyboard shortcuts, dirty-draft protection, and truthful status;
- the existing automatic-removal, preview, export, reset, SSR, responsiveness, and cleanup contracts
  remain green.

Phase 34 does **not** migrate Magic Cutout, fine-detail/foreground refinement, Enhancements,
Background, batch/multi-document UI, public routes, accounts, payments, remote processing, or
generated backgrounds. It may reuse reviewed pure geometry/pixel policies from legacy code but must
not import legacy React hooks, mutable stores, or editor workflow state.

### 2.4 Implemented v2 slice — Phase 35

Phase 35 migrated guided Magic Cutout as a complete vertical slice and performed only the
architecture refactoring justified by the second tool:

- one Magic draft belongs to one document, captures its committed baseline revision, and is the only
  active tool draft for that document;
- Keep and Remove strokes are recorded in source-image coordinates, simplified while painting, and
  bounded to 50 live strokes with at most 512 points per committed stroke; draft Undo/Redo is local
  to Magic and obeys the same 50-stroke bound;
- model encoding/prediction and document commit are distinct operations: encoding the source or
  changing strokes never commits or silently applies a result;
- source embeddings, prompt/constraint buffers, candidate mattes, model sessions, and preview pixels
  remain runtime-owned; actors and React receive only IDs, revisions, status, and small summaries;
- every prediction correlates `{ documentId, draftId, runId, expectedRevision, draftRevision }`;
  cancelled, superseded, cross-document, wrong-baseline, or stale-draft results cannot publish a
  preview or commit;
- the user explicitly requests a prediction, chooses or continues refining a candidate, then uses
  explicit Apply to create exactly one `magic-cutout` committed history operation; Cancel creates
  none and leaves committed revision/history/artifacts unchanged;
- a prediction or Apply failure exposes a typed retryable state and retains the draft; a successful
  new commit invalidates the document redo branch and uses the Phase-34 history pruning/lease rules;
- automatic removal and Magic share one browser-runtime heavy-job coordinator with explicit
  backpressure and cancellation; model initialization/inference cannot run concurrently merely
  because different tools own different workers;
- `EditorSession` remains a thin composition facade and delegates cohesive Manual/Magic behavior to
  tool-specific controllers/services. Shared lifecycle types or helpers require at least two real
  consumers; one generic event bus, inheritance hierarchy, catch-all utility module, or stateful
  god-service is forbidden;
- the bilingual v2 route adds accessible Keep/Remove modes, brush size, bounded draft Undo/Redo,
  truthful loading/encoding/predicting/preview/applying/error states, candidate refinement,
  explicit Apply/Cancel, and documented keyboard behavior;
- all accepted Phase-33/34 automatic-removal, Manual, history, export, SSR, responsiveness, and
  deterministic cleanup contracts remain green.

Phase 35 reuses the pinned legacy SlimSAM model family/revision and its immutable local-processing
asset policy; it does not authorize a model-family or weight change. Reviewed pure policies for
stroke sampling, prompt coordinates, semantic constraints, candidate ranking/fusion, and bounded
draft history may be rewritten behind v2 contracts. Legacy React hooks, mutable workflow state, and
legacy worker lifecycle code must not be imported.

Phase 35 did **not** migrate fine-detail/foreground refinement, Enhancements, Background,
batch/multi-document UI, public routes, accounts, payments, remote processing, or generated
backgrounds, and it adds no new environment variable or third-party dependency.

### 2.5 Implemented v2 slice — Phase 36

Phase 36 migrated Background and the two existing local Enhancement operations as one finishing-
workflow slice. It does not mechanically copy the legacy React hooks or mutable workspace state:

- `DocumentSnapshot` gains an ID-only `background` descriptor. Transparent, solid-colour, and
  two-stop linear/radial gradients contain only validated scalar metadata; a custom background
  image is referenced by an artifact ID and never embeds a `Blob`, bitmap, or object URL;
- one Background draft belongs to one document and committed baseline revision. Changing a fill
  produces an immediate runtime-owned preview without PNG encoding or document revision changes;
  Cancel discards the draft, while explicit Apply materializes one composite/PNG and creates
  exactly one `background` history operation;
- custom background images accept JPEG/PNG/WebP up to 20 MiB, are bounded to 4096 px on the longest
  side during worker-side preparation, and are owned and released through `ArtifactRepository` on
  replace, Cancel, stale Apply, reset, history pruning, and disposal;
- one Enhancement draft selects `fine-detail`, `colour-halo`, or both. Fine detail refines the
  committed alpha matte; colour-halo cleanup may produce a foreground artifact while preserving
  the matte as the sole alpha authority. The selected operations execute in registry order against
  one captured baseline and publish no partial document state;
- explicit Enhancement Apply is one correlated, cancellable run and creates exactly one `enhance`
  history operation only when the materialized snapshot differs. Cancel, failure, stale completion,
  or a safe no-op keeps the committed snapshot/revision/history unchanged; retry starts a fresh run
  from the same still-valid draft;
- automatic removal, Magic, and every model- or memory-heavy Enhancement stage use the same FIFO
  `HeavyJobCoordinator`. Background preview/commit, Manual commit, Magic commit, history, and export
  remain non-inference work and are not serialized behind an unrelated model job;
- Background and Enhancement receive cohesive runtime controllers/services. `EditorSession` stays
  a thin composition facade; the document actor remains the sole commit writer; shared helpers
  require concrete consumers and may not become a generic tool engine, event bus, inheritance
  hierarchy, catch-all utility module, shared mutable draft store, or stateful god-service;
- the bilingual noindex v2 route gains accessible Background and Enhancements workspaces with
  truthful preview/dirty/preparing/queued/running/applying/error/no-change states, explicit Apply/
  Cancel, retry where safe, keyboard routing, dirty-draft protection, and export bound only to the
  committed snapshot;
- all accepted Phase-33–35 automatic-removal, Manual, Magic, history, SSR, responsiveness, resource,
  and deterministic cleanup contracts remain green.

Phase 36 rewrote or extracted only reviewed pure legacy policies for fill validation/normalization,
matte refinement, deterministic fusion, and foreground cleanup behind v2 contracts. It reuses the
pinned model families/revisions and immutable local asset policy; it adds no dependency, environment
key, server endpoint, storage, or remote fallback. Legacy React hooks, components, mutable editor
state, and worker lifecycle code must not be imported.

Phase 36 did **not** migrate batch/multi-document UI, public/scenario routes, legacy removal,
accounts, payments, remote processing, generated backgrounds, arbitrary image adjustments, or a
new model family. A custom uploaded background is local compositing, not generated content.

### 2.6 Implemented v2 slice — Phase 37

Phase 37 migrates the local batch/multi-document workflow as a parent workspace actor over the
accepted Phase-33–36 document actor. It removes the intentional one-document cap without copying the
legacy `useBatchProcessing`/`ToolWorkspace` state graph:

- the workspace actor owns ordered document IDs, selected document ID, bounded aggregate progress,
  and child actor lifecycle only. Each image still has exactly one document actor and remains the
  sole writer of its revision, committed snapshot, draft, history, and error state;
- runtime composition separates the workspace/session facade from per-document runtimes. Each
  document runtime owns its projections, tool controllers, subscriptions, and cleanup; the parent
  owns membership/selection and delegates rather than accumulating every tool and item concern in
  one batch god-object;
- multiple JPEG/PNG/WebP files may be imported initially and added later. A runtime-only
  `WorkspaceItemId` owns each pending/failed input until successful preparation creates its
  `DocumentId` and child actor. Each file independently
  passes the existing 20 MiB, safe-decode, and 4096 px preparation boundary; one invalid/failed item
  cannot discard, restart, or block valid siblings. One workspace accepts at most 20 live items
  (pending, failed, or registered) and prepares at most two imports concurrently; overflow is
  rejected before ownership;
- automatic removal for every item enters the existing global FIFO `HeavyJobCoordinator` with one
  model/memory-heavy job admitted at a time. Selection, cached preview paint, tool controls, removal,
  and export remain responsive while other items are queued or running;
- selecting another document is an identity-only workspace transition. It performs no upload,
  decode, automatic reinference, snapshot materialization, history reconstruction, or object-URL
  churn. A retained Manual/Magic/Background/Enhancement draft reopens truthfully for its owner;
- queued/running/error/result status, safe localized error summaries, queue position, and aggregate
  counts are bounded metadata. Pixels, files, URLs, worker handles, abort controllers, promises, and
  tool runtimes remain outside React/XState snapshots;
- shared automatic/Magic/Enhancement gateways accept requests from multiple document runtimes but
  correlate cancellation and terminals by document/run owner. Cancelling/removing one document
  cannot reset a sibling's queued/active request, and batch must not create one warm model worker or
  session per document;
- retry starts a fresh correlated automatic run for only the failed document. Remove cancels that
  document's queued/running/tool work and releases only its artifacts, previews, model inputs,
  histories, and runtime; reset/dispose releases the entire actor/runtime tree exactly once;
- the bilingual noindex v2 route gains multiple-file/add-image input, an accessible document
  filmstrip/list, selected-item editing, per-item retry/remove, truthful batch progress, and keyboard
  selection. Item switches during heavy work must not lose focus intent, drafts, history, or edits;
- selected-document export keeps reading its committed PNG. Download All creates one deterministic
  client-side ZIP from completed committed PNG artifacts only, with collision-safe privacy-neutral
  names and fixed entry timestamps; it does not rerun inference or encode unfinished/error items;
- batch work adds no server endpoint, persistence, analytics payload, environment key, model change,
  or remote fallback. It reuses `client-zip` through a narrow export port and adds no generic event
  bus, base tool class, shared mutable document store, or second workflow source of truth.

Phase 37 does **not** migrate public/scenario routes, remove legacy code, change quality/model
selection, add arbitrary export formats, accounts, payments, remote processing, or generated
backgrounds. Public cutover follows a separate parity/accessibility/device/product-validation phase.

### 2.7 V2 validation result — Phase 38

Phase 38 determines whether the isolated v2 editor is ready to replace the editor embedded in the
public and scenario routes. It is an evidence and defect-closure slice, not the cutover itself:

- create one bilingual product-parity matrix covering every currently promised public editor
  outcome: picker/drop/paste input, validation and downscale behavior, automatic removal and
  fallback, single/batch lifecycle, Manual/Magic Cutout, Background, Enhancements, history,
  retry/cancel/reset, selected PNG, Download All, privacy, and failure recovery;
- classify every legacy/v2 difference as required parity, an explicitly accepted product
  difference, or a cutover blocker. Quality/model choice, export-size choice, and other legacy-only
  controls may not disappear implicitly; their disposition and evidence must be recorded before
  readiness can pass;
- close only defects in the already accepted Phase-33–37 contracts. A newly required capability,
  persistence rule, model choice, or workflow contract must be scoped in a follow-up phase rather
  than smuggled into validation;
- perform an accessibility audit against the applicable WCAG 2.2 AA criteria for keyboard and
  focus order, names/roles/states, status announcements, pointer alternatives, contrast, reduced
  motion, 200% zoom/reflow, responsive layout, error recovery, and bilingual copy;
- exercise the full single- and multi-document workflow with deterministic Playwright, axe-based
  automated checks, one serialized real-model journey, and architect review on the affected Windows
  browser/device. Add other supported viewport/input/browser samples where the parity matrix marks
  them material; unsupported observations remain explicit rather than synthetic;
- compare cold/warm responsiveness, input latency, long tasks, memory/resource ownership, global
  heavy-job admission, selection without reinference, and repeated import/edit/remove/reset/dispose
  churn against the accepted v2 budgets. No freeze, lost command, stale publication, cross-document
  mutation, retry-masked pass, or reachable resource leak may pass;
- produce a versioned Phase-38 readiness report whose conclusion is `ready` or `blocked`, with every
  matrix row linked to automated, real-browser, target-device, or architect evidence. `ready`
  requires zero unresolved cutover blocker and zero unresolved serious accessibility defect.

The Phase-38 report concluded `blocked`: the isolated v2 presentation is not a visual replacement
for the established public editor, drop/paste and legacy quality/export-size choices remain absent,
and some target-device/architect evidence is incomplete. That result remains valid evidence; it is
not reclassified as ready. It changes the migration plan from one direct cutover to incremental UI
parity work while public routes remain unchanged.

### 2.8 Active v2 scope — Phase 39

Phase 39 starts the public-UI migration on the separate bilingual noindex v2 surface. The existing
rendered v1 main page is the design and interaction reference; architecture changes do not authorize
a redesign. The first dependency-complete vertical slice covers:

- the complete main-page shell and empty workspace presentation in both locales;
- picker, drag-and-drop, and clipboard image admission with the existing validation/downscale
  outcomes;
- the visible legacy quality/model choice connected to an explicit v2 application/runtime policy,
  retaining stored `fast|max` compatibility while BEN2 remains session-only;
- truthful preparation, model loading, processing, fallback, cancellation, retry, and single-result
  states using the accepted v2 actor/artifact/worker ownership;
- the visible legacy export-size choice and selected transparent PNG export without reinference;
- visual-regression baselines and behavioral Playwright evidence against the current v1 reference at
  approved desktop and narrow viewports.

The reference comparison is exact for presentation owned by this slice. Two differences are
explicitly accepted because exact legacy pixels would contradict the slice boundary: the empty
workspace uses truthful single-image copy instead of the legacy batch promise, and the result shell
launches the already accepted v2 tool workspaces without restyling Manual/Magic, Background, or
Enhancements. Both differences require their own reviewed Phase-39 snapshots; they are not general
pixel tolerances and do not authorize drift in the shell, processing states, or shared controls.

Presentation may be extracted from legacy components into neutral reusable UI, but v2 may not import
legacy hooks, controllers, mutable workflow state, worker lifecycle, or stores as its source of
truth. A narrow typed presentation/controller port maps user intent and v2 projections to the shared
visual components. Do not maintain two independently styled copies of the same public UI.

Phase 39 does not migrate batch UI, Manual/Magic, Background, Enhancements, scenario routes, or the
public `/` and `/en` route bindings. Those follow as separately accepted vertical slices. The public
route switches only after every v1-visible state and capability has v2 behavioral, visual,
accessibility, real-model, and affected-device acceptance with a rollback boundary.

While the isolated routes carry this single-image migration slice, Phase-37/38 browser journeys
whose sole entry contract is the superseded batch presentation on `/editor-v2` are historical
evidence rather than Phase-39 gate tests. Their actor, runtime, artifact, scheduling, tool, export,
SSR, accessibility, and resource contracts remain regression requirements. Batch route-level E2E
returns with the dedicated batch UI slice. Phase 39 requires a serialized local real-model journey;
managed-Windows product acceptance remains mandatory for the later complete-UI/cutover gate, where
all presentation slices can be assessed together.

### 2.9 Active v2 scope — Phase 40

Phase 40 completes the main-page workspace migration by restoring the established v1 batch
presentation on the separate bilingual noindex v2 routes. It reuses the Phase-39 shell and typed
presentation boundary plus the accepted Phase-37 workspace actor, per-document runtimes, shared
heavy-job coordinator, and ZIP exporter. It does not introduce a second batch state owner or revive
legacy batch hooks/controllers.

The dependency-complete slice covers:

- picker, drag-and-drop, and clipboard admission of up to 20 ordered JPEG/PNG/WebP files, including
  the existing 20 MiB and 4096 px preparation outcomes, bounded two-file preparation concurrency,
  capacity feedback, and per-file recoverable failures;
- the v1 batch workspace hierarchy, counters, queue/progress/error states, horizontal item rail,
  selected-result editor placement, Add images, per-item retry/remove/download, clear-batch guard,
  and Download all ZIP presentation in both locales and approved desktop/narrow viewports;
- quality/model selection captured per admitted item, FIFO single-heavy-job processing, responsive
  selection while work continues, and preservation of each document's history, drafts, settings,
  previews, and artifacts when selection changes;
- typed batch projection/intents at the presentation boundary. React renders bounded summaries and
  emits intents; files, blobs, pixels, URLs beyond runtime-owned preview handles, actors, workers,
  controllers, and mutable workflow state remain behind runtime owners;
- deterministic behavioral, accessibility, visual, resource-lifecycle, and serialized real-model
  evidence for mixed success/failure, incremental admission, retry/remove, selection, individual
  PNG export, and privacy-neutral ZIP export without reinference or redundant encoding.

The rendered v1 batch workspace is the normative presentation reference. Phase 39's truthful
single-image copy exception ends once batch admission is reachable; empty/input copy and controls
must return to their v1 batch-capable form. The existing deferred v2 editor-tool presentation
remains the only accepted visual difference in result/editing states and keeps dedicated reviewed
baselines until its own slice. No general screenshot tolerance or masked product UI is allowed.

Phase 40 does not restyle Manual/Magic Cutout, Background, or Enhancements; migrate scenario/public
route bindings; remove legacy code; add persistence/backend behavior; change model families; or
authorize public cutover. Phase-37/38 batch route journeys return to the active regression lane and
must be adapted only where the Phase-39 main-page presentation contract changed their locators or
state entry. Managed-Windows complete-product acceptance remains assigned to the later full-UI
cutover gate.

### 2.10 Active v2 scope — Phase 41

Phase 41 removes the last accepted presentation exception on the separate bilingual noindex v2
routes by reproducing the established v1 editor-tool workspace over the accepted Phase-34–36
Manual, Magic, Background, Enhancement, history, artifact, and worker ownership. This is one
cohesive presentation slice because the v1 stage, toolbar, tool rail, draft guards, history actions,
and responsive layout are shared by every tool; temporary per-tab shells or duplicated adapters are
not accepted.

The dependency-complete slice covers:

- the v1 result-editor hierarchy, stage sizing, transparent preview treatment, desktop/narrow tool
  rail, Cutout/Enhancements/Background navigation, history actions, download placement, focus
  restoration, dirty-draft guards, and localized status/error presentation;
- the complete Cutout presentation: Magic Keep/Remove prompting, candidate preview/refinement and
  explicit Apply/Cancel, plus Manual Restore/Erase, brush sizing, zoom/pan/fit, local draft history,
  and committed document history without changing the accepted tool semantics;
- the complete v1 Enhancements and Background panels, including truthful queued/running/no-change/
  error states, refinement choices, transparent/colour/gradient/custom-image fills, immediate draft
  preview, explicit Apply/Cancel/retry, and export bound only to the committed document;
- an immutable bounded `EditorToolWorkspaceProjection` and exhaustive typed
  `EditorToolWorkspaceIntent` boundary. Shared controller-neutral visual components may be rendered
  by legacy and v2 adapters, but they may not import legacy hooks, mutable stores, workers, runtime
  controllers, or become another workflow state owner;
- deterministic bilingual behavior, accessibility, exact visual comparison, resource lifecycle,
  and serialized real-model evidence for every tool on approved desktop/narrow viewports, including
  batch item switching with retained drafts/history and zero sibling mutation or reinference.

The rendered v1 editor-tool workspace is the normative presentation reference. Phase 39/40's
deferred-tool-UI exception ends in Phase 41; no masked product UI, general pixel tolerance, or
unexplained layout/copy difference is accepted. Truthful v2-only progress/error detail may differ
only when the phase records and reviews a dedicated state baseline without changing the surrounding
v1 hierarchy.

Phase 41 does not migrate `/`, `/en`, or scenario-route bindings; remove legacy behavior; change
tool algorithms, model families, worker/runtime ownership, persistence, privacy, or export formats;
add paid/backend behavior; or authorize public cutover. Complete managed-Windows product acceptance
and route cutover remain separately gated follow-up phases after the isolated full UI is accepted.

### 2.11 Completed v2 validation — Phase 42

Phase 42 repeats cutover-readiness validation against the now presentation-complete isolated v2
routes. It closes the evidence gaps identified by Phase 38 and produces an explicit `ready` or
`blocked` decision for planning a later public-route cutover. It is an acceptance and bounded
defect-closure phase, not the cutover itself.

The dependency-complete validation covers:

- one frozen bilingual complete-product matrix over picker/drop/paste, validation, quality/model
  selection, automatic removal/fallback, single/batch workflows, Manual/Magic Cutout, Background,
  Enhancements, history, responsive layout, selected PNG/ZIP export, recovery, privacy, and cleanup;
- exact v1-faithful desktop/narrow presentation evidence from Phases 39–41 plus truthful v2-only
  status details; no product control, copy, route, or material state may be masked or silently
  omitted;
- one zero-retry deterministic full-workflow journey, one serialized real-model journey, and a
  managed-Windows Chromium sample covering keyboard, fine/coarse pointer where available, actual
  200% browser zoom/reflow, announcements, scroll/control responsiveness, cold/warm behavior, and
  resource ownership;
- explicit capture of long-task and event-to-next-paint signals where the environment exposes them,
  plus fail-closed `unsupported` evidence where it does not. Host/WSL timings may not substitute for
  managed-Windows observations;
- a versioned Phase-42 report derived from the existing readiness/performance evidence model, with
  every requirement linked to deterministic, real-model, managed-device, or architect evidence and
  a final `ready`/`blocked` conclusion.

Architect testing after Phase 41 also makes the following regression closure part of Phase 42:

- automatic-removal and Enhancement heavy stages keep scroll, controls, and unrelated browser
  interaction responsive; the presentation migration must not reintroduce synchronous full-image
  work, high-frequency React/XState updates, duplicate subscriptions, or avoidable render churn;
- Magic and Manual share one stable stage geometry and source-coordinate mapping. Their brush cursor
  is circular at every rendered scale, pointer strokes remain responsive, and brush-size changes do
  not rebuild image/runtime state;
- the user-facing Magic flow exposes only Apply and Cancel. Apply predicts, automatically selects
  the highest-ranked valid candidate, and commits it through the accepted correlated runtime flow;
  candidate choice, Predict, local stroke-history buttons, and the stroke/candidate status block are
  not product UI. The common editor toolbar owns contextual Undo/Redo for active draft gestures and
  committed document history;
- switching between Magic and Manual, and applying or cancelling either tool, never changes the
  stage size/crop or implicitly selects another tool;
- Background and Enhancement Apply/Cancel keep their current tool selected, and successful Apply
  remains visible as the committed document result instead of navigating to Cutout or losing it.

Phase 42 may fix only defects that violate the already accepted Phase-33–41 contracts. A new product
capability, architecture/data/API/env change, model-policy change, route migration, or production
behavior change becomes a blocker or separately scoped follow-up. Public `/`, `/en`, scenario-route
bindings, indexing, analytics, and legacy ownership remain unchanged. A `ready` conclusion
authorizes planning a later cutover phase; it does not perform that cutover or authorize legacy
removal.

### 2.12 Completed pre-production cutover — Phase 43

Phase 43 completed the public cutover and legacy removal. It converted the accepted isolated v2
editor into the sole public editor implementation without redesigning the public experience or
weakening the Phase-33–42 ownership, privacy, accessibility, responsiveness, and resource
contracts.

The dependency-complete phase covers:

- freeze a route/component/dependency inventory for `/`, `/en`, all eight localized scenario
  routes, `/editor-v2`, `/en/editor-v2`, and the legacy editor modules. Every removal must be proven
  unreachable from retained production, test, internal-tool, and build entry points before deletion;
- close the Phase-42 unsupported absolute-duration evidence on the actual public v2 route contract,
  or obtain one explicit architect disposition for each still-unsupported signal. The waived
  Phase-32 upload-preparation timing belongs to the removed legacy path and does not become v2
  readiness evidence;
- bind `/`, `/en`, and all localized scenario pages to the accepted v2 editor composition while
  preserving their locale, content, metadata, canonical/hreflang, structured data, analytics,
  privacy, responsive layout, and v1-faithful editor behavior. No route may retain a hidden legacy
  workflow or select implementations by accidental environment state;
- retire `/editor-v2` and `/en/editor-v2` as duplicate migration surfaces by deterministic
  locale-preserving redirects to the corresponding public root after cutover. Keep internal model
  tooling noindex; remove the legacy `/dev/remove-background` harness with its legacy runtime;
- delete superseded legacy editor hooks, stores, workers, controllers, components, tests, fixtures,
  exports, and dependencies once reachability checks prove they have no retained consumer. A pure
  policy or shared presentation primitive may remain only when it has an explicit current v2,
  public-page, or internal-tool owner and no legacy workflow state/lifecycle dependency;
- update route, sitemap/robots, service-worker/cache, CSP/build, E2E, profiling, operations,
  rollback, and documentation contracts for v2-only production. Rollback uses the previous
  immutable production image/release, not a dormant legacy implementation or runtime feature flag;
- run bilingual deterministic public-route journeys, serialized real-model/CDN smoke, managed-
  Windows accessibility/responsiveness/resource verification, production build/container smoke,
  security/supply-chain checks, and a rollback rehearsal. The final report must conclude `ready`
  with no unresolved cutover blocker before deployment is authorized.

Phase 43 adds no account, backend, server image processing, persistence, remote fallback, model-
family change, export format, environment key, or product redesign. It prepares a release candidate
but does not deploy it to production; deployment remains an explicit post-merge operator action.

### 2.13 Frontend decomposition and render ownership — Phase 44

Phase 44 is one refactoring phase with architect checkpoints after each dependency-complete task.
It preserves the accepted UI, behavior, routes, product capabilities, domain commands, worker
protocols, artifact ownership, privacy, models, and exports while rebuilding the public frontend
composition from existing components with smaller ownership boundaries.

Its stable checkpoint order is `T2` cleanup, `T3` shell/composition, `T4` upload/mode selection,
`T5` single-image processing/result/export, `T6` active document and editor tools, `T7` narrow
subscriptions and selective memoization, `T8` state-manager decision, then `T1` final evidence and
gate. `/impl-assist 44 <ID>` targets one checkpoint and must stop after focused verification; the
architect manually accepts it before a checkpoint commit and before the next task starts.

The phase covers:

- archive completed phase evidence and remove only source, tests, exports, profiling helpers, or
  adapters whose retained consumers and operational references have been traced first; Git tag
  `v0.43.0` remains the recoverable source snapshot, so obsolete production code is deleted rather
  than moved under a compilable `src/archive` tree;
- decompose the page shell and route-neutral public composition, then upload/mode selection,
  single-image processing/result/export, batch, active-document, and editor-tool surfaces into
  focused components with explicit render owners;
- move XState and external-store subscriptions near their leaf consumers, select primitive or
  stable-identity values, avoid freshly allocated broad projections at high-level parents, and
  stabilize callbacks or derived objects only where they cross a meaningful memoization boundary;
- keep pointer movement, brush preview, pan/zoom, canvas pixels, binary artifacts, object URLs,
  workers, and other high-frequency/runtime resources outside broad React state and actor snapshots;
- retain XState/application as the sole durable workflow source of truth. Another state manager,
  including MobX, requires a late isolated spike and architect decision showing a remaining problem
  after decomposition, a measurable benefit, one-way ownership, and no mirrored workflow state;
- use the focused `review-v2-architecture` mode and task-specific unit/component/Playwright checks
  during checkpoints. The architect manually reviews and accepts each task before its checkpoint
  commit; full architecture, performance, real-model, security, container, and release evidence is
  deferred to the final task and phase gate;
- finish with end-state render/subscription inspection, Chrome performance/resource evidence,
  repeated workflow churn, full automated gates, and architect acceptance. The phase deliberately
  has no mandatory pre-refactor render-counter or trace baseline; it proves the final acceptance
  state rather than claiming a numeric before/after improvement.

Phase 44 introduces no new route, user-visible capability, model family, server endpoint, persisted
state, environment variable, payment/backend behavior, or production deployment. Refactoring must
not trade correctness, accessibility, or lifecycle ownership for fewer React renders.

### 2.14 Future paid direction

The architecture must permit explicit paid server processing without coupling the free editor to a
provider. Candidate capabilities are faster/higher-quality removal and AI backgrounds generated
from a prompt or subject context. Future phases must choose and contract authentication,
entitlements, billing, quotas, job orchestration, storage/retention/deletion, moderation, provider
models, observability, support, and legal disclosures. No such runtime is authorized by this spec.

Permanently excluded: advertising on `cutbg.art`. A broader Studio product—layers, object transforms,
templates, text, shadows, perspective—is a separate track after the focused workflow is stable.

## 3. Domain model and invariants

[`ARCHITECTURE_V2.md`](./ARCHITECTURE_V2.md) is the detailed architecture decision. The normative
v2 vocabulary is:

```ts
type DocumentId = string;
type ArtifactId = string;
type RunId = string;
type Revision = number;
type ProcessingBackend = "local" | "remote"; // remote is reserved, not implemented
type AutomaticModelMode = "isnet-q8" | "isnet-fp32" | "ben2-fp16";
type ExportSize = "original" | 2048 | 1024;

type MainPageEditorIntent =
  | { type: "choose-files"; files: readonly File[] }
  | { type: "choose-quality"; mode: AutomaticModelMode }
  | { type: "cancel" }
  | { type: "retry" }
  | { type: "reset" }
  | { type: "choose-export-size"; size: ExportSize }
  | { type: "download-selected" };

type MainPageEditorProjection = {
  locale: "ru" | "en";
  phase:
    | "empty"
    | "preparing"
    | "loading-model"
    | "processing"
    | "result"
    | "error";
  qualityMode: AutomaticModelMode;
  exportSize: ExportSize;
  progressPercent: number | null;
  retryable: boolean;
  sourcePreviewUrl: string | null;
  committedResultUrl: string | null;
};

type HexColor = `#${string}`;
type BackgroundFillDescriptor =
  | { type: "transparent" }
  | { type: "color"; value: HexColor }
  | {
      type: "gradient";
      kind: "linear" | "radial";
      stops: readonly [
        { offset: 0; color: HexColor },
        { offset: 1; color: HexColor },
      ];
    }
  | { type: "image"; artifactId: ArtifactId };

type DocumentSnapshot = {
  matte: ArtifactId;
  foreground: ArtifactId | null;
  composite: ArtifactId;
  background: BackgroundFillDescriptor;
};

type ProcessingError = {
  code: string;
  message: string;
  retryable: boolean;
};

type ManualCutoutMode = "restore" | "erase";
type ManualDraftId = string;
type MagicCutoutMode = "keep" | "remove";
type MagicDraftId = string;
type MagicCandidateId = string;
type BackgroundDraftId = string;
type EnhancementDraftId = string;
type EnhancementOperationId = "fine-detail" | "colour-halo";
type EditOperationId = string;

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

type ActiveToolDraft =
  | ManualCutoutDraft
  | MagicCutoutDraft
  | BackgroundDraft
  | EnhancementDraft;

type DocumentHistoryEntry = {
  operationId: EditOperationId;
  kind: "manual-cutout" | "magic-cutout" | "background" | "enhance";
  before: DocumentSnapshot;
  after: DocumentSnapshot;
  estimatedHistoricalBytes: number;
};

type DocumentHistory = {
  past: readonly DocumentHistoryEntry[];
  future: readonly DocumentHistoryEntry[];
  retainedHistoricalBytes: number;
};

type WorkspaceItemId = string;
type WorkspaceItemStatus =
  | "preparing"
  | "queued"
  | "model-loading"
  | "processing"
  | "result"
  | "error";

type WorkspaceItemSummary = {
  itemId: WorkspaceItemId;
  documentId: DocumentId | null;
  fileName: string;
  status: WorkspaceItemStatus;
  error: ProcessingError | null;
};

type WorkspaceState = {
  documentIds: readonly DocumentId[];
  selectedDocumentId: DocumentId | null;
};

type EditorWorkspaceSnapshot = {
  itemIds: readonly WorkspaceItemId[];
  selectedDocumentId: DocumentId | null;
  items: readonly WorkspaceItemSummary[];
};

type BatchMainPageItemProjection = {
  itemId: WorkspaceItemId;
  documentId: DocumentId | null;
  fileName: string;
  status: WorkspaceItemStatus;
  error: { message: string; retryable: boolean } | null;
  previewUrl: string | null;
  queuePosition: number | null;
  qualityMode: AutomaticModelMode;
  selected: boolean;
};

type BatchMainPageProjection = {
  items: readonly BatchMainPageItemProjection[];
  capacity: { current: number; limit: 20 };
  admissionError: { code: "capacity-exceeded"; rejectedCount: number } | null;
  counts: {
    active: number;
    queued: number;
    completed: number;
    failed: number;
  };
  export: BatchExportSnapshot;
};

type BatchMainPageIntent =
  | { type: "add-files"; files: readonly File[] }
  | { type: "select-item"; documentId: DocumentId }
  | { type: "retry-item"; itemId: WorkspaceItemId }
  | { type: "remove-item"; itemId: WorkspaceItemId }
  | { type: "download-item"; documentId: DocumentId }
  | { type: "clear-batch" }
  | { type: "cancel-download-all" }
  | { type: "download-all" };

type EditorToolId = "cutout" | "enhance" | "background";
type CutoutPresentationMode = "magic" | "manual";

type EditorToolWorkspaceProjection = {
  locale: "ru" | "en";
  documentId: DocumentId;
  revision: Revision;
  activeTool: EditorToolId;
  cutoutMode: CutoutPresentationMode;
  canUndoDocument: boolean;
  canRedoDocument: boolean;
  dirtyDraft: boolean;
  busy: boolean;
  sourcePreviewUrl: string;
  committedResultUrl: string;
  width: number;
  height: number;
  manualDraft: ManualCutoutDraft | null;
  magicDraft: MagicCutoutDraft | null;
  backgroundDraft: BackgroundDraft | null;
  enhancementDraft: EnhancementDraft | null;
};

type EditorToolWorkspaceIntent =
  | { type: "choose-tool"; tool: EditorToolId }
  | { type: "choose-cutout-mode"; mode: CutoutPresentationMode }
  | { type: "undo-draft" | "redo-draft" | "undo-document" | "redo-document" }
  | { type: "predict-magic" | "apply-active-tool" | "cancel-active-tool" |
      "retry-active-tool" | "download-committed" | "leave-workspace" }
  | { type: "choose-background"; fill: BackgroundFillDescriptor }
  | { type: "choose-enhancements"; operationIds: readonly EnhancementOperationId[] };

const WORKSPACE_ITEM_LIMIT = 20;
const IMPORT_PREPARATION_CONCURRENCY = 2;
```

Core rules:

- A workspace owns ordered document membership/selection and one child actor per document; each
  document actor is the sole writer for that document and owns at most one active commit.
- Commands and terminal events correlate `{ documentId, runId, expectedRevision }`. Stale,
  cancelled, duplicate, cross-document, or wrong-revision results cannot commit.
- Actor/domain state contains IDs and small serializable metadata only. Blobs, bitmaps, pixel/tensor
  buffers, object URLs, model sessions, workers, HTTP clients, provider objects, and React values stay
  in adapters/repositories outside actor state.
- `ArtifactRepository` owns binary artifacts, leases, object URLs, budgets, and disposal. Every
  success, failure, cancellation, reset, replacement, and teardown has a deterministic release path.
- `ProcessingGateway` is the application port. Phase 33 implements only its local worker-backed
  adapter; a future remote adapter must preserve the same domain outcomes without leaking transport
  or provider concepts into the editor.
- Expensive decode, transforms, inference, post-processing, compositing, and PNG encoding stay off
  the main interaction path. Global backpressure defaults to one heavy GPU job.
- Export reads the committed composite. It never triggers inference or synchronous full-image
  reconstruction.
- A manual draft is runtime-owned mutable state identified in the actor only by `ManualDraftId`,
  document ID, baseline revision, and dirty metadata. Full alpha planes, dirty-rectangle patches,
  canvas/image buffers, and object URLs never enter React or actor snapshots.
- Draft gesture Undo/Redo and committed document Undo/Redo are separate histories. Applying a draft
  creates one committed operation regardless of gesture count; cancelling creates none.
- A document owns at most one active tool draft. Manual, Magic, Background, and Enhancement keep
  separate tool-specific runtime state; their discriminated actor metadata does not imply one
  shared mutable draft store.
- Every tool apply/undo/redo commit increments revision. Commands against a stale baseline are
  rejected, and a new commit after document Undo releases the unreachable redo branch.
- Magic draft mutations increment `draftRevision`. Prediction is a preview operation, not a document
  commit, and may publish only when both baseline and draft revision still match.
- Background preview is uncommitted runtime state. Export, document Undo/Redo, and reopening a tool
  read only the committed snapshot descriptor; a custom image remains an artifact with explicit
  leases across the current snapshot and reachable history.
- Enhancement operations run in a fixed registry order from one captured committed baseline and
  publish atomically. Intermediate matte/foreground buffers remain runtime-owned and are discarded
  on cancellation, failure, staleness, or a no-op outcome.
- Automatic removal, Magic model work, and heavy Enhancement stages share one heavy-job admission
  boundary. Tool-specific workers may own their protocols and sessions, but they may not bypass
  global scheduling, cancellation, or backpressure.
- React renders narrow selectors and sends commands. Component lifecycle is an adapter signal, not
  workflow truth.

Legacy runtime models such as `SourceImage`, `AlphaMatte`, `ProcessedImage`, `EditDocumentScope`, and
`BatchItemError` remain historical migration vocabulary through Phase 42. Phase 43 removed their
production workflow implementations after proving that retained v2/shared/internal-tool code has no
runtime dependency on them; their definitions and history remain preserved in Git and archived
SPEC/STATE snapshots.

## 4. Data, privacy, and security

### 4.1 Current product

- The app owns no server database, account, uploaded-image endpoint, or result storage.
- Images, mattes, prompts, edits, composites, exports, and v2 artifacts are browser-tab memory only.
- `localStorage` stores only the legacy `qualityMode: "fast" | "max"` preference.
- Cache Storage may contain only immutable public model and ONNX Runtime assets. Partial range probes
  are not cached; source images and editor artifacts never enter the model cache.
- Umami's PostgreSQL schema belongs to the separately operated analytics service, not this app.
- Analytics must not intentionally include images, pixels, filenames, prompt coordinates, or custom
  visitor identifiers. Legal classification and actual vendor/request behavior require periodic
  verification.
- No hardcoded secrets. Public build-time values and server-only secrets must be separated through
  typed config boundaries. Server secrets must never enter client output.
- Published dependencies, containers, model assets, and release artifacts retain the existing
  integrity, SBOM, attestation, vulnerability-disclosure, cache lifecycle, rollback, and incident
  controls documented under `docs/security/`, `docs/operations/`, and `docs/runbooks/`.

### 4.2 Future remote mode

Remote mode must be an explicit product choice with truthful disclosure before transfer. A dedicated
phase must define data inventory, lawful basis/consent where applicable, access controls, encryption,
signed upload/download, isolation, minimal retention, deletion guarantees, logs without image
content, abuse controls, incident response, data residency, subprocessors, and user rights. Local
processing remains available and may never silently fall back to remote.

## 5. Interfaces and frontend

### 5.1 Current network surface

The app serves SSR/static HTML and published assets; it exposes no image-processing API.

| Surface | Contract |
|---------|----------|
| `/`, `/en` | Main localized product page and editor |
| Four Russian scenario routes and four `/en/...` counterparts | Reused editor plus scenario-specific content and structured data |
| `/about`, `/en/about`, `/privacy`, `/en/privacy` | Static localized information/legal pages |
| `/dev/model-lab` | Retained internal noindex model/matting evaluation surface, enabled only by its existing exact-`true` flag |
| `/editor-v2`, `/en/editor-v2` | Locale-preserving redirects to `/` and `/en/`; `/dev/remove-background` is removed |
| `/sitemap.xml`, `/robots.txt`, `/.well-known/security.txt` | Discovery and vulnerability-disclosure assets |
| `https://cdn.cutbg.art/models/{manifest-path}` | Pinned public model/runtime assets with CORS, ranges, and immutable caching |

### 5.2 Frontend boundaries

The sole public editor implementation is organized under:

```text
src/v2/
  domain/             pure types, transitions, invariants
  application/        actors, commands, ports, use cases
  runtime-browser/    artifacts, workers, local processing adapters
  presentation/       route composition, selectors, UI adapters
  shared/ui/          v2 reusable presentation primitives
  shared/lib/         consumed cross-cutting wrappers only
  testing/            fakes, fixtures, model-based helpers
```

All frontend work follows [`FRONTEND_CONVENTIONS.md`](./FRONTEND_CONVENTIONS.md). In particular:

- modules expose intentional public APIs and depend inward; domain/application do not import React,
  router, browser globals, inference providers, or UI libraries;
- `Typography` separates semantic element from finite visual variants;
- `Image` has typed content/hero/preview/thumbnail presets, intrinsic/aspect/object-fit policy,
  accessible alt/decorative semantics, and explicit loading/decoding/fetch-priority defaults;
- only `shared/config/env.ts` reads `import.meta.env`; `runtime.ts` owns dynamically testable SSR-safe
  runtime detection;
- browser storage, object URLs, abort/error mapping, image decode/metadata, router, capabilities, and
  worker access go through tested owners/wrappers when consumed—no speculative utility layer;
- user-facing changed flows receive Playwright coverage in addition to focused unit/component tests.

Public pages remain fully localized in Russian and English, keyboard operable, screen-reader
meaningful, responsive, and SSR-safe. No essential action may depend only on hover, color, pointer
precision, or an unannounced status change.

The accepted Phase-43 public editor is the normative visual and interaction reference for Phase 44.
Unless a later architect-approved spec change says otherwise, Phase 44 must preserve component placement,
visual hierarchy, labels, responsive behavior, controls, and reachable states. Internal actors,
commands, projections, processing, and resource ownership may change; visible product behavior may
not silently change with them. Capture reference screenshots before each UI slice, compare both
locales at approved desktop and narrow viewports, and treat unexplained visual drift as a failing
contract rather than a redesign opportunity.

An incremental slice is compared only across presentation it owns. Truthful copy required by that
slice and UI owned by an explicitly deferred slice may differ only when its active phase contract
names the difference and retains a reviewed dedicated baseline. This exception is narrow: it never
permits masking, unexplained tolerance, or silently dropping reachable behavior.

Shared presentation is preferred over copied markup. Legacy visual components may be extracted and
made controller-neutral, but they may not retain or import legacy hooks, mutable stores, workers, or
workflow state when rendered by v2. The adapter boundary accepts serializable view projections and
emits typed user intents; v2 application/runtime owners remain the only workflow source of truth.

For Phase 34, pointer capture/cancel/lost-capture produces at most one deterministic gesture patch;
brush edits use source-image coordinates across zoom/pan; Ctrl/Cmd+Z and redo variants affect the
active draft while Manual is open and otherwise affect committed document history. Apply and Cancel
remain explicit, keyboard reachable actions, and navigation/reset cannot silently discard a dirty
draft.

For Phase 35, the same pointer/capture and source-coordinate rules apply to Magic strokes. Keep and
Remove semantics, active-draft limits, prediction progress, preview availability, retryability, and
the distinction between Predict and Apply are visible and localized. Keyboard Undo/Redo targets the
active Magic draft while it is open; candidate prediction never steals document-history shortcuts or
silently commits.

For Phase 36, Background selection previews immediately but Apply and export remain visibly
distinct: downloads never include an uncommitted fill. Custom-image validation/preparation and every
Enhancement stage expose localized progress/errors without blocking navigation controls. While a
Background or Enhancement draft is active, its controls own only tool-local changes; document
Undo/Redo remains unavailable until Apply/Cancel resolves the draft, and reset/navigation cannot
silently discard it.

For Phase 37, multiple-file/add-image input and document selection are explicit. The filmstrip/list
announces per-item and aggregate status, keeps selection keyboard reachable, and never substitutes a
different document while the selected one is queued or fails. Switching items preserves each
document's committed state, draft, history, viewport, and accessible focus intent without
reinference. Remove/reset and Download All confirm or disable actions truthfully when dirty,
running, unfinished, or failed items are involved.

For Phase 43, public and scenario pages compose the same v2 editor implementation and retain their
existing localized content and SEO contracts. The migration routes redirect to the matching public
locale, and no retained route, component, test helper, worker, or export may instantiate the legacy
editor workflow. Removal is reachability-driven: shared visual or pure policy code stays only when a
current owner is explicit.

For Phase 44, render ownership belongs to the smallest component that needs a value. Page and
workspace composition must not subscribe to state used only by a descendant, aggregate unrelated
local UI concerns, or recreate broad projections on every publication. Memoization is selective:
stable selectors, props, callbacks, and derived identities come first; `memo`, `useMemo`, and
`useCallback` are used at proven component boundaries rather than applied mechanically. XState and
runtime external stores remain the default state mechanisms. Any MobX experiment stays isolated
until the architect accepts its ownership contract and final evidence.

## 6. Stack and runtime configuration

[`STACK.md`](./STACK.md) is authoritative for versions, commands, repository layout, gates, and
deployment. The approved v2 direction keeps React/TypeScript, TanStack Start/Router, Vite, Tailwind,
Vitest, Playwright, ONNX Runtime/Transformers.js, and workers; adds XState v5 for workflow actors.
TanStack Query is reserved for future server state and must not own local editor workflow state.

Current environment contract:

| Key | Purpose |
|-----|---------|
| `VITE_MODEL_CDN_BASE_URL` | Preferred immutable model asset base; upstream fallback remains local processing |
| `VITE_ENABLE_MODEL_LAB` | Exact `true` enables the internal lab; otherwise disabled |
| `VITE_UMAMI_SCRIPT_URL`, `VITE_UMAMI_WEBSITE_ID`, `VITE_CF_BEACON_TOKEN` | Public analytics configuration |
| `UMAMI_APP_SECRET`, `UMAMI_DATABASE_URL`, `POSTGRES_PASSWORD` | Server-only analytics service secrets/config |
| `APP_BUILD_ID`, `APP_COMMIT_SHA` | Immutable production release identity |
| `PORT`, `NODE_ENV` | Standard server runtime configuration |

Phases 33–37 add no environment variable. Future backend technology is deliberately undecided; current
candidates and decision criteria are recorded in `ARCHITECTURE_V2.md`, not an implementation mandate.

## 7. Non-functional acceptance

### 7.1 Responsiveness and resources

For the Phase-33 target browser/device:

- zero application-attributable main-thread tasks `>= 50 ms` during the critical flow;
- pointer, scroll, and unrelated-control event-to-next-paint p95 `< 100 ms` during every heavy stage;
- no missed/duplicated action, hidden auto-apply, stale flash, export reinference, or page-scroll lock;
- bounded artifacts, object URLs, workers, model sessions, and listeners after repeated
  import/cancel/retry/reset/unmount cycles;
- truthful preparing/loading/queued/processing/cancelling/result/error states and terminal cancel;
- target-device traces and serialized real-model smoke are required; headless timing alone cannot pass.

Public targets remain LCP `< 2.5 s`, INP `< 200 ms`, home TTI `< 2.5 s` on average 4G, and processed
result after a warm model `< 2 s` on WebGPU / `< 8 s` on WASM where supported. If historical targets
conflict with measured feasibility, the architect must approve a documented revision; they are not
silently weakened.

### 7.2 Reliability and errors

Validate input type, size, and dimensions. Every model/CDN/runtime/worker/decode/OOM/cancel/export
failure produces a typed, localized, actionable state with retryability. Failed, cancelled, stale,
or superseded work does not commit. Retries start fresh correlated runs without destroying unrelated
successful documents. Unsupported WebGPU falls back transparently to WASM; remote processing is not
a fallback.

### 7.3 Verification

Implementation proceeds in dependency-complete, tested increments. Required coverage is
proportional to the boundary:

- pure transition/invariant and model-based actor tests;
- artifact/worker/gateway contract tests, including cancellation, crash, correlation, transfer, and
  zero reachable leases after churn;
- shared config/runtime/UI/lib unit and component tests, including SSR and invalid inputs;
- deterministic bilingual Playwright for changed user flows;
- serialized real-model smoke and architect target-device verification;
- repository lint, typecheck, architecture checks, build, container smoke, dependency/license/model/
  security checks declared by [`STACK.md`](./STACK.md) and the active phase.

Test code is production code and follows the same modularity, naming, ownership, public-API, cleanup,
and review requirements as runtime code:

- tests assert observable contracts and domain outcomes, not private implementation steps;
- deterministic fakes use the same typed ports/protocols as production adapters; no global worker,
  timer, random, clock, storage, network, or browser state may leak between tests;
- Playwright uses isolated contexts, composable typed fixtures, explicit setup/teardown, reusable
  journey/component objects where they remove duplication, accessibility-first locators, web-first
  assertions, and failure-only traces. Monolithic page objects and generic test-helper dumping
  grounds are forbidden;
- the fast E2E lane uses deterministic local worker/model doubles and remains parallel-safe; real
  model/CDN/WebGPU checks are a small, explicitly serialized smoke lane and never get duplicated
  across ordinary UI scenarios;
- unit/contract tests use builders and fixtures with safe defaults, fake time/IDs at application
  ports, table/model-based coverage where appropriate, and mandatory mock/listener/resource cleanup;
- arbitrary sleeps, order dependence, shared mutable fixtures, retry-as-correctness, broad snapshots,
  duplicated setup, brittle CSS/XPath selectors, and assertions against incidental copy are not
  accepted;
- suite duration, slowest tests, flake/retry count, and deterministic seed/config are recorded as
  quality signals. A retry can collect diagnostics, but an intermittently passing test is a defect.

Performance verification is a modular product subsystem, not scattered `page.evaluate` snippets.
V2 must expose typed marks/measurements, a browser collector, deterministic test adapter, report
schema, budgets, and cleanup. Existing Phase-31/32 scripts are evidence and design input only; reuse
requires a code-quality and signal-validity review. Field Core Web Vitals, lab interaction/resource
budgets, and target-device traces are complementary signals and must not be substituted for one
another.

Automated green does not replace architect review. Phase 33 cannot pass if the affected browser still
freezes, evidence is skipped, an invariant is violated, or review notes remain unresolved.

Phase 34 additionally fails if a brush gesture causes a full-image React/XState update, untouched
alpha changes, Cancel mutates committed history, Apply creates more than one operation, Undo/Redo
leaks or resurrects pruned artifacts, export reinfers, a dirty draft is silently lost, or the
accepted Phase-33 responsiveness/resource budgets regress.

Phase 35 additionally fails if live strokes or per-stroke points are unbounded; embeddings,
candidate mattes, prompt buffers, or preview pixels enter React/XState state; encoding or prediction
implicitly commits; a stale/cancelled prediction publishes; Apply creates anything other than one
`magic-cutout` history operation; Cancel mutates committed state; automatic and Magic heavy jobs run
without shared admission/backpressure; or accepted Phase-33/34 contracts regress.

Phase 36 additionally fails if a Background preview changes the committed snapshot or export;
custom-image bytes/object URLs enter React/XState; Apply encodes more than once or creates anything
other than one `background` history operation; a selected Enhancement stage publishes partial
document state; a no-op/cancelled/failed/stale run changes revision/history; Enhancement bypasses
shared heavy-job admission; Undo/Redo loses the committed fill descriptor or leaks its image
artifact; or accepted Phase-33–35 contracts regress.

Phase 37 additionally fails if the workspace becomes a second document-state writer; selecting a
completed item decodes/reinfers/reconstructs it; one item failure/cancel/remove mutates a sibling;
queued or active heavy work bypasses global admission; files/pixels/URLs/native runtime values enter
actor/React batch state; Download All includes unfinished/error/private source metadata or repeats
inference/encoding; per-document or whole-workspace churn leaks actors, controllers, workers,
artifacts, URLs, listeners, or sessions; or accepted Phase-33–36 contracts regress.

Phase 39 additionally fails if the noindex v2 main-page slice visibly drifts from the captured v1
reference outside its two explicitly accepted slice-boundary differences; either accepted difference
lacks a dedicated reviewed baseline; picker/drop/paste or quality/export-size controls are present
but disconnected; shared presentation imports legacy workflow state; processing/export reinfers or
bypasses accepted v2 ownership; bilingual desktop/narrow visual evidence or the serialized local
real-model journey is missing; or the public/scenario routes change before the isolated slice is
accepted.

Phase 40 additionally fails if multi-file admission is absent, silently drops files, exceeds the
20-item bound, or bypasses bounded preparation and global heavy-job admission; batch presentation
visibly drifts from v1 outside the explicitly deferred tool workspace; selection/retry/remove or
quality changes mutate a sibling or reconstruct/reinfer a completed document; files/pixels/native
runtime values enter presentation or actor snapshots; individual/ZIP export includes private source
metadata, unfinished/error items, reinfers, or redundantly re-encodes committed results; route-level
Phase-37/38 batch evidence remains disabled; resource churn leaks; or public/scenario routes change.

Phase 41 additionally fails if the result-editor stage, toolbar, tool panels, controls, responsive
layout, focus/keyboard behavior, or reachable tool states visibly drift from v1 without one
explicitly reviewed truthful-state baseline; shared presentation imports legacy workflow ownership;
Manual/Magic/Background/Enhancement changes bypass their accepted v2 controllers, correlations,
draft/history rules, heavy-job coordinator, or artifact lifecycle; a dirty draft is silently lost;
selection mutates or reinfers a sibling; export includes an uncommitted draft; exact bilingual
desktop/narrow evidence, serialized real-model evidence, or affected-device review is missing; or
public/scenario routes change.

Phase 42 additionally fails if the complete-product matrix is incomplete or stale; any required
outcome lacks deterministic, real-model, managed-Windows, or architect evidence; actual Windows
200% zoom/reflow, keyboard/focus/announcement, responsive interaction, cold/warm, or resource
evidence is skipped or replaced with WSL/headless inference; retries or arbitrary sleeps mask a
failure; any Phase-33–41 actor/runtime/artifact/presentation contract regresses; public/scenario
routes change; or the report concludes `ready` while any blocker, serious accessibility finding,
unsupported required signal, freeze, lost command, stale publication, cross-document mutation, or
reachable resource leak remains. It also fails if automatic removal or Enhancement Apply blocks
unrelated interaction; a brush is distorted, misses pointer input, or drives full-image projection
updates; Magic exposes manual prediction/candidate selection or separate stroke-history controls;
Apply/Cancel does not mutate exactly the intended draft/commit; switching or completing a tool
changes stage geometry or implicitly selects Cutout; or a Background/Enhancement commit is not
retained and displayed through the accepted v2 document actor and artifact ownership.

Phase 43 additionally fails if any public or scenario route still runs legacy workflow ownership;
route locale/content/metadata/canonical/hreflang/structured-data/analytics behavior regresses; the
migration routes expose duplicate indexable content instead of deterministic localized redirects;
the legacy remove-background harness or an unreachable legacy editor dependency remains; retained
code imports a deleted legacy boundary; the service-worker/cache/build output still references
removed chunks; a removal lacks reachability evidence; rollback depends on shipping dormant legacy
code; public-path deterministic, real-model, managed-Windows, accessibility, responsiveness,
resource, security, build/container, or rollback evidence is missing; the final readiness report is
not `ready`; or an unresolved architect review note remains. Production deployment is outside the
phase and is not authorized by a partial or waived gate.

Phase 44 additionally fails if the accepted public behavior or layout regresses; a large parent
retains subscriptions needed only by leaf controls; a new store mirrors XState workflow truth;
component decomposition moves browser resources into React; unstable projections or callback fan-
out continue to invalidate unrelated subtrees without explicit justification; a stale async result
can publish; changed resource owners leak; confirmed obsolete code is removed without reachability
evidence; any checkpoint lacks its focused checks or architect approval; or final render,
performance, resource, full-gate, and architect evidence is incomplete. Pre-refactor Chrome traces
and render counters are not required by this phase.

## 8. Delivery state and roadmap

| Phase | State | Meaning |
|-------|-------|---------|
| 01–31 | Complete / historical | Legacy product, operations, editor, design, and audit evolution; contracts archived under `archive/phases/` |
| 32 | Closed incomplete | Legacy stabilization stopped by architect decision; gate waived, no tag, known freezes remain |
| 33 | Complete | Editor v2 foundation and first local vertical slice; gate and architect acceptance passed |
| 34 | Complete | Bounded document history and exact Manual Cutout on v2; gate and architect acceptance passed |
| 35 | Complete | Guided Magic Cutout vertical slice; gate and architect acceptance passed |
| 36 | Complete | Background and Enhancements finishing workflow; gate and architect acceptance passed |
| 37 | Complete | Batch/multi-document v2 workspace; gate and architect acceptance passed; public routes remain unchanged |
| 38 | Complete / blocked result | Validation gate passed; visual/product/evidence blockers remain, so no public cutover |
| 39 | Complete | V1-faithful main-page shell and single-image input/process/export UI over v2; gate and architect acceptance passed |
| 40 | Complete | V1-faithful batch workspace UI over the accepted v2 workspace runtime; gate and architect acceptance passed |
| 41 | Complete | V1-faithful editor-tool workspace UI over accepted v2 Manual/Magic/Background/Enhancement runtimes; gate and architect acceptance passed |
| 42 | Complete / blocked result | Regression closure and complete-product evidence finished; one gate timing failure was explicitly waived, unsupported duration signals remain, and no public cutover is authorized |
| 43 | Complete / gate passed | Final pre-production phase: public/scenario routes use v2, legacy is removed, and release/rollback readiness is proven; no production deploy |
| 44 | Planned | One checkpoint-driven frontend decomposition and render-ownership phase; full evidence and gate run only after all refactoring tasks are architect-accepted |
| Later | Unscheduled | Production deployment is an explicit operator action after Phase 44 acceptance; post-deploy observation and paid backend work remain separately scoped |

Phase 44 changes implementation structure, not product scope. Paid work and production deployment
remain outside this track.

## 9. Deferred decisions

The following remain intentionally open until evidence and a dedicated phase exist:

- backend framework, deployment topology, GPU worker language/runtime, and provider/model;
- authentication, account recovery, authorization, entitlement, billing, tax/refund handling;
- job queue, idempotency, quotas, rate limits, storage, retention, deletion, backups, and residency;
- generated-background prompt/subject policy, moderation, provenance, and safety UX;
- remote API shape, versioning, SDK/public API policy, and operational SLOs;
- Studio product scope and timing;
- final legal/governance refresh after the implemented product and vendors are known.

Do not resolve these by convention or convenience. Record the decision in SPEC/STATE and scope it in
a phase before implementation.

## 10. Historical detail

The compact active contract intentionally omits phase-by-phase implementation narration, superseded
state machines, evaluation matrices, old roadmap permutations, and completed gate evidence. Nothing
was discarded:

- full pre-compaction specification: [`archive/contracts/SPEC_V1_27_FULL.md`](./archive/contracts/SPEC_V1_27_FULL.md);
- full tracker/history through Phase 32: [`archive/contracts/STATE_THROUGH_PHASE_32_FULL.md`](./archive/contracts/STATE_THROUGH_PHASE_32_FULL.md);
- phase/evidence map: [`archive/README.md`](./archive/README.md);
- original paths and every revision: Git history.

Archived documents explain why legacy code exists but do not authorize active scope.
