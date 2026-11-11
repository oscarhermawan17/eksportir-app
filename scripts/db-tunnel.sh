#!/usr/bin/env bash
# Opens the SSH tunnel that `DATABASE_URL` in apps/api/.env points at, and keeps it open.
#
# The VPS firewall allows 22, 80 and 443 only, and Indonesian home ISPs block outbound 5432 anyway,
# so the database is reached over SSH — nothing about PostgreSQL is exposed to the internet.
#
# Local port 5433 is used on purpose: the local Docker PostgreSQL keeps 5432, so both can run at once
# and a tunnel is never mistaken for the local database (see scripts/db-local.mjs).
#
# Override the target with env vars, e.g. VPS_HOST=1.2.3.4 pnpm db:tunnel
set -euo pipefail

VPS_USER="${VPS_USER:-ubuntu}"
VPS_HOST="${VPS_HOST:-43.133.155.17}"
LOCAL_PORT="${LOCAL_PORT:-5433}"
REMOTE_PORT="${REMOTE_PORT:-5432}"

echo "Tunnel: localhost:${LOCAL_PORT} → ${VPS_HOST}:${REMOTE_PORT} (as ${VPS_USER})"
echo "Leave this running. Ctrl-C closes it."
echo

# Reconnects by itself: a dropped tunnel otherwise shows up as confusing connection errors all over
# the app. ExitOnForwardFailure makes a busy local port fail loudly instead of silently doing nothing.
while true; do
  ssh -N \
    -o ExitOnForwardFailure=yes \
    -o ServerAliveInterval=30 \
    -o ServerAliveCountMax=3 \
    -L "${LOCAL_PORT}:localhost:${REMOTE_PORT}" \
    "${VPS_USER}@${VPS_HOST}" || true
  echo "Tunnel closed; reconnecting in 3s..." >&2
  sleep 3
done
