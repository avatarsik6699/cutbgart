# Stack Guide

> **Source of truth for this project's concrete technologies, tools, and conventions.**
>
> The SDD pipeline (phases, gates, skills, contracts) is stack-agnostic. This file is the only
> place where the workflow learns what to actually run. The `phase-gate` playbook reads
> [`Gate Commands`](#gate-commands) below verbatim — keep that table accurate.
>
> **Stack status:** CONFIGURED

---

## Stack

| Layer | Technology |
|-------|-----------|
| Backend | None — no custom API. TanStack Start's Nitro server (`node-server` preset) only does SSR of page shells (SPEC.md §4) |
| Frontend | TanStack Start v1.x (React 19, TanStack Router file-based routing, Vite), Tailwind CSS, shadcn/ui on Base UI |
| ML runtime (client-side) | `@huggingface/transformers` v4 + ONNX Runtime Web (WebGPU / WASM), runs in a Web Worker — not server infra |
| Client-side ZIP | `client-zip` v2 (`^2.5.0`) | Phase 10 download-all: dependency-free streaming ZIP assembly with store/pass-through entries; result PNGs are already compressed, so no redundant DEFLATE |
| Database | None — no persistent server-side store (SPEC.md §3). `umami-db` (Postgres) is analytics-only infra, added in Phase 05 |
| Cache | None server-side. Client-side: Service Worker (`public/sw.js`, cache-first) for model weights; `localStorage` for the quality-mode preference |
| Infra | Docker Compose: `nginx` + `app` (Phase 01); `umami` + `umami-db` + `uptime-kuma` added in Phase 05; maintenance-profile `model-sync` + VPS asset mount added in Phase 14. Cloudflare proxies the app and caches `cdn.cutbg.art/models/*`; R2 is not required. `docker-compose.dev.yml` adds a container-parity dev session — standalone, never merged with the production `docker-compose.yml` |
| Package managers | pnpm |
| CI | GitHub Actions → GitHub Container Registry → SSH deploy to VPS |

---

## Editor v2 foundation stack

Phase 33 implemented and gated the first isolated vertical slice governed by
[`ARCHITECTURE_V2.md`](./ARCHITECTURE_V2.md). The table above remains the deployed public-product
stack while the noindex v2 route grows through later accepted slices.

| Area | Direction | Phase-33 boundary |
|------|-------------------|-------------------|
| Workflow state | XState v5 + `@xstate/react`; one actor per image, selector-only React bindings | Add for local single-image workflow only |
| Domain/application | Framework-free TypeScript commands, events, transitions, ports, policies | No React, worker, HTTP, provider, or binary values |
| Binary ownership | Explicit artifact repository with opaque IDs and leases | Browser-tab memory only |
| Local runtime | Unified typed protocol and bounded browser worker gateway | Existing model/assets; no remote processing |
| Shared UI | Repository-wide Typography and optimized Image primitives plus consumer-proven generic components | Strict `FRONTEND_CONVENTIONS.md`; capability-owned public modules under `src/shared/ui` |
| SSR/config | Typed `shared/config/env.ts` + `runtime.ts`, adapted from `patient_tracker` | Sole environment/runtime boundary; backward-compatible legacy exports during migration |
| Shared React utilities | `src/shared/lib/react` through the repository-wide `shared/lib` public API | Consumer-proven, SSR-safe hooks such as `useIsHydrated`; direct platform access from components is forbidden |
| Test architecture | Vitest contract/model tests + Playwright typed fixtures and narrow component/page objects | Fast deterministic lane is parallel-safe; real-model lane is small and serialized; no sleeps/retry-masked flakes |
| Performance evidence | Typed v2 User Timing/PerformanceObserver/resource collector and versioned reports | Rebuild useful v1 probes behind shared contracts; target-device evidence remains mandatory |
| Worker/canvas tooling | Native typed Dedicated Worker protocol, imperative Canvas 2D, and capability-gated OffscreenCanvas | Comlink, workerpool/threads.js, and canvas frameworks are documented future candidates only; no Phase-33 evaluation or dependency |
| Service Worker | Model/network asset caching only | Never owns editor workflow or inference jobs |
| Server state | TanStack Query v5 | Reserved for a future paid backend; not a local editor store and not added in Phase 33 |
| Public paid API | Fastify-based TypeScript modular monolith is the current candidate | Research direction only; no API/dependency in Phase 33 |
| GPU service | Isolated Python worker/container behind a job port | Future paid phase only |
| Durable state | PostgreSQL + short-lived S3-compatible artifacts; queue implementation deferred | Future paid phase only |

Exact backend, auth, payment, queue, storage, and server-model choices remain open until their own
phase can evaluate security, data retention, commercial licensing, and operational cost.

### Phase-33 test budgets and diagnostics

- Focused v2 unit/contract runs target 5 seconds total; any individual deterministic test over
  500 ms is a slow-test finding to investigate before the phase gate.
- The mocked Phase-33 Chromium spec targets 30 seconds total and 10 seconds per test. It is fully
  parallel-safe and forces zero retries locally and in CI.
- The serialized real-model smoke has a six-minute test ceiling because model/CDN cold start is
  device- and cache-dependent; it does not duplicate deterministic UI coverage.
- Phase-33 mocked E2E retains traces only on failure. Real/target profiling retains the protocol,
  performance and resource report on success because that report is the required evidence; heavy
  Playwright traces remain failure-only unless I4 explicitly requests a target trace. Target-device
  capture uses an isolated browser owned by Playwright MCP, never `connectOverCDP` to a user profile.
- Arbitrary sleeps, order dependence, global mutable scenario state, hidden component-object
  assertions, and retry-dependent passes are gate failures.

---

## Prerequisites

```bash
docker --version
docker compose version
node --version
pnpm --version
```

---

## Initial setup

```bash
# Local dev (no Docker) — default for everyday iteration
pnpm install
pnpm generate:code              # required on a clean checkout before lint/type-check
pnpm dev                       # vite dev — TanStack Start dev server

# Container-parity dev session (hot-reload, bind-mounted source) — reach for
# this only when the task needs container parity (a clean-install repro, a
# container-specific env question), not as the everyday default
docker compose -f docker-compose.dev.yml up --build

# Full stack via Docker Compose (nginx + app; matches production topology)
docker compose up --build -d
```

Docker and `docker compose` are available from this project's WSL/terminal environment (confirmed
2026-07-10) — do not skip Docker-dependent gate steps as "unavailable" without first checking
`docker --version` yourself.

