# PHASE 42 — Complete V2 Cutover-Readiness Validation

<!-- TOKEN BUDGET: keep this file under 10,000 tokens. Be concise. -->

## Phase Metadata

| Field | Value |
|-------|-------|
| Phase | `42` |
| Title | Complete V2 Cutover-Readiness Validation |
| Status | `✅ complete — blocked readiness; gate exception accepted` |
| Tag | `v0.42.0` |
| Depends on | PHASE_41 gate and architect acceptance passed; `v0.41.0` merged locally |

---

## Phase Goal

Repeat cutover-readiness validation now that the isolated bilingual v2 routes contain the complete
v1-faithful main-page, batch, and editor-tool presentation. Close only verified defects inside the
accepted Phase-33–41 contracts and publish one fail-closed `ready` or `blocked` result backed by
deterministic, real-model, managed-Windows, performance/resource, and architect evidence.

This phase does not switch public routes or remove legacy. Existing Phase-39–41 reviewed v1/v2
baselines are the visual references; no new design asset or redesign is required.

---

## Scope

### Product and architecture

- [x] `T1` Freeze a Phase-42 complete-product matrix before defect fixes. Cover picker/drop/paste,
  validation/downscale, quality/model selection and fallback, single/batch lifecycle, Manual/Magic,
  Background, Enhancements, history, retry/cancel/reset, selected PNG/ZIP, privacy, responsive and
  accessibility states, and complete resource ownership. Give every row an observable acceptance
  and evidence owner — _Depends on:_ —
- [x] `T2` Re-audit every Phase-38 blocker and the Phase-39–41 remediation evidence. Classify each
  current difference as `required-parity`, `accepted-difference`, or `cutover-blocker`; no prior
  blocker may be assumed resolved merely because its implementation phase passed — _Depends on:_ `T1`
- [x] `T3` Triage findings against accepted Phase-33–41 contracts. Fix only verified contract
  defects; record any new capability, architecture/data/API/env/model-policy change, public-route
  change, or product decision as a blocker or separately scoped follow-up — _Depends on:_ `T2`
- [x] `T4` Trace the architect-reported regressions end to end from the Phase-41 presentation and
  semantic interaction ports through projections, XState actors, controllers, workers, artifacts,
  and canvas ownership. Record the reproducible root cause for each freeze, missed stroke, geometry
  jump, ineffective action, implicit tool switch, and lost finishing-tool result. Reject any fix
  that restores legacy state/workflow ownership or moves pixels, pointer streams, mutable drafts, or
  heavy work into React/XState — _Depends on:_ —
- [x] `T5` Profile the presentation-complete v2 editor at component, actor-subscription, browser
  main-thread, memory/resource, and production-bundle levels. Distinguish React StrictMode/dev-tool
  diagnostics from production behavior; map render causes, selector breadth, prop fan-out,
  high-frequency local state, duplicate publication, canvas/worker work, long tasks, INP-related
  interaction delay, and retained owners. Evaluate React/XState/Vite tooling against current
  primary documentation and add no state manager or build plugin without a measured gap and a
  repository-owned, repeatable diagnostic — _Depends on:_ —
- [x] `T6` Harden the agent-assisted prevention loop used by Phase 42 and later work. Add a
  repository-owned v2 architecture/performance review skill, reproducible Fallow changed-code
  analysis, and documented Codex browser/static-analysis integrations; connect Build Web Apps,
  Chrome DevTools MCP, and Fallow MCP in the local Codex environment and prove each installation
  is discoverable. These tools may inspect or gate source changes but must add no production
  dependency, browser runtime code, telemetry opt-in, remote configuration inheritance, or editor
  state — _Depends on:_ `T5`

### Frontend verification and bounded defect closure

- [x] `F1` Verify and, only for accepted-contract defects, correct WCAG 2.2 AA behavior in both
  locales across every material state: keyboard order/traps, visible focus and restoration,
  names/roles/states, live announcements, pointer alternatives, contrast, reduced motion, actual
  200% browser zoom/reflow, touch targets, dirty guards, and recoverable errors — _Depends on:_ `T2`
