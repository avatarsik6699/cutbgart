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

<!--
### [Title — short, punchy, searchable]

- **Symptoms**: [what fails, what error message]
- **Root cause**: [why it happens]
- **Fix**: [shortest reliable fix]
- **Prevention**: [optional — how to avoid hitting it again]
- **Links**: [optional — docs / issue / PR]
-->
