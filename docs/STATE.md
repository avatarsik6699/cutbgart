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

<!-- Add new rows here via /phase-init N -->

---

## Current Contract

> Technical contract as of the latest completed phase. Append-only — never remove an entry unless
> `SPEC.md` explicitly removes it (via `/spec-sync`). Updated by `/spec-sync` (on contract-changing
> spec edits) and `/context-update` (on phase completion).

**Phase completed:** `02` · **Phase in progress:** `—`

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

### Active Endpoints

| Method | Path | Auth | Response / Payload |
|--------|------|------|---------------------|
| `GET` | `/` | none | SSR HTML page shell ("hello world" placeholder; full home composition arrives in Phase 04) |
| `GET` | `/dev/remove-background` | none | SSR HTML shell hosting the isolated `remove-background` test harness (`<div data-testid="remove-background-test-harness">`). Undesigned, `noindex`, dev-only — not a launch page (SPEC.md §5.1) |

### DB Schema

- Tables: none yet.
- Current migration head: `—`
- Client-side Cache Storage (`public/sw.js`, cache-first, content-hashed, added Phase 02): ONNX model weights (`BiRefNet_lite` + full `BiRefNet`) and ONNX Runtime WASM binaries.

### UI Pages

- `/` — hello-world placeholder (Phase 01). Replaced by the full `pages/home` composition in Phase 04.
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
