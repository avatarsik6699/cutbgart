# PHASE 38 — Editor v2 Cutover-Readiness Validation

<!-- TOKEN BUDGET: keep this file under 10,000 tokens. Be concise. -->

## Phase Metadata

| Field | Value |
|-------|-------|
| Phase | `38` |
| Title | Editor v2 Cutover-Readiness Validation |
| Status | `✅ done` |
| Tag | `v0.38.0` |
| Depends on | PHASE_37 gate and architect acceptance passed |

---

## Phase Goal

Determine whether the complete isolated v2 workflow is safe to replace the editor embedded in the
public and scenario routes. Freeze and execute one bilingual parity/accessibility/device/product
matrix, close only defects inside the accepted Phase-33–37 contracts, and publish a versioned
`ready` or `blocked` result backed by deterministic, real-model, target-device, and architect
evidence.

The existing `/editor-v2` routes and approved design system are the visual reference; no new design
asset was provided. This phase does not perform public cutover or remove legacy code.

---

## Scope

### Product and architecture

- [x] `T1` Freeze the Phase-38 readiness schema and bilingual parity matrix before product fixes.
  Cover picker/drop/paste input, validation/downscale, automatic removal/fallback, single/batch
  lifecycle, Manual/Magic, Background, Enhancements, history, retry/cancel/reset, selected PNG,
  Download All, privacy, failure recovery, keyboard/focus, responsive layout, and resource
  ownership. Map every row to an observable acceptance and evidence owner — _Depends on:_ —
- [x] `T2` Audit legacy and v2 behavior signal by signal and classify every difference as
  `required-parity`, `accepted-difference`, or `cutover-blocker`. Explicitly decide the disposition
  of quality/model choice, export-size choice, and every other legacy-only control; an accepted
  difference requires architect rationale, while a blocker prevents a `ready` conclusion —
  _Depends on:_ `T1`
- [x] `T3` Triage findings against the accepted Phase-33–37 contracts. Fix verified defects without
  changing workflow ownership, domain contracts, privacy, model policy, persistence, or public
  routes; convert any newly required capability or contract change into a documented blocker and a
  separately scoped follow-up rather than implementing it inside validation — _Depends on:_ `T2`

### Frontend

- [x] `F1` Audit and, where they are defects in already accepted behavior, fix applicable WCAG 2.2
  AA issues across both locales: keyboard order and traps, focus restoration/visibility,
  names/roles/states, live status and error announcements, pointer alternatives, contrast, reduced
  motion, 200% zoom/reflow, touch target behavior, dirty guards, and recoverable validation —
  _Depends on:_ `T2`
- [x] `F2` Audit and fix contract-level responsive/product defects across empty, processing,
  single-document, multi-document, active-draft, error, and export states. Selection, scrolling,
  editing, progress, dialogs, and downloads must remain operable at the approved desktop and narrow
  viewport/input samples without hidden controls, clipped actions, lost intent, reinference, or
  object-URL churn — _Depends on:_ `T2`
- [x] `F3` Reconcile Russian/English labels, instructions, status/error copy, shortcuts, and control
  discoverability for every parity row. Do not expose filenames or user content in analytics,
  diagnostics, accessibility evidence, performance reports, or deterministic snapshots —
  _Depends on:_ `F1`, `F2`

### Verification and evidence

- [x] `I1` Add a typed, versioned parity/readiness report builder and tests for exhaustive
  dispositions, evidence references, blocker aggregation, accessibility severity, unsupported
  signals, privacy-safe serialization, and deterministic `ready`/`blocked` evaluation. Missing,
  contradictory, or stale evidence must fail closed — _Depends on:_ `T1`
- [x] `I2` Add automated accessibility coverage with a reviewed pinned Playwright-compatible
  scanner plus explicit keyboard/focus/zoom/reflow assertions that automation cannot infer. Test
  both locales and every material workspace state; scanner exclusions require documented rationale
  and may not hide serious or critical findings — _Depends on:_ `F3`, `I1`
- [x] `I3` Add one sleep-free, zero-retry deterministic Chromium cutover-readiness journey that
  traces the full matrix across single/multi-file import, queued work, every editor tool, history,
  isolated failure/retry/remove, selected/ZIP export, reset, privacy, and repeated lifecycle churn.
  Reuse the supported v2 fixtures and observable production protocol; do not duplicate a test-only
  workflow model — _Depends on:_ `T3`, `I2`
