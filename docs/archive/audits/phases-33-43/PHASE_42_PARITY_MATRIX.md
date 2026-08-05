# Phase 42 complete-product parity matrix

Schema: `phase-42.readiness.v1`
Frozen: 2026-08-05, before Phase-42 complete-product evidence capture

This is the exhaustive cutover-readiness surface for the isolated bilingual v2 routes. Every row
has an observable outcome, a current disposition, and an evidence owner. The matrix is frozen
before the final Phase-42 journeys: passing Phase-39–41 implementation evidence establishes why a
blocker can be reclassified, but does not substitute for current complete-product evidence.

Evidence owners:

- `A-*` — zero-retry deterministic Chromium, visual and automated accessibility evidence;
- `R-*` — serialized host real-model Chromium;
- `W-*` — managed-Windows Chromium observation;
- `P-*` — versioned performance/resource capture;
- `H-*` — architect acceptance or an already accepted Phase-33–41 contract.

## Frozen requirements

| ID | Surface | Observable acceptance in both locales | Evidence owner | Disposition | Current audit rationale |
|---|---|---|---|---|---|
| INPUT-01 | Picker | One or many valid JPEG/PNG/WebP inputs enter the same bounded local pipeline. | A-complete, R-full, W-product | required-parity | Implemented in Phases 33/37/39–40; current complete-product evidence pending. |
| INPUT-02 | Drop | Drop is equivalent to picker admission, including mixed valid/invalid batches. | A-complete, W-pointer | required-parity | Phase-38 blocker remediated by Phases 39–40; must be re-proven. |
| INPUT-03 | Paste | Clipboard image admission is equivalent to picker admission. | A-complete, W-keyboard | required-parity | Phase-38 blocker remediated by Phases 39–40; must be re-proven. |
| INPUT-04 | Validation | Unsupported, corrupt, oversized and over-capacity items fail recoverably while valid siblings continue. | A-complete, A-a11y, W-product | required-parity | Accepted behavior exists; current bilingual error evidence pending. |
| INPUT-05 | Downscale | Oversized dimensions are bounded locally with aspect ratio and privacy retained. | A-complete, R-full, P-full | required-parity | Accepted preparation contract; must be included in the final journey. |
| AUTO-01 | Automatic removal | Each admitted document runs once, reports truthful stages and publishes only its correlated result. | A-complete, R-full, W-product, P-full | required-parity | Core public outcome; no prior run is treated as current evidence. |
| AUTO-02 | Quality/fallback | Visible Fast/Maximum selection is captured per admission; WebGPU/WASM fallback and retry are truthful. | A-complete, R-full, W-product | required-parity | Phase-38 `LEGACY-01` blocker was remediated by Phases 39–40. |
| LIFE-01 | Single lifecycle | Import, progress, result, edit, selected PNG, cancel/retry/reset and disposal remain coherent. | A-complete, R-full, W-product | required-parity | Complete single-image public workflow. |
| LIFE-02 | Batch lifecycle | Up to 20 ordered documents retain isolated state with two preparations and one heavy job maximum. | A-complete, R-full, W-product, P-full, H-prior-contracts | accepted-difference | Phase 37 accepted stronger bounded scheduling/ownership than legacy. |
| LIFE-03 | Selection | Switching documents restores committed output, draft, settings and history without reinference. | A-complete, R-full, W-product, P-full, H-prior-contracts | accepted-difference | Phase 37 accepted cached-selection ownership. |
| TOOL-01 | Manual | One stable contained stage supports Restore/Erase, proportional white cursor, brush size, pan/zoom, contextual history and atomic Apply/Cancel. | A-complete, A-a11y, R-full, W-product | required-parity | Phase-42 regression fixes exist; full evidence pending. |
| TOOL-02 | Magic | One stable contained stage supports Keep/Remove, proportional colour cursor and Apply/Cancel; Apply predicts and commits the highest-ranked valid candidate. | A-complete, A-a11y, R-full, W-product | required-parity | Phase-42 narrows product UI while retaining the accepted correlated runtime. |
| TOOL-03 | Background | Every supported fill previews, applies/cancels atomically, remains selected and displays its committed result. | A-complete, A-a11y, R-full, W-product | required-parity | Phase-42 regression fix exists; full evidence pending. |
| TOOL-04 | Enhancements | Ordered stages remain responsive, publish one atomic result/no-op/error and retain the selected tool/result. | A-complete, A-a11y, R-full, W-product, P-full | required-parity | Phase-42 regression fix exists; target responsiveness pending. |
| TOOL-05 | Tool navigation | Switching, applying or cancelling never changes stage geometry, crops content, selects another tool or targets a sibling document. | A-complete, R-full, W-product | required-parity | Consolidates Phase-42 stable-identity and finishing-result regressions. |
| HIST-01 | History | Contextual draft and bounded document Undo/Redo/shortcuts mutate only the intended level without inference. | A-complete, W-keyboard, H-prior-contracts | accepted-difference | Phases 34–35 accepted two-level actor/runtime history. |
| RECOV-01 | Recovery | Cancel/retry/reset/dirty guards reject stale publication, restore focus and release the intended owner. | A-complete, A-a11y, R-full, W-product, P-full | required-parity | Recovery is both a public outcome and v2 invariant. |
| EXPORT-01 | Selected PNG | Original/2048/1024 export reads the selected committed result, excludes drafts and uses privacy-neutral naming. | A-complete, R-full, W-product | required-parity | Phase-38 `LEGACY-02` blocker was remediated in Phase 39. |
| EXPORT-02 | ZIP | ZIP includes ready committed results in workspace order, skips unfinished/errors truthfully and never reinfers. | A-complete, R-full, W-product | required-parity | Accepted Phase-37/40 behavior; current proof pending. |
| PARITY-01 | Complete presentation | Phase-39–41 desktop/narrow baselines cover every control, copy, dialog, status, batch item and tool panel without masking or silent omission. | A-visual, W-product, H-final | required-parity | Replaces Phase-38 `LEGACY-03`; implementation slices passed, final whole-product review pending. |
| COPY-01 | Localization | Labels, instructions, statuses, errors, shortcuts, privacy claims and announcements are equivalent in RU/EN. | A-complete, A-a11y, W-product, H-final | required-parity | Catalog and rendered behavior both require current review. |
| PRIV-01 | Privacy | No request or evidence exposes image content, filenames, prompts, strokes, colours, pixels or object URLs. | A-complete, R-full, W-product, H-final | required-parity | Browser-local privacy remains a product invariant. |
| A11Y-01 | Keyboard/focus | Logical order, visible focus, no traps, restoration, shortcuts and dirty dialogs work in every material state. | A-a11y, W-keyboard, H-final | required-parity | WCAG 2.2 AA and architect acceptance required. |
| A11Y-02 | Semantics | Controls, previews, progress, selection, errors and dialogs expose localized names/roles/states/values. | A-a11y, W-keyboard | required-parity | Scanner plus explicit semantic assertions required. |
| A11Y-03 | Announcements | Progress, queue, completion, validation, failure and recovery announce without duplicate noise. | A-a11y, W-keyboard, H-final | required-parity | Requires browser and human observation. |
| A11Y-04 | Pointer/touch | Canvas actions have alternatives where applicable and controls meet the approved coarse-pointer target contract. | A-a11y, W-pointer, H-final | required-parity | Fine/coarse input support must be recorded, including unsupported hardware. |
| A11Y-05 | Contrast/motion | No serious/critical accessibility finding remains; reduced motion removes nonessential motion. | A-a11y, W-product | required-parity | No broad scanner suppression is allowed. |
| RESP-01 | 200% zoom/reflow | Actual managed-Windows 200% browser zoom reflows without clipped actions or two-dimensional page scrolling. | A-a11y, W-zoom, H-final | required-parity | Phase-38 blocker remains open until actual Windows zoom is captured. |
| RESP-02 | Narrow layouts | Empty, processing, result, batch, dirty, error, dialog and export states remain operable at the approved narrow sample. | A-complete, A-a11y, W-product | required-parity | Must include both locales and selected batch documents. |
| PERF-01 | Responsiveness | Cold/warm automatic removal, Enhancement Apply, brush input, scroll and unrelated controls expose no missed/unresponsive interaction. | A-complete, R-full, W-product, P-full | required-parity | Phase-42 host defects were fixed; managed production evidence remains mandatory. |
| RES-01 | Resource ownership | Three import/edit/remove/reset/dispose cycles end with zero actors, runtimes, artifacts, leases, URLs, listeners and sessions. | A-complete, R-full, W-product, P-full, H-prior-contracts | accepted-difference | Phases 33–37 accepted the stronger explicit ownership model. |
| ACCEPT-01 | Final decision | One architect-accepted `ready` or `blocked` conclusion names every blocker, limitation and unsupported required signal. | H-final | required-parity | Cannot pass before complete product and managed-Windows review. |

