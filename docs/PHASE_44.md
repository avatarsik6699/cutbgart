# PHASE 44 — Frontend Decomposition and Render Ownership

<!-- TOKEN BUDGET: keep this file under 10,000 tokens. Be concise. -->

## Phase Metadata

| Field | Value |
|-------|-------|
| Phase | `44` |
| Title | Frontend Decomposition and Render Ownership |
| Status | `🔄 in-progress` |
| Tag | `v0.44.0` |
| Depends on | PHASE_43 complete and tagged `v0.43.0` |

---

## Phase Goal

Refactor the accepted Phase-43 public frontend in one checkpoint-driven phase. Reuse the existing
components and v2 core while decomposing large compositions, moving subscriptions toward leaf
consumers, stabilizing meaningful component boundaries, and deleting only reachability-proven
obsolete surfaces. Preserve product behavior, visual presentation, accessibility, privacy,
domain/runtime ownership, models, exports, routes, and operations.

No new design assets are required. The accepted Phase-43 bilingual desktop/narrow presentation is
the visual and interaction reference.

---

## Checkpoint Workflow

The stable execution order is `T2 → T3 → T4 → T5 → T5A → T6 → T7 → T8 → T1`. IDs are deliberately
not renumbered: `T1` is the final end-state verification requested by the architect, while `T5A`
records the post-cutover structural convergence added during T5 acceptance.

For each implementation checkpoint:

1. Run `/impl-assist 44 <ID>` for one task only.
2. Apply `frontend-implementation`, Fallow guard/trace where relevant, and only task-specific
   unit/component/render/Playwright/type/lint checks. A frontend checkpoint requires
   `Frontend contract: PASS` before completion.
3. Stop for architect manual behavior and code review. Record actionable findings under Architect
   Review Notes and resolve them with `/impl-assist 44 R[N]`.
4. After explicit architect acceptance, create one conventional checkpoint commit and only then
   start the next task.

The architect explicitly authorizes checkpoint commits without the full phase gate. This is a
Phase-44 exception to the repository's usual pre-commit gate rule, not a general workflow change.
No checkpoint commit closes the phase or authorizes deployment. `T1`, `/phase-gate 44`, resolved
review notes, final architect acceptance, `/context-update 44`, and the final phase commit/tag remain
mandatory for closure.

### Prospective frontend contract

T4–T7 apply `FRONTEND_CONVENTIONS.md` to every capability deliberately touched. Keep stable
session/view-model references above leaf connectors; do not pass session objects, actor snapshots,
broad projections, catch-all intents, or JSX slots through intermediate presentation components.
Every extraction must own state/lifecycle, policy, accessibility/error behavior, a meaningful
layout region, or proven repeated behavior. FSD layer direction and entity/feature isolation stay
strict, while barrels and role folders are created only for real public or navigation boundaries.
Each checkpoint verifies ownership, selector identity, meaningful abstractions, behavior, and
render isolation.

---

## Scope

### Other

- [x] `T2` Freeze a retained/removable inventory, archive completed Phase-33–43 contracts and
  superseded phase evidence under the indexed `docs/archive/` structure, and remove only source,
  tests, exports, profiling helpers, or adapters whose production/test/internal-tool/build/
  operations consumers have been traced. Preserve `v0.43.0` as the recoverable source snapshot;
  do not create a compilable `src/archive` tree — _Depends on:_ —
- [x] `T3` Decompose the route-neutral public page shell and composition around the existing
  layout, header, footer, localized scenario content, diagnostics boundary, and session lifetime.
  Keep route/SEO/SSR/visual behavior unchanged and prevent shell-level state from invalidating the
  editor subtree without need — _Depends on:_ `T2`
- [x] `T4` Decompose image admission and processing-mode presentation into focused input, drop/
  paste, validation/error, quality-selection, and batch-admission owners. Subscribe or hold local UI
  state at the smallest consumer and preserve current validation, focus, accessibility, and
  localized behavior. Apply the prospective decomposition contract above to every touched
  capability — _Depends on:_ `T3`
- [x] `T5` Decompose the single-image preparation, automatic processing, progress, result,
  comparison, recovery, export-size, and PNG presentation. Replace broad parent projections with
  narrow stable selectors/props while preserving current session commands, cancellation,
  correlation, committed-result, and export behavior. Apply the prospective decomposition contract
  above to every touched capability — _Depends on:_ `T4`
