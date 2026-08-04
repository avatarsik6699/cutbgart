# Phase 38 cutover-readiness parity matrix

Schema: `phase-38.readiness.v1`
Frozen: 2026-08-04, before Phase-38 product fixes

This matrix is the exhaustive cutover-validation surface. Every row is bilingual (`ru`, `en`) and
must retain an observable acceptance, disposition, rationale, status, and current evidence before
the readiness evaluator can return `ready`. Evidence must use neutral document IDs and counts;
filenames, image bytes, strokes, colours, URLs, prompts, and user content are forbidden.

Evidence owners:

- `A-*` — deterministic Chromium, including axe and explicit accessibility assertions
- `R-*` — serialized host real-model Chromium
- `W-*` — managed Windows Playwright MCP observation
- `P-*` — versioned performance/resource report
- `H-*` — architect decision or affected-device acceptance

T2 resolved every freeze-time placeholder. `required-parity` means the observable outcome must pass
before cutover. The 2026-08-04 post-report review clarified that v2 may use different internal code,
state, and processing ownership but must reproduce the rendered v1 visual presentation and controls;
an accepted architectural difference is not permission for visible UI drift. Existing Phase-33–37
acceptance remains valid only for the internal workflow contracts named below.

| ID | Signal | Observable acceptance in both locales | Evidence owner | Disposition | Audit rationale |
|---|---|---|---|---|---|
| INPUT-01 | Picker | Multi-select accepts valid JPEG/PNG/WebP and starts local preparation. | A-journey, W-product | required-parity | Both products expose a file picker; v2 already accepts `multiple`. |
| INPUT-02 | Drop | Dropping one or many valid images has the same outcome as the picker. | A-journey, W-pointer | cutover-blocker | Legacy `UploadDropzone` handles drop; v2 has no drop handler. This is a newly required input capability and cannot be added in validation. |
| INPUT-03 | Paste | Pasting a valid clipboard image has the same outcome as the picker. | A-journey, W-keyboard | cutover-blocker | Legacy `UploadDropzone` handles clipboard images; v2 has no paste handler. This is a newly required input capability and cannot be added in validation. |
| INPUT-04 | Validation | Unsupported, oversized, corrupt, and over-capacity inputs fail per item with a recoverable localized message; valid siblings continue. | A-journey, A-a11y, W-product | required-parity | Validation and sibling isolation are public outcomes; exact error composition may differ. |
| INPUT-05 | Downscale | Oversized dimensions are bounded locally with aspect ratio retained and no user-content persistence. | A-journey, R-full, P-full | required-parity | Both implementations must honor the accepted local input bounds. |
| AUTO-01 | Automatic removal | Each admitted document runs exactly once, reports truthful stages, and publishes only its correlated result. | A-journey, R-full, W-product, P-full | required-parity | Automatic-first processing is the common core outcome. |
| AUTO-02 | Fallback | Unsupported or failed WebGPU falls back truthfully to WASM; terminal failure remains retryable without changing other documents. | A-journey, R-full, W-product | required-parity | SPEC requires device fallback and recoverable failure. |
| LIFE-01 | Single lifecycle | Import, progress, result, edit, selected PNG, retry/cancel/reset, and disposal remain operable. | A-journey, R-full, W-product | required-parity | This is the minimum public single-image workflow. |
| LIFE-02 | Batch lifecycle | Up to 20 documents retain order and isolated state; at most two preparations and one heavy job run concurrently. | A-journey, R-full, W-product, P-full | accepted-difference | Phase 37 architect acceptance deliberately replaced legacy scheduling with bounded v2 ownership. |
| LIFE-03 | Selection | Selecting another document restores its committed state, draft, settings, and history without reinference or URL churn. | A-journey, R-full, W-product, P-full | accepted-difference | Phase 37 architect acceptance explicitly approved the v2 contact-sheet and cached-selection contract. |
| TOOL-01 | Manual | Restore/Erase, brush size, zoom, gesture Undo/Redo, Apply/Cancel, dirty guard, and focus behavior preserve the accepted Phase-34 contract. | A-journey, A-a11y, R-full, W-product | accepted-difference | Phase 34 accepted explicit runtime-owned drafts and atomic Apply/Cancel instead of legacy mutable editing. |
| TOOL-02 | Magic | Keep/Remove, brush size, bounded strokes, Predict, candidates, Apply/Cancel, retry, and dirty guard preserve the accepted Phase-35 contract. | A-journey, A-a11y, R-full, W-product | accepted-difference | Phase 35 accepted guided candidate prediction as the replacement Magic workflow. |
| TOOL-03 | Background | Transparent/colour/gradient/local-image preview and atomic Apply/Cancel preserve the accepted Phase-36 contract. | A-journey, A-a11y, R-full, W-product | accepted-difference | Phase 36 accepted runtime-owned preview and one atomic commit. |
| TOOL-04 | Enhancements | Ordered fine-detail/colour-halo work has truthful queued/running/no-op/error states and one atomic Apply. | A-journey, A-a11y, R-full, W-product | accepted-difference | Phase 36 accepted ordered stages and atomic publication instead of legacy mutable tool state. |
| HIST-01 | Document history | Undo/Redo and shortcuts traverse bounded committed operations without inference; a new edit clears redo. | A-journey, W-keyboard, P-full | accepted-difference | Phase 34 accepted actor-owned bounded document history. |
| RECOV-01 | Cancel/retry/reset | Cancellation cannot publish stale work; retry is isolated; reset/dispose release resources and restore a coherent focus target. | A-journey, A-a11y, R-full, W-product, P-full | required-parity | Recovery is a public outcome and a v2 safety invariant. |
| EXPORT-01 | Selected PNG | Download uses the selected committed result, uses a neutral filename, and never exports an unapplied draft. | A-journey, R-full, W-product | accepted-difference | Phases 33–37 accepted committed-only export and privacy-neutral names. |
| EXPORT-02 | Download All | ZIP includes ready committed results in workspace order, truthfully skips unfinished/errors, and uses neutral entry names. | A-journey, R-full, W-product | accepted-difference | Phase 37 accepted deterministic ZIP assembly and truthful skips. |
| PRIV-01 | Browser-local privacy | No application request contains source/result content; reports, snapshots, logs, and filenames contain no user content. | A-journey, R-full, W-product, H-privacy | required-parity | Browser-local privacy is a product invariant, not an implementation choice. |
| A11Y-01 | Keyboard and focus | Logical Tab order, visible focus, no traps, focus restoration, shortcuts, dialogs, and dirty guards work in every material state. | A-a11y, W-keyboard, H-a11y | required-parity | Accessibility is functionality under SPEC. |
| A11Y-02 | Names/roles/states | Controls, previews, progress, selections, errors, and dialogs expose localized names, roles, values, and state. | A-a11y, W-keyboard | required-parity | Accessibility is functionality under SPEC. |
| A11Y-03 | Announcements | Progress, completion, queue, validation, failure, and recovery changes are announced without noisy duplicate live updates. | A-a11y, W-keyboard, H-a11y | required-parity | Accessibility is functionality under SPEC. |
| A11Y-04 | Pointer/touch | Canvas actions have keyboard controls where applicable; controls remain usable with coarse pointer and approved touch targets. | A-a11y, W-pointer, H-a11y | required-parity | Accessibility and affected-device operability are cutover conditions. |
| A11Y-05 | Contrast/motion | Automated contrast has no serious/critical finding and reduced-motion removes nonessential motion. | A-a11y, W-product | required-parity | WCAG 2.2 AA and reduced-motion behavior are cutover conditions. |
| RESP-01 | 200% zoom/reflow | At 200% zoom and a 640 CSS-pixel viewport, content reflows without two-dimensional page scrolling or clipped actions. | A-a11y, W-zoom, H-a11y | required-parity | WCAG reflow and operability are cutover conditions. |
| RESP-02 | Narrow responsive states | Empty, processing, result, multi-document, dirty draft, error, dialog, and export states remain reachable and operable at 360×800. | A-a11y, A-journey, W-narrow | required-parity | Public routes must remain usable on the approved narrow sample. |
| RES-01 | Resource ownership | Three full churn cycles end with no residual actor, runtime, artifact, lease, object URL, listener, session, or cross-document publication. | A-journey, P-full, W-product | accepted-difference | Phases 33–37 explicitly accepted the stronger v2 ownership contract. |
| LEGACY-01 | Quality/model choice | Legacy quality/model choice has an explicit architect-approved v2 disposition; it is not silently dropped. | H-parity | cutover-blocker | Legacy exposes `QualityModeToggle`/`QualityModePopover`; v2 fixes automatic model policy and has no architect decision accepting removal. |
| LEGACY-02 | Export-size choice | Legacy export-size choice has an explicit architect-approved v2 disposition; it is not silently dropped. | H-parity | cutover-blocker | Legacy `DownloadSplitButton` exposes original/HD sizing; v2 exports one committed size and has no architect decision accepting removal. |
| LEGACY-03 | Remaining legacy controls | Every other legacy-only control or promised outcome is listed and explicitly disposed. | A-legacy-audit, H-parity | cutover-blocker | Source audit found drop and paste as the remaining legacy-only controls; their blockers are INPUT-02/03. No evidence yet proves the catalog exhaustive to architect satisfaction. |
| COPY-01 | Bilingual discoverability | Labels, instructions, shortcuts, statuses, errors, and privacy claims are complete and equivalent in Russian and English. | A-a11y, A-journey, W-product, H-product | required-parity | Locale parity is an explicit Phase-38 cutover condition. |

