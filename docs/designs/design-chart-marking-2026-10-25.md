> Copied with `@qi/chart` and the chart app at version 1.8 (`docs/decisions.md`, 2026-10-28). It describes the code as copied, version 1.8. Version 2 is written here.

# @qi/chart: marking a chart (2026-10-25)

A chart drawn by `@qi/chart` (`design-chart-lib-2026-10-24.md`)
cannot carry text, and nothing can be added to it once it is drawn. Marking is a DSL of its own, beside the chart's,
with two ways in: given before the chart is drawn, or added to a chart already drawn (both are built).

## What does not change

The chart's DSL (`Engine<R>`, `dsl.ts`), the components (`component.ts`), the add-ons, the page data (`qi-chart/1`,
`qi-layers/1`, `qi-d3fc/1`) and the app. A chart with no marks is drawn as now.

## The marking DSL

In K-line positions and prices, as the chart's DSL; colours the palette's names.

| Primitive | What it draws |
|---|---|
| `text(at, text, anchor, style)` | `text` at the point `at`, beside it by `anchor`: above, below, left or right |
| `dot(at, style)` | a dot at the point `at` (the chart's `mark` is beside a K-line, at no price) |
| `line(from, to, style)` | a line between two points |
| `box(from, to, low, high, style)` | a box from the K-line `from` to `to`, `low` to `high` |

Its style: a colour, a size (text in pixels, a dot's radius), a width, dashed or not, a fill and its opacity.

Marks come in layers, each a key, a name, ticked at first or not, and its marks; each layer a box in the page's bar,
after the chart's own. The contract, `qi-marks/1`: one Zod schema in `src/marking.ts`, with test vectors.

## The two ways in

Each engine draws the marks by one function of its own; both ways call it.

- **Before**: the page gives its marks (`MARKS`, `qi-marks/1`) beside its input; the engine script draws them in
  the same pass as the chart, over its layers.
- **After**: once drawn, each engine script gives the page a handle, `mark(layer)` and `unmark(key)`, which adds or
  takes away a layer of marks on the chart as it stands; nothing else of the chart is drawn again.

| Engine | Text | After |
|---|---|---|
| tv (`engine/tv.ts`) | the canvas' `fillText`, in a primitive on the main graph's series | `attachPrimitive`, which takes a primitive on a chart already drawn and draws it with the series' scales, so it zooms and pans (checked in Lightweight Charts 5.2.1's source) |
| d3fc (`engine/d3fc.ts`) | the canvas' `fillText`, in the plot area's pass | the layer added to what that pass draws, then `render()` |
| tikz (`tikz.ts`) | a `\node` at the anchor, not measured (as its labels now) | none: a picture is made once; `tikzChart` takes the marks as an argument, optional, its callers unchanged |

The marks in view, of the layers ticked, are taken in by the price axis as the K-lines are (tv by the primitive's
`autoscaleInfo`, d3fc in its fit, tikz in the picture's range), so no mark falls outside the graph or on the volume.

The page's script decodes `MARKS` by the schema before handing it on; a caller of `mark` passes a layer decoded the
same way. The engine scripts trust what they are given, as they trust the description.

## A page's marks from a file

A file says what a picture marks (`test/data/marks.json`, the one the checks draw), nothing of its look: its levels
(a price, a text), points (a time, a price, a text), spans (from a time to a time, a band of prices, a text), gaps (a
band of prices no K-line entered, from the time it was made, a text) and moves (from a point to a point, a text);
times the data's, prices at its scale. The chart app's adapter
(`dev/ts/app/chart/src/marks.ts`) puts them on the run's K-lines by their times and gives their look: a level a dashed
line across with its text at the right end; a span a filled box; a gap a box in the palette's gap colour from its
K-line to the last, its text in it at its start; a point a dot, its text above it, below where it is
its K-line's low; a move a blue line; each a layer. `make chart … MARKS=FILE` (`--marks`): every engine draws them.

## The order

1. `src/marking.ts`: the schema, its test vectors. Done.
2. tv and d3fc: the drawing function, before and after; a test page with every primitive, looked at in both engines
   on the same view. Done (a text with a halo of the background's colour, to read over the candles).
3. tikz: the marks in the picture. Done (no halo: TikZ has no outline of a text without another package).

## Open

Whether anything uses the way in after, for now: the chart app uses the way in before only.
