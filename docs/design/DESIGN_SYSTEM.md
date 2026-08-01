# Design System — BG Remove App

Living record for Phase 30 (`docs/archive/phases/PHASE_30.md`). Sections are filled in as their Scope task
completes; unfinished sections are marked `_Pending T[N]_`. No external design tool — see
`docs/STACK.md` § Design system.

---

## 1. Pain-Point Inventory (`T1`)

Surfaces reviewed: home hero/features, upload (idle), automatic-processing (model-loading,
processing), editor stage (Cutout Magic/Manual, Enhancements, Background), batch grid, error
states, `site-header`/`site-footer`, `ModelStorageManager`. Both locales (`ru`/`en`) drive copy
through Paraglide `m.*()` everywhere reviewed — no hard-coded strings found, so localization is not
listed as a pain point below.

| Surface | What's wrong | Why it matters |
|---|---|---|
| Global palette (`globals.css`) | `--primary`/`--ring`/chart tokens are the stock shadcn "neutral" base-color defaults (`oklch(0.546 0.215 264.376)` etc.), never customized. No documented token names beyond raw shadcn variables. | The phase goal is a formalized, branded system; today there is zero visual differentiation from an un-styled shadcn scaffold — `T3`. |
| Semantic status colors | `BatchGrid.STATUS_STYLES`, the BEN2 fallback notice, and the draft-guard dialog each hard-code raw Tailwind `amber-*`/`blue-*`/`emerald-*` classes with manual light/dark pairs instead of theme tokens. `destructive` is the only status color that is a real token. | Duplicated ad hoc color pairs drift over time and can't be retuned from one place; no `warning`/`info`/`success` semantic exists to formalize in `T3`. |
| Elevation/motion | No spacing/elevation/motion scale exists beyond Tailwind defaults (`shadow-sm`, `ring-1 ring-foreground/10`, `duration-200`) used inconsistently (`Card` has a ring, `EditorToolbar`/batch header have `shadow-sm`, batch grid cards have neither until hover). | `T3` explicitly calls for spacing/radius/elevation/motion tokens "where currently only implicit in ad hoc class names" — this is that gap. |
| Home hero background | `HomePage` renders on flat `bg-background` with no depth cue; hero/feature/workspace sections are separated only by borders (`border-y`). | Weak visual hierarchy the phase goal calls out directly; `T4`'s background layer is the fix. |
| `site-header` | Plain text nav + bare `<img>` logo; no visual container distinction beyond `border-b`; `ModelStorageManager` is not reachable from here. | Thin brand identity; sets up `T6`'s relocation of `ModelStorageManager` into the header. |
| `ModelStorageManager` placement | Rendered as a floating `<aside>` below `ToolWorkspace` in `HomePage.tsx` — a maintenance affordance competing for attention with the primary tool. | Confirms `T6`'s scope: move behind a header icon trigger (`Tooltip`/`Popover`). |
| Model-loading progress | Custom hand-rolled `role="progressbar"` div (`ToolWorkspace.tsx`) and a bare native `<progress>` element in `BatchGrid` — two different unstyled progress representations for the same concept, neither using a shared primitive. | No `Skeleton`/`Progress` shadcn primitive adopted anywhere; `T5` pulls these in, `T9` applies them to replace both call sites. |
| Batch grid cards | Functional (`rounded-xl border bg-card`, hover/selected rings) but thumbnails have no loading skeleton beyond a raw `animate-pulse` div, and status pills are the ad-hoc-color case above. | Consolidating onto `Skeleton` + real tokens is `T5`/`T9`; currently two different "loading" visual languages exist (pulse div vs. spinner-less progress). |
| Error/warning surfaces | `role="alert"` blocks (upload/model/correction errors) correctly use the `destructive` token; the BEN2 fallback notice and the dirty-draft guard dialog use raw amber, not a token — an inconsistent severity vocabulary (error vs. warning look unrelated in code even though both are "something needs attention"). | `T3` should add a `warning` semantic token; `T16`'s accessibility pass depends on a consistent, contrast-checked severity vocabulary. |
| Component adoption | Every primitive in `src/shared/ui` (`button`, `card`, `switch`) is already re-themed on Base UI (not stock shadcn markup), current, and not obviously stale — the "un-customized shadcn/ui" framing in the phase goal is about brand/visual polish, not outdated component code. Only `Skeleton`, `Tooltip`, `Popover` are outright missing (`T5`). | Scopes `T2`'s upgrade to a version/API diff rather than a rewrite, and confirms `T5`'s component list is complete as scoped. |
| Breakpoints | `ToolWorkspace`'s `.tool-workspace-grid` (globals.css) is solid mobile-first → `lg:` two-column; `HomePage`'s hero/feature grid only breaks at `sm:`, leaving a wide `sm`–`lg` tablet range with the single-column tool workspace under a `sm:grid-cols-3` feature row — no broken layout observed, but no tablet-specific tuning either. | Flag for `T16`'s responsive pass rather than a blocking issue now. |

**Not a pain point (verified, not regressed):** keyboard navigation on `EditorToolbar` (roving
tabindex, arrow/home/end), focus-visible rings on interactive elements, `aria-live` status
announcements, and bilingual copy coverage are all already in place and should be preserved as-is
through the redesign.

---

## 2. Design Tokens (`T3`)

