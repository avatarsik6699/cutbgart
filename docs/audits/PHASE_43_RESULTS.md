# Phase 43 Final Cutover Results

Date: 2026-08-05  
Branch: `feat/phase-43`  
Conclusion: **ready for the pre-production merge/release workflow; not deployed**

## Outcome

- `/`, `/en/`, and all eight localized scenario routes use the sole route-neutral v2 public editor.
- `/editor-v2` and `/en/editor-v2` return permanent locale-preserving redirects; the legacy
  development route is removed and the independently gated model lab remains noindex.
- The legacy editor workflow, its workers/controllers/stores/tests/fixtures, and legacy-only
  snapshots are deleted. Shared presentation retained by v2 has an explicit owner under
  `src/v2/presentation/shared`.
- Rollback selects the previous immutable release. No dormant legacy runtime or cutover flag ships.

## Verification evidence

| Evidence | Result |
|---|---|
| Generated code, TypeScript, lint, architecture boundaries | Pass; lint has one inherited Fast Refresh warning in `src/shared/ui/button.tsx` |
| Vitest | 130 files, 438 tests passed |
| Full deterministic Playwright | 29 total: 26 passed, 3 intentional model-lab skips, zero failures/retries |
| Serialized public real-model/CDN journey | 1 passed; cold/warm batch and every tool, history, export, recovery, cleanup |
| Production build | Pass; public-editor and v2 worker graph only, with two intentional redirect route modules |
| Fallow new-only | Pass; zero introduced dead code, complexity, duplication, cycles, unresolved imports, or boundary violations |
| Supply chain | Production audit has no high vulnerability; 12 license expressions pass; model assets v0.22.0 verify |
| Release reliability | Six unit checks pass; disposable Docker candidate/deploy/failure/rollback/return/current/lock exercise passes |
| Managed Windows | Current public build passes real-model result, keyboard, 520px responsive overflow, RU hydration, and zero-resource cleanup |

## Target and performance disposition

Same-day Phase-42 managed-Windows evidence remains applicable to the accepted presentation moved
without behavioral change: actual 200% browser zoom reflow, complete tool paths, three cleanup
cycles, zero missed actions, zero post-fix Long Tasks, and at most 144 ms Event Timing. Phase 43
freshly verified the new public owner/current production build at the resulting 520 CSS-pixel width
and confirmed contained layout, keyboard-reachable horizontal controls, real inference, and zero
artifacts/leases/object URLs after exit.

The architect previously directed that unsupported absolute cold, warm, and complete-workflow
duration fields not be repaired before closing Phase 42. Phase 43 records that instruction as an
accepted disposition; it does not convert unsupported values to zero. Behavioral readiness still
requires and has evidence for zero freeze, missed action, stale/cross-document mutation, reachable
resource leak, or unbounded heavy work.

The local production origin cannot load production analytics endpoints because their CSP/origin
policy rejects localhost. Deterministic interception verifies the bounded aggregate event payloads;
no image data, user content, or identifying filename is stored in this evidence.

Machine-verifiable details and evidence references are in `PHASE_43_REPORTS.json`; run
`pnpm profile:phase-43 -- --verify` to validate its schema, completeness, privacy guard, and ready
invariants.