- [x] `F2` Verify and, only for accepted-contract defects, correct complete-product behavior and
  exact v1-faithful presentation at approved desktop/narrow samples. No control, copy, dialog,
  progress/error state, result, batch item, or tool panel may be clipped, masked, silently omitted,
  or disconnected from v2 ownership — _Depends on:_ `T2`
- [x] `F3` Reconcile Russian/English labels, instructions, statuses, errors, shortcuts, privacy
  claims, and announcement behavior. Evidence, analytics, diagnostics, screenshots, and reports
  must not expose filenames or user content — _Depends on:_ `F1`, `F2`, `F4`, `F5`, `F6`
- [x] `F4` Remove verified presentation-era responsiveness regressions during automatic removal and
  Enhancement Apply. Scroll, tool controls, and unrelated interaction must remain responsive while
  heavy work stays behind the shared FIFO coordinator/worker boundary; no synchronous full-image
  reconstruction, duplicate subscription, per-frame projection update, or render loop may run on
  the interaction path — _Depends on:_ `T4`, `T5`
- [x] `F5` Restore the approved Cutout interaction contract. Magic/Manual use one stable stage
  viewport and source-coordinate mapping; brush cursors remain true proportional circles with a
  simple solid outline and no core, while Manual always uses a white cursor to distinguish it from
  Magic Keep/Remove colours; brush-size input and pointer strokes remain responsive. Magic product UI shows
  only Apply and Cancel: Apply runs prediction, selects the highest-ranked valid candidate, and
  commits through the existing correlated v2 flow. Remove Predict, candidate selection, separate
  stroke Undo/Redo buttons, and the candidate/stroke-count info block. The common toolbar provides
  contextual draft/document Undo/Redo, and Magic Apply/Cancel visibly affect exactly the intended
  document — _Depends on:_ `T4`
- [x] `F6` Keep tool identity and committed output stable. Switching Magic/Manual never resizes,
  shifts, crops, or replaces the image viewport; Manual Apply/Save and Cancel keep Manual selected;
  no tool Apply/Cancel implicitly selects Magic or Cutout. Background and Enhancement Apply retain
  and display their committed result while keeping the current tool selected — _Depends on:_ `T4`
- [x] `F7` Enforce narrow render ownership for interactive editor controls. Brush-size input and
  pointer-cursor motion must not publish document/session state or re-render the editor shell,
  toolbar, batch rail, image stage, or unrelated tool panels. Actor changes may re-render only
  consumers whose selected scalar or identity changed; session publication must not duplicate the
  selected document actor subscription. Lock the boundary with deterministic render-count/profiler
  evidence and keep workflow truth in XState rather than adding a parallel UI store — _Depends on:_
  `T5`

### Verification and evidence

- [x] `I1` Version the existing fail-closed readiness/performance evidence for Phase 42 and test
  exhaustive requirements, evidence freshness/kinds, blocker aggregation, accessibility severity,
  unsupported signals, privacy-safe serialization, and deterministic `ready`/`blocked` evaluation.
  Keep this test/evidence model outside editor runtime truth — _Depends on:_ `T1`
- [x] `I2` Add one zero-retry, sleep-free deterministic Chromium journey across both locales and
  the complete single/batch/tool/recovery/export matrix, plus exact Phase-39–41 visual regressions,
  automated accessibility, keyboard/focus/reflow assertions, and repeated cleanup — _Depends on:_
  `T3`, `F3`, `F4`, `F5`, `F6`, `F7`, `I1`
- [x] `I3` Run one serialized real-model journey over cold/warm automatic removal, quality/fallback,
  Manual, Magic prediction/Apply, Background, Enhancements, history, selection, selected PNG/ZIP,
  recovery, and zero unrequested inference or stale publication — _Depends on:_ `I2`
