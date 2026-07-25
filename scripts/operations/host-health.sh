#!/bin/sh
set -eu

DISK_WARN_PERCENT=${DISK_WARN_PERCENT:-80}
MEM_WARN_PERCENT=${MEM_WARN_PERCENT:-85}
BACKUP_DIR=${BACKUP_DIR:-$(pwd)/.ops/backups}
BACKUP_MAX_AGE_HOURS=${BACKUP_MAX_AGE_HOURS:-30}

health_failed=0
disk_used=$(df -P "$(pwd)" | awk 'NR == 2 {gsub("%", "", $5); print $5}')
mem_used=$(awk '
  /MemTotal:/ {total=$2}
  /MemAvailable:/ {available=$2}
  END {printf "%.0f", (total-available)*100/total}
' /proc/meminfo)

if [ "$disk_used" -ge "$DISK_WARN_PERCENT" ]; then
  printf '%s\n' "[health] signal=disk-pressure value=$disk_used result=fail"
  health_failed=1
else
  printf '%s\n' "[health] signal=disk-pressure value=$disk_used result=pass"
fi
if [ "$mem_used" -ge "$MEM_WARN_PERCENT" ]; then
  printf '%s\n' "[health] signal=memory-pressure value=$mem_used result=fail"
  health_failed=1
else
  printf '%s\n' "[health] signal=memory-pressure value=$mem_used result=pass"
fi

for health_service in app nginx umami umami-db uptime-kuma certbot; do
  if docker compose ps --status running --services | grep -Fx "$health_service" >/dev/null; then
    printf '%s\n' "[health] signal=container service=$health_service result=pass"
  else
    printf '%s\n' "[health] signal=container service=$health_service result=fail"
    health_failed=1
  fi
done

if docker compose exec -T nginx openssl x509 \
  -checkend 1209600 \
  -noout \
  -in /etc/letsencrypt/live/cutbg.art/fullchain.pem >/dev/null 2>&1; then
  printf '%s\n' "[health] signal=certificate-expiry result=pass"
else
  printf '%s\n' "[health] signal=certificate-expiry result=fail"
  health_failed=1
fi

health_latest_backup=$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'operations-*.tar.gz.enc' \
  -mmin "-$((BACKUP_MAX_AGE_HOURS * 60))" -print -quit 2>/dev/null || true)
if [ -n "$health_latest_backup" ]; then
  printf '%s\n' "[health] signal=backup-freshness result=pass"
else
  printf '%s\n' "[health] signal=backup-freshness result=fail"
  health_failed=1
fi

health_5xx=$(docker compose logs --since 5m nginx 2>/dev/null |
  awk '$0 ~ /" [5][0-9][0-9] / {count++} END {print count+0}')
if [ "$health_5xx" -ge 10 ]; then
  printf '%s\n' "[health] signal=elevated-5xx value=$health_5xx result=fail"
  health_failed=1
else
  printf '%s\n' "[health] signal=elevated-5xx value=$health_5xx result=pass"
fi

exit "$health_failed"
