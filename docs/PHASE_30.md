# PHASE 30 — Background & Export Tools

## Phase Metadata

| Field | Value |
|-------|-------|
| Phase | `30` |
| Title | Background & Export Tools |
| Status | `⏳ pending` |
| Tag | `v0.30.0` |
| Depends on | PHASE_29 gate passing |

---

## Phase Goal

Complete the focused editor toolbar by turning Background into an explicit draft/apply tool and
moving Download into a prominent split action with useful size choices. Keep every export local,
ship PNG only, and establish a typed extension seam for later formats without showing unavailable
options. The same Background and individual-export contract ships for a single image and every
selected completed batch item (SPEC.md §2.2, §3–§5.4, §7.1–§7.3, §7.7, §8).

## Design References

- Architect-provided remove.bg screenshot (2026-07-24) — Background as a toolbar tool and Download
  as the primary right-side action with an adjacent options menu.
- [Canva background help](https://www.canva.com/help/add-background/) — solid, gradient, and image
  backgrounds as one coherent editor tool; reference for grouping only.

---

## Scope

### Frontend

- [ ] `F1` Move transparent/solid/gradient/uploaded-image choices into the Background tool panel
  without changing current compositing semantics or privacy. Opening the tool seeds a draft from
  the committed document — _Depends on:_ —
- [ ] `F2` Preview background draft changes live behind the cutout, mark the panel dirty, and keep
  download bound to the committed result until Apply. Apply recomposites once and commits one
  `background` operation; Cancel restores the committed fill/preview. Drafts are item-local in a
  batch — _Depends on:_ `F1`
- [ ] `F3` Integrate Background operations with toolbar undo/redo, including uploaded-image blob
  reachability and cleanup after undo-branch replacement, reset, or history eviction — _Depends
  on:_ `F2`
- [ ] `F4` Replace the rail download button with a toolbar split action: primary Download uses the
  current/default settings; the adjacent menu exposes output size and repeats the explicit
  Download command. It acts on the current single/selected batch document — _Depends on:_ —
- [ ] `F5` Add `ExportSettings` with PNG and longest-side choices `original`, `2048`, `1024`.
  Hide 2048/1024 when they would upscale or duplicate another choice; preserve aspect ratio,
  alpha/background, colour bytes as practical, and deterministic filenames. Settings are isolated
  per batch item and never silently mutate another item — _Depends on:_ `F4`
- [ ] `F6` Generate resized output off the main interaction path with cancellation/latest-request
  guards and object-URL cleanup. Export from the committed document only; an unsaved Background or
  Cutout draft is never silently included — _Depends on:_ `F2`, `F5`
- [ ] `F7` Show no disabled WebP/JPEG controls. Keep `format: "png"` in the typed contract so later
  approved formats can extend the exporter without changing toolbar ownership — _Depends on:_ `F5`
- [ ] `F8` Add accessible split-button/menu keyboard behavior, selected-size announcement,
  disabled/busy state, plain-language retry/Original fallback on export failure, and mobile layout
  that keeps Download reachable without shifting the stage — _Depends on:_ `F4`–`F7`
- [ ] `F9` Add unit/component/integration tests for Background draft/apply/cancel/history, uploaded
  blob cleanup, size-option filtering, exact output dimensions/no upscale, preview/download
  consistency, alpha/composited background, stale/cancelled export, filenames, and accessibility —
  _Depends on:_ `F1`–`F8`
- [ ] `F10` Add bilingual cross-browser Playwright coverage: change each background type, Cancel
  and Apply, undo/redo, download Original and applicable 2048/1024 PNG, inspect dimensions/corner
  pixels, and verify unapplied drafts do not leak into files. Repeat core Apply/export/isolation
  behavior across two selected items from a multiple upload — _Depends on:_ `F9`
- [ ] `F11` Keep Download all as a client-generated ZIP of each item's committed result. Preserve
  the existing original-size bulk behavior; individual size selections remain item-local and do
  not silently alter ZIP output. Add compatibility tests for mixed per-item backgrounds and failed
  items without introducing batch-wide editing/settings — _Depends on:_ `F3`, `F5`, `F10`

### Infra

- [ ] `I1` Use existing browser canvas/worker capabilities; add no export library, server endpoint,
  upload, persistence, env var, analytics payload, route, or model asset — _Depends on:_ `F11`

---

## Files

### Create / modify

~~~
src/widgets/tool-workspace/ui/BackgroundToolPanel.tsx
src/widgets/tool-workspace/ui/BackgroundToolPanel.test.tsx
src/widgets/tool-workspace/ui/DownloadSplitButton.tsx
src/widgets/tool-workspace/ui/DownloadSplitButton.test.tsx
src/widgets/tool-workspace/model/use-tool-workspace-controller.ts
src/features/background-replacement/model/use-background-fill.ts
src/features/background-replacement/ui/BackgroundFillSelector.tsx
src/features/background-replacement/**/*.test.ts*
src/features/download-result/model/types.ts
src/features/download-result/lib/create-export.ts
src/features/download-result/lib/create-export.test.ts
src/features/download-result/lib/create-results-zip.ts
src/features/download-result/lib/create-results-zip.test.ts
src/features/download-result/ui/DownloadResultButton.tsx
src/features/download-result/ui/DownloadResultButton.test.tsx
src/features/download-result/index.ts
src/features/editor-history/
src/entities/edit-document/
src/widgets/tool-workspace/ui/EditorToolbar.tsx
src/widgets/tool-workspace/ui/ToolWorkspace.tsx
src/features/batch-processing/ui/BatchGrid.tsx
src/features/batch-processing/ui/BatchGrid.test.tsx
src/shared/ui/ (menu primitive only if not already present)
messages/ru.json
messages/en.json
e2e/home.spec.ts
e2e/hybrid-pipeline.spec.ts
docs/PHASE_30.md
~~~

### Do NOT touch

- Add WebP/JPEG, server export, cloud storage, persistence, accounts, or file-upload endpoints
- Expand background types beyond current transparent/color/gradient/image
- Batch-wide settings/conversion, Cutout/Enhancements algorithms, model/CDN/runtime policy
- Routes/SEO/analytics or Studio layers/transforms/effects

---

## Contracts

### New persistent data (tables / collections / files)

None. Export settings are session-only and are not added to localStorage.

### New API endpoints / RPC methods / events

None. Every export is generated and downloaded in the browser.

### New types / models / shared interfaces

```ts
type ExportFormat = "png";
type ExportSize = "original" | 2048 | 1024;

interface ExportSettings {
  format: ExportFormat;
  longestSide: ExportSize;
}
```

Numeric sizes are downscale-only and hidden when inapplicable. Primary Download defaults to
`{ format: "png", longestSide: "original" }` until the user chooses another session setting.

### New env vars

None.

---

## Gate Checks

Run `/phase-gate 30`; standard checks plus:

```bash
pnpm vitest run src/features/background-replacement src/features/download-result \
  src/features/editor-history src/widgets/tool-workspace
pnpm e2e e2e/home.spec.ts e2e/hybrid-pipeline.spec.ts
pnpm tsc --noEmit
pnpm exec steiger ./src
```

Fail if Download includes an unapplied draft, resizing upscales/distorts, alpha/background differs
from preview, Background is not undoable, uploaded blobs/object URLs leak, future formats appear as
fake controls, or any export leaves the browser.
Also fail if Background or sized individual export is unavailable for a selected batch item,
per-item drafts/settings leak, or the existing committed-output ZIP behavior regresses.

---

## Architect Review Notes

- [x] No architect review issues recorded

## Implementation Notes

None

## Atomic Commit Message

```text
feat(phase-30): add background drafts and sized PNG export
```

## Post-Phase Checklist

- [ ] Scope complete; gates green; review notes resolved
- [ ] Run `/context-update 30`
- [ ] Commit on `feat/phase-30`; tag `v0.30.0` after merge
