# PHASE 21 — Brush-Guided Object Correction

<!-- TOKEN BUDGET: keep this file under 10,000 tokens. Be concise. -->

## Phase Metadata

| Field | Value |
|-------|-------|
| Phase | `21` |
| Title | Brush-Guided Object Correction |
| Status | `✅ done` |
| Tag | `v0.21.0` |
| Depends on | PHASE_20 gate passing |

---

## Phase Goal

Replace the technically exposed Phase-17 point/box/stroke/layer editor in the primary user journey
with one predictable semantic brush: green means `keep`, red means `remove`, and an explicit
recompute asks the existing pinned SlimSAM model to update the object mask. Preserve visual mask
alternatives, the final exact pixel brush, matting, foreground cleanup, background replacement, and
downloads without adding another model or sending image data off-device (SPEC.md §1.3, §2.2,
§5.2–§5.4, §6–§7.7, §8).

The Phase-17 implementation remains in source for compatibility and rollback. Mark only
production-unreferenced legacy UI exports as `@deprecated`; do not deprecate worker, prompt,
constraint, candidate, or session code reused by the brush flow.

No Figma screenshots or other design assets were supplied. The architect approved the written
interaction contract recorded in `SPEC.md` v1.13.

---

## Scope

### Frontend

- [x] `F1` Add the Phase-21 browser-memory contracts for `GuidedBrushSession`, semantic
  `keep`/`remove` strokes, brush status/dirty revision, local edit region, intent-ranked candidates,
  and bounded history. Keep reusable image-domain values such as `AlphaMatte`, `PixelRect`, and
  `RefinementConstraintMap` in `entities/processed-image`; do not create persistent state —
  _Depends on:_ —
- [x] `F2` Consolidate all visible strokes into one compact source-sized constraint map and derive a
  deterministic, spatially representative, label-balanced prompt set with at most `32` points for
  the entire current session. A new stroke must not add another independent 32-point batch, and a
  red-only direct session must not call SlimSAM — _Depends on:_ `F1`
- [x] `F3` Replace the current `[0,1]` score sanitization/user-facing estimate with deterministic
  intent-first candidate ranking: compare pre-hard-constraint green inclusion and red exclusion,
  use any finite raw `iou_scores` value only as an internal tie-breaker, then prefer continuity with
  an automatic base inside the edit region. Compute differences inside that region, collapse
  alternatives whose local `differenceRatio` is below `0.001` (0.1%), and never render a score,
  percentage, "estimate unavailable", or a false recommendation based only on decoder order —
  _Depends on:_ `F1`, `F2`
- [x] `F4` Replace accepted-mask-bounding-box fusion for the primary flow with bounded
  brush-region-only fusion. When an automatic base exists, every pixel outside the brush-derived
  edit region must remain byte-for-byte unchanged; inside it, apply the selected model candidate,
  then apply the latest hard keep/remove constraints last. Direct guidance without a base may use
  the selected source-sized candidate — _Depends on:_ `F1`, `F3`
- [x] `F5` Add a brush-session orchestrator over the existing SlimSAM worker and same-image
  embedding: painting, undo, redo, and clear update markings/dirty state only; a size change affects
  only future strokes. None of those actions runs inference. Inference runs solely from explicit
  recompute, is serialized/latest-revision-wins, and reuses the current model lifecycle. Disable
  acceptance while visible markings are newer than the computed candidates; preserve markings and
  the prior accepted result on recoverable failure — _Depends on:_ `F2`, `F3`, `F4`
- [x] `F6` Add the primary bilingual guided UI with one physical translucent brush and two semantic
  modes (`Оставить`/`Keep` in green, `Удалить`/`Remove` in red), adjustable size, undo/redo, clear,
  explicit recompute, cancel, and accept. Match visible brush width to the actual source-space
  constraint radius, distinguish intent without relying on colour alone, and announce
  ready/dirty/processing/candidate/error states accessibly — _Depends on:_ `F5`
