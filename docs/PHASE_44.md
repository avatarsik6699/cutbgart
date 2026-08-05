# PHASE 44 — Frontend Decomposition and Render Ownership

<!-- TOKEN BUDGET: keep this file under 10,000 tokens. Be concise. -->

## Phase Metadata

| Field | Value |
|-------|-------|
| Phase | `44` |
| Title | Frontend Decomposition and Render Ownership |
| Status | `⏳ pending` |
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
- [ ] `T3` Decompose the route-neutral public page shell and composition around the existing
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
docs/SPEC.md
docs/STATE.md
docs/README.md
docs/PHASE_44.md
docs/ARCHITECTURE_V2.md
docs/audits/
docs/archive/
scripts/profiling/v2/verify-phase-*-reports.ts
src/shared/lib/brush-geometry.ts
src/routes/
src/pages/
src/widgets/public-editor/
src/v2/presentation/
src/v2/shared/ui/
src/shared/ui/
src/features/upload-image/
src/features/quality-mode-toggle/
src/features/download-result/
e2e/phase-44-frontend-refactor.spec.ts
e2e/support/
scripts/profiling/v2/
package.json
pnpm-lock.yaml
~~~

`package.json` and `pnpm-lock.yaml` may change only if T8 receives explicit architect approval for
a retained dependency or T2 removes a traced unused dependency. Runtime/application selector APIs
may be touched narrowly when a leaf connector needs an existing value; expand this list in the
phase before broader runtime changes.

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

- [x] No architect review issues recorded

---

## Implementation Notes

- T2 retained package-script, E2E, operations, release, service-worker, and v2 testing entry points
  after consumer tracing; it removed only the five files recorded in
  `docs/audits/PHASE_44_CLEANUP_INVENTORY.md`. The immutable `v0.43.0` tag remains the source
  rollback snapshot, and the historical reports moved without changing their verifier semantics.

<!-- Add only intentional deviations, residual risks, or rejected alternatives not visible in git. -->

---

## Atomic Commit

```text
refactor(phase-44): decompose frontend render ownership
```

Checkpoint commits follow the task-specific conventional scope approved during manual review. The
atomic commit above is the final phase-closing commit after T1 and the full gate.
