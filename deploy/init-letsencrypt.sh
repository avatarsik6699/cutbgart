#!/usr/bin/env bash
# One-time bootstrap for the nginx + Certbot TLS setup (SPEC.md §8.2).
#
# Problem this solves: nginx's server block references
# /etc/letsencrypt/live/cutbg.art/{fullchain,privkey}.pem unconditionally
# (deploy/nginx/app.conf). On a brand-new deploy those files don't exist, so
# nginx cannot start. Certbot obtains the first certificate in standalone
# mode while port 80 is free; nginx starts only after the real files exist.
#
# Run once per domain, on the VPS, before the first real deploy:
#   ./deploy/init-letsencrypt.sh

set -euo pipefail

DOMAIN="cutbg.art"
DOMAIN_WWW="www.cutbg.art"
DOMAIN_CDN="cdn.cutbg.art"
EMAIL="" # set to a real address to receive Let's Encrypt expiry notices
if docker compose run --rm --entrypoint "test -f /etc/letsencrypt/live/$DOMAIN/fullchain.pem" certbot; then
  echo "==> Existing certificate found for $DOMAIN; ensuring all SANs are present."
  docker compose up -d nginx
  docker compose run --rm --entrypoint "\
    certbot certonly --webroot -w /var/www/certbot \
      --cert-name $DOMAIN --expand \
      -d $DOMAIN -d $DOMAIN_WWW -d $DOMAIN_CDN \
      ${EMAIL:+--email $EMAIL} ${EMAIL:+--no-eff-email} $( [ -z "$EMAIL" ] && echo --register-unsafely-without-email ) \
      --agree-tos --non-interactive" certbot
  docker compose exec -T nginx nginx -s reload
  docker compose up -d certbot
  exit 0
fi

echo "==> Requesting real certificate from Let's Encrypt..."
docker compose stop nginx >/dev/null 2>&1 || true
docker compose run --rm -p 80:80 --entrypoint "\
  certbot certonly --standalone \
    -d $DOMAIN -d $DOMAIN_WWW -d $DOMAIN_CDN \
    ${EMAIL:+--email $EMAIL} ${EMAIL:+--no-eff-email} $( [ -z "$EMAIL" ] && echo --register-unsafely-without-email ) \
    --agree-tos --non-interactive" certbot

echo "==> Starting nginx with the real certificate..."
docker compose up -d nginx certbot

echo "==> Done. The 'certbot' service handles renewal."
