# PHASE 26 — Editor Document Foundation & Guided Reset

<!-- TOKEN BUDGET: keep this file under 10,000 tokens. Be concise. -->

## Phase Metadata

| Field | Value |
|-------|-------|
| Phase | `26` |
| Title | Editor Document Foundation & Guided Reset |
| Status | `⏳ pending` |
| Tag | `v0.26.0` |
| Depends on | PHASE_25 gate passing |

---

## Phase Goal

Create the bounded browser-memory document, artifact ownership, and committed-history foundation
for both a single image and every completed batch item, required by the Phase-27–31 editor redesign
without visually rebuilding the product yet. Extract
orchestration from the current monolithic workspace and fix the reported Magic-brush regression:
after a computed result, removing the last remaining mark over an existing base must restore that
base without another SlimSAM call or a permanently disabled action (SPEC.md §2.2, §3, §5.2–§5.3,
§7.1, §7.3, §7.7, §8).

---

## Scope

### Frontend

- [ ] `F1` Add `entities/edit-document` pure contracts for document identity, immutable automatic
  baseline/current artifact references, subject matte/foreground, background, composite,
  processing provenance, and monotonic revision. A successful single upload and each successful
  `BatchItem` own exactly one independent document scope; queued/processing/error items do not
  allocate one early. Do not add persistence, serialization, generic layers, transforms, shadows,
  perspective, or effects — _Depends on:_ —
- [ ] `F2` Add an artifact store owning mattes/blobs/object URLs by opaque ID, tracking estimated
  unique bytes and reachability from current/baseline/history snapshots. Release unreachable
  resources on eviction, branch-after-undo, document reset/removal, and unmount — _Depends on:_ `F1`
- [ ] `F3` Add `features/editor-history` with labeled atomic commit/undo/redo. Bound history to 20
  entries and 96 MiB of retained historical artifacts; when one undo step alone exceeds the byte
  budget, retain only that latest step. Current-document artifacts are not counted as avoidable
  history, and a failed/stale/cancelled async action creates no entry — _Depends on:_ `F1`, `F2`
- [ ] `F4` Define the history boundary: committed document mutations use `EditHistory`; active
  Magic/Manual strokes remain bounded tool drafts. Expose selectors for `canUndo`, `canRedo`, and
  localized next-action labels without adding the Phase-27 toolbar yet — _Depends on:_ `F3`
- [ ] `F5` Extract a `useToolWorkspaceController` orchestration module from
  `ToolWorkspace.tsx`: source/result adoption, worker lifecycle, refinement targets, background
  application, correction entry/exit, reset, and stale-run guards move behind a typed interface.
  Keep the current rendered UX materially unchanged and preserve feature public-API boundaries —
  _Depends on:_ `F1`–`F4`
- [ ] `F6` Add the base-backed zero-mark transition to guided brush state/hook logic. If undo/clear
  removes the final stroke after a computed result and `baseMatte` exists, explicit recompute/apply
  restores the base locally, invalidates stale candidates, advances the revision coherently, and
  sends no worker request. A direct session with no base still requires green `keep` intent —
  _Depends on:_ `F5`
- [ ] `F7` Keep current candidate/Continue UI operational until Phase 28, but make its action state
  reflect `F6` so manual testing can no longer reproduce the disabled-action trap. Add a
  plain-language accessible label for the local reset path if copy is needed — _Depends on:_ `F6`
- [ ] `F8` Add unit/hook/component tests for artifact reachability, byte/count eviction,
  branch-after-undo cleanup, operation labels, failed/stale exclusion, controller reset/source
  replacement, zero-mark base restoration, no-worker-call proof, and direct no-base validation —
  _Depends on:_ `F2`–`F7`
- [ ] `F9` Extend Playwright coverage for automatic-result Magic correction: add a stroke,
  recompute, undo/clear until no strokes remain, trigger the action, verify the base result returns,
  and assert no additional mocked inference post was made. Cover reset/source replacement cleanup
  in both the single-image flow and a selected completed batch item without changing the broad
  Phase-21 visual flow — _Depends on:_ `F8`
- [ ] `F10` Add batch lifecycle tests proving item selection/reordering cannot share document,
  artifact, history, revision, or worker ownership and that removal/clear releases only the target
  item's resources. Keep the current batch presentation unchanged — _Depends on:_ `F1`–`F9`

### Infra

- [ ] `I1` Keep Phase 26 free of new packages, model assets, runtime evidence commands, routes,
  env vars, analytics payloads, persistence, and server work. Run the existing real-model smoke
  only through the normal phase gate because the SlimSAM graph/protocol itself is unchanged —
  _Depends on:_ `F10`

---

## Files

### Create / modify

