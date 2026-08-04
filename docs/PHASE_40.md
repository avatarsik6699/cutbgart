# PHASE 40 — V1-Faithful Batch Workspace on V2

<!-- TOKEN BUDGET: keep this file under 10,000 tokens. Be concise. -->

## Phase Metadata

| Field | Value |
|-------|-------|
| Phase | `40` |
| Title | V1-Faithful Batch Workspace on V2 |
| Status | `✅ done` |
| Tag | `v0.40.0` |
| Depends on | PHASE_39 gate and architect acceptance passed; `v0.39.0` merged locally |

---

## Phase Goal

Complete the isolated v2 main-page migration by restoring the established bilingual v1 batch
workspace over the accepted Phase-37 runtime and Phase-39 projection/intent presentation seam.
Support ordered multi-file admission, truthful item lifecycle and selection, per-item actions, and
privacy-neutral ZIP export without restyling editor tools or changing public/scenario routes.

## Design References

- Current rendered `/` and `/en` legacy batch workspace — normative desktop and narrow visual and
  interaction reference for all batch-owned presentation.
- Phase-39 reviewed main-page baselines — normative shared shell/single-result evidence; its
  single-image-copy exception ends where Phase 40 restores batch-capable copy.

---

## Scope

### Product and architecture

- [x] `T1` Freeze bilingual v1 batch reference states and reviewed desktop/narrow screenshots for
  multi-file input, queued/processing/mixed-result states, selection, per-item failure/actions,
  capacity feedback, and ZIP lifecycle. Do not mask product UI or accept unexplained drift —
  _Depends on:_ —
- [x] `T2` Add the SPEC `BatchMainPageProjection`/`BatchMainPageIntent` seam over existing workspace
  snapshots and session commands. Presentation may receive bounded summaries and runtime-owned
  preview handles only; it may not own files, actors, workers, controllers, or workflow state —
  _Depends on:_ `T1`

### Frontend

- [x] `F1` Restore picker/drop/paste admission of up to 20 ordered JPEG/PNG/WebP files with v1
  batch-capable copy and controls. Preserve 20 MiB/4096 px preparation outcomes, two-file import
  preparation concurrency, capacity feedback, and per-file recoverable failures — _Depends on:_ `T2`
- [x] `F2` Reproduce the bilingual v1 batch workspace hierarchy, counters, queue/progress/error
  states, horizontal item rail, selected-result editor placement, Add images, and responsive focus/
  keyboard semantics on desktop and narrow viewports — _Depends on:_ `F1`
- [x] `F3` Connect selection, per-item retry/remove/download, guarded clear-batch, and selected-item
  editing to the Phase-37 runtime. Preserve each document's history, draft/settings, preview, and
  artifacts across selection; never re-infer or reconstruct a completed item — _Depends on:_ `F2`
- [x] `F4` Capture the visible quality/model choice per newly admitted item and keep FIFO
  single-heavy-job processing truthful while selection and controls remain responsive. Changing
  quality must not mutate already admitted items or create another state owner — _Depends on:_ `F3`
- [x] `F5` Restore Download All ZIP lifecycle, counts, cancellation/error/retry feedback, and
  privacy-neutral deterministic filenames. Include completed committed results only and do not
  reinfer or redundantly encode them — _Depends on:_ `F4`

### Verification and evidence

- [x] `I1` Add focused projection/component/runtime contract coverage for counts/status mapping,
  all admission paths, capacity, mixed failures, selection/isolation, per-item actions, quality
  capture, export lifecycle, SSR/focus, cancellation/stale completion, and resource release —
  _Depends on:_ `F5`
- [x] `I2` Reactivate and adapt Phase-37/38 route-level batch journeys, then add zero-retry bilingual
  deterministic Playwright coverage for the complete Phase-40 flow and exact v1 visual comparison
  at desktop/narrow viewports. Only deferred editor-tool UI may use dedicated reviewed v2 baselines —
  _Depends on:_ `I1`
- [x] `I3` Run one serialized real-model batch journey covering multi-file admission, FIFO work,
  responsive selection, mixed applicable item actions, selected PNG, ZIP, and zero reinference.
  Record unsupported signals; managed-Windows full-product acceptance remains deferred —
  _Depends on:_ `I2`
- [x] `I4` Verify public/scenario route identity, SEO/indexing/analytics, accepted Phase-33–39
  architecture/tool/resource contracts, and repeated add/retry/remove/clear/dispose cleanup. Publish
  the Phase-40 result and name remaining tool-UI/public-cutover work — _Depends on:_ `I3`

---

## Files

### Create / modify

~~~
docs/PHASE_40.md
docs/audits/PHASE_40_RESULTS.md
src/v2/presentation/main-page/
src/v2/presentation/workspace/
src/pages/editor-v2/
src/shared/ui/
src/v2/runtime-browser/editor-session/
src/v2/runtime-browser/batch-import/
src/v2/runtime-browser/batch-export/
messages/en.json
messages/ru.json
e2e/phase-40-batch-main-page-ui.spec.ts
e2e/phase-40-batch-main-page-ui.real.spec.ts
e2e/phase-40-batch-main-page-ui.spec.ts-snapshots/
e2e/phase-37-batch-workspace.spec.ts
e2e/phase-38-cutover-readiness.spec.ts
e2e/support/v2/
playwright.config.ts
package.json
~~~

