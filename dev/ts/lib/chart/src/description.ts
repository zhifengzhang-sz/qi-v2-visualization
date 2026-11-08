// The tv page's chart, qi-chart/1 (docs/designs/design-chart-lib-2026-10-24.md, The engines): the chart as Lightweight Charts 5
// builds it, in its own names, written as a value instead of calls. The series are one list, each with its
// `paneIndex` (as in `chart.addSeries(type, options, paneIndex)`), its data as `series.setData` takes it, its markers
// as `createSeriesMarkers` takes them, and its price lines as `series.createPriceLine` does; each pane has its price
// scales by id.
//
// Three additions to Lightweight Charts' names: a colour may be a palette name (`cl-up`), which the engine resolves
// so the chart follows the reader's light or dark theme; each series has an id, by which the page shows or hides it;
// and three kinds that Lightweight Charts has only as primitives are written as series: `Segments` (lines from point
// to point: 笔, 线段, 走势), `Boxes` (from a time to a time between two prices: 中枢, 包含's merged bars) and
// `Profiles` (price distributions). tv.ts makes it; the tv engine (engine/tv.ts) draws it.

import { z } from "zod";
import { lookSchema, marginsSchema } from "./dsl.ts";

// a bar's time: seconds since 1970, read as UTC (Lightweight Charts' UTCTimestamp)
const time = z.number().int().nonnegative();
const price = z.number().finite();
// A colour: #rgb, #rrggbb, #rrggbbaa, rgb(r, g, b) or rgba(r, g, b, a) (r, g, b from 0 to 255, a from 0 to 1), or a
// palette name (cl-…), optionally at an opacity in per cent after a slash (cl-center/8). The patterns avoid `.`, `\s`
// and `\d`, whose meaning differs between the languages that read the contract (dev/docs/lib.md, Contracts).
const byte = "(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])";
const rgb = `${byte} *, *${byte} *, *${byte}`;
const alpha = "(0|1|0?[.][0-9]+|1[.]0+)";
const colour = z
  .string()
  .regex(
    new RegExp(
      `^(#[0-9A-Fa-f]{3}|#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{8}|rgb\\( *${rgb} *\\)|rgba\\( *${rgb} *, *${alpha} *\\)|cl-[a-z0-9-]+(/(100|[1-9]?[0-9]))?)$`,
    ),
  );
// LineStyle: 0 solid, 1 dotted, 2 dashed, 3 large dashed, 4 sparse dotted
const lineStyle = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);
// Lightweight Charts' LineWidth, in whole pixels (src/renderers/draw-line.ts), for its series' lines and price lines
const lineWidth = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);
// the drawn kinds' widths, any positive number (a 笔 is 0.7 px: the owner's choice, 2026-10-22)
const drawnWidth = z.number().positive().finite();

export const priceFormatSchema = z
  .object({
    type: z.enum(["price", "volume"]),
    precision: z.number().int().nonnegative().optional(),
    minMove: z.number().positive().optional(),
  })
  .strict()
  .readonly();

// the options every series takes
const common = {
  title: z.string().optional(),
  visible: z.boolean().optional(),
  // "right" (the default), "left", or an id of one's own: an overlay scale, without an axis
  priceScaleId: z.string().min(1).optional(),
  lastValueVisible: z.boolean().optional(),
  priceLineVisible: z.boolean().optional(),
  priceFormat: priceFormatSchema.optional(),
};

const candlestickOptions = z
  .object({
    ...common,
    upColor: colour.optional(),
    downColor: colour.optional(),
    borderUpColor: colour.optional(),
    borderDownColor: colour.optional(),
    wickUpColor: colour.optional(),
    wickDownColor: colour.optional(),
    borderVisible: z.boolean().optional(),
    wickVisible: z.boolean().optional(),
  })
  .strict()
  .readonly();
const lineOptions = z
  .object({
    ...common,
    color: colour.optional(),
    lineWidth: lineWidth.optional(),
    lineStyle: lineStyle.optional(),
  })
  .strict()
  .readonly();
const histogramOptions = z
  .object({ ...common, color: colour.optional(), base: price.optional() })
  .strict()
  .readonly();
