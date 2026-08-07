# Frontend Engineering Contract

> Canonical engineering contract for the BG Remove App frontend. Read it before planning,
> implementing, or reviewing React/TypeScript changes. Hard requirements are blocking; decision
> tests require an explicit answer in the implementation plan and review. Do not duplicate these
> rules in code comments or skills.

The contract is prospective: apply it to new code and every existing boundary deliberately touched
by the active phase. It does not authorize unrelated mechanical rewrites.

## 1. Priorities and enforcement

When rules pull in different directions, use this order:

1. correctness, privacy, cancellation, stale-result rejection, and resource release;
2. one authoritative owner for each state and operation;
3. readable data flow and focused render ownership;
4. the smallest useful abstraction and module surface;
5. reuse and file organization;
6. local syntax preferences.

Every frontend `/impl-assist` run must apply the project-local `frontend-implementation` skill and
finish with `Frontend contract: PASS` before its task or review note is checked off. The result is
supported by three kinds of evidence:

| Evidence | Owns |
|----------|------|
| ESLint, TypeScript, Steiger, Fallow | syntax, import direction, static boundaries, changed-code warnings |
| Vitest and Playwright | observable behavior, lifecycle, selector and render regressions |
| Changed-surface review | ownership, meaningful decomposition, absence of prop relays and speculative abstractions |

Static tools inform architectural review; they do not replace it. A warning is traced to a real
consumer before changing code, and an architectural violation cannot be waived merely because the
automated checks are green.

## 2. State and runtime ownership

### Hard requirements

- XState application actors are the only source of truth for durable editor workflow: document
  status, progress, errors, drafts, committed history, workspace membership, and selection.
- `src/editor/runtime` and `EditorSession` own browser resources and integrations: blobs, pixels,
  canvases, object URLs, workers, transferable buffers, cancellation, correlation, and cleanup.
- A presentation/view model may own UI-only state and semantic commands. It must not copy actor
  workflow state or browser resources into another store.
- React-local state is reserved for one component or one tightly owned UI interaction such as
  disclosure, hover, focus, or an uncommitted visual choice.
- Pointer coordinates, brush previews, pan/zoom intermediates, and other high-frequency values stay
  imperative or tool-local when React does not need to render them.
- Async completion must fail closed after cancellation, replacement, reset, disposal, revision
  change, or document/tool switch. Changed resource owners retain deterministic release paths.

Use the lightest construct that expresses the owner:

- pure function for a deterministic decision or transformation;
- XState actor for event-driven workflow and transitions;
- class for identity, mutable state, a subscription boundary, or explicit lifecycle;
- focused service/facade when one use case coordinates several collaborators;
- custom hook for React binding and component-local behavior, not hidden workflow ownership.

A facade coordinates and delegates; it is not permission to create a god object. Do not wrap
stateless helpers in classes merely for visual uniformity.

## 3. React data flow and render ownership

### 3.1 Stable model boundary

A provider for a complex capability may expose stable model, service, or actor references. Its
context value must keep the same identity for that model lifetime. Never put current snapshots,
fresh projections, changing arrays/objects, or inline command collections in context.

For the public editor, the provider owns one stable `EditorSession` plus one small view model. The
view model owns UI preferences and semantic commands only; XState remains workflow truth.

### 3.2 Subscribe at the consumer

- Use XState `useSelector` at the connector that renders or adapts the selected value.
- Bind non-XState stores with `useSyncExternalStore`. `getSnapshot` and `getServerSnapshot` must
  return cached identities between changes.
- Select primitives or stable identities by default. A selector returning an object/array must
  reuse its identity or provide a justified comparison policy.
- A parent must not observe progress, history, export state, or tool state needed only by a leaf.
- Do not subscribe to a whole session/workspace snapshot and then construct a broad projection for
  unrelated descendants.

### 3.3 Connector and UI boundary

A connector may know the model, XState, or runtime-facing selector hooks. A reusable presentation
component does not: it receives only the data and semantic callbacks required for its own output.

The following are forbidden through intermediate presentation components:

- `EditorSession` instances;
- actor snapshots or broad workspace/document snapshots;
- catch-all projections that combine several capabilities;
- universal `onIntent` unions used only to relay events further down;
- callback or JSX-slot bundles forwarded unchanged across multiple levels.

Passing narrow props for one direct connector-to-view boundary is normal React composition, not
prop drilling. A component that receives a model value or command must use it for its own
responsibility; otherwise move the subscription/command to the real consumer or remove the
intermediate component.

Prefer semantic callbacks such as `onRetry`, `onReset`, or `onSelectSize` over a capability-wide
event dispatcher in pure UI. Do not add `memo`, `useMemo`, or `useCallback` by reflex: use them only
across a meaningful stable boundary or after a render regression is observed.

### 3.4 Effects

- Effects synchronize React with an external system; they do not derive render data that can be
  calculated directly.
- Name effect callbacks with the `Fx` suffix so traces and cleanup ownership are readable.
- Register and clean up a subscription in the same effect.
- On React 19.2+, use `useEffectEvent` for the latest callback used only from an effect-owned
  listener. Do not hand-roll a generic latest-ref relay.
- Functional state updaters stay pure: no worker messages, network calls, timers, analytics, or ref
  mutation inside them.

## 4. Meaningful decomposition

### Hard requirement: no abstraction without a job

Before extracting a component, hook, wrapper, service, utility, folder, or barrel, name the
responsibility it owns. Keep the abstraction only when at least one is true:

- it owns state, a subscription, an effect, or lifecycle;
- it implements a coherent domain/presentation policy;
- it forms an accessibility, validation, error, or resource boundary;
- it owns a meaningful layout region or independently testable interaction;
- it removes proven repeated behavior behind one stable contract.

Inlining is preferred when the proposed abstraction only renames one component/tag, fixes props to
constants, re-exports a single internal file without an external boundary, or forwards values it
does not consume. `PublicEditorDiagnostics`-style fixed-prop wrappers are prohibited.

A file normally has one primary exported component. Small private helpers may remain beside it when
they are inseparable, have no independent contract, and extraction would add navigation without
clarifying ownership. Split a component when responsibilities or render owners differ, not to meet
a line-count or one-component-per-file quota.

Props belong to the component's own rendering and interaction contract. If a props type mixes data,
commands, and slots from several domains, or most fields are forwarded, split the ownership rather
than grouping props into another object.

## 5. Project structure and selective FSD

The project keeps useful FSD vocabulary and dependency direction, not FSD ceremony.

### Hard requirements

- Source layers remain `shared → entities → features → widgets → pages → app`; imports point only
  downward. Framework-mandated root files documented in `KNOWN_GOTCHAS.md` are explicit exceptions.
- Cross-slice imports remain forbidden between `entities` and between `features`.
- Direct same-layer composition is allowed between `widgets` and between `pages` when it removes
  adapter props, portals, context bridges, or artificial relocation.
- `src/editor/{domain,application,runtime,testing}` remains role-oriented.
  Domain/application do not import React, UI, browser globals, workers, or providers; runtime owns
  browser adapters; `src/widgets/editor` binds those owners to React.
- Cross-slice consumers use a slice's intentional public API. Capability-internal imports are
  relative and may address their real file directly.

Create `index.ts`, `components/`, `hooks/`, `model/`, `.types.ts`, or `.utils.ts` only when they make
an actual public boundary or a growing capability easier to navigate. Do not create empty roles,
one-file directories, layer-wide dumping grounds, or barrels solely to satisfy a template.

Keep a type beside its only consumer. Shared multi-file types may use ordinary exported type aliases
or interfaces; use a namespace only when the domain genuinely benefits from namespace semantics.
Use `type` for unions, mapped types, and component props. An `interface` is allowed for an object
contract intended for extension or implementation. Export only consumed names.

`shared` contains proven cross-cutting contracts. Do not move code to `shared` in anticipation of a
second consumer.

## 6. Component and file conventions

- Files and directories use kebab-case except framework-generated or framework-mandated route
  names. Components use PascalCase and plain function declarations; do not introduce `React.FC`.
- Destructure props, hook results, or parameters when it improves local readability. Do not create
  same-name aliases, rebuild a rest object merely to forward it, or destructure so broadly that
  ownership becomes hidden.
- Do not store JSX subtrees in local variables. Keep simple conditional JSX inline or extract a
  meaningful component.
- Nested ternaries are forbidden. Use `if`, `switch`, policy functions, or independent conditions.
- Render-prop/component/element slots use PascalCase; `children` is the exception. Prefer direct
  composition over slots that merely relay content through several owners.
- Use repository `Typography`, `Image`, navigation, external-link, and composite interaction
  primitives for contracts they already own. Do not wrap a primitive merely to hide one tag.

## 7. Platform boundaries

- Route navigation and params go through the typed `shared/lib` router boundary; route-file APIs
  remain framework exceptions.
- Persisted browser state goes through `shared/lib/storage`; validate parsed values. Test doubles
  may stub platform globals.
- Only `shared/config/env.ts` and `runtime.ts` read environment/runtime globals directly.
- Presentation date formatting goes through `shared/lib/formatting`; deterministic runtime clocks
  and fixtures stay with their owners.
- Content/preview images use `shared/ui/media`; the image component consumes an already owned URL
  and never creates or revokes object URLs.
- Worker creation, typed messaging, cancellation, and termination belong to runtime owners, never a
  presentation hook.
- At large browser/runtime boundaries, avoid avoidable intermediate collections. Use one bounded
  pass when scanning files, transferables, typed arrays, pixels, or worker payloads.

## 8. Testing contract

- New behavior and newly extracted logic ship with focused Vitest coverage in the same change.
- A changed user-facing flow also updates Playwright coverage and is run host-first, never in
  Docker. Prefer roles, labels, and visible state over CSS selectors.
- Test observable behavior, ownership, cleanup, and stale-result rejection rather than private
  implementation details.
- Add a focused React Profiler/render-count regression when the task moves a hot subscription or
  high-frequency control. Assert that unrelated owners do not commit.
- Isolate browser globals with Vitest setup/teardown and restore timers after clock-dependent tests.

## 9. Frontend completion checklist

Before reporting `Frontend contract: PASS`, answer all of the following from the changed surface:

- What owns each new or moved state, command, subscription, and browser resource?
- Does every connector select only values its view consumes?
- Does any intermediate component relay model objects, broad projections, intents, or slots?
- What concrete job justifies every new abstraction and public export?
- Are import direction and entity/feature isolation preserved without adapter-only code?
- Are snapshot and context identities stable between real changes?
- Are async correlation, cleanup, SSR, accessibility, localization, and focus behavior preserved?
- Which focused unit, render, E2E, static, and type checks prove the change?

Any unanswered item is `Frontend contract: FAIL`; do not check off the implementation task.