---

## Design system (Phase 30)

No external design tool is used — two prior attempts (Pencil/pen.dev, then Claude Design) produced
visual directions the architect rejected; see `docs/STATE.md` § Project Log, 2026-07-29. Phase 30
iterates directly in the codebase instead: upgrade `shadcn/ui` (`components.json` at repo root,
`style: base-nova`, `baseColor: neutral`) to its current version via the `shadcn` CLI, lean on its
stock components rather than bespoke ones, and formalize the existing color palette/typography as
documented Tailwind `@theme` tokens in `src/app/styles/globals.css`.

The active design contract is `docs/design/DESIGN_SYSTEM.md` (tokens, component conventions,
screens, approval record). Phase-30 screenshots/pattern evidence is retained under
`docs/archive/design-phase-30/exports/`; new active-phase evidence belongs in `docs/audits/`.

---

## Gate Commands

This section is the human-readable command source for the [`phase-gate`](playbooks/phase-gate.md)
workflow. Fill every row that applies to this project. Mark `n/a` for rows that do not apply
(e.g. no frontend → frontend rows are `n/a`). The phase-gate playbook will report `SKIPPED — n/a in
STACK.md` for those.

| Gate check | Command | Preconditions / notes |
|------------|---------|-----------------------|
| Infrastructure / bootstrap | `docker compose up --build -d app` | Needs Docker + Docker Compose. Scoped to `app` only — `nginx`+`certbot` need a real cert from `deploy/init-letsencrypt.sh`, which requires the real `cutbg.art` DNS record, so they can only be validated on the actual VPS, not in dev/CI. See "TLS / reverse-proxy verification" below. |
| Migrations | `n/a` | No database in this project (SPEC.md §3) |
| Backend / unit tests | `n/a` | No separate backend service/test suite — single TS/React codebase; all unit tests run under "Frontend unit tests" below |
| Frontend prep | `pnpm generate:code` | Paraglide output in `src/paraglide/` and TanStack Router's `src/routeTree.gen.ts` are generated and gitignored. Run this before type-aware lint/type-check on a clean checkout; their Vite plugins still regenerate both for `dev`/`build`. |
| Frontend type-check | `pnpm tsc --noEmit` | Strict mode (SPEC.md §6); mirrors the `build` step's typecheck |
| Frontend unit tests | `pnpm vitest run` | Covers the public v2 domain/application/runtime/presentation layers and retained shared features (SPEC.md §7.7) |
| Changed-code quality | `pnpm quality:fallow` | Fallow audit against local `main`, new findings only. Static graph/complexity/duplication/style evidence complements TypeScript, ESLint, Steiger, browser profiling, and human architecture review; it does not replace them. |
| E2E lint / determinism | `n/a` | No dedicated determinism-lint tool specified in SPEC.md §6; e2e spec files are covered by the project's regular `eslint.config.js` |
| E2E | `pnpm e2e:full` — **run locally from the host only** | Runs the deterministic Chromium UI suite against the public v2 routes under one managed Vite server, then one serialized Chromium real-model/CDN public-route smoke. As of Phase 31, Chromium is the only configured Playwright project — Firefox/WebKit/Mobile Safari were dropped from the fast gate (SPEC.md §7.4, PHASE_31_FINDINGS.md F-18); managed-Windows evidence is recorded separately. The sole CI exception is `pnpm e2e:ci-critical`: mocked Chromium, one worker, no model/CDN/WebGPU dependency. Never run Playwright in Docker. |
| Smoke | `docker compose exec -T app node -e "fetch('http://localhost:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"` | Deterministic, container-network-native — doesn't need port 3000 published to the host or TLS/nginx up. `app` also has a Docker `healthcheck` (docker-compose.yml) doing the same check on a 10s interval; `docker compose ps app` should show `(healthy)`. Phase files may override with a phase-specific check. |