No color values changed — SPEC.md and `docs/archive/phases/PHASE_30.md` both require the existing palette stay
unchanged unless the architect explicitly approves a change. This section documents the tokens as
formalized in `src/app/styles/globals.css`, which is now the source-of-truth comment block.

> **Superseded 2026-07-30 by `T23`–`T28` — see §9.** The architect explicitly approved a full color
> replacement and gave a concrete creative brief (a "browser-native developer-tool" / "system
> interface" aesthetic). The palette below is the pre-`T23` historical record; §9 is current.

### Color

The `:root`/`.dark` OKLCH values are unchanged (Phase 03 base palette + Phase 12's one added accent).
No new semantic color token (e.g. a `warning` pair for the existing ad hoc `amber-*` usages in
`BatchGrid`, the BEN2 fallback notice, and the dirty-draft guard dialog) was added in this task —
introducing one is `T8`/`T9` scope (apply tokens across the app), not token definition itself; see
§1 inventory.

**WCAG AA contrast audit** (OKLCH → linear sRGB → relative luminance, standard WCAG formula):

| Pair | Light | Dark | Normal-text AA (≥4.5) |
|---|---|---|---|
| `foreground` / `background` | 19.79 | 18.96 | PASS / PASS |
| `muted-foreground` / `background` | 4.73 | 7.63 | PASS / PASS |
| `primary-foreground` / `primary` | 4.97 | **3.55** | PASS / **FAIL** |
| `secondary-foreground` / `secondary` | 16.42 | 14.48 | PASS / PASS |
| `accent-foreground` / `accent` | 16.42 | 14.48 | PASS / PASS |
| `card-foreground` / `card` | 19.79 | 17.16 | PASS / PASS |
| `muted-foreground` / `muted` | 4.34 | 5.83 | borderline\* / PASS |

\* `muted-foreground` on full-opacity `muted` (light) is 4.34:1 — under the 4.5:1 normal-text
threshold but the only two exact-opacity occurrences found (`QualityModeToggle` popover-close and
help-trigger icon buttons) wrap icons only (`aria-hidden`, no visible text), so WCAG 1.4.11
non-text contrast (3:1) is the applicable criterion, which passes.

**Flagged, not fixed:** default `Button` text (`primary-foreground` on `primary`) is **3.55:1 in dark
mode**, below WCAG AA for normal text (passes only the 3:1 large-text threshold). This is a
pre-existing gap in the current palette, not a regression introduced by this phase. Fixing it would
mean adjusting `--primary`'s lightness in `.dark` — a color-value change the phase's own scope line
reserves for explicit architect approval. Recorded here for that decision; not changed in `T3`.

### Typography

`--font-sans` / `--font-heading` (Geist Variable) are the formalized brand-font tokens. Sizing
intentionally reuses Tailwind's stock `--text-*` scale (`text-sm`, `text-base`, `text-4xl`, …) rather
than introducing a parallel named scale — one source of truth for type sizes, per the project's
anti-duplication convention.

### Spacing

Tailwind's own `--spacing` base unit (`0.25rem`) is the token every spacing utility already derives
from. The one formalized exception: `--spacing-stage` (`20rem`) / `--spacing-stage-lg` (`28rem`),
replacing an identical `20rem`/`28rem` magic-number pair that was duplicated verbatim across
`EditorStage.tsx`, `ToolPanelSlot.tsx`, and `ToolWorkspace.tsx`'s Suspense placeholder — now
`h-stage`/`min-h-stage` (+ `sm:*-stage-lg`). Verified byte-identical in the compiled CSS
(`.h-stage{height:20rem}`, `sm\:h-stage-lg{height:28rem}`) — no visual change.

### Radius

Already formalized before this phase: `--radius-sm` … `--radius-4xl`, derived from the single
`--radius` base value (`0.625rem`).

### Elevation

Tailwind's stock `--shadow-*` scale is used directly and consistently: `shadow-sm` for raised static
surfaces (editor toolbar, batch header, tool panels), `shadow-lg` for overlays (popover menus).
`Card` additionally applies `ring-1 ring-foreground/10` for a hairline edge — a deliberate second,
lighter treatment for static content containers, not an inconsistency to reconcile.

One remaining ad hoc, non-tokenized value was found and left as-is (single occurrence, not a
duplicated pattern): `InlineColorPicker`'s selection-ring swatch uses
`shadow-[0_0_0_1px_rgba(0,0,0,0.65)]`, a fixed-opacity black ring that doesn't adapt per theme.
Deferred to `T16` (accessibility/contrast polish) rather than touched here, to keep `T3` scoped to
token formalization.

### Motion

Transitions use Tailwind's stock `ease-in-out` timing function and numeric duration scale (implicit
150ms default for micro-interactions like hover/focus state changes; explicit `duration-200` for
content transitions such as thumbnail hover-scale and progress-bar width). Tailwind v4 has no
themeable named-duration namespace (only `--ease-*` and `--animate-*` are themeable), so this
convention is documented here rather than aliased to a same-valued custom token.
`prefers-reduced-motion: reduce` already collapses all editor-stage/toolbar/tool-panel transitions
and animations to near-zero duration (`globals.css`, pre-existing).

## 3. Background Pattern (`T4`)

Implemented as `.site-background-pattern` (`globals.css`), rendered once at the `site-shell` level
(`src/shared/ui/site-shell.tsx`) so every page gets it without per-page wiring:

- A static engineering-line grid uses 32px minor and 160px major cells. The second architect
  review reduces the foreground mix to 3%/6% respectively and narrows the radial/vertical mask so
  the grid remains a quiet depth cue rather than a competing surface. `color-mix` against
  `--foreground` auto-adapts to light/dark without a separate override.
- The original T4 screenshots remain historical evidence of the first treatment. The final
  before/after set and architect approval are still pending under `T21`.
- No motion: it's a static `background-image`/`mask-image`, no transition or animation property.
  Nothing for `prefers-reduced-motion: reduce` to override — verified by inspection of the rule
  (`globals.css`) and confirmed no new console errors/motion in the rendered page.
- Purely decorative and inert: `aria-hidden="true"`, `pointer-events-none`, `position: absolute`
  sibling of the header/content/footer (not a wrapping element), `z-index: 0` under the real content
  at `z-index: 10` — verified via `getComputedStyle` in a headless-browser check (position, z-index,
  pointer-events, and the resolved `background-image`/`mask-image` all matched the intended CSS) and
  via full-page + cropped screenshots in both themes.
- Contrast: at a maximum 6% mix, further thinned by the mask away from the focal point, the maximum
  possible shift to background luminance is far too small to move any existing text/background pair
  below WCAG AA — see §2's contrast table; all pairs already have ≥4.34:1 margin before the pattern
  and the pattern changes that by a fraction of a percent at most.

## 4d. `ToolWorkspace` architecture audit (`T15`)

- **State machine**: single source of truth — all status comes from `useToolWorkspaceController()`;
  `ToolWorkspace.tsx`'s `state.status` branches select which UI slice to render, they don't
  duplicate logic. No second/parallel state machine exists.
- **Same-layer imports**: `grep`-verified zero `widgets/*` → `widgets/*` imports anywhere in
  `src/widgets`. `ToolWorkspace` only imports `features/*`/`entities/*`, as expected for its layer.
- **Full image buffers in state**: one pre-existing exception —
  `use-tool-workspace-controller.ts`'s `originalMatte` (`useState<AlphaMatte | null>`) holds a full
  alpha buffer. Verified this is the immutable *base* matte for a correction session, set once and
  read (never mutated in place) — the actually-changing buffer during live painting stays behind the
  imperative `MaskCanvasHandle` ref API and only O(stroke-area) deltas ever cross the React
  state/props boundary (the existing Phase 07 R4 invariant, referenced in `docs/STATE.md`). Not a
  new regression; a bounded, already-justified exception.
- **Dead adapters**: none remain — `T11`/`T12` already removed or ruled out every candidate found
  (`ObjectSelectionCanvas`/`Controls`, the legacy-deprecation test); nothing new surfaced.
- **God-component**: `ToolWorkspace.tsx` is 1,479 lines — large, but not a Phase 30 regression;
  Phase 30's only edits to this file were the `Skeleton` swap (§4a) and no new responsibilities were
  added. Splitting it further is a pre-existing size concern predating this phase, out of this task's
  bounded scope (verification, not refactor).

## 4c. Redesigned stage/toolbar/panel + batch contract verification (`T13`, `T14`)

Ran the full deterministic Chromium suite (`pnpm exec tsx scripts/run-e2e.ts --project=chromium`,
73 tests, all specs except the three opt-in `model-lab.real`-style cases) after all visual/component
changes above. First run surfaced one real regression from `T6`: `e2e/home.spec.ts:182` used a loose
`getByRole("button", { name: /download/i })` locator that became ambiguous once the new
`model-storage-trigger` button's accessible name ("Downloaded model storage") also matched — a
genuine naming collision introduced by moving that control into the always-visible header instead
of a collapsed disclosure. Fixed by anchoring the locator to `/^download$/i`, matching every other
download-button locator already in the suite (`e2e/home.spec.ts:52,54,185,331,457,459,488` all
already used the anchored form — this was the one outlier). Full rerun: **73/73 pass**, including:

- `T13`: Cutout Magic (`brush-guided-correction.spec.ts`), Manual
  (`mask-correction.spec.ts`), Enhancements (`hybrid-pipeline.spec.ts`,
  `matte-refinement.spec.ts`), Background (`home.spec.ts` background-replacement test,
  `hybrid-pipeline.spec.ts` Background Apply/undo/redo), shared undo/redo history
  (`hybrid-pipeline.spec.ts:144`), and sized individual PNG export
  (`home.spec.ts:514` split download) all pass for both single and selected-batch documents; per-item
  tool/draft/history/zoom isolation and the dirty-draft Apply/Discard/Stay guard are exercised by
  `brush-guided-correction.spec.ts:257`, `hybrid-pipeline.spec.ts:175,232`, and
  `mask-correction.spec.ts:44`.
- `T14`: batch concurrency/model-load scheduling (`processing-modes.spec.ts:98`), per-item error
  isolation and settled-item-only scoping (`foreground-refinement.spec.ts:94`,
  `matte-refinement.spec.ts:129`), and Download-all as a client-side ZIP of committed PNGs
  (`home.spec.ts:379`, `security-privacy.spec.ts` ZIP-content-privacy test) all pass unchanged.

No further changes were needed for either task beyond the one locator fix — the redesign's visual
and component-level changes did not touch the underlying state machine, document/history contract,
or batch scheduler.

## 4b. Per-item ownership contract audit (`T12`)

Verified read-only research (Explore agent), independently spot-checked: the Phase-25 contract —
one independent `EditDocument` + `EditHistory` + `EditorArtifactStore` + `workerOwnerId` per
successful single result and per `BatchItem`, with no cross-item leakage — **holds, with no
duplicate or late-adoption adapter to remove.**

- `createEditDocumentScope()`/`disposeEditDocumentScope()` (`entities/edit-document/model/edit-document.ts`)
  always allocate/release a fresh scope; no call site reuses one across items.
- `use-tool-workspace-controller.ts`'s single-result scope and `use-batch-processing.ts`'s
  `documentScopesRef` (a `Map<itemId, EditDocumentScope>`, 1:1, always disposing the previous scope
  for the same id first) are two distinct, non-overlapping containers routed through the same
  shared `commitProcessedImage`/`undoEdit`/`redoEdit` implementation
  (`features/editor-history/model/editor-history.ts`) — parallel paths, not duplicates.
- No `adapter`/`bridge`/`compat`/`legacy` marker exists anywhere in the document/history/artifact
  code. The one Phase-26 "temporary adapter" mentioned in
  `docs/archive/phases/PHASE_26.md` (panel-slot wiring
  during the shell migration) was already fully cleaned up before Phase 30 — no trace remains in
  `src/widgets/tool-workspace`.

Nothing changed for this task; documented here as the audit record.

## 4a. Superseded UI/copy removed (`T11`)

Verified read-only research (Explore agent) found genuine leftover pre-redesign debris that Phases
25–29 didn't clean up, all independently re-verified before deletion:

- `src/features/select-object/ui/GuidedBrushResultPreview.tsx` — exported, imported nowhere.
- `src/features/select-object/ui/ObjectSelectionCanvas.tsx` / `ObjectSelectionControls.tsx` (+ their
  `.test.tsx` files) — the Phase-17 point/box/layer UI, explicitly marked
  `@deprecated ... production uses GuidedBrushCanvas/Controls` since Phase 21, with zero production
  consumers. Removed along with their `shared/ui`-facing exports in
  `features/select-object/index.ts`.
- `src/features/select-object/model/legacy-deprecation.test.ts` — existed only to pin the
  now-deleted deprecation JSDoc; removed with it.
- 114 orphaned message keys removed from **both** `messages/en.json` and `messages/ru.json`
  (verified via a bare word-boundary scan of `src/` excluding the generated `src/paraglide/`
  output, which trivially contains every key regardless of use — the first scan attempt without
  that exclusion produced a false "0 orphans" result). These span three UI generations that were
  each superseded but left their copy behind: the Phase-17 point/box/layer picker (`guided*`), an
  intermediate tabbed Markings/Result guided-brush UI later simplified into the current
  `GuidedBrushControls` (`guidedBrush*` — verified the current component only calls a much smaller
  set: `guidedBrushClear/Keep/KeepRequired/ModeLabel/Redo/Remove/Size/SizeLabel/Undo`), and an
  older About-page/mask-toolbar/quality-toggle copy set (`aboutTechHeading`, `maskAddDescription`,
  `qualityMax`, `editorGuidedAdapterHint`, etc.) replaced by current equivalents.

**Explicitly retained** per Phase 27's own "Do NOT touch" list ("legacy point/box/layer internals
still used by worker/session compatibility"): `useObjectSelection`, `PromptSession`, the
`GUIDED_*`/`PROMPT_*` model types, `fuseGuidedMattes`, and candidate-ranking — only the duplicate
*UI* was removed, not the underlying model/session internals. `/dev/model-lab` and
`/dev/remove-background` internal diagnostic routes were confirmed still alive and untouched.

Verification: `pnpm tsc --noEmit`, `pnpm exec steiger ./src`, and `pnpm vitest run` (346/346,
down from 354 — exactly the 8 tests that lived in the 3 deleted test files) all pass; no e2e spec
referenced any deleted component, testid, or message key.

## 4. Component Conventions (`T5`–`T9`)

### Adopted stock components (`T5`)

`Skeleton`, `Tooltip` (+ `TooltipProvider`, wired once at the router root, `src/routes/__root.tsx`),
and `Popover` (+ `PopoverHeader`/`PopoverTitle`/`PopoverDescription`) added to `shared/ui` via the
`shadcn` CLI, exported from `shared/ui/index.ts`. Formatted to match the project's Prettier config
and stripped the generated Next.js `"use client"` directive (this project is TanStack Start, not
Next.js — no client/server component boundary to mark).

### Applied to `shared/ui` + `site-header`/`site-footer`/`site-shell` (`T8`)

Audited every `shared/ui` primitive (`button`, `card`, `switch`, plus the three new ones) and
`site-header`/`site-footer`/`site-shell` for ad hoc values that should become tokens. Finding: **no
further changes needed here.** Every arbitrary-looking class (`rounded-[min(var(--radius-md),10px)]`,
`h-[18.4px]`, etc.) is either a stock shadcn internal already confirmed unchanged by `T2`'s diff, or
a precise pixel fit with no meaningful token equivalent (e.g. the switch thumb's exact travel
distance) — not a design decision to formalize. `site-header`'s `LanguageSwitcher` uses a native
`title` attribute on self-labeling `ru`/`en` text links; left as-is rather than upgraded to the new
`Tooltip` component, since `Tooltip`'s stated purpose (`T5`) is icon-only triggers that hide their
meaning without one (e.g. `ModelStorageTrigger`, `MaximumQualityHelp`) — the locale links already
show their own label, so a JS tooltip would add complexity without an accessibility or UX gain.

The concrete real-world application of the new `Popover` is `T6`'s `ModelStorageTrigger`
(`features/model-storage/ui/ModelStorageTrigger.tsx`) — a `features`-layer component, not
`shared/ui` itself, since `shared` cannot import `features` (FSD layering; see Implementation Notes).

### Applied to the workspace/batch surfaces (`T9`)

Replaced every hand-rolled `animate-pulse` loading placeholder with the new `Skeleton` component
(same visual result — `Skeleton`'s base classes are a superset of what each call site already used,
overridden via `className` merge, verified by targeted test runs): `EditorStage`'s loading state,
the `ToolPanelSlot` Suspense fallback in `ToolWorkspace`, and `BatchGrid`'s thumbnail-loading state.

The upload surface (`UploadDropzone`, `ChoosePhotoButton`, `UploadPreparationNotice`) and
`ProcessingLog` were reviewed and are already fully token-consistent — no ad hoc values to replace.
`ProcessingLog`'s technical diagnostic copy (`runtime: …`, `model bytes: …`) is an intentional,
existing opt-in "Details" disclosure (its own doc comment, Phase 12), not superseded pre-redesign
debris — left as-is; not a `T11` removal target.

**Deferred to `T16`:** `BatchGrid`'s per-status pill colors (`STATUS_STYLES`) and the amber
warning banners in `ToolWorkspace` (BEN2 fallback notice, dirty-draft guard dialog) still use raw
Tailwind color utilities rather than a semantic token (flagged in `T1`), and the pill/banner
treatments differ in a way that isn't a single drop-in token (opaque pill-on-photo vs. translucent
full-width banner). Reconciling this is a real, contrast-relevant follow-up better suited to `T16`
("WCAG AA contrast on every restyled surface") than to a same-pass rename here.