- [x] `I4` Run one serialized real-model journey and Playwright MCP review in its managed Windows
  environment over cold/warm automatic removal, Manual/Magic, finishing tools, batch selection and
  ZIP export. Add material narrow-viewport/keyboard/pointer samples selected by the matrix, record
  browser/OS/GPU/input limitations, and never substitute WSL observations for Windows evidence —
  _Depends on:_ `I3`
- [x] `I5` Extend the versioned v2 performance/resource evidence for full-workflow cold/warm input
  latency, long tasks, queue admission, selection without reinference, and at least three repeated
  import/edit/remove/reset/dispose cycles. Verify zero application-attributable freeze, lost
  command, stale/cross-document publication, residual actor/runtime/artifact/URL/listener/session,
  or retry-masked pass — _Depends on:_ `I3`
- [x] `I6` Publish `docs/audits/PHASE_38_PARITY_MATRIX.md`, results, and machine-readable reports
  with one final `ready` or `blocked` conclusion. `ready` requires every row decided and evidenced,
  zero cutover blocker, zero unresolved serious/critical accessibility finding, accepted
  Phase-33–37 budgets/contracts green, architect target-device acceptance, and `/phase-gate 38`
  passing — _Depends on:_ `I4`, `I5`

---

## Files

### Create / modify

~~~
docs/PHASE_38.md
docs/SPEC.md
docs/STATE.md
docs/README.md
docs/ARCHITECTURE_V2.md
docs/audits/PHASE_38_PARITY_MATRIX.md
docs/audits/PHASE_38_RESULTS.md
docs/audits/PHASE_38_REPORTS.json
src/v2/testing/readiness/
src/v2/testing/performance/
src/v2/presentation/
src/v2/shared/ui/
src/pages/editor-v2/
messages/en.json
messages/ru.json
e2e/phase-38-cutover-readiness.spec.ts
e2e/phase-38-cutover-readiness.real.spec.ts
e2e/support/v2/
scripts/profiling/v2/run-phase-38.mjs
package.json
pnpm-lock.yaml
playwright.config.ts
~~~

Product files above may change only for verified defects in accepted Phase-33–37 behavior. Every
semantic module keeps a narrow `index.ts` public API; new readiness/report code is test/evidence
infrastructure and must not enter the runtime workflow source of truth.

### Do NOT touch

- Main public/scenario routes, sitemap, canonical/indexing policy, route identity, analytics wiring,
  or public navigation
- Legacy editor hooks/components/state/worker lifecycle except read-only behavior characterization
- Domain commands/events, actor ownership, artifact ownership, model families/weights/revisions,
  CDN manifest, quality mapping, persistence, env vars, server endpoints, or privacy policy
- Accounts, auth, billing, database/storage, remote processing, generated backgrounds, public
  cutover, legacy removal, or unrelated design-system redesign
- New product capabilities discovered by parity review; record them as blockers/follow-up scope

---

## Contracts

> This section is the source of truth for `/context-update`.

### New persistent data (tables / collections / files)

Versioned repository evidence only:

- `docs/audits/PHASE_38_PARITY_MATRIX.md` — human-readable bilingual outcome/disposition/evidence map
- `docs/audits/PHASE_38_RESULTS.md` — environment, findings, limitations, architect result, gate result
- `docs/audits/PHASE_38_REPORTS.json` — privacy-safe machine-readable readiness/performance evidence

No user image, filename, prompt, stroke, colour, pixel, URL, draft, history, ZIP, or editor state is
persisted. No database, IndexedDB, server store, or new `localStorage` key is introduced.

### New API endpoints / RPC methods / events

None. `/editor-v2` and `/en/editor-v2` remain separately reachable and noindex; all public and
scenario routes continue to render the legacy editor.

### New types / models / shared interfaces

