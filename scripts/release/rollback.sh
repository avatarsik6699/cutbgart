#!/bin/sh
set -eu

RELEASE_ROOT=${RELEASE_ROOT:-$(pwd)}
RELEASE_STATE_DIR=${RELEASE_STATE_DIR:-$RELEASE_ROOT/.ops/releases}
RELEASE_CONFIG_FILE=${RELEASE_CONFIG_FILE:-$RELEASE_ROOT/deploy/nginx/release.conf}
RELEASE_MANAGE_NGINX=${RELEASE_MANAGE_NGINX:-1}
RELEASE_SKIP_PULL=${RELEASE_SKIP_PULL:-0}
SMOKE_BASE_URL=${SMOKE_BASE_URL:-https://cutbg.art}
SMOKE_CDN_BASE_URL=${SMOKE_CDN_BASE_URL:-https://cdn.cutbg.art/models}
SMOKE_HTTP_URL=${SMOKE_HTTP_URL-http://cutbg.art/}
SMOKE_CANONICAL_URL=${SMOKE_CANONICAL_URL-https://www.cutbg.art/}
release_mode=${1:-manual}

. "$RELEASE_ROOT/scripts/release/common.sh"

case "$release_mode" in
  manual|automatic) ;;
  *) release_die "invalid-rollback-mode" ;;
esac

[ -f "$RELEASE_STATE_DIR/previous.env" ] || release_die "previous-release-unavailable"
mkdir -p "$RELEASE_STATE_DIR/history"

release_lock="$RELEASE_STATE_DIR/deploy.lock"
release_owns_lock=0
if [ "${RELEASE_LOCK_HELD:-0}" != "1" ]; then
  if ! mkdir "$release_lock" 2>/dev/null; then
    release_die "deployment-lock-held"
  fi
  release_owns_lock=1
fi
release_unlock() {
  [ "$release_owns_lock" = "0" ] || rmdir "$release_lock" >/dev/null 2>&1 || true
}
trap release_unlock EXIT HUP INT TERM

# previous.env contains only values written by release_write_env after strict
# validation; it never contains credentials or arbitrary Compose environment.
. "$RELEASE_STATE_DIR/previous.env"
release_validate_identity
export APP_IMAGE APP_IMAGE_DIGEST APP_BUILD_ID APP_COMMIT_SHA APP_CREATED_AT

release_current_digest=none
if [ -f "$RELEASE_STATE_DIR/current.env" ]; then
  release_current_digest=$(
    . "$RELEASE_STATE_DIR/current.env"
    printf '%s' "$APP_IMAGE_DIGEST"
  )
fi
if [ "${RELEASE_LOCK_HELD:-0}" != "1" ] &&
  [ "$release_current_digest" = "$APP_IMAGE_DIGEST" ]; then
  release_external_smoke
  release_record pass not-needed rollback-idempotent
  printf '%s\n' "[rollback] result=pass action=already-current"
  exit 0
fi

[ "$RELEASE_SKIP_PULL" = "1" ] || docker compose pull app
if [ "${ROLLBACK_MODELS:-0}" = "1" ]; then
  docker compose --profile maintenance run --rm --build model-sync --rollback
fi
release_write_nginx_identity "$RELEASE_CONFIG_FILE"
docker compose up -d app
if [ "$RELEASE_MANAGE_NGINX" = "1" ]; then
  docker compose up -d --force-recreate nginx
fi
release_external_smoke
release_write_env "$RELEASE_STATE_DIR/current.env" "${RELEASE_CONFIG_SHA256:-unknown}"
release_record pass pass rollback
printf '%s\n' "[rollback] result=pass mode=$release_mode"
