> Copied with `@qi/chart` and the chart app at version 1.8 (`docs/decisions.md`, 2026-10-28). It describes the code as copied, version 1.8. Version 2 is written here.

# Price distribution (volume by price): research notes, 2026-10-24

Sources and how read: [READ] = page or file read; [SUMMARY] = search-result summary only, page not read; [INFER] = my inference.
- TradingView help, Volume Profile Fixed Range: https://www.tradingview.com/support/solutions/43000502040/ [READ, through a fetch tool that summarises]
- /home/zzhang/dev/chart/lightweight-charts/plugin-examples/src/plugins/volume-profile/volume-profile.ts and example/example.ts [READ, all files]
- npm packages: `npm view` metadata and `npm pack` source, grepped [READ]
- TradingView community scripts (ApexFlow fixed-range VP, Position Cost Distribution CYQ), luxalgo library pages, CSDN CM() article, d3fc docs [SUMMARY unless noted]

## Summary, one line per question
1. Methods: TradingView builds the profile from lower-timeframe bars of the same symbol (1m bars for a daily session), rows set by the user, up/down by close>=open, POC = fullest row, 70% value area grown from the POC; with only our bars the usual substitute is spreading each bar's volume over its high-low by row overlap. 筹码分布 needs turnover (volume / float shares), which we lack; a turnover-free variant is not established (see 1c, [INFER]).
2. Packages: only `technicalindicators` has a volume profile, and it is a crude bucket-membership count (not 1a); none has chip distribution.
3. Display: Lightweight Charts' example is a series primitive whose pane view converts row prices to y with `priceToCoordinate`, and draws rows as horizontal rectangles from an x anchor, width scaled to the largest row; in d3fc it is a horizontal bar series (orient) on the shared y scale.
4. Mouse-following: no tool example found; computing is cheap enough per pointer move up to ~100,000 bars if done per item once (precompute) or by prefix sums with a bar-count x row-count table [INFER].

## 1a Volume profile (TradingView)
- Lower timeframe: "Volume profile indicators are calculated using data from lower timeframes for the same symbol"; a daily profile uses that session's 1-minute bars; the lower timeframe depends on the indicator (help page [READ]).
- Rows: the number of rows is a user input; the page gives no formula for row height. A "Ticks per row" layout exists in the indicator inputs: not covered by the page, not established.
- Up/down: close >= open is up volume, otherwise down (this is per bar, up/down not buy/sell) [READ].
- POC: the row with the highest total volume [READ].
- Value area: target = 70% (default) of total; start at the POC; compare the next row above and below, add the larger; continue until the target is reached; ties go to the row nearer the POC, then above; VAH/VAL are the top/bottom included rows [READ]. Note the help page says "do not exceed the remaining target, else stop", which differs from the CME two-rows-at-a-time rule (below).
- Not established: how TradingView spreads one lower-timeframe bar's volume over rows (at close, typical price, or high-low). The page does not say.
- Community scripts, for the choices a script makes [SUMMARY]: ApexFlow fixed-range VP (default 24 rows) offers overlap-weighted spreading over high-low, and a fast mode putting the whole volume at (H+L+C)/3; its value area is said to follow the CME standard. Another script spreads evenly across the bins the range covers.
- Plain recipe for our data [INFER]: row height h = (max high - min low)/R, or a fixed tick; for each bar, volume * overlap(bar [low,high], row)/(high-low) into each row (a bar with high==low goes whole to its row); up/down by close>=open; POC = argmax; value area by the TradingView steps above.

## 1b Market profile / TPO
[SUMMARY/background, not read from a source this run] Market Profile counts time, not volume: each price row gets one letter (TPO) for each 30-minute period in which price traded there; the shape is built from TPO counts, with the value area (70%) and POC (most TPOs) defined the same way. It needs no volume. A d3fc market-profile example exists: https://blog.scottlogic.com/2017/08/23/market-profile.html [SUMMARY]. From our bars a TPO count can be made by counting, per row, the bars (or periods of N bars) whose high-low touches it [INFER].

