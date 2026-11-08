# qi-v2-visualization (README.md): make targets, run inside `nix develop` (flake.nix, docs/process.md), which gives every
# tool they call: Bun, Biome, Node, TeX, crane, git, gh, and the kit at dev/agents (make install); of the host, only
# what flake.nix's hostTools lets in (nix, for the packages and Chromium; wslpath and cmd.exe on WSL, xdg-open
# elsewhere, to open a page). Outside it, make stops.
ifneq ($(VISUALIZATION_SHELL),1)
$(error run make inside this project's shell: nix develop, then make …, or nix develop -c make … (docs/process.md))
endif
SHELL := $(shell command -v bash)
ifeq ($(SHELL),)
$(error no bash in this project's shell)
endif

S  := dev/scripts
PY := python3
AGENT_KIND ?= all

.PHONY: help install agents agents-check run-start run-check verify locks-check products-check results-fetch chanlun-link market-link qi-v2-ts-link ts chart chart-settings chart-page-check chart-check chart-browser-check chart-online-check chart-static chart-package qi-chart-package

help: ## the targets
	@grep -E '^[a-z-]+:.*##' $(MAKEFILE_LIST) | sed 's/:.*## /\t/' | expand -t 22

# ---------------------------------------------------------------- the project set up (docs/process.md, The machine)

install: ## the project set up on this machine: git's hooks at dev/hooks (the pre-commit runs make verify); the kit linked at dev/agents from flake.lock's pin, then make agents
	git config core.hooksPath dev/hooks
	nix build "$(KIT)" -o dev/agents
	$(MAKE) agents

# The kit at the commit flake.lock pins (nix build --inputs-from drops its ?dir=, so its reference is read from the lock).
KIT := $(shell $(PY) -c "import json; n = json.load(open('flake.lock'))['nodes']['kit']['locked']; print(f\"{n['type']}:{n['owner']}/{n['repo']}/{n['rev']}?dir={n['dir']}\")" 2>/dev/null)

agents: ## each kind's agent files from agents/ (AGENTS.md, CLAUDE.md, .claude/agents/, .github/agents/), by the kit at dev/agents; AGENT_KIND=claude-code|copilot|all; after any change to agents/
	@test -x dev/agents/bin/kit || { echo "agents: no kit at dev/agents: make install"; exit 1; }
	dev/agents/bin/kit generate --kind $(AGENT_KIND) --root .

agents-check: ## agents/ decoded by the kit, nothing written
	@test -x dev/agents/bin/kit || { echo "agents-check: no kit at dev/agents: make install"; exit 1; }
	dev/agents/bin/kit check --root .

run-start: ## before a role's run: the work tree recorded; make run-start ROLE=reviewer
	@test -x dev/agents/bin/kit || { echo "run-start: no kit at dev/agents: make install"; exit 1; }
	@test -n "$(ROLE)" || { echo "run-start: ROLE=<role> is needed"; exit 1; }
	dev/agents/bin/kit run-start --role $(ROLE) --root .

run-check: ## after it: what changed against the role's writes (none: nothing; brief-files: only FILES=a,b; else reported)
	@test -x dev/agents/bin/kit || { echo "run-check: no kit at dev/agents: make install"; exit 1; }
	@test -n "$(ROLE)" || { echo "run-check: ROLE=<role> is needed"; exit 1; }
	dev/agents/bin/kit run-check --role $(ROLE) $(if $(FILES),--files $(FILES)) --root .

verify: ## the checks a commit requires (dev/scripts/verify.py): the targets that check the staged paths; VERIFY=--all for every one; the pre-commit hook runs it
	$(PY) $(S)/verify.py $(VERIFY)

locks-check: ## whether each lock is outdated: flake.lock's inputs (the kit's kit locks), results.lock against its image's tags on GHCR (dev/scripts/locks-check.py); changes nothing
	@test -x dev/agents/bin/kit || { echo "locks-check: no kit at dev/agents: make install"; exit 1; }
	dev/agents/bin/kit locks --root .; a=$$?; $(PY) $(S)/locks-check.py; b=$$?; exit $$((a | b))

products-check: ## whether PRODUCTS.md states what the project has (the kit's kit products)
	@test -x dev/agents/bin/kit || { echo "products-check: no kit at dev/agents: make install"; exit 1; }
	dev/agents/bin/kit products --root .

# ---------------------------------------------------------------- the results (results.lock)

results-fetch: ## the files of the image results.lock names, taken by its digest with crane, into .cache/results/<tag>/, each checked against the lock's sha256 and size; a file there and right left alone; a wrong file stops it, with its name; the image is public: no login, and no Docker
	$(PY) $(S)/results.py fetch

# ---------------------------------------------------------------- the TypeScript (dev/ts/STYLE.md)

chanlun-link: ## 缠论's contract for TypeScript (@qi/chanlun, the flake input contracts) linked at dev/ts/node_modules/@qi/chanlun; make ts runs it after bun install
	@test -n "$$CHANLUN_TS" && test -d "$$CHANLUN_TS/node_modules/@qi/chanlun" || { echo "chanlun-link: no CHANLUN_TS: run it in nix develop"; exit 1; }
	rm -f dev/ts/lib/*/node_modules/@qi/chanlun dev/ts/app/*/node_modules/@qi/chanlun
	mkdir -p dev/ts/node_modules/@qi
	ln -sfn "$$CHANLUN_TS/node_modules/@qi/chanlun" dev/ts/node_modules/@qi/chanlun

market-link: ## the market data contract for TypeScript (@qi/market, the flake input market's package market-ts) linked at dev/ts/node_modules/@qi/market; make ts runs it after bun install
	@p=$$(nix build --inputs-from . market#market-ts --no-link --print-out-paths) && test -d "$$p/node_modules/@qi/market" || { echo "market-link: no market-ts from the flake input market"; exit 1; }; \
	rm -f dev/ts/lib/*/node_modules/@qi/market dev/ts/app/*/node_modules/@qi/market; \
	mkdir -p dev/ts/node_modules/@qi && ln -sfn "$$p/node_modules/@qi/market" dev/ts/node_modules/@qi/market

qi-v2-ts-link: ## @qi/base and @qi/core (qi-v2-ts's product, the flake input qi-v2-ts, its README.md) linked at dev/ts/node_modules/@qi/base and @qi/core, each to its folder in the package, so that core finds base, Zod and smol-toml there; make ts runs it after bun install
	@p=$$(nix build --inputs-from . qi-v2-ts#qi-v2-ts --no-link --print-out-paths) && test -d "$$p/@qi/base" -a -d "$$p/@qi/core" || { echo "qi-v2-ts-link: no qi-v2-ts from the flake input qi-v2-ts"; exit 1; }; \
	rm -f dev/ts/lib/*/node_modules/@qi/base dev/ts/lib/*/node_modules/@qi/core dev/ts/app/*/node_modules/@qi/base dev/ts/app/*/node_modules/@qi/core; \
	mkdir -p dev/ts/node_modules/@qi && for l in base core; do ln -sfn "$$p/@qi/$$l" dev/ts/node_modules/@qi/$$l; done

ts: ## the TypeScript of dev/ts/: its packages installed by bun at bun.lock's versions, the contracts linked (缠论's, the market data's) and @qi/base and @qi/core (qi-v2-ts's), then Biome (lint, format, the style's plugins and their proof), the types, the tests
	cd dev/ts && bun install
	$(MAKE) --no-print-directory chanlun-link
	$(MAKE) --no-print-directory market-link
	$(MAKE) --no-print-directory qi-v2-ts-link
	cd dev/ts && bun run check && bun run verify-style && bun run typecheck && bun run test

# ---------------------------------------------------------------- the chart (dev/ts/app/chart/README.md)

CHART_PALETTE := dev/ts/app/chart/palette.json
CHART_CONFIG := dev/ts/app/chart/chart.toml
comma := ,
CHART_ENGINES = $(subst $(comma), ,$(or $(ENGINE),tv$(comma)d3fc))
CHART_TIKZ = $(filter tikz,$(CHART_ENGINES))
CHART_OPEN = $(word 1,$(patsubst tv,chart.html,$(patsubst d3fc,chart-d3fc.html,$(patsubst tikz,chart.pdf,$(CHART_ENGINES)))))
CHART_CHECK := .reports/charts/chart-check
# the set the checks draw, 4,000 minutes of BTCUSDT
CHART_SET := btcusdt-1m-test

chart: ## a chart, by the chart app: SET=<set>, a set of results.lock, fetched (make results-fetch), its K-lines with their structure; or INPUT=bars.csv REQUEST=request.json CHANLUN=none, the bars alone (their form: dev/ts/app/chart/README.md, Its input); each [OUT=DIR, else .reports/charts/<SET or INPUT's name>-<LEVEL>] [TITLE=]; or DIR=, the pages of a run made. [ENGINE=tv,d3fc,tikz] [RANGE=all|FROM-TO, the picture's] [LEVEL=all|0|1…] [PERIODS=NAME=DIR,…] [CONFIG=FILE] [MARKS=FILE] [WINDOW=FROM:TO|LAST=Ny|Nm] [ONLINE=N, an online page of the bars alone: all but the last N drawn whole, then those N one at a time] [OPEN=0]
	@test "$(words $(if $(SET),set) $(if $(DIR),dir) $(if $(INPUT)$(REQUEST)$(CHANLUN),bars))" = 1 || { echo "chart: one of SET=<set> (make chart SET=$(CHART_SET)), INPUT= REQUEST= CHANLUN=none (the bars alone), DIR= (a run made)"; exit 1; }
	@test -z "$(INPUT)$(REQUEST)$(CHANLUN)" -o \( -n "$(INPUT)" -a -n "$(REQUEST)" -a "$(CHANLUN)" = none \) || { echo "chart: the bars alone are INPUT= REQUEST= CHANLUN=none; a structure comes only from a set, SET=<set>"; exit 1; }
	@for e in $(CHART_ENGINES); do case $$e in tv|d3fc|tikz) ;; *) echo "chart: ENGINE=$(ENGINE): $$e is not an engine (tv, d3fc, tikz)"; exit 1 ;; esac; done; \
	test "$(words $(CHART_ENGINES))" = "$(words $(sort $(CHART_ENGINES)))" || { echo "chart: ENGINE=$(ENGINE): each engine once"; exit 1; }
	@test -z "$(RANGE)" -o -n "$(CHART_TIKZ)" || { echo "chart: RANGE= is the picture's: give ENGINE= with tikz"; exit 1; }
	@if [ -n "$(DIR)" ]; then d=$(abspath $(DIR)); test -d $$d || { echo "chart: $$d is not a run"; exit 1; }; made=""; title=""; \
	elif [ -n "$(SET)" ]; then s=$$($(PY) $(S)/results.py set $(SET)) || exit 1; f=$${s% *}; \
	  d=$(abspath $(or $(OUT),.reports/charts/$(SET)-$(or $(LEVEL),all))); \
	  if [ "$${f#$$d/}" != "$$f" ]; then echo "chart: OUT=$(OUT) holds the set's file, and the run's folder is made again"; exit 1; fi; \
	  rm -rf $$d && mkdir -p $$d && made="--results $$f --scale $${s##* }"; title="$(TITLE)"; \
	else d=$(abspath $(or $(OUT),.reports/charts/$(basename $(notdir $(INPUT)))-$(or $(LEVEL),all))); \
	  rm -rf $$d && mkdir -p $$d && cp $(abspath $(INPUT)) $$d/input.csv && cp $(abspath $(REQUEST)) $$d/request.json && \
	  made="--input $$d/input.csv --request $$d/request.json"; title="$(or $(TITLE),$(notdir $(INPUT)))"; fi && \
	lwc=$$(nix build .#lightweight-charts --no-link --print-out-paths) && fc=$$(nix build .#d3fc --no-link --print-out-paths) && \
	mkdir -p $(CURDIR)/.reports/engine && \
	(cd dev/ts && bun build app/chart/src/edge/browser.ts --target=browser --format=iife --minify --outfile $(CURDIR)/.reports/chart-browser.js >/dev/null && \
	  for e in tv d3fc; do bun build lib/chart/engine/$$e.ts --target=browser --format=iife --minify --outfile $(CURDIR)/.reports/engine/$$e.js >/dev/null || exit 1; done) && \
	(cd dev/ts && bun app/chart/src/edge/main.ts $$d $$made $${title:+--title "$$title"} --bundle $(CURDIR)/.reports/chart-browser.js \
	  $(if $(ENGINE),--engine $(ENGINE)) $(if $(RANGE),--range $(RANGE)) \
	  --lib $$lwc/dist/lightweight-charts.standalone.production.js --tv-engine $(CURDIR)/.reports/engine/tv.js \
	  --palette $(CURDIR)/$(CHART_PALETTE) --config $(abspath $(or $(CONFIG),$(CHART_CONFIG))) --level $(or $(LEVEL),all) \
	  --d3 $$fc/d3.min.js --fc $$fc/d3fc.min.js --d3fc-engine $(CURDIR)/.reports/engine/d3fc.js \
	  $(if $(PERIODS),--periods "$(PERIODS)") $(if $(MARKS),--marks $(abspath $(MARKS))) $(if $(ONLINE),--online $(ONLINE)) $(if $(WINDOW),--window $(WINDOW),$(if $(LAST),--window $(LAST)))) && \
	$(if $(CHART_TIKZ),{ (cd $$d && xelatex -interaction=nonstopmode -halt-on-error chart.tex >/dev/null) || { echo "chart: XeLaTeX failed on $$d/chart.tex: $$d/chart.log"; exit 1; }; } && echo "chart: written $$d/chart.pdf" &&) \
	$(if $(filter 0,$(OPEN)),true,$(if $(WSL_DISTRO_NAME),cd /mnt/c && cmd.exe /c start "" "$$(cd $(CURDIR) && wslpath -w $$d/$(CHART_OPEN))",xdg-open $$d/$(CHART_OPEN)))

chart-settings: ## the chart app's settings, every value, the defaults among them, as TOML on stdout ([CONFIG=FILE])
	@cd dev/ts && bun app/chart/src/edge/settings.ts $(abspath $(or $(CONFIG),$(CHART_CONFIG)))

chart-page-check: ## each page of the runs in .reports/charts (or DIR=, one run), its own script run on its input as the browser runs it, its description against the command's (dev/ts/app/chart/src/edge/check-page.ts)
	@cd dev/ts && bun app/chart/src/edge/check-page.ts $$(ls $(if $(DIR),$(abspath $(DIR)),$(CURDIR)/.reports/charts/*)/chart.html $(if $(DIR),$(abspath $(DIR)),$(CURDIR)/.reports/charts/*)/chart-d3fc.html 2>/dev/null)

chart-check: ## make chart at all levels, at level 0 and at level 1, on the set btcusdt-1m-test (make results-fetch), not opened: each writes chart.html and chart-d3fc.html, all levels its static picture too, of the last 2,000 K-lines (chart.tex, chart.pdf by XeLaTeX), and the marks of test/data/marks.json by every engine; each page's own script against the command's description; the engines' scripts in headless Chromium (make chart-browser-check); the online page (make chart-online-check)
	@for l in all 0 1; do $(MAKE) -s chart SET=$(CHART_SET) OUT=$(CHART_CHECK)-$$l LEVEL=$$l OPEN=0 $$([ $$l = all ] && echo ENGINE=tv,d3fc,tikz RANGE=2000-3999 MARKS=test/data/marks.json) >/dev/null || exit 1; \
	  for f in chart.html chart-d3fc.html $$([ $$l = all ] && echo chart.tex chart.pdf); do test -s $(CHART_CHECK)-$$l/$$f || { echo "chart-check: no $$f at $$l"; exit 1; }; done; done; \
	cd dev/ts && bun app/chart/src/edge/check-page.ts $(foreach l,all 0 1,$(CURDIR)/$(CHART_CHECK)-$(l)/chart.html $(CURDIR)/$(CHART_CHECK)-$(l)/chart-d3fc.html) >/dev/null || { echo "chart-check: a page's own script gives another description: make chart-page-check"; exit 1; }; \
	$(MAKE) -C $(CURDIR) -s chart-browser-check DIR=$(CURDIR)/$(CHART_CHECK)-all >/dev/null || { echo "chart-check: the engines' scripts fail in the browser: make chart-browser-check"; exit 1; }; \
	$(MAKE) -C $(CURDIR) -s chart-online-check >/dev/null || { echo "chart-check: the online page fails in the browser: make chart-online-check"; exit 1; }; \
	echo "chart-check: all levels, level 0 and level 1 drawn, the static picture compiled; each page's own script gives the command's description; the engines' scripts checked in the browser; the online page checked in the browser"

chart-browser-check: ## the engines' browser scripts checked in headless Chromium (dev/scripts/chart-browser-check.ts): each page of the run DIR (chart-check's, all levels, where none is given) loaded with no exception, its legend whole
	@d=$(abspath $(or $(DIR),$(CHART_CHECK)-all)); test -s $$d/chart.html || { echo "chart-browser-check: no pages in $$d"; exit 1; }; \
	chromium=$$(nix build --inputs-from . nixpkgs#chromium --no-link --print-out-paths)/bin/chromium; profile=$$(mktemp -d); \
	$$chromium --headless=new --no-sandbox --disable-gpu --remote-debugging-port=9339 --user-data-dir=$$profile about:blank >/dev/null 2>&1 & pid=$$!; \
	bun $(S)/chart-browser-check.ts 9339 $$d/chart.html $$d/chart-d3fc.html; status=$$?; kill $$pid; rm -rf $$profile; exit $$status

CHART_ONLINE := .reports/online
chart-online-check: ## the online page in headless Chromium (docs/designs/design-chart-online-2026-11-08.md, How the release is checked, 3; dev/scripts/chart-online-check.ts): the test data's bars alone with its last 100 K-lines one at a time, and its first 60 begun with one, each beside the same bars drawn whole, in .reports/online/: each replay run to its end with no fault, its page data the batch's and the whole page's, its screenshot the whole page's at the latest K-lines; the view followed from the latest and held from the first 100; an update's cost
	@rm -rf $(CHART_ONLINE) && mkdir -p $(CHART_ONLINE) && head -61 test/data/BTCUSDT-1m.csv > $(CHART_ONLINE)/bars60.csv && \
	for r in "long test/data/BTCUSDT-1m.csv 100" "long-whole test/data/BTCUSDT-1m.csv" "short $(CHART_ONLINE)/bars60.csv 59" "short-whole $(CHART_ONLINE)/bars60.csv"; do set -- $$r; \
	  $(MAKE) -s chart INPUT=$$2 REQUEST=test/data/request.json CHANLUN=none OUT=$(CHART_ONLINE)/$$1 OPEN=0 $${3:+ONLINE=$$3} >/dev/null || { echo "chart-online-check: the run $$1 not drawn"; exit 1; }; done; \
	chromium=$$(nix build --inputs-from . nixpkgs#chromium --no-link --print-out-paths)/bin/chromium; profile=$$(mktemp -d); \
	$$chromium --headless=new --no-sandbox --disable-gpu --hide-scrollbars --remote-debugging-port=9341 --user-data-dir=$$profile about:blank >/dev/null 2>&1 & pid=$$!; sleep 2; \
	bun $(S)/chart-online-check.ts 9341 $(CURDIR)/$(CHART_ONLINE); status=$$?; kill $$pid; wait $$pid 2>/dev/null; rm -rf $$profile; exit $$status

CHART_STATIC := .reports/static
chart-static: ## the static charts byte for byte (docs/designs/design-chart-online-2026-11-08.md, How the release is checked, 2): every set of results.lock (make results-fetch) at all levels, level 0 and level 1, btcusdt-1m-test's picture and marks as chart-check's, and the test data's bars alone, into .reports/static/; each page's data and screenshot in headless Chromium (dev/scripts/chart-static.ts) and each picture, by sha256, against dev/scripts/chart-static.sha256; RECORD=1 writes that file instead
	@rm -rf $(CHART_STATIC) && mkdir -p $(CHART_STATIC) && \
	for s in $$($(PY) $(S)/results.py sets); do for l in all 0 1; do \
	  $(MAKE) -s chart SET=$$s OUT=$(CHART_STATIC)/$$s-$$l LEVEL=$$l OPEN=0 $$([ $$s = $(CHART_SET) ] && [ $$l = all ] && echo ENGINE=tv,d3fc,tikz RANGE=2000-3999 MARKS=test/data/marks.json) >/dev/null || { echo "chart-static: $$s at $$l not drawn"; exit 1; }; done; done; \
	$(MAKE) -s chart INPUT=test/data/BTCUSDT-1m.csv REQUEST=test/data/request.json CHANLUN=none OUT=$(CHART_STATIC)/bars OPEN=0 >/dev/null || { echo "chart-static: the bars alone not drawn"; exit 1; }; \
	chromium=$$(nix build --inputs-from . nixpkgs#chromium --no-link --print-out-paths)/bin/chromium; profile=$$(mktemp -d); \
	$$chromium --headless=new --no-sandbox --disable-gpu --hide-scrollbars --remote-debugging-port=9340 --user-data-dir=$$profile about:blank >/dev/null 2>&1 & pid=$$!; sleep 2; \
	bun $(S)/chart-static.ts 9340 $(CURDIR)/$(CHART_STATIC) $$(ls $(CURDIR)/$(CHART_STATIC)/*/chart.html $(CURDIR)/$(CHART_STATIC)/*/chart-d3fc.html) > $(CHART_STATIC)/pages.sha256; status=$$?; kill $$pid; rm -rf $$profile; \
	test $$status = 0 || { echo "chart-static: a page not drawn (above)"; exit 1; }; \
	(cd $(CHART_STATIC) && sha256sum */chart.tex) | cat - $(CHART_STATIC)/pages.sha256 | sort -k2 > $(CHART_STATIC)/sha256; \
	if [ "$(RECORD)" = 1 ]; then cp $(CHART_STATIC)/sha256 $(S)/chart-static.sha256 && echo "chart-static: $$(wc -l < $(S)/chart-static.sha256) hashes recorded in $(S)/chart-static.sha256"; \
	else diff $(S)/chart-static.sha256 $(CHART_STATIC)/sha256 >/dev/null || { echo "chart-static: differs from $(S)/chart-static.sha256:"; diff $(S)/chart-static.sha256 $(CHART_STATIC)/sha256 | grep '^[<>]' | head -20; exit 1; }; \
	echo "chart-static: $$(wc -l < $(CHART_STATIC)/sha256) hashes, the same as $(S)/chart-static.sha256"; fi

chart-package: ## the flake package chart (dev/ts/app/chart/README.md) built and run as a taker runs it: its bin/chart on the set btcusdt-1m-test (make results-fetch), the file and the scale on its command line, into .reports/chart-package/run/, then the same pages from that run made, then the test data's bars alone; its README in share/doc/chart; chart-settings every value
	@s=$$($(PY) $(S)/results.py set $(CHART_SET)) || exit 1; \
	out=$$(nix build .#chart --no-link --print-out-paths) && d=.reports/chart-package && rm -rf $$d && mkdir -p $$d && \
	$$out/bin/chart $$d/run --results $${s% *} --scale $${s##* } --title chart-package >/dev/null && \
	test -s $$d/run/chart.html && test -s $$d/run/chart-d3fc.html && test -s $$out/share/doc/chart/README.md && \
	mkdir $$d/again && cp $$d/run/run.json $$d/run/meta.json $$d/again/ && $$out/bin/chart $$d/again >/dev/null && \
	cmp -s $$d/again/chart.html $$d/run/chart.html && cmp -s $$d/again/chart-d3fc.html $$d/run/chart-d3fc.html && \
	$$out/bin/chart $$d/bars --input test/data/BTCUSDT-1m.csv --request test/data/request.json >/dev/null && \
	test -s $$d/bars/chart.html && test -s $$d/bars/chart-d3fc.html && \
	$$out/bin/chart-settings | grep -q '^\[picture\]' && \
	(cd dev/ts && bun app/chart/src/edge/check-page.ts $(CURDIR)/$$d/run/chart.html $(CURDIR)/$$d/run/chart-d3fc.html $(CURDIR)/$$d/bars/chart.html $(CURDIR)/$$d/bars/chart-d3fc.html >/dev/null) && \
	echo "chart-package: $$out built and run on the set $(CHART_SET), the same pages from the run made, the bars alone drawn, its README in share/doc/chart, chart-settings every value"

qi-chart-package: ## the flake package qi-chart (@qi/chart as source with what it takes, dev/ts/lib/chart/README.md) taken as a taker takes it: its node_modules linked into .reports/qi-chart-package/, a taker's script (dev/scripts/qi-chart-taker.ts) typechecked and run from it alone
	@out=$$(nix build .#qi-chart --no-link --print-out-paths) && d=.reports/qi-chart-package && rm -rf $$d && mkdir -p $$d/node_modules/@qi && \
	mkdir -p $$d/node_modules/@types && for m in @qi/base @qi/core @qi/indicator @qi/chanlun @qi/market @qi/chart zod smol-toml @types/node undici-types; do ln -s $$out/node_modules/$$m $$d/node_modules/$$m; done && \
	cp $(S)/qi-chart-taker.ts $$d/check.ts && \
	printf '%s\n' '{"compilerOptions":{"target":"ES2023","module":"ESNext","moduleResolution":"Bundler","allowImportingTsExtensions":true,"noEmit":true,"strict":true,"exactOptionalPropertyTypes":true,"noUncheckedIndexedAccess":true,"skipLibCheck":true,"types":[]},"files":["check.ts"]}' > $$d/tsconfig.json && \
	(cd $$d && $(CURDIR)/dev/ts/node_modules/.bin/tsc -p . && bun check.ts) && \
	test -s $$out/node_modules/@qi/chart/engine/tv.js && test -s $$out/node_modules/@qi/chart/engine/d3fc.js && test -s $$out/README.md && \
	echo "qi-chart-package: $$out taken as a taker takes it: typechecked and run from the package alone; its engines' scripts and README there"
