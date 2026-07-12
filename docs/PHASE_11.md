# PHASE 11 — Background replacement

<!-- TOKEN BUDGET: keep this file under 10,000 tokens. Be concise. -->

## Phase Metadata

| Field | Value |
|-------|-------|
| Phase | `11` |
| Title | Background replacement |
| Status | `⏳ pending` |
| Tag | `v0.11.0` |
| Depends on | PHASE_10 gate passing |

---

## Phase Goal

Let the user place a processed cutout on a solid color, linear or radial gradient, or custom
background image instead of only downloading a transparent PNG (SPEC.md §1.3, §2.2, §5.2–§5.4,
§7.7, §8). The selected fill must affect both the result preview and downloaded PNG, reuse the
existing worker-side `OffscreenCanvas` pipeline without rerunning inference, and keep uploaded
background images entirely in memory on the user's device.

---

## Scope

### Backend

None

### Frontend

- [x] `F1` Add the `features/background-replacement` slice and the `BackgroundFill` union for
  transparent, color, linear/radial gradient, and in-memory image fills — _Depends on:_ —
- [x] `F2` Extend the existing worker-side `OffscreenCanvas` compositing contract to apply an
  optional `BackgroundFill` behind the cutout while preserving transparent output as the default;
  cover the compositing behavior with unit/integration tests — _Depends on:_ `F1`
- [x] `F3` Build a keyboard-operable result-state background-fill selector with transparent/color
  choices, linear/radial gradient presets, and a custom-image file input — _Depends on:_ `F1`, `F2`
- [x] `F4` Wire fill selection into the existing single-image and selected-batch-item result flows
  so both preview and individual/ZIP downloads use the recomposited PNG without adding a top-level
  UI state or rerunning inference — _Depends on:_ `F2`, `F3`
- [x] `F5` Add Vitest coverage for fill selection/in-memory image lifecycle and Playwright coverage
  that switches color → gradient → uploaded image in `result` and verifies the downloaded PNG
  reflects each selected fill — _Depends on:_ `F3`, `F4`

### Infra

None

<!-- Test execution is governed by `## Gate Checks` below + docs/STACK.md § Gate Commands.
     Do not duplicate that list here. -->

---

## Files

### Create / modify

~~~
src/entities/processed-image/model/types.ts
src/features/background-replacement/index.ts
src/features/background-replacement/model/types.ts
src/features/background-replacement/model/use-background-fill.ts
src/features/background-replacement/model/use-background-fill.test.ts
src/features/background-replacement/ui/BackgroundFillSelector.tsx
src/features/background-replacement/ui/BackgroundFillSelector.test.tsx
src/features/remove-background/lib/compositing.ts
src/features/remove-background/lib/compositing.test.ts
src/features/remove-background/model/useBackgroundRemoval.ts
src/features/remove-background/model/useBackgroundRemoval.test.ts
src/features/remove-background/worker/inference.worker.ts
src/features/batch-processing/model/use-batch-processing.ts
src/features/batch-processing/model/use-batch-processing.test.ts
src/features/download-result/lib/create-results-zip.ts
src/features/download-result/lib/create-results-zip.test.ts
src/pages/home/ui/HomePage.tsx
src/pages/home/ui/HomePage.test.tsx
src/pages/product-photo/ui/ProductPhotoPage.tsx
src/pages/document-photo/ui/DocumentPhotoPage.tsx
src/pages/logo/ui/LogoPage.tsx
src/pages/avatar/ui/AvatarPage.tsx
e2e/home.spec.ts
e2e/scenario-pages.spec.ts
e2e/support/mock-inference.ts
e2e/fixtures/background.jpg
~~~

### Do NOT touch

- `docs/SPEC.md` — phase-init must not modify the approved spec
- Backend, database, Docker, Nginx, server-upload code, or analytics events — background images and
  all compositing remain client-side (SPEC.md §1.1, §3, §4, §7.6)
- Route definitions, SEO copy, metadata, sitemap generation, or JSON-LD — this phase adds no route
  or search-content contract (SPEC.md §5.1)
- Model loading, inference provider selection, model weights, or quality-mode policy — changing a
  background fill recomposites the existing matte and must not rerun inference (SPEC.md §5.3)
- Correction brush, history, or zoom/pan semantics — Phase 11 consumes the corrected `AlphaMatte`
  but does not change the correction editor

---

## Contracts

> This section is the source of truth for `/context-update`. Fill it in **before** handing to AI.

### New persistent data (tables / collections / files)

None — `BackgroundFill` and any uploaded custom background image are in-memory only, scoped to the
browser tab, discarded on reload, and never sent to a server (SPEC.md §2.2, §3, §4).

