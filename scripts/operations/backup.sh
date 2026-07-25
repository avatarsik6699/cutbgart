#!/bin/sh
set -eu

BACKUP_DIR=${BACKUP_DIR:-$(pwd)/.ops/backups}
BACKUP_RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-14}
BACKUP_PASSPHRASE_FILE=${BACKUP_PASSPHRASE_FILE:-}
RELEASE_STATE_DIR=${RELEASE_STATE_DIR:-$(pwd)/.ops/releases}

[ -n "$BACKUP_PASSPHRASE_FILE" ] || {
  printf '%s\n' "[backup] result=failed reason=missing-passphrase-file" >&2
  exit 1
}
[ -f "$BACKUP_PASSPHRASE_FILE" ] || {
  printf '%s\n' "[backup] result=failed reason=passphrase-file-unavailable" >&2
  exit 1
}
case "$BACKUP_RETENTION_DAYS" in
  ""|*[!0-9]*) printf '%s\n' "[backup] result=failed reason=invalid-retention" >&2; exit 1 ;;
esac
[ "$BACKUP_RETENTION_DAYS" -ge 1 ] || exit 1

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
backup_stage=$(mktemp -d "$BACKUP_DIR/.stage.XXXXXX")
backup_cleanup() {
  rm -rf -- "$backup_stage"
}
trap backup_cleanup EXIT HUP INT TERM
umask 077

if [ -n "${BACKUP_INPUT_DIR:-}" ]; then
  [ -d "$BACKUP_INPUT_DIR" ] || {
    printf '%s\n' "[backup] result=failed reason=input-unavailable" >&2
    exit 1
  }
  cp -R "$BACKUP_INPUT_DIR"/. "$backup_stage/"
else
  # Exact allowlist only: aggregate analytics/monitor state, release metadata,
  # TLS material and non-secret configuration. Application images and browser
  # editor state have no server-side location and are never collected.
  docker compose exec -T umami-db pg_dump -U umami -d umami > "$backup_stage/umami.sql"
  docker compose exec -T uptime-kuma tar -C /app/data -cf - . \
    > "$backup_stage/uptime-kuma.tar"
  docker compose exec -T certbot tar -C /etc/letsencrypt -cf - . \
    > "$backup_stage/letsencrypt.tar"
  if [ -d "$RELEASE_STATE_DIR" ]; then
    mkdir "$backup_stage/releases"
    cp -R "$RELEASE_STATE_DIR"/. "$backup_stage/releases/"
  fi
  cp docker-compose.yml deploy/nginx/app.conf deploy/nginx/release.conf "$backup_stage/"
fi

backup_created=$(date -u +%Y-%m-%dT%H:%M:%SZ)
backup_stamp=$(date -u +%Y%m%dT%H%M%SZ)
{
  printf '{\n'
  printf '  "schemaVersion": 1,\n'
  printf '  "createdAt": "%s",\n' "$backup_created"
  printf '  "scope": ["umami", "uptime-kuma", "release-metadata", "tls", "non-secret-config"],\n'
  printf '  "excludes": ["source-images", "masks", "composites", "editor-state", "environment-secrets"]\n'
  printf '}\n'
} > "$backup_stage/backup-manifest.json"

backup_archive="$BACKUP_DIR/operations-${backup_stamp}.tar.gz.enc"
tar -C "$backup_stage" -czf - . |
  openssl enc -aes-256-cbc -pbkdf2 -salt \
    -pass "file:$BACKUP_PASSPHRASE_FILE" \
    -out "$backup_archive"
chmod 600 "$backup_archive"
sha256sum "$backup_archive" > "$backup_archive.sha256"
chmod 600 "$backup_archive.sha256"

find "$BACKUP_DIR" -maxdepth 1 -type f \
  \( -name 'operations-*.tar.gz.enc' -o -name 'operations-*.tar.gz.enc.sha256' \) \
  -mtime "+$BACKUP_RETENTION_DAYS" -delete

printf '%s\n' "[backup] result=pass artifact=$(basename "$backup_archive")"