- [x] `I4` Capture managed-Windows Chromium evidence for the complete product using keyboard and
  fine/coarse pointer where available, desktop/narrow layouts, actual 200% browser zoom/reflow,
  announcements, cold/warm work, scroll/control responsiveness, and cleanup. Record OS/browser/GPU/
  input and unsupported signals; never substitute WSL evidence — _Depends on:_ `I3`
- [x] `I5` Capture and verify full-workflow performance/resource evidence: exposed long tasks and
  event-to-next-paint signals, one-heavy-job admission, cached selection without reinference, and at
  least three import/edit/remove/reset/dispose churn cycles ending with no residual owners —
  _Depends on:_ `I2`, `I4`
- [x] `I6` Publish the Phase-42 matrix, machine-readable reports, limitations, and results with one
  architect-accepted `ready` or `blocked` conclusion. `ready` requires every required row evidenced,
  no blockers or serious/critical accessibility findings, accepted Phase-33–41 contracts green,
  managed-Windows acceptance, and `/phase-gate 42` passing — _Depends on:_ `I4`, `I5`

---

## Files

### Create / modify

~~~
docs/PHASE_42.md
docs/audits/PHASE_42_REGRESSION_FINDINGS.md
docs/audits/PHASE_42_PERFORMANCE_RESEARCH.md
docs/audits/PHASE_42_PARITY_MATRIX.md
docs/audits/PHASE_42_RESULTS.md
docs/audits/PHASE_42_REPORTS.json
src/v2/testing/readiness/
src/v2/testing/performance/
src/v2/presentation/
src/v2/shared/ui/
src/pages/editor-v2/
src/v2/runtime-browser/
messages/en.json
messages/ru.json
e2e/phase-42-cutover-readiness.spec.ts
e2e/phase-42-cutover-readiness.real.spec.ts
e2e/phase-39-main-page-ui.spec.ts
e2e/phase-40-batch-main-page-ui.spec.ts
e2e/phase-41-editor-tools-ui.spec.ts
e2e/support/v2/
scripts/profiling/v2/run-phase-42.mjs
scripts/profiling/v2/verify-phase-42-reports.ts
.agents/skills/review-v2-architecture/
.fallowrc.jsonc
package.json
pnpm-lock.yaml
playwright.config.ts
docs/STACK.md
~~~

Product files above may change only for verified defects in accepted Phase-33–41 behavior. Exact
files discovered during validation must stay inside the owning semantic module and use its public
API; evidence infrastructure must not become editor workflow state.

### Do NOT touch

- Public `/`, `/en`, scenario route bindings, sitemap, canonical/indexing policy, route identity,
  analytics wiring/semantics, public navigation, or production cutover behavior
- Legacy hooks/components/state/worker lifecycle except read-only behavior and visual reference
  characterization
- Accepted domain commands/events, actor and artifact ownership, correlations, tool algorithms,
  model families/weights/revisions, quality mapping, CDN manifest, persistence, env vars, server
  endpoints, privacy policy, export formats, or worker protocols other than the explicitly
  authorized internal Magic `v2` transfer extension
- Accounts, auth, billing, database/storage, remote processing, generated backgrounds, public
  cutover, legacy removal, unrelated redesign, or a new product capability hidden as a defect fix

---

## Contracts

> This section is the source of truth for `/context-update`.

### New persistent data (tables / collections / files)

Versioned privacy-safe repository evidence only:

- `docs/audits/PHASE_42_PARITY_MATRIX.md` — current bilingual outcome/evidence matrix;
- `docs/audits/PHASE_42_RESULTS.md` — environments, findings, limitations, architect conclusion,
  and gate result;
- `docs/audits/PHASE_42_REPORTS.json` — machine-readable readiness/performance evidence.

No user image, filename, prompt, stroke, colour, pixel, URL, draft, history, ZIP, or editor state is
persisted. No database, IndexedDB, server store, or new `localStorage` key is introduced.

### New API endpoints / RPC methods / events

None. `/editor-v2` and `/en/editor-v2` remain bilingual noindex validation surfaces; public and
scenario routes continue rendering legacy.

