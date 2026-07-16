# Known Gotchas

> Project memory file. Capture recurring pitfalls that repeatedly waste time during coding,
> testing, or deploys.

## How To Use

- Add only issues that are likely to happen again.
- Prefer concrete symptoms, root cause, and the shortest reliable fix.
- Remove entries that are no longer relevant.

## Gotcha Log

### A memoized blob URL can be revoked during React StrictMode's development remount

- **Symptoms**: an image backed by a `Blob` works initially, then shows only its alt text after
  entering the editor in development; production or a non-StrictMode test may appear unaffected.
- **Root cause**: render memoization keeps the same object URL while an effect cleanup revokes it.
  React StrictMode intentionally runs setup, cleanup, and setup again, so the second setup reuses an
  already-revoked URL.
- **Fix**: create the object URL in the same callback-ref/effect setup that owns it, assign it to the
  image there, and revoke that exact URL in the matching cleanup.
- **Prevention**: lifecycle tests for blob-backed previews must render under `StrictMode` and verify
  that the current image URL was not revoked; browser coverage should also assert `naturalWidth > 0`.

### A mocked ML result does not prove that the browser rendered the result

- **Symptoms**: guided-selection E2E is green because the mock worker returned an `AlphaMatte` and
  an “accept” button appeared, while a real user sees no point, box, or mask on the image.
- **Root cause**: tests asserted state transitions but never asserted the visible prompt and canvas
  overlay. The matte could remain in hook state without ever reaching the rendering component.
- **Fix**: guided E2E must assert the immediate point marker, live box during pointer drag, final
  box marker, painted mask canvas, and clearing those visuals on replacement. The serialized real
  smoke also asserts marker and mask rendering after the actual SlimSAM response.
- **Prevention**: for ML/canvas flows, pair worker-message assertions with a user-visible artifact;
  a status string or enabled action alone is not behavioral proof.

### Never build `model-sync` from the full application dependency stage

- **Symptoms**: the `main` deploy spends nearly ten minutes in `docker compose --profile maintenance run --rm --build model-sync`, then fails with `Run Command Timeout` while exporting the image even though dependency installation completed.
- **Root cause**: a `model-sync` stage based on the app's `deps` stage installs all 676 production and development packages on the 2 GiB VPS. That includes an unused 513 MiB `onnxruntime-node` tree whose GPU postinstall dominates the build; the synchronizer itself uses only built-in Node APIs.
- **Fix**: base `model-sync` directly on Node 24, run the `.ts` script with native type stripping, and download only the manifest-declared pinned ORT runtime variants. Keep the SSH action's normal 10-minute command timeout so a regression fails visibly.
- **Prevention**: the maintenance stage must not inherit from `deps`, run `pnpm install`, or copy `node_modules`; verify changes with a no-cache `model-sync` target build.

### TanStack Start's router.tsx must live at `src/router.tsx`, not nested under `src/app/`

- **Symptoms**: default client/server entry points silently fail to pick up router config (or build/dev breaks) when `router.tsx` is placed anywhere other than directly under `src/`.
- **Root cause**: TanStack Start's optional default entry points auto-discover the router by a fixed path convention, `src/router.tsx` — this is not configurable via `vite.config.ts`. This project's FSD layout (SPEC.md §6) illustrates `app/router.tsx` under the `app` layer, but that's aspirational/illustrative, not compatible with the framework's hard convention.
- **Fix**: keep `src/router.tsx` at the source root. Treat it as a framework-mandated exception to the FSD `app/` layer grouping — everything else FSD-related (`providers/`, `styles/`) still lives under `src/app/`.
- **Prevention**: when scaffolding future TanStack Start projects, check the framework's file-convention docs before assuming an illustrative directory tree is authoritative.

### pnpm's `minimumReleaseAge` supply-chain policy blocks Docker builds right after `pnpm add`

- **Symptoms**: `pnpm install --frozen-lockfile` fails inside a fresh container (or any environment without an existing pnpm store) with `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`, even though the exact same lockfile installs fine locally.
- **Root cause**: pnpm rejects lockfile entries for package versions published too recently (a supply-chain protection default). Packages added minutes-to-hours ago via `pnpm add` — completely normal right after active dependency work — trip this on the next clean install (e.g. in a Docker build stage, which always installs from scratch).
- **Fix**: `pnpm-workspace.yaml` sets `minimumReleaseAge: 0` for this project. The lockfile itself (installed via `--frozen-lockfile`, reviewed via PR) is the actual trust boundary; the extra freshness gate just adds Docker-build flakiness for a team that reviews dependency bumps anyway.
- **Prevention**: if `pnpm install --frozen-lockfile` fails in CI/Docker with this exact error and passes locally, it's this — not a corrupted lockfile. Don't chase it as a real dependency problem.

