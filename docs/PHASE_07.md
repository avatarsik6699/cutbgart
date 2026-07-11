# PHASE 07 — Manual mask correction

<!-- TOKEN BUDGET: keep this file under 10,000 tokens. Be concise. -->

## Phase Metadata

| Field | Value |
|-------|-------|
| Phase | `07` |
| Title | Manual mask correction |
| Status | `⏳ pending` |
| Tag | `v0.07.0` |
| Depends on | PHASE_06 gate passing |

---

## Phase Goal

Give the visitor a way to fix model mistakes on real photos — the product is not usable end-to-end
without this (SPEC.md §8, Phase 07). The user brushes add/erase/restore-to-model-output corrections
directly onto the existing `AlphaMatte` (already a soft alpha channel, not a binary mask — SPEC.md
§2.2), with adjustable brush size/hardness and undo/redo. No new ML model and no new inference pass:
corrections are pure client-side canvas edits, re-composited through the existing `OffscreenCanvas`
pipeline (SPEC.md §5.2, §5.3).

---

## Scope

### Frontend
- [x] `F1` `entities/processed-image` — pure correction primitives: `BrushStroke`/`BrushMode` types
  and `applyBrushStroke` (mutates a working copy of `AlphaMatte.data`; `restore` mode reads back
  from the original, pre-correction matte) (SPEC.md §2.2) — _Depends on:_ —
- [x] `F2` `features/remove-background/model/state-machine.ts` — add the `correcting` state,
  reachable from and returning to `result` (SPEC.md §5.3) — _Depends on:_ —
- [x] `F3` `features/remove-background/lib/compositing.ts` — re-composite `ProcessedImage` from a
  corrected `AlphaMatte` without re-running inference — _Depends on:_ `F1`
- [x] `F4` `features/correct-mask` slice — brush canvas overlay (add/erase/restore mode toggle,
  brush size/hardness controls, undo/redo history) operating on the `AlphaMatte` (SPEC.md §5.2) —
  _Depends on:_ `F1`
- [x] `F5` `pages/home/ui/HomePage.tsx` — "edit mask" entry point from `result`, mounts
  `features/correct-mask` in `correcting`, "done" returns to `result` with the corrected composite
  — _Depends on:_ `F2`, `F3`, `F4`
- [x] `F6` Accessibility — brush size/hardness/mode controls keyboard-operable;
  `aria-live="polite"` announces entry/exit of `correcting` (same pattern as the other state
  transitions, SPEC.md §5.4) — _Depends on:_ `F4`

<!-- Test execution is governed by `## Gate Checks` below + docs/STACK.md § Gate Commands.
     Do not duplicate that list here. -->

---

## Files

