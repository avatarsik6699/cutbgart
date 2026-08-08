# Phase 44 T12 — local-model reprocessing plan

Date: 2026-08-07

Status: **architect accepted**

Implementation: **complete; awaiting architect manual checkpoint review**

Scope: single-image model identity, selection, and current-document reprocessing only

Production code changes: **none before acceptance**

## Decision requested

Approve or reject the source/baseline, draft, history, cancellation, failure, focus, ownership, and
verification contract below. T12 implementation must not begin until the architect explicitly
accepts the complete plan.

## Current path traced

| Current owner | Finding | T12 consequence |
|---|---|---|
| `src/shared/lib/inference/production-model-config.ts` | The retained automatic-removal set is exactly `isnet-q8`, `isnet-fp32`, and WebGPU-only `ben2-fp16`. | Reuse this registry; add no family, revision, asset, or dependency. |
| `EditorSession` item records | Requested/effective model and inference path are workspace-item fields. The effective mode is updated when execution is selected. | Keep capability resolution in the session/runtime, but do not use the mutable item field as result provenance. |
| `DocumentState` / `DocumentSnapshot` | The committed result and history snapshots do not record which automatic model produced their matte. | Add narrow snapshot provenance so the label remains truthful after edits and Undo/Redo. |
| `START_AUTOMATIC_REMOVAL` | The command already carries a model mode and the run already carries document/run/revision correlation. | Reuse the command and correlation; allow it from a committed result through one explicit reprocessing policy. |
| `LocalProcessingGateway` | Automatic removal is already scheduled by the shared `HeavyJobCoordinator`. | Reprocessing must use this path unchanged and must not call a worker directly. |
| `LocalExecutionReadout` | The toolbar currently reports only `on-device` and the inference backend. | Replace it only on the single-image surface with the accessible model control; retain a non-interactive local-execution readout where batch presentation still needs it. |
| `ActiveDocumentModel` / `NavigationGuard` | Clean drafts can close synchronously; dirty drafts already use an Apply/Discard guard before tool/leave navigation. | Extend this owner with one model-reprocess navigation target rather than adding another confirmation store. |

## Proposed behavior contract

### Models and availability

- The choices come only from `PRODUCTION_MODELS` and use localized user-facing labels backed by the
  stable model IDs.
- On WebGPU, offer all three retained variants. On WASM, offer `isnet-q8` and `isnet-fp32`; do not
  offer `ben2-fp16` and then silently fall back. An initial Maximum request that already fell back
  must identify the effective accepted model, not the unavailable request.
- Selecting the model that already produced the current committed result is a no-op and creates no
  run, revision, history entry, or announcement.
- The interactive choice is single-image-only. Batch admission and every sibling item retain their
  captured model, result, status, history, and queue position.

### Source, baseline, and provenance

- Every reprocessing run reads the document's immutable registered `source` artifact. It never
  feeds the current composite, foreground, edited matte, background, or export back into automatic
  removal.
- The first accepted automatic snapshot remains the document's original `baseline`; T12 does not
  reinterpret it as the latest model run.
- Add the effective `AutomaticModelMode` as ID-only metadata on each committed
  `DocumentSnapshot`. Automatic output sets it from the effective run. Manual, Magic, Background,
  and Enhancements commits preserve it from their input snapshot.
- Because history already carries snapshots, Undo/Redo restores pixels, background state, and the
  truthful automatic-model provenance together without a second mirrored model-history store.

### Draft and operation semantics

- While a tool Apply/prediction or another automatic run is active, the model control is disabled;
  no competing request is queued from the control.
- A clean active draft is cancelled through its existing controller before reprocessing begins.
- A dirty active draft routes through the existing `NavigationGuard`. **Keep editing** leaves the
  draft and committed result untouched and starts no run. **Discard and continue** cancels the
  draft, releases its resources, and then starts exactly one correlated automatic run.
- T12 adds no implicit Apply, draft serialization, or background model prefetch.

### History and publication

- The initial automatic result still creates no edit-history entry.
- A successful reprocessing result creates exactly one bounded `automatic-remove` history entry:
  `before` is the current committed snapshot and `after` is the newly accepted snapshot. It clears
  the redo branch through the existing bounded-history policy and increments the document revision
  once.
- Undo restores the complete pre-reprocess result (including any applied Manual/Magic/Background/
  Enhancements work and its model provenance); Redo restores the new automatic result and its model
  provenance. A later changed Apply follows the existing rule and clears the redo branch.
- A different model is a meaningful history operation even if its encoded pixels happen to compare
  equal, because the accepted result provenance changes.
- Promotion to document/history ownership and release of replaced/pruned artifacts are atomic with
  the accepted correlation. The original baseline lease remains singular; a reprocess must not add
  another baseline lease or leak the rejected run.

### Cancellation, failure, and stale work

- During reprocessing, the previous committed snapshot and history remain authoritative and owned;
  the candidate stays run-owned until promotion.
- Cancel returns to the previous result with the previous model label and unchanged revision/history.
  It releases all run-owned artifacts and publishes no partial snapshot.
- A retryable or terminal processing failure returns to the previous result, presents a localized
  accessible error, and leaves the model choices available. Choosing the failed alternative again
  starts a fresh correlated run; Reset remains a separate destructive document action.
- A late success/failure/cancel after cancellation, document switch, reset, disposal, or revision
  change is ignored by the existing document/run/revision guards and releases only its run-owned
  resources.
- An initial run with no committed result keeps the existing error/retry behavior; the preservation
  behavior above applies only to reprocessing an accepted result.

### Presentation and focus

- The single-image toolbar control identifies `Current model: <label>` when a committed result is
  idle. During initial processing or reprocessing it truthfully announces
  `Processing with <label>` and is disabled until the run terminates.
