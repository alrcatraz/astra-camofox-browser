#!/usr/bin/env bash
# HC01 deploy script — pull the latest release image and recreate the container.
# Usage: ./deploy-hc01.sh [version-tag]   (default: latest)
set -euo pipefail
VER="${1:-latest}"
IMG="ghcr.io/alrcatraz/astra-camofox-browser:${VER}"

echo "== pull $IMG"
podman pull "$IMG"

echo "== current container config snapshot"
CUR_IMG=$(podman inspect camofox-browser --format '{{.ImageName}}')
echo "current: $CUR_IMG"

echo "== recreate with same mounts/ports, new image"
podman stop camofox-browser
podman rename camofox-browser "camofox-browser.rollback-$(date +%s)"
if podman create --name camofox-browser \
    --restart=always --network=pasta \
    -p 5900:5900 -p 9377:9377 \
    -v ~/.camofox/profiles:/root/.camofox/profiles \
    -e CAMOFOX_API_KEY="$(grep '^CAMOFOX_CONTAINER_KEY=' ~/.hermes/.env | cut -d= -f2 || true)" \
    "$IMG"; then
  podman start camofox-browser
  sleep 8
  if curl -sf http://127.0.0.1:9377/health >/dev/null; then
    echo "== deployed OK; rollback container kept as $(podman ps -a --format '{{.Names}}' | grep rollback | tail -1)"
  else
    echo "!! health check failed — rolling back"
    podman rm -f camofox-browser
    RB=$(podman ps -a --format '{{.Names}}' | grep rollback | tail -1)
    podman rename "$RB" camofox-browser && podman start camofox-browser
    exit 1
  fi
else
  echo "!! create failed — restoring old container"
  RB=$(podman ps -a --format '{{.Names}}' | grep rollback | tail -1)
  podman rename "$RB" camofox-browser && podman start camofox-browser
  exit 1
fi
