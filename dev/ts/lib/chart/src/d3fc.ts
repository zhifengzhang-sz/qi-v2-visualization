// d3fc, the DSL's engine for D3 and d3fc (docs/designs/design-chart-lib-2026-10-24.md, The engines): the primitives
// (d3fcEngine), and a whole drawing (dsl.ts's Drawing) turned into the d3fc page's data, qi-d3fc/1, which
// engine/d3fc.ts draws in the browser. A position is an x on a linear scale, with the K-lines' times alongside for
// the axis labels. Candles, boxes, lines and marks are shapes by kind; a series is its values at their xs, as a line
// or bars, in its pane, on its own scale inside its band if it has one; a profile is its rows, of which the engine
// draws the chosen layer's item under the pointer. A layer keeps its shapes by kind, whether it is on at first and
// whether it is fine; the main graph's margins are the drawing's.

import { pipe, type Result, result } from "@qi/base";
import { type DecodeError, decode } from "@qi/core";
import { z } from "zod";
import { type Components, drawing, type Shown } from "./drawing.ts";
import { type Drawing, type Engine, type Layer, legendSchema, lookSchema, marginsSchema } from "./dsl.ts";
import { componentsOf, type LocateError, located } from "./locate.ts";

const x = z.number().int().nonnegative();
const price = z.number().finite();
const colour = z.string().min(1);
const width = z.number().positive().optional();

const candleSchema = z
  .object({ x, open: price, high: price, low: price, close: price, colour })
  .strict()
  .readonly();
const boxSchema = z
  .object({
    x0: x,
    x1: x,
    low: price,
    high: price,
    colour,
    width,
    dashed: z.boolean(),
    border: z.boolean(),
    fill: z
      .object({ colour, opacity: z.number().min(0).max(1) })
      .strict()
      .readonly()
      .optional(),
  })
  .strict()
  .readonly();
const lineSchema = z
  .object({ x0: x, y0: price, x1: x, y1: price, colour, width, dashed: z.boolean() })
  .strict()
  .readonly();
const markSchema = z
  .object({
    x,
    side: z.enum(["above", "below"]),
    shape: z.enum(["arrow", "circle"]),
    colour,
    size: z.number().positive().optional(),
  })
  .strict()
  .readonly();

const seriesSchema = z
  .object({
    form: z.enum(["line", "bars"]),
    pane: z.number().int().nonnegative(),
    band: marginsSchema.optional(),
    // in order of x, none twice
    points: z
      .array(z.object({ x, value: price, colour: colour.optional() }).strict().readonly())
      .readonly()
      .refine(
        (ps) => ps.every((p, i) => i === 0 || (ps[i - 1]?.x ?? p.x) < p.x),
        "in order of x, none twice",
      ),
    colour,
    width,
    opacity: z.number().min(0).max(1).optional(),
    legend: legendSchema.optional(),
  })
  .strict()
  .readonly();