```ts
type ParityDisposition = "required-parity" | "accepted-difference" | "cutover-blocker";
type ReadinessConclusion = "ready" | "blocked";
type EvidenceKind = "automated" | "real-model" | "target-device" | "architect";
type AccessibilityImpact = "minor" | "moderate" | "serious" | "critical";

interface ParityRequirement {
  id: string;
  locales: readonly ("ru" | "en")[];
  outcome: string;
  disposition: ParityDisposition;
  rationale: string;
  evidenceIds: readonly string[];
  status: "passed" | "failed" | "unsupported";
}

interface Phase38ReadinessReport {
  schemaVersion: 1;
  generatedAt: string;
  conclusion: ReadinessConclusion;
  requirements: readonly ParityRequirement[];
  blockerIds: readonly string[];
  seriousAccessibilityFindingIds: readonly string[];
  evidenceKinds: readonly EvidenceKind[];
  limitations: readonly string[];
}
```

These are evidence/test contracts only. They contain bounded privacy-safe metadata and do not enter
editor domain, actor, runtime, or React workflow state.

### New env vars

None.

---

## Gate Checks

Run `/phase-gate 38` before committing. In addition to every command in
[`docs/STACK.md`](../../STACK.md#gate-commands), run:

```bash
pnpm e2e e2e/phase-38-cutover-readiness.spec.ts --project=chromium
pnpm e2e:phase-38-real
pnpm profile:phase-38 -- --verify
```

Phase-specific PASS additionally requires:

- the report evaluator publishes exactly one schema-valid `ready` or `blocked` conclusion;
- every matrix row has a disposition, rationale, and current evidence; a `ready` result additionally
  requires every architect decision, while a `blocked` result must identify every missing decision,
  unsupported signal, and separately scoped follow-up;
- no unresolved serious/critical accessibility finding; any cutover blocker must force `blocked`
  and may not be represented as a phase-gate or product-readiness pass;
- Windows Playwright MCP and architect affected-device evidence are present and identified as
  Windows evidence rather than WSL-host evidence, with unsupported observations explicit;
- the architect accepts the published conclusion and follow-up direction; closing a validation phase
  with `blocked` does not authorize public cutover;
- public/scenario routes, noindex route policy, privacy, Phase-33–37 contracts, release checks, and
  security/supply-chain gates do not regress.

Fail on incomplete/contradictory/stale evidence; a blocked result presented as `ready`; an implicitly dropped legacy outcome; a new
capability hidden inside a validation fix; scanner suppression without rationale; keyboard/focus/
zoom/reflow failure; freeze, lost action, stale/cross-document mutation, reinference on selection,
resource leak, arbitrary sleep, retry-dependent pass, skipped real-model/target evidence, or an
unresolved Architect Review Note.

---

## Architect Review Notes

Use this section after manual product, accessibility, and target-device verification. Add one
unchecked checkbox per independently fixable defect or undecided parity row. A newly required
capability must be recorded as a blocker/follow-up contract, not silently added to this phase.

- [x] Architect accepted the `blocked` conclusion and directed iterative v1-faithful UI migration;
  no Phase-38 defect fix remains open
- [x] Full E2E gate intermittently served Vite's `socket hang up` overlay when localized v2 routes
  cold-compiled concurrently; warm every tested locale/route family before parallel workers without
  reducing parallelism or adding retries
- [x] Batch Background/export isolation E2E opened output options before the correlated Background
  commit settled, so the revision-keyed download control remounted during the click; wait on the
  observable document revision before continuing without sleeps, force clicks, or retries

---

## Implementation Notes

- Phase closure records successful completion of the validation scope, not public-cutover readiness.
  Product blockers remain explicit in the Phase-38 report and are addressed incrementally beginning
  with Phase 39.

---

## Atomic Commit Message

```
feat(phase-38): validate v2 public-cutover readiness
```

---

## Post-Phase Checklist

- [x] All Scope checkboxes checked (or explicitly blocked in Architect Review Notes/readiness report)
- [x] All automated gate checks green
- [x] Readiness report publishes the accepted `blocked` conclusion without implying cutover approval
- [x] All architect review notes resolved
- [x] Architect accepts the captured Windows limitations and iterative remediation direction
- [x] `docs/STATE.md` updated — run `/context-update 38`
- [x] Committed atomically on `feat/phase-38` branch
- [ ] Tag created after merge: `git tag -a v0.38.0 -m "Phase 38: cutover readiness"`