Architecture lint (run in CI before tests, not part of the standard gate rows above — SPEC.md §7.7):

```bash
pnpm exec steiger ./src
```

Fallow is a development-only changed-code and architecture diagnostic. Its repository config
enforces v2 role boundaries and keeps cleanup/style heuristics advisory. Use `pnpm quality:fallow`
before commit, `pnpm quality:fallow:review` to orient a human/agent review, and
`pnpm quality:fallow:health` only for explicitly scoped refactoring research. Fallow findings do
not authorize automatic deletion or work outside the active phase; trace a finding and review the
diff before any fix. The optional local Codex MCP runs the same pinned dev dependency and enables
structured read-only analysis. Product telemetry remains disabled unless the architect explicitly
enables it.

### Codex web-development diagnostics

The architect's local Codex environment uses three complementary development integrations. They
do not ship in the application and must not become runtime dependencies:

```bash
codex plugin add build-web-apps@openai-curated --json
codex mcp add playwright -- \
  /mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe \
  -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass \
  -File 'C:\Users\user\AppData\Local\cutbg-tools\start-playwright-mcp.ps1'
codex mcp add chrome-devtools -- \
  /mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe \
  -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass \
  -File 'C:\Users\user\AppData\Local\cutbg-tools\start-chrome-devtools-mcp.ps1'
codex mcp add fallow -- pnpm --dir "$PWD" exec fallow-mcp
```