- [x] `T5A` Remove migration-era structure and naming from the active implementation. Move the
  framework-independent core to `src/editor/{domain,application,runtime,testing}`, merge React
  presentation and the stable model/composition root under `src/widgets/editor`, rename active
  `public-editor`, `editor-v2`, E2E-support, profiling, configuration, and architecture-document
  paths to permanent semantic names, and leave only compatibility redirect URLs, versioned
  cache/report/protocol identifiers, and traceability evidence with v2 naming. Preserve every
  owner, selector identity, worker URL,
  user-visible behavior, and public route — _Depends on:_ `T5`
- [x] `T6` Decompose batch, active-document, toolbar, Manual/Magic Cutout, Background, Enhancements,
  history, canvas, and navigation-guard presentation into explicit render owners. Keep high-frequency
  pointer/canvas/view state imperative or tool-local, and preserve the accepted v2 controllers,
  artifact/resource lifecycle, per-document isolation, and one workflow source of truth —
  apply the prospective decomposition contract above to every touched capability — _Depends on:_
  `T5A`
- [x] `T7` Audit the decomposed surface for remaining broad subscriptions, unstable projections,
  callback/slot fan-out, and unrelated subtree invalidation. Move XState/external-store selectors
  to leaf connectors, stabilize identities, and add `memo`/`useMemo`/`useCallback` only across
  meaningful stable boundaries; add focused render-regression tests where deterministic and retain
  the prospective decomposition contract in every follow-up extraction — _Depends on:_ `T6`
- [x] `T8` Decide whether a state-manager spike is still justified after T7. Default to the
  existing XState/runtime/React mechanisms; if a remaining render problem warrants MobX or another
  dependency, isolate the spike, consult current primary docs, prove one-way UI/view-model
  ownership and measurable benefit, and obtain explicit architect approval before retaining it.
  Record a no-add decision when the existing mechanisms meet the contract — _Depends on:_ `T7`
- [ ] `T1` Perform final end-state render/subscription review, focused React render/commit evidence,
  managed-Windows Chrome performance/resource verification, repeated upload/reset/batch/tool churn,
  complete bilingual deterministic and real-model journeys, full architecture/Fallow/security/
  build/container/release checks, and architect acceptance so the phase is ready for the separate
  `/phase-gate 44` workflow. Pre-refactor render counters and Chrome traces are intentionally not
  required; do not claim a numeric before/after improvement — _Depends on:_ `T2`, `T3`, `T4`, `T5`,
  `T5A`, `T6`, `T7`, `T8`

---

## Files

### Create / modify

~~~text
.agents/skills/frontend-implementation/
eslint.config.js
steiger.config.ts
docs/SPEC.md
docs/STATE.md
docs/README.md
docs/PHASE_44.md
docs/ARCHITECTURE.md
docs/audits/
docs/archive/
messages/
public/sw.js
scripts/profiling/editor/verify-phase-*-reports.ts
scripts/service-worker-cache.test.ts
src/shared/lib/brush-geometry.ts
src/routes/
src/pages/
src/widgets/editor/
src/widgets/site-footer/
src/widgets/site-header/
src/widgets/site-shell/
src/editor/
src/shared/lib/
src/shared/ui/
src/features/upload-image/
src/features/quality-mode-toggle/
src/features/download-result/
src/features/model-storage/
e2e/phase-44-frontend-refactor.spec.ts
e2e/support/
scripts/profiling/editor/
package.json
pnpm-lock.yaml
~~~

`package.json` and `pnpm-lock.yaml` may change only if T8 receives explicit architect approval for
a retained dependency, T2 removes a traced unused dependency, or the architect-approved T3 review
adds the narrowly scoped `react-error-boundary` dependency. Runtime/application selector APIs may
be touched narrowly when a leaf connector needs an existing value; expand this list in the phase
before broader runtime changes.

### Do NOT touch

- Production deployment state, VPS, DNS, Cloudflare, live caches, analytics data, or secrets
- Product routes, localized copy, SEO/structured-data outcomes, visual design, or user capabilities
- Domain command/event semantics, document/history invariants, worker protocols, processing models,
  model assets/revisions, artifact formats, export formats, privacy policy, or remote/backend scope
- Browser resource ownership merely to reduce React renders; binary/runtime values stay outside
  React and XState