### New types / models / shared interfaces

No domain, application, actor, persistence, or public API type. Phase 42 versions and reuses the
existing Phase-38 readiness/performance evidence model. The internal Magic worker protocol is
versioned from `1` to `2` so the current base matte can cross the existing transferable worker
boundary and candidate ranking/fusion no longer reconstructs full-image data on the interaction
thread. The Phase-41 presentation
contract is narrowed so Magic exposes Apply/Cancel plus common-toolbar contextual history while
candidate selection and prediction remain internal runtime concerns; existing typed intents may be
composed or narrowed without changing document authority, correlations, algorithms, or binary
ownership. If the evidence shape or accepted runtime flow cannot represent a required signal or
atomic Apply, update SPEC and run `/spec-sync` before changing that deeper contract.

The internal browser-session facade may expose separate active-shell and workspace notification
channels so React can subscribe at the narrowest presentation boundary. This is not workflow state:
the document actor remains authoritative, actor consumers still use selectors, and batch summaries
remain derived read models.

### New env vars

None.

### Managed-browser execution boundary

WSL owns the repository, command runner, application server, and Linux host-only evidence. Every
Phase-42 target-device browser action, trace, heap sample, network inspection, zoom observation,
and screenshot must be produced by an isolated native Windows Chrome owned by Playwright MCP or
Chrome DevTools MCP. Both MCP servers must start through Windows PowerShell wrappers; WSL `npx`,
Linux Chrome, a personal browser profile, and `connectOverCDP` are prohibited for target evidence.

Before capture, assert and record `navigator.platform === "Win32"`, Windows Chrome version,
viewport/DPR, GPU/ANGLE/WebGPU details and fine/coarse input support. A non-Windows value is a hard
stop. Windows MCP uploads use its managed fixture directory or a `\\wsl.localhost\...` UNC path;
never pass `/home/...` as a Windows browser path. Linux/WSL measurements may remain host evidence,
but must never satisfy `W-*` rows or managed-Windows acceptance.

---

## Gate Checks

