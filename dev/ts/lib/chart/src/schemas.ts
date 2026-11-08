// Everything the chart takes from outside, as schemas (docs/designs/design-chart-lib-2026-10-24.md, The contracts).
// The data: the x-axis (the K-lines in time order, each a contract's: @qi/chanlun's or @qi/market's) and the price
// distributions; 缠论's data, the K-line to 中枢, are @qi/chanlun's contracts, passed on below. The settings: each component's style and parameters with their defaults,
// the layout, and the options a caller gives over them. A component's module holds only its drawing; its style is an
// input, like its data.
import { type KLine, klineSchema } from "@qi/chanlun";
import { klineSchema as marketKlineSchema } from "@qi/market";
import { z } from "zod";
import type { DistributionStyle } from "./dsl.ts";

// 缠论's contracts, passed on so the chart's modules import every data type from this one file. They are defined in
// @qi/chanlun, and the chart's index does not export them again: a taker imports them from @qi/chanlun.
export {
  type Centre,
  centreSchema,
  type Fractal,
  fractalSchema,
  type KLine,
  klineSchema,
  type MergedBar,
  mergedBarSchema,
  type Stroke,
  strokeSchema,
} from "@qi/chanlun";

// a K-line's position on the x-axis
const position = z.number().int().nonnegative();
// a price as a whole number: the price times the chart's scale
const price = z.number().int();

// A bar, the library's own form of a K-line inside, which no caller gives (a market K-line is made one by `located`,
// locate.ts): its time, seconds since 1970, UTC; its prices, whole numbers at the chart's scale; its volume. The
// chart draws only these fields, so 缠论's K-line is drawn as a bar.
export const barSchema = z
  .object({
    date: position,
    open: price,
    high: price,
    low: price,
    close: price,
    volume: z.number().nonnegative(),
  })
  .strict()
  .readonly()
  .refine(
    (b) => b.low <= Math.min(b.open, b.close) && Math.max(b.open, b.close) <= b.high,
    "a bar's open and close within its low and high",
  );

// the x-axis as a caller gives it: the K-lines in time order, each a contract's, 缠论's (chanlun 1.1.0, for the chart
// app's static charts) or the market data's (market 1.1.0), all of one contract (docs/designs/
// design-chart-online-2026-11-08.md, The two components)
export const xAxisSchema = z
  .array(z.union([klineSchema, marketKlineSchema]))
  .min(1)
  .readonly()
  .refine(
    (ks) => ks.every((k) => "index" in k) || ks.every((k) => !("index" in k)),
    "the K-lines all of one contract",
  )
  .refine(
    (ks) => ks.every((k, i) => i === 0 || (ks[i - 1]?.date ?? k.date) < k.date),
    "the K-lines strictly in time",
  );

// A price distribution over K-lines `from` to `to` (of a 笔, 线段 or 中枢): rows of height `step` from price `low`
// (one row of height 0 if every trade was at one price), each with its up and down volume; `poc` is the point of
// control's row, `value` the value area's rows. Computed by @qi/indicator's profile and drawn as given.
const volume = z.number().nonnegative();
const row = z.number().int().nonnegative();
export const profileSchema = z
  .object({
    from: position,
    to: position,
    low: price,
    step: z.number().nonnegative(),
    up: z.array(volume).min(1).readonly(),
    down: z.array(volume).min(1).readonly(),
    poc: row,
    value: z.object({ from: row, to: row }).strict().readonly(),
  })
  .strict()
  .readonly()
  .refine(
    (p) =>
      p.from <= p.to &&
      p.up.length === p.down.length &&
      p.value.from <= p.poc &&
      p.poc <= p.value.to &&
      p.value.to < p.up.length,
    "a profile's K-lines in order, its rows up and down alike, its point of control within its value area within " +
      "its rows",
  );

// The price distributions of one kind of configuration at one level, one per configuration.
export const profilesSchema = z
  .object({
    kind: z.enum(["bi", "duan", "zhongshu"]),
    level: z.number().int().nonnegative(),
    items: z.array(profileSchema).readonly(),
  })
  .strict()
  .readonly();

export type Bar = z.output<typeof barSchema>;
// the K-lines as a caller gives them
export type KLines = z.output<typeof xAxisSchema>;
// the K-lines inside, as `located` gives them: 缠论's as they are, the market data's made bars; what each drawing and
// an add-on's derive are given
export type XAxis = readonly (KLine | Bar)[];
export type Profile = z.output<typeof profileSchema>;
export type Profiles = z.output<typeof profilesSchema>;

