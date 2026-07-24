# PHASE 27 — Automatic-First Workspace

## Phase Metadata

| Field | Value |
|-------|-------|
| Phase | `27` |
| Title | Automatic-First Workspace |
| Status | `⏳ pending` |
| Tag | `v0.27.0` |
| Depends on | PHASE_26 gate passing |

---

## Phase Goal

Replace the choice-heavy initial journey with one/many upload → automatic processing → stable
editor, while introducing the toolbar/stage/panel shell used by later phases. A selected completed
batch item uses the same shell in this phase. Preserve all current capabilities through temporary
adapters, but remove model/runtime implementation details from the primary UI (SPEC.md §5.2–§5.4,
§7.1, §7.3, §7.7, §8).

## Design References

- Architect-provided remove.bg screenshot (2026-07-24) — stable image stage, icon+text toolbar,
  compact Cutout panel, toolbar history, and Download placement; reference for hierarchy, not a
  pixel-identical clone.
- [remove.bg Magic Brush help](https://www.remove.bg/uk/help/a/how-to-use-magic-brush) — upload is
  followed by automatic removal before optional editing.

---

## Scope

### Frontend

- [ ] `F1` Replace the initial Automatic/Guided method choice with one upload surface plus the
  automatic processing selector. Every valid one-or-many upload starts processing immediately;
  multiple files retain the existing grid/progress/error-isolation journey. Direct guided entry
  leaves the public flow but reusable internal code remains — _Depends on:_ —
- [ ] `F2` Rename public automatic modes to `Быстро/Fast`, `Оптимально/Optimal`, and
  `Максимальное качество/Maximum quality` with a visible `Beta` badge. Map them to
  `isnet-q8`/`isnet-fp32`/`ben2-fp16` internally and make Optimal the capable-device recommendation —
  _Depends on:_ `F1`
- [ ] `F3` Remove model IDs, dtype, MiB counts, WebGPU/WASM labels, raw worker log lines, and
  technical fallback text from the primary mode/progress/result UI. Keep diagnostics in a compact
  accessible `Details` disclosure that is collapsed by default — _Depends on:_ `F2`
- [ ] `F4` Add an accessible help tooltip/popover for Maximum quality: it needs compatible WebGPU,
  may not start on every device, and falls back once to Optimal without losing the upload. The
  trigger works by hover, focus, and click; no technical exception is primary copy — _Depends on:_
  `F2`, `F3`
- [ ] `F5` Build a stable `EditorStage`, `EditorToolbar`, and reserved `ToolPanelSlot`. The stage
  keeps one aspect-preserving footprint while tools switch; desktop uses stage+panel, mobile stacks
  toolbar/stage/panel without remounting the image or resetting view state. Reuse this exact shell
  for a single document and the selected completed batch document — _Depends on:_ `F1`
- [ ] `F6` Add toolbar items with icons and text: Cutout, Enhancements (`Улучшения`), Background;
  document Undo/Redo
  icon controls; and a Download slot. Use a typed registry for identity/order/labels, not condition
  chains duplicated through the workspace — _Depends on:_ `F5`
- [ ] `F7` Adapt current guided/manual, matte/foreground, background, and download controls into
  the new panel slots without yet performing the Phase-28–30 content simplification. A dirty
  existing draft cannot be lost on tool switch; temporary adapters may show an apply/discard guard —
  _Depends on:_ `F5`, `F6`
- [ ] `F8` Reserve stage/panel dimensions and loading placeholders so tool switching produces no
  visible stage jump. Keep tool panels lazy after the automatic result and preserve LCP/TTI budgets —
  _Depends on:_ `F5`–`F7`
- [ ] `F9` Implement ARIA toolbar keyboard navigation, active-tool announcement, focus restoration,
  narrow-screen horizontal overflow, localized accessible icon names, reduced-motion behavior, and
  focus/click-capable help content — _Depends on:_ `F6`–`F8`
- [ ] `F10` Add component/integration tests for mapping/copy, automatic start, fallback preservation,
  no-primary-technical-copy assertions, registry order, non-remounting stage, dirty-draft guard,
  keyboard navigation, and responsive slot behavior — _Depends on:_ `F1`–`F9`
- [ ] `F11` Add bilingual cross-browser Playwright coverage: choose each public mode, upload,
  observe automatic start/result, switch all toolbar tools without stage geometry/view reset,
  exercise keyboard navigation/tooltips, and assert forbidden technical terms are absent from the
  primary workspace. Repeat the journey with multiple files, selecting at least two completed
  items and proving shell/view/document identity do not leak between them — _Depends on:_ `F10`

### Infra

- [ ] `I1` Add no model, package, route, env var, analytics event, persistence, or backend. Keep
  diagnostics lazy/collapsed and do not increase the initial public bundle with future tools —
  _Depends on:_ `F11`

---

## Files

### Create / modify

~~~
src/widgets/tool-workspace/model/editor-tool-registry.ts
src/widgets/tool-workspace/model/editor-tool-registry.test.ts
src/widgets/tool-workspace/model/use-tool-workspace-controller.ts
src/widgets/tool-workspace/ui/EditorStage.tsx
src/widgets/tool-workspace/ui/EditorStage.test.tsx
src/widgets/tool-workspace/ui/EditorToolbar.tsx
src/widgets/tool-workspace/ui/EditorToolbar.test.tsx
src/widgets/tool-workspace/ui/ToolPanelSlot.tsx
src/widgets/tool-workspace/ui/ToolWorkspace.tsx
src/widgets/tool-workspace/ui/ToolWorkspace.test.tsx
src/features/quality-mode-toggle/ui/QualityModeToggle.tsx
src/features/quality-mode-toggle/ui/QualityModeToggle.test.tsx
src/widgets/tool-workspace/ui/ProcessingLog.tsx
src/features/batch-processing/ui/BatchGrid.tsx
src/features/batch-processing/ui/BatchGrid.test.tsx
src/app/styles/globals.css
src/shared/ui/ (tooltip/popover primitive only if not already present)
messages/ru.json
messages/en.json
e2e/home.spec.ts
e2e/scenario-pages.spec.ts
docs/PHASE_27.md
~~~

### Do NOT touch

- SlimSAM candidate/fusion algorithms or Cutout content simplification (Phase 28)
- Matting/foreground algorithms or combined Enhancements semantics (Phase 29)
- Export resizing/formats or batch-wide actions (Phases 26–27)
- Legacy guided source deletion, public routes/SEO, models/CDN, persistence, or Studio functionality

---

## Contracts

### New persistent data (tables / collections / files)

None.

### New API endpoints / RPC methods / events

None.

### New types / models / shared interfaces

```ts
type EditorToolId = "cutout" | "enhance" | "background";

interface EditorToolDefinition {
  id: EditorToolId;
  label: string;
  icon: React.ComponentType;
  order: number;
  loadPanel: () => Promise<unknown>;
}
```

Public mode mapping is exactly Fast → `isnet-q8`, Optimal → `isnet-fp32`, Maximum quality (Beta) →
`ben2-fp16`. The internal profile IDs remain out of primary localized copy.

### New env vars

None.

---

## Gate Checks

Run `/phase-gate 27`; standard checks plus:

```bash
pnpm vitest run src/features/quality-mode-toggle src/widgets/tool-workspace
pnpm e2e e2e/home.spec.ts e2e/scenario-pages.spec.ts
pnpm tsc --noEmit
pnpm exec steiger ./src
```

Fail the phase if upload needs a second start action, direct guidance remains an initial public
choice, primary UI exposes model/dtype/runtime/quota copy, Maximum lacks an accessible warning and
fallback, stage geometry/view resets on tool switch, or toolbar navigation is pointer-only.
Also fail if multiple upload regresses, a completed batch item uses a different toolbar/panel
contract, or switching items shares document/view state.

---

## Architect Review Notes

- [x] No architect review issues recorded

## Implementation Notes

None

## Atomic Commit Message

```text
feat(phase-27): introduce automatic-first editor workspace
```

## Post-Phase Checklist

- [ ] Scope complete; automated gates green; review notes resolved
- [ ] Run `/context-update 27`
- [ ] Commit on `feat/phase-27`; tag `v0.27.0` after merge