- [x] `F7` Present one to three materially different candidates as visual selectable previews
  synchronized with the main mask overlay. Label the top result as best matching the markings only
  when intent ranking supports that claim; when alternatives collapse, show one result with a
  localized explanation rather than redundant controls — _Depends on:_ `F3`, `F6`
- [x] `F8` Integrate brush guidance from both entry paths: direct upload requires at least one green
  stroke before recompute, while "refine selection" from an automatic result accepts green and/or
  red markings over the preserved base matte. Accepted output must continue through optional
  ViTMatte refinement, foreground cleanup, exact pixel correction, background replacement,
  individual download, and the applicable selected-batch flow without a parallel state machine —
  _Depends on:_ `F4`–`F7`
- [x] `F9` Retain Phase-17 point, box, stroke, and manual layer source without exposing it in the
  primary production journey. Add `@deprecated` only to legacy UI exports that have no production
  callsite after `F8`; leave reused `PromptSession`, worker protocol, coordinate conversion,
  constraint, fusion, and candidate primitives unmarked. Keep focused legacy tests sufficient to
  detect accidental breakage or deletion — _Depends on:_ `F8`
- [x] `F10` Keep interaction and memory bounded: dirty-patch/history storage instead of matte
  snapshots, no changing full-resolution typed-array React props, no inference during pointer
  movement, explicit cancellation/disposal on source change/reset/unmount, and no concurrent
  automatic/SlimSAM/ViTMatte heavy inference — _Depends on:_ `F5`, `F8`
- [x] `F11` Add focused unit/component/hook tests for constraint consolidation, 32-point session
  cap and label balance, direct green validation, dirty/recompute transitions, raw-score handling,
  intent ranking, alternative collapse, local difference measurement, outside-region byte
  preservation, hard-constraint precedence, stale responses, lifecycle cleanup, accessibility, and
  selective legacy deprecation — _Depends on:_ `F2`–`F10`
- [x] `F12` Add localized deterministic Playwright coverage across the configured Chromium,
  Firefox, WebKit, and Mobile Safari projects for direct and automatic-result entry: paint both
  modes, resize the brush, undo/redo/clear without implicit inference, explicitly recompute, switch
  a visually distinct candidate, handle collapsed alternatives, accept, and continue through
  matting/cleanup/exact brush/background/download. Assert stale responses cannot replace newer
  markings and no SlimSAM score/unavailable copy appears — _Depends on:_ `F11`

### Infra

- [x] `I1` Add a host-only serialized `pnpm e2e:phase-21-real` check and
  `docs/PHASE_21_RUNTIME_EVIDENCE.md`. Exercise the actual available SlimSAM/WASM path with green
  and red brush-derived prompts, confirm the total prompt bound, candidate lifecycle, direct/base
  flows, explicit-recompute behavior, and continuation to the result pipeline. Record only runtime
  path, counts, classified failures, timings, and pass/fail observations; keep it out of Docker/CI
  and persist no image, filename, coordinate, stroke, mask, or candidate data — _Depends on:_
  `F2`–`F12`

<!-- No Backend or Data group: Phase 21 adds no custom API, database, persistence, model, route,
     analytics payload, or environment variable. -->

<!-- Test execution is governed by `## Gate Checks` below + docs/STACK.md § Gate Commands. -->

---

## Files

### Create / modify

