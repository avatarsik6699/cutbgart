# PHASE 04 — Home page UI

<!-- TOKEN BUDGET: keep this file under 10,000 tokens. Be concise. -->

## Phase Metadata

| Field | Value |
|-------|-------|
| Phase | `04` |
| Title | Home page UI |
| Status | `✅ done` |
| Tag | `v0.04.0` |
| Depends on | PHASE_03 gate passing |

---

## Phase Goal

Deliver the full product experience on the primary page: `pages/home` composes
`features/upload-image` (new), `features/quality-mode-toggle` (Phase 03), `features/remove-background`
(Phase 02), a `BeforeAfterSlider` result view, and `features/download-result` (new) into the real
upload → process → download flow, replacing the Phase 01 hello-world placeholder at `/`. All of the
§5.3 UI states are wired end to end, with the accessibility requirements in §5.4 (SPEC.md §5, §8).

<!-- none provided — no Figma/design assets for this cycle (SPEC.md §5, architect confirmed via
     /phase-init) -->

---

## Scope

<!-- Group tasks by area (Backend / Frontend / Infra / Data, etc.).
     ID scheme: B=Backend · F=Frontend · I=Infra · D=Data · T=other (ungrouped)
     Each item: `ID` description — _Depends on:_ ID, ID or —
     IDs are stable after assignment — never renumber. Mark removed tasks as ~~BN~~ (removed). -->

### Frontend
- [x] `F1` Scaffold `features/upload-image` slice (public API `index.ts`, `model/`, `ui/` per FSD):
  drag-and-drop (full working area), click-to-browse, clipboard paste, mobile camera capture
  (`capture` attribute); format/size/resolution validation (JPEG/PNG/WebP, 20 MB hard limit);
  client-side downscale above 4096px on the longest side (SPEC.md §1.3, §5.2, §7.1) —
  _Depends on:_ —
- [x] `F2` Build the `BeforeAfterSlider` display component in `entities/processed-image`
  (SPEC.md §5.2) — _Depends on:_ —
- [x] `F3` Scaffold `features/download-result` slice — PNG-with-alpha download button, releasing
  the object URL via `URL.revokeObjectURL` after download or on next processing (SPEC.md §2.2,
  §5.2) — _Depends on:_ —
- [x] `F4` Compose `pages/home`: wire `F1` (upload) + `features/quality-mode-toggle` (Phase 03) +
  `features/remove-background`'s `useBackgroundRemoval` (Phase 02) + `F2` (result slider) + `F3`
  (download) into the full state machine — `idle → model-loading → ready → processing → result`,
  `error` reachable from any state, real (non-simulated) model-load progress, WASM path labeled
  "lightweight mode", "process another image" reset without page reload, one-click "recompute in
  max quality" (SPEC.md §5.3); root element carries `data-testid="home-page"` (same convention as
  Phase 02's harness) for the gate smoke check and e2e — _Depends on:_ `F1`, `F2`, `F3`
- [x] `F5` Replace the Phase 01 hello-world placeholder: `routes/index.tsx` becomes a thin
  `loader` + head-meta shell rendering `pages/home` (SPEC.md §5.2, §5.5) — _Depends on:_ `F4`
- [x] `F6` Accessibility (SPEC.md §5.4): real `<input type="file">` under the drop zone
  (keyboard-accessible, not visual-only), `aria-live="polite"` region announcing state
  transitions, WCAG AA contrast/focus states on all interactive elements, mobile "choose photo"
  button (with `capture`) replacing drag-and-drop — _Depends on:_ `F1`, `F4`
- [x] `F7` Unit + integration tests (Vitest, Testing Library): `upload-image` validation/downscale,
  `BeforeAfterSlider`, `download-result`, and the composed state machine in `pages/home`
  (SPEC.md §7.7) — _Depends on:_ `F1`, `F2`, `F3`, `F4`
- [x] `F8` Playwright e2e: extend beyond Phase 03's dev-harness smoke spec with the critical-path
  flow (upload → process → download) on the real `/` page, plus the cross-browser matrix — WebGPU
  path and WASM fallback as separate projects, must include Safari/iOS (SPEC.md §7.4, §7.7;
  AGENTS.md core rule 8) — _Depends on:_ `F4`, `F5`

