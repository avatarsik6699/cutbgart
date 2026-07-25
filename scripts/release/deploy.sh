#!/bin/sh
set -eu

RELEASE_ROOT=${RELEASE_ROOT:-$(pwd)}
RELEASE_STATE_DIR=${RELEASE_STATE_DIR:-$RELEASE_ROOT/.ops/releases}
RELEASE_CONFIG_FILE=${RELEASE_CONFIG_FILE:-$RELEASE_ROOT/deploy/nginx/release.conf}
SMOKE_BASE_URL=${SMOKE_BASE_URL:-https://cutbg.art}
SMOKE_CDN_BASE_URL=${SMOKE_CDN_BASE_URL:-https://cdn.cutbg.art/models}
SMOKE_HTTP_URL=${SMOKE_HTTP_URL-http://cutbg.art/}
SMOKE_CANONICAL_URL=${SMOKE_CANONICAL_URL-https://www.cutbg.art/}
RELEASE_MANAGE_NGINX=${RELEASE_MANAGE_NGINX:-1}
RELEASE_SYNC_MODELS=${RELEASE_SYNC_MODELS:-1}
RELEASE_ALLOW_FIRST_DEPLOY=${RELEASE_ALLOW_FIRST_DEPLOY:-0}
RELEASE_SKIP_PULL=${RELEASE_SKIP_PULL:-0}

. "$RELEASE_ROOT/scripts/release/common.sh"

for release_name in APP_IMAGE APP_BUILD_ID APP_COMMIT_SHA; do
  release_require "$release_name"
done
release_validate_request
release_candidate_image=$APP_IMAGE
release_candidate_digest=$APP_IMAGE_DIGEST
release_candidate_build=$APP_BUILD_ID
release_candidate_commit=$APP_COMMIT_SHA

for release_audit_value in "${DEPLOY_ACTOR:-manual}" "${DEPLOY_REF:-manual}" "${DEPLOY_RUN_ID:-manual}"; do
  case "$release_audit_value" in
    ""|*[!A-Za-z0-9._/@:-]*) release_die "invalid-audit-field" ;;
  esac
done

mkdir -p "$RELEASE_STATE_DIR/history" "$(dirname "$RELEASE_CONFIG_FILE")"
chmod 700 "$RELEASE_STATE_DIR" "$RELEASE_STATE_DIR/history"

release_lock="$RELEASE_STATE_DIR/deploy.lock"
if ! mkdir "$release_lock" 2>/dev/null; then
  release_die "deployment-lock-held"
fi
release_candidate=""
release_cleanup() {
  if [ -n "$release_candidate" ]; then
    docker rm -f "$release_candidate" >/dev/null 2>&1 || true
  fi
  rmdir "$release_lock" >/dev/null 2>&1 || true
}
trap release_cleanup EXIT HUP INT TERM

export APP_IMAGE APP_IMAGE_DIGEST APP_BUILD_ID APP_COMMIT_SHA
docker compose config --quiet
printf '%s\n' "[release] check=config result=pass"
[ "$RELEASE_SKIP_PULL" = "1" ] || docker compose pull app

release_label_version=$(docker image inspect --format '{{ index .Config.Labels "org.opencontainers.image.version" }}' "$APP_IMAGE")
release_label_revision=$(docker image inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$APP_IMAGE")
release_label_created=$(docker image inspect --format '{{ index .Config.Labels "org.opencontainers.image.created" }}' "$APP_IMAGE")
[ "$release_label_version" = "$APP_BUILD_ID" ] || release_die "oci-build-id-mismatch"
[ "$release_label_revision" = "$APP_COMMIT_SHA" ] || release_die "oci-commit-mismatch"
APP_CREATED_AT=$release_label_created
release_validate_identity
release_candidate_created=$APP_CREATED_AT
export APP_CREATED_AT
printf '%s\n' "[release] check=oci-identity result=pass"

if [ ! -f "$RELEASE_STATE_DIR/current.env" ]; then
  release_existing_container=$(docker compose ps -q app 2>/dev/null || true)
  if [ -n "$release_existing_container" ]; then
    APP_IMAGE=$(docker inspect --format '{{.Config.Image}}' "$release_existing_container")
    APP_IMAGE_DIGEST=${APP_IMAGE##*@}
    APP_BUILD_ID=$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.version" }}' "$release_existing_container")
    APP_COMMIT_SHA=$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$release_existing_container")
    APP_CREATED_AT=$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.created" }}' "$release_existing_container")
    release_validate_identity
    release_existing_config_sha=$(
      sha256sum docker-compose.yml deploy/nginx/app.conf public/models.manifest.json |
        sha256sum |
        awk '{print $1}'
    )
    release_write_env "$RELEASE_STATE_DIR/current.env" "$release_existing_config_sha"
    printf '%s\n' "[release] check=known-good result=seeded"
    APP_IMAGE=$release_candidate_image
    APP_IMAGE_DIGEST=$release_candidate_digest
    APP_BUILD_ID=$release_candidate_build
    APP_COMMIT_SHA=$release_candidate_commit
    APP_CREATED_AT=$release_candidate_created
    export APP_IMAGE APP_IMAGE_DIGEST APP_BUILD_ID APP_COMMIT_SHA APP_CREATED_AT
  elif [ "$RELEASE_ALLOW_FIRST_DEPLOY" != "1" ]; then
    release_die "previous-known-good-unavailable"
  fi
fi

if [ -f "$RELEASE_STATE_DIR/current.env" ]; then
  (
    . "$RELEASE_STATE_DIR/current.env"
    release_write_nginx_identity "$RELEASE_CONFIG_FILE"
  )
fi

release_candidate_suffix=$(printf '%s' "${DEPLOY_RUN_ID:-$$}" | tr -cd 'A-Za-z0-9_.-')
release_candidate="cutbg-candidate-${release_candidate_suffix:-$$}"
docker run -d --rm \
  --name "$release_candidate" \
  --publish 127.0.0.1::3000 \
  --read-only \
  --tmpfs /tmp:size=64m,mode=1777 \
  --cap-drop ALL \
  --security-opt no-new-privileges:true \
  --pids-limit 200 \
  --memory 512m \
  --cpus 1 \
  -e APP_BUILD_ID="$APP_BUILD_ID" \
  -e APP_COMMIT_SHA="$APP_COMMIT_SHA" \
  -e APP_CREATED_AT="$APP_CREATED_AT" \
  -e APP_IMAGE_DIGEST="$APP_IMAGE_DIGEST" \
  "$APP_IMAGE" >/dev/null
release_candidate_port=$(docker port "$release_candidate" 3000/tcp)
case "$release_candidate_port" in
  127.0.0.1:*) ;;
  *) release_die "candidate-not-loopback-only" ;;
esac
docker exec \
  -e SMOKE_BASE_URL=http://127.0.0.1:3000 \
  -e SMOKE_CDN_BASE_URL="$SMOKE_CDN_BASE_URL" \
  "$release_candidate" node /app/release/smoke.mjs candidate
docker rm -f "$release_candidate" >/dev/null
release_candidate=""
printf '%s\n' "[release] check=candidate result=pass"

release_models_changed=0
if [ "$RELEASE_SYNC_MODELS" = "1" ]; then
  release_model_marker=deploy/model-assets/.model-assets-manifest.json
  release_model_before=missing
  [ ! -f "$release_model_marker" ] ||
    release_model_before=$(sha256sum "$release_model_marker" | awk '{print $1}')
  docker compose --profile maintenance run --rm --build model-sync
  release_model_after=missing
  [ ! -f "$release_model_marker" ] ||
    release_model_after=$(sha256sum "$release_model_marker" | awk '{print $1}')
  [ "$release_model_before" = "$release_model_after" ] || release_models_changed=1
fi

RELEASE_CONFIG_SHA256=$(
  sha256sum docker-compose.yml deploy/nginx/app.conf public/models.manifest.json |
    sha256sum |
    awk '{print $1}'
)
export RELEASE_CONFIG_SHA256

release_snapshot="$RELEASE_STATE_DIR/configs/$APP_BUILD_ID"
mkdir -p "$release_snapshot"
chmod 700 "$release_snapshot"
cp docker-compose.yml deploy/nginx/app.conf public/models.manifest.json "$release_snapshot/"
chmod 600 "$release_snapshot"/*
ls -1dt "$RELEASE_STATE_DIR"/configs/* 2>/dev/null |
  awk 'NR > 3' |
  while IFS= read -r release_old_config; do
    rm -rf -- "$release_old_config"
  done

if [ -f "$RELEASE_STATE_DIR/current.env" ]; then
  release_current_digest=$(
    # This file is generated exclusively by release_write_env with validated,
    # non-secret values. Source it in a subshell so candidate identity remains
    # untouched.
    . "$RELEASE_STATE_DIR/current.env"
    printf '%s' "$APP_IMAGE_DIGEST"
  )
  if [ "$release_current_digest" = "$release_candidate_digest" ]; then
    release_external_smoke
    release_record pass not-needed idempotent
    printf '%s\n' "[release] result=pass action=already-current"
    exit 0
  fi
  cp "$RELEASE_STATE_DIR/current.env" "$RELEASE_STATE_DIR/previous.env"
  chmod 600 "$RELEASE_STATE_DIR/previous.env"
fi

APP_IMAGE=$release_candidate_image
APP_IMAGE_DIGEST=$release_candidate_digest
APP_BUILD_ID=$release_candidate_build
APP_COMMIT_SHA=$release_candidate_commit
APP_CREATED_AT=$release_candidate_created
export APP_IMAGE APP_IMAGE_DIGEST APP_BUILD_ID APP_COMMIT_SHA APP_CREATED_AT

release_write_nginx_identity "$RELEASE_CONFIG_FILE"
docker compose up -d app
if [ "$RELEASE_MANAGE_NGINX" = "1" ]; then
  docker compose up -d --force-recreate nginx
fi

if ! release_external_smoke; then
  release_rollback_result=unavailable
  if [ -f "$RELEASE_STATE_DIR/previous.env" ]; then
    if RELEASE_LOCK_HELD=1 \
      ROLLBACK_MODELS="$release_models_changed" \
      RELEASE_ROOT="$RELEASE_ROOT" \
      RELEASE_STATE_DIR="$RELEASE_STATE_DIR" \
      RELEASE_CONFIG_FILE="$RELEASE_CONFIG_FILE" \
      RELEASE_MANAGE_NGINX="$RELEASE_MANAGE_NGINX" \
      SMOKE_BASE_URL="$SMOKE_BASE_URL" \
      SMOKE_CDN_BASE_URL="$SMOKE_CDN_BASE_URL" \
      SMOKE_HTTP_URL="$SMOKE_HTTP_URL" \
      SMOKE_CANONICAL_URL="$SMOKE_CANONICAL_URL" \
      SMOKE_ALLOW_HTTP_EXTERNAL="${SMOKE_ALLOW_HTTP_EXTERNAL-0}" \
      "$RELEASE_ROOT/scripts/release/rollback.sh" automatic; then
      release_rollback_result=pass
    else
      release_rollback_result=failed
    fi
  fi
  release_record failed "$release_rollback_result"
  release_die "post-deploy-smoke-failed"
fi

release_write_env "$RELEASE_STATE_DIR/current.env" "$RELEASE_CONFIG_SHA256"
release_record pass not-needed
printf '%s\n' "[release] result=pass action=deployed"
