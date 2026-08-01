# PHASE 17 — Iterative Guided Object Editor

<!-- TOKEN BUDGET: keep this file under 10,000 tokens. Be concise. -->

## Phase Metadata

| Field | Value |
|-------|-------|
| Phase | `17` |
| Title | Iterative Guided Object Editor |
| Status | `✅ done` |
| Tag | `v0.17.0` |
| Depends on | PHASE_16 gate passing |

---

## Phase Goal

Turn Phase 16's one-shot SlimSAM point-or-box selection into a predictable, iterative object editor
without introducing another model. A user can refine object intent with cumulative positive and
negative points, a target box, semantic keep/remove strokes, multiple object layers, alternative
mask candidates, and prompt undo/redo before continuing through the existing exact pixel-brush,
background, and download flow (SPEC.md §2.2, §5.2–§5.4, §7.1, §7.3, §7.7, §8).

No design assets were provided for this phase; the interaction contract comes from SPEC.md.

---

## Scope

### Frontend

- [x] `F1` Extend `features/select-object` with a typed, in-memory `PromptSession`: stable object
  layer IDs, cumulative positive/negative points, one target box per layer, semantic keep/remove
  strokes, selected mask candidate, active layer, and bounded prompt-action undo/redo. History must
  store prompt/delta data rather than full-resolution matte snapshots — _Depends on:_ —
- [x] `F2` Add pure prompt-session operations for adding/removing/selecting object layers,
  appending completed point/box/stroke gestures, selecting alternatives, undo/redo, and resetting
  one layer or the full session without leaking state across source images — _Depends on:_ `F1`
- [x] `F3` Extend the SlimSAM worker protocol for cumulative positive/negative point batches plus a
  target box, return the available alternative candidates and scores, reuse the Phase-16 image
  embedding, accept a previous local mask when supported by the pinned graph, and echo a monotonic
  request revision so stale/superseded results can never update the visible session — _Depends on:_
  `F1`, `F2`
- [x] `F4` Implement semantic keep/remove stroke sampling and deterministic guided fusion: strokes
  become bounded prompt samples and source-sized hard-constraint patches; accepted object-layer
  masks are unioned; local progressive updates merge into the previous mask/base automatic
  `AlphaMatte` without replacing unrelated regions; explicit keep/remove constraints always win —
  _Depends on:_ `F2`, `F3`
- [x] `F5` Evolve `useObjectSelection` into the session orchestrator: latest-request-wins revision
  handling, completed-gesture inference only, candidate/layer lifecycle, prompt undo/redo, retry,
  cancel/reset, and release of stale masks/embeddings/object URLs while preserving the existing
  lazy model load and one-heavy-operation-at-a-time invariant — _Depends on:_ `F2`, `F3`, `F4`
- [x] `F6` Replace the one-shot canvas controls with an accessible iterative editor: positive and
  negative point tools, target box, keep/remove semantic strokes, visible accumulated prompts,
  layer add/select/remove controls, alternative-candidate chooser, undo/redo, replace/retry/cancel
  actions, localized status/error announcements, and pointer/keyboard coordinate mapping that stays
  correct across responsive layouts — _Depends on:_ `F5`
- [x] `F7` Integrate `guiding` into `widgets/tool-workspace` from either an existing automatic
  result or direct guided entry. Preserve the current automatic matte as the fusion base, accept the
  unioned guided result into the existing pixel-brush editor, and retain correction → result →
  background replacement → individual/ZIP download behavior without a new route or parallel state
  machine — _Depends on:_ `F4`, `F5`, `F6`
- [x] `F8` Keep interactive work bounded and responsive: compact constraint buffers and dirty
  patches, bounded prompt history, no inference during pointer movement, no changing
  full-resolution typed-array props through React, cancellation/ignoring of superseded revisions,
  and explicit cleanup when changing source, leaving guiding, or resetting — _Depends on:_ `F4`,
  `F5`, `F7`