~~~
src/features/select-object/index.ts
src/features/select-object/model/types.ts
src/features/select-object/model/guided-brush-session.ts
src/features/select-object/model/guided-brush-session.test.ts
src/features/select-object/model/guided-brush-sampling.ts
src/features/select-object/model/guided-brush-sampling.test.ts
src/features/select-object/model/candidate-ranking.ts
src/features/select-object/model/candidate-ranking.test.ts
src/features/select-object/model/guided-fusion.ts
src/features/select-object/model/guided-fusion.test.ts
src/features/select-object/model/refinement-constraints.ts
src/features/select-object/model/refinement-constraints.test.ts
src/features/select-object/model/use-object-selection.ts
src/features/select-object/model/use-object-selection.test.ts
src/features/select-object/worker/select-object.worker.ts
src/features/select-object/ui/GuidedBrushCanvas.tsx
src/features/select-object/ui/GuidedBrushCanvas.test.tsx
src/features/select-object/ui/GuidedBrushControls.tsx
src/features/select-object/ui/GuidedBrushControls.test.tsx
src/features/select-object/ui/ObjectSelectionCanvas.tsx
src/features/select-object/ui/ObjectSelectionCanvas.test.tsx
src/features/select-object/ui/ObjectSelectionControls.tsx
src/features/select-object/ui/ObjectSelectionControls.test.tsx
src/widgets/tool-workspace/lib/describe-state.ts
src/widgets/tool-workspace/ui/ToolWorkspace.tsx
src/widgets/tool-workspace/ui/ToolWorkspace.test.tsx
messages/ru.json
messages/en.json
e2e/support/mock-inference.ts
e2e/brush-guided-correction.spec.ts
e2e/phase-21.real.spec.ts
playwright.config.ts
package.json
scripts/run-e2e.ts
docs/PHASE_21_RUNTIME_EVIDENCE.md
docs/STACK.md
docs/PHASE_21.md
docs/STATE.md
~~~

### Do NOT touch

- Delete or rewrite Phase-17 point/box/manual-layer source, tests, or runtime evidence; legacy UI
  files may receive deprecation annotations and compatibility assertions only
- Production model IDs/revisions/dtypes, `models.manifest.json`, `deploy/model-assets/`, CDN sync,
  or Service Worker caching; Phase 21 adds no model asset
- `features/correct-mask` brush algorithms, ViTMatte variant/fallback policy, or foreground-cleanup
  algorithms; consume their existing public contracts
- Public routes, SEO/scenario content/assets, sitemap, server endpoints, accounts, payments,
  analytics events/payloads, persistence, or diagnostic/support ingestion
- CI or Docker wiring for Playwright; deterministic and real-model browser checks remain host-only
- `docs/SPEC.md` during implementation unless the architect explicitly changes the contract again

---

## Contracts

> This section is the source of truth for `/context-update`.

### New persistent data (tables / collections / files)

No database, server-side state, or browser-persistent user data. `GuidedBrushSession`, strokes,
constraint maps, sampled points, candidates, mattes, embeddings, and histories live only in the
current browser tab and are released on reset/source change/unmount.

`docs/PHASE_21_RUNTIME_EVIDENCE.md` is the only new persistent evidence file. It contains image-free
runtime path, bounded counts, classified failures, timings, and pass/fail observations only.

### New API endpoints / RPC methods / events

None. Phase 21 reuses the existing browser-local SlimSAM worker and static pinned model-asset
contract. It adds no route, server endpoint, external RPC, analytics event, or image upload.

The worker continues to receive a bounded point/label prompt and echo a monotonic revision. Brush
strokes and full constraint maps remain outside the worker/model boundary; source pixels,
embeddings, prompt coordinates, candidates, and masks never leave the browser.

### New types / models / shared interfaces

```ts
type GuidedBrushMode = "keep" | "remove";
type GuidedBrushStatus =
  | "idle"
  | "loading-model"
  | "encoding-image"
  | "ready"
  | "dirty"
  | "predicting"
  | "preview"
  | "error";

interface GuidedBrushStroke {
  id: string;
  mode: GuidedBrushMode;
  points: readonly { x: number; y: number }[];
  radius: number;
}

interface GuidedBrushCandidate {
  id: string;
  matte: AlphaMatte;
  modelRankScore: number | null;
  intentScore: number;
  differenceRatio: number;
}

interface GuidedBrushSession {
  source: SourceImage;
  baseMatte: AlphaMatte | null;
  strokes: readonly GuidedBrushStroke[];
  brushRadius: number;
  status: GuidedBrushStatus;
  revision: number;
  computedRevision: number | null;
  editRegion: PixelRect | null;
  candidates: readonly GuidedBrushCandidate[];
  selectedCandidateId: string | null;
  history: readonly GuidedBrushStroke[];
  redo: readonly GuidedBrushStroke[];
}
```

