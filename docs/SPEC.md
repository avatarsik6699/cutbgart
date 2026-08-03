# TECHNICAL SPECIFICATION: BG Remove App

> Active product and system contract. Read this document, [`STATE.md`](./STATE.md),
> [`ARCHITECTURE_V2.md`](./ARCHITECTURE_V2.md), and the active phase before implementation.
> The complete pre-compaction v1.27 specification is preserved at
> [`archive/contracts/SPEC_V1_27_FULL.md`](./archive/contracts/SPEC_V1_27_FULL.md).
> Run `/spec-sync` whenever this file changes.

## Metadata

| Field | Value |
|-------|-------|
| Version | `v1.29` |
| Date | `2026-08-01` |
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

The first v2 slice is deliberately narrow: select one image, prepare it locally, remove its
background, preview the committed result, export PNG, cancel/retry/reset safely. It must remain
responsive throughout and coexist with the legacy editor for comparison and rollback.

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

### 2.2 Active v2 scope

Phase 33 builds an isolated implementation under `src/v2/` and a separate noindex route. It includes:

- framework-free IDs, snapshots, commands, events, invariants, and processing ports;
- one workspace actor and one XState document actor per imported image;
- an artifact repository for binary ownership and deterministic disposal;
- one typed worker protocol and a bounded local processing gateway;
- rewritten shared Typography and Image primitives;
- typed SSR-safe `shared/config/env.ts` and `runtime.ts`, plus only consumed/tested wrappers;
- deterministic unit, actor, worker, component, Playwright, real-model, and target-device evidence.

Phase 33 does **not** migrate Cutout, Enhancements, Background, batch, accounts, payments, remote
processing, or generated backgrounds. Its exact checklist and acceptance gates live in
[`PHASE_33.md`](./PHASE_33.md).

### 2.3 Future paid direction

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
| Phase-33 v2 route | Separate bilingual noindex first-slice surface; final path is frozen in Phase 33 |
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

Phase 33 adds no environment variable. Future backend technology is deliberately undecided; current
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

## 8. Delivery state and roadmap

| Phase | State | Meaning |
|-------|-------|---------|
| 01–31 | Complete / historical | Legacy product, operations, editor, design, and audit evolution; contracts archived under `archive/phases/` |
| 32 | Closed incomplete | Legacy stabilization stopped by architect decision; gate waived, no tag, known freezes remain |
| 33 | Complete | Editor v2 foundation and first local vertical slice; gate and architect acceptance passed |
| 34 | Needs review / next candidate | Re-scope as the next v2 capability slice before implementation |
| Later | Unscheduled | Migrate capabilities one tested slice at a time, then define paid backend phases explicitly |

No v2 capability is migrated merely because legacy code exists. Phase 33 proved its architecture and
resource/performance contract on the affected environment; the next slice still requires an explicit
approved phase contract.

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
