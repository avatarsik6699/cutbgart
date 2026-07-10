# PHASE 03 — Quality toggle & design system

<!-- TOKEN BUDGET: keep this file under 10,000 tokens. Be concise. -->

## Phase Metadata

| Field | Value |
|-------|-------|
| Phase | `03` |
| Title | Quality toggle & design system |
| Status | `⏳ pending` |
| Tag | `v0.03.0` |
| Depends on | PHASE_02 gate passing |

---

## Phase Goal

Give the user a real quality control and lay the visual-component foundation the rest of the
product will build on. This phase installs and configures shadcn/ui on Base UI (SPEC.md §6),
builds the minimal `shared/ui` component set needed so far, and delivers
`features/quality-mode-toggle` — a fast/max-quality UI control that reads/writes `localStorage`
and is passed into `features/remove-background` as a parameter, not hardcoded (SPEC.md §5.2, §3).

---

## Scope

<!-- Group tasks by area (Backend / Frontend / Infra / Data, etc.).
     ID scheme: B=Backend · F=Frontend · I=Infra · D=Data · T=other (ungrouped)
     Each item: `ID` description — _Depends on:_ ID, ID or —
     IDs are stable after assignment — never renumber. Mark removed tasks as ~~BN~~ (removed). -->

### Infra
- [x] `I1` Install and configure shadcn/ui on the Base UI engine (`components.json`, Tailwind theme
  tokens); components are copied into the repo, not an npm black box (SPEC.md §6) — _Depends on:_ —

### Frontend
- [x] `F1` Build the base `shared/ui` component set via the shadcn CLI: `Button`, `Switch` (or
  `Toggle`), `Card` — the minimum needed by the quality toggle now, sized so Phase 04's
  upload/result UI can reuse the same primitives — _Depends on:_ `I1`
- [x] `F2` Scaffold `features/quality-mode-toggle` slice skeleton (public API `index.ts`, internal
  `model/`, `ui/` per FSD) — _Depends on:_ `F1`
- [x] `F3` Implement `localStorage`-backed `qualityMode` read/write (SPEC.md §3: key `qualityMode`,
  values `"fast" | "max"`, persisted across visits); when unset, default to
  `DeviceCapabilities.defaultQualityMode` from `features/remove-background` (Phase 02) —
  _Depends on:_ `F2`
- [x] `F4` Build the toggle UI control using the `shared/ui` primitives from `F1`, wired to `F3`'s
  read/write logic — _Depends on:_ `F1`, `F3`
- [x] `F5` Integrate the toggle's `qualityMode` value as the parameter passed into
  `useBackgroundRemoval` (`features/remove-background`, Phase 02) on the existing dev test route
  (`/dev/remove-background`) — proves the wiring end to end ahead of the real `pages/home`
  composition in Phase 04 — _Depends on:_ `F4`
- [x] `F6` Unit tests (Vitest, Testing Library): `localStorage` persistence, default-selection from
  `DeviceCapabilities`, toggle UI interaction (SPEC.md §7.7) — _Depends on:_ `F3`, `F4`

<!-- Test execution is governed by `## Gate Checks` below + docs/STACK.md § Gate Commands.
     Do not duplicate that list here. -->

<!-- No Backend or Data groups: no server-side API surface or persistent store this phase either
     (SPEC.md §3, §4). -->

---

## Files

