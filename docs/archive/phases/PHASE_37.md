# PHASE 37 — Editor v2 Batch and Multi-Document Workspace

<!-- TOKEN BUDGET: keep this file under 10,000 tokens. Be concise. -->

## Phase Metadata

| Field | Value |
|-------|-------|
| Phase | `37` |
| Title | Editor v2 Batch and Multi-Document Workspace |
| Status | `✅ done` |
| Tag | `v0.37.0` |
| Depends on | PHASE_36 gate and architect acceptance passed |

---

## Phase Goal

Remove the intentional one-document cap from the isolated bilingual v2 editor by making the
workspace actor a real parent over the proven Phase-33–36 document actor. Preserve independent
document/draft/history/artifact ownership, route every heavy job through the existing global
admission boundary, and add truthful multi-file selection, retry/remove, and deterministic Download
All without copying the legacy batch hook or turning the workspace session into a god-object.

The existing `/editor-v2` route and approved design system are the visual reference. No new external
design asset was provided. Public/scenario routes remain unchanged and noindex during this phase.

---

## Scope

### Architecture and domain

- [x] `T1` Freeze the Phase-37 ownership map, workspace/document/runtime lifecycle, import and
  scheduling policies, selection/draft/focus behavior, per-item status/error matrix, retry/remove/
  reset/dispose ordering, ZIP contract, stale-result matrix, performance marks, and target evidence.
  Audit legacy batch behavior signal by signal; rewrite only reviewed pure policies and never import
  legacy React hooks, mutable stores, components, or worker lifecycle — _Depends on:_ —
- [x] `T2` Record the composition refactor before implementation: the workspace actor owns only
  ordered membership/selection and child lifecycle; each document actor remains sole document
  writer; a workspace session composes a registry of focused per-document runtimes plus global
  collaborators. Update architecture/conventions only for durable rules proven by the slice —
  _Depends on:_ `T1`
- [x] `D1` Add framework-free workspace commands/events, bounded document-summary/import/error/
  aggregate types, runtime `WorkspaceItemId`, selection/removal outcomes, and exhaustive illegal-command decisions. Actor
  state contains IDs and bounded metadata only; files, blobs, URLs, pixels, controllers, promises,
  abort handles, worker refs, and child snapshot copies are forbidden — _Depends on:_ `T1`
- [x] `D2` Evolve the workspace actor for stable-ID dynamic child spawn, explicit selection,
  document-command routing, isolated remove, and deterministic dispose. Registration preserves
  order, rejects duplicate IDs, never mutates existing children, and leaves document revision,
  draft, history, error, and processing truth inside each child actor — _Depends on:_ `D1`, `T2`

### Browser runtime

- [x] `R1` Implement a bounded multi-file import coordinator that prepares JPEG/PNG/WebP items
  independently through the existing 20 MiB, safe-decode, and 4096 px boundary. Initial/add-image
  imports preserve input order, assign a runtime-owned item ID before a document exists, cap the
  workspace at 20 live pending/failed/registered items, and admit at most two preparations
  concurrently. Overflow, invalid, failed, cancelled, duplicate, or late preparation cannot create
  a fake document, register ownership for the wrong item, or disturb valid siblings — _Depends on:_ `D2`
- [x] `R2` Refactor runtime composition into a thin workspace-facing session plus one focused
  per-document runtime per child. Move projections, Manual/Magic/Background/Enhancement controllers,
  subscriptions, local labels/dimensions, and document cleanup behind that runtime; share only the
  artifact repository, heavy coordinator, model gateways, IDs, and proven commit collaborators —
  _Depends on:_ `T2`, `D2`
- [x] `R3` Implement runtime membership/selection/retry/remove/reset orchestration. Selection is an
  identity-only projection switch with no decode, reinference, materialization, actor recreation, or
  object-URL churn; unselected jobs may settle only for their owner. Retry starts one fresh run;
  remove/dispose cancels correlations and releases exactly the intended runtime/artifact graph —
  _Depends on:_ `R1`, `R2`
- [x] `R4` Extend global scheduling and observable batch summaries so every automatic, Magic, and
  Enhancement heavy stage across all documents passes through the one FIFO `HeavyJobCoordinator`.
  Make shared gateway cancellation document/run-scoped so one remove/reset cannot terminate or
  relabel a sibling; retain bounded warm workers/sessions rather than one model runtime per document.
  Derive aggregate counts/queue positions from child/runtime truth; do not add a second model queue,
  unbounded `Promise.all`, or mutable batch document store — _Depends on:_ `R2`, `R3`
- [x] `R5` Implement a narrow batch-export coordinator/port using the existing pinned `client-zip`.
  Lease completed committed PNG artifacts for one operation, emit collision-safe privacy-neutral
  names and fixed timestamps in document order, skip unfinished/error items truthfully, avoid
  reinference/re-encoding, and release all temporary leases/URLs on success/failure/cancel —
  _Depends on:_ `R3`

### Frontend