### Docker-owned files break host operations (`EACCES` / `EPERM` / read-only)

> Keep this entry only if the project uses Docker bind mounts. Otherwise delete it.

- **Symptoms**: file operations fail with `EACCES`, `EPERM`, "Permission denied", or "Read-only file system". Most common paths: container-generated build/cache directories on the host (`.nuxt/`, `.output/`, `node_modules/.cache/`, `__pycache__/`).
- **Root cause**: a Docker container wrote to a bind-mounted host directory as root.
- **Fix (host)**:
  ```bash
  sudo chown -R $USER:$USER <path>   # reclaim ownership, keep files
  sudo rm -rf <path>                 # OR discard the generated artefact
  ```
- **Agent protocol**: agents MUST NOT run `sudo`, `chmod -R 777`, or loop the failing operation. Instead, stop and post this exact handoff to the user (substituting real `<path>` and `<cmd>`):

  > ⛔ **Permission denied.** I cannot modify `<path>` while running `<cmd>`.
  >
  > This usually happens when a Docker container wrote files to a bind-mounted host directory as root. Please run one of the following on the host:
  >
  > ```bash
  > sudo chown -R $USER:$USER <path>
  > sudo rm -rf <path>
  > ```
  >
  > When the fix is applied, reply with the single word **`continue`** and I will retry the failed operation from the same step.

  On receiving `continue` (case-insensitive), retry the failed operation once. If it fails a second time with the same error, stop again and ask the user to confirm the fix was actually applied — do not loop a third time.

- **Prevention**: run Docker with a matching host UID/GID or use named volumes for cache directories that containers own.

### Plain `grep` silently finds nothing in a TanStack Start SSR response

- **Symptoms**: `curl <route> | grep -q '<some string known to be in the rendered HTML>'` fails (exit 1) even though the string is genuinely in the response body — reproduces on every route, not just one.
- **Root cause**: TanStack Start's client hydration payload (the inline `$_TSR`/route-match script near the end of `<body>`) embeds route-match IDs joined with literal NUL (`\x00`) bytes, e.g. `i:"__root__\x00"`. That makes `grep` treat the whole response as a binary file and skip it by default — unrelated to whatever string you were actually searching for.
- **Fix**: pass `-a` (treat as text) whenever grepping a full SSR page response: `curl ... | grep -a -q '...'`.
- **Prevention**: any phase's smoke-check `curl | grep` one-liner over full page HTML needs `-a`. Grepping an isolated fragment you already extracted (no NUL bytes) doesn't need it.

### Transformers.js can construct a pipeline with `processor: null` instead of throwing

- **Symptoms**: `pipeline("image-segmentation", ...)` resolves successfully and reports a `"ready"` progress event, but the first actual inference call throws `TypeError: this.processor is not a function` deep inside the pipeline's `_call`.
- **Root cause**: `pipeline()` only calls `AutoProcessor.from_pretrained()` if its own internal repo-file-existence check (`hasProcessor`, based on `expected_files`/`get_file_metadata`) reports that `preprocessor_config.json` exists. If that check's request fails for any reason, the pipeline silently builds with `processor: null` and reports success anyway. **Confirmed cause** (via real-browser testing, not just the sandbox): this project's own `public/sw.js` was crashing on exactly that check's request — see the "Cache Storage API rejects partial (206) responses" entry below. Fixing the Service Worker made this go away in practice, though the defensive check below is still worth keeping since `hasProcessor` can fail for other reasons too (offline, a genuinely missing config file, etc).
- **Fix**: don't trust a resolved `pipeline()` promise alone. Check `typeof segmenter.processor === "function"` immediately after it resolves and throw if not — see `src/features/remove-background/worker/inference.worker.ts`'s `loadSegmenter`. This reclassifies the failure as a model-load error (SPEC.md §7.3 retry action) instead of a confusing later "processing failed".
- **Prevention**: any new Transformers.js pipeline usage in this codebase should include the same post-resolve processor check. Also don't cache a pipeline-loading promise past its rejection — a rejected promise left in a `Map` cache makes `retry()` re-reject instantly instead of re-attempting; evict on `.catch()` before caching.