// The settings (Version 1.7): every parameter and style of each component, and the layout, each with a default. A
// caller gives only what differs, and drawing.ts's `merged` lays it over the defaults.

// The pieces the settings' schemas are built from. A colour is a palette name:
export const colourSchema = z
  .string()
  .regex(/^cl-[a-z0-9-]+$/, "a colour is a name of the palette, cl- and lowercase");
// a line's width in pixels
export const widthSchema = z.number().positive().max(20);
// an opacity, 0 to 1
export const opacitySchema = z.number().min(0).max(1);
// a mark's size
export const sizeSchema = z.number().positive().max(10);
// a share of a height or a width, 0 to 1
export const shareSchema = z.number().min(0).max(1);

// a caller's options for a component: shown at first or not, shown only while few K-lines are in view (the
// layout's `fine`) or not, and any part of its style; fullOptions adds any part of its parameters
export const styleOptions = <S extends z.ZodObject>(style: S) =>
  z
    .object({
      show: z.boolean().optional(),
      detail: z.boolean().optional(),
      style: style.partial().strict().optional(),
    })
    .strict()
    .readonly();
export const fullOptions = <S extends z.ZodObject, P extends z.ZodObject>(style: S, params: P) =>
  z
    .object({
      show: z.boolean().optional(),
      detail: z.boolean().optional(),
      style: style.partial().strict().optional(),
      params: params.partial().strict().optional(),
    })
    .strict()
    .readonly();

// K线
export const klineStyleSchema = z.object({ up: colourSchema, down: colourSchema }).strict();
export type KlineStyle = Readonly<z.output<typeof klineStyleSchema>>;
export const klineDefaults: KlineStyle = { up: "cl-up", down: "cl-down" };
export const klineOptions = styleOptions(klineStyleSchema);

// 成交量: its colours, its bars' opacity, and its band's height as a share of the main graph's, from the bottom
export const volumeStyleSchema = z
  .object({ up: colourSchema, down: colourSchema, opacity: opacitySchema, height: shareSchema.positive() })
  .strict();
export type VolumeStyle = Readonly<z.output<typeof volumeStyleSchema>>;
export const volumeDefaults: VolumeStyle = { up: "cl-up", down: "cl-down", opacity: 0.4, height: 0.25 };
export const volumeOptions = styleOptions(volumeStyleSchema);

// 包含: its up and down colours, the box's border width and fill, the mark's size, and whether the box and the
// marks are shown
export const baohanStyleSchema = z
  .object({
    up: colourSchema,
    down: colourSchema,
    width: widthSchema,
    fill: opacitySchema,
    mark: sizeSchema,
    showBox: z.boolean(),
    showMarks: z.boolean(),
  })
  .strict();
export type BaohanStyle = Readonly<z.output<typeof baohanStyleSchema>>;
export const baohanDefaults: BaohanStyle = {
  up: "cl-up",
  down: "cl-down",
  width: 0.7,
  fill: 0.08,
  mark: 0.6,
  showBox: true,
  showMarks: true,
};
export const baohanOptions = styleOptions(baohanStyleSchema);

// 分型
export const fenxingStyleSchema = z
  .object({ confirmed: colourSchema, unconfirmed: colourSchema, size: sizeSchema })
  .strict();
export type FenxingStyle = Readonly<z.output<typeof fenxingStyleSchema>>;
export const fenxingDefaults: FenxingStyle = { confirmed: "cl-ink", unconfirmed: "cl-muted", size: 0.6 };
export const fenxingOptions = styleOptions(fenxingStyleSchema);

// 笔, 线段 and 走势
export const lineStyleSchema = z.object({ colour: colourSchema, width: widthSchema }).strict();
export type LineStyle = Readonly<z.output<typeof lineStyleSchema>>;
export const biDefaults: LineStyle = { colour: "cl-stroke", width: 0.7 };
export const duanDefaults: LineStyle = { colour: "cl-level", width: 0.7 };
export const lineOptions = styleOptions(lineStyleSchema);

export const zoushiStyleSchema = z
  .object({ up: colourSchema, down: colourSchema, width: widthSchema, step: z.number().min(0).max(10) })
  .strict();
export type ZoushiStyle = Readonly<z.output<typeof zoushiStyleSchema>>;
export const zoushiDefaults: ZoushiStyle = { up: "cl-up", down: "cl-down", width: 1.4, step: 0.7 };
export const zoushiOptions = styleOptions(zoushiStyleSchema);

