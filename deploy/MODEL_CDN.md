# VPS model CDN deployment

Phase 14 serves pinned, public model and ONNX Runtime Web assets from the VPS through Cloudflare.
The manifest now includes IS-Net q8/fp32, BEN2 fp16, and SlimSAM q8. BEN2 and SlimSAM remain lazy:
their immutable files are requested only after the corresponding user selection.
No R2 account, payment method, or object-storage credential is involved.

## 1. Cloudflare DNS and TLS

1. In the `cutbg.art` zone, create an `A` record named `cdn` pointing to the same VPS IPv4 address
   as the app and enable the orange-cloud proxy.
2. Keep SSL/TLS mode at **Full (strict)**.
3. Expand the existing origin certificate once so the Let's Encrypt certificate includes
   `cdn.cutbg.art`:

   ```bash
   ./deploy/init-letsencrypt.sh
   ```

   The script uses Certbot `--expand`, reloads Nginx, and keeps the current certificate active
   throughout the challenge.

## 2. Synchronize the pinned assets

From the checked-out project directory on the VPS:

```bash
docker compose --profile maintenance run --rm --build model-sync
docker compose up -d nginx
```

The command downloads only files in `models.manifest.json`, including the pinned ONNX Runtime Web
variants from its documented jsDelivr release path, into `deploy/model-assets/`. The maintenance
image runs the TypeScript synchronizer directly on Node 24 and installs no application dependencies.
Re-running it skips existing files; pass `--force` after the command separator only when deliberately
replacing assets:

```bash
docker compose --profile maintenance run --rm --build model-sync --output=/model-assets --force
```

The app container does not contain the model. Nginx mounts the host directory read-only.

## 3. Cloudflare Cache Rule

Create one Cache Rule in **Caching → Cache Rules**:

- Name: `cutbg immutable model assets`
- Expression: `(http.host eq "cdn.cutbg.art" and starts_with(http.request.uri.path, "/models/"))`
- Cache eligibility: **Eligible for cache**
- Edge TTL: **Respect origin**
- Browser TTL: **Respect origin**

The explicit eligibility is required because `.onnx` is not one of Cloudflare's default static
extensions. Nginx supplies `public, max-age=31536000, immutable`; paths contain the pinned model
revision or ONNX Runtime version, so they can be cached for a year safely.

Do not add a rule that ignores the cache key's query string globally or caches non-`/models/`
traffic. When a pinned asset is intentionally replaced in place, purge its exact URL; normal model
updates must use a new revision and need no purge.

## 4. Production build variables

Set these repository settings before the next `main` build:

- Actions variable `VITE_MODEL_CDN_BASE_URL=https://cdn.cutbg.art/models`
- Actions secret `VITE_CF_BEACON_TOKEN=<Cloudflare Web Analytics site token>`

Both values are compiled into public browser code and are not authorization credentials. The
workflow still treats the analytics token as a secret to avoid accidental log exposure.

## 5. Verify

```bash
REVISION=3fe6e3db3e32c69aadde61fe388ddb1a0574440c
BASE="https://cdn.cutbg.art/models/onnx-community/ISNet-ONNX/resolve/$REVISION"

curl -fsSI "$BASE/config.json"
curl -fsS -D - -o /dev/null -H 'Range: bytes=0-0' "$BASE/onnx/model_quantized.onnx"
curl -fsSI \
  "https://cdn.cutbg.art/models/onnxruntime-web/1.27.0/ort-wasm-simd-threaded.asyncify.mjs"
```

Expect `200` for the first request; `206` and `Content-Range: bytes 0-0/...` for the second; and
`application/javascript` for the ORT module. All responses must include
`Access-Control-Allow-Origin: *` and the immutable `Cache-Control` header; model responses also
include `Accept-Ranges: bytes`. After two full requests from the same Cloudflare location,
`CF-Cache-Status` should become `HIT`. If `.mjs` was cached before its MIME mapping was deployed,
purge that exact URL before retrying the browser smoke.

Run `pnpm e2e:real-model` against a production build configured with the CDN. The smoke reports
whether model requests used `cdn.cutbg.art` or the automatic upstream fallback. To verify fallback,
build once with a deliberately unreachable `VITE_MODEL_CDN_BASE_URL`, then run the same serialized
smoke and confirm successful inference plus Hugging Face requests.

For Phase 16, also run `pnpm e2e:phase-16-real` on the representative weak and powerful devices
and record non-image-derived observations in `docs/PHASE_16_DEVICE_MATRIX.md`. The command is
host-only and must not be added to Docker or CI.
