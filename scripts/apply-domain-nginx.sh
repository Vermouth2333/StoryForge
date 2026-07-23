#!/usr/bin/env bash
# Inject StoryForge vhost into ebbinghaus-gateway nginx (port 80) and join networks.
# Run on server: bash ~/storyforge/scripts/apply-domain-nginx.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONF="$ROOT/deploy/nginx-storyforge.conf"
GATEWAY="${GATEWAY_CONTAINER:-ebbinghaus-gateway-1}"
NETWORK="${GATEWAY_NETWORK:-ebbinghaus_default}"
APP="${APP_CONTAINER:-storyforge}"

if [[ ! -f "$CONF" ]]; then
  echo "missing config: $CONF" >&2
  exit 1
fi

if ! docker inspect "$GATEWAY" >/dev/null 2>&1; then
  echo "gateway container not found: $GATEWAY" >&2
  exit 1
fi

if ! docker inspect "$APP" >/dev/null 2>&1; then
  echo "app container not found: $APP" >&2
  exit 1
fi

docker network connect "$NETWORK" "$APP" 2>/dev/null || true

docker cp "$CONF" "$GATEWAY:/etc/nginx/conf.d/storyforge.conf"
docker exec "$GATEWAY" nginx -t
docker exec "$GATEWAY" nginx -s reload
echo "OK: storyforge.fun -> ${APP}:3000 via ${GATEWAY}"