<!-- No Backend, Infra, or Data groups: no server-side API surface or persistent store this phase
     either (SPEC.md §3, §4 architectural invariant); no new infra beyond what Phase 01/03 already
     set up. -->

<!-- Test execution is governed by `## Gate Checks` below + docs/STACK.md § Gate Commands.
     Do not duplicate that list here. -->

---

## Files

### Create / modify
~~~
src/features/upload-image/index.ts
src/features/upload-image/model/*  (validation, downscale logic + tests)
src/features/upload-image/ui/*     (drop zone, choose-photo button + tests)
src/features/download-result/index.ts
src/features/download-result/ui/DownloadResultButton.tsx (+ test)
src/entities/processed-image/ui/BeforeAfterSlider.tsx (+ test)
src/entities/processed-image/index.ts (export BeforeAfterSlider)
src/pages/home/index.ts
src/pages/home/ui/HomePage.tsx (+ test)
src/routes/index.tsx (replace hello-world placeholder; thin loader + head-meta)
playwright.config.ts (add browser projects for the cross-browser matrix)
e2e/home.spec.ts (critical-path + cross-browser coverage)
~~~

### Do NOT touch
- `src/features/remove-background/**` — Phase 02's slice is consumed, not modified
- `src/features/quality-mode-toggle/**` — Phase 03's slice is consumed, not modified
- `/dev/remove-background` route/harness — stays as the isolated ML test harness; not removed or
  redesigned this phase
- Analytics/Umami wiring — Phase 05
- SEO scenario pages (`/udalit-fon-*`, `/about`) and `scripts/generate-sitemap.ts` — Phase 06

---

## Contracts

> This section is the source of truth for `/context-update`. Fill it in **before** handing to AI.

### New persistent data (tables / collections / files)

None (no new `localStorage` keys or server-side store this phase — reuses `qualityMode` from
Phase 03; SPEC.md §3 architectural invariant).

### New API endpoints / RPC methods / events

None. The existing `GET /` route (STATE.md § Active Endpoints) changes its rendered body from the
Phase 01 placeholder to the full `pages/home` composition — this is not a new route.

### New types / models / shared interfaces

```ts
// src/features/upload-image/model/types.ts
// Validates + downscales a raw File into the existing SourceImage entity
// (entities/processed-image, Phase 02) — reuses that type rather than inventing a parallel one.

type UploadErrorCode =
  | "unsupported-format"          // SPEC.md §7.3: clear error, unsupported format
  | "exceeds-size-limit"          // SPEC.md §1.3: 20 MB hard limit
  | "exceeds-resolution-limit";   // SPEC.md §1.3: >4096px longest side (downscaled, not rejected)

interface UploadValidationError {
  code: UploadErrorCode;
  message: string;                // human-readable, states the exact limit (SPEC.md §7.3)
}

type UploadResult =
  | { ok: true; image: SourceImage }
  | { ok: false; error: UploadValidationError };

function validateAndPrepareUpload(file: File): Promise<UploadResult>;
```

```tsx
// src/entities/processed-image/ui/BeforeAfterSlider.tsx
interface BeforeAfterSliderProps {
  before: SourceImage;   // original upload (entities/processed-image, Phase 02)
  after: Blob;           // ProcessedImage.result — composited PNG-with-alpha (Phase 02)
  alt?: string;
}
```

### New env vars

None

---

## Gate Checks

> **Before running gate:** confirm all Scope checkboxes are checked (or explicitly deferred in
> Architect Review Notes). Unchecked items appear in the gate report as a warning, not a hard block.

Run `/phase-gate 04` before committing.

`/phase-gate` returns full PASS only when:
- Automated checks are green
- All architect review items below are resolved (checked off)

Use the commands in [docs/STACK.md](./STACK.md#gate-commands) as the source of truth for:
- infrastructure / bootstrap — Docker confirmed working in this environment as of 2026-07-10; this
  step should actually run, not be skipped
- migrations — `n/a`, no database in this project
- backend / unit tests — `n/a`, folded into frontend unit tests (single TS/React codebase)
- frontend prep, type-check, unit tests — this phase adds `upload-image`, `download-result`,
  `BeforeAfterSlider`, and `pages/home` tests
- e2e — mandatory: extend Phase 03's Playwright setup with the critical-path spec
  (upload → process → download) plus the cross-browser matrix (SPEC.md §7.4) — host-only, never
  in Docker or CI (AGENTS.md core rule 8)
- the default smoke check

If this phase needs a custom smoke target or other phase-specific note, record it here:

```bash
# Home page root carries data-testid="home-page" (same convention as Phase 02's
# remove-background-test-harness) so the gate can assert on real composed markup, not just a 200.
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/
# expected: 200
curl -s http://localhost:3000/ | grep -a -q 'data-testid="home-page"'
# expected: match found (exit 0) — see docs/KNOWN_GOTCHAS.md for the `-a` requirement
```

---

## Architect Review Notes

Use this section after manual product, UX, API, or workflow verification. This is the human-facing
channel for post-implementation fixes.

Add one unchecked checkbox per issue the agent must fix before the phase can close. Keep each item
independently fixable and describe observed behavior plus expected behavior. If the fix may change
SPEC/API/schema/security behavior, say so explicitly in the note.

The agent resolves these items through `/impl-assist 04 review`. Leave an item unchecked while it
is still open. Check it off only after the fix is implemented and re-verified. If manual
verification found nothing, keep the default checked line below.

- [x] No architect review issues recorded

---

## Implementation Notes

<!-- Optional. The agent adds a short bullet here only when something isn't already visible from
     the code or commit history: an intentional deviation from the plan, a residual risk, a
     rejected alternative. Leave empty when nothing needs recording — this is not a mandatory
     per-task log. -->

- `upload-image`'s `validateAndPrepareUpload` downscales any upload over 4096px instead of
  producing an `exceeds-resolution-limit` error; that error code stays in the `UploadErrorCode`
  union per the phase contract but is never actually constructed in practice.
- `useBackgroundRemoval.selectFile` (Phase 02, not modified this phase) only accepts a raw `File`.
  `pages/home` bridges this by re-wrapping `upload-image`'s validated `SourceImage.blob` into a
  `File` (`pages/home/lib/source-image-to-file.ts`) before calling `selectFile` — reuses the
  existing hook API unchanged rather than widening `remove-background`'s public contract (which
  the phase's "Do NOT touch" list forbids).
- The Playwright critical-path spec (`e2e/home.spec.ts`, real model download + WASM inference) ran
  far enough in this sandbox to confirm the model downloads and inference starts, but the
  sandbox's headless Chromium hit a genuine WASM `std::bad_alloc` on the full 1024×1024 BiRefNet
  input — a real device-memory constraint of this environment (matches SPEC.md §7.3's documented
  "device out-of-memory" case), not a Phase 04 defect. Combine with the worker's own
  error-path console dump of the full input tensor on failure (Phase 02, `inference.worker.ts`)
  being extremely slow to serialize, this test could not be driven to completion here. It needs a
  real run on the architect's host machine (`pnpm e2e`, chromium project at minimum) as the actual
  verification of the critical path; the fast idle/validation-error specs passed on all three
  configured projects (chromium, webkit, Mobile Safari) in this sandbox.

---

## Atomic Commit Message

```
feat(phase-04): home page ui — full upload-process-download flow
```

---

## Post-Phase Checklist

- [x] All Scope checkboxes checked (or deferred in Architect Review Notes)
- [x] All automated gate checks green (architect-approved PASS with a documented environment gap —
  see Implementation Notes and STATE.md's Phase 04 Project Log entry)
- [x] All architect review notes resolved
- [x] `docs/STATE.md` updated — run `/context-update 04`
- [x] Committed atomically on `feat/phase-04` branch
- [ ] Tag created after merge to develop: `git tag -a v0.04.0 -m "Phase 04: Home page UI"`
