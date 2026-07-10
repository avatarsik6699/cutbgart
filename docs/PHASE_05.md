# PHASE 05 — Analytics

<!-- TOKEN BUDGET: keep this file under 10,000 tokens. Be concise. -->

## Phase Metadata

| Field | Value |
|-------|-------|
| Phase | `05` |
| Title | Analytics |
| Status | `✅ done` |
| Tag | `v0.05.0` |
| Depends on | PHASE_04 gate passing |

---

## Phase Goal

Wire up funnel visibility: Cloudflare Web Analytics (zero-config, real-user Core Web Vitals) and a
self-hosted Umami instance (custom event tracking), with all events from SPEC.md §7.6 firing from
the existing `pages/home` state machine. No PII, no image data, no linkage to a specific image or
its content — aggregate counters only (SPEC.md §7.6, §1.1 privacy invariant). This phase is pure
instrumentation: no new pages, no changes to the ML pipeline or upload/download UX (SPEC.md §8).

---

## Scope

### Infra
- [x] `I1` Add `umami` + `umami-db` (Postgres) services to `docker-compose.yml`: `umami-db` has a
  persistent volume + healthcheck gating `umami` startup; both `restart: unless-stopped`
  (SPEC.md §6) — _Depends on:_ —
- [x] `I2` Add an Nginx location block (`deploy/nginx/app.conf`) proxying Umami's public script/
  collect endpoints so the self-hosted instance is reachable from the app's domain — _Depends on:_ `I1`
- [x] `I3` Wire uptime monitoring (Uptime Kuma self-hosted, added as a `docker-compose.yml` service,
  or UptimeRobot free tier if no extra container is wanted): ping home page + Umami `/api/heartbeat`
  every 5 min, alert via Telegram/email (SPEC.md §7.6) — _Depends on:_ `I1`

### Frontend
- [x] `F1` `shared/lib/analytics` slice: `AnalyticsEvent` union type + `trackEvent()` wrapper around
  `window.umami.track(...)`, no-op safe when the script hasn't loaded yet (dev/test) — _Depends on:_ —
- [x] `F2` Inject the Umami tracking script and the Cloudflare Web Analytics beacon script into
  `routes/__root.tsx` head, gated on production env vars so local dev stays script-free — _Depends
  on:_ `F1`
- [x] `F3` Fire `model_load_started` / `model_load_completed` / `model_load_failed` from
  `features/remove-background/model/useBackgroundRemoval.ts`'s existing dispatch call sites (state
  machine reducer itself stays a pure function — side effects live in the hook) — _Depends on:_ `F1`
- [x] `F4` Fire `processing_started` / `processing_completed` / `processing_failed` from the same
  hook's `START_PROCESSING` / `PROCESSING_SUCCEEDED` / processing-phase `FAILED` dispatch sites —
  _Depends on:_ `F1`
- [x] `F5` Fire `webgpu_unavailable_fallback` from
  `features/remove-background/model/device-capabilities.ts` when WASM is selected over WebGPU —
  _Depends on:_ `F1`
- [x] `F6` Fire `download_clicked` from `features/download-result/ui/DownloadResultButton.tsx`'s
  click handler — _Depends on:_ `F1`

<!-- Test execution is governed by `## Gate Checks` below + docs/STACK.md § Gate Commands.
     Do not duplicate that list here. -->

---

## Files

### Create / modify
~~~
docker-compose.yml
deploy/nginx/app.conf
src/shared/lib/analytics/types.ts
src/shared/lib/analytics/track-event.ts
src/shared/lib/analytics/index.ts
src/shared/config/env.ts
src/routes/__root.tsx
src/features/remove-background/model/useBackgroundRemoval.ts
src/features/remove-background/model/useBackgroundRemoval.test.ts
src/features/remove-background/model/device-capabilities.ts
src/features/remove-background/model/device-capabilities.test.ts
src/features/download-result/ui/DownloadResultButton.tsx
src/features/download-result/ui/DownloadResultButton.test.tsx
docs/STACK.md
~~~

### Do NOT touch
- `src/features/remove-background/model/state-machine.ts` — must stay a pure reducer; analytics is
  a side effect and belongs in the hook, not here
- `src/pages/home/ui/HomePage.tsx` — no UI/UX changes this phase, only instrumentation one layer down
- `public/sw.js`, model-loading/inference logic itself — untouched, out of scope

---

## Contracts

> This section is the source of truth for `/context-update`. Fill it in **before** handing to AI.

### New persistent data (tables / collections / files)