**Mandatory Windows browser boundary:** WSL owns the repository, package commands, application
server, and Linux host-only evidence. Playwright MCP and Chrome DevTools MCP must both be launched
through Windows PowerShell and must own isolated native Windows Chrome processes. Never launch a
browser MCP with WSL `npx`, never attach to a personal profile, and never classify Linux/WSL Chrome
as managed-Windows or target-device evidence. Before capturing target evidence, record and verify
`navigator.platform === "Win32"`, the Windows Chrome version, viewport, GPU/ANGLE backend, input
capabilities, and the application URL. A non-Windows platform is a hard stop, not an unsupported
Windows sample.

The Windows MCP fixture directory is
`C:\Users\user\AppData\Local\cutbg-tools\fixtures`. When the source lives in WSL, access it from
Windows through `\\wsl.localhost\<distribution>\...` or copy the exact fixture into that managed
directory and record its hash. Do not pass `/home/...` paths to a Windows browser MCP.

- Build Web Apps supplies current React performance-review and browser-debugging workflows; repo
  SDD, `ARCHITECTURE_V2.md`, and `FRONTEND_CONVENTIONS.md` remain authoritative.
- Chrome DevTools MCP owns runtime traces, long-task/main-thread attribution, network evidence, and
  heap diagnostics. It must use the same native-Windows boundary as Playwright MCP. Keep the
  isolated profile and privacy flags; Playwright remains the behavioral E2E owner.
- Fallow MCP exposes the pinned repository dev dependency as structured static analysis. The CLI
  scripts remain the reproducible gate and fallback.
- `review-v2-architecture` under `.agents/skills/` composes these layers into this repository's
  ownership/performance review. Start a new Codex conversation after installing or changing a
  plugin/MCP so the tool and skill inventory is refreshed.

Verify local discovery with `codex plugin list` and `codex mcp list`. Never enable Fallow telemetry
or relax Chrome profile/network privacy settings on the user's behalf.

### Security and supply-chain gate (Phase 22)

The following versions/commands are frozen from current primary documentation.
Any version or policy change requires maintainer review of release notes,
license and provenance.

```bash
pnpm audit --prod --audit-level high
pnpm security:licenses
pnpm sync-model-assets -- --check

docker run --rm \
  -v "$PWD:/work:ro" \
  aquasec/trivy:0.70.0@sha256:be1190afcb28352bfddc4ddeb71470835d16462af68d310f9f4bca710961a41e \
  fs --scanners vuln,secret,misconfig --severity HIGH,CRITICAL \
  --exit-code 1 /work

docker build -t cutbgart:security .
docker run --rm \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  aquasec/trivy:0.70.0@sha256:be1190afcb28352bfddc4ddeb71470835d16462af68d310f9f4bca710961a41e \
  image --scanners vuln --severity HIGH,CRITICAL \
  --exit-code 1 cutbgart:security
```

CI additionally runs the SHA-pinned
`actions/dependency-review-action@a1d282b36b6f3519aa1f3fc636f609c47dddb294`
(v5.0.0) and
`aquasecurity/trivy-action@ed142fd0673e97e23eac54620cfb913e5ce36c25`
(v0.36.0 / Trivy 0.70.0). It emits `sbom.cdx.json`, creates GitHub provenance
and SBOM attestations for the pushed image digest, and the protected
`production` job verifies:

```bash
gh attestation verify "oci://$IMAGE_NAME@$IMAGE_DIGEST" \
  --repo "$GITHUB_REPOSITORY" \
  --signer-workflow "$GITHUB_REPOSITORY/.github/workflows/ci.yml" \
  --source-ref refs/heads/main \
  --deny-self-hosted-runners
```

