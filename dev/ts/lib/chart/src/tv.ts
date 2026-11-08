// tv, the DSL's engine for Lightweight Charts (docs/designs/design-chart-lib-2026-10-24.md, The engines): the
// primitives (tvEngine), and a whole drawing (dsl.ts's Drawing) turned into the tv page's data, qi-chart/1
// (description.ts) and qi-layers/1 (layers.ts), which engine/tv.ts draws in the browser.
//
// How each primitive becomes Lightweight Charts' input. A position becomes its K-line's time (a position with no
// K-line gives nothing).
// - a candle: an item of a Candlestick series;
// - a box: an item of Boxes; a fill is a palette colour at its opacity (cl-center/8); no border is a transparent one;
// - a line: an item of Segments, dashed as LineStyle 2;
// - a mark: a marker on the candles, above or below, an arrow pointing at its K-line or a circle;
// - a series: a Line or Histogram in its pane, at its opacity; with a band, on its own hidden price scale with the
//   band as margins; in the legend if it has an entry; bars come first among the series so they draw underneath;
// - a profile: an item of Profiles, a primitive on the main graph that draws the item under the pointer.
// Series ids: a layer's candles, boxes, lines and profiles are one series each under the layer's key (`key:kind` if
// it has several kinds), its series likewise (`key:series`), numbered if there are several (`key:i`,
// `key:series:i`). The main graph's price scale (`right`) takes the drawing's margins.

import { pipe, type Result, result } from "@qi/base";
import { type DecodeError, decode } from "@qi/core";
import { boxes, candlestick, chart, histogram, line, profiles, segments } from "./build.ts";
import type {
  Box,
  Candle,
  Chart,
  Distribution,
  Marker,
  Pane,
  Point,
  Segment,
  Series,
} from "./description.ts";
import { type Components, drawing, type Shown } from "./drawing.ts";
import type { Drawing, Engine, Layer, Legend, Margins } from "./dsl.ts";
import { type Layers, layersSchema } from "./layers.ts";
import { componentsOf, type LocateError, located } from "./locate.ts";
import type { XAxis } from "./schemas.ts";

// A primitive as Lightweight Charts draws it, with what its series takes from it (colours, a width).
export type TvPart =
  | { readonly candle: Candle; readonly up: string; readonly down: string }
  | { readonly box: Box; readonly width?: number }
  | { readonly segment: Segment; readonly colour: string; readonly width?: number }
  | { readonly marker: Marker }
  | {
      readonly profile: Distribution;
      readonly up: string;
      readonly down: string;
      readonly opacity: number;
      readonly share: number;
    }
  | {
      readonly series: {
        readonly form: "line" | "bars";
        readonly pane: number;
        readonly band?: Margins;
        readonly points: readonly Point[];
        readonly colour: string;
        readonly width?: number;
        readonly legend?: Legend;
      };
    };

const lineStyle = (dashed: boolean): 0 | 2 => (dashed ? 2 : 0);
// a Line series' width, in whole pixels from 1 to 4 (Lightweight Charts' LineWidth)
const lineWidth = (w: number): 1 | 2 | 3 | 4 => (w < 1.5 ? 1 : w < 2.5 ? 2 : w < 3.5 ? 3 : 4);