// The drawn kinds sit on a price scale like a series, but in Lightweight Charts they are primitives, so they have no
// last value, price lines or markers of their own.
const drawn = { title: common.title, visible: common.visible, priceScaleId: common.priceScaleId };
const segmentsOptions = z
  .object({
    ...drawn,
    color: colour.optional(),
    lineWidth: drawnWidth.optional(),
    lineStyle: lineStyle.optional(),
  })
  .strict()
  .readonly();
// a box's border (color, lineWidth, lineStyle) and its fill
const boxesOptions = z
  .object({
    ...drawn,
    color: colour.optional(),
    fillColor: colour.optional(),
    lineWidth: drawnWidth.optional(),
    lineStyle: lineStyle.optional(),
    borderVisible: z.boolean().optional(),
  })
  .strict()
  .readonly();

// a price distribution's up and down colours, its value area's opacity (other rows at half), and its longest row's
// share of the pane's width
const share = z.number().min(0).max(1);
const profilesOptions = z
  .object({
    ...drawn,
    upColor: colour.optional(),
    downColor: colour.optional(),
    opacity: share.optional(),
    share: share.optional(),
  })
  .strict()
  .readonly();

// A series' data items, each at its time; a series' items are in time order, with no time twice (setData's rule).
export const candleSchema = z
  .object({ time, open: price, high: price, low: price, close: price, color: colour.optional() })
  .strict()
  .readonly();
export const pointSchema = z.object({ time, value: price, color: colour.optional() }).strict().readonly();
// a segment from (time, value) to (endTime, endValue), optionally in its own colour and style (a 笔 still
// forming is dashed)
export const segmentSchema = z
  .object({
    time,
    value: price,
    endTime: time,
    endValue: price,
    color: colour.optional(),
    lineStyle: lineStyle.optional(),
  })
  .strict()
  .readonly()
  .refine((g) => g.endTime >= g.time, "a segment ends at or after its start");
// a box from time to endTime, between low and high
export const boxSchema = z
  .object({
    time,
    endTime: time,
    low: price,
    high: price,
    color: colour.optional(),
    fillColor: colour.optional(),
    lineStyle: lineStyle.optional(),
  })
  .strict()
  .readonly()
  .refine(
    (b) => b.endTime >= b.time && b.low <= b.high,
    "a box ends at or after its start, its low at most its high",
  );

// A price distribution over the K-lines from time to endTime: rows of height step from price low, each with its up
// and down volume; poc is the point of control's row, valueFrom to valueTo the value area's rows.
const volume = z.number().nonnegative().finite();
const row = z.number().int().nonnegative();
export const distributionSchema = z
  .object({
    time,
    endTime: time,
    low: price,
    step: z.number().nonnegative().finite(),
    up: z.array(volume).min(1).readonly(),
    down: z.array(volume).min(1).readonly(),
    poc: row,
    valueFrom: row,
    valueTo: row,
  })
  .strict()
  .readonly()
  .refine(
    (d) =>
      d.endTime >= d.time &&
      d.up.length === d.down.length &&
      d.valueFrom <= d.poc &&
      d.poc <= d.valueTo &&
      d.valueTo < d.up.length,
    "a distribution ends at or after its start, its rows up and down alike, its point of control within its value area within its rows",
  );

// A marker (createSeriesMarkers) at a bar's time: above it, below it, on it, or at a price, which it must then give
// (src/plugins/series-markers/types.ts, SeriesMarkerPrice).
export const markerSchema = z
  .object({
    time,
    position: z.enum(["aboveBar", "belowBar", "inBar", "atPriceTop", "atPriceBottom", "atPriceMiddle"]),
    shape: z.enum(["circle", "square", "arrowUp", "arrowDown"]),
    color: colour,
    text: z.string().optional(),
    size: z.number().positive().optional(),
    price: price.optional(),
  })
  .strict()
  .readonly()
  .refine(
    (m) => !m.position.startsWith("atPrice") || m.price !== undefined,
    "a marker at a price has its price",
  );

// a price line (series.createPriceLine): a level across the pane
export const priceLineSchema = z
  .object({
    price,
    color: colour,
    lineWidth: lineWidth.optional(),
    lineStyle: lineStyle.optional(),
    axisLabelVisible: z.boolean().optional(),
    title: z.string().optional(),
  })
  .strict()
  .readonly();

// times in order, none twice (setData's rule, for Lightweight Charts' own kinds)
const ascending = (data: readonly { readonly time: number }[]): boolean =>
  data.every((d, i) => i === 0 || d.time > (data[i - 1]?.time ?? d.time));