### Cache Storage API rejects partial (206) responses — breaks a naive cache-first Service Worker

- **Symptoms**: `public/sw.js`'s fetch handler throws `TypeError: Failed to execute 'put' on 'Cache': Partial response (status code 206) is unsupported`, for requests that otherwise succeed fine (`response.ok` is `true` for 206).
- **Root cause**: Transformers.js probes every file it's about to download with a `Range: bytes=0-0` request first, to read its size for progress tracking (`utils/hub.js`'s `fetch_file_head`) — a totally normal, small, non-caching-worthy request. That request matches this project's `isModelAsset()` URL patterns (contains `/resolve/`), so the Service Worker intercepts it like any other model-file request and tries to `cache.put()` the resulting 206 response. The Cache Storage API explicitly forbids storing partial responses, and throws synchronously.
- **Fix**: only call `cache.put()` when `response.status === 200`, not just `response.ok` (206 is in the 2xx range and `.ok` is `true` for it too). Skip caching (but still return the response normally) for anything else.
- **Prevention**: any cache-first Service Worker fetch handler in this project must check `status === 200` before `cache.put()`, not `.ok`. This combined with an uncaught `cache.put()` rejection is also what caused the `processor: null` gotcha above — a crashing Service Worker fetch handler surfaces to application code as an ordinary failed `fetch()`, several layers away from the real cause.
- **Related**: whatever fallback `Response` a `catch` block constructs here must use a plain-ASCII `statusText` — the Fetch spec restricts it to ISO-8859-1 reason-phrase bytes, so an em dash (`—`) throws `Failed to construct 'Response'` and turns a handled error path into a second, unhandled one.

### ONNX Runtime Web's WebGPU backend can fail on a specific model even when the adapter looks fine

- **Symptoms**: inference throws `failed to call OrtRun() ... Too many storage buffers in shader. Current: 17, Max is 16` (or similar `shader_helper.cc` messages), on a real GPU that has a working WebGPU adapter with `shader-f16` support.
- **Root cause**: some ONNX ops get fused into a compute shader that needs more storage-buffer bindings than this particular device's `maxStorageBuffersPerShaderStage` limit allows. This is a property of the specific model graph + specific device, not something `detectDeviceCapabilities()`'s adapter/fp16 check (or any cheap upfront probe) can predict — it only surfaces at actual inference time, same as the fp16-support gap above.
- **Fix**: `inference.worker.ts`'s `handleProcess` catches WebGPU-specific execution errors (`isWebGpuExecutionError` — matches `OrtRun`/`webgpu`/`shader_helper`/`storage buffers`) and retries the same request on the WASM path, posting a `fallback-to-wasm` message so the UI's lightweight-mode notice reflects it (SPEC.md §7.3's WebGPU-unavailable auto-fallback, applied at the point of actual failure instead of only at device-detection time).
- **Prevention**: don't assume "adapter exists + supports fp16" means a given model will run on WebGPU without issue. The segmenter cache is keyed on `(qualityMode, inferencePath)`, not just quality mode, specifically so this mid-session fallback can hold both a webgpu and a wasm pipeline for the same quality mode without clobbering each other.

### Reading `localStorage` in a hook's render body/`useState` initializer crashes TanStack Start's SSR

- **Symptoms**: `ReferenceError: window is not defined` thrown from `renderToReadableStream`, stack trace pointing at a `useState(() => ...)` initializer or a plain function called during render — reproduces on every SSR request, not just first load.
- **Root cause**: TanStack Start renders every route on the server first (no `window`/`localStorage`) before client hydration. Any hook that reads `localStorage` synchronously during render (e.g. to seed initial state) runs on the server too, where `window` doesn't exist.
- **Fix**: guard the read with `typeof window === "undefined"` and return a safe fallback (see `features/quality-mode-toggle`'s `readStoredQualityMode` in `model/use-quality-mode.ts`). Writes are fine as-is since they only ever run from client-side event handlers, never during render.
- **Prevention**: any new hook that persists to `localStorage`/`sessionStorage` and reads it back synchronously on mount needs this guard. Caught by manually curling the route after implementation — Vitest's jsdom environment always has `window`, so this class of bug doesn't show up in the unit test suite at all.

### Playwright can click through an SSR route before React hydrates, silently dropping the click

- **Symptoms**: `locator.click()` against an interactive element (e.g. the `Switch` in
  `features/quality-mode-toggle`) resolves without error, but the expected state change (e.g. a
  `localStorage` write) never happens — reproduces intermittently right after `page.goto()`,
  disappears if a `waitForTimeout` or extra assertion is inserted first.
- **Root cause**: TanStack Start SSRs the route shell before client hydration attaches event
  handlers. The SSR markup for a hydrated vs. not-yet-hydrated component is visually and
  structurally identical, so Playwright's actionability checks (attached, visible, stable, receives
  pointer events) all pass even though no React `onClick`/`onChange` handler is wired up yet — the
  click event fires into the DOM and does nothing.
- **Fix**: wait for a post-hydration signal already present on the page before interacting — e.g.
  `e2e/dev-remove-background.spec.ts` waits for the harness's device-detection line to leave its
  `"detecting…"` placeholder (set from an effect that only runs after mount) before clicking the
  quality toggle, and again after `page.reload()` before re-reading the toggle's checked state.
- **Prevention**: any new e2e spec that interacts with a client-rendered control on first paint
  needs an equivalent hydration guard — prefer waiting on an existing, observable post-mount signal
  over an arbitrary `waitForTimeout`.

### `page.mouse.move()` to a cached `boundingBox()` misses elements below the fold

- **Symptoms**: a Playwright test that reads `locator.boundingBox()` once and then drives a drag
  with raw `page.mouse.move()`/`.down()`/`.up()` coordinates ends up as a no-op — the target
  control's state never changes, with no thrown error (e.g. `e2e/home.spec.ts`'s color-palette drag
  landed on `left: 0%; top: 0%` instead of the dragged-to position after Phase 12's
  `widgets/tool-workspace` two-column desktop grid moved the control further down the page).
