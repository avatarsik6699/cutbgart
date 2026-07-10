# Known Gotchas

> Project memory file. Capture recurring pitfalls that repeatedly waste time during coding,
> testing, or deploys.

## How To Use

- Add only issues that are likely to happen again.
- Prefer concrete symptoms, root cause, and the shortest reliable fix.
- Remove entries that are no longer relevant.

## Gotcha Log

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

<!--
### [Title — short, punchy, searchable]

- **Symptoms**: [what fails, what error message]
- **Root cause**: [why it happens]
- **Fix**: [shortest reliable fix]
- **Prevention**: [optional — how to avoid hitting it again]
- **Links**: [optional — docs / issue / PR]
-->
