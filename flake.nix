# qi-v2-visualization's tools and products, the same on every machine (docs/process.md): `nix develop`, then
# `make install` and the targets of the Makefile. Everything from outside is an input pinned by flake.lock, each a
# public repository read over HTTPS with no login: qi-v2's one nixpkgs, its pure shell and its TeX preset (the static
# picture); the kit, which writes the agents' files from agents/; 缠论's contract and the market data contract
# (qi-v2-contracts); @qi/base and @qi/core (qi-v2-ts). The results are no input: the published image, public, by the
# digest results.lock names, taken by make results-fetch.
{
  description = "qi-v2-visualization: @qi/chart, the 缠论 drawing library, and the chart app; version 2, online, made here";

  inputs.qi-v2.url = "github:zhifengzhang-sz/qi-v2-nix?dir=qi-v2";
  inputs.nixpkgs.follows = "qi-v2/nixpkgs";
  inputs.kit.url = "github:zhifengzhang-sz/qi-v2-nix?dir=kit";
  inputs.kit.inputs.qi-v2.follows = "qi-v2";
  # 缠论's contract (qi-v2-contracts, chanlun/README.md): its TypeScript form, @qi/chanlun, linked at
  # dev/ts/node_modules/@qi/chanlun (make chanlun-link) and copied into the packages qi-chart and chart
  inputs.contracts.url = "github:zhifengzhang-sz/qi-v2-contracts?ref=chanlun-1.1.0";
  inputs.contracts.inputs.qi-v2.follows = "qi-v2";
  # the market data contract (qi-v2-contracts, market/README.md): its TypeScript form, @qi/market, the K-lines the
  # library takes (docs/designs/design-chart-online-2026-11-08.md), linked at dev/ts/node_modules/@qi/market (make
  # market-link) and copied into the packages qi-chart and chart
  inputs.market.url = "github:zhifengzhang-sz/qi-v2-contracts?ref=market-1.1.0";
  inputs.market.inputs.qi-v2.follows = "qi-v2";
  inputs.market.inputs.kit.follows = "kit";
  # @qi/base and @qi/core (qi-v2-ts, its README.md): its product qi-v2-ts, their source with what they take, linked
  # at dev/ts/node_modules/@qi/base and @qi/core (make qi-v2-ts-link) and copied into the packages qi-chart and chart
  inputs.qi-v2-ts.url = "github:zhifengzhang-sz/qi-v2-ts?ref=qi-v2-ts-0.1.0";
  inputs.qi-v2-ts.inputs.qi-v2.follows = "qi-v2";
  inputs.qi-v2-ts.inputs.kit.follows = "kit";

  outputs = { self, nixpkgs, qi-v2, kit, contracts, market, qi-v2-ts }:
    let
      systems = [ "x86_64-linux" ];
      forAll = f: nixpkgs.lib.genAttrs systems (system: f (import nixpkgs {
        inherit system;
        config.allowUnfreePredicate = pkg: builtins.elem (nixpkgs.lib.getName pkg) [ "claude-code" "github-copilot-cli" ];
      }));
    in {
      devShells = forAll (pkgs:
        let
          shell = extra: qi-v2.lib.mkPureShell pkgs {
            name = "visualization";
            # the TeX of the static picture (the tikz engine's chart.tex, by XeLaTeX with xeCJK)
            uses = [ (qi-v2.lib.tex pkgs) ];
            packages = with pkgs; [
              gnumake git gh curl openssh crane python3
              # the TypeScript of dev/ts/ (dev/ts/STYLE.md): Bun runs it, Biome lints and formats it; its packages
              # (Zod, vitest, fast-check, TypeScript) are pinned by dev/ts/bun.lock; vitest's runtime is Node
              bun biome nodejs_24
            ] ++ extra;
            hostTools = [ "nix" "nix-store" "wslpath" "cmd.exe" "xdg-open" ];
            needs = [
              { tool = "wslpath"; by = "make chart (opening a page)"; on = "wsl"; }
              { tool = "cmd.exe"; by = "make chart (opening a page)"; on = "wsl"; }
              { tool = "xdg-open"; by = "make chart (opening a page)"; on = "other"; }
            ];
            env = {
              VISUALIZATION_SHELL = "1";
              CHANLUN_TS = "${contracts.packages.${pkgs.stdenv.hostPlatform.system}.chanlun-ts}";
            };
            closing = ''echo "visualization: make help lists the targets; docs/opening.md says where the work stands"'';
          };
        in {
          default = shell [ ];
          claude-code = shell [ pkgs.claude-code ];
          copilot = shell [ pkgs.github-copilot-cli ];
        });
      packages = forAll (pkgs:
        let
          chanlunTs = contracts.packages.${pkgs.stdenv.hostPlatform.system}.chanlun-ts;
          marketTs = market.packages.${pkgs.stdenv.hostPlatform.system}.market-ts;
          # @qi/base and @qi/core, as qi-v2-ts's package holds them (@qi/base, @qi/core), with what core takes beside
          # them in its node_modules: smol-toml, Node's types (@types/node, undici-types) and Zod
          qiTs = qi-v2-ts.packages.${pkgs.stdenv.hostPlatform.system}.qi-v2-ts;
          # TradingView's Lightweight Charts (Apache-2.0; its LICENSE with it, its attribution shown on the chart):
          # npm's release, pinned by hash; the chart app inlines its standalone build into its pages
          lwc = pkgs.runCommand "lightweight-charts-5.2.1" {
            src = pkgs.fetchurl {
              url = "https://registry.npmjs.org/lightweight-charts/-/lightweight-charts-5.2.1.tgz";
              hash = "sha256-ZDECkimN9N1SdJSGXl2R1Ef4uzl7aN45EsKmRlAl7l4=";
            };
          } ''
            mkdir -p $out
            tar -xzf $src -C $out --strip-components=1 package/LICENSE package/dist/lightweight-charts.standalone.production.js
          '';
          # D3 and d3fc for the d3fc engine of the chart (dev/ts/lib/chart/engine/d3fc.ts): their browser bundles, d3fc's
          # reading the global d3; D3's licence (ISC), d3fc's package.json for its own (MIT, its tarball has no LICENSE)
          d3fc = pkgs.runCommand "d3fc-15.2.13" {
            d3 = pkgs.fetchurl {
              url = "https://registry.npmjs.org/d3/-/d3-7.9.0.tgz";
              hash = "sha256-fjZgVxCiulSEZ5fIxtiIkRNBshWuUyV9wypJoLgkNV4=";
            };
            fc = pkgs.fetchurl {
              url = "https://registry.npmjs.org/d3fc/-/d3fc-15.2.13.tgz";
              hash = "sha256-XR7XH3McvHw3nLbMpzaGhtIZOyfFGTFr1mPL3GmpOAc=";
            };
          } ''
            mkdir -p $out
            tar -xzf $d3 -O package/dist/d3.min.js > $out/d3.min.js
            tar -xzf $d3 -O package/LICENSE > $out/LICENSE.d3
            tar -xzf $fc -O package/build/d3fc.min.js > $out/d3fc.min.js
            tar -xzf $fc -O package/package.json > $out/package.d3fc.json
          '';
          # npm's packages the TypeScript takes, pinned by hash (no network)
          npm = name: version: hash: pkgs.fetchurl {
            url = "https://registry.npmjs.org/${name}/-/${name}-${version}.tgz";
            inherit hash;
          };
          zod = npm "zod" "4.1.12" "sha256-LvnXp9gisFnJvSH4fKpP3EgiDUNzU2eJhN+UL7Z7Q/o=";
        in {
          lightweight-charts = lwc;
          d3fc = d3fc;
          # @qi/chart, the 缠论 drawing library (dev/ts/lib/chart/README.md, how to take and use it, shipped as its
          # README.md), as source for a taker's Bun or TypeScript: a node_modules of @qi/chart, with its engines' browser
          # scripts built from their TypeScript, and of what it takes, @qi/chanlun (缠论's contract, the input contracts'),
          # @qi/market (the market data contract, the input market's),
          # @qi/base and @qi/core (qi-v2-ts's, the input qi-v2-ts's), @qi/indicator (this project's), zod (npm's,
          # pinned by hash), and smol-toml and Node's type definitions, which @qi/core takes (qi-v2-ts's, beside it in
          # its package); no tests. make qi-chart-package takes it as a taker does.
          qi-chart = pkgs.runCommand "qi-chart-2.0.1" { nativeBuildInputs = [ pkgs.bun ]; } ''
            export HOME=$TMPDIR
            m=$out/node_modules
            mkdir -p $m/@qi/indicator $m/@qi/chanlun $m/@qi/market $m/@qi/chart $m/zod $m/@types
            cp -r ${qiTs}/@qi/base ${qiTs}/@qi/core $m/@qi/
            cp -r ${qiTs}/node_modules/smol-toml ${qiTs}/node_modules/undici-types $m/
            cp -r ${qiTs}/node_modules/@types/node $m/@types/node
            cp -r ${./dev/ts/lib/indicator/src} $m/@qi/indicator/src
            cp ${./dev/ts/lib/indicator/package.json} $m/@qi/indicator/package.json
            cp -r ${chanlunTs}/node_modules/@qi/chanlun/. $m/@qi/chanlun/
            cp -r ${marketTs}/node_modules/@qi/market/. $m/@qi/market/
            cp -r ${./dev/ts/lib/chart/src} $m/@qi/chart/src
            cp -r ${./dev/ts/lib/chart/engine} $m/@qi/chart/engine
            chmod -R u+w $m/@qi/chart
            # the engines' browser scripts, built from their TypeScript (engine/*.ts) as the page takes them
            for e in tv d3fc; do
              (cd $m/@qi/chart && bun build engine/$e.ts --target=browser --format=iife --minify --outfile engine/$e.js)
            done
            cp ${./dev/ts/lib/chart/package.json} $m/@qi/chart/package.json
            tar -xzf ${zod} -C $m/zod --strip-components=1
            cp ${./dev/ts/lib/chart/README.md} $out/README.md
          '';
          # Charts: the chart app (dev/ts/app/chart, its README shipped in share/doc/chart) bundled by Bun into one
          # script, its npm packages pinned by hash (no network); Lightweight Charts, D3 and d3fc, both engines'
          # scripts and the palette given to it by the wrapper. It reads no lock: a taker gives it a set's file and
          # scale. make chart-package runs it.
          chart = pkgs.stdenv.mkDerivation {
            pname = "chart";
            version = "1.8.0";
            src = ./dev/ts;
            nativeBuildInputs = [ pkgs.bun ];
            buildPhase = ''
              export HOME=$TMPDIR
              rm -rf node_modules
              mkdir -p node_modules/@qi node_modules/zod
              tar -xzf ${zod} -C node_modules/zod --strip-components=1
              for p in chart indicator; do ln -s $PWD/lib/$p node_modules/@qi/$p; done
              # @qi/base and @qi/core, qi-v2-ts's, copied, so that they take the zod above; smol-toml, which core
              # takes, beside them in qi-v2-ts's package
              cp -r ${qiTs}/@qi/base ${qiTs}/@qi/core node_modules/@qi/
              cp -r ${qiTs}/node_modules/smol-toml node_modules/smol-toml
              # 缠论's contract copied, so that it takes the zod above
              cp -r ${chanlunTs}/node_modules/@qi/chanlun node_modules/@qi/chanlun
              cp -r ${marketTs}/node_modules/@qi/market node_modules/@qi/market
              bun build app/chart/src/edge/main.ts --target=bun --outfile main.js
              bun build app/chart/src/edge/settings.ts --target=bun --outfile settings.js
              bun build app/chart/src/edge/browser.ts --target=browser --format=iife --minify --outfile browser.js
              for e in tv d3fc; do bun build lib/chart/engine/$e.ts --target=browser --format=iife --minify --outfile $e.js; done
            '';
            installPhase = ''
              mkdir -p $out/bin $out/lib/chart $out/share/doc/chart
              cp main.js settings.js browser.js $out/lib/chart/
              cp tv.js d3fc.js app/chart/palette.json app/chart/chart.toml $out/lib/chart/
              cp app/chart/README.md $out/share/doc/chart/
              cp ${lwc}/LICENSE $out/share/doc/chart/LICENSE.lightweight-charts
              cp ${d3fc}/LICENSE.d3 $out/share/doc/chart/LICENSE.d3
              cp ${d3fc}/package.d3fc.json $out/share/doc/chart/package.d3fc.json
              cat > $out/bin/chart <<EOF
              #!${pkgs.bash}/bin/bash
              # the settings shipped first, so a --config given after them is the one taken
              exec ${pkgs.bun}/bin/bun $out/lib/chart/main.js --config $out/lib/chart/chart.toml "\$@" \\
                --bundle $out/lib/chart/browser.js \\
                --lib ${lwc}/dist/lightweight-charts.standalone.production.js --tv-engine $out/lib/chart/tv.js \\
                --palette $out/lib/chart/palette.json \\
                --d3 ${d3fc}/d3.min.js --fc ${d3fc}/d3fc.min.js --d3fc-engine $out/lib/chart/d3fc.js
              EOF
              chmod +x $out/bin/chart
              # every value of the settings, the defaults among them, as TOML: of the package's chart.toml, or of FILE
              cat > $out/bin/chart-settings <<EOF
              #!${pkgs.bash}/bin/bash
              exec ${pkgs.bun}/bin/bun $out/lib/chart/settings.js "\''${1:-$out/lib/chart/chart.toml}"
              EOF
              chmod +x $out/bin/chart-settings
            '';
          };
        });
      apps = forAll (pkgs: {
        # the chart app (dev/ts/app/chart/README.md): nix run <visualization>#chart -- DIR --results FILE --scale N …
        chart = { type = "app"; program = "${self.packages.${pkgs.stdenv.hostPlatform.system}.chart}/bin/chart"; };
      });
    };
}