- **Root cause**: unlike `locator.click()`, raw `page.mouse.move(x, y)` uses viewport-relative
  coordinates and does **not** auto-scroll the target into view first. If the element sits below the
  fold when `boundingBox()` is read, the computed coordinates point past the visible viewport and the
  synthetic pointer events land on nothing.
- **Fix**: call `await locator.scrollIntoViewIfNeeded()` before reading `boundingBox()` whenever a
  test drives raw mouse coordinates instead of `locator.click()`/`locator.dragTo()`.
- **Prevention**: any layout change that can push an existing interactive control further down the
  page (a new hero section, a wider grid, added chrome) can silently break an existing raw-coordinate
  drag test — re-run affected specs after layout changes, not just after feature changes.

### Playwright/e2e is host-only by design — don't try it inside the dev container or CI

- **Symptoms**: `pnpm e2e` (or `npx playwright test`) fails with a missing-browser error
  (`Executable doesn't exist at .../chromium-.../headless_shell`) when run inside
  `docker-compose.dev.yml`'s `app` container, or the temptation to add an e2e job to
  `.github/workflows/ci.yml`.
- **Root cause**: the `dev` Docker stage only runs `pnpm install` (JS deps) — it never runs
  `playwright install`, which downloads browser binaries and (on Debian/Ubuntu bases) needs root
  for `--with-deps` system libraries. This is intentional, not a missing step to fix: e2e/Playwright
  is scoped as a **host-only** verification tool (AGENTS.md core rule 8) — a local,
  human-in-the-loop check run after implementing a phase (or to reproduce a reported bug), not a
  pipeline gate.
- **Fix**: run `pnpm e2e` directly on the host, against `pnpm dev` (Playwright's `webServer` config
  starts/reuses it automatically) — never inside the Docker dev container, never in CI.
- **Prevention**: don't add an e2e/Playwright step to any Dockerfile stage or CI workflow. If a
  future need genuinely requires e2e in CI, that's a deliberate scope change — raise it with the
  architect and update `docs/STATE.md`'s Project Log as a new decision rather than silently wiring
  it in.

### Do not run real model inference concurrently inside the normal Playwright matrix

- **Symptoms**: `pnpm e2e` takes 5–10 minutes, intermittently waits for a result slider until its
  timeout, or appears hung while several browser projects download/execute the ONNX model.
- **Root cause**: the normal cross-browser suite used to run multiple real model pipelines in
  parallel. That coupled UI determinism to CDN/network state and multiplied CPU/WASM/WebGPU memory
  pressure. `networkidle` waits made the startup path less predictable as well.
