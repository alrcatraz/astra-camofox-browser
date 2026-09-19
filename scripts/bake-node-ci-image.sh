#!/usr/bin/env bash
# Re-bake the NAS CI job image: node:22-bookworm-slim + /root/ci-clone-token
# + /bin/sleep symlink (act_runner hardcodes /bin/sleep 10800 as entrypoint).
# Run ON THE NAS:  bash bake-node-ci-image.sh
set -e
TOK_SRC=/volume1/docker/ci-clone-token
D='/usr/local/bin/docker'
$D rm -f tok-bake-node >/dev/null 2>&1 || true
$D create --name tok-bake-node --entrypoint /bin/sh docker.io/library/node:22-bookworm-slim \
  -c 'ln -sf /usr/local/bin/sleep /bin/sleep; true' >/dev/null
$D cp "$TOK_SRC" tok-bake-node:/root/ci-clone-token
$D start -a tok-bake-node >/dev/null
$D commit tok-bake-node docker.io/library/node:22-bookworm-slim-ci
$D rm tok-bake-node
$D run --rm --entrypoint /bin/sh docker.io/library/node:22-bookworm-slim-ci \
  -c 'ls -l /root/ci-clone-token && ls -l /bin/sleep'
