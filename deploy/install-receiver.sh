#!/usr/bin/env bash
# Run on a SECOND Ubuntu machine to make it a BitSecure receiver.
#   sudo bash deploy/install-receiver.sh <RECEIVER_SECRET> <API_SERVER_IP> [node-name]
set -euo pipefail
SECRET="${1:-}"; API_IP="${2:-}"; NAME="${3:-$(hostname)}"
[ "$(id -u)" -eq 0 ] || { echo "Run with sudo."; exit 1; }
[ ${#SECRET} -ge 32 ] && [ -n "$API_IP" ] || { echo "Usage: sudo bash deploy/install-receiver.sh <secret (32+ chars)> <api-server-ip> [node-name]"; exit 1; }
SRC="$(cd "$(dirname "$0")/.." && pwd)"
apt-get update -y && DEBIAN_FRONTEND=noninteractive apt-get install -y python3 ufw
mkdir -p /opt/bitsecure-receiver /etc/bitsecure
cp "$SRC/backend/receiver/receiver.py" /opt/bitsecure-receiver/receiver.py
printf 'BITSECURE_RECEIVER_SECRET=%s\nNODE_NAME=%s\n' "$SECRET" "$NAME" > /etc/bitsecure/receiver.env
chmod 600 /etc/bitsecure/receiver.env
cp "$SRC/deploy/bitsecure-receiver.service" /etc/systemd/system/
systemctl daemon-reload; systemctl enable bitsecure-receiver >/dev/null; systemctl restart bitsecure-receiver
ufw allow OpenSSH >/dev/null; ufw allow from "$API_IP" to any port 9009 proto tcp >/dev/null; ufw --force enable >/dev/null
sleep 2; systemctl is-active bitsecure-receiver && echo "Receiver '$NAME' is running on port 9009 (allowed only from $API_IP)."
echo "Also open TCP 9009 from $API_IP/32 in this instance's AWS security group."