## 5. IA Delta Decision (`T7`)

**Approved architect-review delta — 2026-07-29.** The automatic-first state machine, document
ownership and focused tool set stay unchanged, but their presentation is restructured:

- The home route is marketing-led only while empty. Its desktop empty state uses a 5/7 split with
  value proposition on the left and one upload card (mode selector + dropzone) on the right.
  Accepting one or many files removes marketing content and exposes a clean application workspace
  on the same localized URL; no editor route or persistent transfer store is introduced.
- One compact toolbar owns editor tools/history, batch utilities, Download, diagnostics and the
  rightmost return-to-upload action. No separate workspace top bar consumes editor height.
- Result, Magic and Manual use one stable contain-fit viewport. On desktop the selected tool panel
  is a fixed right rail; Cutout view controls live in a lower-right canvas overlay.
- Batch adds only navigation around that same editor: a horizontal filmstrip and visual status
  summary above the toolbar at every breakpoint. Item-specific actions live in sibling menus;
  Download all is part of the toolbar Download menu.
- Technical processing detail moves to an explicit closed-by-default diagnostics Sheet/Drawer.
  Loading uses stable Skeleton footprints in the primary UI.

The third architect review supersedes the affected placement/treatment details: return-to-upload is
the toolbar's first left action; diagnostics is portaled into the site header; the empty upload
surface is a border-light icon-led command deck; canvas controls are collapsible and disclose
shortcuts; brush footprints use a thin dashed outer ring plus solid core; all editor transparency
surfaces share one checkerboard token; and active-document preview layers stay mounted across tool
switches to avoid blank frames and repeated blob/canvas decoding.