---

## Contracts

> This section is the source of truth for `/context-update`.

### New persistent data (tables / collections / files)

Phase-44 inventory and final evidence files only. No user data, database, IndexedDB, cache, or new
`localStorage` key.

### New API endpoints / RPC methods / events

None. Existing routes, domain commands/events, worker protocols, and export contracts remain
unchanged.

### New types / models / shared interfaces

No new product/domain model. Small presentation props, selector return types, and component-local
view contracts may be introduced only for concrete decomposed consumers. They must not mirror the
document/workspace actor model or carry browser resources.

### New env vars

None.

---

## Gate Checks

### Checkpoint verification

Each T2–T8 plan, including T5A, must name exact focused checks before editing. Prefer file-scoped Vitest and the
single affected Phase-44 Playwright journey; run typecheck or lint when the changed boundary needs
them. For editor core/widget architecture files, run Fallow guard on the changed paths. Full-project,
real-model, container, security, release, and Chrome evidence is deferred to T1 unless needed to
diagnose a newly observed checkpoint failure.

### Final verification

Run `/phase-gate 44` and every command in [`STACK.md`](./STACK.md#gate-commands), plus:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm arch:lint
pnpm quality:fallow
pnpm quality:fallow:review
pnpm e2e e2e/phase-44-frontend-refactor.spec.ts --project=chromium
pnpm e2e:full
pnpm build
pnpm audit --prod --audit-level high
pnpm security:licenses
pnpm sync-model-assets -- --check
pnpm release:test
pnpm release:test:docker
```

T1 must apply the final frontend contract checklist, verify the managed Windows browser boundary,
collect end-state Chrome render/performance/resource evidence for the accepted flows, and
exercise repeated import/reset/batch/tool/apply/cancel/dispose churn. Fail on visible/behavioral/
accessibility drift, unrelated render fan-out without justification, mirrored workflow state, stale
publication, resource leakage, missing checkpoint acceptance, unchecked review notes, or any gate
waiver.

---

## Architect Review Notes

- [x] Replace the imported ceremony-heavy frontend rules with the approved ownership/render
  contract, add the project-local `frontend-implementation` skill, make it mandatory in
  `/impl-assist`, remove `review-v2-architecture`, and align SPEC/architecture/stack/state without
  duplicating the canonical rules.
- [x] Remove `PublicEditorDiagnostics` and the `HeaderUtilities` relay. Let the application-specific
  site header own diagnostics and the home-only model-storage utility through a semantic page
  variant while preserving all accepted header interactions and route behavior.
- [x] Rework the current uncommitted T5 public-editor composition around one stable
  `EditorSession`/view-model provider, cached external-store snapshots, leaf XState/session
  selectors, and semantic commands. Remove intermediate session/snapshot/broad-projection/intent
  drilling and add focused behavior, lifecycle, and render-isolation coverage before T6.

- [x] Rename the design-system popover wrapper from the scenario-specific `HelpPopover` to a
  capability-neutral public name, including its file, test, exports, consumers, and documentation,
  without changing the already verified interaction contract.
- [x] Apply the approved capability namespace convention consistently to every production
  `.types.ts` module and the T4 `main-page-editor-contract.ts` type surface; use concise namespace
  members, update public APIs/consumers/tests, and add lint enforcement so newly added standalone
  exports cannot silently reintroduce prefixed type names.
- [x] Clean `MainPageImageAdmission` and the other T4-touched components of redundant prop aliases;
  move multi-branch admission-state derivation behind one named local hook/policy with an explicit
  switch while preserving stable callbacks, reset-based preparation cancellation, and one workflow
  source of truth. Make the no-redundant-alias rule prospective documentation.
- [x] Introduce a design-system-owned declarative popover/tooltip primitive under the nearest
  `shared/ui` capability, centralizing Base UI composition, controlled open/dismiss arbitration,
  portal positioning, close affordance, and accepted styling; migrate `MaximumQualityHelp` to
  content/trigger props or children without capability-owned `useState`/`useRef` machinery and add
  focused interaction coverage.
- [x] Remove the nested conditional class selection from `QualityModeOption` through a named style
  policy and enforce the existing no-nested-ternary rule across all frontend code. Evaluate a
  shared Input primitive against proven repetition, extracting one only if it can own a coherent
  reusable contract rather than merely wrapping the native quality-mode radio.
- [x] Replace prefixed exports in the `.types.ts` files introduced by T4 with capability-owned
  TypeScript namespaces and update the frontend convention so consumers use explicit
  `CapabilityTypes.Member` ownership without repeating the capability prefix on every member.
- [x] Refine T4 file-admission internals: use the approved narrow default-destructuring exception
  instead of reassigning optional params, prevent callback identity from re-subscribing paste
  listeners through a reusable `useLatest`-style shared hook or the current React equivalent, and
  replace avoidable clipboard collection transformations with a bounded allocation-conscious loop;
  make these hard prospective conventions and cover callback freshness/listener stability.
- [x] Make clipboard image admission discoverable inside the drop-zone presentation with a
  design-system-aligned localized affordance and browser coverage, while preserving desktop/mobile,
  keyboard, focus, MIME, multiple-file, and disabled behavior.
- [x] Make file admission a cohesive state owner: render validation, preparation/progress,
  cancellation, and failure feedback inside the drop-zone/choose-file surface rather than as
  detached sibling blocks, without moving runtime validation or processing truth into presentation.
- [x] Supersede the earlier hand-written dynamic-import hook/loader with the
  architect-approved `react-error-boundary` plus React `lazy`/`Suspense`; preserve open-triggered
  loading, accessible loading/error feedback, chunk caching, and focused rejection coverage while
  removing the custom async module state machinery.
- [x] Replace the flat diagnostics module with the architect-mandated capability layout: keep its
  main file/public API/types and named utilities at the capability root, place child components in
  `components/`, hooks in `hooks/`, stateful loaders/services in `model/`, and move
  `presentation/shared` tests into `presentation/shared/tests`; make this the hard prospective
  frontend convention for later Phase-44 work.
- [x] Group the T3 diagnostics capability under a semantic
  `src/widgets/editor/ui/shared/diagnostics` public module and decompose its UI into one meaningful
  component per file.
- [x] Replace the class-based diagnostics lazy-load error boundary with an explicit function-based
  dynamic-import loader that preserves closed-by-default loading, contained error feedback, and
  stale-publication safety without adding a dependency.
- [x] Decompose `DiagnosticsBody` into readable empty, runtime-detail, and log owners; replace the
  compound `hasDetails` expression with a named tested policy and introduce reusable semantic
  description-list primitives under `shared/ui` for the repeated `dl`/`dt`/`dd` structure.
- [x] Add a validated declarative date-formatting boundary under `shared/lib/formatting`, migrate direct
  UI date construction in diagnostics and site footer, audit remaining `new Date` uses by
  ownership, and document that presentation code must not call native date APIs directly.
- [x] Move the v2-owned `Image` and `Typography` primitives, tests, and public exports from
  `src/editor/shared/ui` into semantic capability modules under repository-wide `src/shared/ui`, update
  every consumer and architecture boundary, and remove the now-redundant `src/editor/shared` tree.
- [x] Replace raw text elements in T3-touched static-page and site-chrome components
  with the shared `Typography` primitive while preserving semantic heading levels, accepted visual
  classes, accessibility, and localized content.
- [x] Make `ScenarioPageLayout` reuse the shared `Image` and `Typography` primitives while
  preserving intrinsic example dimensions, meaningful alt text, lazy-loading policy, DOM semantics,
  and the accepted layout.
- [x] Replace the diagnostics panel's bare loading/empty presentation with design-system-aligned
  skeleton, empty, and lazy-load error states while preserving the closed-by-default Sheet/Drawer
  contract and accessible status semantics.
- [x] Enrich downloaded-model storage with manifest-backed per-model names, roles, cached sizes,
  file counts, runtime metadata, and release information; keep the panel concise and never infer
  cache contents that the service worker has not verified.
- [x] Keep the header utility triggers eager, but load the model-storage manager and diagnostics
  body through module-scoped lazy imports only when their Base UI overlays open; preserve
  immediate trigger availability, accessible loading feedback, and existing interactions.
- [x] Move application-specific `SiteHeader` and `SiteFooter` from `shared/ui` into widgets, let
  `SiteShell` compose them directly through the approved widget cross-import exception, remove the
  diagnostics portal/boundary and redundant utility-slot relay, and rename all JSX/component slot
  props to PascalCase while preserving accepted header/footer/editor behavior.
- [x] Replace the flat `src/shared/ui` file list with capability-owned public modules for site
  chrome, editor workspace, status feedback, overlays, controls, surfaces, and scenario layout;
  preserve the root `shared/ui` public API and avoid a layer-wide `components/` dumping ground.
- [x] Replace `SiteHeader`'s local hydration effect/state with the shared `useIsHydrated` hook.
- [x] Remove the unnecessary `onWorkspaceUtilityChange` alias while keeping the callback ref
  stable and lint-clean.
- [x] Decompose `site-header` into focused owned UI modules and remove repeated internal-link
  markup through a typed TanStack `createLink` presentation primitive with explicit presets.
- [x] Extract the Telegram feedback anchor into one shared external-link component reused by the
  header, footer, and privacy page; do not combine router and external-link semantics into one
  polymorphic component.
- [x] Apply the same ownership/repetition test to later Phase-44 checkpoints: extract meaningful
  subcomponents and shared primitives into capability-owned structure without speculative wrappers.

---

## Implementation Notes

- T2 retained package-script, E2E, operations, release, service-worker, and v2 testing entry points
  after consumer tracing; it removed only the five files recorded in
  `docs/audits/PHASE_44_CLEANUP_INVENTORY.md`. The immutable `v0.43.0` tag remains the source
  rollback snapshot, and the historical reports moved without changing their verifier semantics.
- T3 separated route-neutral page composition from the editor session lifetime and consolidated
  the four scenario layouts without changing route copy, DOM semantics, image dimensions, or
  classes. Fallow's local-`Props` advisories are intentionally retained to follow
  `FRONTEND_CONVENTIONS.md`; the reported arbitrary max-width is the exact accepted scenario class
  moved from four files, not new styling.
- T3 review promoted generic `useIsHydrated` to `shared/lib/react`, decomposed `site-header` by
  capability, and introduced separate typed internal `SiteLink` and semantic external
  `FeedbackLink` primitives. A polymorphic router/external link was rejected because it would mix
  navigation contracts; later architect review standardized capability-local `components/` for
  child UI while continuing to forbid layer-wide component dumping grounds.
- T3 review grouped the formerly flat `shared/ui` surface into capability modules: `controls`,
  `editor-workspace`, `overlays`, `scenario`, `site`, `status`, and `surfaces`. The root barrel
  remains the stable cross-slice API; internal modules use their nearest capability API. Fallow's
  path-relative report treats moved legacy exports and complexity as introduced code; rename-aware
  diff review confirmed those findings belong to unchanged files and no new boundary, cycle,
  unresolved-import, or duplication finding was introduced by the grouping.
- T3 review replaced the temporary header portal/context/state bridge with direct composition.
  The later ownership review removed its `HeaderUtilities` relay as well: `widgets/site-header`
  now owns diagnostics and its home-only model-storage utility behind a semantic shell variant.
  SPEC v1.44 retains downward layer dependencies and entity/feature slice isolation while
  permitting same-layer widget/page composition where it removes adapter-only code.
- T3 review consolidated `Image` and `Typography` under repository-wide `shared/ui`; large editor
  owners received import-only changes for that move, while their decomposition remains scoped to
  T5/T6 and their render/subscription audit remains scoped to T7.
- React 19 still exposes rejected-`lazy` containment through class error boundaries rather than a
  function hook. T3 initially owned that state explicitly; later architect review approved the
  focused `react-error-boundary` dependency so presentation can use declarative `lazy`/`Suspense`
  composition without repository-owned class or async module-state machinery.
- The date audit moved UI time/current-year formatting behind `shared/lib/formatting`. Fixed ZIP
  `Date` values, explicit test fixtures, model-lab report clocks, and the injected performance
  collector clock remain at their non-presentation ownership boundaries; replacing them with a
  display formatter would weaken deterministic or injectable contracts.
- The ownership review supersedes T3's mandatory folder template. Capability-local `components/`,
  `hooks/`, `model/`, `.types.ts`, `.utils.ts`, and barrels are used only when they clarify a real
  responsibility or public boundary; anonymous layer-wide dumping grounds and one-file ceremony
  remain forbidden.
- T4 consumer tracing removed the unreachable legacy `features/upload-image` preparation worker,
  hook, validator, and prepared-result UI. Active public input now emits raw `File` values through
  `FileAdmission`; the cancellable `src/editor/runtime/editor-session/image-import-preparation.ts`
  boundary remains the sole validation, resizing, and preparation owner.
- T4 review uses React 19.2 `useEffectEvent` for the paste listener instead of a repository-owned
  `useLatest` ref relay: the listener remains registered while the Effect Event observes the latest
  committed callback. Admission preparation maps its Cancel control to the existing `reset` intent,
  because that path removes the pending item and cancels its import; `session.cancel()` intentionally
  targets an already-created document's active processing run.
- T4 review did not introduce a generic `Input` wrapper: the quality selector's visually hidden
  full-card radio is the only consumer with that exact accessibility/layout contract, while the
  other native inputs are file, range, colour, or internal-lab controls. A tag-only wrapper would
  add indirection without a reusable validation, styling, or behavior policy.
- Chromium interaction verification exposed a Base UI arbitration edge case where pointer movement
  opened help transiently before the same click attempted to close it. `InteractivePopover` now
  promotes that hover-open state to a persistent press-open state while retaining repeat-press,
  Escape, outside-press, and explicit Close dismissal; the phase E2E owns the real-browser
  regression.
- T5 now binds one stable `PublicEditorModel`/`EditorSession` provider to leaf connectors. Cached
  external-store snapshots and XState selectors publish only values consumed by each view, while
  semantic commands replace broad projection/intent relays. `EditorV2ActiveDocument` and the
  remaining `editor-v2-*` tool/canvas owners stay unchanged for T6 rather than mixing tool
  decomposition into this ownership correction.
- The T5 ownership correction passed TypeScript, ESLint, Steiger, focused Fallow changed-path
  analysis, the full Vitest suite, and all three Phase-44 Chromium journeys. The repository-wide
  Fallow audit still reports accumulated Phase-44 findings outside this correction and remains a
  T1 end-state obligation; no finding on the corrected paths gates this checkpoint.
- T5 was manually accepted by the architect and committed as `ffee773` together with its dependent
  T4 state, because the isolated staged T4 snapshot referenced files that T5 deliberately removed.
- T5A is a structural convergence only: the editor core now lives under `src/editor`, React
  composition under `src/widgets/editor`, and E2E/profiling helpers under semantic `editor` paths.
  Redirect-only `/editor-v2` routes, externally versioned cache/report/protocol identifiers, and
  audit traceability keep their historical/version meaning. Fallow reports no boundary,
  unresolved-import, or circular-dependency defects, but its new-only comparison against `main`
  classifies the repository-wide moves as introductions; the phase-end T1 audit remains responsible
  for the final baseline-aware quality decision.
- T5A was manually accepted by the architect before the T6 checkpoint began.
- T6 keeps durable workflow and resource ownership in `EditorSession`/document actors while a
  stable `ActiveDocumentModel` owns only UI selection, cutout mode, and pending navigation. Leaf
  connectors subscribe at their consumers; the broad workspace projection/intent relay was
  removed. Manual and Magic retain their related pointer, RAF, pan/zoom, canvas resource, and
  cleanup paths in focused canvas owners rather than splitting one imperative lifecycle across
  components.
- T6 was manually accepted by the architect before the T7 audit began.
- T7 retains the batch-rail projection because that direct connector/view boundary consumes the
  complete workspace membership, status, selection, admission, and export contract with a stable
  memo comparator. Toolbar and stage slots likewise terminate at the layout owner rather than
  relaying through intermediate components. Whole active-document subscriptions and root-level
  progress/revision invalidation were removed instead.
- T7 was manually accepted by the architect before the T8 state-manager decision began.
- T8 records a no-add decision. After T7, XState remains the sole workflow owner,
  `EditorSession`/runtime stores retain resource and publication ownership, stable presentation
  models retain UI-only commands/preferences, and leaf React selectors pass the focused render
  regressions. No remaining measured render defect justifies a MobX or other state-manager spike,
  mirrored workflow state, or another runtime dependency.
- T8 was manually accepted by the architect. Final T1 verification has not begun and remains
  deferred while the architect prepares additional requirements to scope as T9.

<!-- Add only intentional deviations, residual risks, or rejected alternatives not visible in git. -->

---

## Atomic Commit

```text
refactor(phase-44): decompose frontend render ownership
```

Checkpoint commits follow the task-specific conventional scope approved during manual review. The
atomic commit above is the final phase-closing commit after T1 and the full gate.
