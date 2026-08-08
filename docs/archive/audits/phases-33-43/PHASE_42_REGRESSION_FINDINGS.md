# Phase 42 Regression Findings

Date: 2026-08-04
Scope: architect-reported v2 regressions after the Phase-41 presentation migration
Status: root-cause audit and target-device responsiveness closure complete

## Architecture verdict

The regressions were introduced at the presentation/runtime integration seam. The document and
workspace actors, correlations, heavy-job admission, artifact ownership, and worker protocols remain
the authoritative v2 flow. No legacy hook, store, controller, or worker lifecycle is required.

| Finding | Reproduced root cause | Resolution / evidence |
|---|---|---|
| Freeze at the end of automatic removal | When the result actor closed processing with no draft, a presentation effect always opened Magic. Mounting Magic immediately allocated and repeatedly sized source-resolution canvas buffers, so the stall appeared to belong to the preceding “Removing background…” stage. | Magic now uses one capped display-only stroke canvas, no candidate-preview canvas, stable dimensions, and animation-frame repainting. Actor/runtime source coordinates remain unchanged. |
| Enhancement Apply lag and jump to Cutout | Enhancement commit correctly closed its draft; the same fallback effect then mounted Magic and its buffers. A source-sized matte equality pass also ran as one uninterrupted main-thread loop. | The selected Enhancement tool is retained/reopened after commit, and matte comparison yields between bounded chunks before the worker-backed snapshot commit. Serialized real-model Phase-41 flow passes. |
| Oval/unresponsive Magic brush | The Magic image used `object-contain` inside a percentage square while overlay canvases stretched to that square. Every pointer move reassigned intrinsic canvas dimensions, cleared the buffer, and repainted all strokes. | Manual/Magic now share source aspect geometry; the display buffer is capped at 1600 px on its longest side; pointer cursor updates are imperative; cursors are proportional solid-outline circles without a core, and Manual remains white. Non-square unit/browser coverage locks the ratio and buffer cap. |
| Missing Magic strokes and ineffective Apply | The expensive per-move reset competed with pointer capture. Apply was disabled until a separate Predict and explicit candidate choice, so the expected two-button flow could not commit. | Strokes stay runtime-owned and repaint at most once per animation frame. Apply requests prediction, chooses the first result from the existing ranked candidate list, then sends the accepted correlated Apply; deterministic and real-model journeys assert one prediction and one commit. |
| Wrong Cutout controls/history | Phase 41 exposed Predict, candidate choices, status/stroke count, and local Undo/Redo controls. The shared toolbar already had draft intents but routed only document history. | Product UI now exposes only Apply/Cancel. The common toolbar routes contextual draft Undo/Redo when Manual/Magic gesture history is available and document Undo/Redo otherwise. |
| Manual/Magic viewport jumps | Separate containers used different sizing, padding, aspect, and canvas rules; selection was inferred from active draft kind. | Both Cutout modes use the same bounded stage/checkerboard/aspect contract. Selected tool/mode remains presentation state keyed by document actor identity. |
| Background/Enhancement result appears lost | The commit was retained in actor history/artifacts, but automatic Magic navigation immediately rendered the Cutout source view. | Apply/Cancel reopen the same selected tool against the committed snapshot. Deterministic checks assert active tool, visible panel, revision, export, and one commit; serialized real-model all-tool flow passes without reinference. |
| Whole editor rerenders around brush controls | Brush size was workspace-root React state, and selected actor changes were republished through the session store while the same actor also had selector subscriptions below it. | Brush size is now ref/DOM-owned presentation state with zero additional Profiler commits per range change. Active-shell and workspace notifications are separated, and the outer active page uses only the scalar selectors it renders. See `PHASE_42_PERFORMANCE_RESEARCH.md`. |
| Cropped stage and nested scrollbars | Cutout content was sized only from stage width and pan mutated nested scroll offsets. Tall/wide sources therefore exceeded the fixed stage at 100%, which meant width-fill rather than contain-fit. | A shared container-relative geometry fits from both available width and height, keeps overflow hidden, and uses a bounded imperative transform owner for zoom/pan. Non-square Chromium evidence asserts full containment and zero scroll overflow. |
| Missing Hand/Space interaction | Migrated Cutout workspaces exposed Hand state but had no temporary Space lifecycle and retained the default canvas cursor. | Hand and Space now expose grab/grabbing cursors; Space+left-drag pans after zoom and releases on keyup/blur without pointer-motion React/XState publication. |
| Magic displays stale original after Apply | Cutout presentation passed `sourcePreviewUrl` even though the actor/projection had already published a new committed result URL. The correct commit was visible only when another tool reconstructed from committed artifacts. | Magic and Manual bind to `committedResultUrl`; deterministic Chromium asserts the same Magic image URL changes immediately after the correlated Apply while the tool stays selected. |
| Persistent multi-image toolbar scrollbar | The toolbar intentionally retained horizontal overflow access but globally rendered thin scrollbar chrome. | Horizontal touch/keyboard access remains bounded while Firefox/WebKit scrollbar chrome is hidden; batch Chromium asserts the computed policy. |
| Managed-Windows toolbar reflow | A production Chrome 150 trace recorded 78 ms forced reflow in the shared `tool-workspace` chunk while the toolbar synchronously measured `scrollWidth`/`clientWidth`; PerformanceObserver also exposed a 250 ms Long Task and 176 ms Event Timing in the sampled workflow. | Fixed after explicit architect authorization. Boundary observation replaced synchronous toolbar measurement, and v2-only panel autofocus is scheduled one frame later with cleanup. The repeated production sample recorded zero Long Tasks, 72 ms Event Timing, 74 ms observed INP, CLS 0.00, and 7 ms forced reflow while preserving tool-panel focus. |
| Managed-Windows Magic candidate Long Task | A complete-product production capture isolated a 219 ms Long Task after worker prediction and before candidate readiness. `MagicCandidateRepository.replace()` created source-resolution constraint maps and ranked/fused three full-image candidates synchronously on the interaction thread. | Fixed after explicit architect authorization. Internal Magic protocol `v2` transfers the current base matte and returns worker-ranked/fused candidates. Deterministic and real-model journeys pass; the repeated native Windows path recorded automatic/prediction/commit `1/1/1`, zero Long Tasks and `0/0/0` owners after cleanup. |

