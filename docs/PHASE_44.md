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

The stable execution order is `T2 → T3 → T4 → T5 → T6 → T7 → T8 → T1`. IDs are deliberately not
renumbered: `T1` is the final end-state verification requested by the architect.

For each implementation checkpoint:

1. Run `/impl-assist 44 <ID>` for one task only.
2. Use focused `review-v2-architecture`, Fallow guard/trace where relevant, and only task-specific
   unit/component/Playwright/type/lint checks.
3. Stop for architect manual behavior and code review. Record actionable findings under Architect
   Review Notes and resolve them with `/impl-assist 44 R[N]`.
4. After explicit architect acceptance, create one conventional checkpoint commit and only then
   start the next task.

The architect explicitly authorizes checkpoint commits without the full phase gate. This is a
Phase-44 exception to the repository's usual pre-commit gate rule, not a general workflow change.
No checkpoint commit closes the phase or authorizes deployment. `T1`, `/phase-gate 44`, resolved
review notes, final architect acceptance, `/context-update 44`, and the final phase commit/tag remain
mandatory for closure.

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
- [ ] `T4` Decompose image admission and processing-mode presentation into focused input, drop/
  paste, validation/error, quality-selection, and batch-admission owners. Subscribe or hold local UI
  state at the smallest consumer and preserve current validation, focus, accessibility, and
  localized behavior — _Depends on:_ `T3`
- [ ] `T5` Decompose the single-image preparation, automatic processing, progress, result,
  comparison, recovery, export-size, and PNG presentation. Replace broad parent projections with
  narrow stable selectors/props while preserving current session commands, cancellation,
  correlation, committed-result, and export behavior — _Depends on:_ `T4`
- [ ] `T6` Decompose batch, active-document, toolbar, Manual/Magic Cutout, Background, Enhancements,
  history, canvas, and navigation-guard presentation into explicit render owners. Keep high-frequency
  pointer/canvas/view state imperative or tool-local, and preserve the accepted v2 controllers,
  artifact/resource lifecycle, per-document isolation, and one workflow source of truth —
  _Depends on:_ `T5`
- [ ] `T7` Audit the decomposed surface for remaining broad subscriptions, unstable projections,
  callback/slot fan-out, and unrelated subtree invalidation. Move XState/external-store selectors
  to leaf connectors, stabilize identities, and add `memo`/`useMemo`/`useCallback` only across
  meaningful stable boundaries; add focused render-regression tests where deterministic —
  _Depends on:_ `T6`
- [ ] `T8` Decide whether a state-manager spike is still justified after T7. Default to the
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
  `T6`, `T7`, `T8`

---

## Files

### Create / modify

~~~text
.agents/skills/review-v2-architecture/
eslint.config.js
steiger.config.ts
docs/SPEC.md
docs/STATE.md
docs/README.md
docs/PHASE_44.md
docs/ARCHITECTURE_V2.md
docs/audits/
docs/archive/
messages/
public/sw.js
scripts/profiling/v2/verify-phase-*-reports.ts
scripts/service-worker-cache.test.ts
src/shared/lib/brush-geometry.ts
src/routes/
src/pages/
src/widgets/public-editor/
src/widgets/site-footer/
src/widgets/site-header/
src/widgets/site-shell/
src/v2/presentation/
src/shared/lib/
src/shared/ui/
src/features/upload-image/
src/features/quality-mode-toggle/
src/features/download-result/
src/features/model-storage/
e2e/phase-44-frontend-refactor.spec.ts
e2e/support/
scripts/profiling/v2/
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

Each T2–T8 plan must name exact focused checks before editing. Prefer file-scoped Vitest and the
single affected Phase-44 Playwright journey; run typecheck or lint when the changed boundary needs
them. For v2/public-editor architecture files, run Fallow guard on the changed paths. Full-project,
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

T1 must also use the final mode of `review-v2-architecture`, verify the managed Windows browser
boundary, collect end-state Chrome render/performance/resource evidence for the accepted flows, and
exercise repeated import/reset/batch/tool/apply/cancel/dispose churn. Fail on visible/behavioral/
accessibility drift, unrelated render fan-out without justification, mirrored workflow state, stale
publication, resource leakage, missing checkpoint acceptance, unchecked review notes, or any gate
waiver.

---

## Architect Review Notes

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
  `src/v2/presentation/shared/diagnostics` public module and decompose its UI into one meaningful
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
  `src/v2/shared/ui` into semantic capability modules under repository-wide `src/shared/ui`, update
  every consumer and architecture boundary, and remove the now-redundant `src/v2/shared` tree.
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
- T3 review replaced the temporary header portal/context/state bridge with direct composition:
  `widgets/site-shell` imports the application-specific header and footer widgets, while pages
  compose editor-owned diagnostics and feature-owned model storage through `HeaderUtilities`.
  SPEC v1.44 retains strict downward layer dependencies and entity/feature slice isolation but
  deliberately permits same-layer widget/page imports; Steiger enforces that narrower contract.
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
- Latest T3 architect review supersedes the earlier preference for flat capability modules:
  capability-local `components/`, `hooks/`, `model/`, `.types.ts`, and `.utils.ts` ownership is now
  mandatory, while anonymous layer-wide dumping grounds remain forbidden. Diagnostics and all
  `presentation/shared` tests are the first enforced reference layout.

<!-- Add only intentional deviations, residual risks, or rejected alternatives not visible in git. -->

---

## Atomic Commit

```text
refactor(phase-44): decompose frontend render ownership
```

Checkpoint commits follow the task-specific conventional scope approved during manual review. The
atomic commit above is the final phase-closing commit after T1 and the full gate.
