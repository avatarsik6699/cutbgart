# PHASE 43 — Final Public v2 Cutover and Legacy Removal

<!-- TOKEN BUDGET: keep this file under 10,000 tokens. Be concise. -->

## Phase Metadata

| Field | Value |
|-------|-------|
| Phase | `43` |
| Title | Final Public v2 Cutover and Legacy Removal |
| Status | `✅ complete` |
| Tag | `v0.43.0` |
| Depends on | PHASE_42 complete with architect-accepted blocked result and gate exception |

---

## Phase Goal

Produce the final pre-production release candidate by closing the remaining public-path readiness
evidence, switching every public and scenario editor route to the accepted v2 runtime, and deleting
the superseded legacy workflow. Preserve the established bilingual product, SEO, privacy,
accessibility, performance, and operational contracts; prove rollback to the previous immutable
release. This phase does not deploy to production.

No new design reference is required: the accepted Phase-39–42 v1-faithful presentation and its
desktop/narrow evidence remain normative.

---

## Scope

### Other

- [x] `T1` Freeze a route/component/dependency and deletion inventory for `/`, `/en`, all eight
  localized scenario routes, `/editor-v2`, `/en/editor-v2`, `/dev/remove-background`, every legacy
  editor module, retained shared presentation/policy code, tests, workers, build entries, and model
  tooling. Classify each candidate as retained with an explicit current owner or removable with
  reachability evidence; record the baseline in `docs/audits/PHASE_43_CUTOVER_INVENTORY.md` —
  _Depends on:_ —

### Frontend

- [x] `F1` Refactor the accepted `EditorV2Page` composition into a route-neutral public editor
  boundary without changing actor/runtime/artifact ownership, visible behavior, localized copy,
  accepted visual baselines, or internal diagnostic isolation. One composition must serve roots and
  scenario pages; route components must not become workflow owners — _Depends on:_ `T1`
- [x] `F2` Bind `/`, `/en`, and the four Russian plus four English scenario pages to the v2 public
  editor while preserving their existing locale, surrounding content, metadata, canonical/hreflang,
  structured data, analytics, keyboard/focus, responsive layout, and SSR behavior. Prove no route
  can instantiate or fall back to legacy workflow ownership — _Depends on:_ `F1`
- [x] `F3` Replace `/editor-v2` and `/en/editor-v2` with deterministic locale-preserving redirects
  to `/` and `/en`; remove `/dev/remove-background` and its navigation/build entry while keeping the
  explicitly enabled model lab noindex. Update route generation and verify removed surfaces cannot
  be indexed or bundled as alternate editor entry points — _Depends on:_ `F2`
- [x] `F4` Delete superseded legacy editor hooks, stores, workers, controllers, components, exports,
  tests, fixtures, and dependencies identified by `T1`. Retain a shared visual primitive or pure
  model policy only when a current v2/public/internal-tool consumer owns it and it imports no legacy
  workflow state or lifecycle. Re-run reachability after deletion and record zero retained legacy
  editor entry paths — _Depends on:_ `F2`, `F3`

### Infrastructure and verification

- [x] `I1` Update sitemap/robots, service-worker/cache, CSP/build, generated-route, profiling, E2E,
  operations, rollback, and active-documentation contracts for the v2-only public bundle. Ensure
  removed route/chunk/cache identifiers are absent and rollback selects the previous immutable
  release rather than dormant legacy code or a runtime feature flag — _Depends on:_ `F3`, `F4`
- [x] `I2` Add zero-retry bilingual deterministic Playwright coverage on the actual public and
  scenario routes for input, automatic removal/fallback, single/batch, every editor tool, history,
  selected PNG/ZIP export, recovery, privacy, accessibility, SEO/redirect behavior, SSR, and cleanup.
  Add one serialized real-model/CDN public-route journey and repeat managed-Windows 200% zoom,
  keyboard/focus/announcement, responsiveness, cold/warm, and resource verification — _Depends on:_
  `F2`, `F3`, `F4`, `I1`
- [x] `I3` Resolve the Phase-42 unsupported absolute-duration requirements on the actual public v2
  route or record an explicit architect disposition for each remaining unsupported signal. Generate
  versioned Phase-43 inventory/readiness reports; `ready` requires zero unresolved cutover blocker,
  serious accessibility defect, freeze, lost command, stale/cross-document mutation, reachable
  resource leak, legacy entry path, or missing required evidence — _Depends on:_ `I2`
- [x] `I4` Rehearse the documented rollback from the Phase-43 release candidate to the previous
  immutable production image and back in disposable/container-parity infrastructure. Verify health,
  route behavior, cache compatibility, release identity, and preserved browser-local privacy; record
  commands, artifacts, limitations, and recovery result without deploying production — _Depends on:_
  `I1`, `I3`
- [x] `I5` Run `/phase-gate 43`, the full build/container smoke, security/supply-chain and release
  reliability checks, Phase-43 report verifier, public deterministic/real-model suites, managed-
  Windows acceptance, and architect review. No waiver or partial gate authorizes deployment; the
  phase closes only with a `ready` report and zero unchecked review item — _Depends on:_ `I3`, `I4`

---

## Files

### Create / modify

