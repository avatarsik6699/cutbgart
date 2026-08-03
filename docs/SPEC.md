# TECHNICAL SPECIFICATION: BG Remove App

> Active product and system contract. Read this document, [`STATE.md`](./STATE.md),
> [`ARCHITECTURE_V2.md`](./ARCHITECTURE_V2.md), and the active phase before implementation.
> The complete pre-compaction v1.27 specification is preserved at
> [`archive/contracts/SPEC_V1_27_FULL.md`](./archive/contracts/SPEC_V1_27_FULL.md).
> Run `/spec-sync` whenever this file changes.

## Metadata

| Field | Value |
|-------|-------|
| Version | `v1.31` |
| Date | `2026-08-03` |
| Architect / owner | `v.godlevskiy` |
| Product | `cutbg` at `cutbg.art` |
| Internal project | `bg_remove_app` / BG Remove App |
| Stack | [`STACK.md`](./STACK.md) |
| Current contract/status | [`STATE.md`](./STATE.md) |
| Feedback | Telegram `https://t.me/+HaqBWI1A3vg4MWJi` |
| Privacy/legal contact | `avatarsik6699@gmail.com` |

## 1. Product contract

BG Remove App removes image backgrounds and supports finishing/export workflows. The deployed
editor is an anonymous browser-local product; the next implementation track rebuilds its critical
path around an explicit domain model before capabilities are migrated.

Three invariants govern every decision:

1. **The free tier is private and local by default.** Source images and derived pixels never leave
   the device. Remote processing may only be an explicit, disclosed paid action.
2. **Accounts, billing, and server image processing do not exist in the current product.** Each
   requires dedicated entitlement, security, legal/data, retention, deletion, abuse, and operations
   contracts before implementation.
3. **Responsiveness, indexability, and accessibility are functionality.** A visually correct result
   does not pass if the page freezes, actions are lost, resources leak, or public pages regress.

The accepted v2 implementation now covers one-image local automatic removal, bounded committed
history, exact Manual Cutout, preview/export, and safe cancel/retry/reset. The next vertical slice
migrates guided Magic Cutout while preserving those accepted contracts and continuing the
architecture refactor only where a second real tool proves a shared abstraction.

## 2. Scope and boundaries

### 2.1 Existing legacy capability

The repository currently contains:

- JPEG/PNG/WebP import, validation, clipboard/drop input, 20 MiB limit, and client downscale above
  4096 px on the longest side;
- browser inference through WebGPU with WASM fallback and immutable model assets from the model CDN;
- single and batch workflows, Cutout Magic/Manual correction, Enhancements, Background, committed
  undo/redo, transparent PNG export, size selection, and client-generated ZIP;
- Russian/English public and scenario pages, privacy/about pages, SEO metadata, analytics, security,
  deployment, rollback, and incident infrastructure;
- browser model/matting evaluation surfaces kept as internal, noindex tooling.

Phase 32 added useful legacy guards, item-owned edit state, structured batch failures, and resource
work, but did not eliminate real-browser model-load and Magic Apply freezes. It is closed incomplete,
not evidence that the legacy editor satisfies the responsiveness contract.

### 2.2 Implemented v2 foundation through Phase 34

Phases 33–34 built an isolated implementation under `src/v2/` and a separate noindex route. It
includes:

- framework-free IDs, snapshots, commands, events, invariants, and processing ports;
- one workspace actor and one XState document actor per imported image;
- an artifact repository for binary ownership and deterministic disposal;
- one typed worker protocol and a bounded local processing gateway;
- rewritten shared Typography and Image primitives;
- typed SSR-safe `shared/config/env.ts` and `runtime.ts`, plus only consumed/tested wrappers;
- bounded committed document history and runtime-owned exact Manual Cutout drafts;
- deterministic unit, actor, worker, component, Playwright, real-model, and target-device evidence.

Their exact checklists and acceptance gates live in [`PHASE_33.md`](./PHASE_33.md) and
[`PHASE_34.md`](./PHASE_34.md).

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

