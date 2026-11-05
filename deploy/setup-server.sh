#!/usr/bin/env bash
# Sets up (or updates) BitSecure on Ubuntu 24.04.
#   sudo bash deploy/setup-server.sh [domain] [email-for-https]
# Safe to run again for updates: your database, secrets and settings are kept.
set -euo pipefail
DOMAIN="${1:-}"; EMAIL="${2:-}"
[ "$(id -u)" -eq 0 ] || { echo "Run with sudo."; exit 1; }
SRC="$(cd "$(dirname "$0")/.." && pwd)"
[ -d "$SRC/backend/app" ] && [ -f "$SRC/site/index.html" ] || { echo "Run this from the unzipped bitsecure-deploy folder."; exit 1; }

echo "==> Installing packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y python3-venv python3-pip traceroute nginx postgresql ufw openssl curl \
  $([ -n "$DOMAIN" ] && echo "certbot python3-certbot-nginx")

echo "==> Creating the service user and copying the app"
id bitsecure &>/dev/null || useradd --system --home /opt/bitsecure --shell /usr/sbin/nologin bitsecure
mkdir -p /opt/bitsecure/backend /var/www/bitsecure /etc/bitsecure
rm -rf /opt/bitsecure/backend/app /opt/bitsecure/backend/receiver /opt/bitsecure/backend/tests
cp -a "$SRC/backend/." /opt/bitsecure/backend/
rm -rf /var/www/bitsecure/* && cp -a "$SRC/site/." /var/www/bitsecure/
[ -d /opt/bitsecure/backend/.venv ] || python3 -m venv /opt/bitsecure/backend/.venv
/opt/bitsecure/backend/.venv/bin/pip install -q --upgrade pip
/opt/bitsecure/backend/.venv/bin/pip install -q -r /opt/bitsecure/backend/requirements.txt
chown -R bitsecure:bitsecure /opt/bitsecure

NEW_SECRET=""
if [ ! -f /etc/bitsecure/api.env ]; then
  echo "==> First run: creating the database and secrets"
  DB_PASS="$(openssl rand -hex 16)"
  JWT="$(openssl rand -base64 48 | tr -d '\n=+/')"
  NEW_SECRET="$(openssl rand -base64 48 | tr -d '\n=+/')"
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE ROLE bitsecure LOGIN PASSWORD '$DB_PASS';" 
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE bitsecure OWNER bitsecure;"
  ORIGIN="${DOMAIN:-localhost}"
  cat > /etc/bitsecure/api.env <<ENV
DATABASE_URL=postgresql+psycopg://bitsecure:${DB_PASS}@localhost:5432/bitsecure
JWT_SECRET=${JWT}
CORS_ORIGINS=https://${ORIGIN},http://${ORIGIN}
RECEIVER_SECRET=${NEW_SECRET}
RECEIVER_PORT=9009
ALLOW_PRIVATE_TARGETS=false
SERVER_LABEL=BitSecure server (AWS)
ENV
  chmod 600 /etc/bitsecure/api.env
fi

echo "==> Starting the API"
cp "$SRC/deploy/bitsecure-api.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable bitsecure-api >/dev/null
systemctl restart bitsecure-api

echo "==> Configuring Nginx"
sed "s/SERVER_NAME_HERE/${DOMAIN:-_}/" "$SRC/deploy/nginx-bitsecure.conf" > /etc/nginx/sites-available/bitsecure
ln -sf /etc/nginx/sites-available/bitsecure /etc/nginx/sites-enabled/bitsecure
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

echo "==> Firewall (SSH, HTTP, HTTPS only)"
ufw allow OpenSSH >/dev/null; ufw allow 'Nginx Full' >/dev/null; ufw --force enable >/dev/null

if [ -n "$DOMAIN" ]; then
  echo "==> HTTPS certificate"
  certbot --nginx -d "$DOMAIN" ${EMAIL:+-m "$EMAIL"} $([ -z "$EMAIL" ] && echo "--register-unsafely-without-email") --agree-tos --redirect -n \
    || echo "!! Certificate failed. Check that $DOMAIN points to this server's IP, then run: sudo certbot --nginx -d $DOMAIN"
fi

sleep 3
echo; echo "==> Checks"
curl -fsS http://127.0.0.1:8001/health && echo "  <- API is running" || { echo "API is NOT running: sudo journalctl -u bitsecure-api -n 50"; }
echo "traceroute as the service user (first 3 hops):"
sudo -u bitsecure traceroute -n -q 1 -w 2 -m 3 8.8.8.8 || echo "!! traceroute failed for the service user, see DEPLOY-AWS.md troubleshooting"
echo
if [ -n "$NEW_SECRET" ]; then
  echo "================================================================"
  echo "RECEIVER SECRET (needed to set up receivers; also saved in /etc/bitsecure/api.env):"
  echo "$NEW_SECRET"
  echo "================================================================"
fi
echo "Done. Open: ${DOMAIN:+https://$DOMAIN}${DOMAIN:-http://THIS-SERVER-IP}"
