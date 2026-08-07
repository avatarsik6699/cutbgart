---
name: frontend-implementation
description: Plan, implement, or review BG Remove App frontend changes under the repository's ownership, React render-boundary, selective-FSD, browser-lifecycle, and testing contract. Use for any task that changes or reviews React/TypeScript components, hooks, presentation models, frontend routing/storage/config, XState React bindings, or browser-facing UI code; `/impl-assist` must apply it whenever its changed surface includes frontend files.
---

# Frontend Implementation

Apply the canonical rules in [`docs/FRONTEND_CONVENTIONS.md`](../../../docs/FRONTEND_CONVENTIONS.md).
Do not restate them here.

## Before editing

1. Read the active phase, `docs/STACK.md`, `docs/FRONTEND_CONVENTIONS.md`, relevant source/tests,
   and the current diff.
2. Consult current primary documentation before relying on a third-party API.
3. Add this frontend design note to the implementation plan:
   - state, command, subscription, and browser-resource owners;
   - connector-to-view data flow and selector identities;
   - new abstractions/public exports and the concrete job of each;
   - focused static, unit, render, and E2E checks.
4. Stop for clarification when an owner or product behavior cannot be derived safely.

## While implementing

- Keep the change inside the active phase or review note.
- Build model bindings and semantic commands before wiring presentation.
- Subscribe at the real consumer and keep pure UI controller-neutral.
- Remove obsolete relays, wrappers, projections, exports, and tests only after tracing consumers.
- Preserve unrelated dirty-worktree changes.

## Before completion

1. Re-read every changed frontend file and its direct callers.
2. Answer every item in `FRONTEND_CONVENTIONS.md` § Frontend completion checklist.
3. Run the focused tests planned for behavior, lifecycle, and render isolation; run ESLint,
   TypeScript, Steiger, and Fallow at the depth required by the active phase.
4. Report `Frontend contract: PASS` with the evidence, or `Frontend contract: FAIL` with exact
   findings. Do not mark an `/impl-assist` task complete on `FAIL`.

Keep final performance, resource, real-model, and full-gate evidence in the phase task that owns
it; do not turn an ordinary changed-surface implementation into an unscoped whole-project audit.