- [x] `F1` Extend the bilingual noindex v2 input for multiple-file initial import and add-image, and
  add an accessible responsive document filmstrip/list with selected state, local label, thumbnail,
  queued/running/result/error state, queue position, safe error details, retry, and remove. Keep
  status/focus meaningful without relying only on colour, hover, or pointer precision —
  _Depends on:_ `R1`, `R3`, `R4`
- [x] `F2` Compose the existing selected-document editor through the workspace session. Keyboard/
  pointer item switching restores the exact committed preview, active tool draft, tool settings,
  history, and viewport without reinference; dirty/running removal, reset, and navigation use
  explicit guards while ordinary selection preserves rather than discards the draft —
  _Depends on:_ `F1`, `R3`
- [x] `F3` Add truthful aggregate batch progress and selected PNG / Download All controls. Download
  All announces included/skipped counts, disables or confirms invalid states, reports preparation/
  failure/cancel accessibly, and leaves item selection, scrolling, editing, and unrelated controls
  responsive during import, inference, ZIP generation, and download — _Depends on:_ `F2`, `R5`

### Verification and infrastructure

- [x] `I1` Add table/model-based workspace/domain tests for ordered registration, duplicate/unknown
  IDs, child routing, selection, remove-next-selection policy, independent draft/history/revision,
  stale cross-item terminals, retry, dispose, and seeded randomized multi-document churn with zero
  reachable actor/runtime/artifact leak — _Depends on:_ `D2`
- [x] `I2` Add import/session/runtime/coordinator contracts for mixed valid/invalid/add-image input,
  bounded preparation, shared FIFO admission, unselected settlement, cached selection without
  reinference/URL churn, per-item crash/cancel/retry/remove, shared collaborator disposal, and
  exactly-once cleanup under at least three edited documents — _Depends on:_ `R4`
- [x] `I3` Add batch-export contracts for stable ordering, privacy-neutral unique names, fixed ZIP
  timestamps, completed-only snapshots, zero inference/re-encode, selected export isolation,
  progress/failure/cancel, and temporary lease/URL cleanup — _Depends on:_ `R5`
- [x] `I4` Add deterministic bilingual Playwright for multi-file import/add, queued progress,
  selection during heavy work, edits/drafts/history in different documents, isolated failure/retry/
  remove, selected export, Download All contents, keyboard/focus/dirty guards, reset, zero
  reinference, and resource cleanup. Keep the mocked lane parallel-safe, zero-retry, and sleep-free
  — _Depends on:_ `F3`, `I1`, `I2`, `I3`
- [x] `I5` Add serialized real-model and Windows Playwright MCP evidence for three documents across
  cold/warm Automatic, Magic, Enhancement, cached selection, editing, remove/retry where safely
  reproducible, ZIP export, scroll/control responsiveness, FIFO admission, and bounded resources
  after churn. Record unsupported signals instead of substituting host timing — _Depends on:_ `I4`
- [x] `I6` Run `/phase-gate 37`, production build/container smoke, dependency/license/model/security
  checks, Phase-37 suites, report verification, and architect affected-device review. Record
  versions, limitations, results, and unresolved review notes — _Depends on:_ `I5`

---

## Files

### Create / modify

~~~
docs/ARCHITECTURE_V2.md
docs/PHASE_37.md
docs/README.md
docs/SPEC.md
docs/STATE.md
docs/audits/PHASE_37_RESULTS.md
src/v2/domain/commands.ts
src/v2/domain/events.ts
src/v2/domain/ids.ts
src/v2/domain/index.ts
src/v2/application/workspace/
src/v2/application/document/
src/v2/runtime-browser/editor-session/
src/v2/runtime-browser/batch-import/
src/v2/runtime-browser/batch-export/
src/v2/runtime-browser/processing/
src/v2/runtime-browser/artifacts/
src/v2/presentation/workspace/
src/pages/editor-v2/
src/v2/testing/
messages/en.json
messages/ru.json
e2e/phase-37-batch-workspace.spec.ts
e2e/phase-37-batch-workspace.real.spec.ts
e2e/support/v2/
e2e/support/mock-editor-v2-worker.ts
scripts/profiling/v2/
package.json
playwright.config.ts
~~~

Existing files may be split only along the workspace/per-document ownership boundary required by
the phase. Every new semantic module exposes a narrow `index.ts`; imports outside the module use its
public API. `client-zip` is reused through a v2 runtime port rather than importing legacy export UI.

### Do NOT touch

- Main public/scenario routes, sitemap/indexing policy, or legacy `ToolWorkspace`, batch-processing,
  upload, download, editor hooks/components/state except read-only characterization of behavior
- Model families, weights, revisions, quality mapping, CDN manifest, inference privacy, or env vars
- Accounts, auth, billing, payments, database, storage, queues, server upload/processing, generated
  backgrounds, arbitrary export formats/adjustments, public cutover, or legacy removal
- Generic tool engines/event buses, base tool classes, inheritance hierarchies, catch-all utilities,
  shared mutable document/draft stores, second model queues, or workspace/session god-services

---

## Contracts

> This section is the source of truth for `/context-update`.

### New persistent data (tables / collections / files)