export const tvEngine = (xs: XAxis): Engine<readonly TvPart[]> => {
  const time = (p: number): number | undefined => xs[p]?.date;
  const width = (w: number | undefined) => (w === undefined ? {} : { width: w });
  return {
    candle: (at, open, high, low, close, colours) => {
      const t = time(at);
      return t === undefined ? [] : [{ candle: { time: t, open, high, low, close }, ...colours }];
    },
    box: (from, to, low, high, style) => {
      const t0 = time(from);
      const t1 = time(to);
      return t0 === undefined || t1 === undefined
        ? []
        : [
            {
              box: {
                time: t0,
                endTime: t1,
                low,
                high,
                // no border: a transparent one
                color: style.border === false ? "rgba(0, 0, 0, 0)" : style.colour,
                ...(style.fill === undefined
                  ? {}
                  : { fillColor: `${style.fill.colour}/${Math.round(style.fill.opacity * 100)}` }),
                lineStyle: lineStyle(style.dashed),
              },
              ...width(style.width),
            },
          ];
    },
    mark: (at, side, shape, style) => {
      const t = time(at);
      return t === undefined
        ? []
        : [
            {
              marker: {
                time: t,
                position: side === "above" ? "aboveBar" : "belowBar",
                shape: shape === "circle" ? "circle" : side === "above" ? "arrowDown" : "arrowUp",
                color: style.colour,
                ...(style.size === undefined ? {} : { size: style.size }),
              },
            },
          ];
    },
    line: (from, to, style) => {
      const t0 = time(from.at);
      const t1 = time(to.at);
      return t0 === undefined || t1 === undefined
        ? []
        : [
            {
              segment: {
                time: t0,
                value: from.price,
                endTime: t1,
                endValue: to.price,
                // each line its own colour: a layer's lines may differ (a 走势's up and down)
                color: style.colour,
                lineStyle: lineStyle(style.dashed),
              },
              colour: style.colour,
              ...width(style.width),
            },
          ];
    },
    series: (values, form, place, style, legend) => {
      // a palette colour at the series' opacity
      const tint = (c: string): string =>
        style.opacity === undefined ? c : `${c}/${Math.round(style.opacity * 100)}`;
      return [
        {
          series: {
            form,
            pane: place.pane,
            ...(place.band === undefined ? {} : { band: place.band }),
            points: values.flatMap((v) => {
              const t = time(v.at);
              return t === undefined
                ? []
                : [{ time: t, value: v.value, ...(v.colour === undefined ? {} : { color: tint(v.colour) }) }];
            }),
            colour: tint(style.colour),
            ...width(style.width),
            ...(legend === undefined ? {} : { legend }),
          },
        },
      ];
    },
    profile: (from, to, d, style) => {
      const t0 = time(from);
      const t1 = time(to);
      return t0 === undefined || t1 === undefined
        ? []
        : [
            {
              profile: {
                time: t0,
                endTime: t1,
                low: d.low,
                step: d.step,
                up: d.up,
                down: d.down,
                poc: d.poc,
                valueFrom: d.value.from,
                valueTo: d.value.to,
              },
              up: style.up,
              down: style.down,
              opacity: style.opacity,
              share: style.share,
            },
          ];
    },
  };
};

// a price scale of a series' own, in its pane, with its band as its margins
type Scale = { readonly pane: number; readonly id: string; readonly band: Margins };
// a series in the legend, by its id
type Entry = Legend & { readonly series: string };

// a layer's series: one each for its candles, boxes and lines, plus each of its own series; with their own price
// scales and legend entries
const seriesOf = (
  l: Layer<readonly TvPart[]>,
  precision: number,
): {
  readonly series: readonly Series[];
  readonly scales: readonly Scale[];
  readonly legend: readonly Entry[];
} => {
  const parts = l.parts.flat();
  const candles = parts.flatMap((p) => ("candle" in p ? [p] : []));
  const bs = parts.flatMap((p) => ("box" in p ? [p] : []));
  const ls = parts.flatMap((p) => ("segment" in p ? [p] : []));
  const ss = parts.flatMap((p) => ("series" in p ? [p.series] : []));
  const ps = parts.flatMap((p) => ("profile" in p ? [p] : []));
  const kinds = [candles, bs, ls, ss, ps].filter((k) => k.length > 0).length;
  const id = (kind: string): string => (kinds > 1 ? `${l.key}:${kind}` : l.key);
  const [c0] = candles;
  const [b0] = bs;
  const [s0] = ls;
  const [p0] = ps;
  const sid = (i: number): string => (ss.length > 1 ? `${id("series")}:${i}` : id("series"));
  const drawn: readonly Series[] = [
    ...(c0 === undefined
      ? []
      : [
          candlestick(
            id("candles"),
            candles.map((p) => p.candle),
            {
              upColor: c0.up,
              downColor: c0.down,
              borderUpColor: c0.up,
              borderDownColor: c0.down,
              wickUpColor: c0.up,
              wickDownColor: c0.down,
              // the axis shows the drawing's precision, as every price on the page does
              priceFormat: { type: "price", precision, minMove: 10 ** -precision },
            },
          ),
        ]),
    ...(b0 === undefined
      ? []
      : [
          boxes(
            id("boxes"),
            bs.map((p) => p.box),
            b0.width === undefined ? {} : { lineWidth: b0.width },
          ),
        ]),
    ...(s0 === undefined
      ? []
      : [
          segments(
            id("lines"),
            ls.map((p) => p.segment),
            { color: s0.colour, ...(s0.width === undefined ? {} : { lineWidth: s0.width }) },
          ),
        ]),
    ...(p0 === undefined
      ? []
      : [
          profiles(
            id("profiles"),
            ps.map((p) => p.profile).toSorted((a, b) => a.time - b.time),
            { upColor: p0.up, downColor: p0.down, opacity: p0.opacity, share: p0.share },
          ),
        ]),
  ];
  const own = ss.map((s, i): Series => {
    const shared = {
      color: s.colour,
      lastValueVisible: false,
      priceLineVisible: false,
      ...(s.band === undefined ? {} : { priceScaleId: sid(i) }),
    };
    return s.form === "bars"
      ? histogram(
          sid(i),
          s.points,
          {
            ...shared,
            priceFormat:
              s.legend?.format === "volume"
                ? { type: "volume" }
                : { type: "price", precision, minMove: 10 ** -precision },
          },
          s.pane,
        )
      : line(
          sid(i),
          s.points,
          {
            ...shared,
            priceFormat: { type: "price", precision, minMove: 10 ** -precision },
            ...(s.width === undefined ? {} : { lineWidth: lineWidth(s.width) }),
          },
          s.pane,
        );
  });
  return {
    series: [...drawn, ...own],
    scales: ss.flatMap((s, i) => (s.band === undefined ? [] : [{ pane: s.pane, id: sid(i), band: s.band }])),
    legend: ss.flatMap((s, i) => (s.legend === undefined ? [] : [{ series: sid(i), ...s.legend }])),
  };
};