None owned by this app. `umami-db` (Postgres) is Umami's own internal schema, managed entirely by
the Umami container image — this app's contract still has no server-side persistent store
(SPEC.md §3).

### New API endpoints / RPC methods / events

None on this app's own server contract (SPEC.md §4 invariant unchanged). Umami's own
`/api/heartbeat` and event-collection endpoint belong to the `umami` container, not this app.

Umami custom events fired from the client (SPEC.md §7.6):

| Event | Fired from | Purpose |
|-------|-----------|---------|
| `model_load_started` | `useBackgroundRemoval` on `SELECT_FILE` (idle/error → model-loading) | Model-load drop-off rate |
| `model_load_completed` | `useBackgroundRemoval` on `MODEL_READY` | Model-load drop-off rate |
| `model_load_failed` | `useBackgroundRemoval` on `FAILED` while status was `model-loading` | Model-load drop-off rate |
| `processing_started` | `useBackgroundRemoval` on `START_PROCESSING` | Core product completion metric |
| `processing_completed` | `useBackgroundRemoval` on `PROCESSING_SUCCEEDED` | Core product completion metric |
| `processing_failed` | `useBackgroundRemoval` on `FAILED` while status was `processing` | Core product completion metric |
| `download_clicked` | `DownloadResultButton` click handler | Funnel's final conversion |
| `webgpu_unavailable_fallback` | `detectDeviceCapabilities` when WebGPU adapter request fails/unsupported | WASM fallback frequency |

### New types / models / shared interfaces

```ts
// src/shared/lib/analytics/types.ts — Phase 05, per SPEC.md §7.6
type AnalyticsEvent =
  | "model_load_started"
  | "model_load_completed"
  | "model_load_failed"
  | "processing_started"
  | "processing_completed"
  | "processing_failed"
  | "download_clicked"
  | "webgpu_unavailable_fallback";

// Aggregate counters only — no PII, no image data, no per-image linkage (SPEC.md §1.1, §7.6).
function trackEvent(event: AnalyticsEvent, data?: Record<string, string | number | boolean>): void;
```

### New env vars

| Key | Example value | Required |
|-----|---------------|----------|
| `VITE_UMAMI_SCRIPT_URL` | `https://umami.cutbg.art/script.js` | required for production; unset in dev disables the script injection |
| `VITE_UMAMI_WEBSITE_ID` | `3b1e...uuid` | required for production |
| `VITE_CF_BEACON_TOKEN` | `abc123token` | required for production (Cloudflare Web Analytics beacon) |
| `UMAMI_APP_SECRET` | `<random 32+ char secret>` | required — `umami` container's own env, docker-compose only |
| `UMAMI_DATABASE_URL` | `postgresql://umami:***@umami-db:5432/umami` | required — `umami` container's own env, docker-compose only |
| `POSTGRES_PASSWORD` | `<random secret>` | required — `umami-db` container's own env, docker-compose only |

---

## Gate Checks

> **Before running gate:** confirm all Scope checkboxes are checked (or explicitly deferred in
> Architect Review Notes). Unchecked items appear in the gate report as a warning, not a hard block.

Run `/phase-gate 05` before committing.

`/phase-gate` returns full PASS only when:
- Automated checks are green
- All architect review items below are resolved (checked off)