### Create / modify
~~~
src/entities/processed-image/model/mask-correction.ts   # BrushStroke, BrushMode, applyBrushStroke (pure)
src/entities/processed-image/model/mask-correction.test.ts
src/entities/processed-image/index.ts                    # export the above if consumed outside the slice
src/features/remove-background/model/state-machine.ts    # add `correcting` state + transitions
src/features/remove-background/model/state-machine.test.ts
src/features/remove-background/model/useBackgroundRemoval.ts  # expose enter/exit-correcting actions
src/features/remove-background/lib/compositing.ts         # recomposite-from-corrected-matte path
src/features/remove-background/lib/compositing.test.ts
src/features/correct-mask/model/use-mask-correction.ts    # undo/redo stack, brush mode/size/hardness state
src/features/correct-mask/model/use-mask-correction.test.ts
src/features/correct-mask/ui/MaskCorrectionCanvas.tsx      # pointer-driven brush overlay
src/features/correct-mask/ui/MaskCorrectionToolbar.tsx     # mode toggle, size/hardness, undo/redo
src/features/correct-mask/ui/*.test.tsx
src/features/correct-mask/index.ts
src/pages/home/ui/HomePage.tsx
src/pages/home/ui/HomePage.test.tsx
e2e/mask-correction.spec.ts
~~~

### Do NOT touch
- `features/upload-image`, `features/quality-mode-toggle`, `features/download-result` — unaffected,
  reused as-is
- `features/remove-background/worker/inference.worker.ts` — no new inference pass; correction is
  pure canvas math on the already-produced `AlphaMatte`
- `pages/product-photo`, `pages/document-photo`, `pages/logo`, `pages/avatar`,
  `scripts/generate-sitemap.ts` — Phase 06 scenario pages; SPEC.md §8 scopes the `correcting` entry
  point to `pages/home` only this phase
- Analytics/Umami wiring (`shared/lib/analytics`) — Phase 05; SPEC.md §7.6 defines no new event for
  this phase, do not invent one

---

## Contracts

> This section is the source of truth for `/context-update`. Fill it in **before** handing to AI.

### New persistent data (tables / collections / files)

None — no server-side persistent store in this project (SPEC.md §3); corrections live only in the
in-memory `AlphaMatte` for the current session (SPEC.md §2.2).

### New API endpoints / RPC methods / events

None

### New types / models / shared interfaces

```ts
// src/entities/processed-image/model/mask-correction.ts — Phase 07, per SPEC.md §2.2, §5.2

type BrushMode = "add" | "erase" | "restore";

interface BrushStroke {
  points: { x: number; y: number }[];  // source-image pixel coordinates
  radius: number;                      // brush size, source-image pixels
  hardness: number;                    // 0–1, edge softness of the brush stamp
  mode: BrushMode;
}

// Applies one stroke to a working copy of AlphaMatte.data; `restore` reads back from `original`
// (the pre-correction matte produced by inference) rather than clearing to 0/255.
function applyBrushStroke(
  matte: AlphaMatte,
  original: AlphaMatte,
  stroke: BrushStroke,
): AlphaMatte;

// Live-paint path (R3) + patch-based history (R4). One committed gesture is a MaskPatch delta —
// undo/redo memory and cost are O(stroke area), and no changing multi-MB buffer ever crosses a
// React prop/state boundary (see Architect Review Notes R4).
interface BrushBoundingBox { minX: number; maxX: number; minY: number; maxY: number }

interface MaskPatch {
  box: BrushBoundingBox;
  before: Uint8ClampedArray;  // alpha of `box`, row-major, pre-gesture
  after: Uint8ClampedArray;   // alpha of `box` post-gesture
}

// In-place alpha stamp on an RGBA buffer; returns the touched box (null if nothing touched).
function stampBrushAlphaInPlace(
  rgba: Uint8ClampedArray, originalAlpha: Uint8ClampedArray,
  width: number, height: number,
  center: { x: number; y: number }, radius: number, hardness: number, mode: BrushMode,
): BrushBoundingBox | null;
function unionBoundingBox(a: BrushBoundingBox | null, b: BrushBoundingBox | null): BrushBoundingBox | null;
function extractAlphaRegion(rgba: Uint8ClampedArray, imageWidth: number, box: BrushBoundingBox): Uint8ClampedArray;
function writeAlphaRegion(rgba: Uint8ClampedArray, imageWidth: number, box: BrushBoundingBox, alpha: Uint8ClampedArray): void;
```

```ts
// src/features/correct-mask/ui/MaskCorrectionCanvas.tsx — Phase 07 (R4)
// Imperative channel for undo/redo + final readout; deliberately a ref API, not props (R4).
interface MaskCanvasHandle {
  applyPatch(box: BrushBoundingBox, alpha: Uint8ClampedArray): void; // undo → patch.before, redo → patch.after
  extractMatte(): AlphaMatte | null;                                 // read once, on Done
}
```

```ts
// src/features/remove-background/model/state-machine.ts — Phase 07, per SPEC.md §5.3
// Extends the Phase 02 state machine with one new state; existing states/transitions unchanged.

type UIState =
  | "idle"
  | "model-loading"
  | "ready"
  | "processing"
  | "result"
  | "correcting"   // new — reachable from and returning to "result"
  | "error";
```

### New env vars

None

---

## Gate Checks

> **Before running gate:** confirm all Scope checkboxes are checked (or explicitly deferred in
> Architect Review Notes). Unchecked items appear in the gate report as a warning, not a hard block.

Run `/phase-gate 07` before committing.

`/phase-gate` returns full PASS only when:
- Automated checks are green
- All architect review items below are resolved (checked off)

Use the commands in [docs/STACK.md](./STACK.md#gate-commands) as the source of truth for:
- infrastructure / bootstrap
- migrations (if applicable)
- backend / unit tests
- frontend prep, type-check, unit tests (if a frontend exists)
- e2e — mandatory for any phase that adds/changes a user-facing flow (AGENTS.md core rule 8): this
  phase adds a new UI state and flow, so add `e2e/mask-correction.spec.ts` covering: enter
  `correcting` from `result`; each of add/erase/restore observably changes the composite; undo/redo;
  "done" returns to `result`; the downloaded PNG reflects the corrected composite — not just `n/a`
- the default smoke check

If this phase needs a custom smoke target or other phase-specific note, record it here:

```bash
# Optional phase-specific smoke override
# none — this phase has no new server route; smoke coverage is the default home-page check plus
# the e2e spec above
```

---

## Architect Review Notes

Use this section after manual product, UX, API, or workflow verification. This is the human-facing
channel for post-implementation fixes.

Add one unchecked checkbox per issue the agent must fix before the phase can close. Keep each item
independently fixable and describe observed behavior plus expected behavior. If the fix may change
SPEC/API/schema/security behavior, say so explicitly in the note.

The agent resolves these items through `/impl-assist 07 review`. Leave an item unchecked while it
is still open. Check it off only after the fix is implemented and re-verified. If manual
verification found nothing, keep the default checked line below.

- [x] `R1` (pre-existing, cross-cutting — predates Phase 07) — Observed: the very first
  drag-and-drop/file-select right after the page loads silently does nothing; state stays at the
  pre-upload `idle` view. A second attempt (same or different image) starts the pipeline normally.
  Root cause: `pages/home/ui/HomePage.tsx` and its feature tree render eagerly with no code-split,
  so on a real page load there's a window where TanStack Start's SSR markup is painted but React
  hasn't finished hydrating (attaching `UploadDropzone`/`ChoosePhotoButton`'s `onChange`/`onDrop`
  handlers) yet — an interaction in that window is dropped, same class of bug already documented in
  `docs/KNOWN_GOTCHAS.md`'s Playwright-hydration-race entry, but reproducible by a real user, not
  just automation. Expected: the very first upload attempt works exactly like every subsequent one.
- [x] `R2` — Observed: in `correcting`, there is no visual indicator of the current brush size —
  only the generic pointer cursor — so the user can't tell how large an area a stroke will affect
  without trial and error; the size/hardness sliders alone aren't legible enough. Also unclear what
  distinguishes "Add" from "Restore" (both can look identical wherever the model's original alpha
  was already ~255). Expected: a visible brush-size cursor while hovering the canvas, and clearer
  in-UI differentiation of what each mode actually does.
- [x] `R3` — Observed: dragging the brush across the canvas visibly stutters/microfreezes,
  especially away from the tiny e2e fixture image. Root cause: `useMaskCorrection`'s
  `addStrokePoint` calls `applyBrushStroke`, which clones the *entire* `AlphaMatte.data` buffer on
  every single pointer-move point, and `MaskCorrectionCanvas`'s repaint clones the full RGBA buffer
  and repaints the *whole* canvas on every matte change — both O(image size) per point regardless of
  brush size, on the main thread, once per pointermove event. Expected: smooth, low-latency painting
  regardless of image size, matching how canvas-based brush tools elsewhere avoid this (mutate a
  persistent buffer in place, repaint only the touched region, commit to app/undo state once per
  gesture rather than once per point).
- [x] `R4` — Observed: even after R3's fixes, releasing the mouse button after every stroke — and
  every Undo/Redo click — still froze the whole app for ~1-2s, on a mere 1024x1024 (1MP) image.
  Root cause (confirmed with a CPU profile against a live `pnpm dev` session: a 1.0-1.4s main-thread
  long task per pointer-up, dominated by `addObjectToProperties`/`addValueToProperties` inside
  react-dom's development build): React 19.2's dev-only Component Performance Track deep-diffs every
  changed prop object on each commit (`logComponentRender` → `addObjectDiffToProperties`), and a
  changing `matte: AlphaMatte` prop makes it enumerate the megapixel `Uint8ClampedArray` element by
  element via `for..in` — twice (removed + added) — building 2M+ diff entries per stroke. App code
  was innocent (the entire pointer-up path measured ~3ms); R3-addendum's `appliedMatteRef` fix
  targeted real-but-minor work (~50ms) and could not have fixed this. Not present in production
  builds; fixed upstream in react-dom 19.3 canary (`ArrayBuffer.isView` guard) but not in stable
  19.2.x. Expected: no changing multi-megabyte object ever crosses a React prop/state boundary in
  the correction flow — gestures commit O(stroke area) `MaskPatch` deltas, undo/redo write patches
  back through an imperative `MaskCanvasHandle`, and the final matte is read out once on Done.

---

## Implementation Notes

<!-- Optional. The agent adds a short bullet here only when something isn't already visible from
     the code or commit history: an intentional deviation from the plan, a residual risk, a
     rejected alternative. Leave empty when nothing needs recording — this is not a mandatory
     per-task log. -->

- `worker/inference.worker.ts` is explicit "Do NOT touch" scope, and `ProcessedImage` (Phase 02)
  never carried the raw `AlphaMatte` past compositing — only the final PNG `Blob`. Rather than
  changing the worker's message protocol, `features/remove-background/lib/compositing.ts` gained
  `extractAlphaMatte` (reads the alpha channel back out of the already-composited PNG — it *is* the
  matte, pixel-for-pixel) and `recompositeProcessedImage` (re-runs `compositeProcessedImage` against
  a corrected matte). Both run on the main thread, not the worker — no inference pass, no worker
  changes, `ProcessedImage`'s own shape is untouched.
- Real (non-mocked) e2e verification against `e2e/fixtures/sample.jpg` (a 1x1 placeholder image)
  caught a genuine race in `MaskCorrectionCanvas`: the source-image decode effect's own `drawImage`
  call left the canvas showing the raw, fully-opaque source as the visible state whenever it
  resolved after the matte-paint effect had already bailed out (no cached RGBA yet) — the correcting
  view could flash the un-masked photo instead of the real alpha-composited preview on first entry.
  Fixed by explicitly repainting with the latest matte (via a ref) once the decode settles; regression
  test added in `MaskCorrectionCanvas.test.tsx`.
- Architect Review Notes R1–R3 (found during manual `pnpm dev` testing after initial Scope
  implementation):
  - `R1`: `pages/home/ui/HomePage.tsx` now tracks a `hydrated` flag (`false` on both the SSR and
    first client render, flipped by a `useEffect`) and disables `UploadDropzone`/`ChoosePhotoButton`
    until it's `true`. This predates Phase 07 (introduced in Phase 04) and is only fixed on
    `pages/home` here — the Phase 06 scenario pages (`pages/product-photo` etc.) likely have the
    same latent race but are this phase's explicit "Do NOT touch" scope; worth a follow-up pass.
  - `R2`/`R3` together drove a real architecture change in `features/correct-mask`:
    `useMaskCorrection` no longer applies brush math itself (`beginStroke`/`addStrokePoint`/
    `endStroke` are gone) — `MaskCorrectionCanvas` now owns a persistent `ImageData` working buffer,
    mutated in place per pointer-move via a new `stampBrushAlphaInPlace` (entities/processed-image),
    and repaints only the touched bounding box (`putImageData`'s dirty-rect overload) instead of the
    whole canvas. The hook only receives the final result once per gesture, via a new
    `commitStroke(matte)` replacing the old per-point trio — this is what actually removed the
    stutter (previously O(image size) work ran on every single pointer-move point, regardless of
    brush size). A mode-tinted brush-size cursor (green/red/blue for add/erase/restore) and
    plain-language per-mode descriptions in `MaskCorrectionToolbar` address the UX confusion.
  - Verifying `R3`'s fix via real e2e surfaced a second, unrelated issue purely in
    `e2e/mask-correction.spec.ts` itself: clicking a mode button changes the toolbar's description
    text length, which can reflow the page enough to scroll the canvas out of the viewport before
    the next drag's `boundingBox()` read — recorded in `docs/KNOWN_GOTCHAS.md` since it'll bite any
    future spec with dynamic content positioned above an element it drags on.
  - `R3` addendum, found in further manual testing: dragging itself was smooth after the above fix,
    but releasing the mouse button still froze for ~1-2s on realistic image sizes. Root cause:
    `commitStroke`'s `setMatte(newMatte)` flows the just-committed matte back down as a new `matte`
    prop, and `MaskCorrectionCanvas`'s `[matte]` sync effect treated *every* prop change — including
    this self-echo — as an external change (the undo/redo case), paying for a second full O(image
    size) alpha resync plus a full-canvas `putImageData` on top of the dirty-rect repaints the drag
    had already done. Fixed with an `appliedMatteRef` that records which `AlphaMatte` object is
    currently reflected in the live buffer (set on decode and on every commit) — the sync effect now
    bails out immediately when the incoming `matte` is that same object reference, and only does the
    full resync/repaint for genuine external changes (undo/redo). Also added
    `willReadFrequently: true` to the canvas's 2D context, since this component calls
    `getImageData`/`putImageData` continuously by design — the standard fix for GPU-readback stalls
    in canvas-heavy pixel editors. Regression test added in `MaskCorrectionCanvas.test.tsx` asserting
    no `putImageData` call fires when a committed matte echoes back as the next prop.
- `R4` superseded the R3-addendum diagnosis (profiling showed the freeze survived it and was never
  in app code — see the R4 note above for the react-dom dev-build root cause) and drove the current
  patch-based architecture: `useMaskCorrection`'s history is `MaskPatch[]` (dirty box + before/after
  alpha bytes, produced once per gesture by `MaskCorrectionCanvas`), undo/redo write patches back
  through the canvas's imperative `MaskCanvasHandle` (`applyPatch`), and "Done" pulls the final
  matte out once via `extractMatte`. The hook no longer holds a `matte` at all, the canvas's props
  are all identity-stable during editing (`initialMatte` is read once per source decode), and the
  old `[matte]` resync effect + `appliedMatteRef` are gone. Side benefits beyond the freeze: history
  memory drops from up to 20 full mattes (~320MB at 4096²) to stroke-sized patches, pointer-up cost
  drops from O(image) to O(stroke box), `pointercancel` now reverts an aborted gesture's stamps
  (previously they lingered on the canvas uncommitted), and empty gestures no longer push undo
  steps. The generic lesson is recorded in `docs/KNOWN_GOTCHAS.md`.
- Residual risks / follow-ups deliberately left out of this phase (none block the contract; listed
  here so they aren't rediscovered from scratch):
  - **No stroke interpolation between pointermove points** — a fast drag stamps discrete dabs and
    can leave a dotted line instead of a continuous stroke. Fix is to stamp along the segment
    between consecutive points with spacing derived from the radius; do it together with the brush
    LUT below since interpolation multiplies stamp count.
  - **Huge-radius stamps are O(r²) with a `sqrt` per pixel, per pointermove point** — the size
    slider goes up to 4096 (SPEC.md §1.3 invariant), where a single stamp touches up to the whole
    image. Smooth at default sizes; if large-brush drags ever stutter, precompute an influence LUT
    / row-span limits per (radius, hardness) instead of per-pixel `sqrt`.
  - **`extractAlphaMatte` (Edit mask click) and `recompositeProcessedImage` + PNG encode (Done
    click) run on the main thread** — a one-off O(image) cost per click, fine at ~1MP, noticeable
    near the 4096² limit. The inference worker already owns the same compositing code; moving these
    two calls there is mechanical if it ever matters.
  - **`getBoundingClientRect` is called twice per pointermove** (cursor overlay + coordinate
    mapping) — measured at ~13-17ms across a whole stroke, i.e. harmless; cache the rect per
    gesture if it ever shows up in a profile.
  - **react-dom 19.2.x dev-mode typed-array props diff** (the R4 root cause) is fixed upstream in
    19.3 canary — when 19.3 stable ships, upgrade to remove the underlying footgun (tracked in
    `docs/KNOWN_GOTCHAS.md`).
  - **R1's hydration race is only fixed on `pages/home`** — the Phase 06 scenario pages
    (`pages/product-photo` etc.) very likely have the same latent first-interaction drop but were
    this phase's explicit "Do NOT touch" scope (already flagged in the R1 note above).

---

## Atomic Commit Message

```
feat(phase-07): manual mask correction — brush add/erase/restore on the alpha matte
```

---

## Post-Phase Checklist

- [x] All Scope checkboxes checked (or deferred in Architect Review Notes)
- [x] All automated gate checks green
- [x] All architect review notes resolved
- [x] `docs/STATE.md` updated — run `/context-update 07`
- [ ] Committed atomically on `feat/phase-07` branch
- [ ] Tag created after merge to develop: `git tag -a v0.07.0 -m "Phase 07: Manual mask correction"`