- The control is keyboard reachable, has an explicit localized accessible name, exposes only
  available choices, and does not rely on colour or hover. Technical WebGPU/WASM detail remains
  available without being confused with model identity.
- After success, cancellation, or failure, focus returns to the remounted model control. If the
  dirty-draft guard is declined, focus returns to the active editing surface; if discard is
  confirmed, the model control becomes the restoration target after the run.
- Reprocessing intentionally closes the previous tool draft. When the result becomes stable again,
  the existing default Cutout tool lifecycle may reopen a fresh clean draft; no discarded draft is
  reconstructed.

## Frontend ownership and data flow

- **Workflow owner:** the document actor owns active-run correlation, committed provenance,
  automatic history, revision, error, and stale-result rejection.
- **Resource owner:** `EditorSession`, the artifact repository, processing gateway, and shared
  heavy-job coordinator continue to own source/candidate artifacts, workers, cancellation,
  promotion, leases, and cleanup.
- **Capability owner:** `EditorSession` resolves path-dependent availability/effective model for
  the selected document and exposes cached primitive/stable model-selection values.
- **Navigation/focus owner:** the stable `ActiveDocumentModel` extends its existing pending
  navigation and focus-restoration policy; React does not mirror draft or run state.
- **React boundary:** a leaf toolbar connector selects current provenance, active target, busy/error
  state, and available IDs, then passes narrow values and `onSelect` to one controller-neutral,
  accessibility-owning model control. No session, actor snapshot, or catch-all intent crosses the
  presentation boundary.
- **New abstractions:** one model-choice presentation component owns label/menu accessibility and
  focus restoration; one small registry-to-option policy owns localized labels and path filtering.
  No new layer-wide barrel, store, service, or runtime dependency is justified.

## Expected implementation surface

### Domain/application/runtime

- `src/editor/domain/artifacts.ts`
- `src/editor/domain/document-history/document-history.types.ts`
- `src/editor/domain/document-transition/command-decision.ts`
- `src/editor/domain/document-transition/event-transition.ts`
- `src/editor/domain/document-transition/document-transition.types.ts`
- `src/editor/application/document/document-machine.ts`
- `src/editor/application/document/document-selectors.ts`
- `src/editor/runtime/processing/worker-output-registration.ts`
- `src/editor/runtime/editor-session/editor-artifact-effects.ts`
- `src/editor/runtime/editor-session/editor-session.ts`
- `src/editor/runtime/editor-session/editor-session.types.ts`
- the directly affected focused tests/builders beside those modules

### Frontend/E2E/localization

- `src/widgets/editor/model/active-document-model.ts`
- `src/widgets/editor/model/editor-session-selectors.ts`
- `src/widgets/editor/ui/active-document/editor-toolbar-connector.tsx`
- `src/widgets/editor/ui/active-document/toolbar-runtime-status.tsx`
- `src/widgets/editor/ui/connectors/automatic-processing-connector.tsx`
- `src/widgets/editor/ui/editor-tools/local-execution-readout.tsx`
- one focused model-choice component and its test under
  `src/widgets/editor/ui/editor-tools/`
- `messages/en.json`
- `messages/ru.json`
- `e2e/phase-44-frontend-refactor.spec.ts`

Consumer tracing may remove `LocalExecutionReadout` only if no batch or technical-status consumer
remains. Any additional production file requires a direct dependency discovered during
implementation; it does not widen the behavior above.

## Focused verification plan

1. Domain/application tests: initial result provenance, committed-result reprocess acceptance,
   one automatic history entry, Undo/Redo provenance, dirty-draft rejection, cancel/failure
   preservation, stale terminal rejection, and revision correlation.
2. Runtime/resource tests: effective model/path availability, same-model no-op, selected-document
   isolation, shared coordinator usage, candidate promotion, history pruning, cancel/failure/reset/
   disposal cleanup, and zero extra baseline lease.
3. Component/render tests: available localized choices, truthful current/processing labels,
   disabled busy state, guard routing, stable selector identities, focused leaf rerenders, and
   focus restoration.
4. Bilingual Playwright on desktop and narrow viewports: identify the initial model, choose a
   different available model, verify one current-document run, cancel and failure preservation,
   dirty-draft Keep/Discard paths, Undo/Redo, focus restoration, and sibling isolation after batch
   mode is entered.
5. Commands:

   ```text
   pnpm vitest run src/editor/domain/transitions.test.ts src/editor/application/document-model.test.ts src/editor/runtime/editor-session/editor-session.test.ts src/editor/runtime/editor-session/editor-artifact-effects.test.ts src/widgets/editor/model/active-document-model.test.ts
   pnpm vitest run <new focused model-control test>
   pnpm tsc --noEmit
   pnpm lint
   pnpm exec steiger ./src
   pnpm quality:fallow
   pnpm e2e e2e/phase-44-frontend-refactor.spec.ts --project=chromium
   ```

Full real-model, managed-Windows, security, build, container, release, and phase-gate evidence stays
with T1. T12 adds only the focused real-browser flow required by the changed user behavior.

## Stop conditions

Stop and request a phase amendment if implementation requires a new model/asset/revision, a worker
protocol change, a second workflow store, persisted model-choice data, a new runtime dependency,
processing an edited composite instead of the immutable source, bypassing the heavy-job
coordinator, or weakening document/run/revision correlation.

## Architect acceptance

- [x] Source, baseline, availability, and provenance semantics accepted
- [x] Dirty-draft and active-operation semantics accepted
- [x] History and artifact-lifecycle semantics accepted
- [x] Cancellation, failure, stale-work, and sibling-isolation semantics accepted
- [x] Presentation, accessibility, focus, ownership, and verification plan accepted
