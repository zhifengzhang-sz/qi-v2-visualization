# qi-v2-visualization

`@qi/chart`, the 缠论 drawing library: K-lines with their 缠论 structure (包含, 分型, 笔, 线段, 走势, 中枢, by level),
the volume, the price distribution and a caller's indicators, drawn by two browser engines, TradingView's Lightweight
Charts and D3/d3fc, and as a TikZ picture. It draws what its caller gives it, records that conform to the contracts
`market` (the K-lines) and `chanlun` (a run of their structure, beside them), and computes no structure. Copied here at
version 1.8; version 2, online (after start-up one K-line at a time, appended or the forming one replaced), made here
and released whole as 2.0.0, its tag `qi-chart-2.0.0` of this repository's earlier history, which it does not hold, and
again as 2.0.1, where this history begins; version 3, the structure on `chanlun` 3.1.0
(`docs/designs/design-chart-lib-2026-10-24.md`, Versions). Its latest release is in `PRODUCTS.md`.

The library is the project's one product. The chart app is the project's own tool: it draws a run of bars with the
library, and a run of 缠论's contract given beside them, and knows nothing of what made them. What the project owns,
gives and takes: `PRODUCTS.md`. Licensed under the Apache License 2.0 (`LICENSE`).

## Running it

```sh
nix develop                        # the tools (flake.nix)
make install                       # git's hooks, the kit, the agents' files
make ts                            # the TypeScript: lint, format, types, tests
make chart INPUT=test/data/BTCUSDT-1m.csv REQUEST=test/data/request.json   # the test data's bars drawn, opened
make vectors                       # the contract's vectors in the app's input form, into .reports/vectors/
make chart INPUT=.reports/vectors/bars.csv REQUEST=.reports/vectors/request.json RUN=.reports/vectors/run.json
make check                         # every check: the TypeScript, the charts in a browser, the packages
make help                          # every target
```

Nothing here needs a login: the flake's inputs are public repositories, read over HTTPS. The contracts are
`qi-v2-contracts`'s, the flake inputs `contracts` (`chanlun`) and `market` at their tags, with their vectors; `@qi/base`
and `@qi/core` are `qi-v2-ts`'s, the flake input `qi-v2-ts` at its tag.

The state of the work: `docs/opening.md`, `docs/milestones.md`, `docs/decisions.md`, `docs/process.md`. The rules
for the agents that work on it: `agents/rules.md` (`AGENTS.md` and `CLAUDE.md` are generated from it by `make agents`).

## Layout

```
PRODUCTS.md                what it owns, gives and takes
flake.nix, flake.lock      the tools and the packages (nix develop; qi-chart the product, chart the app, lightweight-charts, d3fc)
Makefile                   the targets, run in that shell
agents/                    the rules and roles of the agents that work here
dev/ts/                    the TypeScript: lib/{indicator,chart}, app/chart, STYLE.md, biome/
dev/scripts/               verify, the vectors, the browser checks, the static charts, the taker's check
dev/docs/lib.md            the libraries
docs/                      the state of the work; designs/ and research/, the chart's
test/data/                 the test data, public (its README)
```
