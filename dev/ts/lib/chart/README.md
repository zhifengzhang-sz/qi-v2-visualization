# @qi/chart: a 缠论 drawing library, the flake package `qi-chart`

`@qi/chart` draws a K-line chart with its 缠论 structure (包含, 分型, 笔, 线段, 走势, 中枢, by level), the volume, the price
distribution (成交量分布) and a caller's indicators, in two engines for the browser, TradingView's Lightweight Charts and
D3/d3fc, and as a TikZ picture for a PDF. It takes its contracts (the components, each a Zod schema) and draws them; it
computes no structure: the caller gives it. It has two components: the batch, which draws a chart whole, and the online
one, which takes a chart one K-line at a time and gives each engine its change. Its design: this project's
`docs/designs/design-chart-lib-2026-10-24.md`; the chart app that uses it, its `dev/ts/app/chart`. This page is shipped
in the package as its `README.md`.

## Changes

- **2.0.1** (2026-11-08), its files, not its code (the tag `qi-chart-2.0.1`): `@qi/base` and `@qi/core` are
  `qi-v2-ts` 0.1.0's (the tag `qi-v2-ts-0.1.0`), the same code with their comments from their home, and with them
  smol-toml and Node's types, at the same versions; this page and the sources' comments name no other project but
  those they take.
- **2.0.0** (2026-11-08), version 2, online, the first release here (the tag `qi-chart-2.0.0`; this project's
  `docs/designs/design-chart-online-2026-11-08.md`): the online component: `online`, `complete`, `forming`, the tails
  `tvTail` and `d3fcTail` with `tvApplied` and `d3fcApplied`, and the page's handle `UPDATE` from both engines' scripts,
  for K线, 成交量 and add-ons drawing with series; the K-lines a caller gives are a contract's, 缠论's (`chanlun-1.1.0`) or
  the market data's (`@qi/market`, `market-1.1.0` of `qi-v2-contracts`), which `located` makes bars at the chart's
  scale, in place of the library's own plain bar (`barSchema` no longer exported; `XAxis` is the K-lines inside, as
  bars, and `KLines` a caller's); `drawing` takes the located components (`Bars`). The static charts' page data and
  pictures are 1.8.0's. `@qi/chanlun` is 缠论's contract, `chanlun-1.1.0` of `qi-v2-contracts` (its `SPEC.md`), in place
  of this project's: the same records and names, and with them `decodeRun`, `encodeRun`, `timeAt`, `runSchema` and
  `klinesSchema`; a 中枢's texts printable ASCII.
- **Copied** (qi-v2-visualization, 2026-10-28): `qi-chart` 1.8.0 and its unreleased changes, from the project where
  they were made, released here in 2.0.0 (above: `@qi/chanlun`, 缠论's contract). The entries below are that
  project's.
- **1.8.0** (2026-10-26), the cleanup: 缠论's contracts moved to `@qi/chanlun` (import them from there); the
  settings' schemas and defaults in `src/schemas.ts`; the engines' browser scripts built from TypeScript
  (`engine/tv.ts`, `engine/d3fc.ts`, `engine/shared.ts`) into `engine/tv.js` and `engine/d3fc.js`; the exports cut
  to what a taker uses, 155 names to 62 (`Using it`); the handles' types exported (`ChartUi`, `Marking`,
  `Pointer`). A price distribution the tv engine cannot place on its K-lines draws its rows again.
- **1.7.0** (2026-10-25): the first package: every value a setting, the page's controls as TradingView lays them out.

## What the package holds

Source, TypeScript, for a taker's Bun or TypeScript, as a `node_modules`:

| Module | What |
|---|---|
| `@qi/chart` | the library (`src/`) and the engines' browser scripts: their TypeScript (`engine/*.ts`) and, built from it, the scripts a page loads (`engine/tv.js`, `engine/d3fc.js`) |
| `@qi/chanlun` | 缠论's contract, `chanlun-1.1.0` (`qi-v2-contracts`, its `SPEC.md`, shipped as the package's): the K-line, the merged bar, 分型, the lines, 中枢, and a run's records as JSON |
| `@qi/market` | the market data contract, `market-1.1.0` (`qi-v2-contracts`, its `SPEC.md`): the K-line and the ongoing K-line, and their JSON (`decodeAs`, `decodeOngoingKLine`) |
| `@qi/base` | `Result`, `Task`, `pipe`, the errors (`qi-v2-ts` 0.1.0's, its `README.md`) |
| `@qi/core` | `decode` (a value through a Zod schema, as a `Result`), the settings' TOML (`qi-v2-ts` 0.1.0's) |
| `@qi/indicator` | `sma`, `ema`, `macd`, the price distribution (this project's) |
| `zod` 4.1.12 | npm's, pinned by hash |
| `smol-toml` 1.4.2; `@types/node` 24.3.0, `undici-types` 7.10.0 | what `@qi/core` takes, as `qi-v2-ts` 0.1.0's package holds them (Node's types for its file and log modules) |

