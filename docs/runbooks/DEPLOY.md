# Production deployment

## Preconditions

- The GitHub `production` environment permits only `main`, requires the configured reviewer, and
  stores `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` and `VPS_APP_DIR`.
- The build job has produced an attested `ghcr.io/<owner>/<repo>@sha256:<digest>`. Mutable tags are
  not production inputs.
- Uptime Kuma has no unrelated active incident. Announce a bounded maintenance window only when a
  monitor would otherwise generate noise.
- `.ops/releases/current.env` is readable by the operator and `previous.env` exists after the first
  successful Phase-23 release.

## Automated path

Merge to `main`. The `CI` workflow:

1. builds OCI labels for build ID, full commit SHA and creation time;
2. pushes only the immutable SHA tag and captures the registry digest;
3. scans and verifies provenance/SBOM attestations;
4. enters the non-cancelling `production-deployment` concurrency group and protected environment;
5. copies the release contract and runs `scripts/release/deploy.sh`.

The controller validates Compose and OCI identity, starts the candidate with a random
`127.0.0.1`-only port, checks SSR locales/static manifest/CDN range and integrity, then removes the
candidate. It writes a non-secret Nginx identity include, switches the app by digest and runs the
external HTTPS/canonical/legal/security/release/CDN smoke. A failed external check exits nonzero
after attempting previous-digest rollback; the workflow must remain failed.

On the first Phase-23 run, the controller seeds `current.env` from the already running immutable
container reference and OCI labels before changing traffic. It refuses a first deployment when no
running known-good digest can be established; `RELEASE_ALLOW_FIRST_DEPLOY=1` is reserved for a new,
empty disposable host with no traffic.

Confirm:

```bash
docker compose ps app nginx
docker inspect --format '{{.Image}}' "$(docker compose ps -q app)"
curl -fsSI https://cutbg.art/ | sed -n '/^x-cutbg-/Ip'
find .ops/releases/history -maxdepth 1 -type f -print
```

Match all four release headers to the GitHub deployment and image digest. Never paste tokens or a
full environment dump into the record.

## Manual invocation

Use only an already attested digest and validated metadata:

```bash
export APP_IMAGE='ghcr.io/<owner>/<repo>@sha256:<digest>'
export APP_BUILD_ID='<build-id>'
export APP_COMMIT_SHA='<full-commit-sha>'
export DEPLOY_ACTOR='<operator-id>'
export DEPLOY_REF='refs/heads/main'
export DEPLOY_RUN_ID='manual-<ticket>'
./scripts/release/deploy.sh
```

The script rejects mutable images, malformed identity, lock contention and mismatched OCI labels.
Re-running the current digest repeats checks and records an idempotent result without switching
traffic.

## GitHub unavailable

Do not build or deploy an unverifiable new release. SSH to the VPS using the approved break-glass
path and run `./scripts/release/rollback.sh manual`; it uses the bounded, non-secret
`previous.env` digest already present on the host. Record the incident and acting operator after
GitHub returns. If neither GitHub nor the cached previous digest is available, keep traffic on the
last running container, declare SEV-1 and follow `INCIDENT.md`; do not substitute `latest`.