// 中枢: the outer box's border and fill, the inner box's fill, and whether each box is shown
export const zhongshuStyleSchema = z
  .object({
    width: widthSchema,
    step: z.number().min(0).max(10),
    fill: opacitySchema,
    inner: opacitySchema,
    showOuter: z.boolean(),
    showInner: z.boolean(),
  })
  .strict();
export type ZhongshuStyle = Readonly<z.output<typeof zhongshuStyleSchema>>;
export const zhongshuDefaults: ZhongshuStyle = {
  width: 0.7,
  step: 0.7,
  fill: 0.08,
  inner: 0.3,
  showOuter: true,
  showInner: true,
};
export const zhongshuOptions = styleOptions(zhongshuStyleSchema);

// 成交量分布's parameter (distribution.ts): the most rows a distribution has (never finer than a cent)
export const profileParamsSchema = z.object({ rows: z.number().int().min(1).max(200) }).strict();
export type ProfileParams = Readonly<z.output<typeof profileParamsSchema>>;
export const profileParamsDefaults: ProfileParams = { rows: 24 };
// its style: rows in the candles' colours, the value area as faint as the volume bars, the longest row a quarter of
// the graph's width (as the volume takes the bottom quarter)
export const profileStyleSchema = z
  .object({ up: colourSchema, down: colourSchema, opacity: opacitySchema, share: shareSchema })
  .strict();
export const profileDefaults: DistributionStyle = { up: "cl-up", down: "cl-down", opacity: 0.4, share: 0.25 };
export const profileOptions = fullOptions(profileStyleSchema, profileParamsSchema);

// The layout:
// - digits: the decimals a price is shown with;
// - fine: the number of K-lines in view below which fine layers show;
// - above, below: the space left above and below the K-lines in view, as shares of the main graph's height;
// - subgraph: a subgraph's height, as a share of the main graph's;
// - levels: the levels' colours, level 0's first; the last is used for every level above;
// - dash: a dashed line's dash and gap, in pixels;
// - font: the labels' size, in pixels;
// - offset: the space right of the last K-line, in K-lines.
export const layoutSchema = z
  .object({
    digits: z.number().int().min(0).max(8),
    fine: z.number().int().positive(),
    above: shareSchema,
    below: shareSchema,
    subgraph: z.number().positive().max(4),
    levels: z.array(colourSchema).min(1),
    dash: z.tuple([z.number().positive().max(40), z.number().positive().max(40)]),
    font: z.number().int().min(8).max(24),
    offset: z.number().min(0).max(200),
  })
  .strict();
// the space above and below the K-lines must leave the main graph some height
const roomLeft = (l: { readonly above?: number | undefined; readonly below?: number | undefined }): boolean =>
  (l.above ?? layoutDefaults.above) + (l.below ?? layoutDefaults.below) < 1;
export type Layout = Readonly<z.output<typeof layoutSchema>>;
export const layoutDefaults: Layout = {
  digits: 2,
  fine: 1500,
  above: 0.05,
  below: 0.05,
  subgraph: 0.25,
  levels: ["cl-center", "cl-event", "cl-gap", "cl-muted"],
  dash: [6, 4],
  font: 11,
  offset: 5,
};

// which components are on at first: all but 分型 (成交量分布 is a choice, with none chosen at first)
export const shownDefaults = {
  candles: true,
  volume: true,
  merged: true,
  fx: false,
  bi: true,
  duan: true,
  zoushi: true,
  zhongshu: true,
} as const;

// which components show only while fewer than the layout's `fine` K-lines are in view: 包含 and 分型
export const detailDefaults = {
  candles: false,
  volume: false,
  merged: true,
  fx: true,
  bi: false,
  duan: false,
  zoushi: false,
  zhongshu: false,
} as const;

// The caller's options: for each component, by its key, any part of its options; any part of the layout. Anything
// left out takes its default.
export const optionsSchema = z
  .object({
    candles: klineOptions,
    volume: volumeOptions,
    merged: baohanOptions,
    fx: fenxingOptions,
    bi: lineOptions,
    duan: lineOptions,
    zoushi: zoushiOptions,
    zhongshu: zhongshuOptions,
    profile: profileOptions,
    layout: layoutSchema
      .partial()
      .strict()
      .refine(
        roomLeft,
        "the layout's above and below must leave the main graph some height: their sum below 1",
      ),
  })
  .partial()
  .strict()
  .readonly();
export type Options = z.output<typeof optionsSchema>;
