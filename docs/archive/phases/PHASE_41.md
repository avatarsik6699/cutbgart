# PHASE 41 — V1-Faithful Editor Tools on V2

<!-- TOKEN BUDGET: keep this file under 10,000 tokens. Be concise. -->

## Phase Metadata

| Field | Value |
|-------|-------|
| Phase | `41` |
| Title | V1-Faithful Editor Tools on V2 |
| Status | `✅ complete; architect verification, review fixes, and phase gate passed` |
| Tag | `v0.41.0` |
| Depends on | PHASE_40 gate and architect acceptance passed; `v0.40.0` merged locally |

---

## Phase Goal

Remove the final accepted visual exception on the isolated bilingual v2 routes by restoring the
complete v1 result-editor workspace over the accepted v2 Manual, Magic, Background, Enhancement,
history, artifact, and worker ownership. Deliver one controller-neutral stage/toolbar/tool-panel
presentation seam without changing public/scenario routes or tool algorithms.

## Design References

- Current rendered `/` and `/en` legacy result-editor workspace — normative desktop and narrow
  visual/interaction reference for the shared stage, toolbar, tool rail, and all reachable panels.
- Phase-39/40 reviewed result baselines — normative main-page and batch framing; the deferred v2
  editor-tool presentation exception ends in this phase.

---

## Scope

### Product and architecture

- [x] `T1` Freeze bilingual v1 reference states and exact desktop/narrow screenshots for the result
  editor, Cutout Manual/Magic, Enhancements, Background, draft/error/progress states, history,
  download placement, and batch-item switching. No masked product UI or unexplained drift —
  _Depends on:_ —
- [x] `T2` Add the SPEC `EditorToolWorkspaceProjection`/`EditorToolWorkspaceIntent` seam over the
  accepted v2 document/runtime controllers. Projection values are immutable and bounded;
  presentation may receive runtime-owned preview handles but never actors, workers, controllers,
  binary values, or mutable workflow state — _Depends on:_ `T1`

### Frontend

- [x] `F1` Extract or implement controller-neutral v1 result-editor visuals for stage sizing,
  transparent preview, desktop/narrow toolbar and tool rail, active/disabled states, history,
  download placement, focus restoration, live status/error output, and dirty-draft guards —
  _Depends on:_ `T2`
- [x] `F2` Reproduce the complete Cutout UI: Magic Keep/Remove strokes, candidate prediction and
  refinement, explicit Apply/Cancel/retry; Manual Restore/Erase, brush sizing, zoom/pan/fit, local
  draft Undo/Redo, and committed history. Preserve accepted correlations and commit semantics —
  _Depends on:_ `F1`
- [x] `F3` Reproduce the v1 Background panel for transparent, colour, gradient, and validated custom
  image fills with immediate uncommitted preview, truthful preparation/error state, and explicit
  Apply/Cancel. Download must remain bound to the committed snapshot — _Depends on:_ `F1`
- [x] `F4` Reproduce the v1 Enhancements panel for fine-detail and colour-halo selection with
  truthful queued/running/progress/applying/no-change/error states and explicit Apply/Cancel/retry.
  Heavy work remains behind the shared FIFO coordinator — _Depends on:_ `F1`
- [x] `F5` Integrate all panels with typed intent translation, keyboard/focus routing, document and
  draft history, dirty guards, selection retention, and responsive batch switching. A selected item
  change must not discard/recreate a draft, mutate a sibling, churn URLs, or reinfer — _Depends on:_
  `F2`, `F3`, `F4`

### Verification and evidence

- [x] `I1` Add projection/intent, adapter, component, and focused runtime integration coverage for
  every tool state, keyboard/focus behavior, draft/history guard, Apply/Cancel/retry, committed-only
  export, selection isolation, SSR, stale completion, and cleanup — _Depends on:_ `F5`
