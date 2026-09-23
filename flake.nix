{
  description = "CI/dev toolchain for astra-camofox-browser (pinned, reproducible)";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.05";
  inputs.flake-utils.url = "github:numtide/flake-utils";

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let pkgs = import nixpkgs { inherit system; };
      in {
        devShells.ci = pkgs.mkShell {
          # Node >=22 per package.json engines; native builds (better-sqlite3)
          # need gcc+make+python on PATH.
          packages = with pkgs; [
            nodejs_22
            python3
            gcc
            gnumake
            git
            curl
            gnused
            gawk
            docker  # CI image build/smoke client: talks to the NAS host's docker-compat socket (DooD)
          ];
          shellHook = ''
            export HOME=''${HOME:-/tmp}
            export npm_config_build_from_source=true
          '';
        };
        # bare `nix develop` lands in ci too
        devShells.default = self.devShells.${system}.ci;
      });
}