~~~
src/entities/edit-document/model/types.ts
src/entities/edit-document/model/edit-document.ts
src/entities/edit-document/model/edit-document.test.ts
src/entities/edit-document/model/artifact-store.ts
src/entities/edit-document/model/artifact-store.test.ts
src/entities/edit-document/index.ts
src/features/editor-history/model/editor-history.ts
src/features/editor-history/model/editor-history.test.ts
src/features/editor-history/model/use-editor-history.ts
src/features/editor-history/model/use-editor-history.test.ts
src/features/editor-history/index.ts
src/features/batch-processing/model/types.ts
src/features/batch-processing/model/use-batch-processing.ts
src/features/batch-processing/model/*.test.ts
src/features/select-object/model/guided-brush-session.ts
src/features/select-object/model/guided-brush-session.test.ts
src/features/select-object/model/use-object-selection.ts
src/features/select-object/model/use-object-selection.test.ts
src/features/select-object/ui/GuidedBrushControls.tsx
src/features/select-object/ui/GuidedBrushControls.test.tsx
src/widgets/tool-workspace/model/use-tool-workspace-controller.ts
src/widgets/tool-workspace/model/use-tool-workspace-controller.test.ts
src/widgets/tool-workspace/ui/ToolWorkspace.tsx
src/widgets/tool-workspace/ui/ToolWorkspace.test.tsx
src/widgets/tool-workspace/index.ts
messages/ru.json
messages/en.json
e2e/brush-guided-correction.spec.ts
docs/PHASE_26.md
~~~

### Do NOT touch

- Phase-27 toolbar/layout, automatic-mode naming, or removal of public technical copy
- Candidate ranking/fusion algorithms, model IDs/revisions/assets, matting/foreground algorithms
- Batch visual redesign or batch-wide editing; Phase 26 only establishes per-item document ownership
- Routes, SEO content, analytics, server endpoints, accounts, persistence, or future Studio features

---

## Contracts

### New persistent data (tables / collections / files)

None. Documents, artifacts, histories, and drafts are browser-tab memory only. No IndexedDB,
localStorage, Cache Storage user data, history export, or server persistence is added.

### New API endpoints / RPC methods / events

None. The zero-mark reset is local and must send no SlimSAM worker request.

### New types / models / shared interfaces

```ts
type EditorArtifactId = string;
type EditOperationKind = "cutout" | "manual" | "enhance" | "background";

interface EditDocumentSnapshot {
  alphaMatte: EditorArtifactId;
  foreground: EditorArtifactId | null;
  composite: EditorArtifactId;
  backgroundFill: BackgroundFill;
  processingMode: AutomaticModelMode;
}

interface EditDocument {
  id: string;
  source: SourceImage;
  baseline: Readonly<EditDocumentSnapshot>;
  current: Readonly<EditDocumentSnapshot>;
  revision: number;
}

interface EditOperation {
  id: string;
  kind: EditOperationKind;
  label: string;
  before: Readonly<EditDocumentSnapshot>;
  after: Readonly<EditDocumentSnapshot>;
  estimatedHistoricalBytes: number;
}

interface EditHistory {
  past: readonly EditOperation[];
  future: readonly EditOperation[];
  retainedHistoricalBytes: number;
}
```

Invariants: history has at most 20 entries and 96 MiB of avoidable retained artifacts; current and
baseline stay reachable; eviction/reset releases unreachable resources; tool drafts are not
committed operations; async results commit only if their document/run revision is still current.

### New env vars

None.

---

## Gate Checks

Run `/phase-gate 26` after all Scope items and review notes are resolved. In addition to the
standard `docs/STACK.md` commands:

```bash
pnpm vitest run src/entities/edit-document src/features/editor-history \
  src/features/select-object src/widgets/tool-workspace
pnpm e2e e2e/brush-guided-correction.spec.ts e2e/home.spec.ts
pnpm tsc --noEmit
pnpm exec steiger ./src
```

Phase 26 cannot close if the final-stroke flow remains disabled, a zero-mark base reset posts to
SlimSAM, single/batch documents share ownership, current/baseline artifacts can be evicted,
failed/stale work enters history, object URLs leak after reset/eviction, or `ToolWorkspace.tsx`
still owns the extracted orchestration state.

---

## Architect Review Notes

- [x] No architect review issues recorded

---

## Implementation Notes

None

---

## Atomic Commit Message

```text
refactor(phase-26): add editor document history and guided reset
```

---

## Post-Phase Checklist

- [ ] All Scope checkboxes checked
- [ ] All automated gate checks green
- [ ] All architect review notes resolved
- [ ] `docs/STATE.md` updated — run `/context-update 26`
- [ ] Committed atomically on `feat/phase-26`
- [ ] Tag created after merge: `v0.26.0`
