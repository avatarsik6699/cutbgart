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
| Frontend unit tests | `pnpm vitest run` | Covers `features/remove-background` unit tests + `useBackgroundRemoval` integration tests (SPEC.md §7.7) |
| E2E lint / determinism | `n/a` | No dedicated determinism-lint tool specified in SPEC.md §6; e2e spec files are covered by the project's regular `eslint.config.js` |
| E2E | `pnpm e2e:full` — **run locally from the host only** | Runs the deterministic cross-browser UI suite first, then one serialized Chromium real-model/CDN smoke. Use `pnpm e2e` during ordinary iteration; use `pnpm e2e:real-model` to diagnose only the external inference path. Never run Playwright in Docker or CI. |
| Smoke | `docker compose exec -T app node -e "fetch('http://localhost:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"` | Deterministic, container-network-native — doesn't need port 3000 published to the host or TLS/nginx up. `app` also has a Docker `healthcheck` (docker-compose.yml) doing the same check on a 10s interval; `docker compose ps app` should show `(healthy)`. Phase files may override with a phase-specific check. |

Architecture lint (run in CI before tests, not part of the standard gate rows above — SPEC.md §7.7):

```bash
pnpm exec steiger ./src
```

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

```bash
pnpm tsc --noEmit          # type-check, strict mode
pnpm vitest run            # unit + integration (Testing Library for hooks)
pnpm exec steiger ./src    # FSD architecture lint — run before tests in CI
pnpm e2e                   # Fast deterministic cross-browser UI/canvas/download suite
pnpm e2e:real-model        # Serialized Chromium smoke against the real model/CDN
pnpm e2e:model-lab-real    # Phase 15 only: serialized BEN2/MVANet WASM compatibility report
pnpm e2e:phase-17-real     # Phase 17 only: serialized iterative SlimSAM runtime evidence
pnpm e2e:matting-lab-real  # Phase 18 only: serialized ViTMatte alpha/runtime evidence
pnpm e2e:phase-19-real     # Phase 19 only: serialized production q8/fp32 refinement evidence
pnpm e2e:phase-20-real     # Phase 20 only: serialized full-pipeline + bounded-input evidence
pnpm e2e:phase-21-real     # Phase 21 only: serialized brush-derived SlimSAM evidence
pnpm e2e:full              # Required phase gate: deterministic suite + real-model smoke
                           # host-only: never in Docker, never in CI
```

Playwright drives the app the way a human would in a browser. `pnpm e2e` replaces only the external
ML Worker boundary with a deterministic in-browser test double; uploads, state transitions,
canvas editing, responsive layouts, and downloads remain real and run across the browser matrix.
`pnpm e2e:real-model` owns the slow/network-dependent ONNX+CDN check and runs once, serially, in
Chromium. Write or extend the deterministic suite for every changed user-facing flow and run
`pnpm e2e:full` at `/phase-gate`. Playwright remains host-only and stays out of Docker/CI.

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

# e2e — host-only, run against `pnpm dev` (never in Docker/CI); write/extend a
# spec for every new user-facing flow (AGENTS.md core rule 8)
pnpm e2e                  # fast iteration
pnpm e2e:full             # phase gate, includes one real-model smoke
pnpm e2e:model-lab-real   # opt-in Phase 15 evaluation; never CI/normal matrix
pnpm e2e:matting-lab-real # opt-in Phase 18 ViTMatte evaluation; never CI/normal matrix
pnpm e2e:phase-19-real    # opt-in Phase 19 production refiner; never CI/normal matrix
pnpm e2e:phase-20-real    # opt-in Phase 20 hybrid pipeline; never CI/normal matrix
pnpm e2e:phase-21-real    # opt-in Phase 21 brush-guided SlimSAM; never CI/normal matrix

# Sitemap (SPEC.md §7.5): `pnpm build` runs this automatically before `vite
# build` so `public/sitemap.xml` is always current with `src/routes/` — run
# it standalone only to inspect/debug its output.
pnpm generate-sitemap

# Synchronize pinned public model/WASM files into deploy/model-assets/.
# Prefer the container command on the VPS for dependency/container parity.
pnpm sync-model-assets --check
docker compose --profile maintenance run --rm --build model-sync
```