This is a bounded IA delta under SPEC.md §5.3, not Studio scope. `T22` synchronizes it before
implementation; `T10` is implemented through the Phase-30 Architect Review Notes. Final screenshots
and approval remain pending under `T21`.

## 5c. Cross-browser Playwright verification (`T18`)

Ran the full deterministic suite (`pnpm e2e`, 76 collected tests per project) across every
configured project (`playwright.config.ts`): `chromium`, `firefox`, `webkit`, and `Mobile Safari`.
Results: **289 passed, 15 expected platform/feature skips** — Chromium 73 passed / 3 skipped;
Firefox, WebKit, and Mobile Safari each 72 passed / 4 skipped.

The second Architect Review iteration adds and extends browser assertions for real canvas
zoom/pan/fit geometry, native fullscreen or inline fallback, stable Magic/Manual bounds, the
all-width horizontal batch overview at 390/768/1024/1440 px, page/background overflow, sibling
per-item menus, dirty removal/reprocess guards, ZIP in the shared Download menu, and toolbar
diagnostics/back actions. All deterministic checks pass without retries.

**Absence of superseded UI**: structurally guaranteed for `ObjectSelectionCanvas`/`Controls` and
`GuidedBrushResultPreview` (`T11`) — the source files no longer exist, so nothing can render them
regardless of browser/locale. The old floating `<details>` model-storage UI is likewise gone;
`security-privacy.spec.ts`'s model-storage test (which now drives the new
`model-storage-trigger` header button, §4c) passed on all four projects, confirming the new surface
works everywhere the old one used to.