Invariants:

- Brush opacity is visual only; covered pixels are binary semantic intent.
- The whole session yields at most `32` prompt points, balanced across available labels.
- Painting/history/size changes never run inference; only explicit recompute does.
- Candidate ranking is intent-first; a finite raw model score is internal-only and never a
  percentage. Missing/invalid scores never produce user-facing unavailable copy.
- Alternatives with local `differenceRatio < 0.001` (0.1%) collapse.
- With an automatic base, pixels outside the brush-derived edit region are byte-identical.
- Hard keep/remove constraints apply after model output and always win.
- The pinned decoder has no previous-mask input; continuity is deterministic local fusion.

### New env vars

None. Reuse the existing `VITE_MODEL_CDN_BASE_URL`, SlimSAM pin, and CDN/upstream fallback.

---

## Gate Checks

Run `/phase-gate 21` only after all Scope items are checked and architect review notes are resolved.
Standard commands come from `docs/STACK.md`, plus focused implementation checks:

```bash
pnpm generate:code
pnpm vitest run src/features/select-object src/widgets/tool-workspace
pnpm e2e e2e/brush-guided-correction.spec.ts
pnpm e2e:phase-21-real
pnpm tsc --noEmit
pnpm exec steiger ./src
```

The deterministic Playwright flow must cover both locales and every configured browser project.
The real-model check is host-only and serialized; it may claim only the actual path exercised and
must remain outside Docker and CI. The standard container-network smoke is sufficient because Phase
21 adds no route or external API.

Phase 21 may not close if the primary UI still exposes points/boxes/manual layers, a user-facing
SlimSAM score or unavailable message remains, prompt count grows per stroke, brush width disagrees
with constraint coverage, inference runs implicitly, stale candidates can win, automatic-base
pixels change outside the edit region, legacy source is deleted, or the downstream result pipeline
regresses.

---

## Architect Review Notes

Use this section after manual product/UX verification. Resolve unchecked items through
`/impl-assist 21 review`.

- [x] Make the visible brush geometrically round at every source/display aspect ratio, improve its
  cursor treatment, and add a live physical-size preview beside the size slider.
- [x] Replace the three competing candidate cards with an automatically selected best result in the
  main preview. Keep only materially distinct alternatives behind compact previous/next result
  navigation, describe their actual contour relationship, and replace the blue mask wash with a
  neutral result treatment that does not mix with green/red markings.
- [x] Explain the bounded interaction contract in the bilingual UI: visible stroke usage, session
  limit, automatic point simplification, and the fixed 32-prompt inference cap.
- [x] Audit the guided editor after the UX changes for render loops, hot-path React work, unbounded
  stroke/point growth, stale full-overlay redraws, worker disposal races, and retained browser
  memory; fix verified issues and add regression coverage.
- [x] Replace the marks-obscured result overlay with a responsive split preview: keep the editable
  source and all visible semantic strokes in a `Markings` pane, render the actual alpha result
  without strokes on a checkerboard in a `Result` pane, use persistent accessible
  `Markings`/`Result` tabs on narrow screens, and mark the last result stale while newer markings
  await explicit recompute. Candidate navigation updates only the clean result pane. Add an
  explicit `Continue from this result` action that promotes the current result to the new base and
  starts an empty bounded marking pass; never clear or hide active constraints implicitly.
- [x] Make automatic-result guidance visually operate on the processed base while retaining the
  original source only as the model/coordinate authority and recoverable context: show kept base
  pixels normally and automatically removed source pixels as a clearly explained dim ghost beneath
  the semantic strokes, keep direct guidance on the full original, preserve any source-sized
  foreground colour layer in the clean result preview, and update the editable base only after
  explicit `Continue from this result`. Replace the overflowing image/invisible-layout-ruler
  treatment with one shared source-aspect frame for both panes, let guided mode span the full
  workspace before splitting into desktop panes, cache gesture geometry off the pointer-move hot
  path, and add portrait/landscape automatic-flow browser coverage that asserts matching,
  undistorted pane geometry across desktop and mobile.