- **Fix**: keep user-flow tests on `e2e/support/mock-inference.ts` and run them with `pnpm e2e`.
  Run the external integration once and serially with `pnpm e2e:real-model`; the phase gate command
  `pnpm e2e:full` runs both tiers.
- **Prevention**: new UI E2E tests should install the mock inference Worker. Add behavior to the
  single real-model smoke only when it specifically validates the model/CDN boundary.

### Serialize pipeline loads when switching Transformers.js model sources

- **Symptoms**: with two model pipelines loading concurrently, some requests use the private CDN
  while later requests from the same pipeline unexpectedly use Hugging Face/jsDelivr; CDN fallback
  becomes intermittent or constructs a session from mixed sources.
- **Root cause**: Transformers.js exposes `remoteHost` and ONNX `wasmPaths` on one mutable global
  `env` object. A per-pipeline catch that changes those values can race another pipeline still
  resolving files.
- **Fix**: route pipeline creation through Phase 14's `createModelSourceLoader`, which serializes
  model loads and switches the worker globally from `cdn` to `upstream` at most once. Keep the
  explicit pinned `revision` on every `pipeline()` call.
- **Prevention**: do not mutate Transformers.js model/WASM host settings inside independent async
  loads. Any future multi-source logic must coordinate through the same loader.

### Gitignored generated assets still need an ESLint global ignore

- **Symptoms**: after `pnpm sync-model-assets`, `pnpm lint` reports dozens of missing-rule errors
  inside `deploy/model-assets/onnxruntime-web/*`, even though that directory is in `.gitignore`.
- **Root cause**: ESLint flat config does not inherit Git ignore patterns. `eslint .` discovers the
  upstream ORT JavaScript bundles unless its own global ignore list excludes the host asset mount.
- **Fix**: keep `deploy/model-assets` in the first, global `ignores` block of `eslint.config.js`.
- **Prevention**: any future generated/downloaded directory inside the repo must be excluded from
  both Git and the tools that recursively scan the working tree.

### Pre-optimize lazily imported dependencies in Vite development

- **Symptoms**: the first real upload reaches "Loading model", then the page unexpectedly reloads
  and returns to the idle upload state; or the first ZIP download never starts while the browser
  reports `504 (Outdated Optimize Dep)` and a failed dynamic import.
- **Root cause**: the inference worker imports `@huggingface/transformers` only after upload and ZIP
  assembly imports `client-zip` only after download. Vite's initial dependency scan can miss these
  user-action-only paths. Late discovery triggers optimization/reload or invalidates the module URL
  already requested by the page.
- **Fix**: keep both `@huggingface/transformers` and `client-zip` in `vite.config.ts`'s
  `optimizeDeps.include` so Vite prepares them before serving the first page.
- **Prevention**: any new large dependency imported only from a lazy worker/route should be checked
  for the same first-use optimization reload during local development.

### A Playwright drag can silently miss its target if intervening clicks reflow the page

- **Symptoms**: `page.mouse.move/down/up` at coordinates from an element's `boundingBox()` appears
  to do nothing — no error, but the expected effect (e.g. a canvas repaint) never happens. Adding a
  fresh `boundingBox()` call right before the drag doesn't fix it on its own.
- **Root cause**: an earlier `.click()` on a *different* element (e.g. a toolbar button) can change
  page content in a way that reflows layout — even content below the drag target — and Playwright
  auto-scrolls whatever it just clicked into view. If the drag target sits above the click target,
  it can end up scrolled out of the viewport (confirmed via a diagnostic dump: `boundingBox()`
  returned a negative `y`). A `boundingBox()` call still returns *a* rectangle at that point — it's
  just for an off-screen position — so `page.mouse` coordinates computed from it land outside the
  viewport and hit nothing.
- **Fix**: call `locator.scrollIntoViewIfNeeded()` immediately before computing `boundingBox()` for
  the drag, not just before the first drag of the test — see `e2e/mask-correction.spec.ts`'s
  `dragOnCanvasCenter` (Phase 07 Architect Review Notes R3 fix verification uncovered this: the
  brush-mode toolbar's description text changes length per mode, reflowing the page enough to push
  the canvas above the fold after a mode-button click).
- **Prevention**: any e2e spec that repeatedly drags/clicks on the same element interleaved with
  clicks elsewhere on the page should scroll that element into view fresh before every interaction,
  not just once at the start.