Run `/phase-gate 42` before committing. In addition to every command in
[`docs/STACK.md`](../../STACK.md#gate-commands), run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm arch:lint
pnpm quality:fallow
pnpm e2e e2e/phase-42-cutover-readiness.spec.ts --project=chromium
pnpm e2e:phase-42-real
pnpm profile:phase-42 -- --verify
pnpm build
```

Phase-specific PASS additionally requires:

- one schema-valid report with exactly one architect-accepted `ready` or `blocked` conclusion;
- every matrix row has a current disposition, rationale, and evidence; `ready` requires every
  required signal to pass, while `blocked` names every blocker, unsupported signal, and follow-up;
- no unresolved serious/critical accessibility finding and no scanner suppression without a narrow
  documented rationale;
- managed-Windows and architect evidence is present, including actual 200% browser zoom/reflow, and
  is not replaced by WSL/headless evidence;
- deterministic and real-model journeys pass with zero retries and no arbitrary sleeps;
- automatic removal and Enhancement Apply preserve unrelated interaction; Magic/Manual pointer,
  slider, circular-cursor, common-toolbar history, automatic-best Apply/Cancel, stable viewport, and
  no-implicit-navigation contracts pass in both locales;
- public/scenario routes, noindex policy, SEO/analytics/privacy, accepted Phase-33–41 contracts,
  release checks, and security/supply-chain gates do not regress.

Fail on incomplete, contradictory, or stale evidence; any blocker or required unsupported signal
presented as `ready`; hidden new capability work; freeze, lost action, distorted/unresponsive brush,
ineffective Apply/Cancel, manual candidate UI, stage geometry jump, implicit tool navigation, lost
finishing result, stale/cross-document publication, selection reinference, resource leak, route
change, retry-dependent pass, skipped real-model/target evidence, or an unresolved Architect Review
Note.

---

## Architect Review Notes

Use this section after manual complete-product, accessibility, and managed-Windows verification.
Add one unchecked checkbox per independently fixable accepted-contract defect or undecided matrix
row. A new capability or cutover behavior must be recorded as a blocker/follow-up, not implemented
inside this phase.

- [x] Cutout editor stages crop some source aspect ratios and expose nested scrollbars. Every image
  must fit fully inside one stable, scrollbar-free stage at Fit/100% in Magic and Manual, including
  batch-selected documents and desktop/narrow layouts.
- [x] Hand view mode does not expose the expected grab cursor and temporary Space+left-drag panning
  is missing. Restore both interactions without publishing pointer motion into React/XState.
- [x] Cutout brush cursors still use the rejected core/dashed treatment. Render a proportional
  solid-outline circle with no core; Manual is always white while Magic follows Keep/Remove colour.
- [x] Magic renders the original upload instead of the current committed document and a successful
  Apply is not visible until another tool mounts. Bind every Cutout draft to the current committed
  artifact and publish the correlated result immediately without legacy or parallel state.
- [x] The editor toolbar exposes a persistent horizontal scrollbar in multi-image mode. Keep
  bounded touch/keyboard horizontal access where needed but do not render scrollbar chrome.
- [x] Managed-Windows production evidence records a 250 ms Long Task, 176 ms Event Timing, and
  78 ms forced reflow in the shared editor-toolbar measurement path. Eliminate the synchronous
  measurement without changing legacy behavior, or explicitly authorize the shared legacy/v2
  component scope needed for the fix, then repeat the production trace.
- [x] A complete-product Windows sample exposes a 219 ms Long Task between Magic prediction and
  candidate readiness. Keep ranking/fusion and full-image reconstruction behind the existing
  Magic worker boundary, preserve correlations and automatic-best Apply, then repeat the native
  production sample.

---

## Implementation Notes

- Local Codex plugin/MCP registration lives in the architect's user configuration; the repository
  pins the Fallow runtime, review skill, privacy flags, Windows browser boundary, and reproducible
  setup commands. A new Codex conversation is required to refresh the installed skill/tool
  inventory or restart a browser MCP after its launcher changes.
- On 2026-08-05 the architect explicitly authorized the shared legacy/v2 toolbar scope. Boundary
  observation replaces toolbar layout reads; deferred `ToolPanelSlot` autofocus affects only v2
  callers that opt into `autoFocus`, while legacy callers retain their existing behavior.
- On 2026-08-05 the architect explicitly authorized optimization and bug-fix changes to migrated
  v1 elements, including the internal Magic worker protocol. Protocol `v2` transfers the current
  base matte and returns worker-ranked/fused candidates; domain commands, correlations, algorithm,
  model policy, export format, and public routes remain unchanged.
- On 2026-08-05 the architect accepted the fail-closed `blocked` readiness conclusion with absolute
  cold/warm/full-workflow duration signals remaining explicitly unsupported.
- On 2026-08-05 `/phase-gate 42` completed with one failure: the Phase-32 English upload-preparation
  sample measured a 129 ms main-thread task against its `<100 ms` budget. The architect explicitly
  accepted this gate exception, directed no further fix in Phase 42, and authorized phase closure;
  the result remains recorded as FAIL rather than rewritten as PASS.

---

## Atomic Commit Message

```text
test(phase-42): validate complete v2 cutover readiness
```

---

## Post-Phase Checklist

- [x] All Scope checkboxes checked (or explicitly blocked in the readiness report)
- [x] Automated gate executed; its single Phase-32 129 ms performance-budget failure was explicitly
  waived by the architect and remains documented as FAIL
- [x] Readiness report publishes the architect-accepted `ready` or `blocked` conclusion
- [x] Managed-Windows and architect complete-product evidence captured
- [x] All architect review notes resolved
- [x] `docs/STATE.md` updated — run `/context-update 42`
- [x] Committed atomically on `feat/phase-42` branch
- [ ] Tag created after merge: `git tag -a v0.42.0 -m "Phase 42: complete v2 cutover readiness"`
