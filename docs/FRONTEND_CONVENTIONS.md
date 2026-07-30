# Frontend Conventions

> Canonical rule set for the bg_remove_app frontend (React + TanStack Start, FSD layers,
> Steiger-linted). Every rule here is a **hard requirement** for new code, not a suggestion.
> Update this file when a new rule is introduced; do not duplicate rules in code comments.
>
> Adapted from `patient_tracker`'s `docs/FRONTEND_CONVENTIONS.md` at the architect's request
> (2026-07-30), with stack-specific substitutions (TanStack Router/Start instead of React Router,
> Paraglide instead of react-i18next, no backend/generated-schema layer), one addition (§9, worker
> lifecycle) that reflects this project's Web Worker-heavy inference architecture, and one
> deliberate deviation (§2.2: plain function declarations instead of arrow+`React.FC`, since this
> codebase already writes components that way everywhere).
>
> **Adoption for existing code**: this file governs all code written from 2026-07-30 onward. It is
> not retroactive authorization to mass-rename or mass-rewrite existing files — per `AGENTS.md`
> Scope Lock and `docs/PHASE_31.md`'s explicit ban on blanket rewrites without callsite evidence,
> bringing existing files into line with a given rule happens only (a) as a normal side effect of a
> file already being touched for unrelated work, or (b) as an approved PHASE_31 findings-ledger fix.
> See the Architect Review Notes callout at the end of this file for the specific open decision.

---

## 1. File Naming

- **All file names use kebab-case**: `mask-correction-canvas.tsx`, `use-tool-workspace-controller.ts`.
- React component files export a PascalCase component — the file name and the component name are
  intentionally different: `mask-correction-canvas.tsx` exports `const MaskCorrectionCanvas`.
- Directories also use kebab-case (already the FSD norm here: `features/correct-mask/`,
  `widgets/tool-workspace/`).
- TanStack Router file-based routes keep the router's own file-naming rules (`src/routes/`); this
  rule applies to everything under `ui/`, `model/`, `lib/`, `worker/` inside a slice.

---

## 2. Component Authoring

### 2.1 One component per file

Never define two functional (exported or non-trivial internal) components in the same file. Extract
sub-components into their own file under the owning slice's `ui/` directory.

### 2.2 Plain function declarations, not `React.FC`

This deviates from `patient_tracker`, which mandates arrow functions typed with `React.FC`. This
codebase already uses plain function declarations everywhere (zero existing `React.FC` usage) — the
architect confirmed (2026-07-30) that this is a deliberate, kept convention, not a gap to close.

```ts
// correct
function MatteRefinementControls(props: Props) {
  return <div>{props.label}</div>;
}

// forbidden — do not introduce React.FC/arrow-function components
const MatteRefinementControls: React.FC<Props> = (props) => { ... };

// forbidden — destructuring still applies, see §2.4
function MatteRefinementControls({ label }: Props) { ... }
```

### 2.3 Props type naming

- Use `type`, never `interface`.
- Unexported, file-local props type: name it simply `Props`.
- Reused across files: give it a descriptive, exported prefix (`export type MatteRefinementControlsProps`).

### 2.4 No destructuring in components

Access props via `props.<name>`, not via destructuring in the signature or body.

### 2.5 No destructuring of hook return values

Assign a hook's object return to one variable and access fields via dot notation
(`const workspace = useToolWorkspaceController(); workspace.activeTool`). `useState`'s array
destructuring remains the standard exception.

### 2.6 No inline JSX variable assignments

Don't assign JSX to a local variable inside a component to "build" a sub-tree. Extract a real
component instead.

### 2.7 `useEffect` naming convention

Every `useEffect` callback is a **named function** with the `Fx` suffix:

```ts
useEffect(function syncActiveToolFx() {
  if (!activeTool) resetToDefaultTool();
}, [activeTool]);
```

---

## 3. Module Structure

Each feature/widget slice follows FSD (`model/`, `ui/`, `lib/`, `worker/` — create only what's
needed) plus these module-local conventions:

```
features/correct-mask/
  model/
    use-mask-correction.ts   # primary hook — compose smaller hooks, don't inline everything
    correct-mask.types.ts    # namespace CorrectMaskTypes { ... } for module-local shared types
  ui/
  worker/
  index.ts                   # public API — the only import surface other layers may use
```

Types reused **across slices** belong in:
- `entities/<name>/model/` for domain entity types (already the pattern: `entities/edit-document`,
  `entities/processed-image`)
- `shared/lib/` or a dedicated `shared/types` module for cross-cutting non-domain types

### 3.1 Namespaced module types

```ts
// features/correct-mask/model/correct-mask.types.ts
export namespace CorrectMaskTypes {
  export type BrushStroke = { x: number; y: number; pressure: number };
  export type ToolState = { brushSize: number; strokes: BrushStroke[] };
}
```

Consume via dot notation: `CorrectMaskTypes.BrushStroke`.

---

## 4. Custom Hooks

### 4.1 Location and granularity

- Hooks used only within one slice: `<slice>/model/use-xxx.ts`.
- Hooks used across slices: `shared/lib/use-xxx.ts` (or `entities/<name>/model/` if entity-owned).
- **Compose, don't accumulate.** A hook that would otherwise own a state machine *and* worker
  orchestration *and* derived selectors *and* effect wiring must split those concerns into smaller
  `use-*` hooks and compose them in one entry hook. This is the direct fix for this project's
  current god-hooks (`use-tool-workspace-controller.ts`, `use-object-selection.ts`) — tracked as a
  PHASE_31 finding, not restated here as new scope.

### 4.2 No destructuring in hook params

```ts
// correct
function useMaskCorrection(params: { document: EditDocument }) {
  const document = params.document;
}

// forbidden
function useMaskCorrection({ document }: { document: EditDocument }) { ... }
```

---

## 5. Routing

### 5.1 `useRouter` — single routing entry point

**Never import `useNavigate`, `useParams`, `useSearch`, or `useLocation` directly from
`@tanstack/react-router` inside feature/widget/page code.** Wrap them once in
`shared/lib/use-router.ts` and consume that everywhere:

```ts
import { useRouter } from '@shared/lib/use-router';

const router = useRouter();
router.navigate({ to: '/avatar' });
router.params.someParam;
```

This hook does not exist yet — creating it is a PHASE_31/32-scoped task (a shared wrapper, not a
per-call-site migration mandate); new code should use it as soon as it lands.

### 5.2 Typed search params

If a route needs search-param state, validate it with a schema at the boundary (TanStack Router's
built-in `validateSearch` + Zod, matching the pattern already used for search-param-driven routes)
rather than reading raw string params ad hoc in a component.

---

## 6. Storage, JSON, and Env

### 6.1 Never access `window.localStorage` directly

Route all reads/writes through a `safeLs` wrapper in `shared/lib/safe-ls.ts` (does not exist yet —
create it before or alongside the next feature that touches `localStorage`, e.g. PHASE_32's
`helpState`). Existing direct `localStorage` call sites (`use-quality-mode.ts`, `ToolWorkspace`
tests) migrate opportunistically, not as a standalone rename pass.

**Why:** raw `localStorage` throws under SSR, hides deserialization errors, and has no schema
versioning — all three matter here since TanStack Start renders on the server first.

### 6.2 Never use raw `JSON.parse`/`JSON.stringify` for persisted state

Use a `safeJson` wrapper (`shared/lib/safe-json.ts`, to be created alongside `safe-ls`) that
validates the parsed shape against a type guard instead of trusting `JSON.parse`'s `any`.

**Exception**: `JSON.stringify` for a Worker `postMessage` payload or an HTTP-adjacent boundary is
not "storage" — no wrapper required, but note the exception inline if it's non-obvious.

### 6.3 Never read `import.meta.env` directly outside the env module

Already the convention here — `shared/config/env.ts` is the only file that should read
`import.meta.env`. Keep it that way; import `env` from `@shared/config` everywhere else.