~~~text
docs/PHASE_43.md
docs/README.md
docs/SPEC.md
docs/STATE.md
docs/ARCHITECTURE_V2.md
docs/audits/PHASE_43_CUTOVER_INVENTORY.md
docs/audits/PHASE_43_RESULTS.md
docs/audits/PHASE_43_REPORTS.json
docs/operations/
docs/runbooks/
src/routes/index.tsx
src/routes/en/index.tsx
src/routes/udalit-fon-dlya-avatarki.tsx
src/routes/udalit-fon-s-foto-na-dokumenty.tsx
src/routes/udalit-fon-s-foto-tovara.tsx
src/routes/udalit-fon-s-logotipa.tsx
src/routes/en/remove-background-from-avatar.tsx
src/routes/en/remove-background-from-id-photo.tsx
src/routes/en/remove-background-from-product-photo.tsx
src/routes/en/remove-background-from-logo.tsx
src/routes/editor-v2.tsx
src/routes/en/editor-v2.tsx
src/routes/dev.remove-background.tsx
src/pages/home/
src/pages/avatar/
src/pages/document-photo/
src/pages/product-photo/
src/pages/logo/
src/pages/editor-v2/
src/pages/dev-remove-background/
src/v2/presentation/
src/features/background-replacement/
src/features/batch-processing/
src/features/correct-mask/
src/features/download-result/
src/features/editor-history/
src/features/quality-mode-toggle/
src/features/refine-foreground/
src/features/refine-matte/
src/features/remove-background/
src/features/select-object/
src/features/upload-image/
src/widgets/tool-workspace/
public/sw.js
e2e/phase-43-public-cutover.spec.ts
e2e/phase-43-public-cutover.real.spec.ts
e2e/support/
scripts/profiling/v2/
scripts/release/
package.json
pnpm-lock.yaml
playwright.config.ts
~~~

Deletion is governed by `T1` reachability evidence. Listing a legacy directory above authorizes
review and deletion only when no retained production, test, shared, or internal-tool consumer exists.

### Do NOT touch

- Production deployment state, VPS secrets, DNS, Cloudflare, live caches, or live analytics data
- Model families, weights, revisions, CDN manifest, inference privacy, quality mapping, or export formats
- Accounts, auth, billing, payments, database, storage, queues, server image processing, remote
  fallback, generated backgrounds, or paid/backend scope
- Static legal/about/scenario content except the narrow editor-composition and verified metadata
  changes required for cutover
- `src/features/model-lab/` and `/dev/model-lab` except import cleanup proven necessary after legacy
  deletion; the lab remains explicitly enabled and noindex
- A dormant legacy implementation, dual-runtime feature flag, or hidden fallback shipped for rollback

---

## Contracts

> This section is the source of truth for `/context-update`.

### New persistent data (tables / collections / files)

Versioned Phase-43 inventory/readiness/rollback evidence files only. User images, mattes, edits,
artifacts, histories, exports, and workflow state remain browser-tab memory. No database, IndexedDB,
server image storage, account, remote job, or new `localStorage` key.

### New API endpoints / RPC methods / events

No new server API, RPC method, domain command, or worker event. Existing HTTP route behavior changes:

| Method | Path | Auth | Contract after Phase 43 |
|--------|------|------|-------------------------|
| `GET` | `/`, `/en` | none | Localized public page composing the sole v2 editor |
| `GET` | Four Russian and four `/en/...` scenario routes | none | Existing localized scenario content and metadata composing the same v2 editor |
| `GET` | `/editor-v2`, `/en/editor-v2` | none | Locale-preserving redirect to `/` or normalized `/en/` |
| `GET` | `/dev/remove-background` | none | Removed; returns the normal not-found response |
| `GET` | `/dev/model-lab` | none | Retained noindex and enabled only by the existing exact-`true` flag |

### New types / models / shared interfaces

None. Reuse the accepted Phase-33–42 v2 domain, application, runtime, projection, and intent contracts.
Route-neutral composition must not add a second editor state model or compatibility union for legacy.

### New env vars

None. Public cutover is unconditional in the Phase-43 release candidate; do not add a dual-runtime
feature flag. Existing release identity, model CDN, analytics, and model-lab configuration remains.

---

## Gate Checks

Run focused checks after each dependency-complete group, then `/phase-gate 43`. The complete
[`STACK.md`](./STACK.md#gate-commands) gate applies, plus:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm arch:lint
pnpm quality:fallow
pnpm e2e e2e/phase-43-public-cutover.spec.ts --project=chromium
pnpm e2e:phase-43-real
pnpm profile:phase-43 -- --verify
pnpm build
pnpm audit --prod --audit-level high
pnpm security:licenses
pnpm sync-model-assets -- --check
pnpm release:test
pnpm release:test:docker
```

Phase-specific smoke checks run against the production container and must prove:

- `/`, `/en`, and one route from each localized scenario pair return `200` and SSR the public page;
- `/editor-v2` redirects to `/`, and `/en/editor-v2` redirects to normalized `/en/`;
- `/dev/remove-background` returns the normal not-found response;
- the built manifest, service-worker/cache list, and retained source graph contain no deleted legacy
  editor entry or chunk;
- rollback to the previous immutable release and return to the candidate both pass health/route smoke.

Fail on any missing public-path evidence, Phase-43 report conclusion other than `ready`, gate waiver,
legacy workflow reachability, dormant dual-runtime fallback, route/SEO/accessibility/privacy drift,
freeze or timing/resource regression, stale cache/build reference, failed rollback rehearsal, or
unchecked architect review note.

---

## Architect Review Notes

- [x] No architect review issues recorded

---

## Implementation Notes

None

---

## Atomic Commit Message

```text
feat(phase-43): cut over public routes and remove legacy
```

---

## Post-Phase Checklist

- [x] All Scope checkboxes checked
- [x] Phase-43 readiness report concludes `ready` with no waiver
- [x] All automated, security, release, rollback, real-model, and managed-Windows checks green
- [x] All architect review notes resolved
- [x] `docs/STATE.md` updated — run `/context-update 43`
- [x] Committed atomically on `feat/phase-43` branch
- [ ] Tag created after merge: `git tag -a v0.43.0 -m "Phase 43: final public v2 cutover and legacy removal"`
- [ ] Production deploy performed separately by an authorized operator