### Playwright's Vite server must not silently fall through to port 3001

- **Symptoms**: Playwright prints nothing for roughly the full webServer timeout while Vite has
  actually started on port 3001; this often follows an interrupted E2E run that briefly leaves
  port 3000 occupied.
- **Root cause**: Vite normally auto-increments an occupied port, but Playwright continues polling
  the configured `http://localhost:3000` URL. In this WSL environment, probing an unused localhost
  port can also wait for the OS TCP timeout instead of immediately refusing the connection, so
  Playwright's `reuseExistingServer` preflight itself looked like a hang.
- **Fix**: `scripts/run-e2e.ts` starts Vite with `--port 3000 --strictPort`, waits for the live
  endpoint, then starts Playwright without its `webServer` preflight. It owns teardown on success,
  failure, and interruption. A genuine port conflict now fails immediately.
- **Prevention**: invoke Playwright through the package scripts and keep server lifecycle in the
  runner; after manually killing processes outside it, confirm port 3000 is free before retrying.

### Never pass large typed arrays through changing React props — dev-mode React 19.2 freezes for seconds

- **Symptoms**: under `pnpm dev` (development react-dom only), any state commit whose re-render
  hands a component a *new* prop object containing a big `Uint8ClampedArray`/typed array freezes
  the main thread for seconds — in Phase 07's mask editor, ~1-2s on every brush-stroke pointer-up
  and every Undo/Redo click, on a mere 1MP image. A CPU profile shows the time inside react-dom's
  `addObjectToProperties`/`addValueToProperties`/`debugTask.run` plus GC, while the app's own
  handlers measure milliseconds. Production builds are unaffected, which makes it easy to
  misattribute to app code (that happened here: the R3-addendum diagnosis in `docs/PHASE_07.md`
  blamed and "fixed" a redundant repaint; the freeze survived).
- **Root cause**: React 19.2's dev-only Component Performance Track (`logComponentRender` in
  `react-dom-client.development.js`) deep-diffs every changed prop object against its previous
  value on every render to annotate the DevTools timeline. A typed array is neither
  `[object Object]` nor `[object Array]`, so it falls into the generic serializer, which `for..in`s
  *every element as an own enumerable key* — twice (removed + added sides of the diff) — building
  millions of diff entries per commit. Fixed upstream in react-dom 19.3 canary (`ArrayBuffer.isView`
  guard + `OBJECT_WIDTH_LIMIT`), not in stable 19.2.x.
- **Fix**: keep multi-megabyte buffers out of React props/state identity churn entirely. The mask
  editor commits O(stroke area) `MaskPatch` deltas and routes undo/redo through an imperative
  `MaskCanvasHandle` ref (`features/correct-mask`); its canvas props stay identity-stable during
  editing. (Hook *state* is safe from this specific trap — only `memoizedProps` are diffed — but
  props of any re-rendering component are not.)
- **Prevention**: treat "a fresh multi-MB object flows through a prop on a hot path" as a design
  smell even where production is fine — dev-mode responsiveness is part of the product for whoever
  develops it. When react-dom 19.3 stable ships, upgrading also removes the underlying footgun.

### Never dispatch external work inside a React functional state updater

- **Symptoms**: work visibly remains `queued` and then jumps directly to `result`, while the Worker
  was actually busy in the background; counters and per-item stages disagree with real execution.
- **Root cause**: React Strict Mode may invoke a functional state updater more than once to verify
  purity. Phase 10's scheduler mutated an external active-job ref and posted to a Worker inside the
  updater. The first call dispatched work; the repeated call observed the mutated ref and returned
  the old queued state, which React committed.
- **Fix**: keep FIFO/active bookkeeping in feature-local refs, select the jobs and post Worker
  messages outside `setState`, then use a pure updater only to reflect those selected IDs in React
  state. Verify scheduler tests under `StrictMode`.
- **Prevention**: functional state updaters must only calculate and return state. Never perform
  Worker messages, network calls, ref mutation, timers, analytics, or other externally observable
  work inside them.

### A hook value derived from a ref read during render silently freezes in `renderHook` tests

- **Symptoms**: a Vitest `renderHook` test's `result.current` gets stuck on an older value (e.g. a
  derived `dirty`/`stale` boolean) after an `await act(...)` that resolves an async update, even
  though extra `act()` flushes, `waitFor` polling for a full second, and manual render-count
  logging all confirm the hook's render function *did* re-run with the correct value. A parallel
  test that renders the real component with `render()` instead of `renderHook()` shows no such lag.
