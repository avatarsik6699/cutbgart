# PHASE 04 — Home page UI

<!-- TOKEN BUDGET: keep this file under 10,000 tokens. Be concise. -->

## Phase Metadata

| Field | Value |
|-------|-------|
| Phase | `04` |
| Title | Home page UI |
| Status | `⏳ pending` |
| Tag | `v0.04.0` |
| Depends on | PHASE_03 gate passing |

---

## Phase Goal

Deliver the full product experience on the primary page: `pages/home` composes
`features/upload-image` (new), `features/quality-mode-toggle` (Phase 03), `features/remove-background`
(Phase 02), a `BeforeAfterSlider` result view, and `features/download-result` (new) into the real
upload → process → download flow, replacing the Phase 01 hello-world placeholder at `/`. All of the
§5.3 UI states are wired end to end, with the accessibility requirements in §5.4 (SPEC.md §5, §8).

<!-- none provided — no Figma/design assets for this cycle (SPEC.md §5, architect confirmed via
     /phase-init) -->

---

## Scope

<!-- Group tasks by area (Backend / Frontend / Infra / Data, etc.).
     ID scheme: B=Backend · F=Frontend · I=Infra · D=Data · T=other (ungrouped)
     Each item: `ID` description — _Depends on:_ ID, ID or —
     IDs are stable after assignment — never renumber. Mark removed tasks as ~~BN~~ (removed). -->

### Frontend
- [ ] `F1` Scaffold `features/upload-image` slice (public API `index.ts`, `model/`, `ui/` per FSD):
  drag-and-drop (full working area), click-to-browse, clipboard paste, mobile camera capture
  (`capture` attribute); format/size/resolution validation (JPEG/PNG/WebP, 20 MB hard limit);
  client-side downscale above 4096px on the longest side (SPEC.md §1.3, §5.2, §7.1) —
  _Depends on:_ —
- [ ] `F2` Build the `BeforeAfterSlider` display component in `entities/processed-image`
  (SPEC.md §5.2) — _Depends on:_ —
- [ ] `F3` Scaffold `features/download-result` slice — PNG-with-alpha download button, releasing
  the object URL via `URL.revokeObjectURL` after download or on next processing (SPEC.md §2.2,
  §5.2) — _Depends on:_ —
- [ ] `F4` Compose `pages/home`: wire `F1` (upload) + `features/quality-mode-toggle` (Phase 03) +
  `features/remove-background`'s `useBackgroundRemoval` (Phase 02) + `F2` (result slider) + `F3`
  (download) into the full state machine — `idle → model-loading → ready → processing → result`,
  `error` reachable from any state, real (non-simulated) model-load progress, WASM path labeled
  "lightweight mode", "process another image" reset without page reload, one-click "recompute in
  max quality" (SPEC.md §5.3) — _Depends on:_ `F1`, `F2`, `F3`
- [ ] `F5` Replace the Phase 01 hello-world placeholder: `routes/index.tsx` becomes a thin
  `loader` + head-meta shell rendering `pages/home` (SPEC.md §5.2, §5.5) — _Depends on:_ `F4`
- [ ] `F6` Accessibility (SPEC.md §5.4): real `<input type="file">` under the drop zone
  (keyboard-accessible, not visual-only), `aria-live="polite"` region announcing state
  transitions, WCAG AA contrast/focus states on all interactive elements, mobile "choose photo"
  button (with `capture`) replacing drag-and-drop — _Depends on:_ `F1`, `F4`
- [ ] `F7` Unit + integration tests (Vitest, Testing Library): `upload-image` validation/downscale,
  `BeforeAfterSlider`, `download-result`, and the composed state machine in `pages/home`
  (SPEC.md §7.7) — _Depends on:_ `F1`, `F2`, `F3`, `F4`
- [ ] `F8` Playwright e2e: extend beyond Phase 03's dev-harness smoke spec with the critical-path
  flow (upload → process → download) on the real `/` page, plus the cross-browser matrix — WebGPU
  path and WASM fallback as separate projects, must include Safari/iOS (SPEC.md §7.4, §7.7;
  AGENTS.md core rule 8) — _Depends on:_ `F4`, `F5`

<!-- No Backend, Infra, or Data groups: no server-side API surface or persistent store this phase
     either (SPEC.md §3, §4 architectural invariant); no new infra beyond what Phase 01/03 already
     set up. -->

<!-- Test execution is governed by `## Gate Checks` below + docs/STACK.md § Gate Commands.
     Do not duplicate that list here. -->