### 2.4 Active v2 scope — Phase 35

Phase 35 migrates guided Magic Cutout as the next complete vertical slice and performs only the
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

Phase 35 does **not** migrate fine-detail/foreground refinement, Enhancements, Background,
batch/multi-document UI, public routes, accounts, payments, remote processing, or generated
backgrounds, and it adds no new environment variable or third-party dependency.

### 2.5 Future paid direction

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

type DocumentSnapshot = {
  matte: ArtifactId;
  foreground: ArtifactId | null;
  composite: ArtifactId;
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

type ActiveToolDraft = ManualCutoutDraft | MagicCutoutDraft;

type DocumentHistoryEntry = {
  operationId: EditOperationId;
  kind: "manual-cutout" | "magic-cutout";
  before: DocumentSnapshot;
  after: DocumentSnapshot;
  estimatedHistoricalBytes: number;
};

type DocumentHistory = {
  past: readonly DocumentHistoryEntry[];
  future: readonly DocumentHistoryEntry[];
  retainedHistoricalBytes: number;
};
```

Core rules:

- A workspace owns document membership/selection; each document actor is the sole writer for that
  document and owns at most one active commit.
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
- A document owns at most one active tool draft. Manual and Magic keep separate tool-specific
  runtime state; their discriminated actor metadata does not imply one shared mutable draft store.
- Every tool apply/undo/redo commit increments revision. Commands against a stale baseline are
  rejected, and a new commit after document Undo releases the unreachable redo branch.
- Magic draft mutations increment `draftRevision`. Prediction is a preview operation, not a document
  commit, and may publish only when both baseline and draft revision still match.
- Automatic removal and Magic model work share one heavy-job admission boundary. Tool-specific
  workers may own their protocols and sessions, but they may not bypass global scheduling,
  cancellation, or backpressure.
- React renders narrow selectors and sends commands. Component lifecycle is an adapter signal, not
  workflow truth.

Legacy runtime models such as `SourceImage`, `AlphaMatte`, `ProcessedImage`, `EditDocumentScope`, and
`BatchItemError` remain the current-code contract until their capabilities are migrated. Their full
definitions and history are preserved in the archived v1.27 SPEC and STATE snapshots.

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
| `/dev/remove-background`, `/dev/model-lab` | Internal noindex harnesses; model lab is disabled unless explicitly enabled |
| `/editor-v2`, `/en/editor-v2` | Separate bilingual noindex v2 surface; Phase 35 adds Magic Cutout without changing route identity |
| `/sitemap.xml`, `/robots.txt`, `/.well-known/security.txt` | Discovery and vulnerability-disclosure assets |
| `https://cdn.cutbg.art/models/{manifest-path}` | Pinned public model/runtime assets with CORS, ranges, and immutable caching |

### 5.2 Frontend boundaries

Legacy code remains available while v2 is built under:

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

Phases 33–35 add no environment variable. Future backend technology is deliberately undecided; current
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

## 8. Delivery state and roadmap

| Phase | State | Meaning |
|-------|-------|---------|
| 01–31 | Complete / historical | Legacy product, operations, editor, design, and audit evolution; contracts archived under `archive/phases/` |
| 32 | Closed incomplete | Legacy stabilization stopped by architect decision; gate waived, no tag, known freezes remain |
| 33 | Complete | Editor v2 foundation and first local vertical slice; gate and architect acceptance passed |
| 34 | Complete | Bounded document history and exact Manual Cutout on v2; gate and architect acceptance passed |
| 35 | Approved / active | Guided Magic Cutout vertical slice plus second-consumer architecture refactor |
| Later | Unscheduled | Migrate Background and Enhancements, then batch as a parent actor over proven document actors; public-route migration and paid backend remain separately approved work |

No v2 capability is migrated merely because legacy code exists. Phase 35 is limited to the explicit
Magic contract above; later tools still require their own approved phase contracts.

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
