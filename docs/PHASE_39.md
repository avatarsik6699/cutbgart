# PHASE 39 — V1-Faithful Main Page on V2

<!-- TOKEN BUDGET: keep this file under 10,000 tokens. Be concise. -->

## Phase Metadata

| Field | Value |
|-------|-------|
| Phase | `39` |
| Title | V1-Faithful Main Page on V2 |
| Status | `⏳ pending` |
| Tag | `v0.39.0` |
| Depends on | PHASE_38 blocked evidence reviewed; architect explicitly approved iterative remediation without public cutover |

---

## Phase Goal

Reproduce the established bilingual v1 main-page presentation over the accepted v2 architecture for
one complete single-image journey: empty workspace, picker/drop/paste, quality choice, processing,
result, export-size choice, and transparent PNG. Work stays on `/editor-v2` and `/en/editor-v2`;
public and scenario routes remain on legacy until later slices complete the full UI contract.

## Design References

- Current rendered `/` and `/en` pages before Phase-39 product edits — normative desktop and narrow
  visual/interaction reference. No separate Figma or replacement design was provided.

---

## Scope

### Product and architecture

- [ ] `T1` Before product edits, freeze a bilingual v1 reference-state inventory and reviewed
  Playwright screenshot baselines for empty, input-active, preparing/model-loading, processing,
  single-result, recoverable-error, quality-choice, and export-size states at the approved desktop
  and narrow viewports. Do not mask product UI or accept unexplained pixel drift — _Depends on:_ —
- [ ] `T2` Define a narrow controller-neutral main-page presentation contract using the SPEC
  `MainPageEditorProjection` and `MainPageEditorIntent`. Extract/reuse v1 visual components where
  practical; v2 must not import legacy hooks, mutable workflow state, stores, workers, or controllers
  as its source of truth, and two independently styled copies are forbidden — _Depends on:_ `T1`

### Frontend

- [ ] `F1` Reproduce the v1 `SiteShell`, hero/feature content, workspace layout, empty state, labels,
  responsive breakpoints, header utility placement, focus order, and accessibility semantics on the
  bilingual noindex v2 routes using shared/controller-neutral presentation — _Depends on:_ `T2`
- [ ] `F2` Connect one-image picker, drop, and clipboard admission to the existing v2 import boundary.
  Preserve the v1 JPEG/PNG/WebP validation, 20 MiB limit, 4096 px downscale, localized recoverable
  errors, keyboard/pointer behavior, and privacy. Multi-file admission belongs to the later batch UI
  slice and must not be silently accepted or discarded here — _Depends on:_ `F1`
- [ ] `F3` Preserve the visible v1 quality/model control and existing `qualityMode` preference using
  the explicit `isnet-q8 | isnet-fp32 | ben2-fp16` v2 policy. The selected mode must determine the
  correlated automatic run and truthful fallback/status copy without creating a second workflow
  state owner. Keep stored `fast|max` compatibility; BEN2 remains session-only — _Depends on:_ `F2`
- [ ] `F4` Render preparing, model-loading, processing, cancellation, retry, recoverable error, and
  single-result states with v1 visual hierarchy and controls while retaining v2 actor/artifact/
  worker ownership, stale-result rejection, responsive interaction, and deterministic cleanup —
  _Depends on:_ `F3`
- [ ] `F5` Preserve the v1 Original/2048/1024 export-size control and selected transparent PNG flow.
  Export reads the committed v2 result, performs only required off-main-path resize/encode work, uses
  privacy-neutral naming, and never reruns inference — _Depends on:_ `F4`

### Verification and evidence

- [ ] `I1` Add focused unit/component/contract coverage for projection-to-view rendering, intent
  routing, drop/paste equivalence, quality persistence/policy selection, export sizing, SSR, focus,
  cancellation/stale completion, and resource release — _Depends on:_ `F5`
- [ ] `I2` Add zero-retry bilingual deterministic Playwright coverage that drives the complete
  Phase-39 journey and compares v2 states to the frozen v1 visual baselines on desktop and narrow
  Chromium. Baseline updates require explicit review; animations/caret may be stabilized, but product
  controls, copy, errors, results, and layout may not be masked — _Depends on:_ `I1`
- [ ] `I3` Run one serialized real-model journey and managed Windows Playwright review covering
  picker, drop or paste, every quality mode supported by the device, fallback limitations,
  cancellation/retry, result, every applicable export size, keyboard, pointer, and narrow layout.
  Record unsupported GPU/browser/input signals rather than substituting WSL evidence — _Depends on:_
  `I2`
- [ ] `I4` Verify public/scenario route identity, SEO/indexing, analytics semantics, legacy behavior,
  accepted Phase-33–38 architecture/resource contracts, and repeated import/reset/dispose cleanup do
  not regress. Publish a Phase-39 result that names remaining batch/tool/public-cutover work —
  _Depends on:_ `I3`

---

## Files

### Create / modify