### Create / modify
~~~
components.json
tailwind.config.ts (or wherever Tailwind theme tokens live post-Phase-01 setup)
src/shared/ui/button/*
src/shared/ui/switch/*
src/shared/ui/card/*
src/shared/ui/index.ts
src/features/quality-mode-toggle/index.ts
src/features/quality-mode-toggle/model/use-quality-mode.ts
src/features/quality-mode-toggle/model/use-quality-mode.test.ts
src/features/quality-mode-toggle/ui/QualityModeToggle.tsx
src/features/quality-mode-toggle/ui/QualityModeToggle.test.tsx
src/pages/dev-remove-background/ui/DevRemoveBackgroundPage.tsx (wire in the toggle)
package.json / pnpm-lock.yaml (shadcn/ui + Base UI deps)
playwright.config.ts (added ahead of schedule — see Implementation Notes)
e2e/dev-remove-background.spec.ts (added ahead of schedule — see Implementation Notes)
~~~

### Do NOT touch
- `src/features/remove-background/**` — Phase 02's slice is consumed, not modified, except for
  passing `qualityMode` in as an existing parameter (no new API on the hook)
- `src/routes/**` beyond wiring the toggle into the existing dev page — new routes/pages are
  Phase 04+
- Analytics/Umami wiring — Phase 05

---

## Contracts

> This section is the source of truth for `/context-update`. Fill it in **before** handing to AI.

### New persistent data (tables / collections / files)

```text
localStorage:
  qualityMode: "fast" | "max"     # persisted across visits, no other user data stored client-side
                                    # (SPEC.md §3)
```

### New API endpoints / RPC methods / events

None

### New types / models / shared interfaces

```ts
// src/features/quality-mode-toggle/model/use-quality-mode.ts
// QualityMode itself already exists (entities/processed-image, Phase 02) — this phase adds the
// hook that reads/writes it, not the type.

function useQualityMode(defaultMode: QualityMode): {
  qualityMode: QualityMode;
  setQualityMode: (mode: QualityMode) => void;
};
```

### New env vars

None

---

## Gate Checks

> **Before running gate:** confirm all Scope checkboxes are checked (or explicitly deferred in
> Architect Review Notes). Unchecked items appear in the gate report as a warning, not a hard block.

Run `/phase-gate 03` before committing.

`/phase-gate` returns full PASS only when:
- Automated checks are green
- All architect review items below are resolved (checked off)

Use the commands in [docs/STACK.md](./STACK.md#gate-commands) as the source of truth for:
- infrastructure / bootstrap
- migrations — `n/a`, no database in this project
- backend / unit tests — `n/a`, folded into frontend unit tests (single TS/React codebase)
- frontend prep, type-check, unit tests — this phase adds `features/quality-mode-toggle` tests
- e2e — `pnpm playwright test`; `@playwright/test` was installed ahead of schedule in this phase
  with one chromium smoke spec covering the toggle + harness (see Implementation Notes). The
  cross-browser critical-path matrix is still Phase 04.
- the default smoke check

If this phase needs a custom smoke target or other phase-specific note, record it here:

```bash
# Optional phase-specific smoke override — reuse Phase 02's dev harness check; the toggle renders
# on the same page, so a 200 + harness marker is still sufficient at this phase.
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/dev/remove-background
# expected: 200
curl -s http://localhost:3000/dev/remove-background | grep -a -q 'data-testid="remove-background-test-harness"'
# expected: match found (exit 0) — see docs/KNOWN_GOTCHAS.md for the `-a` requirement
```

---

## Architect Review Notes

Use this section after manual product, UX, API, or workflow verification. This is the human-facing
channel for post-implementation fixes.

Add one unchecked checkbox per issue the agent must fix before the phase can close. Keep each item
independently fixable and describe observed behavior plus expected behavior. If the fix may change
SPEC/API/schema/security behavior, say so explicitly in the note.

The agent resolves these items through `/impl-assist 03 review`. Leave an item unchecked while it
is still open. Check it off only after the fix is implemented and re-verified. If manual
verification found nothing, keep the default checked line below.

- [x] No architect review issues recorded

---

## Implementation Notes

<!-- Optional. The agent adds a short bullet here only when something isn't already visible from
     the code or commit history: an intentional deviation from the plan, a residual risk, a
     rejected alternative. Leave empty when nothing needs recording — this is not a mandatory
     per-task log. -->

- `shared/ui` components (`button.tsx`, `switch.tsx`, `card.tsx`) are flat files at the CLI's
  actual output path, not the `shared/ui/button/*`-style subfolders sketched in this phase's Files
  list — matches the current `shadcn` CLI's real behavior; a public `shared/ui/index.ts` still
  aggregates the exports so consumers only import from the slice's public API.
- `useBackgroundRemoval`'s new `qualityMode` param is optional (falls back to
  `DeviceCapabilities.defaultQualityMode` when omitted) rather than required, so Phase 02's
  existing test suite and the `RemoveBackgroundTestPanel` default behavior stay unchanged when no
  caller supplies it — the toggle only overrides it explicitly on the dev route.
- Added `resolve.tsconfigPaths: true` to `vitest.config.ts` (mirroring `vite.config.ts`) so
  shadcn's `@/*`-aliased imports inside `shared/ui` resolve under Vitest too; without it every test
  importing a `shared/ui` component fails to resolve `@/shared/lib/utils`.
- `useQualityMode`'s initial-state read must guard `typeof window === "undefined"` — TanStack
  Start SSRs this route first, and jsdom-based unit tests never catch this class of bug (`window`
  always exists there). Caught via manual `curl` verification, not the automated test suite. See
  `docs/KNOWN_GOTCHAS.md`.
- Architect explicitly requested Playwright e2e coverage for this phase's manual verification pass,
  ahead of STACK.md's original Phase 04 target. Installed `@playwright/test` (chromium only —
  `npx playwright install --with-deps` needs root and isn't available in this environment; plain
  `npx playwright install chromium` works without it) with `playwright.config.ts` at the repo root
  and one smoke spec, `e2e/dev-remove-background.spec.ts`, covering harness render, toggle
  interaction, and `localStorage` persistence across reload. STACK.md's E2E gate row and the
  Testing/Project-structure sections are updated to match; the cross-browser critical-path matrix
  (upload → process → download) is still deferred to Phase 04.
- The e2e spec must wait for the harness's device-detection line to leave its `detecting…`
  placeholder before interacting with the quality toggle or re-checking it after `page.reload()`.
  TanStack Start's SSR markup for the switch is byte-for-byte plausible before hydration runs, so
  Playwright's actionability checks (visible, stable, receives events) don't catch a
  click-before-hydration race; a click that lands before hydration attaches handlers is silently
  dropped. Waiting for that text change is a reliable, code-free hydration signal already present
  in the page. See `docs/KNOWN_GOTCHAS.md`.

---

## Atomic Commit Message

```
feat(phase-03): quality toggle & design system — shadcn/ui + shared/ui + quality-mode-toggle
```

---

## Post-Phase Checklist

- [ ] All Scope checkboxes checked (or deferred in Architect Review Notes)
- [ ] All automated gate checks green
- [ ] All architect review notes resolved
- [ ] `docs/STATE.md` updated — run `/context-update 03`
- [ ] Committed atomically on `feat/phase-03` branch
- [ ] Tag created after merge to develop: `git tag -a v0.03.0 -m "Phase 03: Quality toggle & design system"`