The gate fails on scanner execution failure, high/critical reachable findings,
unreviewed licenses, mutable model inputs, or missing/mismatched attestation
identity. Exception owner/expiry rules are in
[`security/SECURE_DEVELOPMENT.md`](security/SECURE_DEVELOPMENT.md).

### Release reliability gate (Phase 23)

Repository/disposable checks:

```bash
pnpm build
docker compose config --quiet
docker compose build
pnpm e2e:ci-critical
pnpm release:test
pnpm release:test:docker
node scripts/operations/validate-alerts.mjs
```

Production releases use `scripts/release/deploy.sh`; manual recovery uses
`scripts/release/rollback.sh manual`. The controller requires
`APP_IMAGE=ghcr.io/...@sha256:...`, `APP_BUILD_ID`, `APP_COMMIT_SHA` and
`APP_CREATED_AT`, validates matching OCI labels, starts a loopback-only candidate,
runs pre/post smoke, serializes with `.ops/releases/deploy.lock`, retains the last
10 records and three non-secret config snapshots, and fails visibly after an
automatic rollback. Operational backup/drill commands are documented in
[`runbooks/BACKUP_RESTORE.md`](runbooks/BACKUP_RESTORE.md).

At the Phase-23 gate, additionally validate the real protected `production`
environment, external hostname, Uptime Kuma SSH tunnel, notification receipt,
previous-digest rollback and encrypted restore on a production-parity disposable
host. Local tests do not claim those external checks passed.

### Production security ownership

- SSR responses set CSP, `frame-ancestors`, `X-Content-Type-Options`,
  `Referrer-Policy`, and `Permissions-Policy` in `src/server.ts`.
- Nginx owns HTTPS redirect/HSTS, CDN CORP/CORS, `/api/send` and public SSR
  request/body/time limits. COOP/COEP are intentionally not enabled.
- Compose production service images and Dockerfile bases are pinned by digest.
  Deploy must set `APP_IMAGE=ghcr.io/...@sha256:...`; the `cutbgart:local`
  fallback is only for local `--build`.
- GitHub `production` environment stores VPS secrets. Vite analytics IDs/tokens
  are public browser identifiers and use repository environment variables, not
  secret-bearing Docker layers.
- GitHub production secrets: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`,
  `VPS_APP_DIR`. Repository/environment variables contain only public Vite
  browser identifiers. Backup passphrases and Uptime notification credentials
  live in the approved host/password store, never GitHub logs or repository
  files.
- Model release operations:

```bash
pnpm sync-model-assets                         # verified atomic activation
pnpm sync-model-assets -- --verify-cache       # verify active bytes
pnpm sync-model-assets -- --rollback           # swap to previous verified release
docker compose --profile maintenance run --rm --build model-sync
```

### TLS / reverse-proxy verification (VPS-only, not part of the automated gate)

`nginx` + `certbot` can only be brought up successfully after `deploy/init-letsencrypt.sh` has run
once against the real `cutbg.art` DNS record (see `docker-compose.yml` comments) — that's a
deploy-time precondition no dev machine or CI runner can satisfy. Verify this path manually on the
VPS after deploy: `docker compose ps` shows `nginx` and `certbot` up, and `https://cutbg.art/`
resolves with a valid certificate in a browser.

No project helper script exists yet for `phase-gate` orchestration — add
`./scripts/phase-gate.sh [XX]` here if one is introduced later.

---

## Testing

### Backend

None — no backend test suite (no server-side API beyond SSR shells, SPEC.md §4).

### Frontend

See [`docs/FRONTEND_CONVENTIONS.md`](FRONTEND_CONVENTIONS.md) for component/hook/module style rules
(naming, props, routing/storage/env wrappers, worker lifecycle) — this section covers only tooling.

