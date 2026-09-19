#!/usr/bin/env bash
# Re-bake NAS CI job image nixos/nix:runner-ci for act_runner v0.6.1
# (hardcoded /bin/sleep entrypoint; baked /root/ci-clone-token = only credential
# mechanism; node toolchain pre-installed so jobs need no nix-shell).
# Run ON THE NAS:  bash bake-node-ci-image.sh
set -e
TOK=/volume1/docker/ci-clone-token
D='/usr/local/bin/docker'
$D rm -f mk-nixci >/dev/null 2>&1 || true

# long-lived helper container to exec into
$D run -d --name mk-nixci --entrypoint /bin/sh nixos/nix:runner -c 'sleep 3600' >/dev/null
$D cp "$TOK" mk-nixci:/root/ci-clone-token
$D exec mk-nixci sh -c 'rm -f /bin/sleep; ln -s $(find /nix/store -maxdepth 4 -path "*coreutils*/bin/sleep" | head -1) /bin/sleep'
echo "== installing toolchain (substituters only, no local builds)..."
$D exec mk-nixci sh -c 'NIXPKGS_ALLOW_INSECURE=1 nix-env -p /nix/var/nix/profiles/ci-cache -f "<nixpkgs>" -iA nodejs_22 python3 git curl \
  --option sandbox relaxed --option filter-syscalls false \
  --option extra-substituters "https://mirror.nju.edu.cn/nix-channels/store https://cache.nixos.org" 2>&1 | tail -3'
$D exec mk-nixci sh -c 'for b in node npm npx corepack python3 git curl gcc g++ make ld cc; do ln -sf /nix/var/nix/profiles/ci-cache/bin/$b /usr/local/bin/$b 2>/dev/null; done; mkdir -p /usr/local/lib; ln -sfn /nix/var/nix/profiles/ci-cache/lib/node_modules /usr/local/lib/node_modules; true'
$D commit mk-nixci nixos/nix:runner-ci >/dev/null
$D rm -f mk-nixci >/dev/null

echo "== verify:"
$D run --rm --entrypoint '/bin/sleep' nixos/nix:runner-ci 2 && echo SLEEP_OK
$D run --rm --entrypoint /bin/sh nixos/nix:runner-ci -c 'wc -c < /root/ci-clone-token; node --version; npm --version; git --version'
