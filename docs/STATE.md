# STATE: BG Remove App Development Tracker

> **Single source of truth for project status, current contracts, and history.**
> Replaces what used to be four separate files (`STATE.md`, `CONTEXT.md`, `CHANGELOG.md`,
> `DECISIONS.md`). Updated by `/spec-sync` and `/context-update`.
>
> **Status legend**
> `⏳ pending` — not started
> `🔄 in-progress` — agent implementation in progress
> `✅ done` — gate checks passed, committed, merged
> `⚠️ NEEDS_REVIEW` — spec changed, phase scope may be stale
> `❌ blocked` — cannot proceed, see Blockers section
>
> **Impl By:** `🤖 agent` · `—` (not yet started)

---

## Phase Status

| Phase    | Status     | Tag    | Gate | Impl By | Notes |
|----------|------------|--------|------|---------|-------|
| PHASE_01 | ✅ done | v0.01.0 | ✅ | 🤖 agent | Scaffold |
| PHASE_02 | ✅ done | v0.02.0 | ✅ | 🤖 agent | ML core |
| PHASE_03 | ✅ done | v0.03.0 | ✅ | 🤖 agent | Quality toggle & design system |
| PHASE_04 | ✅ done | v0.04.0 | ✅ | 🤖 agent | Home page UI |

<!-- Add new rows here via /phase-init N -->

---

## Current Contract

> Technical contract as of the latest completed phase. Append-only — never remove an entry unless
> `SPEC.md` explicitly removes it (via `/spec-sync`). Updated by `/spec-sync` (on contract-changing
> spec edits) and `/context-update` (on phase completion).

**Phase completed:** `04` · **Phase in progress:** `—`

**Stack:** see [docs/STACK.md](./STACK.md)

### Core Models

```ts
// src/entities/processed-image/model/types.ts — Phase 02, per SPEC.md §2.2

type QualityMode = "fast" | "max";
type InferencePath = "webgpu" | "wasm";

interface DeviceCapabilities {
  inferencePath: InferencePath;       // via navigator.gpu.requestAdapter()
  defaultQualityMode: QualityMode;    // downgraded to "fast" on weak devices
}

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
  result: Blob;              // composited PNG-with-alpha, produced via OffscreenCanvas
  qualityMode: QualityMode;
}
```

```ts
// src/features/quality-mode-toggle/model/use-quality-mode.ts — Phase 03, per SPEC.md §3
// QualityMode itself already exists (entities/processed-image, Phase 02); this hook reads/writes
// it against localStorage.

function useQualityMode(defaultMode: QualityMode): {
  qualityMode: QualityMode;
  setQualityMode: (mode: QualityMode) => void;
};
```

```ts
// src/features/upload-image/model/types.ts — Phase 04, per SPEC.md §1.3, §7.3
// Validates + downscales a raw File into the existing SourceImage entity
// (entities/processed-image, Phase 02) — reuses that type rather than inventing a parallel one.

type UploadErrorCode =
  | "unsupported-format"          // SPEC.md §7.3: clear error, unsupported format
  | "exceeds-size-limit"          // SPEC.md §1.3: 20 MB hard limit
  | "exceeds-resolution-limit";   // SPEC.md §1.3: >4096px longest side (downscaled, not rejected;
                                  // this code stays in the union but is never actually constructed)

interface UploadValidationError {
  code: UploadErrorCode;
  message: string;                // human-readable, states the exact limit (SPEC.md §7.3)
}

type UploadResult =
  | { ok: true; image: SourceImage }
  | { ok: false; error: UploadValidationError };

function validateAndPrepareUpload(file: File): Promise<UploadResult>;
```

```tsx
// src/entities/processed-image/ui/BeforeAfterSlider.tsx — Phase 04, per SPEC.md §5.2
interface BeforeAfterSliderProps {
  before: SourceImage;   // original upload (entities/processed-image, Phase 02)
  after: Blob;           // ProcessedImage.result — composited PNG-with-alpha (Phase 02)
  alt?: string;
}
```

### Active Endpoints

| Method | Path | Auth | Response / Payload |
|--------|------|------|---------------------|
| `GET` | `/` | none | SSR HTML page shell rendering the full `pages/home` composition (upload → process → download flow, Phase 04) |
| `GET` | `/dev/remove-background` | none | SSR HTML shell hosting the isolated `remove-background` test harness (`<div data-testid="remove-background-test-harness">`). Undesigned, `noindex`, dev-only — not a launch page (SPEC.md §5.1) |

### DB Schema