```bash
pnpm tsc --noEmit          # type-check, strict mode
pnpm vitest run            # unit + integration (Testing Library for hooks)
pnpm exec steiger ./src    # FSD architecture lint — run before tests in CI
pnpm e2e                   # Fast deterministic Chromium UI/canvas/download suite
pnpm e2e:ci-critical       # Mocked Chromium PR-CI exception; one worker
pnpm e2e:real-model        # Serialized Chromium smoke against the real model/CDN
pnpm e2e:model-lab-real    # Phase 15 only: serialized BEN2/MVANet WASM compatibility report
pnpm e2e:phase-17-real     # Phase 17 only: serialized iterative SlimSAM runtime evidence
pnpm e2e:matting-lab-real  # Phase 18 only: serialized ViTMatte alpha/runtime evidence
pnpm e2e:phase-19-real     # Phase 19 only: serialized production q8/fp32 refinement evidence
pnpm e2e:phase-20-real     # Phase 20 only: serialized full-pipeline + bounded-input evidence
pnpm e2e:phase-21-real     # Phase 21 only: serialized brush-derived SlimSAM evidence
pnpm e2e:phase-35-real     # Phase 35 only: serialized v2 Magic cold/warm lifecycle evidence
pnpm e2e:full              # Required phase gate: deterministic suite + real-model smoke
                           # host-only: never in Docker or CI
```

Playwright drives the app the way a human would in a browser. `pnpm e2e` replaces only the external
ML Worker boundary with a deterministic in-browser test double; uploads, state transitions,
canvas editing, responsive layouts, and downloads remain real. As of Phase 31, Chromium is the only
configured project (Firefox/WebKit/Mobile Safari dropped to bound local/CI E2E runtime — SPEC.md
§7.4, PHASE_31_FINDINGS.md F-18); Phase 33's physical-device sample is the sole remaining
compatibility evidence for other engines. `pnpm e2e:real-model` owns the slow/network-dependent
ONNX+CDN check and runs once, serially, in Chromium. Write or extend the deterministic suite for
every changed user-facing flow and run `pnpm e2e:full` at `/phase-gate`. Only
`e2e/ci-critical.spec.ts` runs in CI; it uses mocked inference, Chromium and one worker. No
Playwright suite runs in Docker.

### Performance profiling (PHASE_31 T2)

```bash
pnpm profile:baseline      # builds production, then serves it and drives it with
                            # Playwright + a raw CDP session (Performance.getMetrics,
                            # PerformanceObserver longtask) for cold-start paint timing
                            # and repeated single/batch upload-churn JS-heap trend
```

`scripts/profiling/measure-baseline.ts` — host-only, single-machine data points (never a universal
device claim, SPEC.md §7.1). Uses the same mocked-worker double as `pnpm e2e`
(`installMockInference`) so results reflect this project's own React/DOM/resource-lifecycle cost,
not real ONNX inference time. Iteration counts are literal constants in the script (edit them
directly for a longer/shorter run) — default is enough to see a growth-rate trend, not to make a
final leak/no-leak call; bump to 100+ when investigating a specific suspected leak. See
`docs/archive/audits/phase-31/PHASE_31_T2_MEASUREMENTS.md` for the historical captured baseline run
and how to read the output.

### Phase-33 performance reports

```bash
pnpm profile:phase-33     # validates the stored fake + cold/warm real-model
                          # phase-33.performance.v1 reports and recalculates budgets
```

The physical-target capture itself is driven by the configured Playwright MCP in a managed,
isolated browser. Its durable observations live in `docs/archive/audits/phases-33-43/PHASE_33_RESULTS.md` and
`PHASE_33_REPORTS.json`; repository scripts do not attach to a personal browser or debugging port.

### Phase-35 Magic Cutout reports

```bash
pnpm profile:phase-35 -- --verify  # validates mocked, host real-model, and Windows target evidence
```

The versioned report bundle lives in `docs/archive/audits/phases-33-43/PHASE_35_REPORTS.json`. Values not captured by
the host runner or Windows Playwright MCP are recorded as unsupported with limitations rather than
inferred from command duration.

