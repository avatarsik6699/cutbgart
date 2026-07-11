# PHASE 08 — Correction editor hardening

<!-- TOKEN BUDGET: keep this file under 10,000 tokens. Be concise. -->

## Phase Metadata

| Field | Value |
|-------|-------|
| Phase | `08` |
| Title | Correction editor hardening |
| Status | `✅ done` |
| Tag | `v0.08.0` |
| Depends on | PHASE_07 gate passing |

---

## Phase Goal

Close out the architectural debt flagged during Phase 07 before building correction zoom/pan on top
of the same editor surface (SPEC.md §8). This phase keeps the existing correction workflow and
contracts intact while making fast brush drags continuous, large-brush stamping cheaper, Edit/Done
compositing worker-backed instead of main-thread-bound, and first upload reliable on the Phase 06
scenario pages.

---

## Scope

### Backend

None

### Frontend
- [x] `F1` `entities/processed-image` — add stroke interpolation between pointermove points so fast
  drags paint continuous strokes instead of discrete dabs; update unit coverage around segment
  spacing and dirty boxes — _Depends on:_ —
- [x] `F2` `entities/processed-image` / `features/correct-mask` — replace per-stamp per-pixel
  `sqrt` work with a brush-stamp influence LUT / row-span limit path for large radii, preserving
  add/erase/restore behavior and soft-edge hardness semantics — _Depends on:_ `F1`
- [x] `F3` `features/correct-mask/ui/MaskCorrectionCanvas.tsx` — cache
  `getBoundingClientRect()` once per gesture and reuse it for cursor overlay plus source-pixel
  coordinate mapping, without changing brush coordinate semantics — _Depends on:_ `F1`
- [x] `F4` `features/remove-background/worker/inference.worker.ts` — move Edit-mask
  `extractAlphaMatte` and Done `recompositeProcessedImage` + PNG encode work onto the existing
  inference worker; no new inference pass and no server involvement — _Depends on:_ —
- [x] `F5` `pages/home/ui/HomePage.tsx` — route the existing Edit/Done correction actions through
  the worker-backed extraction/recomposition path, with clear retry/reset behavior if worker
  compositing fails — _Depends on:_ `F4`
- [x] `F6` `pages/product-photo`, `pages/document-photo`, `pages/logo`, `pages/avatar` — fix the
  Phase 07 R1 hydration race on scenario pages so the first upload attempt after SSR paint cannot
  be dropped before React handlers attach — _Depends on:_ —
- [x] `F7` Tests — extend unit/component/e2e coverage for continuous fast drags, large-brush
  stamping, worker-backed Edit/Done correction, and first-upload behavior on scenario pages
  (SPEC.md §7.7) — _Depends on:_ `F1`, `F2`, `F3`, `F4`, `F5`, `F6`

### Infra
- [x] `I1` Upgrade `react` / `react-dom` / React DOM types to 19.3 stable once available, removing
  the React 19.2 dev-mode typed-array prop-diff footgun root-caused in Phase 07 R4; if 19.3 stable
  is not available during implementation, leave dependencies unchanged and record that as an
  Implementation Note — _Depends on:_ —

<!-- Test execution is governed by `## Gate Checks` below + docs/STACK.md § Gate Commands.
     Do not duplicate that list here. -->

---

## Files

### Create / modify
~~~
package.json
pnpm-lock.yaml
src/entities/processed-image/model/mask-correction.ts
src/entities/processed-image/model/mask-correction.test.ts
src/entities/processed-image/index.ts
src/features/correct-mask/ui/MaskCorrectionCanvas.tsx
src/features/correct-mask/ui/MaskCorrectionCanvas.test.tsx
src/features/correct-mask/model/use-mask-correction.ts
src/features/correct-mask/model/use-mask-correction.test.ts
src/features/remove-background/lib/compositing.ts
src/features/remove-background/lib/compositing.test.ts
src/features/remove-background/worker/inference.worker.ts
src/features/remove-background/model/useBackgroundRemoval.ts
src/features/remove-background/model/useBackgroundRemoval.test.ts
src/features/remove-background/index.ts
src/pages/home/ui/HomePage.tsx
src/pages/home/ui/HomePage.test.tsx
src/pages/product-photo/ui/ProductPhotoPage.tsx
src/pages/document-photo/ui/DocumentPhotoPage.tsx
src/pages/logo/ui/LogoPage.tsx
src/pages/avatar/ui/AvatarPage.tsx
e2e/mask-correction.spec.ts
e2e/scenario-pages.spec.ts
docs/KNOWN_GOTCHAS.md
~~~