- [x] `I2` Add zero-retry bilingual deterministic Playwright for complete Manual, Magic,
  Background, and Enhancement journeys plus exact v1/v2 visual comparison at desktop/narrow
  viewports. Dedicated baselines are allowed only for named truthful v2 status detail — _Depends on:_
  `I1`
- [x] `I3` Run one serialized real-model journey covering automatic result, Magic prediction/Apply,
  Manual correction, Background Apply, Enhancement Apply, history/export, batch item switching,
  responsive controls, and zero unrequested inference. Record unsupported device signals —
  _Depends on:_ `I2`
- [x] `I4` Verify accepted Phase-33–40 actor/runtime/resource/accessibility contracts, public and
  scenario route identity, SEO/indexing/analytics, and repeated tool/open/apply/cancel/switch/reset/
  dispose cleanup. Publish Phase-41 results and the remaining managed-Windows/cutover boundary —
  _Depends on:_ `I3`

---

## Files

### Create / modify

~~~
docs/PHASE_41.md
docs/audits/PHASE_41_RESULTS.md
src/v2/presentation/editor-tools/
src/v2/presentation/manual-cutout/
src/v2/presentation/magic-cutout/
src/v2/presentation/background/
src/v2/presentation/enhancements/
src/pages/editor-v2/
src/shared/ui/
src/widgets/tool-workspace/ui/
src/v2/runtime-browser/editor-session/
messages/en.json
messages/ru.json
e2e/phase-41-editor-tools-ui.spec.ts
e2e/phase-41-editor-tools-ui.real.spec.ts
e2e/phase-41-editor-tools-ui.spec.ts-snapshots/
e2e/support/v2/
package.json
~~~

Existing runtime files may change only for defects or missing narrow projection data required by
the contract. Controller-neutral visual extraction must preserve backward-compatible legacy imports
and expose a narrow semantic public API.

### Do NOT touch

- Public `/`, `/en`, scenario route bindings, route identity, sitemap, canonical/indexing policy,
  navigation, analytics semantics, or public cutover
- Legacy hooks/controllers/stores/worker lifecycle or legacy behavior, except controller-neutral
  visual extraction with backward-compatible imports
- Document/workspace actor authority, accepted Manual/Magic/Background/Enhancement algorithms,
  correlations, model families/weights/revisions, or the heavy-job scheduling policy
- Server APIs, accounts, auth, billing, database/storage, remote processing, generated backgrounds,
  privacy policy, export formats, new env configuration, legacy removal, or redesign work

---

## Contracts

> This section is the source of truth for `/context-update`.

### New persistent data (tables / collections / files)

- Reviewed Playwright baselines under
  `e2e/phase-41-editor-tools-ui.spec.ts-snapshots/` are versioned repository evidence.

No database, IndexedDB, server store, image, filename, pixel, URL, draft, history, or editor-state
persistence is introduced. Existing `localStorage["qualityMode"]` behavior is unchanged.

### New API endpoints / RPC methods / events

None. `/editor-v2` and `/en/editor-v2` retain their bilingual noindex identities; public and
scenario routes remain on legacy. Presentation intents translate to existing in-process v2
session/controller commands only.

### New types / models / shared interfaces

```ts
type EditorToolId = "cutout" | "enhance" | "background";
type CutoutPresentationMode = "magic" | "manual";

type EditorToolWorkspaceProjection = {
  locale: "ru" | "en";
  documentId: DocumentId;
  revision: Revision;
  activeTool: EditorToolId;
  cutoutMode: CutoutPresentationMode;
  canUndoDocument: boolean;
  canRedoDocument: boolean;
  dirtyDraft: boolean;
  busy: boolean;
  sourcePreviewUrl: string;
  committedResultUrl: string;
  width: number;
  height: number;
  manualDraft: ManualCutoutDraft | null;
  magicDraft: MagicCutoutDraft | null;
  backgroundDraft: BackgroundDraft | null;
  enhancementDraft: EnhancementDraft | null;
};

type EditorToolWorkspaceIntent =
  | { type: "choose-tool"; tool: EditorToolId }
  | { type: "choose-cutout-mode"; mode: CutoutPresentationMode }
  | { type: "undo-draft" | "redo-draft" | "undo-document" | "redo-document" }
  | { type: "predict-magic" | "apply-active-tool" | "cancel-active-tool" |
      "retry-active-tool" | "download-committed" | "leave-workspace" }
  | { type: "choose-background"; fill: BackgroundFillDescriptor }
  | { type: "choose-enhancements"; operationIds: readonly EnhancementOperationId[] };
```

