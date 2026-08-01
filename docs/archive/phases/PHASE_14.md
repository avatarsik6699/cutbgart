# PHASE 14 — VPS Model CDN

<!-- TOKEN BUDGET: keep this file under 10,000 tokens. Be concise. -->

## Phase Metadata

| Field | Value |
|-------|-------|
| Phase | `14` |
| Title | VPS Model CDN |
| Status | `✅ done` |
| Tag | `v0.14.0` |
| Depends on | PHASE_13 gate passing |

---

## Phase Goal

Own the production model delivery path without requiring R2 or a payment card. Pinned ISNet and
ONNX Runtime assets are served from the VPS through Cloudflare Cache, while the proven Hugging Face
Hub/upstream runtime path remains an automatic browser fallback (SPEC.md §4, §6, §6.1, §8).

---

## Scope

### Frontend
- [x] `F1` Pin the ISNet revision in runtime model configuration and use the configured `VITE_MODEL_CDN_BASE_URL` as the preferred model/WASM source — _Depends on:_ `I1`
- [x] `F2` Retry a failed private-CDN model load against Hugging Face Hub and the upstream ONNX Runtime WASM source without poisoning the worker pipeline cache — _Depends on:_ `F1`
- [x] `F3` Add focused automated coverage for pinned source selection/fallback and extend the serialized real-model smoke to identify primary versus fallback requests — _Depends on:_ `F2`

### Infra
- [x] `I1` Replace the stale BiRefNet manifest/R2 uploader with a pinned ISNet `q8`/`fp32` + ONNX Runtime asset synchronizer for a VPS host directory — _Depends on:_ —
- [x] `I2` Serve `cdn.cutbg.art/models/*` from the read-only VPS asset mount through Nginx with TLS, CORS, byte ranges, immutable cache headers, and safe missing-file behavior — _Depends on:_ `I1`
- [x] `I3` Document the proxied Cloudflare DNS record, Cache Rule, asset sync/deploy sequence, purge behavior, and header/range verification commands — _Depends on:_ `I2`
- [x] `I4` Wire production deploy/build variables for the model CDN and Cloudflare Web Analytics token without hardcoding secrets, and remove the obsolete R2 workflow — _Depends on:_ `I1`, `I2`
- [x] `I5` Verify the repository configuration, production build, CDN header contract, preferred CDN loading when externally available, and upstream fallback — _Depends on:_ `F3`, `I3`, `I4`

<!-- Test execution is governed by `## Gate Checks` below + docs/STACK.md § Gate Commands. -->

---

## Files

### Create / modify
~~~
models.manifest.json
scripts/sync-model-assets.ts
scripts/sync-model-assets.test.ts
package.json
pnpm-lock.yaml
eslint.config.js
.gitignore
.dockerignore
deploy/nginx/app.conf
deploy/init-letsencrypt.sh
deploy/MODEL_CDN.md
docker-compose.yml
Dockerfile
.github/workflows/ci.yml
.github/workflows/upload-model-weights.yml (remove)
src/shared/config/env.ts
src/features/remove-background/model/model-info.ts
src/features/remove-background/model/model-info.test.ts
src/features/remove-background/model/model-source.ts
src/features/remove-background/model/model-source.test.ts
src/features/remove-background/worker/inference.worker.ts
public/sw.js
e2e/real-model.spec.ts
docs/STACK.md
docs/STATE.md
docs/PHASE_14.md
~~~

### Do NOT touch
- Product UI, translations, routes, and image-processing behavior
- User images or any server endpoint (the client-only inference invariant remains unchanged)
- Cloudflare/R2 credentials or other secrets
- `sample/`

---

## Contracts

### New persistent data (tables / collections / files)

VPS host directory `deploy/model-assets/` (gitignored) contains only manifest-declared public model
and ONNX Runtime distribution files. It is mounted read-only at `/srv/model-assets` in Nginx; user
images and inference results are never stored there.

### New API endpoints / RPC methods / events

| Method | Path / Topic | Auth | Response / Payload |
|--------|--------------|------|---------------------|
| `GET`, `HEAD` | `https://cdn.cutbg.art/models/{manifest-path}` | none | Static public model/config/WASM asset; supports byte ranges and cross-origin reads |

### New types / models / shared interfaces

`ModelSource` identifies `cdn` versus `upstream` for deterministic loader tests and diagnostic
worker logs. No public UI or persistent application model changes.

### New env vars

None. Phase 14 activates the existing `VITE_MODEL_CDN_BASE_URL` and
`VITE_CF_BEACON_TOKEN` production build variables; both remain non-secret public build values.

---

## Gate Checks

Run `/phase-gate 14` before committing. Use `docs/STACK.md` Gate Commands plus:

```bash
curl -fsSI https://cdn.cutbg.art/models/onnx-community/ISNet-ONNX/resolve/3fe6e3db3e32c69aadde61fe388ddb1a0574440c/config.json
# expected after external DNS/deploy: 200, Access-Control-Allow-Origin: *,
# Cache-Control: public, max-age=31536000, immutable, Accept-Ranges: bytes

curl -fsS -D - -o /dev/null -H 'Range: bytes=0-0' \
  https://cdn.cutbg.art/models/onnx-community/ISNet-ONNX/resolve/3fe6e3db3e32c69aadde61fe388ddb1a0574440c/onnx/model_quantized.onnx
# expected after external DNS/deploy: 206 with Content-Range
```

External DNS/Cloudflare changes are manual deployment preconditions. If unavailable during local
implementation, verify Nginx syntax/container mounts and record the external checks as pending
rather than fabricating a pass.

---

## Architect Review Notes

- [x] No architect review issues recorded

---

## Implementation Notes

- The 2 GiB VPS could not complete the synchronizer image's dependency install without starving
  SSH, so the manifest-validated local asset directory was transferred with `rsync`. The first
  `main` deploy then hit the SSH action's 10-minute timeout because `model-sync` inherited the full
  676-package app dependency install, including a 513 MiB `onnxruntime-node` tree it never uses.
  The maintenance image now runs the built-in-only synchronizer directly on Node 24 and downloads
  only manifest-declared ORT runtime variants, so no timeout increase or package install is needed.
- Rollout verification exposed two integration details not visible in local Nginx tests:
  Transformers.js 4.2 registry probes omit the requested revision, so the worker pins its remote
  path template for both CDN and fallback; nginx:alpine needs an explicit `.mjs` MIME mapping for
  the cross-origin ONNX Runtime module loader.

---

## Atomic Commit Message

```
feat(phase-14): serve pinned models through VPS Cloudflare CDN
```

---

## Post-Phase Checklist

- [x] All Scope checkboxes checked (or deferred in Architect Review Notes)
- [x] All automated gate checks green
- [x] All architect review notes resolved
- [x] `docs/STATE.md` updated — run `/context-update 14`
- [x] Committed atomically on `feat/phase-14` branch
- [x] Tag created after merge to `main`: `git tag -a v0.14.0 -m "Phase 14: VPS Model CDN"`