- **Root cause**: `@testing-library/react`'s `renderHook` snapshots the hook's return value into
  `result.current` from a wrapper `useEffect` with no dependency array, not synchronously during
  render. Deriving a value in the hook body by reading a `ref.current` (e.g.
  `const dirty = !sameFill(fill, someRef.current)`) is itself invalid — `react-hooks/refs`
  (`eslint-plugin-react-hooks` v7) flags reading a ref during render — and in practice that
  wrapper effect can fail to re-fire for the render that follows an async `setState` sequence whose
  net value matches an earlier render (observed: `saving` went `true -> false`, landing back on a
  `false` already held by `result.current`), leaving the derived ref-based value permanently stale
  in the test even though the app's real component tree is unaffected.
  See `feat/phase-11`'s `use-background-fill.ts` history for a live repro/fix.
- **Fix**: never read a ref during render to compute a returned/derived value — track it as real
  `useState` (updated via its setter at the same points the ref would have been mutated) so it
  participates in React's normal update/commit cycle instead of this snapshot indirection.
- **Prevention**: treat any `eslint` `react-hooks/refs` error as a real bug, not a false positive,
  even if a quick manual/browser check seems to work — `renderHook`-based unit tests are exactly
  where the invalid pattern's fallout shows up first.

<!--
### [Title — short, punchy, searchable]

- **Symptoms**: [what fails, what error message]
- **Root cause**: [why it happens]
- **Fix**: [shortest reliable fix]
- **Prevention**: [optional — how to avoid hitting it again]
- **Links**: [optional — docs / issue / PR]
-->
# Certbot webroot bootstrap cannot delete nginx's dummy certificate before issuance

- **Symptoms**: the first production deploy reaches Certbot, but Let's Encrypt reports
  `connection refused` for the HTTP-01 challenge; nginx is restart-looping because
  `/etc/letsencrypt/live/<domain>/fullchain.pem` no longer exists.
- **Root cause**: a dummy-certificate bootstrap that starts nginx and then deletes the dummy files
  assumes nginx will remain alive until issuance finishes. With `restart: unless-stopped`, nginx
  can restart after deletion, fail its unconditional TLS certificate load, and stop serving port 80
  before Let's Encrypt requests the challenge.
- **Fix**: on a new host, keep nginx stopped and run Certbot in `standalone` mode with port 80
  published; start nginx only after the real certificate exists. Use webroot only for subsequent
  renewals while nginx is already running.
- **Prevention**: first-certificate bootstrap and renewal are distinct states. Do not remove a file
  referenced by the live nginx configuration as an intermediate bootstrap step.

### Transformers.js 4.2 pipeline registry probes can ignore the requested revision

- **Symptoms**: `pipeline(..., { revision: "<sha>" })` still requests
  `/resolve/main/config.json` during startup; a pinned-only private CDN returns 404 and the loader
  incorrectly switches to upstream before requesting the actual pinned weights.
- **Root cause**: Transformers.js 4.2's pipeline registry determines expected files before loading
  and does not forward `revision` through all of its metadata helpers.
- **Fix**: keep the explicit pipeline `revision`, and set `env.remotePathTemplate` to the pinned SHA
  for both the CDN and upstream source in this worker.
- **Prevention**: real-model tests must assert that every observed ISNet `/resolve/` URL contains the
  manifest revision, not merely that at least one pinned URL was requested.

### nginx:alpine serves `.mjs` as octet-stream unless configured explicitly

- **Symptoms**: the CDN returns 200 with valid CORS for an ONNX Runtime `.mjs` loader, but the
  browser reports `Failed to fetch dynamically imported module` and falls back upstream.
- **Root cause**: the stock Nginx 1.27 Alpine MIME table used here does not map `.mjs`; with
  `X-Content-Type-Options: nosniff`, browsers correctly reject `application/octet-stream` as an ES
  module. Cloudflare can retain the old MIME header until the exact URL is purged.
- **Fix**: declare `application/javascript js mjs`, `application/wasm wasm`, and
  `application/json json` in the model location, reload Nginx, then purge any already-cached `.mjs`
  URL.
- **Prevention**: CDN verification must include the ORT module's browser-observed `Content-Type`,
  not only status/CORS/cache/range checks for model files.
