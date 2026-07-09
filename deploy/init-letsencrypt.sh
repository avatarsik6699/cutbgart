#!/usr/bin/env bash
# One-time bootstrap for the nginx + Certbot TLS setup (SPEC.md §8.2).
#
# Problem this solves: nginx's server block references
# /etc/letsencrypt/live/cutbg.art/{fullchain,privkey}.pem unconditionally
# (deploy/nginx/app.conf). On a brand-new deploy those files don't exist —
# nginx fails to start, so Certbot's webroot HTTP-01 challenge (which needs
# nginx serving :80) never gets a chance to run either. This script breaks
# the chicken-and-egg loop: generate a throwaway self-signed cert so nginx
# can start, obtain the real cert, then discard the dummy and reload.
#
# Run once per domain, on the VPS, before the first real deploy:
#   ./deploy/init-letsencrypt.sh

set -euo pipefail

DOMAIN="cutbg.art"
DOMAIN_WWW="www.cutbg.art"
EMAIL="" # set to a real address to receive Let's Encrypt expiry notices
CERT_PATH="/etc/letsencrypt/live/$DOMAIN"

echo "==> Creating dummy certificate for $DOMAIN so nginx can start..."
docker compose run --rm --entrypoint "\
  mkdir -p $CERT_PATH && \
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout '$CERT_PATH/privkey.pem' \
    -out '$CERT_PATH/fullchain.pem' \
    -subj '/CN=localhost'" certbot

echo "==> Starting nginx..."
docker compose up -d nginx

echo "==> Deleting dummy certificate..."
docker compose run --rm --entrypoint "rm -rf /etc/letsencrypt/live/$DOMAIN" certbot

echo "==> Requesting real certificate from Let's Encrypt..."
docker compose run --rm --entrypoint "\
  certbot certonly --webroot -w /var/www/certbot \
    -d $DOMAIN -d $DOMAIN_WWW \
    ${EMAIL:+--email $EMAIL} ${EMAIL:+--no-eff-email} $( [ -z "$EMAIL" ] && echo --register-unsafely-without-email ) \
    --agree-tos --non-interactive" certbot

echo "==> Reloading nginx with the real certificate..."
docker compose exec nginx nginx -s reload

echo "==> Done. The 'certbot' service (already running via docker compose up) handles renewal."
