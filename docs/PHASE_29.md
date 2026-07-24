# PHASE 29 — Enhancements Tool & Committed History

## Phase Metadata

| Field | Value |
|-------|-------|
| Phase | `29` |
| Title | Enhancements Tool & Committed History |
| Status | `⏳ pending` |
| Tag | `v0.29.0` |
| Depends on | PHASE_28 gate passing |

---

## Phase Goal

Replace the separate technical matting and foreground-cleanup panels with one user-facing
`Улучшения` / `Enhancements` tool, and complete document-level undo/redo for applied Cutout,
Manual, and Enhance changes. The grouping and typed operation registry must accept later optional
model-based or deterministic result improvements without renaming the tool or exposing
implementation. The same contract applies to a single image and a selected completed batch item
(SPEC.md §5.3–§5.4, §7.1, §7.3, §7.7, §8).

---

## Scope

### Frontend

- [ ] `F1` Add one `Улучшения` / `Enhancements` panel with two benefit-labeled operations:
  `Улучшить мелкие детали/Improve fine details` (soft alpha for hair, fur, glass) and
  `Убрать цветной ореол/Remove colour halo` (foreground decontamination). Default the safe,
  capability-recommended combination without showing a model selector. Bind it through the shared
  editor controller for a single document or selected completed batch document — _Depends on:_ —
- [ ] `F10` Define an ordered typed enhancement-operation registry with user label/help, availability,
  default policy, execution adapter, and history label. It must support an operation backed by a
  model or deterministic code without exposing that distinction in public copy; it is not a
  generic plugin runtime and does not authorize new operations in this phase — _Depends on:_ `F1`
- [ ] `F2` Remove separate public `Refine soft edges`/`Clean edge colours` cards, graph download
  sizes, model/provider/path names, mode recommendations, raw fallback chains, component-cleanup
  implementation language, and both `Skip and edit with brush` actions — _Depends on:_ `F1`, `F10`
- [ ] `F3` One Apply action serializes selected operations through the existing one-heavy-stage
  lifecycle, updates the stable stage, and commits one `enhance` operation only after final
  recomposition succeeds. Do not accumulate colour transforms on repeated use — _Depends on:_
  `F1`, `F2`, `F10`
- [ ] `F4` Cancel during work keeps the last committed document. Classified internal fallback may
  keep the current result or use the existing safe path, but primary notices say only what the user
  can do (`Try again`, `Keep current result`, `Use a smaller image`) — _Depends on:_ `F3`
- [ ] `F5` Wire the Phase-26 document history to the Phase-27 toolbar for applied Cutout, Manual,
  and Enhance operations. Undo/redo restores matte, foreground, composite, and processing
  provenance consistently; active draft icons remain tool-local and every selected batch item
  retains an isolated history — _Depends on:_ `F3`
- [ ] `F6` Show localized toolbar tooltips/status labels for the operation that Undo/Redo will
  affect. Branching after undo evicts the redo branch and releases artifacts that are no longer
  reachable — _Depends on:_ `F5`
- [ ] `F7` Enforce 20-entry/96-MiB historical budgets with realistic alpha/foreground/composite
  artifacts. Release superseded workers/tensors/object URLs and verify current/baseline plus the
  newest oversized undo step remain safe — _Depends on:_ `F3`, `F5`
- [ ] `F8` Add tests for registry/option orchestration, stage ordering, no-op/unchanged results, cancellation,
  deterministic/failure recovery, no accumulation, one atomic history entry, cross-tool undo/redo,
  draft/item separation, byte eviction, branch cleanup, stale-result exclusion, and accessible
  copy — _Depends on:_ `F1`–`F7`, `F10`
- [ ] `F9` Add bilingual cross-browser Playwright coverage for Enhancements
  Apply/Cancel/retry/current result, then toolbar undo/redo across Cutout → Manual → Enhancements.
  Run the core flow for a single upload and two selected items from a multiple upload; assert the
  primary UI contains none of the removed model/path/size/skip-to-brush copy — _Depends on:_ `F8`