## 1c 筹码分布 (CYQ)
- Idea (TradingView CYQ script "Position Cost Distribution", https://www.tradingview.com/script/25py1UVB-Position-Cost-Distribution/ [READ via fetch summary]): start with all shares in the first bar's price range; each session, turnover = volume / total outstanding shares; every price bucket loses shares in proportion to the turnover; the day's volume is added over the bar's range. It states each share has equal probability of being exchanged, and notes a lower chance for long-held shares as a possible improvement. The script does not use triangular spreading or decay.
- Tonghuashun CM() cost-distribution function (CSDN, https://gitcode.csdn.net/6aa0d6521a35784c842057c5.html [READ via fetch summary]): parameters include days, daily cost algorithm (0 uniform, 1 triangular), precision, turnover setting, volume or amount basis, price limits, and a historical turnover decay coefficient (default 1, range 0.1 to 10; the article gives it as 1/(1 - top-10 float holders' ratio)). The article does not give the triangular formula (conventionally the peak at the typical or close price, falling to zero at high and low: [INFER], not sourced). 通达信 and 东方财富 formulas not read; not established.
- Needs that we lack: float shares (to get turnover = volume / float). Without it, the decay term cannot be set.
- Turnover-free variant [INFER]: no source found. One could take a decay constant per bar (e.g. decay = volume / sum of volume over the last K bars) so that the old distribution fades as volume flows; this is a design choice, not CYQ. Inside a 笔/线段/中枢 span, plain volume by price (1a) is the honest equivalent.

## 1d Finer bars inside coarser bar vs spreading within high-low
- Sources (luxalgo library pages and TradingView scripts, vendor descriptions) [SUMMARY]: whole-volume-at-one-price is described as imprecise for POC and volume nodes; high-low spreading is better; lower-timeframe reconstruction is presented as the most accurate, its accuracy depending on the sub-bar resolution. No independent study quantifying the error was found; the accuracy claims are unverified marketing.
- [INFER] Intrabar reconstruction places each sub-bar's volume in its own range, so volume follows where price actually spent time; spreading a 5m bar's high-low assumes uniform volume over the range, which misplaces volume when it concentrates (e.g. near the close). The error shrinks with finer bars and cannot be checked without tick data. With our data: when 1m bars of the same days exist, use them for 5m...1d spans; the sub-bar still uses uniform spreading.

## 2 Packages (npm, read 2026-10-24)
- `technicalindicators` 3.1.0, MIT, last release 2023-07-12: has `VolumeProfile` (lib/volume/VolumeProfile.js, [READ]). Method: `noOfBars` equal rows between the overall min and max; a bar's whole volume is added to every row that its [low,high] touches (a membership test, not overlap-weighted, so a bar's volume is counted in full in each row: the sum of rows exceeds total volume); bullish/bearish by open vs close (open>close is bearish, else bullish). No POC or value area. Not what 1a describes.
- `trading-signals` 8.3.0, MIT, 2026-08-11: volume indicators AD, ADOSC, CMF, EMV, FI, KVO, MARKETFI, NVI, PVI, PVO, PVT, RVOL, VROC, VWMA, WAD; no volume profile [READ dir listing + grep].
- `indicatorts` 2.2.2, MIT-licensed field not read (npm view gave no licence line); 2026-09-01: grep for volume profile or chip found nothing [READ grep].
- `tulind` 0.8.20, LGPL-3.0, 2022-06-27; `talib` 2.0.6 (node binding), LGPL-3.0-or-later, 2026-10-06; `talib-binding` 1.0.2, MIT, 2022-05-19: TA-Lib and Tulip have no volume profile or chip distribution (grep of the npm sources found no such function; TA-Lib's own function list not read) .
- Plainly: none provides 1a (POC, value area, overlap-weighted rows) or chip distribution. We write it (a small pure function).

## 3a Lightweight Charts v5 plugin (volume-profile.ts, 198 lines)
- It computes no rows: it takes `VolumeProfileData` {time, profile: [{price, vol}], width (in bars)} ready-made; the example (example.ts:15-26) makes 15 rows at a fixed price step with random volumes. Row computation is ours.
- Primitive: `VolumeProfile implements ISeriesPrimitive<Time>`, attached with `series.attachPrimitive(vp)` (example.ts:28); one pane view, `updateAllViews` calls `update()` (lines 105-129).
- Coordinates: x anchor = `timeScale.timeToCoordinate(data.time)` (the profile grows rightward from that bar); max width = `barSpacing * data.width` (so its width is in bar units and scales with zoom); row y = `series.priceToCoordinate(row.price)`; column height = `max(1, y(profile[0].price) - y(profile[1].price))` (uses the first two rows only, so rows must be evenly spaced and ascending); row width = maxWidth * vol / maxVol (linear, longest row = full width).
- Drawing: the renderer uses `target.useBitmapCoordinateSpace`, `positionsBox` (helper from ../../helpers/dimensions/positions) for pixel-aligned boxes; a translucent blue background box over the whole profile (rgba(0,0,255,0.2)), then one fillRect per row (rgba(80,80,255,0.8)), height minus 2 px as a gap (lines 62-89).
- `autoscaleInfo` adds the profile's min/max price to the autoscale when the anchor is in the visible logical range (lines 173-193).
- Not in it: up/down colours, POC, value area, right anchoring, price-axis anchoring. Every row's x starts at the anchor (left-aligned bars growing right). To anchor right, one would draw from x_right leftward [INFER].

## 3b D3/d3fc canvas
- d3fc-series gives SVG, canvas and WebGL versions of each series with an `orient` property, most supporting horizontal rendering; canvas decorate callbacks run with the origin translated to each data point (https://unpkg.com/@d3fc/d3fc-series@6.1.0/README.md, https://blog.scottlogic.com/2017/08/23/market-profile.html) [SUMMARY]. Usual approach [INFER]: a horizontal bar series with y = price scale (shared with candles), x = a linear scale from 0..maxVolume to 0..width in pixels, bar height = the y-distance of a row; stacked (up on top of down) for the split; draw it in the same canvas pass as the candles.

## 3c TradingView's look (help page [READ])
- Rows placed left or right; width is a percentage of the box and the longest row scales to it; the others proportionally.
- Separate colour and opacity for up volume, down volume, value-area up, value-area down, and the box background (box not for visible range); VAH and VAL lines switchable; developing POC and developing VA switchable. The POC line's drawing is not described on the page; the value area is shown by the VA colours on the rows inside it.

## 4 Following the mouse
- No example of a charting tool following the pointer for a profile was found (searches returned nothing); not established. Our own design [INFER]:
  - Per item (笔, 线段, 中枢): spans are known and few; precompute the profile once per item for the chosen row grid, and on pointer move only look up the item; cost near zero.
  - Free spans of up to 100,000 bars: direct is O(bars in span) for the bar loop + O(rows). If a bar covers only a few rows, 100,000 bars x ~5 rows is ~0.5M adds, a few ms in JS; recompute per pointer move is feasible, throttled to one per frame.
  - Prefix sums by row: if all spans use one fixed row grid for the whole data, P[r][i] = cumulative volume of row r up to bar i; a span's profile is P[r][b]-P[r][a] for each row, O(rows), regardless of span length. Memory = rows x bars (200 rows x 100,000 = 20M numbers, 80 MB as Float32): too large for a day-by-day grid; fine if rows are coarse or if only the row range for a span is stored sparsely. The fixed grid conflicts with a per-span range (TradingView sets rows over the span's own range); a fixed tick (ticks per row) matches the prefix scheme.
  - Value area and POC from the finished row array: O(rows).
- Measured nothing; these costs are estimates.

## Not established
- How TradingView assigns a lower-timeframe bar's volume to rows; the default row layout/size; how it draws the POC line.
- The triangular-distribution formula and the exact 通达信/东方财富 decay; any turnover-free CYQ.
- An independent error measurement for intrabar vs high-low spreading.
- Pointer-following examples; Market Profile (1b) sourced only from background and one blog link not read.
- The `indicatorts` licence line; TA-Lib's own function list.