## 5b. Test coverage gap closed (`T17`)

Audited existing coverage against the phase's checklist (per-item isolation, selection guards,
stale work, cleanup, ZIP committed output, retained diagnostics). All were already covered by
Phase 25–29 tests except one: no test exercised **many-item churn** — repeated add/retry/remove
cycles across more than a couple of items — for artifact/scope leak-freedom, only single-item
lifecycle and single-document many-edit budget enforcement were tested separately.

Added `src/features/batch-processing/model/use-batch-processing.test.ts` — 8 items enqueued,
3 removed, 2 retried (scope replaced), a second wave of 3 more enqueued, then `reset()` — asserting
at each step that disposed/replaced scopes drop to zero artifacts while live scopes stay non-zero,
and the final reset zeroes everything. `pnpm vitest run` (347/347), `pnpm tsc --noEmit`, and
`pnpm exec steiger ./src` all pass.

## 6. Accessibility Evidence (`T16`)

Checklist from `docs/archive/phases/PHASE_30.md` `T16`, each verified against current code/tests:

- **Stable stage/panel geometry**: `--spacing-stage`/`--spacing-stage-lg` (§2) keep `EditorStage` and
  `ToolPanelSlot` at the same fixed footprint regardless of tool/content — unchanged by this phase's
  redesign, confirmed by the e2e suite's stage-stability assertions passing (`home.spec.ts:207`
  "editor shell is stable and keyboard reachable").