- [x] `F9` Add focused unit/component/integration coverage for prompt-session transitions,
  positive/negative encoding, stroke sampling and hard constraints, candidate selection, layer
  union, deterministic fusion, undo/redo, responsive/keyboard input, stale revision rejection,
  cleanup, and continuation into correction/download — _Depends on:_ `F2`, `F3`, `F4`, `F5`,
  `F6`, `F7`, `F8`
- [x] `F10` Add localized Playwright coverage starting from both automatic and direct guided flows:
  combine positive/negative points with a box and keep/remove strokes, undo/redo prompts, switch
  candidates, create and union multiple object layers, prove stale worker results are ignored, then
  complete pixel correction and download across the configured browser projects. Add the missing
  desktop Firefox project required by SPEC.md §7.4 while retaining Chromium, WebKit, and mobile
  WebKit coverage — _Depends on:_ `F9`

### Infra

- [x] `I1` Add a host-only serialized Phase-17 real-model Playwright command and image-free runtime
  evidence report covering cumulative SlimSAM prompts, alternative candidates, latest-revision
  behavior, and continuation into the existing correction flow. Keep it out of Docker and CI; add
  no model asset because Phase 17 reuses the pinned Phase-16 SlimSAM revision — _Depends on:_ `F3`,
  `F7`, `F9`

<!-- No Backend or Data group: Phase 17 adds no custom API, database, persistence, model, or
     analytics payload. All source pixels, prompts, strokes, masks, candidates, and embeddings stay
     inside the current browser session (SPEC.md §1.1, §3, §4, §7.2). -->

<!-- Test execution is governed by `## Gate Checks` below + docs/STACK.md § Gate Commands. -->

---

## Files

### Create / modify

~~~
src/features/select-object/index.ts
src/features/select-object/model/types.ts
src/features/select-object/model/prompt-session.ts
src/features/select-object/model/prompt-session.test.ts
src/features/select-object/model/semantic-stroke.ts
src/features/select-object/model/semantic-stroke.test.ts
src/features/select-object/model/guided-fusion.ts
src/features/select-object/model/guided-fusion.test.ts
src/features/select-object/model/prompt-coordinates.ts
src/features/select-object/model/prompt-coordinates.test.ts
src/features/select-object/model/use-object-selection.ts
src/features/select-object/model/use-object-selection.test.ts
src/features/select-object/worker/select-object.worker.ts
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
e2e/iterative-guidance.spec.ts
e2e/phase-17.real.spec.ts
playwright.config.ts
package.json
docs/PHASE_17_RUNTIME_EVIDENCE.md
docs/STACK.md
docs/PHASE_17.md
docs/STATE.md
~~~

### Do NOT touch

- `docs/SPEC.md` or completed Phase-15/16 decision and model-evaluation evidence
- `features/model-lab` or the Phase-18 matting-candidate evaluation scope
- `features/refine-matte` / `features/refine-foreground` — Phases 18–20
- `models.manifest.json`, model pins, CDN sync, or Service Worker caching — no new model this phase
- `features/correct-mask` internals — consume its existing exact-editor public API after guidance
- Server routes that accept images, product persistence, accounts, payments, diagnostic reporting,
  support storage, or new analytics events/payloads
- CI or Docker wiring for Playwright; browser E2E and real-model checks remain host-only
- Unrelated public/scenario content or visual redesign outside the guided-editor controls

---

## Contracts

> This section is the source of truth for `/context-update`.

### New persistent data (tables / collections / files)

No server-side or browser-persistent user data. `PromptSession`, semantic constraints, candidates,
object masks, SlimSAM embeddings, and undo/redo history are session-only and are discarded when the
source changes, guidance is reset, or the tab reloads. No prompt, mask, filename, pixel, or
image-derived value enters `localStorage`, analytics, logs, or the runtime evidence report.

