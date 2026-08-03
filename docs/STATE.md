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
| 33 | ✅ done | gate passed; tag `v0.33.0` after merge | Editor v2 foundation and first local vertical slice |
| 34 | ✅ done | gate passed; tag `v0.34.0` after merge | [`PHASE_34.md`](./PHASE_34.md): document history + Manual Cutout |
| 35 | ✅ done | gate passed; tag `v0.35.0` after merge | [`PHASE_35.md`](./PHASE_35.md): guided Magic Cutout |

**Latest closed phase:** `35`

**Implementation in progress:** None; Phase 36 has not been initialized

**Only active implementation scope:** None

## Current contract

This section describes code that exists after Phase 35. The legacy editor remains the public product;
the separately reachable v2 foundation now includes automatic removal, Manual Cutout, guided Magic
Cutout, and document history. See [`ARCHITECTURE_V2.md`](./ARCHITECTURE_V2.md) and
[`PHASE_35.md`](./PHASE_35.md).

### Runtime status

- The deployed legacy editor is anonymous and browser-local. It supports single/batch background
  removal, correction, enhancements, backgrounds, undo/redo, and PNG/ZIP export.
- Source images and derived pixels are not sent to an app backend; the app owns no account, payment,
  image API, database, or result storage.
- Phase 32 added structured batch errors, per-item edit scopes, worker run guards, upload preparation,
  and resource-lifecycle work.
- Architect verification still reproduces model-load/removal and Magic Apply freezes that block page
  scroll and controls. Phase 32 therefore did not satisfy its responsiveness goal.
- Legacy remains available while v2 grows one accepted capability slice at a time.
- The noindex v2 surface implements one-image import, local automatic removal, preview, PNG export,
  truthful cancel/retry/reset, and deterministic artifact cleanup. Its gate and architect target-
  device verification passed without reproducing the legacy freeze.
- The same v2 surface now implements runtime-owned Restore/Erase drafts, local gesture Undo/Redo,
  atomic Manual Apply/Cancel, and actor-owned committed document Undo/Redo without reinference.
- Guided Magic Cutout now adds bounded source-space Keep/Remove strokes, explicit prediction and
  candidate preview/refinement, and one explicit artifact-aware Apply without inference during
  commit, Undo/Redo, export, or reset.

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

### Active endpoints and pages

There is no image-processing API.

| Method/surface | Current behavior |
|----------------|------------------|
| `GET /`, `GET /en` | Localized main page and legacy editor |
| Four Russian scenario routes plus four `/en/...` routes | Localized scenario content reusing the editor |
| `/about`, `/en/about`, `/privacy`, `/en/privacy` | Static localized pages |
| `/dev/remove-background` | Internal noindex ML harness |
| `/dev/model-lab` | Internal noindex lab; active only with `VITE_ENABLE_MODEL_LAB=true` |
| `/editor-v2`, `/en/editor-v2` | Separate bilingual noindex v2 automatic removal, Manual Cutout, guided Magic Cutout, and document history slice |
| `/sitemap.xml`, `/robots.txt`, `/.well-known/security.txt` | Discovery/security assets |
| `cdn.cutbg.art/models/{manifest-path}` | Immutable public model/runtime assets with CORS and byte ranges |

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

Phases 33–35 added no key. Typed `shared/config/env.ts` and SSR-safe `runtime.ts` centralize access
without changing values or exposing server secrets.

### Current Editor v2 contract

The implemented v2 foundation is intentionally isolated and local-only:

- `src/v2/{domain,application,runtime-browser,presentation,shared/ui,shared/lib,testing}`;
- one workspace actor and one document actor per image;
- IDs/revisions in domain state, binary values in `ArtifactRepository`;
- `{ documentId, runId, expectedRevision }` correlation and explicit terminal outcomes;
- backend-neutral `ProcessingGateway`, with only a bounded local worker adapter implemented;
- rewritten Typography/Image primitives and tested platform/config wrappers;
- one-image import → local automatic removal → preview → PNG export;
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
- no Enhancements, Background, batch, auth, billing, upload, remote jobs, or generation;
- deterministic automated tests, serialized real-model smoke, and mandatory target-device evidence.

Further capabilities are not implied by this foundation. Background, Enhancements, batch,
public-route migration, and legacy removal require later accepted slices.

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

## Active blockers and residual risks

| Scope | State |
|-------|-------|
| Legacy editor | Known main-thread freezes during model load/removal and Magic Apply; retained for comparison, not treated as resolved |
| Phase 33 | Complete; gate, real-model evidence, and architect target-device acceptance passed |
| Phase 34 | Complete; gate, real-model evidence, and architect acceptance passed |
| Phase 35 | Complete; gate, real-model/Windows evidence, security scans, and architect acceptance passed |
| Future paid tier | Architecture direction only; backend/auth/billing/data/security/legal contracts are intentionally undecided |

## Current decisions and project log

Newest first. Earlier phase completions, spec changes, incidents, accepted risks, and superseded
decisions remain append-only in the [full archived tracker](./archive/contracts/STATE_THROUGH_PHASE_32_FULL.md).

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
