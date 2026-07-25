# Release rollback

Rollback when external smoke fails, release identity does not match, 5xx rises after deployment, or
a heavy model/release is faulty. The deploy controller performs the same procedure automatically
for post-deploy smoke failure.

```bash
cd <app-dir>
./scripts/release/rollback.sh manual
```

The script acquires the production lock, loads only validated non-secret identity from
`.ops/releases/previous.env`, pulls that digest, restores the matching Nginx release headers,
recreates app/proxy as required, and runs the full external smoke. It is idempotent when the
previous digest is already current. A failed rollback is SEV-1 and is never masked as success.

Verify:

```bash
docker inspect --format '{{.Image}}' "$(docker compose ps -q app)"
curl -fsSI https://cutbg.art/ | sed -n '/^x-cutbg-/Ip'
find .ops/releases/history -maxdepth 1 -type f -name '*rollback*.json' -print
```

For a model release changed in the same failed deployment, automatic rollback also swaps the
verified `model-assets.previous` directory. For an operator-directed model-only emergency:

```bash
docker compose --profile maintenance run --rm --build model-sync --rollback
docker compose up -d --force-recreate nginx
node scripts/operations/exercise-capacity.mjs
```

Do not edit model bytes, manifests or release headers manually. Preserve the failed release record,
open an incident, remove maintenance suppression, and communicate the resolved state only after
the previous digest and CDN integrity checks pass.
