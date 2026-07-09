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

<!--
### [Title — short, punchy, searchable]

- **Symptoms**: [what fails, what error message]
- **Root cause**: [why it happens]
- **Fix**: [shortest reliable fix]
- **Prevention**: [optional — how to avoid hitting it again]
- **Links**: [optional — docs / issue / PR]
-->
