# PHASE 32 — Guided Help & Onboarding

<!-- TOKEN BUDGET: keep this file under 10,000 tokens. Be concise. -->

## Phase Metadata

| Field | Value |
|-------|-------|
| Phase | `32` |
| Title | Guided Help & Onboarding |
| Status | `⏳ pending` |
| Tag | `v0.32.0` |
| Depends on | PHASE_31 gate passing |

---

## Phase Goal

Research how short animated demonstrations and contextual onboarding can clarify the redesigned
workflow, then ship a small, replayable, accessible help system. Guidance must explain the real
current controls for both single and selected-batch workflows without blocking the automatic first
result, bloating the initial bundle, or becoming the only source of required information
(SPEC.md §5.2–§5.4, §7.1, §7.7–§8).

## Design References

- [remove.bg Magic Brush help](https://www.remove.bg/uk/help/a/how-to-use-magic-brush) — reference
  for compact visual instruction tied to a tool, not a pixel-identical implementation.
- [WCAG 2.2: Animation from Interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions)
  and [Pause, Stop, Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html) —
  reduced-motion and user-control acceptance criteria.

---

## Scope

### Other

- [ ] `T1` Inventory every point where users may need help: one/many upload and modes, first result,
  Cutout Magic/Manual, brush size/zoom, Enhancements, Background, undo/redo, individual download,
  ZIP, dirty-draft switching, and recoverable errors. Rank by observed confusion and define one
  measurable learning goal per retained item; do not create a tour for self-explanatory controls —
  _Depends on:_ —
- [ ] `T2` Research and record the delivery decision in `docs/research/GUIDED_HELP.md`: authored
  video/animated WebP/AVIF, CSS/canvas, and a code animation runtime are compared for file size,
  transparency, crispness, localization, reduced motion, pause/replay, CSP, cacheability,
  maintainability, and creation workflow. Include a representative prototype and measured build/
  network/decode cost before selecting a format or dependency — _Depends on:_ `T1`
- [ ] `T3` Define a repeatable content pipeline: capture/source ownership, safe fixture images,
  crop/dimensions, duration/looping, compression, poster/static alternative, RU/EN text/transcript,
  naming/versioning, review checklist, and how a designer or agent updates an instruction without
  editing orchestration code — _Depends on:_ `T2`

### Frontend

- [ ] `F1` Add `features/guided-help` with a typed, versioned registry keyed by user task and
  context (`single` or `batch-selected`). Definitions reference lazy instruction assets, localized
  title/body/accessible description, eligibility, placement, and completion/dismiss rules; no
  editor business logic is duplicated in help definitions — _Depends on:_ `T2`, `T3`
- [ ] `F2` Add unobtrusive contextual help cards/popovers for only the retained high-risk
  interactions and a persistent toolbar/site Help entry that reopens the complete task list.
  First-use guidance never interrupts upload, processing, or download and never uses a forced
  modal carousel — _Depends on:_ `F1`
- [ ] `F3` Produce the approved small instruction set for upload/modes, Magic vs Manual and brush
  size, Enhancements, Background/download, and batch item switching/ZIP. Each demonstration must
  match the implemented UI and have localized text plus a static poster/step alternative —
  _Depends on:_ `F1`, `F2`
- [ ] `F4` Persist only versioned viewed/dismissed task IDs in `helpState`; allow dismiss, replay,
  and reset. A content-version bump reopens only materially changed guidance. Never store image,
  filename, action coordinates, or a behavioral profile — _Depends on:_ `F1`
- [ ] `F5` Honor `prefers-reduced-motion`, never flash, expose pause/replay for continuing motion,
  make every trigger/control keyboard and screen-reader operable, preserve focus, and ensure the
  static/text path completes the same learning goal — _Depends on:_ `F2`, `F3`
- [ ] `F6` Lazy-load help code/assets only after editor intent or explicit Help activation. Record
  and enforce the asset/initial-bundle budgets selected by `T2`; failed asset loading falls back to
  static/text guidance without affecting editing — _Depends on:_ `F1`–`F5`
- [ ] `F7` Add unit/component tests for eligibility, version migration, dismiss/replay/reset,
  single/batch context, missing-asset fallback, localization, focus, and reduced motion. Add
  bilingual cross-browser Playwright coverage proving guidance never blocks the core flow and
  accurately targets the visible controls — _Depends on:_ `F1`–`F6`

### Infra

- [ ] `I1` Add a runtime/package only if `T2` demonstrates a net advantage over native assets/CSS.
  Pin and document any dependency/license in `docs/STACK.md`; keep instruction assets self-hosted,
  immutable, and absent from the initial critical path — _Depends on:_ `T2`, `F7`

---

## Files

### Create / modify

~~~
docs/research/GUIDED_HELP.md
src/features/guided-help/model/types.ts
src/features/guided-help/model/help-registry.ts
src/features/guided-help/model/use-guided-help.ts
src/features/guided-help/model/*.test.ts
src/features/guided-help/ui/ContextualHelp.tsx
src/features/guided-help/ui/HelpCenter.tsx
src/features/guided-help/ui/*.test.tsx
src/features/guided-help/index.ts
src/widgets/tool-workspace/ui/EditorToolbar.tsx
src/widgets/tool-workspace/ui/ToolWorkspace.tsx
src/shared/ui/site-header/
public/help/
messages/ru.json
messages/en.json
e2e/guided-help.spec.ts
docs/STACK.md
docs/PHASE_32.md
~~~

### Do NOT touch

- Editor processing, model, matte, compositing, history, or export semantics
- Add product analytics for tutorial views/completion or store interaction-level behavior
- Add a third-party hosted media/tracking embed, forced tour, autoplay audio, or image upload
- Studio layers/transforms/effects, accounts, backend persistence, or future metadata collection

---

## Contracts

### New persistent data (tables / collections / files)

```text
localStorage.helpState = {
  schemaVersion: 1,
  contentVersion: string,
  viewedTaskIds: string[],
  dismissedTaskIds: string[]
}
```

Only bounded allow-listed task IDs are accepted. Invalid/old state is discarded safely. No server
storage, identifier, timestamp trail, source image, filename, or action telemetry is added.

### New API endpoints / RPC methods / events

None.

### New types / models / shared interfaces

```ts
type HelpContext = "single" | "batch-selected";

interface GuidedHelpDefinition {
  id: string;
  contentVersion: string;
  contexts: readonly HelpContext[];
  asset: { animated: string; poster: string };
  title: string;
  body: string;
  accessibleDescription: string;
}
```

### New env vars

None.

---

## Gate Checks

Run `/phase-gate 32`; standard commands plus:

```bash
pnpm vitest run src/features/guided-help src/widgets/tool-workspace
pnpm e2e e2e/guided-help.spec.ts e2e/home.spec.ts
pnpm build
pnpm tsc --noEmit
pnpm exec steiger ./src
```

Fail if onboarding blocks the first result, assets enter the initial critical path, motion cannot
be reduced/paused where required, static/text alternatives are missing, content shows stale
controls, help state captures behavior/image data, or single and selected-batch guidance diverge.

---

## Architect Review Notes

- [x] No architect review issues recorded

## Implementation Notes

None

## Atomic Commit Message

```text
feat(phase-32): add contextual help and onboarding
```

## Post-Phase Checklist

- [ ] Scope complete; gates green; review notes resolved
- [ ] Run `/context-update 32`
- [ ] Commit on `feat/phase-32`; tag `v0.32.0` after merge