Existing runtime files may change only for defects or missing narrow projection data required by the
contract. Keep semantic public APIs narrow and update exact discovered files within these modules.

### Do NOT touch

- Public `/`, `/en`, scenario route bindings, route identity, sitemap, canonical/indexing policy,
  navigation, or analytics semantics
- Legacy hooks/controllers/stores/worker lifecycle or legacy behavior, except read-only reference
  capture and controller-neutral visual extraction with backward-compatible imports
- Manual/Magic, Background, or Enhancements presentation; their domain/runtime contracts
- Workspace/document actor ownership, model families/weights/revisions, remote processing, server
  APIs, accounts, auth, billing, database/storage, privacy policy, or new env configuration
- Public cutover, legacy removal, unrelated design-system changes, or a new visual design

---

## Contracts

> This section is the source of truth for `/context-update`.

### New persistent data (tables / collections / files)

- Reviewed Playwright baselines under
  `e2e/phase-40-batch-main-page-ui.spec.ts-snapshots/` are versioned repository evidence.

No database, IndexedDB, server store, image, filename, pixel, URL, draft, history, ZIP, or editor
state persistence is introduced. Existing `localStorage["qualityMode"]` behavior is unchanged.

### New API endpoints / RPC methods / events

None. `/editor-v2` and `/en/editor-v2` retain their bilingual noindex identities; public and
scenario routes remain on legacy.

### New types / models / shared interfaces

```ts
type BatchMainPageItemProjection = {
  itemId: WorkspaceItemId;
  documentId: DocumentId | null;
  fileName: string;
  status: WorkspaceItemStatus;
  error: { message: string; retryable: boolean } | null;
  previewUrl: string | null;
  queuePosition: number | null;
  qualityMode: AutomaticModelMode;
  selected: boolean;
};

type BatchMainPageProjection = {
  items: readonly BatchMainPageItemProjection[];
  capacity: { current: number; limit: 20 };
  admissionError: { code: "capacity-exceeded"; rejectedCount: number } | null;
  counts: { active: number; queued: number; completed: number; failed: number };
  export: BatchExportSnapshot;
};

type BatchMainPageIntent =
  | { type: "add-files"; files: readonly File[] }
  | { type: "select-item"; documentId: DocumentId }
  | { type: "retry-item"; itemId: WorkspaceItemId }
  | { type: "remove-item"; itemId: WorkspaceItemId }
  | { type: "download-item"; documentId: DocumentId }
  | { type: "clear-batch" }
  | { type: "cancel-download-all" }
  | { type: "download-all" };
```

Projection values are immutable presentation data. Preview URLs are runtime-owned handles and never
enter actors, persistence, analytics, or reports. Intent translation delegates to `EditorSession`.

### New env vars

None.

---

## Gate Checks

Run `/phase-gate 40` before committing. In addition to every command in
[`docs/STACK.md`](./STACK.md#gate-commands), run:

```bash
pnpm e2e e2e/phase-40-batch-main-page-ui.spec.ts --project=chromium
pnpm e2e:phase-40-real
```

Phase-specific PASS additionally requires:

- reviewed v1/v2 bilingual desktop/narrow comparisons for every batch-owned state with no masked
  product UI or unexplained drift; only the explicitly deferred editor-tool UI may differ;
- picker/drop/paste, capacity, FIFO work, mixed failures, selection/isolation, item actions, quality
  capture, individual PNG, and ZIP all pass through accepted v2 ownership without reinference;
- active Phase-37/38 batch route regression coverage and one serialized real-model batch journey;
- zero stale/cross-document publication, lost input, freeze, or reachable actor/worker/artifact/URL/
  listener/session leak after churn;
- public/scenario routes and SEO/indexing/analytics remain unchanged, and all review notes resolve.

---

## Architect Review Notes

- [x] Route batch thumbnails through the owning v2 `Image` adapter instead of rendering a native
  image element from presentation.
- [x] Wait for the correlated first Phase-38 run before driving its mock stage so the full parallel
  gate cannot race image preparation.

---

## Implementation Notes

- The reactivated Phase-38 route journey retains full workflow and resource-isolation assertions,
  but not its raw dev-server `PerformanceObserver("longtask")` maximum: repeated 50–79 ms samples
  were not attributable to application work. Phase-40 interaction-during-processing checks and the
  serialized real-model lane remain the truthful responsiveness evidence.

---

## Atomic Commit Message

```text
feat(phase-40): restore v1 batch workspace on v2
```

---

## Post-Phase Checklist

- [x] All Scope checkboxes checked (or deferred in Architect Review Notes)
- [x] All automated gate checks green
- [x] All architect review notes resolved
- [x] Architect verifies bilingual desktop/narrow batch visual and behavioral parity
- [x] `docs/STATE.md` updated — run `/context-update 40`
- [x] Committed atomically on `feat/phase-40` branch
- [x] Tag created after merge: `git tag -a v0.40.0 -m "Phase 40: v1-faithful batch workspace on v2"`