### New API endpoints / RPC methods / events

None — fill selection, preview recompositing, and PNG/ZIP download remain entirely client-side and
add no app endpoint or analytics event (SPEC.md §4, §7.6).

### New types / models / shared interfaces

```ts
type HexColor = `#${string}`;

interface BackgroundGradientStop {
  offset: 0 | 1;
  color: HexColor;
}

type BackgroundFill =
  | { type: "transparent" }
  | { type: "color"; value: HexColor }
  | {
      type: "gradient";
      kind: "linear" | "radial";
      stops: readonly [
        BackgroundGradientStop & { offset: 0 },
        BackgroundGradientStop & { offset: 1 },
      ];
    }
  | { type: "image"; blob: Blob };
```

`transparent` is the default and preserves the existing PNG-with-alpha behavior. Every non-
transparent fill is drawn behind the source cutout through the existing worker-side
`OffscreenCanvas` compositing pipeline, using the current `AlphaMatte`; selecting or changing a fill
must not rerun model inference or introduce a new top-level UI state (SPEC.md §2.2, §5.2–§5.3).

The same recomposited `ProcessedImage.result` blob drives the `BeforeAfterSlider` after-preview,
individual download, and the selected batch item's ZIP entry. A fill choice is item-local in batch
mode so changing one selected item cannot alter another item's output. Object URLs and decoded image
resources created for a custom background must be released when replaced, reset, or unmounted.

Color contract:

- Store colors as uppercase, opaque sRGB `#RRGGBB`; validate with `/^#[0-9A-F]{6}$/`. Alpha is not
  accepted because transparency is already an explicit fill mode and mixed-alpha backgrounds would
  make the downloaded result ambiguous.
- The native color input may emit lowercase text, but normalize it before constructing
  `BackgroundFill`. Invalid programmatic values fall back to `transparent`, never to an invented
  color.

Gradient contract:

- MVP gradients have exactly two ordered stops: offset `0` and offset `1`. The selector exposes six
  fixed presets, three per kind: linear `Sunset (#FF7A59 → #7B61FF)`,
  `Ocean (#00C6FF → #0072FF)`, `Mint (#00B09B → #96C93D)`; radial
  `Spotlight (#FFFFFF → #DDE7FF)`, `Peach (#FFF0E5 → #FF8A65)`, and
  `Night (#334155 → #020617)`.
- A linear gradient runs left-to-right from `(0, height / 2)` to `(width, height / 2)`. A radial
  gradient is centered at `(width / 2, height / 2)`, starts at radius `0`, and ends at the farthest
  corner (`hypot(width / 2, height / 2)`), so it covers the output without edge gaps.
- Custom angles, draggable stops, extra stops, and custom gradient colors are outside Phase 11.
  Keeping geometry deterministic makes previews and pixel-level download assertions identical
  across pages and browsers while still delivering both gradient kinds required by SPEC.md.

Custom-image contract:

- Accept JPEG, PNG, and WebP up to `20 MB`; reuse the existing upload decoder/error language and
  downscale inputs above `4096 px` on the longest side before retaining the in-memory blob. Do not
  accept SVG, GIF, remote URLs, or clipboard URLs.
- Draw with aspect-ratio-preserving center `cover`: scale until the entire output canvas is filled,
  center on both axes, and crop equal overflow from opposite edges. Never stretch, tile, add bars,
  or enlarge the output canvas. Upscaling is allowed when the background is smaller than the output.
- Replacing or clearing the image immediately releases the previous decoded bitmap/object URL. A
  decode failure leaves the previously valid fill selected and shows a concrete, recoverable error.

### New env vars

None

---

## Gate Checks

> **Before running gate:** confirm all Scope checkboxes are checked (or explicitly deferred in
> Architect Review Notes). Unchecked items appear in the gate report as a warning, not a hard block.

Run `/phase-gate 11` before committing.

`/phase-gate` returns full PASS only when:
- Automated checks are green
- All architect review items below are resolved (checked off)