- Tables: none yet.
- Current migration head: `—`
- Client-side Cache Storage (`public/sw.js`, cache-first, content-hashed, added Phase 02): ONNX model weights (`BiRefNet_lite` + full `BiRefNet`) and ONNX Runtime WASM binaries.
- Client-side `localStorage` (added Phase 03): `qualityMode: "fast" | "max"` — persisted across visits, no other user data stored client-side (SPEC.md §3).

### UI Pages

- `/` — full `pages/home` composition (Phase 04): upload (`features/upload-image`) → quality toggle
  (`features/quality-mode-toggle`, Phase 03) → processing (`features/remove-background`, Phase 02)
  → `BeforeAfterSlider` result view → download (`features/download-result`). Replaces the Phase 01
  hello-world placeholder.
- `/dev/remove-background` — undesigned ML pipeline test harness (Phase 02); exercises upload → both models load → inference → result end to end ahead of the real UI landing in Phase 04.

### Env Config

| Key | Example value | Required |
|-----|---------------|----------|
| `PORT` | `3000` | no — Nitro `node-server` preset default |
| `NODE_ENV` | `production` | no — standard Node convention for the container build |
| `VITE_MODEL_CDN_BASE_URL` | `https://cdn.cutbg.art/models` | required for production builds (Docker build arg once R2 is populated); unset in local dev — worker falls back to Transformers.js's own upstream defaults (SPEC.md §6, §6.1) |

### DB Seeds

None yet.

---

## Active Blockers

<!-- Format: PHASE_XX [YYYY-MM-DD]: description — who must resolve it -->

None

---

## Project Log

> Append-only, newest entry first. One entry format for everything that used to be split across
> `CHANGELOG.md` entries, `DECISIONS.md` ADRs, and the old "Expert Feedback Log" / "Rollback
> Notes" sections. Never delete an entry — if a decision is superseded, add a new entry that says
> so and leave the old one in place.

## 2026-07-10 — Phase 04 complete

**Type**: phase-completion
**Author**: AI (context-update)
**Triggered by**: PHASE_04 gate passed (type-check, unit tests, architecture lint, Docker
bootstrap/smoke all green) and committed

### Changes / Decision
- `features/upload-image` FSD slice: drag-and-drop, click-to-browse, clipboard paste, mobile
  camera capture (`capture` attribute); format/size/resolution validation (JPEG/PNG/WebP, 20 MB
  hard limit); client-side downscale above 4096px on the longest side; `validateAndPrepareUpload`
  produces the existing `SourceImage` entity rather than a parallel type
- `BeforeAfterSlider` display component added to `entities/processed-image`
- `features/download-result` FSD slice: PNG-with-alpha download button, releases the object URL
  via `URL.revokeObjectURL` after download or on next processing
- `pages/home` composes upload (`F1`) + quality toggle (Phase 03) + `useBackgroundRemoval`
  (Phase 02) + `BeforeAfterSlider` (`F2`) + download (`F3`) into the full
  `idle → model-loading → ready → processing → result` state machine, `error` reachable from any
  state, real model-load progress, WASM path labeled "lightweight mode", reset without page
  reload, one-click "recompute in max quality"; root carries `data-testid="home-page"`
- `routes/index.tsx` replaced: thin `loader` + head-meta shell rendering `pages/home`, replacing
  the Phase 01 hello-world placeholder — `GET /` is the same route, not a new endpoint
- Accessibility (SPEC.md §5.4): real `<input type="file">` under the drop zone, `aria-live="polite"`
  state-transition announcements, WCAG AA contrast/focus states, mobile "choose photo" button
- Vitest + Testing Library coverage: `upload-image` validation/downscale, `BeforeAfterSlider`,
  `download-result`, and the composed `pages/home` state machine (52 tests total project-wide)
- Playwright `e2e/home.spec.ts` extends Phase 03's setup with the critical-path flow
  (upload → process → download → process another image) across the chromium/webkit/Mobile Safari
  projects added to `playwright.config.ts`, plus fast idle/validation-error specs
- `pages/home/lib/source-image-to-file.ts` bridges `upload-image`'s validated `SourceImage.blob`
  back into a raw `File` for `useBackgroundRemoval.selectFile` (Phase 02 hook API left unchanged,
  per this phase's "Do NOT touch" constraint on `features/remove-background`)

### Affected Phases / Consequences
- `/dev/remove-background` stays as the isolated ML test harness (untouched this phase); Phase 06
  adds SEO scenario pages and the sitemap script, Phase 05 adds analytics/Umami wiring
- Known environment gap: the critical-path e2e spec's real WASM inference (`OrtRun()` on the full
  1024×1024 BiRefNet) hits `std::bad_alloc` in this dev WSL2 environment's headless browsers
  (chromium/webkit/Mobile Safari) — confirmed not a host-RAM shortage (16 GB free at time of gate),
  so likely an ONNX Runtime WASM linear-memory ceiling specific to headless execution here. Fast
  idle/validation-error specs pass on all three projects; architect approved treating `/phase-gate
  04` as PASS with this documented, pre-existing gap (see PHASE_04.md Implementation Notes) rather
  than blocking phase closure on it. Needs a real `pnpm e2e` run to fully verify the critical path
  end to end