## Focused evidence

- `pnpm typecheck` — PASS.
- `pnpm lint` — PASS.
- Focused presentation/enhancement tests — 9/9 PASS.
- Phase 34–36 deterministic Chromium — PASS for the exercised Manual, Magic, Background, and
  Enhancement paths with zero retries.
- Phase 38 deterministic full-workflow and accessibility checks — PASS after making the Magic
  scroll viewport keyboard-focusable.
- Phase 41 visual baselines — intentionally updated only for approved v2 Cutout/Manual changes;
  desktop/narrow and English/Russian states pass.
- `pnpm e2e:phase-41-real` — PASS, 1/1 in 36.9 s; automatic removal plus Magic, Manual,
  Background, Enhancement, history/export, selection, and cleanup complete without reinference.
- Render-boundary/session publication regression tests — PASS; brush ranges add zero React commits
  and actor-only transitions do not republish the active shell.
- Full single-worker Vitest after the viewport/pipeline closure — PASS, 178 files / 680 tests. The
  default parallel run also passed all 680 assertions but exposed a pre-existing legacy
  `use-batch-processing` interval after jsdom teardown; its isolated file passes 12/12 and the
  Phase-42 v2 scope does not modify that legacy owner.
- Phase-41 deterministic editor UI — PASS, 9/9; focused Phase-34/35 Manual/Magic journeys — PASS,
  5/5.
- Non-square Cutout Chromium evidence — PASS for full containment, zero nested scroll overflow,
  proportional solid cursors, white Manual cursor, Hand/Space grab state, transform pan, immediate
  Magic result URL publication, and hidden multi-image toolbar scrollbar chrome.

Managed-Windows interaction timing, actual 200% browser zoom, bilingual announcements, fine-pointer
and keyboard alternatives, and three-cycle ownership now pass. The device exposed no coarse
pointer, which is recorded as unavailable rather than emulated. Final architect acceptance,
absolute duration signals and `/phase-gate 42` remain before Phase 42 can close.
