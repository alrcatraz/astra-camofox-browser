#!/usr/bin/env bash
# Re-bake NAS CI job images for act_runner:
#   - node:22-bookworm-slim-ci  (npm test jobs)
#   - nixos/nix:runner-ci       (nix builds; token baked too)
# act_runner v0.6.1 hardcodes entrypoint ["/bin/sleep","10800"] and the only
# credential mechanism is a file baked into the image (/root/ci-clone-token).
# Run ON THE NAS:  bash bake-node-ci-image.sh
set -e
TOK_SRC=/volume1/docker/ci-clone-token
D='/usr/local/bin/docker'

bake() {
  local BASE="$1" OUT="$2" NAME="bake-$3"
  $D rm -f "$NAME" >/dev/null 2>&1 || true
  $D create --name "$NAME" --entrypoint /bin/sh "$BASE" -c 'true' >/dev/null
  $D cp "$TOK_SRC" "$NAME:/root/ci-clone-token"
  # git + FHS sleep for act's hardcoded entrypoint
  $D start -a "$NAME" >/dev/null 2>&1 || true
  $D commit "$NAME" "$OUT"
  $D rm "$NAME" >/dev/null
}

# --- node image: needs git installed via apt inside a run step, so use docker commit after exec
$D rm -f bake-node >/dev/null 2>&1 || true
CID=$($D create --entrypoint /bin/sh docker.io/library/node:22-bookworm-slim -c 'apt-get update -qq && apt-get install -y -qq git ca-certificates curl >/dev/null && ln -sf /usr/local/bin/sleep /bin/sleep')
$D cp "$TOK_SRC" "$CID:/root/ci-clone-token"
$D start -ai "$CID" >/dev/null
$D commit "$CID" docker.io/library/node:22-bookworm-slim-ci
$D rm "$CID"

# --- nix runner image: token + coreutils symlink via busybox? nix:latest has no /bin/sleep;
# provide it from the store: nixos/nix images ship bash in /bin, but sleep lives in /root/.nix-profile or /nix/store.
$D rm -f bake-nix >/dev/null 2>&1 || true
CID2=$($D create --entrypoint /bin/sh nixos/nix:runner -c 'ls /bin/sleep || (find /nix/store -maxdepth 3 -name sleep -type f | head -1 | xargs -r ln -sf /bin/sleep); ls -l /bin/sleep')
$D cp "$TOK_SRC" "$CID2:/root/ci-clone-token"
$D start -ai "$CID2" >/dev/null
$D commit "$CID2" nixos/nix:runner-ci
$D rm "$CID2"

echo "== verify:"
$D run --rm --entrypoint '/bin/sleep' docker.io/library/node:22-bookworm-slim-ci 2 && echo NODE_SLEEP_OK
$D run --rm --entrypoint /bin/sh docker.io/library/node:22-bookworm-slim-ci -c 'git --version; wc -c < /root/ci-clone-token'
$D run --rm --entrypoint '/bin/sleep' nixos/nix:runner-ci 2 && echo NIX_SLEEP_OK
$D run --rm --entrypoint /bin/sh nixos/nix:runner-ci -c 'wc -c < /root/ci-clone-token; command -v git || echo NO_GIT_IN_NIX'
