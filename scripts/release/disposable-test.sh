#!/bin/sh
set -eu

release_root=$(pwd)
release_test_dir=$(mktemp -d)
release_project="cutbg-release-test-$$"
release_image_prefix="cutbg-disposable-$$"
release_sha_one=1111111111111111111111111111111111111111
release_sha_two=2222222222222222222222222222222222222222
release_sha_three=3333333333333333333333333333333333333333

release_cleanup() {
  COMPOSE_FILE=tests/release/disposable-compose.yml \
    COMPOSE_PROJECT_NAME="$release_project" \
    docker compose down --remove-orphans >/dev/null 2>&1 || true
  docker image rm \
    "$release_image_prefix:v1" \
    "$release_image_prefix:v2" \
    "$release_image_prefix:v3" \
    "$release_image_prefix:bad" >/dev/null 2>&1 || true
  rm -rf -- "$release_test_dir"
}
trap release_cleanup EXIT HUP INT TERM

release_build() {
  release_tag=$1
  release_build_id=$2
  release_commit=$3
  release_created=$4
  release_fail=${5:-0}
  docker build -q \
    -f tests/release/Dockerfile \
    --build-arg "APP_BUILD_ID=$release_build_id" \
    --build-arg "APP_COMMIT_SHA=$release_commit" \
    --build-arg "APP_CREATED_AT=$release_created" \
    --build-arg "FAIL_MODE=$release_fail" \
    -t "$release_image_prefix:$release_tag" . >/dev/null
}

release_reference() {
  release_tag=$1
  release_id=$(docker image inspect --format '{{.Id}}' "$release_image_prefix:$release_tag")
  printf '%s@%s' "$release_image_prefix:$release_tag" "$release_id"
}

release_run() {
  export APP_IMAGE=$1
  export APP_BUILD_ID=$2
  export APP_COMMIT_SHA=$3
  export APP_CREATED_AT=$4
  export COMPOSE_FILE=tests/release/disposable-compose.yml
  export COMPOSE_PROJECT_NAME=$release_project
  export RELEASE_ROOT=$release_root
  export RELEASE_STATE_DIR=$release_test_dir/state
  export RELEASE_CONFIG_FILE=$release_test_dir/release.conf
  export RELEASE_MANAGE_NGINX=0
  export RELEASE_SYNC_MODELS=0
  export RELEASE_SKIP_PULL=1
  export RELEASE_ALLOW_FIRST_DEPLOY=1
  export SMOKE_BASE_URL=http://127.0.0.1:3000
  export SMOKE_CDN_BASE_URL=http://127.0.0.1:3000/models
  export SMOKE_ALLOW_HTTP_EXTERNAL=1
  export SMOKE_HTTP_URL=
  export SMOKE_CANONICAL_URL=
  export DEPLOY_ACTOR=disposable-test
  export DEPLOY_REF=refs/heads/main
  export DEPLOY_RUN_ID="disposable-$APP_BUILD_ID"
  ./scripts/release/deploy.sh
}

release_build v1 disposable.1 "$release_sha_one" 2026-07-24T10:00:00Z
release_build v2 disposable.2 "$release_sha_two" 2026-07-24T10:01:00Z
release_build v3 disposable.3 "$release_sha_three" 2026-07-24T10:02:00Z
release_build bad disposable.bad "$release_sha_three" 2026-07-24T10:03:00Z 1

release_v1=$(release_reference v1)
release_v2=$(release_reference v2)
release_v3=$(release_reference v3)
release_bad=$(release_reference bad)

release_run "$release_v1" disposable.1 "$release_sha_one" 2026-07-24T10:00:00Z
release_run "$release_v2" disposable.2 "$release_sha_two" 2026-07-24T10:01:00Z

if release_run "$release_bad" disposable.bad "$release_sha_three" 2026-07-24T10:03:00Z; then
  printf '%s\n' "[disposable-release] result=failed reason=candidate-not-isolated" >&2
  exit 1
fi
grep -q "disposable.2" "$release_test_dir/state/current.env"

export SMOKE_FORCE_FAILURE_BUILD_ID=disposable.3
if release_run "$release_v3" disposable.3 "$release_sha_three" 2026-07-24T10:02:00Z; then
  printf '%s\n' "[disposable-release] result=failed reason=post-failure-hidden" >&2
  exit 1
fi
unset SMOKE_FORCE_FAILURE_BUILD_ID
grep -q "disposable.2" "$release_test_dir/state/current.env"
grep -R -q '"rollback": "pass"' "$release_test_dir/state/history"

release_run "$release_v2" disposable.2 "$release_sha_two" 2026-07-24T10:01:00Z
mkdir "$release_test_dir/state/deploy.lock"
if release_run "$release_v2" disposable.2 "$release_sha_two" 2026-07-24T10:01:00Z; then
  printf '%s\n' "[disposable-release] result=failed reason=lock-not-enforced" >&2
  exit 1
fi
rmdir "$release_test_dir/state/deploy.lock"

printf '%s\n' "[disposable-release] result=pass"
