// d3fc: the engine that draws a chart's description for d3fc (qi-d3fc/1, src/d3fc.ts) with D3 7 and d3fc 15. The page
// gives CHART and PALETTE, and loads D3's and d3fc's bundles before this script.
//
// The x-axis is the K-lines' positions on a linear scale, labelled by their times, zoomed and panned by d3fc's zoom;
// the price axis is at the right, fitted to the K-lines in view within the description's margins. The shapes are
// drawn on d3fc's canvas plot area, as the description gives them: a candle a wick and a body, a box a rectangle, a
// line a line, a mark a triangle or a circle beside its K-line, a series bars from 0 or a line, on a scale of its own
// fitted to its values in view, within its band where it has one, with no axis. The grid is under them, the boxes and
// the bars under the candles, the lines over them. With more K-lines in view than pixels, the candles are condensed
// to one bar a pixel, from its high to its low, and a series' bars to the tallest of each pixel. A series in a
// subgraph is drawn in its band under the main graph, each subgraph the description's share of the main graph's
// height, one scale for its series, labelled at the right. The last close and the crosshair are on the SVG plot area
// above, which takes the zoom and the pointer. Each kind of shape is found by its place, through binary searches, not
// by going through them all (docs/designs/design-engines-2026-10-24.md).
//
// As tv.ts: a fine layer is shown only while fewer than CHART.fine K-lines are in view; of the price distributions
// (CHART.choice), the one chosen draws its item under the pointer; the address; the marks; the handles
// (src/handle.ts). Its look is Lightweight Charts': axes in the palette's muted colour, a faint grid at the ticks and
// fainter between, the time labelled by its year where the year changes, its date where the day changes, its time
// between, the last close a dotted line across with its value in a tag at the right. Browser code, outside src/ and
// its rule (dev/ts/STYLE.md).

import type * as D3 from "d3";
import type * as Fc from "d3fc";
import { type D3fcTail, d3fcApplied } from "../src/applied.ts";
import type { D3fc } from "../src/d3fc.ts";
import type { LayerStates, Pointer } from "../src/handle.ts";
import type { MarkLayer } from "../src/marking.ts";
import {
  colours,
  countBelow,
  type Drawn,
  drawMarks,
  drawProfile,
  followed,
  grouped,
  here,
  install,
  isDaily,
  layerIds,
  type MarkState,
  marksPrices,
  opening,
  type Palette,
  pointerOf,
  stamper,
  two,
  type View,
  volumeText,
} from "./shared.ts";

declare const d3: typeof D3;
declare const fc: typeof Fc;
declare const CHART: D3fc;
declare const PALETTE: Palette;

type Layer = D3fc["apart"][number];
type Candle = Layer["candles"][number];
type Series = Layer["series"][number];
type ProfileItem = Layer["profiles"][number];
type Scale = D3.ScaleLinear<number, number>;
// d3fc's chart, and the plot areas it takes (its types do not name them)
type Cartesian = ReturnType<typeof fc.chartCartesian<Scale, Scale>>;
type CanvasArea = Parameters<Cartesian["canvasPlotArea"]>[0];
type SvgArea = Parameters<Cartesian["svgPlotArea"]>[0];
type Decorator = Parameters<Cartesian["decorate"]>[0];

const dark = matchMedia("(prefers-color-scheme: dark)").matches;
const colour = colours("d3fc", PALETTE, dark);
const font = getComputedStyle(document.body).fontFamily;
document.body.style.background = colour("cl-bg");
document.body.style.color = colour("cl-ink");
// the axes' look, the labels' size the description's: set at each drawing
const theme = document.createElement("style");
document.head.append(theme);
const styled = () => {
  theme.textContent = [
    `#chart{font-size:${CHART.look.font}px;font-variant-numeric:tabular-nums}`,
    `#chart .tick text{fill:${colour("cl-muted")}}`,
    `#chart .domain,#chart .tick line{stroke:${colour("cl-muted")};stroke-opacity:0.5}`,
    "#chart .plot-area svg{overflow:hidden}",
  ].join("");
};
// a text's box, measured on a canvas in the font the SVG sets it in: no layout of the page is forced, as getBBox
// would at every move of the pointer
const measure = document.createElement("canvas").getContext("2d");
const textBox = (text: string, anchor: "start" | "middle" | "end", px: number, py: number, size: number) => {
  if (measure) measure.font = `${size}px ${font}`;
  const width = measure?.measureText(text).width ?? 0;
  const height = size * 1.2;
  const left = anchor === "end" ? px - width : anchor === "middle" ? px - width / 2 : px;
  return { x: left, y: py - height / 2, width, height };
};