- [x] Remove the visible brush jump on primary-pointer press by keeping hover, press, and captured
  gesture coordinates on one stable surface rectangle without native focus scrolling; align the
  editable and clean-result frames to the same desktop grid row despite different explanatory-copy
  heights. Make automatic-base correction intentionally local: replace the candidate only inside
  the union of stroke-shaped influence zones rather than the bounding rectangle across all
  markings, keep hard brush intent authoritative, and preserve every base-matte byte outside those
  local zones. Add component/browser geometry coverage and focused fusion tests for separated
  strokes so a small `Remove`/`Keep` marking cannot trigger an unrelated large-area change.
- [x] Make automatic-base guidance tolerant of imprecise strokes by turning the visible brush into
  a two-zone semantic control: use only a clearly rendered inner core (target: 30–40% of the
  selected radius, to be validated in browser) for hard keep/remove constraints and model prompt
  anchors, while the full translucent radius defines the local candidate-influence zone. Sample
  prompts from the stroke centreline rather than every covered disk pixel, keep the automatic base
  unchanged outside the outer zone, and rank candidates by core intent plus local base continuity.
  Explain the inner-core/outer-halo contract bilingually and add boundary-crossing browser tests
  proving that an accidental halo overlap cannot force foreground removal or background retention.
  Edge-aware boundary snapping, graph-cut/geodesic/bilateral refinement, and additional interactive
  correction models are explicitly out of scope for this phase and future phases unless the
  architect explicitly reopens them; do not prototype them or add related dependencies, assets, or
  runtime paths as part of this review.
- [x] Complete the final lifecycle/performance audit: guard guided-entry and result-application
  promises with monotonic run tokens so reset, cancel, batch switching, or batch clearing cannot
  resurrect stale work; cancel and dispose a batch-guided session when its item leaves scope;
  disable guided interaction while the accepted matte is being recomposited and surface a
  retryable application error in the guided view. Treat malformed candidate payloads and
  `messageerror` as recoverable worker failures instead of uncaught/stuck prediction, and coalesce
  resize-driven canvas paints to one animation frame. Add hook/component/workspace regressions for
  the verified failure paths.

---

## Implementation Notes

- Rejected automatic stroke clearing after recompute because it would either discard the visible
  constraints or preserve them invisibly. The split preview keeps every active marking visible;
  only the explicit `Continue from this result` action promotes the fused result to the next base
  and starts an empty marking pass without another model run.
- Kept the original source as SlimSAM's input and coordinate authority instead of feeding it the
  transparent cutout: the model must still see automatically removed pixels for a later `Keep`
  stroke to restore them. The processed matte is the visual/session base, removed source pixels are
  shown only as dim editing context, and a source-sized cleaned foreground blob is used solely as
  the clean preview's colour layer when available.
- Automatic-base fusion now treats each semantic stroke as a compact local trust zone instead of
  trusting the model throughout the bounding rectangle across all strokes. The selected brush
  radius is the outer tolerance zone; only its 35% inner core is a hard constraint and prompt
  anchor. Direct guidance still uses a source-sized model candidate because it has no accepted base
  to preserve; exact unrestricted pixel editing remains available later in the existing
  mask-editor step.
- Advanced interactive boundary algorithms are deliberately deferred by the architect. Phase 21
  adds no edge-aware snapping, graph cut, geodesic propagation, bilateral solver, extra model, or
  exploratory runtime/dependency path.

---

## Atomic Commit Message

```text
feat(phase-21): simplify guided correction with semantic brush
```

---

## Post-Phase Checklist

- [x] All Scope checkboxes checked (or deferred in Architect Review Notes)
- [x] All automated gate checks green
- [x] All architect review notes resolved
- [x] `docs/STATE.md` updated — run `/context-update 21`
- [x] Committed atomically on `feat/phase-21` branch
- [x] Tag created after merge to `main`: `git tag -a v0.21.0 -m "Phase 21: Brush-Guided Object Correction"`