Repository Phase-37 results/evidence documentation only. Source files, document actors/runtimes,
drafts, histories, artifacts, thumbnails, ZIP inputs/outputs, and errors remain browser-tab memory
only. No database, IndexedDB, image storage, account, remote job, or new `localStorage` key.

### New API endpoints / RPC methods / events

No server API/RPC endpoint. New commands/events are in-process only:

```ts
type WorkspaceCommand =
  | { type: "REGISTER_DOCUMENT"; document: DocumentState }
  | { type: "SELECT_DOCUMENT"; documentId: DocumentId }
  | { type: "REMOVE_DOCUMENT"; documentId: DocumentId }
  | { type: "DOCUMENT_COMMAND"; documentId: DocumentId; command: DocumentCommand }
  | { type: "DISPOSE" };

type WorkspaceCommandOutcome =
  | { status: "accepted"; command: WorkspaceCommand["type"]; documentId?: DocumentId }
  | {
      status: "rejected";
      command: WorkspaceCommand["type"];
      documentId?: DocumentId;
      reason: "duplicate-document" | "document-not-found" | "workspace-disposed";
    };
```

Per-document processing commands/events remain the Phase-33–36 contract and retain document/run/
revision/draft correlation. Batch import/export progress is runtime-only bounded metadata, not a
server event or document command.

### New types / models / shared interfaces

```ts
type WorkspaceItemId = string;
type WorkspaceItemStatus =
  | "preparing"
  | "queued"
  | "processing"
  | "result"
  | "error";

type WorkspaceItemSummary = {
  itemId: WorkspaceItemId;
  documentId: DocumentId | null;
  fileName: string;
  status: WorkspaceItemStatus;
  error: ProcessingError | null;
};

type WorkspaceState = {
  documentIds: readonly DocumentId[];
  selectedDocumentId: DocumentId | null;
};

type EditorWorkspaceSnapshot = {
  itemIds: readonly WorkspaceItemId[];
  selectedDocumentId: DocumentId | null;
  items: readonly WorkspaceItemSummary[];
};

const WORKSPACE_ITEM_LIMIT = 20;
const IMPORT_PREPARATION_CONCURRENCY = 2;

type BatchExportSnapshot = {
  status: "idle" | "preparing" | "downloading" | "cancelled" | "error";
  includedCount: number;
  skippedCount: number;
};
```

`EditorWorkspaceSnapshot.items` is a read projection derived from import and child/runtime
snapshots, not mutable document truth. It contains no actor refs, file objects, binary values, URLs, histories, drafts,
controllers, native workers, or provider values. Existing document history remains capped at 20
operations / 96 MiB per document; the global heavy-job admission limit remains one.
The workspace live-item limit is 20, import preparation concurrency is two, and the existing
512 MiB `ArtifactRepository` budget remains the stricter byte-level limit.

### New env vars

None.

---

## Gate Checks

Run focused checks after each dependency-complete group, then `/phase-gate 37`. The complete
[`STACK.md`](../../STACK.md#gate-commands) gate applies, plus:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm arch:lint
pnpm e2e e2e/phase-37-batch-workspace.spec.ts --project=chromium --workers=1
pnpm e2e:phase-37-real
pnpm profile:phase-37 -- --verify
pnpm build
```

Fail on workspace-owned document truth; copied legacy hooks/state/lifecycle; files/binary/native
values in React/XState; more than 20 live items, more than two import preparations, or unbounded
import/heavy scheduling; selection decode/reinference/
materialization/URL churn; sibling mutation from failure/cancel/retry/remove; stale cross-item
publication; lost drafts/history/settings/focus; more than one admitted heavy job; duplicate child/
runtime/commit; ZIP reinference/re-encode/private metadata/nondeterminism; leaked actor, runtime,
artifact, URL, worker, session, listener, or lease; arbitrary sleep; retry-dependent pass; skipped
real-model/target evidence; regression of Phase-33–36 contracts; or an unresolved architect note.

---

## Architect Review Notes

- [x] No architect review issues recorded
- [x] Update the Phase-34 Manual history churn scenario to select the intended Erase/Restore mode
  explicitly on every iteration, preserving Phase-37 per-document tool-setting persistence while
  keeping the twenty-operation history/cleanup regression executable.
- [x] Disambiguate the Phase-35 Magic Remove-mode locator from the Phase-37 document-removal
  control by targeting its exact accessible name; retain strict locator semantics.

---

## Implementation Notes

- Per-document enhancement services share one warm worker client but retain document-scoped
  ownership and cancellation; disposing one document therefore cannot terminate a sibling's worker.
- Exact Windows worker-message counts were unsupported in the available MCP session and are
  recorded as `null` with the limitation instead of inferred from host evidence.

---

## Atomic Commit Message

```text
feat(phase-37): add v2 batch workspace and ZIP export
```

---

## Post-Phase Checklist

- [x] Scope completed in dependency order
- [x] Automated gates, real-model smoke, and target-device evidence green
- [x] Architect verifies batch/multi-document behavior on the affected browser/device
- [x] Architect review notes resolved
- [x] Run `/context-update 37`
- [x] Commit on `feat/phase-37`
- [ ] Tag `v0.37.0` only after merge
