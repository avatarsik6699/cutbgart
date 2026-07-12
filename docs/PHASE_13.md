# PHASE 13 — Hardening & Launch

> ⚠️ Scaffolded ahead of Phase 12 completing, per architect-approved plan (2026-07-12) that split
> the original one-line Phase 12 stub into Phase 12 (Localization, Branding & Launch Content) and
> this phase, renumbered but otherwise unchanged in scope. Do not start implementation until
> PHASE_12 is `✅ done` — this phase's real-device pass exercises the bilingual, restyled UI Phase 12
> ships, not the current one.

## Phase Metadata

| Field | Value |
|-------|-------|
| Phase | `13` |
| Title | Hardening & Launch |
| Status | `⏳ pending` |
| Tag | `v0.13.0` |
| Depends on | PHASE_12 gate passing |

---

## Phase Goal

Confidence across the real device matrix, then public availability. Full pass over SPEC.md §7.4's
cross-browser matrix on real devices (not just emulators/headless), a polish pass on anything that
pass surfaces, and production publish at `cutbg.art` — explicitly not blocked on the separate
portfolio/donation track (SPEC.md §8, §1.3).

---

## Scope

### Infra
- [ ] `I1` Execute the full §7.4 real-device test matrix, not emulators: Chrome/Edge desktop (WebGPU + `fp16`), Safari desktop/iOS (WASM + `q8` fallback — real device, not simulator), Android Chrome (WebGPU chipset-dependent with fallback), older/low-power devices (WASM, confirm UI never hangs) — _Depends on:_ —
- [ ] `I2` Production deploy: bring up the existing Docker Compose stack (`nginx`, `app`, `umami` + `umami-db`) on the VPS per SPEC.md §6, confirm TLS (Certbot or `nginx-proxy`+`acme-companion`) and DNS for `cutbg.art`, verify the existing `.github/workflows/ci.yml` build→push→deploy pipeline end to end on a real push to `main` — _Depends on:_ `I1`

### Other
- [ ] `T1` Polish pass: fix any UX/perf/correctness issues surfaced by the real-device matrix (`I1`) before publish — _Depends on:_ `I1`

<!-- Test execution is governed by `## Gate Checks` below + docs/STACK.md § Gate Commands.
     Do not duplicate that list here. -->

---

## Files

### Create / modify
~~~
.github/workflows/ci.yml            (verify only, unless the real-device pass finds a gap)
docker-compose.yml
deploy/nginx/                       (TLS/reverse-proxy config, verify only)
playwright.config.ts                ([TODO: verify] whether additional real-device/browser
                                     projects are needed beyond the existing chromium/webkit/
                                     Mobile Safari set, based on I1's findings)
~~~
Exact files modified by `T1`'s polish pass are not knowable ahead of running `I1` — do not invent
them here.

### Do NOT touch
- Product feature code (`src/features/*`, `src/entities/*`) unless `T1` finds a genuine device-
  specific bug — this phase hardens and ships what Phases 01–12 already built, it does not add
  product scope
- `docs/SPEC.md` §1–§6 domain/contract sections (no new features, no new contracts)

---

## Contracts

> This section is the source of truth for `/context-update`. Fill it in **before** handing to AI.

### New persistent data (tables / collections / files)

None

### New API endpoints / RPC methods / events

None — this phase hardens and deploys existing routes; it does not add new ones.

### New types / models / shared interfaces

None

### New env vars

None expected — production values for the existing Env Config table (`docs/STATE.md` § Current
Contract) are populated as part of `I2`'s deploy, not new keys.

---

## Gate Checks

> **Before running gate:** confirm all Scope checkboxes are checked (or explicitly deferred in
> Architect Review Notes). Unchecked items appear in the gate report as a warning, not a hard block.

Run `/phase-gate 13` before committing.

`/phase-gate` returns full PASS only when:
- Automated checks are green
- All architect review items below are resolved (checked off)

Use the commands in [docs/STACK.md](./STACK.md#gate-commands) as the source of truth for:
- infrastructure / bootstrap
- frontend prep, type-check, unit tests
- e2e — the existing Playwright cross-browser matrix must stay green; extend it only if `I1`'s
  real-device pass finds a gap headless/emulated coverage missed
- the default smoke check

```bash
# Phase-specific smoke override
# Real-device verification is manual (I1) — record findings per device/browser in this file's
# Implementation Notes or as Architect Review Notes, not invented here ahead of time.
```

---

## Architect Review Notes

- [x] No architect review issues recorded

---

## Implementation Notes

None

---

## Atomic Commit Message

```
feat(phase-13): real-device hardening pass and production launch
```

---

## Post-Phase Checklist

- [ ] All Scope checkboxes checked (or deferred in Architect Review Notes)
- [ ] All automated gate checks green
- [ ] All architect review notes resolved
- [ ] `docs/STATE.md` updated — run `/context-update 13`
- [ ] Committed atomically on `feat/phase-13` branch
- [ ] Tag created after merge to develop: `git tag -a v0.13.0 -m "Phase 13: Hardening & Launch"`