### Infra

- [ ] `I1` Reuse current ViTMatte/foreground models, pins, CDN fallback, workers, quality corpus,
  and real-model commands. Add no dependency, asset, env var, route, analytics, persistence, or
  server work — _Depends on:_ `F9`

---

## Files

### Create / modify

~~~
src/widgets/tool-workspace/model/enhancement-operation-registry.ts
src/widgets/tool-workspace/model/enhancement-operation-registry.test.ts
src/widgets/tool-workspace/ui/EnhancementsToolPanel.tsx
src/widgets/tool-workspace/ui/EnhancementsToolPanel.test.tsx
src/widgets/tool-workspace/model/use-tool-workspace-controller.ts
src/widgets/tool-workspace/ui/EditorToolbar.tsx
src/widgets/tool-workspace/ui/EditorToolbar.test.tsx
src/widgets/tool-workspace/ui/ToolWorkspace.tsx
src/features/refine-matte/ui/MatteRefinementControls.tsx
src/features/refine-foreground/ui/ForegroundRefinementControls.tsx
src/features/refine-matte/model/use-matte-refinement.ts
src/features/refine-foreground/model/use-foreground-refinement.ts
src/features/editor-history/model/editor-history.ts
src/features/editor-history/model/editor-history.test.ts
src/entities/edit-document/model/artifact-store.ts
src/entities/edit-document/model/artifact-store.test.ts
src/features/batch-processing/ui/BatchGrid.tsx
src/features/batch-processing/ui/BatchGrid.test.tsx
messages/ru.json
messages/en.json
e2e/hybrid-pipeline.spec.ts
e2e/foreground-refinement.spec.ts
e2e/matte-refinement.spec.ts
docs/PHASE_29.md
~~~

### Do NOT touch

- ViTMatte/foreground algorithms, model registry pins, fallback order, quality thresholds, CDN
- Cutout behavior except consuming committed history; Background/export or batch-wide editing
- Public routes/SEO, persistence/backend/analytics, or Studio features

---

## Contracts

### New persistent data (tables / collections / files)

None.

### New API endpoints / RPC methods / events

None.

### New types / models / shared interfaces

```ts
interface EnhancementDraft {
  selectedOperationIds: readonly ("fine-detail" | "colour-halo")[];
  improveDetail: boolean;
  removeColourHalo: boolean;
  dirty: boolean;
  status: "idle" | "applying" | "error";
}
```

One successful Apply produces exactly one `EditOperation { kind: "enhance" }`, even when both
internal stages run. No-op output creates no history entry. Failed, cancelled, or stale stages
create no entry and cannot replace the committed document. Operation IDs describe stable user
outcomes, not model names, and are scoped to the owning document/batch item.

### New env vars

None.

---

## Gate Checks

Run `/phase-gate 29`; standard commands plus:

```bash
pnpm vitest run src/features/refine-matte src/features/refine-foreground \
  src/features/editor-history src/entities/edit-document src/widgets/tool-workspace
pnpm e2e e2e/hybrid-pipeline.spec.ts e2e/matte-refinement.spec.ts \
  e2e/foreground-refinement.spec.ts
pnpm e2e:phase-19-real
pnpm e2e:phase-20-real
```

Fail if old panels/technical copy remain primary, Enhancements can run heavy stages concurrently, a
partial/failed result enters history, undo restores matte but not foreground/composite, repeated
cleanup accumulates transforms, single/batch histories leak, or history/resource budgets are
unverified.

---

## Architect Review Notes

- [x] No architect review issues recorded

## Implementation Notes

None

## Atomic Commit Message

```text
feat(phase-29): add enhancements and committed undo redo
```

## Post-Phase Checklist

- [ ] Scope complete; gates green; review notes resolved
- [ ] Run `/context-update 29`
- [ ] Commit on `feat/phase-29`; tag `v0.29.0` after merge
