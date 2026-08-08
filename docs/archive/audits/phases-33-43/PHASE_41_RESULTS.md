# Phase 41 Results — V1-Faithful Editor Tools on V2

Date: 2026-08-04
Branch: `feat/phase-41`
Status: complete; architect verification, architecture review fixes, and `/phase-gate 41` passed

## Result

The isolated `/editor-v2` and `/en/editor-v2` routes now render the complete v1 editor shell for
Cutout Magic/Manual, Background, Enhancements, document history, export, responsive batch switching,
focus routing, and dirty-draft guards. Public/scenario routes remain unchanged.

Presentation consumes one bounded immutable workspace projection and narrow tool interaction ports.
Actors, sessions, workers, binary values, mutable brush engines, and lifecycle ownership remain
outside controller-neutral views. Background and Enhancement now reuse the v1 before/after stage;
committed export remains independent from dirty previews.

## Evidence

- `pnpm typecheck` — PASS.
- `pnpm lint` — PASS with one existing non-blocking Fast Refresh warning in
  `src/shared/ui/button.tsx`; zero errors.
- `pnpm arch:lint` — PASS, no Steiger violations.
- `pnpm test` — PASS, 178 files / 674 tests.
- Focused interaction-boundary and editor-workspace component tests — PASS, 21/21.
- Phase-41 deterministic Chromium — PASS, 9/9, zero retries.
- Full gate deterministic Chromium — PASS, 132 passed / 3 opt-in model-lab tests skipped, followed
  by the serialized real-model smoke — PASS, 1/1.
- Phase-38 accessibility plus Phase-41 deterministic — PASS, 11/11.
- Phase-33–41 deterministic Chromium regression — PASS after the accessibility correction; 45
  tests, zero retries.
- Phase-41 serialized real-model Chromium — PASS, 1/1 in 45.5 s. The two-item journey covered
  automatic removal, Magic, Manual, Background, Enhancements, committed history/export, selection,
  cleanup, and no automatic reinference.
- 32 exact full-page Phase-41 screenshots cover v1/v2, English/Russian, desktop/narrow, and four
  tool states. No masks, general pixel tolerance, arbitrary sleeps, or retries are used.

## Reviewed differences and residual boundary

- Architecture review found and fixed three discrepancies: controller-neutral Manual/Magic views
  could reach mutable draft engines; touched shared UI files violated prospective frontend style
  rules; and the page adapter mixed projection/intent translation with concrete tool rendering.
- Manual/Magic views now receive semantic gesture/history/apply/cancel commands only. Runtime-owned
  canvases and brush engines stay behind the page adapter; actor commands/events remain the only
  route to committed document state. A focused regression test locks this boundary.
- Concrete tool selection moved to `EditorV2ToolWorkspace`. The extracted shared controls now use
  readonly type aliases, non-destructured props, named effects/cleanup, one component per file, and
  kebab-case filenames. No legacy feature hook/controller/store or worker lifecycle was introduced.
- `File` remains an allowed application-edge payload for custom Background input: it is handed
  directly to runtime and never enters React state, projections, actor context, or persistence.

- Explicit v2-only status/actions remain where required for truthful behavior: Magic prediction and
  candidates, local Undo/Redo, Background file limits and committed-export notice, and Enhancement
  Cancel/retry/no-change.
- Selected Background gradients use an accessible outlined primary state because the visually
  solid v1 state fails WCAG colour contrast under the current tokens.
- The initial direct `playwright test` attempt had no managed Vite server and timed out at
  navigation; repository-standard `pnpm e2e` owns the server and passed. The phase-specific gate
  command now uses that wrapper.
- Managed-Windows whole-product acceptance, public route cutover, and legacy removal remain outside
  Phase 41 and require separately approved scope.

## Lifecycle result

`/phase-gate 41` and `/context-update 41` passed. The phase was committed atomically, merged into
local `main`, and tagged `v0.41.0`.