### Do NOT touch
- `docs/SPEC.md` — phase-init must not modify the approved spec
- Backend/database code — this project still has no custom API or persistent store (SPEC.md §3, §4)
- `features/upload-image`, `features/quality-mode-toggle`, `features/download-result` except for
  narrowly required public-API/test adjustments caused by the scenario-page hydration fix
- Scenario page SEO copy, route metadata, sitemap generation, and JSON-LD — Phase 08 is not an SEO
  content phase
- Analytics/Umami wiring (`src/shared/lib/analytics`) — SPEC.md §7.6 defines no new event for this
  phase

---

## Contracts

> This section is the source of truth for `/context-update`. Fill it in **before** handing to AI.

### New persistent data (tables / collections / files)

None — no server-side persistent store in this project (SPEC.md §3). Correction-editor hardening
keeps all image, matte, and patch data in memory in the current browser tab.

### New API endpoints / RPC methods / events

None — no public API, server endpoint, analytics event, or externally observable RPC is introduced.
Worker message changes, if needed to offload correction compositing, are internal to the existing
client-side correction flow.

### New types / models / shared interfaces

None — Phase 08 hardens the Phase 07 `BrushStroke`, `MaskPatch`, `MaskCanvasHandle`, and
`AlphaMatte` contracts without adding a new domain model.

### New env vars

- React 19.3 stable is not available as of implementation (`npm view react version` and
  `npm view react-dom version` both return `19.2.7`), so I1 intentionally leaves React dependencies
  unchanged.

---

## Gate Checks

> **Before running gate:** confirm all Scope checkboxes are checked (or explicitly deferred in
> Architect Review Notes). Unchecked items appear in the gate report as a warning, not a hard block.

Run `/phase-gate 08` before committing.

`/phase-gate` returns full PASS only when:
- Automated checks are green
- All architect review items below are resolved (checked off)

Use the commands in [docs/STACK.md](./STACK.md#gate-commands) as the source of truth for:
- infrastructure / bootstrap
- migrations (if applicable)
- backend / unit tests
- frontend prep, type-check, unit tests (if a frontend exists)
- e2e — mandatory for any phase that adds/changes a user-facing flow (AGENTS.md core rule 8): this
  phase changes the correction editor and scenario-page upload behavior, so extend
  `e2e/mask-correction.spec.ts` and `e2e/scenario-pages.spec.ts`
- the default smoke check

If this phase needs a custom smoke target or other phase-specific note, record it here:

```bash
# Optional phase-specific smoke override
# none — this phase has no new server route; smoke coverage is the default home-page check plus
# correction/scenario-page e2e coverage above
```

---

## Architect Review Notes

Use this section after manual product, UX, API, or workflow verification. This is the human-facing
channel for post-implementation fixes.

Add one unchecked checkbox per issue the agent must fix before the phase can close. Keep each item
independently fixable and describe observed behavior plus expected behavior. If the fix may change
SPEC/API/schema/security behavior, say so explicitly in the note.

The agent resolves these items through `/impl-assist 08 review`. Leave an item unchecked while it
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
feat(phase-08): harden correction editor and uploads
```

---

## Post-Phase Checklist

- [x] All Scope checkboxes checked (or deferred in Architect Review Notes)
- [x] All automated gate checks green
- [x] All architect review notes resolved
- [x] `docs/STATE.md` updated — run `/context-update 08`
- [x] Committed atomically on `feat/phase-08` branch
- [x] Tag created after merge to main: `git tag -a v0.08.0 -m "Phase 08: Correction editor hardening"`