The browser libraries the engines' scripts draw with are the flake's packages `lightweight-charts` (5.2.1, its
standalone build) and `d3fc` (D3 7.9.0 and d3fc 15.2.13, their browser bundles).

## Taking it

**1. The flake.** Pin this project's release in the taker's `flake.nix`, by its tag, read over HTTPS with no login:

```nix
inputs.visualization.url = "github:zhifengzhang-sz/qi-v2-visualization?ref=qi-chart-2.0.1";
```

The pin is the taker's `flake.lock`; another release is taken by its tag.

**2. The files.** The package's `node_modules` linked into the taker's, after the taker's own install (an install
may clear them), by a target such as:

```make
qi-chart: ## @qi/chart and what it takes, at flake.lock's pin, linked into node_modules
	p=$$(nix build --inputs-from . visualization#qi-chart --no-link --print-out-paths) && mkdir -p node_modules/@qi node_modules/@types && \
	for m in @qi/base @qi/core @qi/indicator @qi/chanlun @qi/market @qi/chart zod smol-toml @types/node undici-types; do rm -rf node_modules/$$m; ln -s $$p/node_modules/$$m node_modules/$$m; done
```

The links are read-only: a change is made in this project, never in the taker.

**3. TypeScript.** The sources import each other with their `.ts` extensions; the taker's `tsconfig.json` takes
them with `"moduleResolution": "Bundler"` and `"allowImportingTsExtensions": true` (and `"noEmit": true`); `strict`
and `exactOptionalPropertyTypes` are what they are checked with here. Bun runs them as they are.

## Using it

What `@qi/chart` exports (`src/index.ts`) is what a taker uses: the functions it calls (`tvChart`, `d3fcChart`,
`tikzChart`, `located`, `drawing`, `effective`, `marksOn`; `online`, `complete`, `forming`, `tvTail`, `d3fcTail`,
`tvApplied`, `d3fcApplied`), what it passes in and gets back with their schemas (the K-lines, the options, the marks,
each engine's page data), the handles' types, and the DSL an add-on or an engine of its own is written against. 缠论's
contracts are `@qi/chanlun`'s, the market data's `@qi/market`'s, imported from there.

**The components.** A chart is its components (`Components`, `src/drawing.ts`): its title, the prices' scale (a
price is held as a whole number, the price times it), its options, the x-axis (`xAxisSchema`, the K-lines in time
order, all of one contract: 缠论's K-lines, or the market data's, which `located` makes bars at the scale, a power of
ten from 1 to 1,000,000, each date a whole second, each price read exactly from its digits, a finer one refused), and
the 缠论 data on merged bars, by their numbers, each in its contract of `@qi/chanlun`: the merged bars
(`mergedBarSchema`), the 分型 (`fractalSchema`), the 笔 and 线段 (`strokeSchema`), the 走势 and 中枢 of every level
(`strokeSchema`, `centreSchema`); and the caller's add-ons (`addOn`). Each enters through its schema (`decode` of `@qi/core`); the
library checks that every merged bar a configuration names is one of them (`located`) before it draws.

**The descriptions.** `tvChart(c, shown)` gives the tv engine's page data (`chart`, `qi-chart/1`; `layers`,
`qi-layers/1`); `d3fcChart(c, shown)` the d3fc engine's (`qi-d3fc/1`); `tikzChart(c, options, shown, marks)` a TikZ
`standalone` document for XeLaTeX (`xeCJK`). `shown`: the levels shown at first, `"all"` or one. Each returns a
`Result`: a fault (a schema's, a merged bar not located) is a value.

**The options.** Every style and parameter of every component, and the layout (`optionsSchema`; every value with its
default: `effective`): each component's `show` (shown at first) and `detail` (shown only while fewer than the
layout's `fine` K-lines are in view), its style (colours as the palette's names, `cl-…`; widths; its parts each shown
or not), its parameters; the layout (the digits, `fine`, the margins, a subgraph's height, the levels' colours, the
dash, the labels' size, the room right of the last K-line).

**An add-on** (`addOn`, `src/addon.ts`): a component of the caller's, its `derive` (its data from the K-lines, as bars,
and its parameters) and its `draw` (that data as the primitives of the engine it is given, `Engine` in `src/dsl.ts`: a
box, a mark, a line, a series), on the main graph or in a subgraph of its own.