## 2026-07-10 — Docker dev environment + e2e/Playwright policy

**Type**: decision
**Author**: `v.godlevskiy` (via AI agent)
**Triggered by**: Docker now confirmed working from this project's WSL/terminal environment
(previously unavailable — see Phase 02's completion entry below); architect requested this be
formalized ahead of Phase 04

### Changes / Decision
- Confirmed `docker`/`docker compose` work from this environment (`docker --version`,
  `docker compose version`, a real `docker compose build`/`up` round-trip against the app) — the
  Phase 02-era "Docker unavailable in this environment" constraint no longer holds
- Added a `dev` build stage to `Dockerfile` (extends `deps`, no `COPY . .` — source is bind-mounted
  at runtime) and a standalone `docker-compose.dev.yml` giving a container-parity, hot-reloading
  dev session (`docker compose -f docker-compose.dev.yml up --build`, port 3000 published). This is
  additive — plain `pnpm dev` remains the default for everyday local work; Docker is for when a
  task genuinely needs container parity (AGENTS.md core rule 7)
- `docs/STACK.md`'s Gate Commands "Infrastructure / bootstrap" row no longer needs a Docker-
  unavailability caveat — Docker-dependent gate steps (bootstrap, smoke) should actually run now,
  not be skipped
- Formalized (AGENTS.md core rule 8, `docs/STACK.md`, `docs/playbooks/impl-assist.md`,
  `docs/PHASE_TEMPLATE.md`) that every user-facing flow needs Playwright coverage under `e2e/`,
  and that `pnpm e2e` should be run during `/impl-assist` verification (not only `/phase-gate`) as
  an automated stand-in for a first pass of the architect's manual browser check
- Explicitly scoped e2e/Playwright as **host-only**: it must never run inside Docker and must
  never be wired into CI (`.github/workflows/ci.yml` has no e2e job, by design). Its purpose is a
  local, human-in-the-loop confirmation that a phase's work behaves correctly after implementation,
  or to reproduce a reported issue — not pipeline gating

### Affected Phases / Consequences
- Phase 04 onward: `/phase-gate`'s infrastructure/bootstrap/smoke steps are expected to actually
  execute via Docker rather than being skipped; any future phase adding a user-facing flow must add
  or extend an `e2e/` spec for it
- No change to CI (`.github/workflows/ci.yml`): it still only runs lint/typecheck/arch-lint/unit
  tests before building and pushing the Docker image — e2e stays a local-only step by design

## 2026-07-10 — Phase 03 complete

**Type**: phase-completion
**Author**: AI (context-update)
**Triggered by**: PHASE_03 gate passed and committed

### Changes / Decision
- shadcn/ui installed and configured on the Base UI engine (`components.json`, Tailwind theme
  tokens); components copied into the repo rather than consumed as an npm dependency (SPEC.md §6)
- `shared/ui` base component set added via the shadcn CLI: `Button`, `Switch`, `Card`, aggregated
  through a public `shared/ui/index.ts` (flat CLI output paths, not the nested-folder layout
  originally sketched — see PHASE_03.md Implementation Notes)
- `features/quality-mode-toggle` FSD slice: `useQualityMode` hook backing a `localStorage`-persisted
  `qualityMode` (`"fast" | "max"`), defaulting to `DeviceCapabilities.defaultQualityMode`
  (Phase 02) when unset
- Toggle UI control wired to `useQualityMode`, integrated into `/dev/remove-background` as the
  `qualityMode` parameter passed into `useBackgroundRemoval` (Phase 02), proving the wiring ahead
  of the real `pages/home` composition in Phase 04
- Vitest unit + Testing Library tests: `localStorage` persistence, default-selection from
  `DeviceCapabilities`, toggle UI interaction
- `@playwright/test` installed ahead of schedule (chromium only) with `playwright.config.ts` and
  one smoke spec (`e2e/dev-remove-background.spec.ts`) covering harness render, toggle interaction,
  and `localStorage` persistence across reload — STACK.md's E2E gate row updated to match; the
  cross-browser critical-path matrix (upload → process → download) stays deferred to Phase 04
- `resolve.tsconfigPaths: true` added to `vitest.config.ts` so shadcn's `@/*`-aliased imports
  resolve under Vitest
- `useQualityMode`'s initial-state read guards `typeof window === "undefined"` for SSR correctness
  (see `docs/KNOWN_GOTCHAS.md`)

### Affected Phases / Consequences
- Phase 04 (`pages/home`) will replace `/dev/remove-background` with the real, designed UI
  composition, reusing the `shared/ui` primitives and `quality-mode-toggle` slice from this phase
- Phase 04's e2e work extends the Playwright setup installed in this phase rather than bootstrapping
  it from scratch

---

## 2026-07-10 — Phase 02 complete

**Type**: phase-completion
**Author**: AI (context-update)
**Triggered by**: PHASE_02 gate passed (type-check, unit tests, arch lint green; Docker-dependent
bootstrap/smoke steps skipped — Docker unavailable in this environment, architect confirmed
manual verification and approved committing without them) and committed

### Changes / Decision
- `entities/processed-image` domain types (`SourceImage`, `AlphaMatte`, `ProcessedImage`,
  `QualityMode`, `DeviceCapabilities`) and `features/remove-background` FSD slice
- `DeviceCapabilities` detection selecting WebGPU (`fp16`) vs WASM (`q8`) inference path
- Web Worker hosting Transformers.js v4 model init + inference (`BiRefNet_lite` fast /
  `BiRefNet` max quality), never on the main thread
- `useBackgroundRemoval` hook implementing the full state machine (SPEC.md §5.3)
- `OffscreenCanvas` postprocessing/compositing in the worker producing `ProcessedImage`
- Mandatory error handling: WebGPU fallback notice, size/resolution/format limits,
  model-load-failure retry, device-out-of-memory message
- `/dev/remove-background` undesigned test route exercising the full pipeline end to end
- Vitest unit + integration tests (device capability detection, error handling, postprocessing,
  `useBackgroundRemoval` against a mocked worker)
- `@huggingface/transformers` v4 + ONNX Runtime Web deps, `env.useWasmCache = true`
- GitHub Actions workflow uploading `.onnx` weights + WASM binaries to Cloudflare R2, triggered
  on `models.manifest.json` changes to `main` plus manual `workflow_dispatch`
- Service Worker (`public/sw.js`) cache-first caching of model weights/WASM from the R2 CDN,
  `lite`/full variants cached independently

### Affected Phases / Consequences
- Phase 04 (`pages/home`) will replace `/dev/remove-background` with the real, designed UI
  composition built on this slice
- Phase 04 is also where Playwright/e2e gets wired in, exercising this pipeline's critical path

---

## 2026-07-10 — Phase 01 complete

**Type**: phase-completion
**Author**: AI (context-update)
**Triggered by**: PHASE_01 gate passed

### Changes / Decision
- TanStack Start scaffolded (Vite, Nitro `node-server` preset, TypeScript strict), FSD layer
  skeleton, ESLint + Prettier, Steiger architecture lint, Husky + lint-staged
- Hello-world page at `/`, proving the SSR pipeline end to end
- Dockerfile, docker-compose (`app` + `nginx` + `certbot`), Nginx reverse proxy, Certbot TLS
  bootstrap (`deploy/init-letsencrypt.sh`), GitHub Actions CI (lint → typecheck → arch-lint →
  test → build → push to GHCR → SSH deploy)
- Gate commands in `docs/STACK.md` scoped to what's actually testable in dev/CI (`app` container
  directly); `nginx`/TLS verification documented as a VPS-only manual step

### Affected Phases / Consequences
- None (additive change — first phase)

---

## v1.0 — 2026-07-09 — Initial Setup

**Type**: phase-completion
**Author**: `v.godlevskiy`
**Triggered by**: Project initialization with SDD workflow

### Changes
- `SPEC.md` created: project goals, roles, data model, API/contract, phase plan
- `STACK.md` populated with build/test/run commands

### Affected Phases / Consequences
- None (initial state)

---

<!--
ENTRY TEMPLATE — copy this block when adding a new entry. Pick the Type that fits:
  spec-change      — docs/SPEC.md changed (via /spec-sync)
  phase-completion — a phase closed out (via /context-update)
  decision         — an architectural decision / trade-off (ADR-style, manual or agent-recorded)
  feedback         — human reviewer or domain-expert feedback on a phase
  rollback         — a phase was rolled back or a migration reversed

## [YYYY-MM-DD] — [Short Title]

**Type**: spec-change | phase-completion | decision | feedback | rollback
**Author**: [name / AI skill]
**Triggered by**: [what caused this]

### Changes / Decision
- [what changed, or what was decided and why — alternatives considered if relevant]

### Affected Phases / Consequences
- PHASE_XX — [reason / what changes as a result, good and bad]

-->
