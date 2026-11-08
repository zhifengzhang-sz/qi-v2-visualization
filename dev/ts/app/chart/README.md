# chart: a chart of bars with its 缠论 structure

The chart app of qi-v2-visualization, the project's own tool and not a product (`PRODUCTS.md`), built as the flake
package and app `chart`. It takes a run of the published results, K-lines with their structure (包含, 分型, 笔, 线段,
走势 and 中枢, by level) by 缠论's contract, and draws it as pages, `chart.html` (TradingView's Lightweight Charts) and
`chart-d3fc.html` (D3 and d3fc), and, asked for, as a static picture (TikZ). It computes no structure; a CSV of bars
alone is drawn with none, and, asked for, as an online page, its last K-lines coming one at a time. Its design:
`docs/designs/design-chart-app-2026-10-24.md` and `docs/designs/design-chart-lib-2026-10-24.md`.

## Changes

- **Copied** (qi-v2-visualization, 2026-10-28): `chart` 1.8.0 and its unreleased changes below, from the project
  where it was made, its flake package named `chart`; the entries below are that project's.
- **Unreleased**: the structure only from the published results (`--results FILE --scale N`; `make chart SET=<set>`),
  decoded by the contract's `decodeRun`, in place of a program run on the bars and of a structure given; no Docker; a
  run of bars only (`--input` and `--request` alone; `make chart … CHANLUN=none`); a page's window (`--window
  FROM:TO|Ny|Nm`; `make chart … WINDOW=` or `LAST=`): the page given only that window's K-lines and the configurations
  inside it, the 缠论 structure still the whole run's (`src/window.ts`); the tv engine's conflation on; 缠论's records
  checked by `@qi/chanlun`, 缠论's contract (`chanlun-1.1.0` of `qi-v2-contracts`), in place of this project's; with
  `@qi/chart` 2.0.0 (this project's `docs/designs/design-chart-online-2026-11-08.md`): a run of bars given to the
  library as the market data's K-lines (`@qi/market`, `market-1.1.0`), the same bars and pages; an online page
  (`--online N`; `make chart … ONLINE=N`); with `@qi/chart` 2.0.1, `@qi/base` and `@qi/core` from `qi-v2-ts` 0.1.0.
- **1.8.0** (2026-10-26): with `@qi/chart` 1.8.0; the engines' scripts built from their TypeScript in the package;
  the page's handles' types taken from `@qi/chart`.
- **1.7.0** (2026-10-25): the package as first published.

## Run it

```
nix run <visualization>#chart -- DIR --results set.json --scale N [--title T] [--level all|0|1…]
nix run <visualization>#chart -- DIR --input bars.csv --request request.json [--title T] [--level all|0|1…]
nix run <visualization>#chart -- DIR [--title T] [--level all|0|1…]
```

Each form also takes `[--engine tv,d3fc,tikz] [--range all|FROM-TO] [--periods NAME=DIR,…] [--config FILE]
[--marks FILE] [--window FROM:TO|Ny|Nm]`, and the second `[--online N]`.

The structure comes only from the published results, the product `chanlun-results`. The package reads no lock: it is
given a set's file and its scale. In this project, `make results-fetch` takes the files `results.lock` names, by the
image's digest, with `crane`, and `make chart SET=<set>` finds a set's file and scale; the image is public, so that
needs no login, and no Docker.

- With `--results` and `--scale`, a run of the results is made into `DIR`: `run.json`, the file as it is, and
  `meta.json`. Then the pages.
- With `--input` and `--request`, a run of bars only: `in.csv` and `meta.json`, no structure, the bars the x-axis
  (`meta.json` says `"bars": true`, so its pages drawn again stay so). Then the pages.
- With `DIR` alone, the pages of a run made already.
- `--level`: the levels ticked at first, all or one.
- `--marks FILE`: a page's marks, a file of them (its levels, points, spans and moves, by the data's times;
  `src/marks.ts`), put on the run's K-lines and drawn by every engine, each a box of its own in the page; the static
  picture then of the K-lines the marks are of, where `--range` is not given.
- `--periods NAME=DIR,…`: the same bars at other periods, each a run of its own, `DIR` among them; each page gets a
  pull-down 周期 to the others.
- `--engine tv,d3fc,tikz`: the engines that draw, a list, each once; `tv,d3fc` where none is given. `tv` writes
  `chart.html`, `d3fc` `chart-d3fc.html`, `tikz` the static picture `DIR/chart.tex` (TikZ, for XeLaTeX with
  `xeCJK`), its size, most K-lines and theme the settings'; the layers as ticked at first, 成交量分布 left out.
  `xelatex chart.tex` makes its PDF.
- `--range all|FROM-TO`: the K-lines the picture draws, all or those from one position to another; all where none is
  given; refused without `tikz`.
- `--config FILE`: the settings (below); the package's `chart.toml` where none is given.
- `--online N`: an online page, of a run of bars alone, N fewer than its K-lines: all but its last N drawn whole by
  `@qi/chart`'s batch, then each of the N given to its online component, every quarter of a second, as the market
  data's records, ongoing K-lines that reach its values (its open, then its body, then the whole of it) and then the
  complete one, each change drawn by the engine (`UPDATE`); the page's settings drawn again on the K-lines so far.
  `REPLAY`, the replay's handle (pause, step, run, left, whole, cost, fault), for its check (`make
  chart-online-check`).

## The settings

A TOML file, how a run is shown, not what it is; the package ships `lib/chart/chart.toml`. Every value has its
default; a file gives only what differs. Every value, the defaults among them, in the file's form: the package's `bin/chart-settings [FILE]` (of
`chart.toml` where no file is given), or `make chart-settings` in this project.

- `[chart.KEY.style]`: a component's style, KEY one of `candles` (K线), `volume` (成交量), `merged` (包含), `fx`
  (分型), `bi` (笔), `duan` (线段), `zoushi` (走势), `zhongshu` (中枢), `profile` (成交量分布); its colours names of the
  palette, its widths in pixels, its opacities 0 to 1; `[chart.profile.params]`, the most rows of a distribution.
- `[chart.layout]`: `digits`, the digits a price is shown to (2; the prices are held exactly at the run's scale
  whatever it shows); `fine`, the K-lines in view below which 包含 and 分型 show; `above` and `below`, the main graph's
  height left over the K-lines; `subgraph`, a subgraph's height, a share of the main graph's; `levels`, the levels'
  colours.
- `averages`: the moving averages of the closes on the main graph, a list, each `{ params = { period }, style = {
  colour, width } }`, each period once; MA5, MA10, MA30 by default. A list given replaces the defaults whole; an
  average given no colour is `cl-ink`, no width 1.
- `[macd.params]`: `fast`, `slow`, `signal`, 12, 26, 9, the fast below the slow; `[macd.style]`: `diff`, `dea`, `up`,
  `down`, `width`.
- `[picture]`: `width` and `height` in centimetres, 24 by 14; `most`, the most K-lines a picture draws, 3,000; and
  `theme`, `dark` (a page on a screen; the default) or `light` (a print), the palette's colours
  it takes and its page's colour.

A key not known, a colour not in the palette, a period twice, or a value out of range is refused before the run is
made or anything drawn.

## Its input

`set.json`: a run of the results, the records of one run by 缠论's contract, decoded by the contract's own `decodeRun`:
a file it does not take stops the command, its fault named. A run holds no scale, source or title. `--scale` is the
power of ten its prices are held at, 1 to 1,000,000 (in this project, the set's `scale` in `results.lock`); the file's
name without `.json` is the page's source and its title where `--title` gives none.

`bars.csv`: `time,open,high,low,close` and optionally `volume`, one bar a line in time order; the time
`YYYY-MM-DD HH:MM`, `YYYY-MM-DD HH:MM:SS` or `YYYY-MM-DD`, a day of the calendar and a time of a day (2025-02-30 is
refused, not read as March 2), read as UTC and shown as it is; the prices decimals; the volume digits, with a decimal part or not (no sign, no exponent).

The package's `bin/chart` gives the engines' files itself (`--bundle`, `--lib`,
`--tv-engine`, `--d3`, `--fc`, `--d3fc-engine`, `--palette`); the app run on its own needs them for the engines listed.

`request.json`: `{"scale": N, "source": "…"}`. The scale is a power of ten, 1 to 1,000,000: a price is held as a
whole number at it, exactly; a price with more decimals than the scale holds is refused, never rounded. The source is
the bars' origin, written on the pages.

## The pages

The toolbar: 周期 (the same bars at other periods), 全部 and 最近, 成交量分布 (the price distribution of the 笔, 线段
or 中枢 under the pointer), 指标 (an average added), and the settings' gear. The legend on the chart, at each pane's top
left: the K-line under the pointer (else the last) with its prices; a line a layer (成交量, the averages; MACD in its
subgraph) in its colour with its values (where `DIR/history.csv` holds the closes before the first bar, `d,c` at the
scale, the averages start from them); a level's line, its 包含, 分型, 笔, 线段, 走势 and 中枢 turned on or off by a
click. On a line, on hover: show or hide it, its settings, an average's removal. In the address, `#latest`,
`#range=FROM-TO` (by place) and `#time=FROM-TO` (by time).

The settings: a dialog, a tab a component (and the layout, each average, MACD): 显示, whether it is shown at first,
then its parameters and its style, with a switch for each of its parts (包含's box and marks, 中枢's outer and inner
boxes, MACD's DIFF, DEA and bars); a change
draws the chart again from it (the view and the layers hidden kept), a value refused shows why; 默认值, 保存 (every
value as a settings file, `chart.toml`, for `--config`), 取消, 确定.

Each page carries its input, the components as read, the closes before the run, the scale, the title, the settings
and the levels ticked at first, and the app's script
(`src/edge/browser.ts`, bundled for the browser), which makes the engine's description in the browser by the functions
the command uses; the package's `bin/chart` gives it (`--bundle`), as it gives the engines' files. A page is of the
order of its set's size: about 2 MB for 4,000 minutes, 12 MB for three months of them.

The structure is drawn as the results give it, with one correction: the results date a line and a 中枢 by the last
K-line of a merged bar, and the chart puts each on the K-line that holds the merged bar's extreme. Where a 中枢 ends is
drawn as given.