const volume = z.number().nonnegative().finite();
const row = z.number().int().nonnegative();
const profileSchema = z
  .object({
    x0: x,
    x1: x,
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
    (p) =>
      p.x0 <= p.x1 &&
      p.up.length === p.down.length &&
      p.valueFrom <= p.poc &&
      p.poc <= p.valueTo &&
      p.valueTo < p.up.length,
    "a profile's K-lines in order, its rows up and down alike, its point of control within its value area within its rows",
  );
// a layer's profiles' style: up and down colours, the value area's opacity (other rows at half), and the longest
// row's share of the plot's width
const profileStyleSchema = z
  .object({ up: colour, down: colour, opacity: z.number().min(0).max(1), share: z.number().min(0).max(1) })
  .strict()
  .readonly();

const layerSchema = z
  .object({
    name: z.string().min(1),
    on: z.boolean(),
    fine: z.boolean(),
    candles: z.array(candleSchema).readonly(),
    boxes: z.array(boxSchema).readonly(),
    lines: z.array(lineSchema).readonly(),
    marks: z.array(markSchema).readonly(),
    series: z.array(seriesSchema).readonly(),
    profiles: z.array(profileSchema).readonly(),
    profileStyle: profileStyleSchema.optional(),
  })
  .strict()
  .readonly()
  .refine(
    (l) => l.profiles.length === 0 || l.profileStyle !== undefined,
    "a layer with profiles has their style",
  );

export const d3fcSchema = z
  .object({
    contract: z.literal("qi-d3fc/1"),
    title: z.string(),
    fine: z.number().int().positive(),
    precision: z.number().int().nonnegative(),
    // the space above and below the K-lines in view, as shares of the main graph's height
    prices: marginsSchema,
    // a subgraph's height, as a share of the main graph's
    subgraph: z.number().positive(),
    // the dash, the labels' size, and the space right of the last K-line
    look: lookSchema,
    // the K-lines' times, seconds since 1970, UTC: the labels of the x-axis
    times: z
      .array(z.number().int().nonnegative())
      .readonly()
      .refine(
        (ts) => ts.every((t, i) => i === 0 || (ts[i - 1] ?? t) < t),
        "the K-lines' times strictly increasing",
      ),
    apart: z.array(layerSchema).readonly(),
    groups: z
      .array(
        z
          .object({
            level: z.number().int().nonnegative(),
            colour,
            on: z.boolean(),
            layers: z.array(layerSchema).readonly(),
          })
          .strict()
          .readonly(),
      )
      .readonly(),
    // the price distributions: at most one shown, picked in a pull-down by name; none at first
    choice: z
      .object({ name: z.string().min(1), layers: z.array(layerSchema).readonly() })
      .strict()
      .readonly(),
  })
  .strict()
  .readonly();

export type D3fc = z.output<typeof d3fcSchema>;
type D3Layer = z.output<typeof layerSchema>;

// A primitive as d3fc draws it.
export type D3Part =
  | { readonly candle: D3Layer["candles"][number] }
  | { readonly box: D3Layer["boxes"][number] }
  | { readonly line: D3Layer["lines"][number] }
  | { readonly mark: D3Layer["marks"][number] }
  | { readonly series: D3Layer["series"][number] }
  | { readonly profile: D3Layer["profiles"][number]; readonly style: NonNullable<D3Layer["profileStyle"]> };

const widthOf = (w: number | undefined) => (w === undefined ? {} : { width: w });

export const d3fcEngine: Engine<readonly D3Part[]> = {
  candle: (at, open, high, low, close, colours) => [
    { candle: { x: at, open, high, low, close, colour: close >= open ? colours.up : colours.down } },
  ],
  box: (from, to, low, high, style) => [
    {
      box: {
        x0: from,
        x1: to,
        low,
        high,
        colour: style.colour,
        dashed: style.dashed,
        border: style.border !== false,
        ...(style.fill === undefined ? {} : { fill: style.fill }),
        ...widthOf(style.width),
      },
    },
  ],
  mark: (at, side, shape, style) => [
    {
      mark: {
        x: at,
        side,
        shape,
        colour: style.colour,
        ...(style.size === undefined ? {} : { size: style.size }),
      },
    },
  ],
  line: (from, to, style) => [
    {
      line: {
        x0: from.at,
        y0: from.price,
        x1: to.at,
        y1: to.price,
        colour: style.colour,
        dashed: style.dashed,
        ...widthOf(style.width),
      },
    },
  ],
  series: (values, form, place, style, legend) => [
    {
      series: {
        form,
        pane: place.pane,
        ...(place.band === undefined ? {} : { band: place.band }),
        points: values.map((v) => ({
          x: v.at,
          value: v.value,
          ...(v.colour === undefined ? {} : { colour: v.colour }),
        })),
        colour: style.colour,
        ...widthOf(style.width),
        ...(style.opacity === undefined ? {} : { opacity: style.opacity }),
        ...(legend === undefined ? {} : { legend }),
      },
    },
  ],
  profile: (from, to, d, style) => [
    {
      profile: {
        x0: from,
        x1: to,
        low: d.low,
        step: d.step,
        up: d.up,
        down: d.down,
        poc: d.poc,
        valueFrom: d.value.from,
        valueTo: d.value.to,
      },
      style,
    },
  ],
};

const layerOf = (l: Layer<readonly D3Part[]>): D3Layer => {
  const parts = l.parts.flat();
  const ps = parts.flatMap((p) => ("profile" in p ? [p] : []));
  const [p0] = ps;
  return {
    name: l.name,
    on: l.on,
    fine: l.fine,
    candles: parts.flatMap((p) => ("candle" in p ? [p.candle] : [])),
    boxes: parts.flatMap((p) => ("box" in p ? [p.box] : [])),
    lines: parts.flatMap((p) => ("line" in p ? [p.line] : [])),
    marks: parts.flatMap((p) => ("mark" in p ? [p.mark] : [])),
    series: parts.flatMap((p) => ("series" in p ? [p.series] : [])),
    profiles: ps.map((p) => p.profile),
    ...(p0 === undefined ? {} : { profileStyle: p0.style }),
  };
};

// a drawing as the d3fc page's data, checked against its contract
export const d3fcDescription = (
  d: Drawing<readonly D3Part[]>,
  times: readonly number[],
): Result<D3fc, DecodeError> =>
  decode(d3fcSchema)({
    contract: "qi-d3fc/1",
    title: d.title,
    fine: d.fine,
    precision: d.precision,
    prices: d.prices,
    subgraph: d.subgraph,
    look: d.look,
    times,
    apart: d.apart.map(layerOf),
    groups: d.groups.map((g) => ({
      level: g.level,
      colour: g.colour,
      on: g.on,
      layers: g.layers.map(layerOf),
    })),
    choice: { name: d.choice.name, layers: d.choice.layers.map(layerOf) },
  });

// a chart's components, checked (locate.ts), drawn through the d3fc engine
export const d3fcChart = (c: Components, shown: Shown = "all"): Result<D3fc, DecodeError | LocateError> =>
  pipe(
    located(c),
    result.flatMap((ok) =>
      d3fcDescription(
        drawing(d3fcEngine)(ok, shown),
        componentsOf(ok).xAxis.map((k) => k.date),
      ),
    ),
  );
