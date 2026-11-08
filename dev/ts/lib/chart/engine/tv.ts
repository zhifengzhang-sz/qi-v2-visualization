// tv: the engine that draws a chart's description (qi-chart/1, src/description.ts) and its layers (qi-layers/1,
// src/layers.ts) with TradingView's Lightweight Charts 5. The page gives CHART, LAYERS and PALETTE, and loads
// Lightweight Charts' standalone build before this script.
//
// Lightweight Charts' own kinds (candles, lines, histograms) are its series, with their markers and price lines. The
// drawn kinds (segments, boxes, price distributions) are primitives on the first series of their pane and price
// scale, and only what is in view is drawn. A layer's series are shown while it is ticked; a fine layer only while
// fewer than LAYERS.fine K-lines are in view. Of the price distributions (LAYERS.choice), the one chosen draws its
// item under the pointer. The marks (MARKS, or added by MARKING) are primitives on the candles. The page's controls
// use the handles (src/handle.ts). Nothing is decided here that the description, the layers and the marks do not say.
// Browser code, outside src/ and its rule (dev/ts/STYLE.md).

import type * as Lwc from "lightweight-charts";
import { type TvTail, tvApplied } from "../src/applied.ts";
import type { Box, Chart, Distribution, Segment, Series } from "../src/description.ts";
import type { LayerStates, Pointer } from "../src/handle.ts";
import type { Layer, Layers } from "../src/layers.ts";
import type { MarkLayer } from "../src/marking.ts";
import {
  colours,
  countAtMost,
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
  type View,
  volumeText,
} from "./shared.ts";

declare const LightweightCharts: typeof Lwc;
declare const CHART: Chart;
declare const LAYERS: Layers;
declare const PALETTE: Palette;

const L = LightweightCharts;
const dark = matchMedia("(prefers-color-scheme: dark)").matches;
const colour = colours("tv", PALETTE, dark);
// Lightweight Charts brands a time and some numbers in its types; the description's schemas have checked them
const time = (t: number) => t as Lwc.UTCTimestamp;
// an option's colours resolved: every string that names a palette colour
const resolved = <O extends object>(o: O): O =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === "string" ? colour(v) : v])) as O;
// Lightweight Charts' line styles 0 to 4 as canvas dashes; the dashed one (2) is the description's
const dashes = (): readonly (readonly number[])[] => [
  [],
  [1, 2],
  CHART.look?.dash ?? [6, 4],
  [10, 6],
  [1, 6],
];
const dashOf = (style: number): number[] => [...(dashes()[style] ?? [])];
// an object's fields that are given: Lightweight Charts' options take no field set to undefined
const defined = <O extends object>(o: O): { [K in keyof O]?: Exclude<O[K], undefined> } =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as {
    [K in keyof O]?: Exclude<O[K], undefined>;
  };
const font = getComputedStyle(document.body).fontFamily;
document.body.style.background = colour("cl-bg");
document.body.style.color = colour("cl-ink");

type Own = Extract<Series, { readonly type: "Candlestick" | "Line" | "Histogram" }>;
type DrawnKind = Extract<Series, { readonly type: "Segments" | "Boxes" | "Profiles" }>;
// a series as described, which an online step's tail replaces (update), and as Lightweight Charts has it
type Made = { s: Own; readonly series: Lwc.ISeriesApi<Lwc.SeriesType> };
// where a drawn kind is: the host series' K-lines by time, and the K-lines in view (one spare at each side)
type InView = { readonly place: ReadonlyMap<number, number>; readonly from: number; readonly to: number };
type Paint = (
  ctx: CanvasRenderingContext2D,
  x: (t: number) => number | null,
  y: (p: number) => number | null,
  half: number,
  size: { readonly width: number; readonly height: number },
  view: InView,
) => void;

// a series' item in Lightweight Charts' terms: its time, and its colour where it has one, resolved
const itemOf = <D extends { readonly time: number; readonly color?: string | undefined }>(d: D) => ({
  ...d,
  time: time(d.time),
  ...(d.color ? { color: colour(d.color) } : {}),
});