---

## Project structure

```
.
├── docs/                   # SPEC, STATE, PHASE_XX, STACK (this file), playbooks
├── .claude/skills/         # Claude Code skill wrappers (6 SDD skills)
├── plugins/sdd-workflow/   # Codex plugin (skills, commands, MCP, hooks)
├── src/
│   ├── app/                # providers, global styles, router init
│   ├── routes/             # thin TanStack Router file-based routing (loader + head only)
│   ├── pages/               # per-page composition (FSD `pages` layer)
│   ├── features/            # upload-image, remove-background, quality-mode-toggle, download-result
│   ├── entities/             # processed-image (domain type + BeforeAfterSlider)
│   └── shared/                # shadcn/ui components, lib, config (FSD `shared` layer)
├── public/                  # sw.js (model-weight cache), robots.txt
├── scripts/                 # generate-sitemap.ts
├── e2e/                     # Playwright specs (playwright.config.ts at repo root)
├── deploy/nginx/            # nginx reverse-proxy config
├── Dockerfile / docker-compose.yml       # production topology
├── docker-compose.dev.yml   # container-parity dev session (Dockerfile's `dev` target)
└── AGENTS.md / CLAUDE.md   # AI agent rules
```

---

## Common operations

```bash
# Start the stack (Docker Compose, production topology)
docker compose up --build -d

# Container-parity dev session (hot-reload)
docker compose -f docker-compose.dev.yml up --build

# Stop everything
docker compose down
docker compose -f docker-compose.dev.yml down

# Add a new migration / schema change
# n/a — no database in this project (SPEC.md §3)

# Format / lint
pnpm exec prettier --write .
pnpm eslint . --fix
pnpm exec steiger ./src

# e2e — host-first, run against `pnpm dev` (never in Docker); write/extend a
# spec for every new user-facing flow (AGENTS.md core rule 8). CI owns only
# e2e/ci-critical.spec.ts on mocked Chromium.
pnpm e2e                  # fast iteration
pnpm e2e:ci-critical      # deterministic PR-CI exception
pnpm e2e:full             # phase gate, includes one real-model smoke
pnpm e2e:model-lab-real   # opt-in Phase 15 evaluation; never CI/normal matrix
pnpm e2e:matting-lab-real # opt-in Phase 18 ViTMatte evaluation; never CI/normal matrix
pnpm e2e:phase-19-real    # opt-in Phase 19 production refiner; never CI/normal matrix
pnpm e2e:phase-20-real    # opt-in Phase 20 hybrid pipeline; never CI/normal matrix
pnpm e2e:phase-21-real    # opt-in Phase 21 brush-guided SlimSAM; never CI/normal matrix
pnpm e2e:phase-35-real    # opt-in Phase 35 v2 Magic lifecycle; never CI/normal matrix

# Sitemap (SPEC.md §7.5): `pnpm build` runs this automatically before `vite
# build` so `public/sitemap.xml` is always current with `src/routes/` — run
# it standalone only to inspect/debug its output.
pnpm generate-sitemap

# Release/recovery operations
pnpm release:test
pnpm release:test:docker
APP_IMAGE='ghcr.io/<owner>/<repo>@sha256:<digest>' \
  APP_BUILD_ID='<id>' APP_COMMIT_SHA='<sha>' \
  ./scripts/release/deploy.sh
./scripts/release/rollback.sh manual
./scripts/operations/backup.sh
./scripts/operations/restore.sh '<archive>' '<empty-target>'
node scripts/operations/exercise-capacity.mjs
node scripts/operations/validate-alerts.mjs

# Synchronize pinned public model/WASM files into deploy/model-assets/.
# Prefer the container command on the VPS for dependency/container parity.
pnpm sync-model-assets --check
docker compose --profile maintenance run --rm --build model-sync
```