~~~
docs/PHASE_39.md
docs/audits/PHASE_39_RESULTS.md
src/v2/application/
src/v2/runtime-browser/
src/v2/presentation/
src/v2/shared/ui/
src/pages/editor-v2/
src/widgets/tool-workspace/ui/
src/features/upload-image/
src/features/quality-mode-toggle/
src/features/download-result/
src/shared/ui/
src/shared/lib/inference/
src/styles/
messages/en.json
messages/ru.json
e2e/phase-39-main-page-ui.spec.ts
e2e/phase-39-main-page-ui.real.spec.ts
e2e/phase-39-main-page-ui.spec.ts-snapshots/
e2e/support/v2/
scripts/profiling/v2/
package.json
pnpm-lock.yaml
playwright.config.ts
~~~

Only controller-neutral presentation may be extracted from legacy slices. Keep semantic module
public APIs narrow and update exact files discovered during implementation rather than broadening
ownership beyond this list.

### Do NOT touch

- Public `/`, `/en`, scenario route bindings, route identity, sitemap, canonical/indexing policy,
  public navigation, or analytics wiring/semantics
- Legacy hooks, controllers, mutable workflow state, worker lifecycle, stores, or their behavior
- Batch/contact-sheet UI, Manual/Magic, Background, Enhancements, or Download All presentation
- Domain actor ownership, history/tool contracts, artifact ownership, remote processing, server APIs,
  accounts, auth, billing, database/storage, model families/weights/revisions, or privacy policy
- Legacy removal, public cutover, unrelated design-system changes, or a new visual design

---

## Contracts

> This section is the source of truth for `/context-update`.

### New persistent data (tables / collections / files)

- Reviewed Playwright screenshot baselines under
  `e2e/phase-39-main-page-ui.spec.ts-snapshots/` are versioned repository test evidence.
- Existing `localStorage["qualityMode"]` continues to store only `"fast" | "max"`, mapped to
  `isnet-q8 | isnet-fp32`; BEN2 remains session-only. No new key or user content is persisted.

No database, IndexedDB, server store, image, filename, prompt, pixel, URL, draft, history, or editor
state persistence is introduced.

### New API endpoints / RPC methods / events

None. `/editor-v2` and `/en/editor-v2` retain their separate noindex identities; public and scenario
routes continue rendering legacy.

### New types / models / shared interfaces

```ts
type AutomaticModelMode = "isnet-q8" | "isnet-fp32" | "ben2-fp16";
type ExportSize = "original" | 2048 | 1024;

type MainPageEditorIntent =
  | { type: "choose-files"; files: readonly File[] }
  | { type: "choose-quality"; mode: AutomaticModelMode }
  | { type: "cancel" }
  | { type: "retry" }
  | { type: "reset" }
  | { type: "choose-export-size"; size: ExportSize }
  | { type: "download-selected" };

type MainPageEditorProjection = {
  locale: "ru" | "en";
  phase:
    | "empty"
    | "preparing"
    | "loading-model"
    | "processing"
    | "result"
    | "error";
  qualityMode: AutomaticModelMode;
  exportSize: ExportSize;
  progressPercent: number | null;
  retryable: boolean;
  sourcePreviewUrl: string | null;
  committedResultUrl: string | null;
};
```

The projection is a read-only presentation value. URLs are runtime-owned preview handles and never
enter actors, persistence, analytics, reports, or snapshots. Intent translation delegates to v2
application/runtime owners and contains no workflow logic.

### New env vars

None.

---

## Gate Checks

Run `/phase-gate 39` before committing. In addition to every command in
[`docs/STACK.md`](./STACK.md#gate-commands), run:

```bash
pnpm e2e e2e/phase-39-main-page-ui.spec.ts --project=chromium
pnpm e2e:phase-39-real
```

Phase-specific PASS additionally requires:

- reviewed v1 baselines and v2 comparisons for both locales at desktop and narrow viewports, with no
  unexplained visual difference or masked product UI;
- picker/drop/paste, quality policy, processing/retry/cancel, export sizing, and committed PNG pass
  through v2 ownership with no reinference, stale publication, freeze, lost input, or reachable leak;
- the serialized real-model and managed Windows samples are completed with limitations recorded;
- public/scenario routes and SEO/indexing/analytics behavior remain unchanged;
- all Architect Review Notes are resolved.

---

## Architect Review Notes

Use this section after manual visual/product verification. Add one unchecked checkbox per
independently fixable visual or behavioral mismatch. A redesign or accepted difference requires an
explicit SPEC change; do not approve unexplained drift by updating a screenshot baseline.

- [x] No architect review issues recorded

---

## Implementation Notes

None

---

## Atomic Commit Message

```text
feat(phase-39): reproduce v1 main-page flow on v2
```

---

## Post-Phase Checklist

- [ ] All Scope checkboxes checked (or deferred in Architect Review Notes)
- [ ] All automated gate checks green
- [ ] All architect review notes resolved
- [ ] Architect verifies bilingual desktop/narrow v1 visual and behavioral parity
- [ ] `docs/STATE.md` updated — run `/context-update 39`
- [ ] Committed atomically on `feat/phase-39` branch
- [ ] Tag created after merge: `git tag -a v0.39.0 -m "Phase 39: v1-faithful main page on v2"`
