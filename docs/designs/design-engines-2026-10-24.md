> Copied with `@qi/chart` and the chart app at version 1.8 (`docs/decisions.md`, 2026-10-28). It describes the code as copied, version 1.8. Version 2 is written here.

# The engines: what implementing them taught (2026-10-24)

What stands now of the two engines of `@qi/chart` (`docs/designs/design-chart-lib-2026-10-24.md`, The engines), and what
was learnt making them: each library's rules, the faults found, and how a page is checked. Both draw one drawing, the
DSL's, so a difference between their pages is a fault of one of them.

Each engine's browser script is TypeScript (a cleanup of the library), `engine/tv.ts` and
`engine/d3fc.ts`, typed against what the page gives it (the page data's types, `src/description.ts`, `src/layers.ts`,
`src/d3fc.ts`, the marks', `src/marking.ts`) and against each library's own types (Lightweight Charts', `@types/d3`,
d3fc's), which are development packages only: the page loads the libraries themselves. What both do the same way is
written once, in `engine/shared.ts`: the palette's colours, the address, the layers' ids, the stamps and volume text,
the marks and the price distribution on a canvas, and the handles (`REDRAW`, `CHART_UI`, `MARKING`, their types
`src/handle.ts`). Each is bundled for the browser by `bun build` (`make chart`, into `.reports/engine/`; the flake's
`chart` and `qi-chart` packages); no built script is kept in git.

## tv: Lightweight Charts 5.2.1 (`src/tv.ts`, `engine/tv.ts`)

- **A series takes data in time order, no time twice** (its `setData`). The candles are such a series. Boxes and
  lines are not: two boxes of one 中枢 start at one K-line. So they are the description's two drawn kinds,
  `Boxes` and `Segments`, each a primitive attached to the first series of its pane (`attachPrimitive`), drawn on the
  chart's canvas by a pane view of its own. A drawn kind's times allow a time twice; the library's kinds' do not
  (`src/description.ts`).
- **A primitive places by the host series' K-lines**: a time to its place, the place to a pixel by
  `timeScale().logicalToCoordinate`, which maps places even off the screen.
- **A primitive's layer is its `zOrder`**: `bottom`, under the series and over the grid, for the boxes, so that a fill
  never covers a candle; `normal`, over them, for the lines.
- **Markers are one set on one series** (`createSeriesMarkers`): every shown layer's marks gathered, sorted by time, set
  again whenever a box is ticked or the view passes the fine limit (`subscribeVisibleLogicalRangeChange`).
- **K线 off is the candles made transparent, not removed**: they still set the price scale.
- **A colour with an opacity** is the palette's name and a per cent (`cl-center/8`), made `rgba` in the browser.
- **Each line its own colour**: a layer's segments once took one colour; 走势 up and down need two. Found by comparing
  the two engines' pages.
- **The view is in places**: `setVisibleLogicalRange`, `getVisibleLogicalRange`, `fitContent` for 全部.
- **A series on a scale of its own** is one with its own `priceScaleId`, its band the pane's `priceScales` margins
  for that id: an overlay scale, with no axis. The volume is one, at the main graph's foot.
- **Series are drawn in the order they are added**: the bars (a `Histogram`) go first, so the candles are over them.
- **Markers take room on the price scale**: the scale is fitted so that the markers above and below the bars fit too,
  so with 包含's marks shown the candles take a little less of the height than on the d3fc page. A difference not
  removed.
- **A price scale's labels run over the whole pane**, its margins included: a volume scale shown at the left is
  labelled up the whole height, above the bars too. So the volume has no axis, as TradingView's own: its value is read
  in the legend, from the crosshair's `seriesData` at the K-line under the pointer.
- **Many K-lines a pixel**: the histogram's faint bars overlap and darken; the d3fc page draws the tallest of each
  pixel instead. A difference not removed.
- **TradingView's attribution stays on the chart**, as its licence asks.
- **Speed**: the library draws on canvas; on the two-year SPY 1m page (194,490 K-lines) a headless Chromium run that
  opens it and takes a picture, without a GPU, takes about 2.3 s, the browser's start included. Its redraws have not
  been timed.

**Conflation** (`enableConflation`, on): zoomed out, Lightweight Charts merges bars thinner than half a pixel. On
SPY's 1-minute page (200,730 bars, headless Chromium, software rendering), a frame of the full view costs about 50 ms
with it and 330 without; crossing back to the latest 400 costs about 320 ms with it, 40 without, since switching the
merged level is one pass over the data. Its background precompute (`precomputeConflationOnInit`) changes neither, and
is off. Turning conflation on only for wide views costs the same pass at each switch.

## d3fc: D3 7.9.0 and d3fc 15.2.13 (`src/d3fc.ts`, `engine/d3fc.ts`)

- **The x-axis is the K-lines' places on a linear scale**, as Lightweight Charts' time scale: no gaps for nights. Its
  ticks are chosen by the engine (about eight in view, at whole multiples of their step, none near the edges), each
  labelled by its year, its date or its time as it changes from the tick before; the grid at the ticks and fainter at
  the quarters between.
- **A chart has three plot areas, stacked**: WebGL, canvas, SVG, in that order, the SVG on top, each of class
  `plot-area`. The zoom and the pointer go on the SVG one (`.svg-plot-area`): it is the one the events reach.
- **The canvas series is called with its context and scales** (`.context(ctx).xScale(x).yScale(y)`), the context
  already scaled to the device's pixels; a series is any function with those three.
- **A redraw happens on the next animation frame**, not when it is asked for: a click returns at once. Timing one
  means waiting two frames after it, in real time (with `--virtual-time-budget`, headless Chromium's clock does not
  measure work).
- **SVG does not carry a long series.** Measured on the two-year SPY 1m page, headless, no GPU: 403,602 SVG elements
  with every K-line in view, a redraw 2.3 to 2.5 s; with the last 400 K-lines, 1,135 elements and still 0.43 to 0.56 s,
  because every redraw went through every layer's shapes (copied and filtered them to find those in view), copied the
  K-lines again to fit the price axis, and every move of the pointer copied them to find the one under it.
- **So**: everything found by its place, never by going through the series. A K-line's candle by its position; each
  layer's shapes of a kind sorted by where they start, with the longest one's length, so those in view lie between two
  binary searches. The shapes on the canvas plot area, in order: the grid, the boxes, the series' bars, the
  candles (one path a colour), the lines, the series' lines, the marks. With fewer than 1.5 pixels a K-line, the candles condensed to one bar a pixel, its high to its
  low, in a rise's or a fall's colour by its first open and last close. On the SVG plot area only the last close's
  line and tag (measured by the browser, `getBBox`) and the crosshair. After: 48 to 63 SVG elements, a redraw 36 ms
  with every K-line in view and 10 to 27 ms with the last 400.
- **A series is found by its place too**: its points in order of x, those in view between two binary searches; its
  own scale fitted to its values in view, within its band; its bars a K-line's room less a pixel, as Lightweight
  Charts' histogram, and the tallest of each pixel when condensed. Its extremes by `d3.max`, never `Math.max(...)`,
  whose arguments a long series exceeds. With the volume, a redraw of the two-year 1m page with every K-line in view
  39 to 43 ms, 24 to 27 ms without it.
- **The crosshair's price** in a tag at the right of the SVG plot area, measured as the last close's.
- **The look is set by the engine**: axes and their text in the palette's muted colour (a style sheet of the page),
  the price axis fitted to the K-lines in view, a twentieth spare.
- **One script, one scope**: a second `const range` stopped the whole engine from loading. `node --check` on an engine
  before a page is made.

## Both

- **The same handle, from each engine's script** (`CHART_UI`, since 2026-10-25): the layers and their state, the fine
  limit, the values under the pointer, 全部 and 最近, the address (`#latest`, `#range=`, `#time=…&off=…`), the panes'
  places; the page's controls are the app's (`dev/ts/app/chart/src/edge/ui.ts`), one for both. The parts they share
  (`places`, the volume's format) are written in each: an engine is one script of its page, with no module to
  import.
- **A box's id across pages** is its name, a level's after its level (`1:中枢`): the ids of another period's page are
  the same, its levels perhaps not.
- **Checked in a browser, every time** (`make chart-browser-check`, in `make chart-check`; the review, 2026-10-25):
  each page of a run loaded in headless Chromium over the DevTools protocol, with no exception; its legend whole; a
  layer and a layer of marks hidden through a redraw; a setting changed in its dialog; the two pages of a run the
  same layers; a click's cost reported (`dev/scripts/chart-browser-check.ts`).
- **How a page is checked by eye**: made by `make chart`, looked at in headless Chromium
  (`nix shell --inputs-from . nixpkgs#chromium`), both engines on the same view; the controls by a copy of the page
  with a script that ticks a box, picks a 周期, turns the wheel or moves the pointer, the copy removed after; speed by
  the two-frame timing above, read through the DevTools protocol (`--remote-debugging-port`, a script that waits for
  the page's result); the crosshair and the legend by the pointer moved through that protocol
  (`Input.dispatchMouseEvent`, then `Page.captureScreenshot`, which takes the viewport only). Unit tests cover each drawing through an engine of text and each engine's description;
  the browser scripts have none.