// times in order, a time twice allowed (for the drawn kinds: a 中枢's two boxes start at one K-line)
const ordered = (data: readonly { readonly time: number }[]): boolean =>
  data.every((d, i) => i === 0 || d.time >= (data[i - 1]?.time ?? d.time));

// A series: its id, its pane, and its data in time order (a time twice allowed for the drawn kinds). Lightweight
// Charts' own kinds may have markers and price lines; the drawn kinds, being primitives, have neither.
const seriesShape = {
  id: z.string().min(1),
  paneIndex: z.number().int().nonnegative(),
};
const marked = {
  markers: z.array(markerSchema).readonly().optional(),
  priceLines: z.array(priceLineSchema).readonly().optional(),
};
const kind = <
  K extends string,
  O extends z.ZodType,
  D extends z.ZodType<{ readonly time: number }>,
  M extends z.ZodRawShape,
>(
  type: K,
  options: O,
  item: D,
  more: M,
  twice = false,
) =>
  z
    .object({
      type: z.literal(type),
      options,
      data: twice
        ? z.array(item).readonly().refine(ordered, "in time order")
        : z.array(item).readonly().refine(ascending, "in time order, no time twice"),
      ...seriesShape,
      ...more,
    })
    .strict()
    .readonly();
export const seriesSchema = z.discriminatedUnion("type", [
  kind("Candlestick", candlestickOptions, candleSchema, marked),
  kind("Line", lineOptions, pointSchema, marked),
  kind("Histogram", histogramOptions, pointSchema, marked),
  kind("Segments", segmentsOptions, segmentSchema, {}, true),
  kind("Boxes", boxesOptions, boxSchema, {}, true),
  kind("Profiles", profilesOptions, distributionSchema, {}, true),
]);

// a price scale's options (priceScale().applyOptions): the space above and below its series, as shares of the pane
export const priceScaleSchema = z
  .object({
    scaleMargins: marginsSchema.optional(),
    visible: z.boolean().optional(),
  })
  .strict()
  .readonly();

// a pane: its share of the chart's height (stretchFactor, 1 by default) and its price scales by id
export const paneSchema = z
  .object({
    stretchFactor: z.number().positive().optional(),
    priceScales: z.record(z.string().min(1), priceScaleSchema).readonly().optional(),
  })
  .strict()
  .readonly();

// the time scale's options: the space after the last bar, in bars; each bar's width, in pixels
export const timeScaleSchema = z
  .object({
    rightOffset: z.number().nonnegative().optional(),
    barSpacing: z.number().positive().optional(),
  })
  .strict()
  .readonly();

export const chartSchema = z
  .object({
    contract: z.literal("qi-chart/1"),
    title: z.string().optional(),
    timeScale: timeScaleSchema.optional(),
    // the dash and the labels' size (dsl.ts's look; the space right of the last K-line is the time scale's)
    look: lookSchema.optional(),
    panes: z.array(paneSchema).min(1).readonly(),
    series: z.array(seriesSchema).min(1).readonly(),
  })
  .strict()
  .readonly()
  .refine(
    (c) => c.series.every((s) => s.paneIndex < c.panes.length),
    "a series' paneIndex is a pane of the chart",
  )
  .refine((c) => new Set(c.series.map((s) => s.id)).size === c.series.length, "a series' id is its own");

export type Candle = z.output<typeof candleSchema>;
export type Point = z.output<typeof pointSchema>;
export type Segment = z.output<typeof segmentSchema>;
export type Box = z.output<typeof boxSchema>;
export type Distribution = z.output<typeof distributionSchema>;
export type Marker = z.output<typeof markerSchema>;
export type PriceLine = z.output<typeof priceLineSchema>;
export type Series = z.output<typeof seriesSchema>;
export type PriceScale = z.output<typeof priceScaleSchema>;
export type Pane = z.output<typeof paneSchema>;
export type TimeScale = z.output<typeof timeScaleSchema>;
export type Chart = z.output<typeof chartSchema>;
export type CandlestickOptions = z.output<typeof candlestickOptions>;
export type LineOptions = z.output<typeof lineOptions>;
export type HistogramOptions = z.output<typeof histogramOptions>;
export type SegmentsOptions = z.output<typeof segmentsOptions>;
export type BoxesOptions = z.output<typeof boxesOptions>;
export type ProfilesOptions = z.output<typeof profilesOptions>;