`docs/PHASE_17_RUNTIME_EVIDENCE.md` records only browser/runtime path, prompt/candidate lifecycle,
classified failures, timings, and pass/fail observations; it contains no source/result images,
filenames, prompt coordinates, masks, or other image-derived data.

### New API endpoints / RPC methods / events

None. Phase 17 adds no route, server endpoint, analytics event, public model asset, or external RPC.

The existing browser-local SlimSAM worker protocol expands with encode/session-prompt/reset
messages carrying a monotonic revision. Worker responses echo that revision and may return multiple
mask candidates with scores. Source pixels, embeddings, prompts, constraint patches, candidates,
and mattes never leave the browser.

### New types / models / shared interfaces

```ts
type PromptPointLabel = 0 | 1; // 0 = exclude/background, 1 = include/foreground

interface GuidedPoint {
  id: string;
  x: number; // normalized source-image coordinate, 0..1
  y: number; // normalized source-image coordinate, 0..1
  label: PromptPointLabel;
}

interface GuidedBox {
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
}

type SemanticStrokeMode = "keep" | "remove";

interface SemanticStroke {
  id: string;
  mode: SemanticStrokeMode;
  points: readonly { x: number; y: number }[]; // normalized source coordinates
  radius: number; // source-image pixels
}

interface GuidedMaskCandidate {
  id: string;
  matte: AlphaMatte;
  score: number | null; // null when SlimSAM returns a non-finite/out-of-range estimate
  differenceRatio: number; // 0..1 pixel difference from the recommended candidate
}

interface ObjectMaskLayer {
  id: string;
  points: readonly GuidedPoint[];
  targetBox: GuidedBox | null;
  strokes: readonly SemanticStroke[];
  candidates: readonly GuidedMaskCandidate[];
  selectedCandidateId: string | null;
  acceptedMatte: AlphaMatte | null;
}

interface PromptSession {
  source: SourceImage;
  baseMatte: AlphaMatte | null; // existing automatic/guided result, preserved for fusion
  layers: readonly ObjectMaskLayer[];
  activeLayerId: string;
  revision: number; // incremented for every superseding inference request
  history: readonly PromptHistoryEntry[]; // bounded prompt/delta entries, never full matte snapshots
  redo: readonly PromptHistoryEntry[];
}

type PromptHistoryEntry =
  | { type: "point-added"; layerId: string; point: GuidedPoint }
  | { type: "box-changed"; layerId: string; before: GuidedBox | null; after: GuidedBox | null }
  | { type: "stroke-added"; layerId: string; stroke: SemanticStroke }
  | {
      type: "candidate-selected";
      layerId: string;
      beforeId: string | null;
      afterId: string | null;
    }
  | { type: "layer-added"; layerId: string }
  | {
      type: "layer-removed";
      layerId: string;
      promptData: {
        points: readonly GuidedPoint[];
        targetBox: GuidedBox | null;
        strokes: readonly SemanticStroke[];
        selectedCandidateId: string | null;
      };
      index: number;
    }
  | { type: "layer-selected"; beforeId: string; afterId: string };

type IterativeSelectionPrompt = {
  revision: number;
  points: readonly GuidedPoint[];
  box: GuidedBox | null;
  previousMask: AlphaMatte | null;
};

type IterativeSelectionWorkerResponse =
  | { type: "status"; revision: number; status: ObjectSelectionStatus; progress?: number }
  | { type: "candidates"; revision: number; candidates: GuidedMaskCandidate[] }
  | { type: "error"; revision: number; message: string };
```

`PromptHistoryEntry` stores prompt/action deltas only. In particular, undoing a removed layer
restores its compact prompt data and recomputes candidates when needed; history never retains a
source-sized candidate or accepted-matte snapshot.

