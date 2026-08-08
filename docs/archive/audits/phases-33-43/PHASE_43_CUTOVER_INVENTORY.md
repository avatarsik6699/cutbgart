# Phase 43 Cutover and Legacy Reachability Inventory

Date: 2026-08-05  
Branch baseline: `d779ad9` (`feat/phase-43` branched from completed Phase 42)

## Method

- inspected every TanStack file route and its page composition;
- traced imports from `src/v2`, `src/pages/editor-v2`, public/scenario pages, internal tools,
  scripts, and E2E entry points with `rg`;
- ran Fallow 3.14.0 production dead-code analysis with `--unused-files --unused-exports
  --unused-types --summary --format json --quiet --explain`;
- treated tests and package scripts as explicit entry points and did not accept a Fallow finding as
  deletion proof without checking real route/build/internal-tool consumers.

Baseline Fallow result: 717 advisory findings (24 unused files, 291 unused exports, 402 unused
types), zero unresolved imports, zero dependency findings, zero circular dependencies, and zero
configured boundary violations. The inherited backlog is not Phase-43 scope by itself.

## Route inventory

| Surface | Baseline owner | Phase-43 disposition |
|---------|----------------|----------------------|
| `/`, `/en` | `HomePage` → legacy `ToolWorkspace` | Compose the route-neutral v2 public editor |
| Four Russian and four English scenario routes | Scenario page → legacy `ToolWorkspace` | Preserve scenario content/SEO and compose the same v2 public editor |
| `/editor-v2`, `/en/editor-v2` | `EditorV2Page` | Redirect by locale to `/` or normalized `/en/` after cutover |
| `/dev/remove-background` | Legacy `useBackgroundRemoval` harness | Remove route, page, and legacy runtime |
| `/dev/model-lab` | Independently gated model evaluation tool | Retain, noindex, exact-`true` flag only |
| about/privacy/discovery/security routes | Static/operational owners | Retain unchanged except generated-route references |

## Legacy graph disposition

### Remove after public cutover

- `ToolWorkspace` and its controller-owned legacy document/batch/tool hooks, state, workers, panels,
  fixtures, and tests;
- legacy-only feature slices: `background-replacement`, `batch-processing`, `correct-mask`,
  `editor-history`, `refine-foreground`, `refine-matte`, `remove-background`, and `select-object`;
- legacy `entities/edit-document` state/artifact model;
- `/dev/remove-background`, `pages/dev-remove-background`, and E2E/profiling entries that exercise
  only the removed legacy runtime;
- barrel exports and package scripts whose only consumer is one of the removed surfaces.

### Retain with a current owner

- `src/v2/**` and the accepted v2 actor/runtime/artifact/presentation/testing contracts;
- `features/upload-image` presentation/validation used by v2 input;
- `features/quality-mode-toggle` used by v2 main-page presentation and the compatible
  `qualityMode` preference;
- `features/download-result` controller-neutral export controls used by v2; v2 runtime continues to
  own actual committed-artifact export;
- `features/model-storage` and `features/model-lab`, plus `/dev/model-lab`;
- `entities/processed-image` types/pure image presentation still consumed by v2 and model lab;
- controller-neutral editor presentation currently under `widgets/tool-workspace`: toolbar, tool
  panel slot, canvas controls, diagnostics presentation, enhancement/tool registries, and other
  components with an explicit v2 consumer. Remove the legacy `ToolWorkspace` composition and model
  hooks, not the shared visuals they host;
- shared config/lib/UI, SEO/scenario content, analytics, release/security/operations tooling, model
  assets, and service-worker model caching.

## Deletion guards

Before deleting a candidate:

1. public/scenario routes must already render the v2 composition;
2. `rg` must show no retained production/internal-tool import;
3. generated routes, TypeScript, architecture lint, Vitest, and focused public Playwright must pass;
4. Fallow production analysis must show no unresolved import/boundary regression;
5. the production build manifest and `public/sw.js` must not name a removed legacy entry/chunk.

Rollback does not retain this graph. It selects the previous immutable production release.

## Final reachability result

The cutover binds both roots and all eight localized scenario routes to
`src/widgets/public-editor`; the route-neutral widget owns the sole v2 session composition. The
former `/editor-v2` paths are 308 locale-preserving redirects, and `/dev/remove-background` has no
generated route. The independent noindex model lab remains explicitly gated.

The legacy workflow directories, controller, worker, stores, tests, fixtures, and snapshot
baselines listed above were deleted. Controller-neutral presentation moved to
`src/v2/presentation/shared` only where the public editor has a current import. Generated routes,
TypeScript, architecture lint, production build, and Fallow report zero unresolved import, cycle,
boundary violation, introduced dead code/complexity/duplication, or reachable legacy editor entry.
The production manifest contains only public-editor/v2 runtime chunks plus the two small redirect
routes; `public/sw.js` contains no removed editor chunk or route identifier.
