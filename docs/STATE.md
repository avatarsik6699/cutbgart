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
| 33 | 🔄 in-progress | gate passed; manual architect device acceptance pending | Active editor v2 contract: [`PHASE_33.md`](./PHASE_33.md) |
| 34 | ⚠️ NEEDS_REVIEW | stale planned number | Former legal phase archived; re-scope after Phase-33 evidence |

**Latest closed phase:** `32` (architect exception)

**Implementation in progress:** `PHASE_33` — implementation and automated gate complete; manual
architect device acceptance remains before `/context-update 33`

**Only active implementation scope:** `PHASE_33`

## Current contract

This section describes code that exists after Phase 32. Target v2 contracts are planned, not shipped;
see [`ARCHITECTURE_V2.md`](./ARCHITECTURE_V2.md) and [`PHASE_33.md`](./PHASE_33.md).

### Runtime status

- The deployed legacy editor is anonymous and browser-local. It supports single/batch background
  removal, correction, enhancements, backgrounds, undo/redo, and PNG/ZIP export.
- Source images and derived pixels are not sent to an app backend; the app owns no account, payment,
  image API, database, or result storage.
- Phase 32 added structured batch errors, per-item edit scopes, worker run guards, upload preparation,
  and resource-lifecycle work.
- Architect verification still reproduces model-load/removal and Magic Apply freezes that block page
  scroll and controls. Phase 32 therefore did not satisfy its responsiveness goal.
- Legacy remains available while v2 is built separately. Phase 33 must prove responsiveness and
  ownership on the affected browser/device before any further capability migration.

### Core legacy models

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

### Active endpoints and pages

There is no image-processing API.

| Method/surface | Current behavior |
|----------------|------------------|
| `GET /`, `GET /en` | Localized main page and legacy editor |
| Four Russian scenario routes plus four `/en/...` routes | Localized scenario content reusing the editor |
| `/about`, `/en/about`, `/privacy`, `/en/privacy` | Static localized pages |
| `/dev/remove-background` | Internal noindex ML harness |
| `/dev/model-lab` | Internal noindex lab; active only with `VITE_ENABLE_MODEL_LAB=true` |
| `/sitemap.xml`, `/robots.txt`, `/.well-known/security.txt` | Discovery/security assets |
| `cdn.cutbg.art/models/{manifest-path}` | Immutable public model/runtime assets with CORS and byte ranges |

Phase 33 adds a separate noindex v2 page but no server API/RPC endpoint.

### Persistence and ownership

- **App DB/tables/migrations/seeds:** none.
- **Browser tab memory:** source images, mattes, prompts, edits, composites, object URLs, histories,
  v2 actors/artifacts/runs, and exports.
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

Phase 33 adds no key. Typed `shared/config/env.ts` and SSR-safe `runtime.ts` will centralize access
without changing values or exposing server secrets.

## Target contract: Phase 33

The planned v2 contract is intentionally isolated and local-only:

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
- no Cutout, Enhancements, Background, batch, auth, billing, upload, remote jobs, or generation;
- deterministic automated tests, serialized real-model smoke, and mandatory target-device evidence.

This target does not become the Current Contract until Phase 33 passes its gate, architect review,
`/context-update`, and merge.

## Active blockers and residual risks

| Scope | State |
|-------|-------|
| Legacy editor | Known main-thread freezes during model load/removal and Magic Apply; retained for comparison, not treated as resolved |
| Phase 33 | No implementation blocker; target-device/real-model evidence is a mandatory completion dependency |
| Phase 34 | `NEEDS_REVIEW`: stale legal-phase number and legacy assumptions; do not implement before re-scoping |
| Future paid tier | Architecture direction only; backend/auth/billing/data/security/legal contracts are intentionally undecided |

## Current decisions and project log

Newest first. Earlier phase completions, spec changes, incidents, accepted risks, and superseded
decisions remain append-only in the [full archived tracker](./archive/contracts/STATE_THROUGH_PHASE_32_FULL.md).

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