## Legacy/v2 difference inventory

| Difference | Legacy source | V2 source | Disposition |
|---|---|---|---|
| Drop and clipboard input | `features/upload-image/ui/UploadDropzone.tsx` | Picker-only `editor-v2-stage.tsx` | Blocked by INPUT-02/03. |
| Quality/model choice | `quality-mode-toggle`; `ToolWorkspace.tsx` | Fixed `runtime-browser/processing/model-config.ts` policy | Blocked by LEGACY-01 pending architect product decision. |
| Output-size choice | `download-result/ui/DownloadSplitButton.tsx` | One committed-size PNG/ZIP export | Blocked by LEGACY-02 pending architect product decision. |
| Explicit draft Apply/Cancel, bounded history, guided candidates, contact sheet, neutral names | Legacy mutable tool/batch surfaces | Accepted Phase-34–37 v2 contracts | Accepted difference under the recorded phase acceptance rationale. |
| Fine/wide preview grid toggle | No legacy equivalent | `editor-v2-page.tsx` | Blocked by LEGACY-03 under the v1-presentation preservation decision; Phase 39 replaces the isolated route presentation rather than carrying this extra public control forward. |

## Material workspace states

Automated accessibility evidence must scan both locales in: empty, preparing/queued, processing,
single result, multi-document result, Manual draft, Magic draft/candidates, Background draft,
Enhancement draft/running, validation error, processing error/retry, dirty-guard dialog, and export
completion. Explicit keyboard/focus/zoom/reflow checks supplement the scanner; scanner exclusions
must name the excluded selector/rule and rationale and cannot suppress serious or critical impact.

## Target samples

- Desktop: managed Windows Chromium, keyboard and fine pointer.
- Narrow: managed Windows Chromium at 360×800, keyboard and pointer.
- Reflow: managed Windows Chromium at 640 CSS px with browser zoom at 200%.
- Reduced motion: Chromium `prefers-reduced-motion: reduce`.
- GPU/OS/browser/input limitations are recorded as evidence, never inferred from WSL.