// the panes, one per paneIndex used: the main graph's price scale with the drawing's margins, each series' own
// scale with its band; each subgraph the layout's share of the main graph's height
const panesOf = (
  prices: Margins,
  subgraph: number,
  series: readonly Series[],
  scales: readonly Scale[],
): readonly Pane[] => {
  const count = Math.max(0, ...series.map((s) => s.paneIndex)) + 1;
  return Array.from({ length: count }, (_, pane) => ({
    ...(count > 1 ? { stretchFactor: pane === 0 ? 1 / subgraph : 1 } : {}),
    priceScales: Object.fromEntries([
      ...(pane === 0 ? [["right", { scaleMargins: prices }] as const] : []),
      ...scales.filter((c) => c.pane === pane).map((c) => [c.id, { scaleMargins: c.band }] as const),
    ]),
  }));
};

const markersOf = (l: Layer<readonly TvPart[]>): readonly Marker[] =>
  l.parts
    .flat()
    .flatMap((p) => ("marker" in p ? [p.marker] : []))
    .toSorted((a, b) => a.time - b.time);

// a drawing as the tv page's data: the description and its layers, each checked against its contract
export const tvDescription = (
  d: Drawing<readonly TvPart[]>,
): Result<{ readonly chart: Chart; readonly layers: Layers }, DecodeError> => {
  const all = [...d.apart, ...d.groups.flatMap((g) => g.layers), ...d.choice.layers];
  const made = new Map(all.map((l) => [l.key, seriesOf(l, d.precision)]));
  const listed = all.flatMap((l) => made.get(l.key)?.series ?? []);
  const series = [
    ...listed.filter((s) => s.type === "Histogram"),
    ...listed.filter((s) => s.type !== "Histogram"),
  ];
  const scales = all.flatMap((l) => made.get(l.key)?.scales ?? []);
  const layer = (l: Layer<readonly TvPart[]>) => ({
    name: l.name,
    series: (made.get(l.key)?.series ?? []).map((s) => s.id),
    markers: markersOf(l),
    on: l.on,
    fine: l.fine,
  });
  return pipe(
    chart({
      title: d.title,
      series,
      panes: panesOf(d.prices, d.subgraph, series, scales),
      timeScale: { rightOffset: d.look.offset },
      look: d.look,
    }),
    result.flatMap((ch) =>
      pipe(
        decode(layersSchema)({
          contract: "qi-layers/1",
          fine: d.fine,
          precision: d.precision,
          apart: d.apart.map(layer),
          levels: d.groups.map((g) => ({
            level: g.level,
            colour: g.colour,
            on: g.on,
            items: g.layers.map(layer),
          })),
          legend: all.flatMap((l) => made.get(l.key)?.legend ?? []),
          choice: { name: d.choice.name, items: d.choice.layers.map(layer) },
        }),
        result.map((ls) => ({ chart: ch, layers: ls })),
      ),
    ),
  );
};

// a chart's components, checked (locate.ts), drawn through the tv engine
export const tvChart = (
  c: Components,
  shown: Shown = "all",
): Result<{ readonly chart: Chart; readonly layers: Layers }, DecodeError | LocateError> =>
  pipe(
    located(c),
    result.flatMap((ok) => tvDescription(drawing(tvEngine(componentsOf(ok).xAxis))(ok, shown))),
  );