**The online component** (`src/online.ts`, `src/tails.ts`, `src/applied.ts`): a chart taken one K-line at a time,
appended or replacing the one still forming. `online(c)` starts from a chart's components as the batch takes them,
their K-lines the market data's, no 缠论 data, the add-ons drawing with series only; an `Online` is `components`, the
chart so far, and `forming`, the ongoing K-line drawn last, or none. `complete(o, k)` takes a K-line at the next index
(the forming one completed, or a new one appended); `forming(o, k)` an ongoing K-line at the next index (the forming
one replaced, its date the same and its `asOf` not before, or a new one appended as forming). Each gives a `Step`, the
chart after the K-line and `from`, the position it changed, or a fault (`OnlineError`: the index, the date, `asOf`, a
K-line the batch refuses, an add-on drawing more than series), the chart as it was. `tvTail(step)` and
`d3fcTail(step)` give the engine's change, the part of its page data the step changed, cut from the batch's page data
of the chart after it (K线's and 成交量's items from `from`, each add-on's whole); `tvApplied` and `d3fcApplied` the
page data with a tail applied, which is then the batch's of the K-lines. An update makes the batch's page data of every
K-line again: about 110 ms for 4,000 K-lines with MA and MACD in headless Chromium, 0.4 ms for 60.

**The two used together**, as a page that shows a market's K-lines as they come might use them (how a caller uses them
is its own):

```ts
import { complete, forming, online, tvChart, tvTail } from "@qi/chart";
import { decodeAs, decodeOngoingKLine, klineSchema } from "@qi/market";

// the batch first: the history drawn whole, its page data given to the page for engine/tv.js
const none = { merged: [], fractals: [], strokes: [], duan: [], zoushi: [], zhongshu: [] };
const c = { title, scale: 100, xAxis: history, ...none, addons };
// tvChart(c) → { chart, layers }: CHART and LAYERS, then engine/tv.js draws them and gives UPDATE
// then the online component, from the same components: each K-line as it comes, its change given to UPDATE
// online(c) → o; for an ongoing K-line's text: decodeOngoingKLine(text) → forming(o, k) → step;
// for a complete one's: decodeAs(klineSchema, text) → complete(o, k) → step; then UPDATE(tvTail(step)), o = step.online
```

**The page.** An engine's browser script draws its description in a page that gives it, as globals: `CHART` (and
`LAYERS` for tv), `PALETTE` (each palette name, its light and its dark colour, `#RRGGBB`), and optionally `MARKS`
(`qi-marks/1`, `src/marking.ts`: texts, dots, lines and boxes on the chart, decoded by `marksSchema` and checked against
the chart's K-lines by `marksOn`); and an element `#chart`. The tv page
loads Lightweight Charts' standalone build before `engine/tv.js`; the d3fc page, D3's and d3fc's bundles before
`engine/d3fc.js`. Each script then gives the page (their types: `ChartUi`, `Marking`, `Pointer`, exported):

- `CHART_UI`: the layers and their state, showing and hiding them, 成交量分布's choice, the view (all, the latest,
  the address of the view), the K-line under the pointer with each layer's values there, the panes' places: what a
  page's controls (a toolbar, a legend) are made on;
- `REDRAW()`: the chart drawn again from `CHART` (and `LAYERS`) as they are then, the view and the layers hidden kept;
- `MARKING.mark(layer)`, `MARKING.unmark(key)`: a layer of marks added to the chart as it stands, or taken away;
- `UPDATE(tail)`: an online step's change, its engine's tail, applied to the chart as drawn and to `CHART`, the view
  following the newest K-line only while it is in view (tv by Lightweight Charts' `update`, and drawn again whole when a
  chart of one K-line is given its second; d3fc drawn again from its data once a frame); the page's pointer callbacks
  kept.

The address (`#latest`, `#range=FROM-TO` by place, `#time=FROM-TO&off=…` by time) opens a page at those K-lines. The
chart app's pages (its `src/page.ts`, `src/edge/ui.ts`) are an example of a whole page: a toolbar, the legend on the
chart, the settings.

The package is checked as a taker takes it by this project's `make qi-chart-package`.