// A layer's shapes of one kind, sorted by where they start, with the longest one's length: those in view are found
// between two binary searches.
type Indexed<T> = {
  readonly items: readonly T[];
  readonly starts: readonly number[];
  readonly longest: number;
  readonly span: (d: T) => readonly [number, number];
};
const indexedBy = <T>(list: readonly T[], span: (d: T) => readonly [number, number]): Indexed<T> => {
  const items = [...list].sort((p, q) => span(p)[0] - span(q)[0]);
  return {
    items,
    starts: items.map((d) => span(d)[0]),
    longest: items.reduce((m, d) => Math.max(m, span(d)[1] - span(d)[0]), 0),
    span,
  };
};
// the shapes in view, from a to b, a K-line spare at each side
const inViewOf = <T>(ix: Indexed<T>, a: number, b: number): readonly T[] =>
  ix.items
    .slice(countBelow(ix.starts, a - 1 - ix.longest), countBelow(ix.starts, b + 1.0001))
    .filter((d) => ix.span(d)[1] >= a - 1);

const draw = (view: View | null, markState: MarkState): Drawn => {
  styled();
  const element = document.getElementById("chart");
  if (!element) throw new Error("d3fc: the page has no #chart");
  const n = CHART.times.length;
  const open = opening(view, CHART.times);
  const groups = CHART.groups.map((g) => ({ level: g.level, colour: g.colour, items: g.layers }));
  const layers: readonly Layer[] = [...CHART.apart, ...groups.flatMap((g) => g.items)];
  const ids = layerIds(CHART.apart, groups);
  const idOf = (l: Layer) => ids.get(l) ?? l.name;
  const ticked = new Map(layers.map((l) => [l, open.off ? !open.off.has(idOf(l)) : l.on]));
  // the price distributions' layers, each its items sorted by where they start; the one chosen, or none
  const chosen: { layer: Layer | null } = { layer: null };
  const profilesOf = new Map(
    CHART.choice.layers.map((l) => {
      const items = [...l.profiles].sort((p, q) => p.x0 - q.x0);
      return [l, { items, starts: items.map((p) => p.x0) }] as const;
    }),
  );
  // the layers of marks by their keys, each shown or not
  const marked = new Map<string, { readonly layer: MarkLayer; on: boolean }>();
  // each K-line's candle by its position: to place a mark beside it, fit the price axis, and show it under the pointer
  const candleAt: (Candle | undefined)[] = new Array(n);
  CHART.apart.forEach((l) => {
    l.candles.forEach((c) => {
      candleAt[c.x] = c;
    });
  });
  // the colours of a rise and of a fall, as the candles have them
  const allCandles = CHART.apart.flatMap((l) => l.candles);
  const rise = allCandles.find((c) => c.close >= c.open)?.colour ?? "cl-up";
  const fall = allCandles.find((c) => c.close < c.open)?.colour ?? "cl-down";
  const indexed = new Map(
    layers.map((l) => [
      l,
      {
        candles: indexedBy(l.candles, (d) => [d.x, d.x]),
        boxes: indexedBy(l.boxes, (d) => [d.x0, d.x1]),
        lines: indexedBy(l.lines, (d) => [Math.min(d.x0, d.x1), Math.max(d.x0, d.x1)]),
        marks: indexedBy(l.marks, (d) => [d.x, d.x]),
      },
    ]),
  );
  // the subgraphs: one a pane above 0, under the main graph, each the description's share of its height; the main
  // graph's share of the plot's height
  const subs = Math.max(0, ...layers.flatMap((l) => l.series.map((s) => s.pane)));
  const share = 1 / (1 + subs * CHART.subgraph);
  // each layer's series, with their points' positions: those in view are found between two binary searches
  const seriesOf = new Map(
    layers.map((l) => [l, l.series.map((s) => ({ s, xs: s.points.map((p) => p.x) }))]),
  );

  // the room right of the last K-line, the look's
  const right = n - 0.5 + CHART.look.offset;
  const x = d3.scaleLinear().domain([-0.5, right]);
  const y = d3.scaleLinear();
  const daily = isDaily(CHART.times);
  const stamp = stamper(daily);
  // The state of the drawing: the time axis' ticks and the grid's step between them; the K-line under the pointer;
  // the main graph's lowest and highest price, and its price ticks; each subgraph's band and scale as last drawn
  // (for the crosshair's value there).
  const state: {
    ticks: readonly number[];
    minor: number;
    at: number | null;
    main: readonly [number, number];
    yTicks: readonly number[];
    panes: readonly { readonly top: number; readonly bottom: number; readonly ys: Scale }[];
  } = { ticks: [], minor: 1, at: null, main: [0, 1], yTicks: [], panes: [] };
  // The time axis' ticks: about eight K-lines across the view, none within a thirtieth of its edges (a label there
  // is cut off). The grid has four steps to a tick, at whole multiples, so a tick keeps its place while panning.
  const ticks = (): readonly number[] => {
    const [a = 0, b = 0] = x.domain();
    const edge = (b - a) / 30;
    const raw = Math.max(1, Math.ceil((b - a) / 8));
    state.minor = raw < 4 ? 1 : Math.round(raw / 4);
    const step = raw < 4 ? raw : 4 * state.minor;
    const lo = Math.max(0, Math.ceil((a + edge) / step) * step);
    const hi = Math.min(n - 1, Math.floor(b - edge));
    return hi < lo ? [] : d3.range(lo, hi + 1, step);
  };
  // a tick's label: the year where the year changes from the tick before, the date where the day changes, else the
  // time of day
  const label = (v: number, i: number): string => {
    const t = CHART.times[v];
    if (t === undefined) return "";
    const d = new Date(t * 1000);
    const before = i > 0 ? CHART.times[state.ticks[i - 1] ?? -1] : undefined;
    const p = before === undefined ? null : new Date(before * 1000);
    const md = `${two(d.getUTCMonth() + 1)}-${two(d.getUTCDate())}`;
    if (!p) return `${d.getUTCFullYear()}-${md}`;
    if (p.getUTCFullYear() !== d.getUTCFullYear()) return String(d.getUTCFullYear());
    if (daily || p.toISOString().slice(0, 10) !== d.toISOString().slice(0, 10)) return md;
    return `${two(d.getUTCHours())}:${two(d.getUTCMinutes())}`;
  };
  // the chosen price distribution's item over the K-line i: the last that starts at or before it and ends at or
  // after it
  const profileAt = (i: number | null): ProfileItem | null => {
    const of = chosen.layer && profilesOf.get(chosen.layer);
    if (!of || i === null) return null;
    const item = of.items[countBelow(of.starts, i + 0.5) - 1];
    return item && item.x1 >= i ? item : null;
  };
  const inView = () => {
    const [a = 0, b = 0] = x.domain();
    return b - a;
  };
  const shown = (l: Layer) => (ticked.get(l) ?? false) && (!l.fine || inView() < CHART.fine);

  // The price axis fitted to the K-lines in view, and to the marks shown there, with the description's share of the
  // height left above and below them; the main graph in the top share of the plot, the subgraphs under it.
  const fit = () => {
    const [a = 0, b = 0] = x.domain();
    let lo = Number.POSITIVE_INFINITY;
    let hi = Number.NEGATIVE_INFINITY;
    for (let i = Math.max(0, Math.ceil(a)), e = Math.min(n - 1, Math.floor(b)); i <= e; i++) {
      const c = candleAt[i];
      if (c && c.low < lo) lo = c.low;
      if (c && c.high > hi) hi = c.high;
    }
    const marks = marksPrices(
      [...marked.values()].filter((l) => l.on).flatMap((l) => l.layer.marks),
      a,
      b,
    );
    if (marks) {
      lo = Math.min(lo, marks.low);
      hi = Math.max(hi, marks.high);
    }
    if (lo > hi) return;
    const { top, bottom } = CHART.prices;
    const whole = (hi - lo || 1) / (1 - top - bottom);
    const d0 = lo - whole * bottom;
    const d1 = hi + whole * top;
    state.main = [d0, d1];
    state.yTicks = d3.scaleLinear().domain([d0, d1]).ticks(8);
    y.domain([d1 - (d1 - d0) / share, d1]);
  };

  // The canvas plot area's series, as d3fc calls it with its context: the grid, then every shown layer's shapes in
  // view, boxes first, so the candles are drawn over them.
  const painter = (): CanvasArea => {
    const holder: { ctx: CanvasRenderingContext2D | null } = { ctx: null };
    const paint = () => {
      const ctx = holder.ctx;
      if (!ctx) return;
      const dash = (dashed: boolean) => ctx.setLineDash(dashed ? [...CHART.look.dash] : []);
      const [a = 0, b = 0] = x.domain();
      const [x0 = 0, x1 = 0] = x.range();
      const [y0 = 0, y1 = 0] = y.range();
      // the main graph's bottom, and each subgraph's height under it
      const mainBottom = y(state.main[0]);
      const subHeight = subs === 0 ? 0 : (y0 - mainBottom) / subs;
      const step = Math.abs(x(1) - x(0));
      const half = step * 0.35;
      const place = { x: (at: number) => x(at), y: (p: number) => y(p), half: step / 2 };
      const marks = (boxes: boolean) =>
        drawMarks(
          ctx,
          colour,
          CHART.look.dash,
          font,
        )(
          [...marked.values()]
            .filter((l) => l.on)
            .flatMap((l) => l.layer.marks)
            .filter((m) => (m.kind === "box") === boxes),
          place,
        );
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      // the grid: faint at the ticks of both axes, fainter at the quarters between
      ctx.strokeStyle = colour("cl-state-fill");
      const major = new Set(state.yTicks);
      const tickSet = new Set(state.ticks);
      const across = (alpha: number, keep: boolean) => {
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        d3.scaleLinear()
          .domain(state.main)
          .ticks(32)
          .filter((v) => major.has(v) === keep)
          .forEach((v) => {
            const py = Math.round(y(v)) + 0.5;
            ctx.moveTo(x0, py);
            ctx.lineTo(x1, py);
          });
        d3.range(Math.ceil(a / state.minor) * state.minor, b, state.minor)
          .filter((v) => tickSet.has(v) === keep)
          .forEach((v) => {
            const px = Math.round(x(v)) + 0.5;
            ctx.moveTo(px, y0);
            ctx.lineTo(px, y1);
          });
        ctx.stroke();
      };
      across(1, true);
      across(0.5, false);
      ctx.globalAlpha = 1;
      // the main graph's shapes kept to its own region
      ctx.save();
      ctx.beginPath();
      ctx.rect(x0, y1, x1 - x0, mainBottom - y1);
      ctx.clip();
      const on = layers.filter(shown);
      const kinds = (l: Layer) => indexed.get(l);
      const boxes = on.flatMap((l) => {
        const k = kinds(l);
        return k ? inViewOf(k.boxes, a, b) : [];
      });
      const rect = (d: Layer["boxes"][number]) =>
        ctx.rect(x(d.x0) - step / 2, y(d.high), x(d.x1) - x(d.x0) + step, y(d.low) - y(d.high));
      // the boxes, those of one look in one path, filled or stroked once
      grouped(boxes, (d) => (d.fill ? JSON.stringify([d.fill.colour, d.fill.opacity]) : null)).forEach(
        (list, k) => {
          const [c, o] = JSON.parse(k) as [string, number];
          ctx.globalAlpha = o;
          ctx.fillStyle = colour(c);
          ctx.beginPath();
          list.forEach(rect);
          ctx.fill();
        },
      );
      ctx.globalAlpha = 1;
      grouped(boxes, (d) => (d.border ? JSON.stringify([d.colour, d.width ?? 1, d.dashed]) : null)).forEach(
        (list, k) => {
          const [c, w, dashed] = JSON.parse(k) as [string, number, boolean];
          ctx.strokeStyle = colour(c);
          ctx.lineWidth = w;
          dash(dashed);
          ctx.beginPath();
          list.forEach(rect);
          ctx.stroke();
        },
      );
      ctx.setLineDash([]);
      ctx.lineWidth = 1;
      marks(true);
      ctx.lineWidth = 1;
      // the price distribution under the pointer, under the candles
      const p = profileAt(state.at);
      const s = chosen.layer?.profileStyle;
      if (p && s)
        drawProfile(ctx, colour)(
          p,
          { right: x1, room: x1 - x0, span: { left: x(p.x0) - step / 2, width: x(p.x1) - x(p.x0) + step } },
          (v) => y(v),
          s,
        );
      // the series in view, each with its scale: the price axis, or its own in its band, fitted to its values in
      // view, from 0 for bars
      const shownSeries = on.flatMap((l) =>
        (seriesOf.get(l) ?? []).map(({ s, xs }) => ({
          s,
          points: s.points.slice(countBelow(xs, a - 1), countBelow(xs, b + 1.0001)),
        })),
      );
      const series = shownSeries
        .filter(({ s }) => s.pane === 0)
        .map(({ s, points }) => {
          if (s.band === undefined) return { s, points, ys: y };
          const band = s.band;
          const lo = s.form === "bars" ? 0 : (d3.min(points, (q) => q.value) ?? 0);
          const hi = Math.max(lo, d3.max(points, (q) => q.value) ?? lo);
          const h = mainBottom - y1;
          const ys = d3
            .scaleLinear()
            .domain([lo, hi === lo ? lo + 1 : hi])
            .range([mainBottom - band.bottom * h, y1 + band.top * h]);
          return { s, points, ys };
        });
      // a series' bars from 0, up or down, condensed to the tallest of each pixel, in its colour at its opacity
      const bars = (s: Series, points: readonly Series["points"][number][], ys: Scale) => {
        ctx.globalAlpha = s.opacity ?? 1;
        const tallest = new Map<number, Series["points"][number]>();
        points.forEach((q) => {
          const px = step >= 1.5 ? x(q.x) : Math.round(x(q.x));
          const t = tallest.get(px);
          if (t === undefined || Math.abs(q.value) > Math.abs(t.value)) tallest.set(px, q);
        });
        // nearly the whole room of a K-line, as Lightweight Charts draws a histogram
        const w = step >= 1.5 ? Math.max(1, step - 1) : 1;
        const base = ys(0);
        tallest.forEach((q, px) => {
          ctx.fillStyle = colour(q.colour ?? s.colour);
          const at = ys(q.value);
          ctx.fillRect(
            step >= 1.5 ? px - w / 2 : px,
            Math.min(at, base),
            w,
            Math.max(1, Math.abs(base - at)),
          );
        });
        ctx.globalAlpha = 1;
      };
      // a series' line through its values, in its colour at its opacity
      const line = (s: Series, points: readonly Series["points"][number][], ys: Scale) => {
        ctx.globalAlpha = s.opacity ?? 1;
        ctx.strokeStyle = colour(s.colour);
        ctx.lineWidth = s.width ?? 1;
        ctx.beginPath();
        points.forEach((q, i) => {
          if (i === 0) ctx.moveTo(x(q.x), ys(q.value));
          else ctx.lineTo(x(q.x), ys(q.value));
        });
        ctx.stroke();
        ctx.globalAlpha = 1;
      };
      series
        .filter(({ s }) => s.form === "bars")
        .forEach(({ s, points, ys }) => {
          bars(s, points, ys);
        });
      const candles = on.flatMap((l) => {
        const k = kinds(l);
        return k ? inViewOf(k.candles, a, b) : [];
      });
      if (step >= 1.5) {
        // each candle a wick and a body, one path a colour
        grouped(candles, (d) => d.colour).forEach((cs, c) => {
          ctx.strokeStyle = colour(c);
          ctx.fillStyle = colour(c);
          ctx.beginPath();
          cs.forEach((d) => {
            const px = Math.round(x(d.x)) + 0.5;
            ctx.moveTo(px, y(d.high));
            ctx.lineTo(px, y(d.low));
          });
          ctx.stroke();
          cs.forEach((d) => {
            const top = y(Math.max(d.open, d.close));
            ctx.fillRect(x(d.x) - half, top, 2 * half, Math.max(1, y(Math.min(d.open, d.close)) - top));
          });
        });
      } else {
        // condensed: the K-lines of each pixel one bar, its high to its low, in the colour of a rise or a fall, from
        // its first open to its last close
        const columns = new Map<number, { open: number; close: number; high: number; low: number }>();
        candles.forEach((d) => {
          const px = Math.round(x(d.x));
          const c = columns.get(px);
          if (c === undefined) columns.set(px, { open: d.open, close: d.close, high: d.high, low: d.low });
          else {
            c.close = d.close;
            c.high = Math.max(c.high, d.high);
            c.low = Math.min(c.low, d.low);
          }
        });
        [true, false].forEach((up) => {
          ctx.strokeStyle = colour(up ? rise : fall);
          ctx.beginPath();
          columns.forEach((c, px) => {
            if (c.close >= c.open !== up) return;
            ctx.moveTo(px + 0.5, y(c.high));
            ctx.lineTo(px + 0.5, y(c.low));
          });
          ctx.stroke();
        });
      }
      // the lines, those of one look in one path, stroked once
      const lines = on.flatMap((l) => {
        const k = kinds(l);
        return k ? inViewOf(k.lines, a, b) : [];
      });
      grouped(lines, (d) => JSON.stringify([d.colour, d.width ?? 1, d.dashed])).forEach((list, k) => {
        const [c, w, dashed] = JSON.parse(k) as [string, number, boolean];
        ctx.strokeStyle = colour(c);
        ctx.lineWidth = w;
        dash(dashed);
        ctx.beginPath();
        list.forEach((d) => {
          ctx.moveTo(x(d.x0), y(d.y0));
          ctx.lineTo(x(d.x1), y(d.y1));
        });
        ctx.stroke();
      });
      ctx.setLineDash([]);
      series
        .filter(({ s }) => s.form === "line")
        .forEach(({ s, points, ys }) => {
          line(s, points, ys);
        });
      ctx.lineWidth = 1;
      // a mark beside its K-line, above its high or below its low, a few pixels off: an arrow pointing at it, or a
      // circle a little further
      on.flatMap((l) => {
        const k = kinds(l);
        return k ? inViewOf(k.marks, a, b) : [];
      }).forEach((d) => {
        const c = candleAt[d.x];
        const px = x(d.x);
        const py = d.side === "above" ? y(c ? c.high : 0) - 9 : y(c ? c.low : 0) + 9;
        const k = 8 * (d.size ?? 1);
        ctx.fillStyle = colour(d.colour);
        ctx.beginPath();
        if (d.shape === "arrow") {
          const tip = d.side === "above" ? k : -k;
          ctx.moveTo(px - k, py - tip);
          ctx.lineTo(px + k, py - tip);
          ctx.lineTo(px, py + tip);
          ctx.closePath();
        } else ctx.arc(px, py + (d.side === "above" ? -13 : 13), k, 0, 2 * Math.PI);
        ctx.fill();
      });
      marks(false);
      ctx.restore();
      // Each subgraph in its band: a line above it, one scale for all its series fitted to their values in view (with
      // 0 where it has bars), its bars then its lines, three labels of its scale at the right.
      state.panes = d3.range(1, subs + 1).map((pane) => {
        const top = mainBottom + (pane - 1) * subHeight;
        const bottom = top + subHeight;
        const here = shownSeries.filter(({ s }) => s.pane === pane);
        // a scale fitted to the values in view, from 0 for bars, from `lo0` to `hi0` in pixels; by reductions, which
        // a long run's values cannot overflow
        const fitted = (
          list: readonly { readonly points: readonly Series["points"][number][] }[],
          withBars: boolean,
          lo0: number,
          hi0: number,
        ) => {
          const lo = list.reduce(
            (m, { points }) => points.reduce((v, q) => Math.min(v, q.value), m),
            withBars ? 0 : Number.POSITIVE_INFINITY,
          );
          const hi = list.reduce(
            (m, { points }) => points.reduce((v, q) => Math.max(v, q.value), m),
            withBars ? 0 : Number.NEGATIVE_INFINITY,
          );
          return d3
            .scaleLinear()
            .domain(Number.isFinite(lo) && hi > lo ? [lo, hi] : [0, 1])
            .range([lo0, hi0]);
        };
        const shared = here.filter(({ s }) => s.band === undefined);
        const ys = fitted(
          shared,
          shared.some(({ s }) => s.form === "bars"),
          bottom - 4,
          top + 4,
        );
        // a series with a band of its own: its own scale within that band of the subgraph
        const scaleOf = ({ s, points }: (typeof here)[number]) =>
          s.band === undefined
            ? ys
            : fitted(
                [{ points }],
                s.form === "bars",
                bottom - s.band.bottom * (bottom - top),
                top + s.band.top * (bottom - top),
              );
        ctx.strokeStyle = colour("cl-muted");
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.moveTo(x0, Math.round(top) + 0.5);
        ctx.lineTo(x1, Math.round(top) + 0.5);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.save();
        ctx.beginPath();
        ctx.rect(x0, top, x1 - x0, bottom - top);
        ctx.clip();
        // its grid, faint at its scale's ticks, under its series
        ctx.strokeStyle = colour("cl-state-fill");
        ctx.beginPath();
        ys.ticks(3).forEach((v) => {
          const py = Math.round(ys(v)) + 0.5;
          ctx.moveTo(x0, py);
          ctx.lineTo(x1, py);
        });
        ctx.stroke();
        here
          .filter(({ s }) => s.form === "bars")
          .forEach((d) => {
            bars(d.s, d.points, scaleOf(d));
          });
        here
          .filter(({ s }) => s.form === "line")
          .forEach((d) => {
            line(d.s, d.points, scaleOf(d));
          });
        ctx.lineWidth = 1;
        ctx.fillStyle = colour("cl-muted");
        ctx.font = `${CHART.look.font}px sans-serif`;
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ys.ticks(3).forEach((v) => {
          ctx.fillText(v.toFixed(CHART.precision), x1 - 4, ys(v));
        });
        ctx.restore();
        return { top, bottom, ys };
      });
    };
    // d3fc gives the plot area's canvas context, and its scales, which these scales already are
    const component = Object.assign(paint, {
      context: (c: unknown) => {
        holder.ctx = c as CanvasRenderingContext2D;
        return component;
      },
      xScale: () => component,
      yScale: () => component,
    });
    return component as unknown as CanvasArea;
  };

  // a tag: its text on a rectangle, at (px, py), its end or its start there
  const tag = <P extends D3.BaseType>(
    g: D3.Selection<SVGGElement, unknown, P, unknown>,
    cls: string,
    text: string,
    px: number,
    py: number,
    anchor: "start" | "end",
    fill: string,
  ) => {
    const t = g
      .selectAll<SVGGElement, number>(`g.${cls}`)
      .data([0])
      .join((en) => {
        const e = en.append("g").attr("class", cls).attr("pointer-events", "none");
        e.append("rect");
        e.append("text");
        return e;
      });
    t.select("text")
      .text(text)
      .attr("x", px)
      .attr("y", py)
      .attr("text-anchor", anchor)
      .attr("dominant-baseline", "middle")
      .attr("fill", colour("cl-bg"))
      .attr("font-size", 11);
    const box = textBox(text, anchor, px, py, 11);
    t.select("rect")
      .attr("x", box.x - 3)
      .attr("y", box.y - 1)
      .attr("width", box.width + 6)
      .attr("height", box.height + 2)
      .attr("rx", 2)
      .attr("fill", colour(fill));
    return t;
  };

  // The SVG plot area's series, above the canvas: the last close, a dotted line across with its value in a tag at
  // the right in its candle's colour; and the crosshair's place, which the pointer alone draws.
  const overlay = (): SvgArea => {
    const s = (selection: D3.Selection<SVGGElement, unknown, null, undefined>) =>
      selection.each(function () {
        const g = d3.select(this);
        const last = candleAt[n - 1];
        const lastTag = g
          .selectAll<SVGGElement, Candle>("g.last")
          .data(last ? [last] : [])
          .join((en) => {
            const t = en.append("g").attr("class", "last");
            t.append("line");
            t.append("rect");
            t.append("text");
            return t;
          });
        const [r0 = 0, r1 = 0] = x.range();
        lastTag
          .select("line")
          .attr("x1", r0)
          .attr("x2", r1)
          .attr("y1", (d) => y(d.close))
          .attr("y2", (d) => y(d.close))
          .attr("stroke", (d) => colour(d.colour))
          .attr("stroke-dasharray", "1,3");
        lastTag
          .select("text")
          .text((d) => d.close.toFixed(CHART.precision))
          .attr("x", r1 - 4)
          .attr("y", (d) => y(d.close))
          .attr("text-anchor", "end")
          .attr("dominant-baseline", "middle")
          .attr("fill", colour("cl-bg"))
          .attr("font-size", 11);
        // its tag measured, not guessed
        lastTag.each(function (d) {
          const box = textBox(d.close.toFixed(CHART.precision), "end", r1 - 4, y(d.close), 11);
          d3.select(this)
            .select("rect")
            .attr("x", box.x - 3)
            .attr("y", box.y - 1)
            .attr("width", box.width + 6)
            .attr("height", box.height + 2)
            .attr("rx", 2)
            .attr("fill", colour(d.colour));
        });
        g.selectAll("g.cross")
          .data([0])
          .join((en) => {
            const c = en.append("g").attr("class", "cross").attr("pointer-events", "none");
            c.append("line").attr("class", "cx");
            c.append("line").attr("class", "cy");
            return c;
          })
          .selectAll("line")
          .attr("stroke", colour("cl-muted"))
          .attr("stroke-dasharray", "4,4");
      });
    const component = Object.assign(s, { xScale: () => component, yScale: () => component });
    return component as unknown as SvgArea;
  };

  // The K-line at position i, its prices, and each shown layer's values there, for the legend.
  const pointerAt = (i: number): Pointer => {
    const t = CHART.times[i];
    if (t === undefined) return null;
    const values: Record<string, { readonly name: string; readonly text: string }[]> = {};
    layers.filter(shown).forEach((l) => {
      (seriesOf.get(l) ?? [])
        .filter(({ s }) => s.legend)
        .forEach(({ s, xs }) => {
          const k = countBelow(xs, i);
          const p = xs[k] === i ? s.points[k] : undefined;
          if (!p || !s.legend) return;
          const text = s.legend.format === "volume" ? volumeText(p.value) : p.value.toFixed(CHART.precision);
          values[idOf(l)] ??= [];
          values[idOf(l)]?.push({ name: s.legend.name, text });
        });
    });
    return pointerOf(stamp(t), candleAt[i], values, CHART.precision);
  };
  const listeners: ((p: Pointer) => void)[] = [];
  const colourOfLayer = (l: Layer) => {
    const q = seriesOf.get(l)?.[0];
    return colour(l.candles.length > 0 ? rise : q ? q.s.colour : "cl-ink");
  };

  const zoom = fc.zoom().on("zoom", () => render());
  const chart = fc
    .chartCartesian(x, y)
    .yOrient("right")
    .xTickFormat(label)
    .yTickFormat((v: number) => v.toFixed(CHART.precision))
    .canvasPlotArea(painter())
    .svgPlotArea(overlay())
    .decorate(((sel) => {
      // the SVG plot area is the top one: it takes the zoom and the pointer
      sel.enter().select(".svg-plot-area").call(zoom, x, null);
      sel
        .enter()
        .select(".svg-plot-area")
        .on("mouseleave", () => {
          d3.select("#chart .cross").attr("display", "none");
          const at = pointerAt(n - 1);
          listeners.forEach((fn) => {
            fn(at);
          });
        })
        .on("mousemove", (event: MouseEvent) => {
          const [mx, my] = d3.pointer(event);
          const i = Math.round(x.invert(mx));
          // the price distribution under the pointer, drawn again where its item changes; off the K-lines (after
          // the last) nothing is recorded, so the item is kept, as in tv.ts
          const was = profileAt(state.at);
          if (i >= 0 && i < n) state.at = i;
          if (chosen.layer && profileAt(state.at) !== was) render();
          const cross = d3.select<SVGGElement, unknown>("#chart .cross").attr("display", null);
          const [r0 = 0, r1 = 0] = x.range();
          const [h0 = 0, h1 = 0] = y.range();
          cross.select(".cx").attr("x1", x(i)).attr("x2", x(i)).attr("y1", h0).attr("y2", h1);
          cross.select(".cy").attr("x1", r0).attr("x2", r1).attr("y1", my).attr("y2", my);
          // the value under the pointer at the right: the main graph's price, or a subgraph's value by its scale
          const pane = state.panes.find((q) => my >= q.top && my < q.bottom);
          const value = pane ? pane.ys.invert(my) : y.invert(my);
          tag(cross, "price-tag", value.toFixed(CHART.precision), r1 - 4, my, "end", "cl-muted");
          const at = pointerAt(i);
          listeners.forEach((fn) => {
            fn(at);
          });
        });
    }) satisfies Decorator);
  const render = () => {
    fit();
    state.ticks = ticks();
    chart.xTickValues(state.ticks);
    chart.yTickValues(state.yTicks);
    d3.select("#chart").datum([]).call(chart);
  };

  // where it opens
  const show = (a: number, b: number) => {
    x.domain([a, b]);
    render();
  };
  if (open.at === "latest") x.domain([n - 400, right + 0.5]);
  else if (open.at !== "all") x.domain([open.at.from, open.at.to]);

  const unmark = (key: string) => {
    if (!marked.delete(key)) return;
    render();
  };
  const mark = (layer: MarkLayer) => {
    marked.delete(layer.key);
    marked.set(layer.key, { layer, on: markState.on(layer) });
    render();
  };

  render();
  addEventListener("resize", render);
  const unticked = () => layers.filter((l) => !ticked.get(l)).map(idOf);
  const states = (): LayerStates => ({
    apart: CHART.apart.map((l) => ({
      id: idOf(l),
      name: l.name,
      on: ticked.get(l) ?? false,
      colour: colourOfLayer(l),
      pane: seriesOf.get(l)?.[0]?.s.pane ?? 0,
    })),
    levels: groups.map((g) => ({
      level: g.level,
      colour: colour(g.colour),
      items: g.items.map((l) => ({
        id: idOf(l),
        name: l.name,
        on: ticked.get(l) ?? false,
        colour: colourOfLayer(l),
      })),
    })),
    choice: {
      name: CHART.choice.name,
      items: CHART.choice.layers.map((l) => l.name),
      chosen: chosen.layer === null ? -1 : CHART.choice.layers.indexOf(chosen.layer),
    },
    marks: [...marked.entries()].map(([key, m]) => ({ key, name: m.layer.name, on: m.on })),
  });
  const viewNow = (): View => {
    const [a = 0, b = 0] = x.domain();
    return { range: { from: a, to: b }, off: new Set(unticked()) };
  };
  return {
    mark,
    unmark,
    view: viewNow,
    remove: () => {
      removeEventListener("resize", render);
      element.replaceChildren();
    },
    // An online step's change: the page's data with the tail applied, and the chart drawn again from it (it is drawn
    // from its data, as d3fc draws) at the view the step gives (docs/designs/design-chart-online-2026-11-08.md, The
    // engines, d3fc)
    update: (tail, before) => {
      const n = CHART.times.length;
      const t = tail as D3fcTail;
      // a tail not d3fc's, or past the K-lines drawn: a fault on the console, not drawn
      if (t.contract !== "qi-d3fc-tail/1" || t.from > n) {
        console.error(`d3fc: UPDATE: not a tail of this chart (${t.contract}, from ${t.from}, ${n} K-lines)`);
        return null;
      }
      (globalThis as { CHART?: D3fc }).CHART = d3fcApplied(CHART, t);
      return followed(before ?? viewNow(), n, CHART.times.length);
    },
    ui: {
      layers: states,
      show: (id, v) => {
        layers
          .filter((l) => idOf(l) === id)
          .forEach((l) => {
            ticked.set(l, v);
          });
        render();
      },
      choose: (i) => {
        chosen.layer = i === null ? null : (CHART.choice.layers[i] ?? null);
        render();
      },
      showMark: (key, v) => {
        const m = marked.get(key);
        if (!m) return;
        m.on = v;
        markState.set(key, v);
        render();
      },
      all: () => show(-0.5, right),
      latest: () => show(n - 400, right + 0.5),
      here: () => {
        const [a = 0, b = 0] = x.domain();
        return here(CHART.times, a, b, unticked());
      },
      pointer: (fn) => {
        listeners.push(fn);
        fn(pointerAt(n - 1));
      },
      panes: () => {
        const area = element.querySelector(".plot-area");
        if (!area) return [];
        const top = area.getBoundingClientRect().top - element.getBoundingClientRect().top;
        const [, mainTop = 0] = y.range();
        const mainBottom = y(state.main[0]);
        return [
          { top: top + mainTop, height: mainBottom - mainTop },
          ...state.panes.map((q) => ({ top: top + q.top, height: q.bottom - q.top })),
        ];
      },
      colour,
    },
  };
};

install(draw);
