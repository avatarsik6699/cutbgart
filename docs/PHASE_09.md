# PHASE 09 — Correction zoom & pan

<!-- TOKEN BUDGET: keep this file under 10,000 tokens. Be concise. -->

## Phase Metadata

| Field | Value |
|-------|-------|
| Phase | `09` |
| Title | Correction zoom & pan |
| Status | `✅ done` |
| Tag | `v0.09.0` |
| Depends on | PHASE_08 gate passing |

---

## Phase Goal

Add precise zoomed-in editing to the existing mask-correction workflow (SPEC.md §5.2, §5.3, §5.4,
§7.7, §8). Zoom and pan are view-only transforms scoped to the `correcting` state: brush strokes
must still address source-image pixel coordinates, corrections must remain in-memory only, and no
new inference pass or server involvement is introduced.

---

## Scope

### Backend

None

### Frontend
- [x] `F1` `features/correct-mask` — add zoom and pan controls scoped to the existing `correcting`
  editor UI; controls are keyboard-operable and expose the current zoom level for announcement via
  `aria-live` (SPEC.md §5.4) — _Depends on:_ —
- [x] `F2` `features/correct-mask/ui/MaskCorrectionCanvas.tsx` — apply a view-only zoom/pan
  transform while keeping brush coordinates in source-image pixel space (SPEC.md §5.3) — _Depends on:_ `F1`
- [x] `F3` `features/correct-mask/ui/MaskCorrectionCanvas.tsx` — update dirty-rect repainting and
  brush cursor placement so painting remains accurate and efficient inside a zoomed/panned viewport
  — _Depends on:_ `F2`
- [x] `F4` `pages/home/ui/HomePage.tsx` — wire correction zoom announcements into the existing
  `aria-live="polite"` status path without adding a new top-level UI state — _Depends on:_ `F1`
- [x] `F5` Tests — extend component/unit/e2e coverage for zoom controls, pan behavior, source-pixel
  brush mapping under transform, and "done" producing a corrected downloadable composite
  (SPEC.md §7.7) — _Depends on:_ `F1`, `F2`, `F3`, `F4`

### Infra

None

<!-- Test execution is governed by `## Gate Checks` below + docs/STACK.md § Gate Commands.
     Do not duplicate that list here. -->

---

## Files

### Create / modify
~~~
src/features/correct-mask/index.ts
src/features/correct-mask/model/use-mask-correction.ts
src/features/correct-mask/model/use-mask-correction.test.ts
src/features/correct-mask/ui/MaskCorrectionCanvas.tsx
src/features/correct-mask/ui/MaskCorrectionCanvas.test.tsx
src/features/correct-mask/ui/MaskCorrectionToolbar.tsx
src/features/correct-mask/ui/MaskCorrectionToolbar.test.tsx
src/pages/home/ui/HomePage.tsx
src/pages/home/ui/HomePage.test.tsx
e2e/mask-correction.spec.ts
~~~

### Do NOT touch
- `docs/SPEC.md` — phase-init must not modify the approved spec
- Backend/database code — this project still has no custom API or persistent store (SPEC.md §3, §4)
- `features/remove-background` worker/compositing code — zoom/pan must not add a new inference pass
  or change the existing worker-backed Edit/Done compositing path
- Scenario page SEO copy, route metadata, sitemap generation, and JSON-LD — Phase 09 is not an SEO
  content phase
- Analytics/Umami wiring (`src/shared/lib/analytics`) — SPEC.md §7.6 defines no new event for this
  phase

---

## Contracts

> This section is the source of truth for `/context-update`. Fill it in **before** handing to AI.

### New persistent data (tables / collections / files)

None — no server-side persistent store in this project (SPEC.md §3). Correction zoom/pan is
feature-local, in-memory UI state inside the current browser tab.

### New API endpoints / RPC methods / events

None — no public API, server endpoint, analytics event, or externally observable RPC is introduced.
Zoom/pan is a client-side view transform in the existing `correcting` state.

### New types / models / shared interfaces

None — Phase 09 adds no new domain model or shared interface specified by `SPEC.md`. If implementation
introduces a local viewport state type for zoom/pan, keep it inside `features/correct-mask` and do
not persist it.

### New env vars

None

---

## Gate Checks

> **Before running gate:** confirm all Scope checkboxes are checked (or explicitly deferred in
> Architect Review Notes). Unchecked items appear in the gate report as a warning, not a hard block.

Run `/phase-gate 09` before committing.

`/phase-gate` returns full PASS only when:
- Automated checks are green
- All architect review items below are resolved (checked off)

Use the commands in [docs/STACK.md](./STACK.md#gate-commands) as the source of truth for:
- infrastructure / bootstrap
- migrations (if applicable)
- backend / unit tests
- frontend prep, type-check, unit tests (if a frontend exists)
- e2e — mandatory for this phase: extend `e2e/mask-correction.spec.ts` to cover entering
  `correcting`, zooming in, panning, painting a brush stroke that lands on the correct source-image
  pixels despite the transform, and "done" producing a corrected downloadable composite
- the default smoke check

If this phase needs a custom smoke target or other phase-specific note, record it here:

```bash
# Optional phase-specific smoke override
# none — this phase has no new server route; smoke coverage is the default home-page check plus
# mask-correction zoom/pan e2e coverage above
```

---

## Architect Review Notes

Use this section after manual product, UX, API, or workflow verification. This is the human-facing
channel for post-implementation fixes.

Add one unchecked checkbox per issue the agent must fix before the phase can close. Keep each item
independently fixable and describe observed behavior plus expected behavior. If the fix may change
SPEC/API/schema/security behavior, say so explicitly in the note.

The agent resolves these items through `/impl-assist 09 review`. Leave an item unchecked while it
is still open. Check it off only after the fix is implemented and re-verified. If manual
verification found nothing, keep the default checked line below.

- [x] Space+drag must be an exclusive, reliably terminated hand-pan gesture and must never paint;
  releasing Space, cancelling the pointer, or losing window focus must restore the brush cursor.
- [x] Editor zoom shortcuts must prevent browser-page zoom while correction is active, and wheel /
  Shift+wheel must pan the image without scrolling the page.
- [x] Toolbar zoom in, zoom out, and reset controls must update the correction viewport reliably.
- [x] Phase E2E must avoid concurrent real-model inference and Playwright/Vite startup hangs while
  retaining one explicit real-model smoke in the full phase gate.

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
feat(phase-09): add correction zoom and pan
```

---

## Post-Phase Checklist

- [x] All Scope checkboxes checked (or deferred in Architect Review Notes)
- [x] All automated gate checks green
- [x] All architect review notes resolved
- [x] `docs/STATE.md` updated — run `/context-update 09`
- [x] Committed atomically on `feat/phase-09` branch
- [x] Tag created after merge to main: `git tag -a v0.09.0 -m "Phase 09: Correction zoom & pan"`
