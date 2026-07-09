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
- [x] `F1` Bootstrap TanStack Start v1.x project on Vite, Nitro `node-server` preset, TypeScript strict mode — _Depends on:_ —
- [x] `F2` Scaffold Feature-Sliced Design layer skeleton (`app/pages/features/entities/shared`, each with a public `index.ts`) per SPEC.md §6 — _Depends on:_ `F1`
- [x] `F3` Configure ESLint flat config + `typescript-eslint`, Prettier + `eslint-config-prettier` — _Depends on:_ `F1`
- [x] `F4` Configure Steiger + `@feature-sliced/steiger-plugin` to enforce FSD layer/public-API boundaries — _Depends on:_ `F2`, `F3`
- [x] `F5` Configure Husky + lint-staged pre-commit hook (lint + format before commit) — _Depends on:_ `F3`
- [x] `F6` Minimal "hello world" page at `/`: thin `routes/index.tsx` (loader + head meta only) rendering a `pages/home` stub — validates the full SSR pipeline end to end — _Depends on:_ `F2`

### Infra
- [x] `I1` Dockerfile for the Nitro `node-server` app image — _Depends on:_ `F1`
- [x] `I2` `docker-compose.yml` with `nginx` and `app` services (`restart: unless-stopped`; `app` runs with `init: true` for correct signal handling / no zombie processes) — _Depends on:_ `I1`
- [x] `I3` Nginx reverse proxy to the `app` container (Nitro default port 3000), Gzip/Brotli for SSR text responses — _Depends on:_ `I2`
- [x] `I4` TLS: Certbot with cron renewal, or `nginx-proxy` + `acme-companion` — _Depends on:_ `I3`
- [x] `I5` GitHub Actions CI on push to `main`: lint → build Docker image → push to GitHub Container Registry — _Depends on:_ `F3`, `F4`, `I1`
- [x] `I6` Deploy step: SSH to the hip-hosting VPS, `docker compose pull && docker compose up -d` — _Depends on:_ `I5`, `I2`

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
pnpm-workspace.yaml                        # minimumReleaseAge: 0 — see docs/KNOWN_GOTCHAS.md
tsconfig.json
vite.config.ts                             # TanStack Start config lives here — no separate app.config.ts (framework doesn't use one)
eslint.config.js
.prettierrc
.prettierignore
.lintstagedrc.json
.gitignore
.dockerignore
steiger.config.ts
vitest.config.ts                           # passWithNoTests: true until Phase 02 adds real tests
.husky/pre-commit
src/app/styles/                            # Tailwind entry point
src/router.tsx                             # NOT src/app/router.tsx — framework hard-requires src root, see docs/KNOWN_GOTCHAS.md
src/routes/__root.tsx
src/routes/index.tsx
src/pages/home/ui/HomePage.tsx             # "hello world" stub, replaced in Phase 04
src/pages/home/index.ts
Dockerfile
docker-compose.yml
deploy/nginx/app.conf
deploy/init-letsencrypt.sh                 # Certbot bootstrap — see Implementation Notes
.github/workflows/ci.yml
~~~

### Do NOT touch
- `src/features/`, `src/entities/` — created empty at most; real slices land in Phase 02/03
- Any `umami`/analytics container config — Phase 05 (SPEC.md §8)
- Model weight / R2 upload pipeline — Phase 02 (SPEC.md §6.1)
- `src/shared/config/env.ts`, `src/app/providers/` — not created this phase; see Implementation Notes

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
- infrastructure / bootstrap — scoped to `app` only; `nginx`+`certbot` need a real cert and can only
  be verified on the VPS post `deploy/init-letsencrypt.sh` (see STACK.md § TLS / reverse-proxy
  verification)
- migrations — `n/a`, no database in this project
- backend / unit tests — `n/a`, no separate backend test suite (single TS/React codebase)
- frontend prep, type-check, unit tests
- e2e — `n/a` until Phase 04 installs Playwright and has a real critical path to exercise
- the default smoke check (container-network-native, doesn't require nginx/TLS or a published host
  port — see STACK.md)

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

- [x] `R1` `/phase-gate 01` found that "Infrastructure / bootstrap" and the phase-specific "Smoke"
  check, exactly as declared, cannot pass in any environment except the production VPS after
  `deploy/init-letsencrypt.sh` has run. Observed: `docker compose up --build -d` starts `app` and
  `certbot` fine, but `nginx` crash-loops (`cannot load certificate ".../cutbg.art/fullchain.pem"`)
  because no real cert exists yet; the smoke command targets `http://localhost:3000/`, but `app`
  only `expose`s port 3000 internally — nothing publishes it to the host, so the only reachable path
  is through `nginx`, which is down. Expected: gate commands in `docs/STACK.md` should have a path
  to green in dev/CI without a real domain, while the production TLS/reverse-proxy topology in
  `docker-compose.yml` stays as-is (nginx-only ingress is the intended prod security posture, not to
  be casually bypassed).
- [x] `R2` `/phase-gate 01`'s "E2E" check ran `pnpm playwright test` (as declared in
  `docs/STACK.md`) and failed with `Command "playwright" not found` — the package was never
  installed, only the `e2e` npm script referencing it exists. Expected: either the command actually
  works (package installed) or `docs/STACK.md` honestly marks the row `n/a` until Phase 04 has a
  critical path worth exercising, so the gate doesn't fail on a phase with no e2e coverage to run.

---

## Implementation Notes

- `src/router.tsx` lives at the source root, not `src/app/router.tsx` as the SPEC.md §6 illustrative
  tree suggests — TanStack Start's default entry points only auto-discover the router at that fixed
  path, it's not configurable. See `docs/KNOWN_GOTCHAS.md`.
- No `app.config.ts` — TanStack Start's Vite plugin (`vite.config.ts`) is the only config surface;
  the framework doesn't use a separate app-level config file.
- `src/shared/config/env.ts` and `src/app/providers/` were planned in this phase's original file
  list but not created: no env var is read by client code yet, and no provider exists yet to wrap.
  Both are trivial to add in whichever phase first needs them (env.ts likely Phase 05 for analytics
  keys; providers likely Phase 03+ for theme/analytics context) — creating empty scaffolding now
  would just be dead code.
- TypeScript is pinned to `6.0.3`, not the newest `7.x` line: `typescript-eslint`'s peer range caps
  at `<6.1.0`, and 7.x broke typed linting. Revisit the pin once `typescript-eslint` catches up.
- nginx's TLS config references `/etc/letsencrypt/live/cutbg.art/*.pem` unconditionally, which won't
  exist on a first deploy — `deploy/init-letsencrypt.sh` (dummy cert → start nginx → real cert →
  reload) breaks that bootstrap chicken-and-egg loop; run it once per new host before the normal
  `docker compose up -d` flow.
- `pnpm-workspace.yaml` sets `minimumReleaseAge: 0` to unblock Docker builds run shortly after
  `pnpm add`; see `docs/KNOWN_GOTCHAS.md`.
- Review fix (`R1`): added a Docker `healthcheck` to the `app` service (Node's built-in `fetch`,
  no extra tooling) and rescoped `docs/STACK.md`'s bootstrap/smoke gate commands to the `app`
  container directly, since `nginx`+`certbot` structurally can't come up outside the real VPS.
  `docker-compose.yml`'s production topology (nginx as sole ingress) is unchanged — this only fixed
  what the automated gate checks, not what's deployed.
- Review fix (`R2`): left Playwright uninstalled and marked `docs/STACK.md`'s E2E row `n/a` rather
  than installing a framework with nothing to test yet — activates in Phase 04.

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
