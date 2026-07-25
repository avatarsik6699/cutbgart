#!/bin/sh

release_die() {
  printf '%s\n' "[release] result=failed reason=$1" >&2
  exit 1
}

release_require() {
  eval "release_value=\${$1-}"
  [ -n "$release_value" ] || release_die "missing-$1"
}

release_validate_request() {
  case "$APP_IMAGE" in
    *@sha256:[0-9a-f][0-9a-f]*) ;;
    *) release_die "image-must-use-digest" ;;
  esac
  APP_IMAGE_DIGEST=${APP_IMAGE##*@}
  case "$APP_IMAGE_DIGEST" in
    sha256:????????????????????????????????????????????????????????????????) ;;
    *) release_die "invalid-image-digest" ;;
  esac
  case "${APP_IMAGE_DIGEST#sha256:}" in
    *[!0-9a-f]*) release_die "invalid-image-digest" ;;
  esac
  case "$APP_BUILD_ID" in
    ""|*[!A-Za-z0-9._-]*) release_die "invalid-build-id" ;;
  esac
  case "$APP_COMMIT_SHA" in
    *[!0-9a-f]*|"") release_die "invalid-commit-sha" ;;
  esac
  [ "${#APP_COMMIT_SHA}" -eq 40 ] || release_die "invalid-commit-sha"
}

release_validate_identity() {
  release_validate_request
  case "$APP_CREATED_AT" in
    ""|*[!0-9TZ:+.-]*) release_die "invalid-created-at" ;;
  esac
}

release_write_nginx_identity() {
  release_config_file=$1
  release_config_tmp="${release_config_file}.tmp.$$"
  umask 077
  {
    printf 'add_header X-Cutbg-Build-Id "%s" always;\n' "$APP_BUILD_ID"
    printf 'add_header X-Cutbg-Commit "%s" always;\n' "$APP_COMMIT_SHA"
    printf 'add_header X-Cutbg-Image-Digest "%s" always;\n' "$APP_IMAGE_DIGEST"
    printf 'add_header X-Cutbg-Created-At "%s" always;\n' "$APP_CREATED_AT"
  } > "$release_config_tmp"
  mv "$release_config_tmp" "$release_config_file"
  chmod 600 "$release_config_file"
}

release_write_env() {
  release_env_file=$1
  release_config_sha=$2
  release_env_tmp="${release_env_file}.tmp.$$"
  umask 077
  {
    printf "APP_IMAGE='%s'\n" "$APP_IMAGE"
    printf "APP_IMAGE_DIGEST='%s'\n" "$APP_IMAGE_DIGEST"
    printf "APP_BUILD_ID='%s'\n" "$APP_BUILD_ID"
    printf "APP_COMMIT_SHA='%s'\n" "$APP_COMMIT_SHA"
    printf "APP_CREATED_AT='%s'\n" "$APP_CREATED_AT"
    printf "RELEASE_CONFIG_SHA256='%s'\n" "$release_config_sha"
  } > "$release_env_tmp"
  mv "$release_env_tmp" "$release_env_file"
  chmod 600 "$release_env_file"
}

release_external_smoke() {
  release_force_failure=${SMOKE_FORCE_FAILURE:-0}
  if [ -n "${SMOKE_FORCE_FAILURE_BUILD_ID:-}" ] &&
    [ "$SMOKE_FORCE_FAILURE_BUILD_ID" = "$APP_BUILD_ID" ]; then
    release_force_failure=1
  fi
  docker compose exec -T \
    -e SMOKE_BASE_URL="$SMOKE_BASE_URL" \
    -e SMOKE_CDN_BASE_URL="$SMOKE_CDN_BASE_URL" \
    -e SMOKE_HTTP_URL="${SMOKE_HTTP_URL-}" \
    -e SMOKE_CANONICAL_URL="${SMOKE_CANONICAL_URL-}" \
    -e SMOKE_ALLOW_HTTP_EXTERNAL="${SMOKE_ALLOW_HTTP_EXTERNAL-0}" \
    -e SMOKE_FORCE_FAILURE="$release_force_failure" \
    -e EXPECTED_BUILD_ID="$APP_BUILD_ID" \
    -e EXPECTED_COMMIT_SHA="$APP_COMMIT_SHA" \
    -e EXPECTED_IMAGE_DIGEST="$APP_IMAGE_DIGEST" \
    -e EXPECTED_CREATED_AT="$APP_CREATED_AT" \
    app node /app/release/smoke.mjs external
}

release_record() {
  release_outcome=$1
  release_rollback=$2
  release_event=${3:-deploy}
  release_now=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  release_stamp=$(date -u +%Y%m%dT%H%M%SZ)
  release_record_file="$RELEASE_STATE_DIR/history/${release_stamp}-${APP_BUILD_ID}-${release_event}.json"
  release_record_tmp="${release_record_file}.tmp.$$"
  umask 077
  {
    printf '{\n'
    printf '  "schemaVersion": 1,\n'
    printf '  "event": "%s",\n' "$release_event"
    printf '  "recordedAt": "%s",\n' "$release_now"
    printf '  "actor": "%s",\n' "${DEPLOY_ACTOR:-manual}"
    printf '  "ref": "%s",\n' "${DEPLOY_REF:-manual}"
    printf '  "runId": "%s",\n' "${DEPLOY_RUN_ID:-manual}"
    printf '  "buildId": "%s",\n' "$APP_BUILD_ID"
    printf '  "commitSha": "%s",\n' "$APP_COMMIT_SHA"
    printf '  "imageDigest": "%s",\n' "$APP_IMAGE_DIGEST"
    printf '  "createdAt": "%s",\n' "$APP_CREATED_AT"
    printf '  "configSha256": "%s",\n' "${RELEASE_CONFIG_SHA256:-unknown}"
    printf '  "checks": {"config": "pass", "candidate": "pass", "external": "%s"},\n' "$release_outcome"
    printf '  "outcome": "%s",\n' "$release_outcome"
    printf '  "rollback": "%s"\n' "$release_rollback"
    printf '}\n'
  } > "$release_record_tmp"
  mv "$release_record_tmp" "$release_record_file"
  chmod 600 "$release_record_file"
  ls -1t "$RELEASE_STATE_DIR"/history/*.json 2>/dev/null |
    awk 'NR > 10' |
    while IFS= read -r release_old_record; do
      rm -f -- "$release_old_record"
    done
}