---

## Files

### Create / modify
~~~
src/features/upload-image/index.ts
src/features/upload-image/model/*  (validation, downscale logic + tests)
src/features/upload-image/ui/*     (drop zone, choose-photo button + tests)
src/features/download-result/index.ts
src/features/download-result/ui/DownloadResultButton.tsx (+ test)
src/entities/processed-image/ui/BeforeAfterSlider.tsx (+ test)
src/entities/processed-image/index.ts (export BeforeAfterSlider)
src/pages/home/index.ts
src/pages/home/ui/HomePage.tsx (+ test)
src/routes/index.tsx (replace hello-world placeholder; thin loader + head-meta)
playwright.config.ts (add browser projects for the cross-browser matrix)
e2e/home.spec.ts (critical-path + cross-browser coverage)
~~~

### Do NOT touch
- `src/features/remove-background/**` — Phase 02's slice is consumed, not modified
- `src/features/quality-mode-toggle/**` — Phase 03's slice is consumed, not modified
- `/dev/remove-background` route/harness — stays as the isolated ML test harness; not removed or
  redesigned this phase
- Analytics/Umami wiring — Phase 05
- SEO scenario pages (`/udalit-fon-*`, `/about`) and `scripts/generate-sitemap.ts` — Phase 06

---

## Contracts

> This section is the source of truth for `/context-update`. Fill it in **before** handing to AI.

### New persistent data (tables / collections / files)

None (no new `localStorage` keys or server-side store this phase — reuses `qualityMode` from
Phase 03; SPEC.md §3 architectural invariant).

### New API endpoints / RPC methods / events

None. The existing `GET /` route (STATE.md § Active Endpoints) changes its rendered body from the
Phase 01 placeholder to the full `pages/home` composition — this is not a new route.

### New types / models / shared interfaces

SPEC.md does not specify concrete type shapes for `upload-image`'s validation result or
`BeforeAfterSlider`'s props beyond the behavior described in §5.2/§7.3 — define these during
implementation. `[TODO: verify]`

### New env vars

None

---

## Gate Checks

> **Before running gate:** confirm all Scope checkboxes are checked (or explicitly deferred in
> Architect Review Notes). Unchecked items appear in the gate report as a warning, not a hard block.

Run `/phase-gate 04` before committing.

`/phase-gate` returns full PASS only when:
- Automated checks are green
- All architect review items below are resolved (checked off)

Use the commands in [docs/STACK.md](./STACK.md#gate-commands) as the source of truth for:
- infrastructure / bootstrap — Docker confirmed working in this environment as of 2026-07-10; this
  step should actually run, not be skipped
- migrations — `n/a`, no database in this project
- backend / unit tests — `n/a`, folded into frontend unit tests (single TS/React codebase)
- frontend prep, type-check, unit tests — this phase adds `upload-image`, `download-result`,
  `BeforeAfterSlider`, and `pages/home` tests
- e2e — mandatory: extend Phase 03's Playwright setup with the critical-path spec
  (upload → process → download) plus the cross-browser matrix (SPEC.md §7.4) — host-only, never
  in Docker or CI (AGENTS.md core rule 8)
- the default smoke check

If this phase needs a custom smoke target or other phase-specific note, record it here:

```bash
# Optional phase-specific smoke override
# curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/
# expected: 200
# curl -s http://localhost:3000/ | grep -a -q 'data-testid="[TODO: verify actual home-page testid]"'
# expected: match found (exit 0)
```

---

## Architect Review Notes

Use this section after manual product, UX, API, or workflow verification. This is the human-facing
channel for post-implementation fixes.

Add one unchecked checkbox per issue the agent must fix before the phase can close. Keep each item
independently fixable and describe observed behavior plus expected behavior. If the fix may change
SPEC/API/schema/security behavior, say so explicitly in the note.

The agent resolves these items through `/impl-assist 04 review`. Leave an item unchecked while it
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
feat(phase-04): home page ui — full upload-process-download flow
```

---

## Post-Phase Checklist

- [ ] All Scope checkboxes checked (or deferred in Architect Review Notes)
- [ ] All automated gate checks green
- [ ] All architect review notes resolved
- [ ] `docs/STATE.md` updated — run `/context-update 04`
- [ ] Committed atomically on `feat/phase-04` branch
- [ ] Tag created after merge to develop: `git tag -a v0.04.0 -m "Phase 04: Home page UI"`
