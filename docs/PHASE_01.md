# PHASE 01 — Scaffold

<!-- TOKEN BUDGET: keep this file under 10,000 tokens. Be concise. -->

## Phase Metadata

| Field | Value |
|-------|-------|
| Phase | `01` |
| Title | Scaffold |
| Status | `⏳ pending` |
| Tag | `v0.01.0` |
| Depends on | — (first phase, no predecessor) |

---

## Phase Goal

Stand up the full infrastructure chain — project scaffold, tooling, containerization, and VPS
deploy — before any product/ML logic exists, so every later phase builds on a working pipeline
rather than debugging deploy plumbing under feature pressure. Delivers a deployed "hello world"
page that proves the SSR → Docker → Nginx → VPS chain end to end. See `docs/SPEC.md` §6 (stack) and
§8 (phase `01`).

---

## Scope

### Frontend
- [ ] `F1` Bootstrap TanStack Start v1.x project on Vite, Nitro `node-server` preset, TypeScript strict mode — _Depends on:_ —
- [ ] `F2` Scaffold Feature-Sliced Design layer skeleton (`app/pages/features/entities/shared`, each with a public `index.ts`) per SPEC.md §6 — _Depends on:_ `F1`
- [ ] `F3` Configure ESLint flat config + `typescript-eslint`, Prettier + `eslint-config-prettier` — _Depends on:_ `F1`
- [ ] `F4` Configure Steiger + `@feature-sliced/steiger-plugin` to enforce FSD layer/public-API boundaries — _Depends on:_ `F2`, `F3`
- [ ] `F5` Configure Husky + lint-staged pre-commit hook (lint + format before commit) — _Depends on:_ `F3`
- [ ] `F6` Minimal "hello world" page at `/`: thin `routes/index.tsx` (loader + head meta only) rendering a `pages/home` stub — validates the full SSR pipeline end to end — _Depends on:_ `F2`

### Infra
- [ ] `I1` Dockerfile for the Nitro `node-server` app image — _Depends on:_ `F1`
- [ ] `I2` `docker-compose.yml` with `nginx` and `app` services (`restart: unless-stopped`; `app` runs with `init: true` for correct signal handling / no zombie processes) — _Depends on:_ `I1`
- [ ] `I3` Nginx reverse proxy to the `app` container (Nitro default port 3000), Gzip/Brotli for SSR text responses — _Depends on:_ `I2`
- [ ] `I4` TLS: Certbot with cron renewal, or `nginx-proxy` + `acme-companion` — _Depends on:_ `I3`
- [ ] `I5` GitHub Actions CI on push to `main`: lint → build Docker image → push to GitHub Container Registry — _Depends on:_ `F3`, `F4`, `I1`
- [ ] `I6` Deploy step: SSH to the hip-hosting VPS, `docker compose pull && docker compose up -d` — _Depends on:_ `I5`, `I2`

<!-- No Backend or Data groups: this project has no server-side API surface beyond SSR page
     shells and no persistent data store (SPEC.md §3, §4) — infra work above covers the SSR
     server itself. `umami` + `umami-db` are explicitly deferred to Phase 05 (Analytics, SPEC.md
     §8) and are out of scope here. -->

<!-- Test execution is governed by `## Gate Checks` below + docs/STACK.md § Gate Commands.
     Do not duplicate that list here. -->

---

## Files

### Create / modify
~~~
package.json
pnpm-lock.yaml
tsconfig.json
vite.config.ts
app.config.ts                              # TanStack Start config (Nitro node-server preset)
eslint.config.js
.prettierrc
steiger.config.ts
.husky/pre-commit
src/app/providers/                         # placeholder, populated in later phases
src/app/styles/                            # Tailwind entry point
src/app/router.tsx
src/routes/index.tsx
src/pages/home/ui/HomePage.tsx             # "hello world" stub, replaced in Phase 04
src/pages/home/index.ts
src/shared/config/env.ts
Dockerfile
docker-compose.yml
deploy/nginx/app.conf
.github/workflows/ci.yml
.dockerignore
~~~