## Phase-38 blocker re-audit

| Phase-38 blocker | Current classification | Evidence-based disposition |
|---|---|---|
| `INPUT-02` drop | required-parity | Implemented in Phases 39–40; current Phase-42 journey still required. |
| `INPUT-03` paste | required-parity | Implemented in Phases 39–40; current keyboard/browser proof still required. |
| `LEGACY-01` quality/model | required-parity as `AUTO-02` | V1-faithful control and per-admission capture implemented in Phases 39–40. |
| `LEGACY-02` export size | required-parity as `EXPORT-01` | Original/2048/1024 committed export implemented in Phase 39. |
| `LEGACY-03` complete control catalog | required-parity as `PARITY-01` | Phases 39–41 restored the visible surface; whole-product review is not yet captured. |
| `RESP-01` actual Windows 200% zoom | required-parity, target evidence passed | Native Chrome window zoom changed DPR from `1.21458` to `2.42916`; 520 px layout reflow remained contained and operable. Final architect acceptance is still required. |
| `A11Y-01/03/04`, `COPY-01` architect acceptance | cutover blocker until passed | Automation may support but cannot replace the required architect/target evidence. |
| Phase-38 unsupported cold/warm/Long Task signals | partially supported, fail-closed | Target Long Task/Event Timing, one-heavy-job, cached-selection and three-cycle ownership observations pass. Absolute duration fields remain explicitly unsupported, so `P-full` stays inconclusive. |

## Material states and samples

The deterministic and managed samples cover empty, picker/drop/paste focus, validation error,
preparing/queued/model-loading/processing, single result, multi-document selection, all four tool
drafts and their dirty dialogs, Enhancement running/no-op/error, history, PNG/ZIP export, retry,
cancel, reset and disposed cleanup in both locales.

Desktop is `1440×1000`; narrow is `390×844` plus the existing `360×800` operability sample.
Managed Windows additionally owns actual 200% browser zoom, keyboard, available fine/coarse pointer,
cold/warm responsiveness and environment metadata. Unsupported GPU/input/timing signals remain
explicit blockers when required; they are never inferred from WSL or represented as zero.