---

## 7. Date Formatting

If a feature ever needs to display a date (none do today), never inline `new Date(...)`,
`Intl.DateTimeFormat(...)`, or `toLocaleDateString` in a component. Add a `shared/lib/date.ts`
helper keyed off the active Paraglide locale, matching how `shared/lib/seo` centralizes other
locale-sensitive formatting.

---

## 8. Types

- Use `type`, never `interface`, for all type aliases.
- Export only what's consumed outside the file.
- This project has no backend/generated schema layer (client-only, SPEC.md §4) — domain types are
  hand-written in `entities/*/model/types.ts` and are the source of truth; there is no generated
  schema to avoid duplicating.

---

## 9. Worker Lifecycle

*(No equivalent in `patient_tracker`; added because this project's editor features are Web
Worker-heavy in a way a typical CRUD frontend isn't.)*

Never hand-roll `new Worker(...)` / `postMessage` / `.terminate()` directly inside a feature's
model hook. Six feature slices currently do this independently (`remove-background`,
`select-object`, `refine-matte`, `refine-foreground`, `model-lab`, `batch-processing`) — tracked as
a PHASE_31 duplication finding. The target shape is a shared `shared/lib/use-worker.ts` (or
equivalent) owning init, typed `postMessage`/`onmessage`, abort-on-stale-run, and teardown-on-unmount
once, with each feature supplying only its message-payload types and handler.

---

## 10. Testing

### 10.1 Tests are mandatory for all new functionality

Every new hook, component, or utility ships with test coverage in the same commit as the
implementation — not a follow-up. This project already enforces this via `AGENTS.md` core rule 8
(mandatory Playwright coverage for user-facing flows) and `docs/STACK.md`'s Vitest/Playwright gate
commands; this section exists only to make the "not optional, same commit" expectation explicit for
non-e2e coverage too (hooks, utils, pure logic).

### 10.2 E2E stays host-only

Already covered by `AGENTS.md` core rule 8 and `docs/STACK.md` § Testing — Playwright never runs in
Docker or (beyond the mocked `ci-critical` exception) in CI. No change here.

### 10.3 Unit test conventions

- Vitest (`pnpm vitest run`) for all unit/integration tests; Testing Library for hooks/components.
- Use `vi.stubGlobal`/`vi.unstubAllGlobals` in `beforeEach`/`afterEach` to isolate globals
  (`navigator.gpu`, `Worker`, `OffscreenCanvas`, etc. — this project stubs these heavily already).
- Use `vi.useFakeTimers()` + `vi.setSystemTime()` for any code touching `new Date()`; always restore
  with `vi.useRealTimers()` in `afterEach`.
- Test observable behavior (return values, thrown errors, side effects on stubs/mocked workers), not
  implementation details.

### 10.4 E2E conventions

- One spec file per user-facing flow under `e2e/`, following this repo's existing naming
  (`e2e/phase-XX-*.spec.ts` where phase-scoped).
- Target user-visible text or ARIA roles (`getByRole`, `getByText`) over CSS selectors, matching
  current practice.

---

## Architect Review Notes

- [x] `React.FC`/arrow-function question resolved (2026-07-30): keep the existing
  `function Component(props)` declaration style codebase-wide. §2.2 updated to match; this is now a
  fixed constraint, not a target to migrate away from.
- [ ] **Open decision**: how strictly should existing files be brought into line with §2.4/§2.5
  (no destructuring of props or hook returns), §2.7 (`Fx`-suffixed effects), and §1 (kebab-case
  component filenames)? Today's codebase destructures props in some components (e.g.
  `QualityModeToggle`) and uses PascalCase component filenames throughout (~45+ files would be
  touched by a literal rename). Adopting these prospectively-only (new code + files already being
  touched for another reason) avoids a blanket rewrite that `docs/PHASE_31.md` explicitly forbids;
  adopting them as an explicit dedicated PHASE_31 finding would require the architect's sign-off on
  that scope before any mass edit starts.