const isOwn = (s: Series): s is Own =>
  s.type === "Candlestick" || s.type === "Line" || s.type === "Histogram";
const isDrawn = (s: Series): s is DrawnKind => !isOwn(s);
const scaleOf = (s: { readonly options: { readonly priceScaleId?: string | undefined } }) =>
  s.options.priceScaleId || "right";

const draw = (view: View | null, markState: MarkState): Drawn => {
  const element = document.getElementById("chart");
  if (!element) throw new Error("tv: the page has no #chart");
  const chart = L.createChart(element, {
    autoSize: true,
    layout: {
      background: { color: colour("cl-bg") },
      textColor: colour("cl-ink"),
      fontSize: CHART.look?.font ?? 11,
    },
    grid: { vertLines: { color: colour("cl-state-fill") }, horzLines: { color: colour("cl-state-fill") } },
    timeScale: {
      timeVisible: true,
      secondsVisible: false,
      rightOffset: 5,
      minBarSpacing: 0.005,
      // zoomed out, bars thinner than half a pixel are merged (Lightweight Charts' conflation): a frame of the widest
      // view costs about a seventh, and crossing back to a narrow view one pass over the data, once
      enableConflation: true,
      ...defined(CHART.timeScale ?? {}),
    },
    crosshair: { mode: L.CrosshairMode.Normal },
  });

  // Lightweight Charts' own kinds, each its series. A line on the main graph's own price scale (an average) leaves
  // the scale's range to the K-lines, as the d3fc engine fits it.
  const added = (s: Own): Lwc.ISeriesApi<Lwc.SeriesType> => {
    const fitted =
      s.type === "Line" && s.paneIndex === 0 && !s.options.priceScaleId
        ? { autoscaleInfoProvider: () => null }
        : {};
    const options = { ...resolved(s.options), ...fitted };
    const data = s.data.map(itemOf);
    // the options and data are the description's, checked by its schemas, in Lightweight Charts' own names
    const series =
      s.type === "Candlestick"
        ? chart.addSeries(
            L.CandlestickSeries,
            options as Lwc.DeepPartial<Lwc.CandlestickSeriesOptions>,
            s.paneIndex,
          )
        : s.type === "Line"
          ? chart.addSeries(L.LineSeries, options as Lwc.DeepPartial<Lwc.LineSeriesOptions>, s.paneIndex)
          : chart.addSeries(
              L.HistogramSeries,
              options as Lwc.DeepPartial<Lwc.HistogramSeriesOptions>,
              s.paneIndex,
            );
    series.setData(data as Lwc.SeriesDataItemTypeMap[Lwc.SeriesType][]);
    if (s.markers)
      L.createSeriesMarkers(
        series,
        s.markers.map((m) => ({
          ...m,
          time: time(m.time),
          color: colour(m.color),
        })) as Lwc.SeriesMarker<Lwc.Time>[],
      );
    (s.priceLines ?? []).forEach((p) => {
      series.createPriceLine(resolved(p) as Lwc.CreatePriceLineOptions);
    });
    return series;
  };
  const made: readonly Made[] = CHART.series.filter(isOwn).map((s) => ({ s, series: added(s) }));

  // A drawn kind is a primitive on the first series of its pane and price scale: its prices by that series' scale,
  // its times by that series' K-lines (which Lightweight Charts places even off the screen). Boxes are under the
  // series, so a fill does not cover the candles; lines are over them. It returns the drawing's switch.
  const hostOf = (d: DrawnKind) =>
    made.find(({ s }) => s.paneIndex === d.paneIndex && scaleOf(s) === scaleOf(d));
  const primitive = (host: Made, paint: Paint, z: Lwc.PrimitivePaneViewZOrder) => {
    const state: { on: boolean; chart: Lwc.IChartApiBase<Lwc.Time> | null; update: (() => void) | null } = {
      on: true,
      chart: null,
      update: null,
    };
    const place = new Map(host.s.data.map((d, i) => [d.time, i]));
    const renderer: Lwc.IPrimitivePaneRenderer = {
      draw: (target) => {
        const ts = state.chart?.timeScale();
        if (!state.on || !ts) return;
        target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
          const x = (t: number) => {
            const i = place.get(t);
            return i === undefined ? null : ts.logicalToCoordinate(i as Lwc.Logical);
          };
          // half the room of a K-line at the present zoom; the K-lines in view, one spare at each side
          const half =
            Math.abs(
              (ts.logicalToCoordinate(1 as Lwc.Logical) ?? 0) -
                (ts.logicalToCoordinate(0 as Lwc.Logical) ?? 0),
            ) / 2;
          const r = ts.getVisibleLogicalRange();
          const inView = {
            place,
            from: r ? r.from - 1 : Number.NEGATIVE_INFINITY,
            to: r ? r.to + 1 : Number.POSITIVE_INFINITY,
          };
          paint(ctx, x, (p) => host.series.priceToCoordinate(p), half, mediaSize, inView);
          ctx.setLineDash([]);
        });
      },
    };
    host.series.attachPrimitive({
      attached: (p) => Object.assign(state, { chart: p.chart, update: p.requestUpdate }),
      detached: () => {},
      updateAllViews: () => {},
      paneViews: () => [{ zOrder: () => z, renderer: () => renderer }],
    });
    return (v: boolean) => {
      state.on = v;
      state.update?.();
    };
  };

  // the K-line under the pointer, by its time: a price distribution draws its item there
  const pointer: { time: number | null; on: boolean } = { time: null, on: false };
  // Of a price distribution's items, in time order, the last that starts at or before t and ends at or after it;
  // −1 where none. Each series' start times are listed once.
  const startsOf = new Map<readonly Distribution[], readonly number[]>();
  const itemAt = (data: readonly Distribution[], t: number): number => {
    const starts = startsOf.get(data) ?? data.map((d) => d.time);
    startsOf.set(data, starts);
    const k = countAtMost(starts, t);
    return k > 0 && (data[k - 1]?.endTime ?? -1) >= t ? k - 1 : -1;
  };
  // each price distribution's item under the pointer, by its series' id: drawn again only when it changes
  const pointed = new Map<string, number>();
  const inPane = (a: number, b: number, half: number, size: { readonly width: number }) =>
    Math.max(a, b) >= -half && Math.min(a, b) <= size.width + half;
  // A drawn kind's items by their K-lines, sorted by where they start, with the longest one's length: the items in
  // view are found between two binary searches. Made at the first drawing, since the K-lines are the host series'.
  const indexed = <T extends Segment | Box>(data: readonly T[], place: ReadonlyMap<number, number>) => {
    const items = data
      .flatMap((it) => {
        const a = place.get(it.time);
        const b = place.get(it.endTime);
        return a === undefined || b === undefined ? [] : [{ it, a: Math.min(a, b), b: Math.max(a, b) }];
      })
      .sort((p, q) => p.a - q.a);
    const starts = items.map((x) => x.a);
    const longest = items.reduce((m, x) => Math.max(m, x.b - x.a), 0);
    return (from: number, to: number): readonly T[] =>
      items
        .slice(countBelow(starts, from - longest), countBelow(starts, to + 1))
        .filter((x) => x.b >= from)
        .map((x) => x.it);
  };
  const look = (c: string | undefined, style: number | undefined) =>
    JSON.stringify([c ?? "cl-ink", style ?? 0]);
  const fromLook = (k: string) => JSON.parse(k) as [string, number];
  const boxes = (d: Extract<DrawnKind, { readonly type: "Boxes" }>): Paint => {
    const index: { of: ((from: number, to: number) => readonly Box[]) | null } = { of: null };
    return (ctx, x, y, half, size, inView) => {
      index.of ??= indexed(d.data, inView.place);
      const shown = index.of(inView.from, inView.to).flatMap((b) => {
        const x0 = x(b.time);
        const x1 = x(b.endTime);
        const y0 = y(b.high);
        const y1 = y(b.low);
        if (x0 === null || x1 === null || y0 === null || y1 === null || !inPane(x0, x1, half, size))
          return [];
        return [{ b, rect: [x0 - half, y0, x1 - x0 + 2 * half, y1 - y0] as const }];
      });
      grouped(shown, ({ b }) => b.fillColor ?? d.options.fillColor ?? null).forEach((list, f) => {
        ctx.fillStyle = colour(f);
        ctx.beginPath();
        list.forEach(({ rect }) => {
          ctx.rect(...rect);
        });
        ctx.fill();
      });
      if (d.options.borderVisible === false) return;
      ctx.lineWidth = d.options.lineWidth ?? 1;
      grouped(shown, ({ b }) => look(b.color ?? d.options.color, b.lineStyle ?? d.options.lineStyle)).forEach(
        (list, k) => {
          const [c, style] = fromLook(k);
          ctx.strokeStyle = colour(c);
          ctx.setLineDash(dashOf(style));
          ctx.beginPath();
          list.forEach(({ rect }) => {
            ctx.rect(...rect);
          });
          ctx.stroke();
        },
      );
    };
  };
  const segments = (d: Extract<DrawnKind, { readonly type: "Segments" }>): Paint => {
    const index: { of: ((from: number, to: number) => readonly Segment[]) | null } = { of: null };
    return (ctx, x, y, half, size, inView) => {
      index.of ??= indexed(d.data, inView.place);
      const lines = index.of(inView.from, inView.to).flatMap((g) => {
        const x0 = x(g.time);
        const x1 = x(g.endTime);
        const y0 = y(g.value);
        const y1 = y(g.endValue);
        if (x0 === null || x1 === null || y0 === null || y1 === null || !inPane(x0, x1, half, size))
          return [];
        return [
          {
            look: look(g.color ?? d.options.color, g.lineStyle ?? d.options.lineStyle),
            at: [x0, y0, x1, y1] as const,
          },
        ];
      });
      ctx.lineWidth = d.options.lineWidth ?? 1;
      ctx.lineCap = "round";
      grouped(lines, (l) => l.look).forEach((list, k) => {
        const [c, style] = fromLook(k);
        ctx.strokeStyle = colour(c);
        ctx.setLineDash(dashOf(style));
        ctx.beginPath();
        list.forEach(({ at: [x0, y0, x1, y1] }) => {
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
        });
        ctx.stroke();
      });
    };
  };
  const profiles = (d: Extract<DrawnKind, { readonly type: "Profiles" }>): Paint => {
    pointed.set(d.id, -1);
    const o = d.options;
    const style = {
      up: o.upColor ?? "cl-up",
      down: o.downColor ?? "cl-down",
      opacity: o.opacity ?? 0.5,
      share: o.share ?? 0.25,
    };
    return (ctx, x, y, half, size) => {
      const i = pointer.time === null ? -1 : itemAt(d.data, pointer.time);
      pointed.set(d.id, i);
      const p = d.data[i];
      if (!p) return;
      // its rows are drawn even where its K-lines cannot be placed on the host series; only the outline needs them
      const x0 = x(p.time);
      const x1 = x(p.endTime);
      const span = x0 === null || x1 === null ? null : { left: x0 - half, width: x1 - x0 + 2 * half };
      drawProfile(ctx, colour)(p, { right: size.width, room: size.width, span }, y, style);
    };
  };
  const painted = (d: DrawnKind): Paint =>
    d.type === "Boxes" ? boxes(d) : d.type === "Segments" ? segments(d) : profiles(d);
  const switches = new Map(
    CHART.series
      .filter(isDrawn)
      .filter((d) => d.options.visible !== false)
      .map((d) => {
        const host = hostOf(d);
        if (!host) throw new Error(`tv: ${d.id} has no series of its pane and price scale to be drawn on`);
        return [d.id, primitive(host, painted(d), d.type === "Segments" ? "normal" : "bottom")] as const;
      }),
  );

  // A series shown or hidden by its id. The candles are made transparent, not removed, so that they still set the
  // price scale; Lightweight Charts' other kinds by their visibility; a drawn kind by its switch.
  const candleColours = [
    "upColor",
    "downColor",
    "borderUpColor",
    "borderDownColor",
    "wickUpColor",
    "wickDownColor",
  ] as const;
  const show = (id: string, v: boolean) => {
    const m = made.find(({ s }) => s.id === id);
    if (!m) return switches.get(id)?.(v);
    if (m.s.type !== "Candlestick") return m.series.applyOptions({ visible: v });
    const o = m.s.options;
    m.series.applyOptions(
      Object.fromEntries(
        candleColours.map((k) => {
          const c = o[k];
          return [k, v ? (c === undefined ? undefined : colour(c)) : "rgba(0, 0, 0, 0)"];
        }),
      ),
    );
  };

  // the layers' markers go on the first candles: those of the layers shown
  const candles = made.find(({ s }) => s.type === "Candlestick");
  const markers = candles ? L.createSeriesMarkers(candles.series, []) : null;
  // What is read off the description's K-lines, made again after an online step (update): the candles' items, their
  // number and times; whether the chart is of days, and so its stamps; each series' last item, for the legend.
  const now = {
    data: [] as Own["data"],
    n: 0,
    times: [] as readonly number[],
    stamp: stamper(false),
    lastOf: new Map<Lwc.ISeriesApi<Lwc.SeriesType>, Own["data"][number] | undefined>(),
  };
  const counted = () => {
    now.data = candles ? candles.s.data : [];
    now.n = now.data.length;
    now.times = now.data.map((d) => d.time);
  };
  // the K-line under the pointer: its time to the day for a chart of days
  const stamped = () => {
    const daily = isDaily(now.times);
    chart.applyOptions({ timeScale: { timeVisible: !daily } });
    now.stamp = stamper(daily);
  };
  const lasts = () => {
    now.lastOf = new Map(made.map(({ s, series }) => [series, s.data[s.data.length - 1]]));
  };
  counted();
  const open = opening(view, now.times);
  const layers: readonly Layer[] = [...LAYERS.apart, ...LAYERS.levels.flatMap((g) => g.items)];
  const ids = layerIds(LAYERS.apart, LAYERS.levels);
  const idOf = (l: Layer) => ids.get(l) ?? l.name;
  const ticked = new Map(layers.map((l) => [l, open.off ? !open.off.has(idOf(l)) : l.on]));
  const fine = () => {
    const r = chart.timeScale().getVisibleLogicalRange();
    return r !== null && r.to - r.from < LAYERS.fine;
  };
  // 成交量分布: the layer chosen, or none
  const choice: { layer: Layer | null } = { layer: null };
  // Each series' visibility and the markers as last set. Only a change is given to Lightweight Charts: setting a
  // series' options recomputes its whole scale, and markers are sorted again whenever they are set.
  const shownNow = new Map<string, boolean>();
  const markersNow: { key: string | null } = { key: null };
  const apply = () => {
    const near = fine();
    const on = (l: Layer) => (ticked.get(l) ?? false) && (!l.fine || near);
    const want = new Map<string, boolean>();
    layers.forEach((l) => {
      l.series.forEach((id) => {
        want.set(id, on(l));
      });
    });
    LAYERS.choice.items.forEach((l) => {
      l.series.forEach((id) => {
        want.set(id, l === choice.layer);
      });
    });
    want.forEach((v, id) => {
      if (shownNow.get(id) === v) return;
      shownNow.set(id, v);
      show(id, v);
    });
    if (!markers) return;
    const shown = layers.filter((l) => on(l) && l.markers.length > 0);
    const key = shown.map(idOf).join("|");
    if (key === markersNow.key) return;
    markersNow.key = key;
    markers.setMarkers(
      shown
        .flatMap((l) => l.markers.map((m) => ({ ...m, time: time(m.time), color: colour(m.color) })))
        .sort((a, b) => a.time - b.time) as Lwc.SeriesMarker<Lwc.Time>[],
    );
  };
  chart.timeScale().subscribeVisibleLogicalRangeChange(apply);

  stamped();
  // the legend's series, each with the layer it belongs to
  const legend = LAYERS.legend.flatMap((e) =>
    made.filter(({ s }) => s.id === e.series).map(({ series }) => ({ e, series })),
  );
  const layerOf = (id: string) => layers.find((l) => l.series.includes(id));
  // the pane a layer is drawn in: its first series'
  const firstOf = (l: Layer) => CHART.series.find((s) => l.series.includes(s.id));
  const colourOfLayer = (l: Layer) => {
    const d = firstOf(l)?.options as { readonly color?: string; readonly upColor?: string } | undefined;
    return colour(d?.color ?? d?.upColor ?? "cl-ink");
  };
  // The K-line at `t` (else the last), its prices, and each shown layer's values there, for the legend. Under the
  // pointer, Lightweight Charts gives the values; else the last K-line's, from the description's data.
  lasts();
  const pointerAt = (
    t: number | undefined,
    seriesData: Lwc.MouseEventParams["seriesData"] | null,
  ): Pointer => {
    const at = t ?? now.data[now.n - 1]?.time;
    if (at === undefined) return null;
    const value = (series: Lwc.ISeriesApi<Lwc.SeriesType>) => {
      if (seriesData)
        return seriesData.get(series) as { readonly value?: number; readonly open?: number } | undefined;
      const d = now.lastOf.get(series);
      return d && d.time === at ? (d as { readonly value?: number; readonly open?: number }) : undefined;
    };
    const values: Record<string, { readonly name: string; readonly text: string }[]> = {};
    legend
      .filter(({ series }) => series.options().visible !== false)
      .forEach(({ e, series }) => {
        const v = value(series);
        const l = layerOf(e.series);
        if (v?.value === undefined || !l) return;
        const text = e.format === "volume" ? volumeText(v.value) : v.value.toFixed(LAYERS.precision);
        values[idOf(l)] ??= [];
        values[idOf(l)]?.push({ name: e.name, text });
      });
    const c = candles ? (value(candles.series) as Lwc.CandlestickData | undefined) : undefined;
    return pointerOf(now.stamp(at), c?.open === undefined ? undefined : c, values, LAYERS.precision);
  };
  const listeners: ((p: Pointer) => void)[] = [];
  chart.subscribeCrosshairMove((p) => {
    // The K-line under the pointer is recorded whether or not a price distribution is chosen, so that one chosen
    // later draws there. Off the K-lines (after the last) nothing is recorded, so the item drawn is kept.
    const t = p.time === undefined ? undefined : (p.time as number);
    if (t !== undefined) pointer.time = t;
    pointer.on = t !== undefined;
    const chosen = choice.layer;
    if (t !== undefined && chosen)
      chosen.series.forEach((id) => {
        const d = CHART.series.find((s) => s.id === id);
        if (d?.type === "Profiles" && pointed.get(id) !== itemAt(d.data, t)) show(id, true);
      });
    const at = t === undefined ? pointerAt(undefined, null) : pointerAt(t, p.seriesData);
    listeners.forEach((fn) => {
      fn(at);
    });
  });

  CHART.panes.forEach((p, i) => {
    const pane = chart.panes()[i];
    if (pane && p.stretchFactor) pane.setStretchFactor(p.stretchFactor);
    Object.entries(p.priceScales ?? {}).forEach(([id, o]) => {
      chart.priceScale(id, i).applyOptions(defined(o));
    });
  });

  // where it opens
  const latest = () =>
    chart
      .timeScale()
      .setVisibleLogicalRange({ from: now.n - 400, to: now.n - 1 + (CHART.timeScale?.rightOffset ?? 5) });
  const everything = () => chart.timeScale().fitContent();
  if (open.at === "latest") latest();
  else if (open.at === "all") everything();
  else chart.timeScale().setVisibleLogicalRange(open.at);

  // The marks (src/marking.ts, qi-marks/1): a layer is two primitives on the candles, at the K-lines' positions, its
  // boxes under the candles and the rest over them; its prices taken in by the price scale while it is shown.
  const onCandles = (
    host: Made,
    paint: (
      ctx: CanvasRenderingContext2D,
      x: (at: number) => number | null,
      y: (p: number) => number | null,
      half: number,
    ) => void,
    z: Lwc.PrimitivePaneViewZOrder,
    range: (a: number, b: number) => Lwc.AutoscaleInfo | null,
  ) => {
    const state: { on: boolean; chart: Lwc.IChartApiBase<Lwc.Time> | null; update: (() => void) | null } = {
      on: true,
      chart: null,
      update: null,
    };
    const renderer: Lwc.IPrimitivePaneRenderer = {
      draw: (target) => {
        const ts = state.chart?.timeScale();
        if (!state.on || !ts) return;
        target.useMediaCoordinateSpace(({ context: ctx }) => {
          const half =
            Math.abs(
              (ts.logicalToCoordinate(1 as Lwc.Logical) ?? 0) -
                (ts.logicalToCoordinate(0 as Lwc.Logical) ?? 0),
            ) / 2;
          paint(
            ctx,
            (at) => ts.logicalToCoordinate(at as Lwc.Logical),
            (p) => host.series.priceToCoordinate(p),
            half,
          );
        });
      },
    };
    const primitive: Lwc.ISeriesPrimitive<Lwc.Time> = {
      attached: (p) => Object.assign(state, { chart: p.chart, update: p.requestUpdate }),
      detached: () => {},
      updateAllViews: () => {},
      paneViews: () => [{ zOrder: () => z, renderer: () => renderer }],
      autoscaleInfo: (a, b) => (state.on ? range(a, b) : null),
    };
    host.series.attachPrimitive(primitive);
    return {
      show: (v: boolean) => {
        state.on = v;
        state.update?.();
      },
      remove: () => host.series.detachPrimitive(primitive),
    };
  };
  const marked = new Map<
    string,
    { parts: readonly ReturnType<typeof onCandles>[]; name: string; on: boolean }
  >();
  const unmark = (key: string) => {
    marked.get(key)?.parts.forEach((p) => {
      p.remove();
    });
    marked.delete(key);
  };
  const mark = (layer: MarkLayer) => {
    if (!candles) throw new Error("tv: no candles to put the marks on");
    unmark(layer.key);
    const boxes = layer.marks.filter((m) => m.kind === "box");
    const others = layer.marks.filter((m) => m.kind !== "box");
    const painter =
      (marks: typeof layer.marks) =>
      (
        ctx: CanvasRenderingContext2D,
        x: (at: number) => number | null,
        y: (p: number) => number | null,
        half: number,
      ) =>
        drawMarks(ctx, colour, dashOf(2), font)(marks, { x, y, half });
    const priceRange = (a: number, b: number): Lwc.AutoscaleInfo | null => {
      const r = marksPrices(layer.marks, a, b);
      return r ? { priceRange: { minValue: r.low, maxValue: r.high } } : null;
    };
    const parts = [
      onCandles(candles, painter(boxes), "bottom", priceRange),
      onCandles(candles, painter(others), "top", () => null),
    ];
    const on = markState.on(layer);
    parts.forEach((p) => {
      p.show(on);
    });
    marked.set(layer.key, { parts, name: layer.name, on });
  };

  apply();
  const unticked = () => layers.filter((l) => !ticked.get(l)).map(idOf);
  const states = (): LayerStates => ({
    apart: LAYERS.apart.map((l) => ({
      id: idOf(l),
      name: l.name,
      on: ticked.get(l) ?? false,
      colour: colourOfLayer(l),
      pane: firstOf(l)?.paneIndex ?? 0,
    })),
    levels: LAYERS.levels.map((g) => ({
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
      name: LAYERS.choice.name,
      items: LAYERS.choice.items.map((l) => l.name),
      chosen: choice.layer === null ? -1 : LAYERS.choice.items.indexOf(choice.layer),
    },
    marks: [...marked.entries()].map(([key, m]) => ({ key, name: m.name, on: m.on })),
  });
  const viewNow = (): View => ({
    range: chart.timeScale().getVisibleLogicalRange(),
    off: new Set(unticked()),
  });
  // the K-lines of a description: its candles' items
  const count = (c: Chart): number => c.series.find((s) => s.type === "Candlestick")?.data.length ?? 0;
  return {
    mark,
    unmark,
    view: viewNow,
    remove: () => chart.remove(),
    // An online step's change (docs/designs/design-chart-online-2026-11-08.md, The engines, tv): the page's data with
    // the tail applied; the candles' and the volume's item by `update` (the candles first, so a new time is on the
    // time scale before the rest), each add-on's items by `setData`; the view Lightweight Charts' own, following a
    // new K-line while the last is in view; what is read off the K-lines made again, and the legend's K-line, where
    // the pointer is not on one, the last again. Drawn again instead, at the view the step gives: where a drawing is
    // due already, and when a chart of one K-line is given its second, since Lightweight Charts weighs its first time
    // (and so labels it) only when it is given more than one at once.
    update: (tail, before) => {
      const t = tail as TvTail;
      const was = count(CHART);
      // a tail not tv's, or past the K-lines drawn: a fault on the console, not drawn
      if (t.contract !== "qi-chart-tail/1" || t.from > was) {
        console.error(`tv: UPDATE: not a tail of this chart (${t.contract}, from ${t.from}, ${was} K-lines)`);
        return null;
      }
      (globalThis as { CHART?: Chart }).CHART = tvApplied(CHART, t);
      const is = count(CHART);
      if (before !== null || (was === 1 && is > 1)) return followed(before ?? viewNow(), was, is);
      const ordered = [...made].sort(
        (a, b) => Number(b.s.type === "Candlestick") - Number(a.s.type === "Candlestick"),
      );
      ordered.forEach((m) => {
        const part = t.series.find((x) => x.id === m.s.id);
        const s = CHART.series.find((x) => x.id === m.s.id);
        if (part === undefined || s === undefined || !isOwn(s)) return;
        m.s = s;
        const items = (part.data as Own["data"]).map(itemOf) as Lwc.SeriesDataItemTypeMap[Lwc.SeriesType][];
        if (part.from === null) m.series.setData(items);
        else
          items.forEach((d) => {
            m.series.update(d);
          });
      });
      counted();
      stamped();
      lasts();
      if (!pointer.on || pointer.time === now.times[now.n - 1])
        listeners.forEach((fn) => {
          fn(pointerAt(undefined, null));
        });
      return null;
    },
    ui: {
      layers: states,
      show: (id, v) => {
        layers
          .filter((l) => idOf(l) === id)
          .forEach((l) => {
            ticked.set(l, v);
          });
        apply();
      },
      choose: (i) => {
        choice.layer = i === null ? null : (LAYERS.choice.items[i] ?? null);
        apply();
      },
      showMark: (key, v) => {
        const m = marked.get(key);
        if (!m) return;
        m.on = v;
        markState.set(key, v);
        m.parts.forEach((p) => {
          p.show(v);
        });
      },
      all: everything,
      latest,
      here: () => {
        const r = chart.timeScale().getVisibleLogicalRange();
        return r === null
          ? here(now.times, 0, now.n - 1, unticked())
          : here(now.times, r.from, r.to, unticked());
      },
      pointer: (fn) => {
        listeners.push(fn);
        fn(pointerAt(undefined, null));
      },
      panes: () => {
        const top = element.getBoundingClientRect().top;
        return chart.panes().map((p) => {
          const r = p.getHTMLElement()?.getBoundingClientRect();
          return r ? { top: r.top - top, height: r.height } : { top: 0, height: 0 };
        });
      },
      colour,
    },
  };
};

install(draw);