The projection is presentation data, not actor truth. URLs remain runtime-owned leased handles.
High-frequency canvas interaction stays behind typed tool-specific interaction ports and never puts
pixels, canvases, pointer events, or mutable brush engines into projection/actor state.

### New env vars

None.

---

## Gate Checks

Run `/phase-gate 41` before committing. In addition to every command in
[`docs/STACK.md`](../../STACK.md#gate-commands), run:

```bash
pnpm e2e e2e/phase-41-editor-tools-ui.spec.ts --project=chromium
pnpm e2e:phase-41-real
```

Phase-specific PASS additionally requires:

- reviewed v1/v2 bilingual desktop/narrow comparisons for result stage and every tool-owned state,
  with no masked product UI, general tolerance, or unexplained drift;
- all Manual/Magic/Background/Enhancement behavior stays behind accepted v2 correlations, history,
  artifact, worker, and heavy-job ownership; export never includes an uncommitted draft;
- batch switching retains each item's draft/history/settings without reinference, URL churn, stale
  publication, cross-document mutation, freeze, or reachable resource leak;
- deterministic and serialized real-model journeys pass with zero retries and no arbitrary sleeps;
- public/scenario routes and SEO/indexing/analytics remain unchanged, and all review notes resolve.

---

## Architect Review Notes

- [x] Presentation Manual/Magic ports expose mutable runtime draft engines, allowing UI components
  to invoke workflow-owned state directly instead of using bounded semantic interaction commands.
- [x] Phase-41-touched shared UI files retain prospective `FRONTEND_CONVENTIONS.md` violations:
  `interface` props, destructured component props, unnamed effects, and multiple components per file.
- [x] `EditorV2ActiveDocument` builds a tool workspace through an inline JSX variable and combines
  projection/intent translation with concrete tool rendering instead of a focused presentation
  component.

---

## Implementation Notes

- The v1 visual shell is shared without importing legacy workflow ownership. Tool workspaces receive
  immutable projections and narrow interaction ports; actor/session/runtime objects stay in the page
  adapter.
- Dedicated v2 copy/actions remain where hiding them would make runtime state untruthful: Magic
  Predict/candidates and local history, Background validation/export notice, and Enhancement
  Cancel/retry/no-change. The surrounding v1 hierarchy and responsive layout are unchanged.
- Selected gradient fill uses an outline plus primary-tinted background instead of v1's solid
  primary button because the solid state fails WCAG colour contrast in the current token set.
- Phase-39/40 editor-result baselines were rotated only where the completed tool workspace is now
  intentionally visible. Full Phase-41 evidence is recorded in `audits/PHASE_41_RESULTS.md`.
- Review corrections replace Manual/Magic engine exposure with semantic interaction commands and
  isolate concrete rendering in `EditorV2ToolWorkspace`; high-frequency pixels remain runtime-owned
  while XState remains the sole committed-state writer.

---

## Atomic Commit Message

```text
feat(phase-41): restore v1 editor tools on v2
```

---

## Post-Phase Checklist

- [x] All Scope checkboxes checked (or deferred in Architect Review Notes)
- [x] All automated gate checks green
- [x] Architect verifies bilingual desktop/narrow editor-tool visual and behavioral parity
- [x] All architect review notes resolved
- [x] `docs/STATE.md` updated — `/context-update 41`
- [x] Committed atomically on `feat/phase-41` branch
- [x] Tag created after merge: `git tag -a v0.41.0 -m "Phase 41: v1-faithful editor tools on v2"`
