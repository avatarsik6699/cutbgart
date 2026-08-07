# Phase 44 T2 Cleanup Inventory

Date: 2026-08-05  
Recoverable source baseline: immutable tag `v0.43.0` at `2b2c46c`

## Method

- traced production imports and export references with Fallow's production graph;
- searched package scripts, tests, Docker/release files, operations docs, routes, and internal-tool
  consumers with `rg` before deciding disposition;
- treated framework, static-public, CLI, test-helper, and dynamically loaded files as retained when
  the static import graph could not represent their consumer;
- made no dependency removal and created no compilable `src/archive` tree.

## Removed after consumer trace

| File | Evidence and disposition |
|------|--------------------------|
| `src/shared/lib/brush-geometry.ts` | No import, re-export, test, build, or tool consumer; its sole export had zero Fallow references. |
| `src/v2/presentation/background/background-preview.tsx` | No importer or re-export; the accepted background presentation is owned by the active tool workspace. |
| `src/widgets/public-editor/ui/editor-v2-document-panel.tsx` | No production importer or barrel export; superseded by active-document/main-page/tool-workspace composition. |
| `src/widgets/public-editor/ui/editor-v2-status-rail.tsx` | Imported only by the dead document panel, so it became unreachable with that panel. |
| `src/widgets/public-editor/ui/editor-v2-document-panel.test.tsx` | Tested only the removed dead panel and had no independent contract owner. |
| `src/features/upload-image/{model,worker}` and legacy prepared-upload UI | T4 traced every symbol to the feature barrel and its self-tests only. The public v2 editor admits raw `File` values through `FileAdmission`; `runtime-browser/editor-session/image-import-preparation.ts` is the sole active validation, resize, cancellation, and preparation owner. The duplicate legacy worker/hook/validation path and its tests were removed together. |

The matching stale rows were removed from `docs/ARCHITECTURE_V2.md`. No runtime API, actor,
artifact ownership, route, browser-resource lifetime, or user-facing behavior changed.

## Retained after consumer trace

| Surface | Why it remains |
|---------|----------------|
| `public/sw.js` | Registered dynamically by `src/app/service-worker-registration.tsx`; model-cache and degraded/security E2E flows depend on it. |
| `scripts/release/smoke.mjs` | Copied into both production and release-test images and invoked by deploy/common release scripts. |
| `scripts/operations/*.mjs` | Invoked by operations tests, runbooks, `STACK.md`, and reliability procedures. |
| `scripts/profiling/v2/run-phase-*.mjs` and verifiers | Explicit `package.json` entry points; archived JSON bundles remain their reproducible verification inputs. |
| `e2e/phase-33-*` through `e2e/phase-43-*` | Still reachable through package scripts and the accepted deterministic/real-model regression suites. |
| `src/v2/testing/**` | Test/runtime harness entry points can be invisible to a production-only graph; imports from Vitest, E2E support, and profiling remain valid consumers. |
| Remaining Fallow unused-file/export/type findings | Advisory backlog only; no deletion without an exact production/test/internal-tool/build/operations trace. |

## Archived documentation

- accepted Phase-33–43 contracts moved from `docs/` to `docs/archive/phases/`;
- the pre-existing, unrelated Phase-34 legal/release draft was preserved as
  `PHASE_34_SUPERSEDED_LEGAL_RELEASE_DRAFT.md` before the accepted Phase-34 contract moved in;
- Phase-33–43 reports, matrices, research, and cutover inventory moved to
  `docs/archive/audits/phases-33-43/`;
- active indexes and retained profiling verifiers now point to the archive locations.

## Frozen boundary for later checkpoints

T3–T8 may decompose and replace active frontend owners, but they must not delete retained runtime,
test, profiling, release, operations, or service-worker surfaces merely because a production-only
static graph reports them as unused. Any additional removal requires a fresh exact consumer trace
and an update to this inventory.
