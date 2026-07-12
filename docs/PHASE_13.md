# PHASE 13 — Hardening & Launch

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

Finalize the SEO scenario-page image presentation, establish confidence across the real device
matrix, then make the product publicly available. The phase sizes the architect-provided example
assets without distortion or layout shift, exercises the launch UI on real target devices, fixes
issues that pass surfaces, and publishes at `cutbg.art` (SPEC.md §5.1, §7.4, §7.5, §8).

---

## Scope

### Frontend
- [x] `F1` Update all four scenario-page examples to declare each final asset's actual intrinsic dimensions, preserve its aspect ratio with `height: auto`, center it, and cap its responsive rendered inline size at `min(100%, 40rem)` without upscaling or stretching; retain below-the-fold `loading="lazy"` behavior — _Depends on:_ —
- [x] `F2` Extend Playwright scenario-page coverage to assert the square and portrait examples load with the expected intrinsic aspect ratios and stay within the responsive `40rem` display cap in both locales — _Depends on:_ `F1`

### Infra
- [x] `I1` Execute the full §7.4 real-device test matrix, not emulators: Chrome/Edge desktop (WebGPU + `fp16`), Safari desktop/iOS (WASM + `q8` fallback — real device, not simulator), Android Chrome (WebGPU chipset-dependent with fallback), older/low-power devices (WASM, confirm UI never hangs) — _Depends on:_ `F1`, `F2`
- [x] `I2` Production deploy: bring up the existing Docker Compose stack (`nginx`, `app`, `umami` + `umami-db`) on the VPS per SPEC.md §6, confirm TLS (Certbot or `nginx-proxy`+`acme-companion`) and DNS for `cutbg.art`, verify the existing `.github/workflows/ci.yml` build→push→deploy pipeline end to end on a real push to `main` — _Depends on:_ `I1`

### Other
- [x] `T1` Polish pass: fix any UX/perf/correctness issues surfaced by the real-device matrix (`I1`) before publish — _Depends on:_ `I1`

<!-- Test execution is governed by `## Gate Checks` below + docs/STACK.md § Gate Commands.
     Do not duplicate that list here. -->

---

## Files

### Create / modify
~~~
public/images/product-photo-example.webp   (architect-provided final asset; verify dimensions)
public/images/document-photo-example.webp  (architect-provided final asset; verify dimensions)
public/images/logo-example.webp            (architect-provided final asset; verify dimensions)
public/images/avatar-example.webp          (architect-provided final asset; verify dimensions)
src/pages/product-photo/ui/ProductPhotoPage.tsx
src/pages/document-photo/ui/DocumentPhotoPage.tsx
src/pages/logo/ui/LogoPage.tsx
src/pages/avatar/ui/AvatarPage.tsx
e2e/scenario-pages.spec.ts
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
- Scenario-page SEO copy, route metadata, sitemap generation, and JSON-LD — only example-image
  presentation changes in this phase
- `docs/SPEC.md` (phase scope is now fixed; implementation must not mutate the contract)

---

## Contracts

> This section is the source of truth for `/context-update`. Fill it in **before** handing to AI.

### New persistent data (tables / collections / files)

- Architect explicitly deferred the §7.4 physical-device matrix for separate manual execution and
  accepted `I1`/`T1` without device findings on 2026-07-13; no device-specific product changes were
  made.
- First production bootstrap exposed two deploy-path gaps: the dummy-certificate webroot flow could
  restart nginx without a certificate before ACME validation, and Compose's app image did not match
  the workflow's GHCR target. The bootstrap now uses Certbot standalone issuance, and Compose/CI use
  `ghcr.io/avatarsik6699/cutbgart:latest` with ephemeral `GITHUB_TOKEN` registry authentication.
- GitHub Actions run `29211248810` completed lint/test, image build and GHCR publish, then SSH deploy
  from `main`; post-deploy HTTPS smoke returned `200` for both domains and representative ru/en
  routes. Clean-checkout CI now generates Paraglide and TanStack Router outputs before analysis and
  sitemap generation.
- Production is live at `cutbg.art` with Umami enabled. Cloudflare Web Analytics and the custom R2
  model CDN remain unset because no `VITE_CF_BEACON_TOKEN` or populated `cdn.cutbg.art` endpoint was
  available; model loading continues through the existing upstream fallback.

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
- e2e — the existing Playwright cross-browser matrix must stay green; `e2e/scenario-pages.spec.ts`
  must cover the final square and portrait assets' responsive display constraints from SPEC.md
  §5.1; extend the matrix if `I1` finds a gap headless/emulated coverage missed
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
feat(phase-13): polish SEO images, harden devices, launch
```

---

## Post-Phase Checklist

- [x] All Scope checkboxes checked (or deferred in Architect Review Notes)
- [x] All automated gate checks green
- [x] All architect review notes resolved
- [x] `docs/STATE.md` updated — run `/context-update 13`
- [x] Committed atomically on `feat/phase-13` branch
- [x] Tag created after merge to develop: `git tag -a v0.13.0 -m "Phase 13: Hardening & Launch"`
