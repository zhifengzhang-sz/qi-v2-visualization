# qi-v2-visualization

`@qi/chart`, the 缠论 drawing library: K-lines with their 缠论 structure (包含, 分型, 笔, 线段, 走势, 中枢, by level),
the volume, the price distribution and a caller's indicators, drawn by two browser engines, TradingView's Lightweight
Charts and D3/d3fc, and as a TikZ picture. It draws what its caller gives it, records that conform to the contracts
`chanlun` and `market`, and computes no structure. Copied here at version 1.8; version 2, online (after start-up one
K-line at a time, appended or the forming one replaced, the K-lines and their structure given by its caller), is made
here and released whole as 2.0.0, the tag `qi-chart-2.0.0` (`docs/designs/design-chart-lib-2026-10-24.md`, Versions,
2); its latest release, 2.0.1, is in `PRODUCTS.md`.

The library is the project's one product. The chart app is the project's own tool: it draws the published results
with the library and knows nothing of what made them. What the project owns, gives and takes: `PRODUCTS.md`.

## Running it

```sh
nix develop                        # the tools (flake.nix)
make install                       # git's hooks, the kit, the agents' files
make ts                            # the TypeScript: lint, format, types, tests
make results-fetch                 # the results results.lock names, into .cache/results/
make chart SET=btcusdt-1m-test     # a set of the results drawn, opened
make chart-check                   # the chart on that set, every engine, checked in a browser
make help                          # every target
```

Nothing here needs a login: the flake's inputs are public repositories, read over HTTPS, and the results are a public
image on GHCR, read by `crane`; no Docker is needed. `@qi/base` and `@qi/core` are `qi-v2-ts`'s, the flake input
`qi-v2-ts` at its tag.

The state of the work: `docs/opening.md`, `docs/milestones.md`, `docs/decisions.md`, `docs/process.md`. The rules
for the agents that work on it: `agents/rules.md` (`AGENTS.md` and `CLAUDE.md` are generated from it by `make agents`).

## Layout

```
PRODUCTS.md                what it owns, gives and takes
flake.nix, flake.lock      the tools and the packages (nix develop; qi-chart the product, chart the app, lightweight-charts, d3fc)
results.lock               the results' image, by its digest, and each set's hash, size and scale
Makefile                   the targets, run in that shell
agents/                    the rules and roles of the agents that work here
dev/ts/                    the TypeScript: lib/{indicator,chart}, app/chart, STYLE.md, biome/
dev/scripts/               verify, locks-check, results, the browser check, the taker's check
dev/docs/lib.md            the libraries
docs/                      the state of the work; designs/ and research/, the chart's
test/data/                 the test data, public (its README)
```
