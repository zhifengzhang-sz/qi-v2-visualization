// The DSL (docs/designs/design-chart-lib-2026-10-24.md, The DSL). Every component is drawn with six primitives:
// candle, box, mark, line, series and profile. Positions are K-line numbers on the x-axis and prices are real
// prices. An engine (tv, d3fc, tikz) is an `Engine<R>`: one function per primitive, each returning the engine's own
// thing R. A chart's `Drawing<R>` is those primitives in layers, which the page turns on and off. The margins, the
// legend entry and the look are schemas here because the engines' page data carry them.

import { z } from "zod";

// How a primitive looks: a palette colour, a width in pixels, solid or dashed, a mark's size; for a box, its fill
// (a palette colour at an opacity from 0 to 1) and whether it has a border (yes by default); for a series, its
// opacity (1 by default).
export type Style = {
  readonly colour: string;
  readonly width?: number;
  readonly dashed: boolean;
  readonly size?: number;
  readonly fill?: { readonly colour: string; readonly opacity: number };
  readonly border?: boolean;
  readonly opacity?: number;
};

// a point: a K-line number and a price
export type Point = { readonly at: number; readonly price: number };

// A price distribution: rows of height `step` starting at price `low`, each with its up and its down volume; `poc`
// is the point of control's row, `value` the value area's first and last rows.
export type Distribution = {
  readonly low: number;
  readonly step: number;
  readonly up: readonly number[];
  readonly down: readonly number[];
  readonly poc: number;
  readonly value: { readonly from: number; readonly to: number };
};

// How a distribution is drawn: up and down volume in their colours; the value area's rows at `opacity`, the other
// rows at half that; the longest row `share` of the graph's width.
export type DistributionStyle = {
  readonly up: string;
  readonly down: string;
  readonly opacity: number;
  readonly share: number;
};

// a value at K-line `at`, optionally in its own colour (a volume bar takes its candle's colour)
export type Value = { readonly at: number; readonly value: number; readonly colour?: string };

// space left at a pane's top and bottom, as shares of its height (top 0.75, bottom 0: the bottom quarter)
const share = z.number().min(0).max(1);
export const marginsSchema = z
  .object({ top: share, bottom: share })
  .strict()
  .readonly()
  .refine(
    (m) => m.top + m.bottom < 1,
    "margins leave some height between them: top and bottom below 1 together",
  );
export type Margins = z.output<typeof marginsSchema>;

// Where a series is drawn: pane 0 is the main graph, 1 and up the subgraphs under it. Without a band, on the pane's
// own scale; with a band, on its own scale inside that band, fitted to the values in view, with no axis.
export type Place = { readonly pane: number; readonly band?: Margins };

// a series' entry in the legend: its name, and how its value at the pointer is written, as a price (to the
// drawing's precision) or as a volume (K, M, B)
export const legendShape = { name: z.string().min(1), format: z.enum(["price", "volume"]) };
export const legendSchema = z.object(legendShape).strict().readonly();
export type Legend = z.output<typeof legendSchema>;

export type Engine<R> = {
  // a candle at K-line `at`: `up`'s colour if it closes at or above its open, else `down`'s
  readonly candle: (
    at: number,
    open: number,
    high: number,
    low: number,
    close: number,
    colours: { readonly up: string; readonly down: string },
  ) => R;
  // a box over K-lines `from` to `to`, from price `low` to `high`
  readonly box: (from: number, to: number, low: number, high: number, style: Style) => R;
  // a mark above or below K-line `at`, pointing at it
  readonly mark: (at: number, side: "above" | "below", shape: "arrow" | "circle", style: Style) => R;
  // a line between two points
  readonly line: (from: Point, to: Point, style: Style) => R;
  // values at K-lines, in time order, drawn as a line through them or as bars from 0, where `place` says; shown in
  // the legend if it has an entry
  readonly series: (
    values: readonly Value[],
    form: "line" | "bars",
    place: Place,
    style: Style,
    legend?: Legend,
  ) => R;
  // a price distribution over K-lines `from` to `to`, shown while the pointer is on one of them: its rows as bars
  // out from the price axis (as volume bars rise from the time axis), its K-lines outlined, the point of control a
  // line across them
  readonly profile: (from: number, to: number, d: Distribution, style: DistributionStyle) => R;
};

// A layer: primitives the page turns on and off together. `on`: ticked when the page opens. `fine`: shown only
// while fewer than the drawing's `fine` K-lines are in view.
export type Layer<R> = {
  readonly key: string;
  readonly name: string;
  readonly on: boolean;
  readonly fine: boolean;
  readonly parts: readonly R[];
};

// A level's group: its layers, with one switch of the level's colour for all of them.
export type Group<R> = {
  readonly level: number;
  readonly colour: string;
  readonly on: boolean;
  readonly layers: readonly Layer<R>[];
};

// A choice: at most one of these layers is shown, picked in a pull-down named `name`; none at first.
export type Choice<R> = { readonly name: string; readonly layers: readonly Layer<R>[] };

// the drawing's look outside its primitives: a dashed line's dash, the labels' size, and the space right of the
// last K-line
export const lookSchema = z
  .object({
    dash: z.tuple([z.number().positive(), z.number().positive()]).readonly(),
    font: z.number().positive(),
    offset: z.number().nonnegative(),
  })
  .strict()
  .readonly();
export type Look = z.output<typeof lookSchema>;

// A chart's drawing: the layers outside any level (K线, 成交量, add-ons), the groups by level, and the choice (the
// price distributions). `fine`: the K-lines in view below which fine layers show. `precision`: the digits of a
// price. `prices`: the space left above and below the K-lines in view, as shares of the main graph's height.
export type Drawing<R> = {
  readonly title: string;
  readonly fine: number;
  readonly precision: number;
  readonly prices: Margins;
  // a subgraph's height, a share of the main graph's
  readonly subgraph: number;
  // a dashed line's dash (on and off, pixels), the labels' size (pixels), the room right of the last K-line (K-lines)
  readonly look: Look;
  readonly apart: readonly Layer<R>[];
  readonly groups: readonly Group<R>[];
  readonly choice: Choice<R>;
};

// How a record is drawn from its confirmation (@qi/chanlun: a record's first K-line confirms its start): dashed while
// it is still going on, with no confirmEnd; solid once it has one.
export type Settled = "dashed" | "solid";
export const settled = (c: { readonly confirmEnd?: number | undefined }): Settled =>
  c.confirmEnd === undefined ? "dashed" : "solid";
