# Phase 39 v1-faithful main-page results

Date: 2026-08-04

## Frozen v1 reference inventory

The rendered public `/` and `/en` routes at commit `53af139` are the normative visual and
interaction reference for Phase 39. Before any Phase-39 product edit, Playwright captures the full
page without masking product UI at desktop `1440×1000` and narrow `390×844` viewports.

| State | Observable reference |
|-------|----------------------|
| Empty | Site shell, localized hero/features, quality selector, picker/drop/paste affordance, footer |
| Input active | Keyboard focus treatment on the desktop dropzone or narrow choose-photo control |
| Quality choice | Maximum mode visibly selected while the complete empty composition remains present |
| Recoverable error | Unsupported input leaves the empty composition mounted and exposes localized retry |
| Model loading | Marketing intro is removed; editor stage and rail skeleton show correlated model progress |
| Processing | Editor stage reports background removal while the stable rail skeleton remains present |
| Single result | Compact editor toolbar, result surface, tool rail, reset/back, and selected PNG controls |
| Export size | Result remains visible while the Original/2048/1024 menu is open where applicable |

The deterministic fixture replaces only worker/model boundaries. Browser rendering, route locale,
focus, upload interaction, state transitions, responsive layout, and menu behavior remain real.
Animations and the text caret are stabilized through Playwright's supported screenshot options;
there are no masks or pixel-difference allowances. Phase-39 v2 comparisons reuse these exact names
for slice-owned presentation; SPEC v1.36 names the only states that require dedicated reviewed v2
baselines.

## Implemented and verified

- A narrow `MainPageEditorProjection` / `MainPageEditorIntent` presentation boundary now drives the
  v2 route without importing legacy workflow state, controllers, or workers.
- The v1 shell, hero, feature copy, quality control, empty workspace, editor stage, toolbar, upload
  controls, comparison surface, and split download control are shared controller-neutral UI rather
  than independently styled copies.
- Picker, drop, and paste use the same v2 import boundary. JPEG/PNG/WebP admission, the 20 MiB
  ceiling, worker-side downscale above 4096 px, localized recoverable errors, and explicit
  multi-file rejection are covered.
- Stored `fast|max` compatibility maps to explicit q8/fp32 policy; BEN2 remains session-only and the
  correlated run carries its selected model mode. Browser capability probing no longer blocks image
  admission while a WebGPU adapter is being resolved.
- Original, 2048, and 1024 transparent PNG exports read the committed v2 artifact, resize in a
  worker where needed, use privacy-neutral filenames, and leave the inference run count unchanged.
- Existing Manual, Magic, Background, and Enhancements behavior remains reachable from the initial
  result rail and continues on the accepted pre-Phase-39 v2 tool surface.

## Reviewed slice boundary

SPEC v1.36 resolves the contradictory boundary without broadening Phase 39. Exact v1 comparison
remains required for slice-owned presentation. Truthful desktop single-image copy and the existing
deferred v2 tool workspace use 16 dedicated bilingual desktop/narrow snapshots; no product UI is
masked and no general pixel tolerance is used. The frozen v1 baselines remain unchanged.

Phase-37/38 route-level batch-presentation journeys are historical while `/editor-v2` hosts this
single-image migration slice. Their actor/runtime/tool/export/SSR/resource contracts remain covered,
and route-level batch E2E returns with its dedicated UI slice. Managed-Windows complete-product
acceptance remains assigned to the later full-UI/public-cutover gate rather than being substituted by
WSL evidence.

## Architecture review remediation

The follow-up review recorded seven explicit notes in `PHASE_39.md`. The independently safe
architecture fixes are now implemented:

- the main view accepts only `MainPageEditorProjection` and `MainPageEditorIntent`; the session and
  arbitrary React result slot no longer cross that boundary;
- dimensions, execution path, effective fallback, export lifecycle, history availability, revision,
  admission errors, and focus restoration are projected rather than re-derived from image load or
  controller state in the view;
- capability selection and late WebGPU execution fallback are runtime-owned, correlated, stale-safe,
  and report their effective model/path back to the session; BEN2 is reselected to ISNet fp32 on
  WASM;
- resized export exposes preparing/succeeded/cancelled/error state, catches startup/post failures,
  terminates its worker deterministically, and does not leave an unhandled page promise;
- queued and active image preparation both cancel on item removal/session disposal through the
  platform cancellation adapter;
- new Phase-39 component files use kebab-case, controller-neutral public APIs, named effects, the v2
  Image/Typography primitives, and a single component per file; shared export-size ownership is no
  longer duplicated;
- the phase now declares its real-model Playwright spec and `pnpm e2e:phase-39-real` command.

Verification after remediation:

- `pnpm typecheck` — PASS.
- `pnpm lint` — PASS with only the pre-existing Fast Refresh warning in `shared/ui/button.tsx`.
- `pnpm arch:lint` — PASS.
- `pnpm test` — 665/665 PASS.
- `pnpm build` — PASS, including client, SSR, Nitro server output, generated routes/i18n, and sitemap.
- focused presentation/runtime/domain tests — 33/33 PASS before the full-suite rerun.
- mocked Phase-33–36 regression suite — 10/10 PASS after adapting page-object selectors to the
  approved Phase-39 shell; prior tool controllers and atomic edit behavior remain intact.
- Phase-39 Chromium — 9/9 PASS with zero retries. Frozen v1 snapshots remain unchanged; exact
  slice-owned comparisons and dedicated SPEC-approved difference snapshots are all green.
- Phase-39 serialized real-model Chromium — 1/1 PASS in 28.2 s; selected-model/fallback processing,
  result, resized PNG export, and no reinference were observed.
- Phase-37/38 route-level batch/cutover browser journeys are excluded as historical presentation
  evidence under SPEC v1.36; applicable Phase-33–38 unit/contract and Phase-33–36 browser regressions
  remain green.
- Public home/scenario regression — 43/43 PASS after fixing the exposed legacy batch-export menu
  regression.

## Phase gate

The first full E2E gate exposed one real migration regression: after a tool draft closed, the
result rail rendered document Undo/Redo but no longer owned the Ctrl/Cmd+Z/Y shortcut listener.
The neutral result rail now routes those keys through typed intents, skips editable targets, and
cleans up its listener. A stale Phase-34 image locator was also switched to the existing preview
page object. Focused Phase-34–36 browser regressions then passed 8/8.

The complete gate rerun passed:

- Docker production build/start — PASS; `app` healthy.
- `pnpm generate:code` and `pnpm tsc --noEmit` — PASS.
- `pnpm vitest run` — 175 files, 666 tests PASS.
- `pnpm e2e:full` — deterministic Chromium 106 PASS / 3 intentional skips, followed by legacy
  real-model smoke 1/1 PASS.
- container-network smoke — PASS.
- `pnpm lint` — PASS with only the pre-existing Fast Refresh warning in `shared/ui/button.tsx`;
  `pnpm arch:lint` — PASS.
- Phase-39 deterministic Chromium — 9/9 PASS; serialized Phase-39 real-model Chromium — 1/1 PASS.
- Architect review notes — 0 unchecked.

Overall `/phase-gate 39`: **PASS**.

All seven architecture review notes are resolved. Remaining batch/tool visual migration and public
cutover are explicitly later work, not hidden Phase-39 failures. The full phase gate, context update,
commit, and merge follow this report.