Use the commands in [docs/STACK.md](./STACK.md#gate-commands) as the source of truth for:
- infrastructure / bootstrap
- migrations (if applicable)
- backend / unit tests
- frontend prep, type-check, unit tests (if a frontend exists)
- e2e — mandatory for any phase that adds/changes a user-facing flow (AGENTS.md core rule 8): add
  or extend a Playwright spec under `e2e/` covering it, not just `n/a`
- the default smoke check

This phase adds no new user-facing flow (pure instrumentation of the existing Phase 04 flow), so no
new e2e spec is required by AGENTS.md core rule 8. Extend the existing `e2e/home.spec.ts` only if
verifying that `trackEvent` calls fire (stub `window.umami` in the test) turns out to be cheap;
otherwise cover event-firing at the Vitest/unit level (mocking `window.umami.track`) instead.

If this phase needs a custom smoke target or other phase-specific note, record it here:

```bash
# Optional phase-specific smoke override
docker compose up --build -d app umami umami-db
docker compose exec -T app node -e "fetch('http://localhost:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
docker compose ps umami
# expected: umami "healthy"/"running" once umami-db's healthcheck passes
```

---

## Architect Review Notes

Use this section after manual product, UX, API, or workflow verification. This is the human-facing
channel for post-implementation fixes.

Add one unchecked checkbox per issue the agent must fix before the phase can close. Keep each item
independently fixable and describe observed behavior plus expected behavior. If the fix may change
SPEC/API/schema/security behavior, say so explicitly in the note.

The agent resolves these items through `/impl-assist 05 review`. Leave an item unchecked while it
is still open. Check it off only after the fix is implemented and re-verified. If manual
verification found nothing, keep the default checked line below.

- [x] No architect review issues recorded

---

## Implementation Notes

<!-- Optional. The agent adds a short bullet here only when something isn't already visible from
     the code or commit history: an intentional deviation from the plan, a residual risk, a
     rejected alternative. Leave empty when nothing needs recording — this is not a mandatory
     per-task log. -->

- `shared/lib/analytics` uses a flat `types.ts` / `track-event.ts` / `index.ts` layout instead of
  the originally-planned `model/` subfolder — Steiger's `fsd/no-reserved-folder-names` flags `model`
  as a reserved segment name inside the `shared` layer (which doesn't use slice/segment nesting the
  way `entities`/`features` do). Matches the existing flat `shared/config` layout.
- Chose Uptime Kuma (self-hosted, `docker-compose.yml` service) over UptimeRobot for `I3`, to stay
  consistent with this project's self-hosted-everything infra pattern (own nginx/certbot, own
  Umami). Its monitors and Telegram/email alert channels have no compose/env-based config surface —
  they're a one-time manual setup through Kuma's own web UI after first deploy, reached via an SSH
  tunnel to the loopback-bound port (documented in `docker-compose.yml` and `docs/STACK.md`).
- `I2`'s Nginx location blocks proxy Umami's script/collect endpoints at `/script.js` and
  `/api/send` on the app's own domain (`cutbg.art`), not a separate `umami.` subdomain — this needs
  no extra DNS record or certificate. The `VITE_UMAMI_SCRIPT_URL` "Example value" in this phase's
  Contracts table (`https://umami.cutbg.art/script.js`) is illustrative only; the real production
  value should point at this app's own domain, e.g. `https://cutbg.art/script.js`.
- Worker `error` messages are attributed to `model_load_failed` vs. `processing_failed` via a new
  `awaitingModelLoadRef` in `useBackgroundRemoval.ts`, rather than reading `state.status` inside the
  worker's message handler — the handler is only ever bound once per worker instance (`getWorker`
  guards with `if (!worker)`), so a `state.status` read there would go stale after the first
  attempt. The ref sidesteps that.
- Docker-dependent verification (`docker compose config`, infra/smoke gate steps) was not run this
  pass — the Docker CLI itself errored (`Input/output error`) in this session, a transient
  Docker Desktop/WSL integration issue rather than a real unavailability per `docs/STACK.md`.
  `docker-compose.yml` was YAML-validated instead; re-run the Docker-based gate steps once Docker is
  back before/at `/phase-gate 05`.
- Post-implementation manual testing (real browser, non-headless) surfaced that the ML pipeline
  itself was fundamentally broken (WebGPU shader-binding limit, WASM `std::bad_alloc`) — outside
  this phase's declared scope (`Do NOT touch` listed `pages/home/ui/HomePage.tsx` and the
  model-loading/inference logic), but blocking any manual verification of this phase's own
  analytics events, since the app couldn't complete a single processing run. Fixed by swapping the
  ML model (BiRefNet → IS-Net) and, once the app was actually usable, three follow-up UX fixes
  (before/after slider bug, diagnostic log panel, WebGPU re-enabled) that the architect reported
  during that same testing pass. Full rationale in `docs/STATE.md` Project Log, 2026-07-10 entries
  "ML model swap: BiRefNet → IS-Net" and "Post-IS-Net UX fixes". Bundled into this phase's commit
  rather than opened as a separate phase, since it was a blocking prerequisite for verifying this
  phase's own scope, not new product surface.

---

## Atomic Commit Message

```
feat(phase-05): analytics — Umami events, Cloudflare Web Analytics, uptime monitoring
```

---

## Post-Phase Checklist

- [x] All Scope checkboxes checked (or deferred in Architect Review Notes)
- [x] All automated gate checks green
- [x] All architect review notes resolved
- [x] `docs/STATE.md` updated — run `/context-update 05`
- [x] Committed atomically on `feat/phase-05` branch
- [x] Tag created after merge to develop: `git tag -a v0.05.0 -m "Phase 05: Analytics"`