Use the commands in [docs/STACK.md](./STACK.md#gate-commands) as the source of truth for:
- infrastructure / bootstrap
- migrations (if applicable)
- backend / unit tests
- frontend prep, type-check, unit tests (if a frontend exists)
- e2e — mandatory for this phase: in `result`, switch through color → gradient → uploaded image and
  assert the preview and downloaded PNG use the selected fill rather than transparency (SPEC.md §7.7)
- the default smoke check

If this phase needs a custom smoke target or other phase-specific note, record it here:

```bash
# Optional phase-specific smoke override
# none — this phase adds no server route; use the default home-page smoke plus background-fill e2e
```

Phase-specific verification:

- Verify transparent remains the default and is byte/alpha compatible with the existing flow.
- Verify color, linear gradient, radial gradient, and custom-image fills composite behind soft and
  corrected matte edges without changing output dimensions.
- Verify changing a fill updates both preview and subsequent individual/ZIP download without an
  inference request.
- Verify a selected batch item's fill is isolated from all other items and survives
  result ⇄ correcting until that item/session is reset.
- Verify the selector is keyboard-operable with visible focus and that the custom-image input works
  at mobile and desktop breakpoints.
- Verify custom background blobs/object URLs remain client-side and are released on replace/reset.

---

## Architect Review Notes

Use this section after manual product, UX, API, or workflow verification. This is the human-facing
channel for post-implementation fixes.

Add one unchecked checkbox per issue the agent must fix before the phase can close. Keep each item
independently fixable and describe observed behavior plus expected behavior. If the fix may change
SPEC/API/schema/security behavior, say so explicitly in the note.

The agent resolves these items through `/impl-assist 11 review`. Leave an item unchecked while it
is still open. Check it off only after the fix is implemented and re-verified. If manual
verification found nothing, keep the default checked line below.

- [x] No architect review issues recorded
- [x] Color-picker interaction blocks while every intermediate color is fully recomposited and PNG-encoded; make preview update continuously from native `input` events, keep controls interactive, coalesce export rendering, and prevent stale worker responses from winning.
- [x] A previously selected color, gradient, or custom image is replaced by the transparent checkerboard while editing the mask; render the item-local fill behind the live correction canvas through brush, undo/redo, zoom, and pan.
- [x] Fill choices are text-only and hard to scan; add compact circular swatches for the active custom color and every gradient preset, including a recognizable transparent swatch.
- [x] A selected solid color is shown with the transparent checkerboard texture over it; render the checkerboard only for the transparent fill so opaque colors stay visually uniform as before.
- [x] The native color picker closes after every palette click on the target platform, preventing continuous knob movement; replace it with an inline draggable color palette that stays open and preserves immediate preview plus coalesced PNG export.
- [x] Applying a color, dragging the palette/hue control, or picking a gradient/custom image still causes a perceptible hang on every interaction: the debounced worker recomposite (full canvas decode + PNG encode) fires again after nearly every settle, not just once at the end. Decouple preview from encoding entirely — `preview()` must only drive the existing instant CSS preview and mark the fill unsaved, with zero worker calls while the user keeps browsing colors/gradients/images. Add an explicit "Save background" action (single-image and selected-batch-item flows) that performs the one PNG recomposite/encode on demand. Until that fill is saved, gate individual/ZIP download and mask-correction entry (which renders the last-*saved* fill) on the saved state so neither ever serves a stale or preview-only file; surface the unsaved state to the user (e.g. disabled Download with a hint to save first).

---

## Implementation Notes

<!-- Optional. The agent adds a short bullet here only when something isn't already visible from
     the code or commit history: an intentional deviation from the plan, a residual risk, a
     rejected alternative. Leave empty when nothing needs recording — this is not a mandatory
     per-task log. -->

- Phase-init's background-fill TODO was resolved on 2026-07-12 through an architect-delegated
  decision: opaque uppercase hex colors, deterministic two-stop presets/geometry, and validated
  center-`cover` custom images. See `docs/STATE.md` § Project Log.
- The debounced-then-encode approach (previous review round) still put a full worker recomposite on
  the critical path of nearly every interaction, since the debounce settles almost every time the
  user pauses. Replaced with an explicit "Save background" action: `preview()` is now purely local
  (CSS + `dirty` flag, zero worker calls), and `onApply`/PNG encode only runs once, on `save()`.
  Download and mask-correction entry are gated on the *unsaved* (`dirty`) state, not just an
  in-flight save, so they never hand out a file that doesn't match what saved. `use-background-fill`
  tracks the last-saved fill as `useState`, not a ref read during render — the earlier ref-based
  draft passed manual checks but silently broke `renderHook`-based assertions; see
  `docs/KNOWN_GOTCHAS.md` § "A hook value derived from a ref read during render silently freezes in
  `renderHook` tests".

---

## Atomic Commit Message

```
feat(phase-11): add background fills and composited downloads
```

---

## Post-Phase Checklist

- [x] All Scope checkboxes checked (or deferred in Architect Review Notes)
- [x] All automated gate checks green
- [x] All architect review notes resolved
- [x] `docs/STATE.md` updated — run `/context-update 11`
- [x] Committed atomically on `feat/phase-11` branch
- [x] Tag created after merge to main: `git tag -a v0.11.0 -m "Phase 11: Background replacement"`