### Do NOT touch
- `src/features/`, `src/entities/` — created empty at most; real slices land in Phase 02/03
- Any `umami`/analytics container config — Phase 05 (SPEC.md §8)
- Model weight / R2 upload pipeline — Phase 02 (SPEC.md §6.1)

---

## Contracts

> This section is the source of truth for `/context-update`. Fill it in **before** handing to AI.

### New persistent data (tables / collections / files)

None
<!-- SPEC.md §3: no server-side data store in this project. -->

### New API endpoints / RPC methods / events

| Method | Path / Topic | Auth | Response / Payload |
|--------|--------------|------|---------------------|
| `GET` | `/` | none | SSR HTML page shell ("hello world" placeholder; full home composition arrives in Phase 04, SPEC.md §4, §5.1) |

### New types / models / shared interfaces

None
<!-- No domain entities (SourceImage / AlphaMatte / ProcessedImage, SPEC.md §2.2) are introduced
     until Phase 02 (ML core). -->

### New env vars

| Key | Example value | Required |
|-----|---------------|----------|
| `PORT` | `3000` | no — Nitro `node-server` preset default; set explicitly in `Dockerfile`/`docker-compose.yml` so Nginx's upstream port (I3) is never implicit |
| `NODE_ENV` | `production` | no — standard Node convention for the container build; TanStack Start/Nitro don't require it, but omitting it silently leaves dev-mode behavior in prod |

<!-- Resolved via TanStack Start docs (context7 /websites/tanstack_start_framework_react,
     guide/hosting.md): PORT is the documented env var for the node-server preset, default 3000.
     No other env vars are implied by SPEC.md for this phase — nothing else invented. -->

---

## Gate Checks

> **Before running gate:** confirm all Scope checkboxes are checked (or explicitly deferred in
> Architect Review Notes). Unchecked items appear in the gate report as a warning, not a hard block.

Run `/phase-gate 01` before committing.

`/phase-gate` returns full PASS only when:
- Automated checks are green
- All architect review items below are resolved (checked off)

Use the commands in [docs/STACK.md](./STACK.md#gate-commands) as the source of truth for:
- infrastructure / bootstrap
- migrations — `n/a`, no database in this project
- backend / unit tests — `n/a`, no separate backend test suite (single TS/React codebase)
- frontend prep, type-check, unit tests
- e2e — `pnpm playwright test` exists as a command, but there is nothing meaningful to exercise
  until Phase 04's critical path (upload → process → download) lands; treat as a no-op through
  Phase 03
- the default smoke check

```bash
# Phase-specific smoke override — this phase has no product page yet, just the hello-world shell
curl -sf http://localhost:3000/ | grep -qi "hello"
# expected: 200 response, SSR HTML containing the hello-world placeholder markup
```

---

## Architect Review Notes

Use this section after manual product, UX, API, or workflow verification. This is the human-facing
channel for post-implementation fixes.

Add one unchecked checkbox per issue the agent must fix before the phase can close. Keep each item
independently fixable and describe observed behavior plus expected behavior. If the fix may change
SPEC/API/schema/security behavior, say so explicitly in the note.

The agent resolves these items through `/impl-assist 01 review`. Leave an item unchecked while it
is still open. Check it off only after the fix is implemented and re-verified. If manual
verification found nothing, keep the default checked line below.

- [x] No architect review issues recorded

---

## Implementation Notes

<!-- Optional. The agent adds a short bullet here only when something isn't already visible from
     the code or commit history: an intentional deviation from the plan, a residual risk, a
     rejected alternative. Leave empty when nothing needs recording — this is not a mandatory
     per-task log. -->

None

---

## Atomic Commit Message

```
feat(phase-01): scaffold TanStack Start + FSD, tooling, Docker deploy
```

---

## Post-Phase Checklist

- [ ] All Scope checkboxes checked (or deferred in Architect Review Notes)
- [ ] All automated gate checks green
- [ ] All architect review notes resolved
- [ ] `docs/STATE.md` updated — run `/context-update 01`
- [ ] Committed atomically on `feat/phase-01` branch
- [ ] Tag created after merge to develop: `git tag -a v0.01.0 -m "Phase 01: Scaffold"`
