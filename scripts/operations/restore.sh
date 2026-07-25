#!/bin/sh
set -eu

backup_archive=${1:-}
restore_target=${2:-}
BACKUP_PASSPHRASE_FILE=${BACKUP_PASSPHRASE_FILE:-}

[ -f "$backup_archive" ] || {
  printf '%s\n' "[restore] result=failed reason=archive-unavailable" >&2
  exit 1
}
[ -n "$restore_target" ] || {
  printf '%s\n' "[restore] result=failed reason=target-required" >&2
  exit 1
}
[ -f "$BACKUP_PASSPHRASE_FILE" ] || {
  printf '%s\n' "[restore] result=failed reason=passphrase-file-unavailable" >&2
  exit 1
}
if [ -e "$restore_target" ] && [ -n "$(find "$restore_target" -mindepth 1 -print -quit)" ]; then
  printf '%s\n' "[restore] result=failed reason=target-not-empty" >&2
  exit 1
fi

expected_hash=$(awk '{print $1}' "$backup_archive.sha256")
actual_hash=$(sha256sum "$backup_archive" | awk '{print $1}')
[ "$expected_hash" = "$actual_hash" ] || {
  printf '%s\n' "[restore] result=failed reason=checksum-mismatch" >&2
  exit 1
}

restore_stage=$(mktemp -d)
restore_cleanup() {
  rm -rf -- "$restore_stage"
}
trap restore_cleanup EXIT HUP INT TERM
restore_payload="$restore_stage/payload.tar.gz"
openssl enc -d -aes-256-cbc -pbkdf2 \
  -pass "file:$BACKUP_PASSPHRASE_FILE" \
  -in "$backup_archive" \
  -out "$restore_payload"
if tar -tzf "$restore_payload" |
  grep -E '(^/|(^|/)\.\.(/|$))' >/dev/null; then
  printf '%s\n' "[restore] result=failed reason=unsafe-archive-path" >&2
  exit 1
fi
restore_content="$restore_stage/content"
mkdir "$restore_content"
tar -C "$restore_content" -xzf "$restore_payload"

[ -f "$restore_content/backup-manifest.json" ] || {
  printf '%s\n' "[restore] result=failed reason=manifest-missing" >&2
  exit 1
}
if find "$restore_content" -type f |
  grep -E '/(source-images|masks|composites|editor-state)(/|$)' >/dev/null; then
  printf '%s\n' "[restore] result=failed reason=prohibited-content" >&2
  exit 1
fi

mkdir -p "$restore_target"
cp -R "$restore_content"/. "$restore_target/"
chmod -R u=rwX,go= "$restore_target"

if [ "${RESTORE_APPLY:-0}" = "1" ]; then
  [ "${RESTORE_CONFIRM:-}" = "restore-operational-state" ] || {
    printf '%s\n' "[restore] result=failed reason=confirmation-required" >&2
    exit 1
  }
  [ -f "$restore_content/umami.sql" ] &&
    docker compose exec -T umami-db psql -U umami -d umami < "$restore_content/umami.sql"
  if [ -f "$restore_content/uptime-kuma.tar" ]; then
    docker compose stop uptime-kuma
    docker compose exec -T uptime-kuma sh -c 'find /app/data -mindepth 1 -delete'
    docker compose exec -T uptime-kuma tar -C /app/data -xf - \
      < "$restore_content/uptime-kuma.tar"
    docker compose start uptime-kuma
  fi
  if [ -f "$restore_content/letsencrypt.tar" ]; then
    docker compose exec -T certbot sh -c 'find /etc/letsencrypt -mindepth 1 -delete'
    docker compose exec -T certbot tar -C /etc/letsencrypt -xf - \
      < "$restore_content/letsencrypt.tar"
  fi
fi

printf '%s\n' "[restore] result=pass mode=$([ "${RESTORE_APPLY:-0}" = "1" ] && printf apply || printf drill)"