- **Toolbar overflow/navigation**: `EditorToolbar` already had `overflow-x-auto` (scrollable when
  tools don't fit) and full roving-tabindex arrow/Home/End keyboard navigation
  (`EditorToolbar.tsx` `handleNavigation`) before this phase — unchanged, still covered by
  `EditorToolbar.test.tsx`.
- **Touch targets**: icon-only controls (`EditorToolbar` undo/redo, `ModelStorageTrigger`,
  `MaximumQualityHelp`) are `size-7`/`size-8` (28–32px) — a pre-existing app-wide convention, not
  something this phase regressed. Widening every icon button's hit target app-wide is a larger,
  separate change than this phase's redesign scope; not done here.
- **Focus restoration**: `ToolWorkspace`'s dirty-draft guard already restores focus to the control
  that triggered it (`requestAnimationFrame(() => pendingToolTriggerRef.current?.focus())`,
  3 call sites) — pre-existing, unchanged, still passing (`brush-guided-correction.spec.ts:257`).
- **Dirty-draft dialogs**: `role="alertdialog"` with labelled title/body
  (`editor-draft-guard`, `ToolWorkspace.tsx`) — pre-existing, unchanged.
- **Screen-reader statuses**: `aria-live="polite"` status region already announces
  enhancement/guided/batch/state changes (`ToolWorkspace.tsx`) — pre-existing, unchanged.
- **`prefers-reduced-motion`, including the new background pattern**: the `T4` background pattern
  has no transition/animation to begin with (§3); the pre-existing global rule collapsing
  editor-stage/toolbar/tool-panel animations to near-zero duration is untouched.
- **WCAG AA contrast on every restyled surface**: full re-audit (§2) — all pairs ≥4.34:1 except the
  one pre-existing, flagged, not-silently-fixed dark-mode `primary`/`primary-foreground` gap (3.55:1,
  needs an architect color-value decision). The three new semantic tokens added in this task
  (`warning`/`info`/`success`, formalizing `BatchGrid`'s per-status pill colors — deferred from `T9`)
  measure 8.17–12.03:1 in both themes, computed the same OKLCH→luminance→WCAG-ratio way as §2's
  table.
- **Mobile camera/upload**: `ChoosePhotoButton`'s `capture="environment"` input is unchanged.
- **Icon tooltips**: `EditorToolbar`'s Undo/Redo — the two icon-only controls without persistent
  visible text most likely to need one — now use the `T5` `Tooltip` component (composed onto
  `Button` via Base UI's `render` prop) instead of a bare `title` attribute. Verified via
  `EditorToolbar.test.tsx` and the full Chromium e2e suite (undo/redo interactions still pass
  unchanged). Other icon controls (`ModelStorageTrigger`, `MaximumQualityHelp`) already disclose
  their full content through a `Popover` on click, which doubles as their hover/focus affordance —
  left as-is rather than stacking a second `Tooltip` on top (see §4, `T8`).

Final second-review verification: `pnpm tsc --noEmit`, `pnpm exec steiger ./src`,
`pnpm vitest run` (86 files, 363 tests), `pnpm lint` (no errors; one pre-existing Fast Refresh
warning in `shared/ui/button.tsx`), and the full deterministic `pnpm e2e` result recorded in §5c.

## 7. Before/After Screenshots

_Historical Phase-30 evidence: `docs/archive/design-phase-30/exports/`._

## 8. Architect Approval

_Pending — recorded at `T21`._

## 9. Visual Identity — System Interface Redesign (`T23`–`T28`)

**Approved 2026-07-30.** Three architect review rounds on top of `T1`–`T22` fixed real structural
problems (broken breakpoints, flicker, layout instability) but left the product's actual identity
untouched — §2 above records that no color value changed from Phase 03/12's stock, unbranded shadcn
"neutral" palette. That is the root of the continued dissatisfaction: this section is the architect's
creative brief for closing that gap, superseding §2's palette (typography, spacing, radius, and
elevation *conventions* from §2 are otherwise unchanged and still apply).

**Brief:** a browser-native developer-tool aesthetic — a "system interface" — for a product whose
factual identity is `cutbg.art`: free, client-side, browser-only background removal and finishing;
image processing happens entirely on-device, nothing is ever uploaded to a server. The app already
leans partway this direction without owning it (`DiagnosticsSheet`'s monospace log, `<kbd>` shortcut
chips, the engineering-grid background, a component literally named `command-deck`) — this redesign
elevates that latent language into the actual product identity instead of adding a fourth cosmetic
pass.

### Color

Replaces the stock indigo-264° shadcn defaults. Named roles, not a raw scale — each has a light and
dark hex value; dark is the default rendered surface (`:root` ships the dark values, a
`prefers-color-scheme: light` / manual toggle applies light), because a browser-native developer tool
(VS Code, a terminal, DevTools) reads as dark-by-default. Light stays a fully-supported, equally
rigorous second theme.

| Role | Light | Dark | Use |
|---|---|---|---|
| `canvas` | `#F3F4F5` | `#0A0C0E` | page/app background |
| `ink` | `#14171A` | `#E7E9EC` | text, primary foreground |
| `line` | `#DBDEE2` | `#22262B` | hairline borders — replaces most `shadow-*` on structural chrome |
| `signal` | `#2F6FEB` | `#5B8DF7` | the one functional accent: focus, active tool, processing state |
| `local` | `#1FAE6E` | `#33C97F` | "runs on your device" trust/success state — the product's on-device promise made visible |
| `alert` | `#E5484D` | `#F16267` | destructive/error (tuned from the current `--destructive`, not reinvented) |

Every new pairing gets the same WCAG AA contrast audit method as §2's table (OKLCH → linear sRGB →
relative luminance → ratio) before `T23` is marked complete, including resolving the previously
flagged 3.55:1 dark-mode `primary`/`primary-foreground` failure as part of choosing `signal`'s
dark-mode lightness. `warning`/`info`/`success` (§1, §6) stay as semantic status tokens, retuned to
sit consistently against the new `canvas`/`ink` pair rather than removed.

### Typography

Geist Variable stays the UI/display face (already reads as a "system" typeface — no reason to
replace it), used with restraint. **Geist Mono** (same family, guaranteed metric harmony) becomes a
first-class second voice rather than a rare diagnostic-only accent: toolbar/tool-panel section
labels, stage readouts (image dimensions, zoom %, processing-engine label), `<kbd>` shortcut chips,
`DiagnosticsSheet`, and the background-fill hex `<output>` all move to mono (`T24`). This is the
single biggest typographic move in the redesign — it takes a device that today only shows up in
`DiagnosticsSheet` and `InlineColorPicker`'s hex readout and makes it the product's signature voice
throughout.

### Layout

Hairline 1px `line`-token borders replace shadow-driven card chrome on structural surfaces
(`site-header`, `EditorToolbar`, the tool-panel rail, `EditorStage`) so panels read as instrument/
window chrome, not consumer-web cards — `shadow-*` stays reserved for true overlays (popover/menu),
per §2's existing elevation convention (`T25`). A tighter radius on structural containers vs. the
existing softer radius kept on buttons/inputs creates a deliberate two-tier radius hierarchy
(instrument vs. control). The existing engineering-grid `.site-background-pattern` — already
architect-approved through three review rounds — is kept as-is and extended into the editor stage's
empty margins, not just the marketing hero (`T26`); it is the one visual element already
unambiguously working and is not being redesigned, only extended.

### Signature element — Local Execution Readout (`T27`)

A persistent, small mono status chip (toolbar or a thin new status-bar strip under the stage)
presenting the existing `use-tool-workspace-controller` status/`qualityMode` state as a live process
readout: a pulsing dot + `on-device · WebGPU` while `status: "processing"`, settling to
`done · 1.2s · on-device` after. Presentational only — reads existing state, introduces no new state
machine branch. This is the one deliberately memorable device in the redesign: it turns the product's
core factual promise ("nothing is ever uploaded, it all happens in your browser") into a literal
piece of system-interface UI instead of marketing copy — the kind of live status line a real
developer tool would show for a build or process, applied to this product's actual mechanism.

**WCAG AA contrast audit** (same OKLCH → linear sRGB → relative luminance → ratio method as §2),
computed for every new pairing actually shipped in `globals.css`:

| Pair | Light | Dark | Normal-text AA (≥4.5) |
|---|---|---|---|
| `foreground` / `background` | 16.34 | 16.11 | PASS / PASS |
| `muted-foreground` / `background` | 5.69 | 7.52 | PASS / PASS |
| `primary-foreground` / `primary` | 5.74 | **6.16** | PASS / **PASS** |
| `destructive-foreground` / `destructive` | 5.04 | 6.24 | PASS / PASS |
| `local-foreground` / `local` | 6.29 | 9.14 | PASS / PASS |
| `foreground` / `card` | 17.99 | 15.31 | PASS / PASS |

The dark-mode `primary-foreground`/`primary` pair — previously flagged at 3.55:1 (§2) — is fixed at
6.16:1. This isn't a lightness tweak to the old value; the fix is structural: `signal`'s dark-mode
swatch is deliberately the *lighter* end of its ramp (so it reads clearly against the new near-black
`canvas`), which means its foreground text is `canvas`-dark (near-black) rather than white — the same
pattern applied to `destructive` and `local`. `warning`/`info`/`success` (§1, §6) are unchanged
absolute Tailwind colors (`amber`/`blue`/`emerald` `-100`/`-900` and `-950`/`-200` pairs), independent
of `canvas`/`ink`, so their existing 8.17–12.03:1 audit from §6 still holds against the new background.

Before/after evidence and the dated architect sign-off for this section are recorded at `T21` (§7,
§8), alongside the rest of the phase.

## 10. Interaction & Layout Redesign (`T29`–`T32`)

`T23`–`T28` delivered visual identity — palette, type, chrome — without touching component
composition or interaction. The architect's follow-up brief asked for a real second pass: real UX
defects fixed, and deliberate interaction/layout upgrades applying the `frontend-design` skill's
process (structure encodes information, one signature motion, restraint elsewhere) to the parts of
the product that actually carry the user through the flow.

### Defects fixed

- **`QualityModeToggle` badge/label overlap** (~640–1024px): the 3-column grid keyed off *viewport*
  width while the component actually lives in a narrower panel column. Fixed with a container query
  (`@container` + `@[26rem]:grid-cols-3`) so the column count reacts to the panel's real width. A
  first attempt also added `truncate`/`whitespace-nowrap` and kept the title+badge row as a CSS grid
  — that stopped the overlap but introduced a second defect: the "Recommended" badge is wide enough
  that the label track could starve down to truncating short labels (e.g. "Fast") even on a full
  1440px desktop layout, caught via manual screenshot review. Fixed properly by switching that row
  from `grid-cols-[minmax(0,1fr)_auto]` to `flex flex-wrap`: the label keeps its natural width and the
  badge(s) wrap onto a second line when the row is too narrow for both, instead of either truncating
  or overlapping.
- **`EditorToolbar` silent horizontal scroll**: `overflow-x-auto` had no affordance, so tools could
  scroll off-screen unnoticed on narrow viewports. Fixed with edge fade masks that only render when
  the toolbar is actually scrollable (tracked via `scrollLeft`/`scrollWidth`/`clientWidth` + a
  `window` `resize` listener and the container's own `scroll` event).
- **Abrupt empty-state → editor handoff**: `ToolWorkspace`'s hero/toolbar/stage/rail mounts now use
  `tw-animate-css` `animate-in fade-in slide-in-from-bottom-2`, gated by `motion-safe:`, in place of
  an unannounced unmount/mount swap.
- **Batch-mode discoverability**: multi-file drop was only reachable by already knowing it existed.
  `UploadDropzone` now shows an explicit mono hint line under the primary prompt.
- **Magic-mode auto-extraction felt like a dead end**: the "preparing…" placeholder is now a spinner
  plus explicit copy pointing at the always-visible Manual tab as an immediate alternative — no
  fabricated cancel button was added, since the extraction itself isn't abortable client-side; the fix
  is making the existing, already-functional escape hatch (the Manual tab) visibly reachable.
- **`BackgroundFillSelector` undifferentiated control block**: fill options, custom-image upload, and
  save actions now sit in labeled sections (reusing `ToolPanelSlot`'s mono uppercase section-label
  convention) separated by hairline dividers, and the redundant nested border/padding (duplicating the
  `ToolPanelSlot` card chrome it's always rendered inside) was removed.

### Signature interaction motif — tried, and reverted

The original plan for this pass's "one bold move" was a sliding active-tool indicator behind
`EditorToolbar`'s tool buttons: an absolutely positioned pill animating `transform: translateX(...)`
and `width` when the active tool changed, measured via a `ResizeObserver` on the button group.

It was built, then reverted during this same task after e2e verification surfaced real,
reproducible failures: the `ResizeObserver` watched a container that also renders the very indicator
element its own callback drives, and even after replacing that with a `window` `resize` listener, the
feature kept causing intermittent timeouts across multiple batch/multi-document apply flows
(`ci-critical`, `brush-guided-correction`, `hybrid-pipeline` specs) — confirmed as caused by this
feature specifically via `git stash` bisection (the failures disappeared entirely, 15/15 reliable
across three repeated runs, once the indicator was removed and only the scroll-fade masks kept).
Undo/redo/apply reliability in the editor is more important than an animated tab indicator, so it was
dropped rather than shipped. The toolbar's actual interaction refinement in this pass is the
scroll-fade masks above; everything else is a quiet, consistent `transition-colors` hover/focus
treatment (extended to `BatchGrid` item cards, `EnhancementsToolPanel` operation rows, and
`ForegroundRefinementControls`' checkbox row), not a second bold move.

### Token consistency

`EnhancementsToolPanel` and `ForegroundRefinementControls` had hardcoded `emerald-*` success-state
colors predating the `success`/`success-foreground` semantic pair (§1, §6). Both now use the token
pair instead — same computed colors, now sourced from one place.

Verification, before/after evidence, and the dated architect sign-off for this section are recorded
at `T21` alongside `T23`–`T28`.