Fusion invariant: explicit keep/remove constraints override every model/base value; accepted
object-layer masks are unioned; a local progressive update cannot replace pixels outside its target
region; the selected automatic `AlphaMatte` remains the base where no accepted guided intent
overrides it. The resulting source-sized `AlphaMatte` feeds the existing pixel brush unchanged.

### New env vars

None. Phase 17 reuses `VITE_MODEL_CDN_BASE_URL` and the immutable Phase-16 SlimSAM q8 asset; it adds
no runtime configuration key.

---

## Gate Checks

Run `/phase-gate 17` before committing. Standard commands come from `docs/STACK.md`, plus focused
implementation checks:

```bash
pnpm generate:code
pnpm vitest run src/features/select-object src/widgets/tool-workspace
pnpm e2e e2e/iterative-guidance.spec.ts
pnpm e2e:phase-17-real
pnpm tsc --noEmit
pnpm exec steiger ./src
```

`pnpm e2e:phase-17-real` is host-only and serialized; never run it in Docker or CI. Record only the
available host's actual runtime path and the non-image evidence permitted by the Contracts section.
Phase 17 may close locally after the configured cross-browser suite, focused tests, available-host
real-model smoke, standard Phase Gate, and architect review all pass; no physical-device inventory,
push, or deployment is required.

The default container-network smoke is sufficient because Phase 17 adds no route or server
endpoint.

---

## Architect Review Notes

Use this section after manual product, UX, API, or workflow verification. Add one unchecked item per
issue and resolve it through `/impl-assist 17 review` before the phase closes.

- [x] When entering guided refinement from an existing automatic result, keep the source preview
  reliably visible: fix the revoked blob-URL lifecycle shown by the broken image/alt-text state,
  cover React effect remount/cleanup, and add an automatic-result → guidance browser regression.
- [x] Make mask alternatives understandable and robust: never render `NaN`; sanitize invalid model
  scores without inventing confidence, label finite values as SlimSAM's estimated mask quality
  rather than accuracy, explain that visual judgment wins, restore a clear legend for the blue
  kept-area overlay, and make candidate changes visibly/semantically observable where masks differ.
- [x] Explain object layers in the editor: each layer represents one object with its own prompts and
  selected mask, while accepted layer masks are combined in the final kept area. Make active-layer
  and add/select behavior understandable without prior knowledge.
- [x] Distinguish destructive layer removal from resetting the active object: removal deletes the
  entire object layer, while reset keeps the layer and clears only its prompts/candidate. Improve
  labels/help and accessible names so the consequence is clear before activation.
- [x] Add prompt-history keyboard shortcuts while the guided editor is active: Ctrl/Cmd+Z for undo,
  Ctrl/Cmd+Shift+Z and Ctrl/Cmd+Y for redo, without hijacking editable controls; localize accessible
  shortcut guidance and cover keyboard behavior in component and Playwright tests.

---

## Implementation Notes

- The pinned SlimSAM split decoder does not declare previous-mask inputs. The worker accepts the
  protocol field but leaves it model-side unused; deterministic target-region fusion preserves
  progressive continuity without inventing unsupported graph inputs.
- The final gate repeat encountered a Hugging Face 503/504 outage after the same available-host
  SlimSAM smoke had passed and been recorded earlier that day. The architect explicitly accepted
  the recorded real-model evidence plus the green container, deterministic cross-browser, focused,
  and production-CDN IS-Net checks as sufficient to close locally; no deploy/model sync was used.

---

## Atomic Commit Message

```
feat(phase-17): add iterative guided object editing
```

---

## Post-Phase Checklist

- [x] All Scope checkboxes checked (or deferred in Architect Review Notes)
- [x] All automated gate checks green or explicitly accepted by the architect
- [x] All architect review notes resolved
- [x] `docs/STATE.md` updated — run `/context-update 17`
- [x] Committed atomically on `feat/phase-17` branch
- [x] Tag created after local merge to `main`: `git tag -a v0.17.0 -m "Phase 17: Iterative Guided Object Editor"`
