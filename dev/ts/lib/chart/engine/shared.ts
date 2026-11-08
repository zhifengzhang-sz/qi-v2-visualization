// What both engines' scripts do the same way (tv.ts, d3fc.ts), written once: palette colours, the address a page
// opens at, the layers' ids and ticks, time stamps and volume text, the marks and the price distribution drawn on a
// canvas, and the handles the page is given (src/handle.ts). Browser code, outside src/ and its rule
// (dev/ts/STYLE.md): it draws on canvases and keeps the state of a drawn chart.

import type { D3fcTail, TvTail } from "../src/applied.ts";
import type { ChartUi, Marking, Pointer, Update, Values } from "../src/handle.ts";
import type { Mark, MarkLayer, Marks } from "../src/marking.ts";

// each palette name's colour, light then dark
export type Palette = Readonly<Record<string, readonly string[]>>;

// A palette name's colour for the page's theme; a name followed by /N is that colour at N per cent opacity
// (cl-center/8). Any other colour is returned as it is. A name the palette lacks is reported as the page's error, not
// left to fail somewhere inside a drawing.
export const colours =
  (engine: string, palette: Palette, dark: boolean) =>
  (c: string): string => {
    // only a palette name is resolved; anything else (a CSS colour, or an undecoded value) is passed through
    if (typeof c !== "string" || !c.startsWith("cl-")) return c;
    const [name = c, pct] = c.split("/");
    const hex = palette[name]?.[dark ? 1 : 0];
    if (hex === undefined) throw new Error(`${engine}: the palette has no colour ${name}`);
    if (pct === undefined) return hex;
    const n = (i: number) => Number.parseInt(hex.slice(i, i + 2), 16);
    return `rgba(${n(1)}, ${n(3)}, ${n(5)}, ${Number(pct) / 100})`;
  };

// The first index in 0…n where `before(i)` stops being true (binary search: `before` true for a prefix only).
export const search = (n: number, before: (i: number) => boolean): number => {
  let lo = 0;
  let hi = n;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (before(m)) lo = m + 1;
    else hi = m;
  }
  return lo;
};
// how many values of a sorted list are below v, or at most v
export const countBelow = (list: readonly number[], v: number): number =>
  search(list.length, (i) => (list[i] ?? Number.POSITIVE_INFINITY) < v);
export const countAtMost = (list: readonly number[], v: number): number =>
  search(list.length, (i) => (list[i] ?? Number.POSITIVE_INFINITY) <= v);

// What a chart keeps when it is drawn again: the K-lines in view, by position, and the ids of the layers unticked.
export type View = {
  readonly range: { readonly from: number; readonly to: number } | null;
  readonly off: ReadonlySet<string>;
};

// The K-lines of the times t0 to t1 (seconds), as another period's page gives them: from the one at or before t0 to
// the one at or after t1, and at least 21 K-lines (all of them, if the chart has fewer).
const places = (times: readonly number[], t0: number, t1: number): readonly [number, number] => {
  const n = times.length;
  const a = Math.max(0, countAtMost(times, t0) - 1);
  const b = Math.min(n - 1, countAtMost(times, t1 - 1));
  if (b - a >= 20) return [a, b];
  const from = Math.max(0, Math.min(n - 21, Math.round((a + b) / 2) - 10));
  return [from, Math.min(n - 1, from + 20)];
};

// Where a chart opens, and which layers are unticked (null: each as its layer says). When drawn again, as it was.
// Otherwise as the address says: #latest, the last 400 K-lines; #range=FROM-TO, those K-lines by position;
// #time=FROM-TO, the K-lines of those times; and off=ID,…, the layers unticked. With none of these, all the K-lines.
export const opening = (
  view: View | null,
  times: readonly number[],
): {
  readonly at: { readonly from: number; readonly to: number } | "latest" | "all";
  readonly off: ReadonlySet<string> | null;
} => {
  const address = new URLSearchParams(location.hash.slice(1));
  const off = view ? view.off : address.has("off") ? new Set((address.get("off") ?? "").split(",")) : null;
  const pair = (k: string) => {
    const m = /^([0-9]+)-([0-9]+)$/.exec(address.get(k) ?? "");
    return m ? ([Number(m[1]), Number(m[2])] as const) : null;
  };
  const range = pair("range");
  const time = pair("time");
  if (view?.range) return { at: view.range, off };
  if (range) return { at: { from: range[0], to: range[1] }, off };
  if (time) {
    const [a, b] = places(times, time[0], time[1]);
    return { at: { from: a - 0.5, to: b + 0.5 }, off };
  }
  return { at: address.has("latest") ? "latest" : "all", off };
};

// The address of the K-lines from a to b, by their times, with the layers unticked: another period's page opens there.
export const here = (times: readonly number[], a: number, b: number, unticked: readonly string[]): string => {
  const at = (v: number) => times[Math.min(times.length - 1, Math.max(0, Math.round(v)))];
  return `time=${at(a)}-${at(b)}&off=${unticked.map(encodeURIComponent).join(",")}`;
};

// Each layer's id: its name, or for a level's layer, the level and its name (1:中枢).
export const layerIds = <L extends { readonly name: string }>(
  apart: readonly L[],
  levels: readonly { readonly level: number; readonly items: readonly L[] }[],
): ReadonlyMap<L, string> =>
  new Map([
    ...apart.map((l): [L, string] => [l, l.name]),
    ...levels.flatMap((g) => g.items.map((l): [L, string] => [l, `${g.level}:${l.name}`])),
  ]);

// a time's stamp: its date, and its time of day unless the K-lines are days
export const two = (n: number): string => String(n).padStart(2, "0");
export const isDaily = (times: readonly number[]): boolean =>
  times.length > 1 && (times[1] ?? 0) - (times[0] ?? 0) >= 86400;
export const stamper =
  (daily: boolean) =>
  (t: number): string => {
    const d = new Date(t * 1000);
    const day = `${d.getUTCFullYear()}-${two(d.getUTCMonth() + 1)}-${two(d.getUTCDate())}`;
    return daily ? day : `${day} ${two(d.getUTCHours())}:${two(d.getUTCMinutes())}`;
  };

// A volume as Lightweight Charts writes it: with K, M or B, and two decimals at most.
export const volumeText = (v: number): string => {
  const d = (t: number) => String(Math.round(t * 100) / 100);
  const a = Math.abs(v);
  const text =
    a < 995
      ? d(a)
      : a < 999995
        ? `${d(a / 1e3)}K`
        : a < 999999995
          ? `${d(Math.round(a / 1e3) / 1e3)}M`
          : `${d(Math.round(a / 1e6) / 1e3)}B`;
  return (v < 0 ? "-" : "") + text;
};

// Items grouped by a key (null: left out), so that the items of one look are drawn as one path.
export const grouped = <T>(items: readonly T[], key: (t: T) => string | null): ReadonlyMap<string, T[]> =>
  items.reduce((m, it) => {
    const k = key(it);
    if (k === null) return m;
    const list = m.get(k);
    if (list) list.push(it);
    else m.set(k, [it]);
    return m;
  }, new Map<string, T[]>());

// A mark's first and last K-line, and its lowest and highest price.
const markSpan = (m: Mark): readonly [number, number, number, number] =>
  m.kind === "box"
    ? [m.from, m.to, m.low, m.high]
    : m.kind === "line"
      ? [
          Math.min(m.from.at, m.to.at),
          Math.max(m.from.at, m.to.at),
          Math.min(m.from.price, m.to.price),
          Math.max(m.from.price, m.to.price),
        ]
      : [m.at.at, m.at.at, m.at.price, m.at.price];

// The lowest and highest price of the marks over the K-lines a to b, so that the price axis takes them in as it takes
// the K-lines; null where no mark is there. By reductions, so any number of marks is fine.
export const marksPrices = (
  marks: readonly Mark[],
  a: number,
  b: number,
): { readonly low: number; readonly high: number } | null => {
  const spans = marks.map(markSpan).filter(([f, t]) => t >= a && f <= b);
  return spans.length === 0
    ? null
    : {
        low: spans.reduce((m, s) => Math.min(m, s[2]), Number.POSITIVE_INFINITY),
        high: spans.reduce((m, s) => Math.max(m, s[3]), Number.NEGATIVE_INFINITY),
      };
};

// Where things are on the canvas: a K-line's position and a price as pixels (null where the engine cannot place
// them), and half the room of a K-line.
export type Place = {
  readonly x: (at: number) => number | null;
  readonly y: (price: number) => number | null;
  readonly half: number;
};

// a text beside its point: its alignment, its baseline, and the direction it is moved off the point
const beside = {
  above: ["center", "bottom", 0, -1],
  below: ["center", "top", 0, 1],
  left: ["right", "middle", -1, 0],
  right: ["left", "middle", 1, 0],
} as const;

// The marks drawn on a canvas: a box over its K-lines, filled at its opacity, bordered where asked; a line, dashed
// where asked; a dot; a text beside its point, with a halo of the background's colour so it reads over the candles.
export const drawMarks =
  (ctx: CanvasRenderingContext2D, colour: (c: string) => string, dash: readonly number[], font: string) =>
  (marks: readonly Mark[], p: Place): void =>
    marks.forEach((m) => {
      ctx.strokeStyle = colour(m.colour);
      ctx.fillStyle = colour(m.colour);
      if (m.kind === "box") {
        const x0 = p.x(m.from);
        const x1 = p.x(m.to);
        const y0 = p.y(m.high);
        const y1 = p.y(m.low);
        if (x0 === null || x1 === null || y0 === null || y1 === null) return;
        ctx.globalAlpha = m.opacity;
        ctx.fillRect(x0 - p.half, y0, x1 - x0 + 2 * p.half, y1 - y0);
        ctx.globalAlpha = 1;
        if (m.border) {
          ctx.lineWidth = 1;
          ctx.strokeRect(x0 - p.half, y0, x1 - x0 + 2 * p.half, y1 - y0);
        }
      } else if (m.kind === "line") {
        const x0 = p.x(m.from.at);
        const x1 = p.x(m.to.at);
        const y0 = p.y(m.from.price);
        const y1 = p.y(m.to.price);
        if (x0 === null || x1 === null || y0 === null || y1 === null) return;
        ctx.lineWidth = m.width;
        ctx.setLineDash(m.dashed ? [...dash] : []);
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        const px = p.x(m.at.at);
        const py = p.y(m.at.price);
        if (px === null || py === null) return;
        if (m.kind === "dot") {
          ctx.beginPath();
          ctx.arc(px, py, m.size, 0, 2 * Math.PI);
          ctx.fill();
        } else {
          const [align, baseline, dx, dy] = beside[m.anchor];
          ctx.font = `${m.size}px ${font}`;
          ctx.textAlign = align;
          ctx.textBaseline = baseline;
          ctx.strokeStyle = colour("cl-bg");
          ctx.lineWidth = 3;
          ctx.lineJoin = "round";
          ctx.strokeText(m.text, px + 6 * dx, py + 6 * dy);
          ctx.fillText(m.text, px + 6 * dx, py + 6 * dy);
        }
      }
    });

// A price distribution: from `low`, rows of `step` (one row at `low` when `step` is 0), each with its up and down
// volume; `poc` the point of control's row, `valueFrom` to `valueTo` the value area's.
export type Profile = {
  readonly low: number;
  readonly step: number;
  readonly up: readonly number[];
  readonly down: readonly number[];
  readonly poc: number;
  readonly valueFrom: number;
  readonly valueTo: number;
};
export type ProfileStyle = {
  readonly up: string;
  readonly down: string;
  readonly opacity: number;
  readonly share: number;
};

// A price distribution drawn on a canvas: its rows out from the right edge (`right`), the longest `share` of the
// width (`room`); the value area at the style's opacity, the other rows at half of it. Where its K-lines can be
// placed (`span`, from `left` over `width`), they are outlined, dashed, and the point of control is a line from them
// to the right edge.
export const drawProfile =
  (ctx: CanvasRenderingContext2D, colour: (c: string) => string) =>
  (
    p: Profile,
    at: {
      readonly right: number;
      readonly room: number;
      readonly span: { readonly left: number; readonly width: number } | null;
    },
    y: (price: number) => number | null,
    s: ProfileStyle,
  ): void => {
    const rows = p.up.length;
    const most = p.up.reduce((m, u, r) => Math.max(m, u + (p.down[r] ?? 0)), 1);
    const room = s.share * at.room;
    p.up.forEach((u, r) => {
      const top = y(p.step === 0 ? p.low : p.low + (r + 1) * p.step);
      const foot = y(p.step === 0 ? p.low : p.low + r * p.step);
      if (top === null || foot === null) return;
      const h = p.step === 0 ? 2 : Math.max(1, foot - top - (foot - top > 3 ? 1 : 0));
      ctx.globalAlpha = s.opacity * (r >= p.valueFrom && r <= p.valueTo ? 1 : 0.5);
      const wu = (room * u) / most;
      const wd = (room * (p.down[r] ?? 0)) / most;
      ctx.fillStyle = colour(s.up);
      ctx.fillRect(at.right - wu, top, wu, h);
      ctx.fillStyle = colour(s.down);
      ctx.fillRect(at.right - wu - wd, top, wd, h);
    });
    ctx.globalAlpha = 1;
    const yt = y(p.step === 0 ? p.low : p.low + rows * p.step);
    const yb = y(p.low);
    const yp = y(p.low + (p.poc + 0.5) * p.step);
    const span = at.span;
    if (span === null || yt === null || yb === null) return;
    ctx.strokeStyle = colour("cl-muted");
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(span.left, yt, span.width, Math.max(1, yb - yt));
    ctx.setLineDash([]);
    if (yp === null) return;
    ctx.strokeStyle = colour("cl-ink");
    ctx.beginPath();
    ctx.moveTo(span.left, yp);
    ctx.lineTo(at.right, yp);
    ctx.stroke();
  };

// Whether each layer of marks is shown, as the page last set it: kept when the chart is drawn again.
export type MarkState = {
  readonly on: (layer: MarkLayer) => boolean;
  readonly set: (key: string, on: boolean) => void;
};

// A chart as an engine has drawn it.
export type Drawn = {
  readonly mark: (layer: MarkLayer) => void;
  readonly unmark: (key: string) => void;
  readonly view: () => View;
  readonly remove: () => void;
  readonly ui: ChartUi;
  // an online step's change (docs/designs/design-chart-online-2026-11-08.md, The engines): its tail applied to the
  // page's data and to the chart as drawn, giving null; or, for an engine that draws again from its data, the view to
  // draw it again at, from the view it would have (`before`, where a drawing is already due) or its own
  readonly update: (tail: TvTail | D3fcTail, before: View | null) => View | null;
};

type Page = typeof globalThis & {
  MARKS?: Marks;
  REDRAW?: () => void;
  UPDATE?: Update;
  CHART_UI?: ChartUi;
  MARKING?: Marking;
};

// An online step's view (docs/designs/design-chart-online-2026-11-08.md, guarantee 5): the K-lines in view moved on
// by those appended while the last of them is in view, else held.
export const followed = (view: View, before: number, after: number): View => {
  const r = view.range;
  const last = before - 1;
  return r !== null && after > before && r.from <= last && last <= r.to
    ? { ...view, range: { from: r.from + after - before, to: r.to + after - before } }
    : view;
};

// The chart drawn, with the page's marks (MARKS) and those added since, and the handles given to the page: REDRAW
// draws it again from the page's data as it is then, keeping the view, the layers unticked, the marks added and
// which marks are shown; CHART_UI always reaches the chart as drawn now; MARKING adds or takes away a layer of marks;
// UPDATE applies an online step's tail, the engine updating its chart in place or, where it draws again from its
// data, the chart drawn again once a frame at the view the step gives, the page's pointer callbacks kept.
export const install = (draw: (view: View | null, marks: MarkState) => Drawn): void => {
  const page = globalThis as Page;
  const added = new Map<string, MarkLayer>();
  const shown = new Map<string, boolean>();
  const marks: MarkState = {
    on: (layer) => shown.get(layer.key) ?? layer.on,
    set: (key, on) => shown.set(key, on),
  };
  const drawn = (view: View | null): Drawn => {
    const d = draw(view, marks);
    (page.MARKS?.layers ?? []).forEach(d.mark);
    added.forEach(d.mark);
    return d;
  };
  const current = { d: drawn(null) };
  // the page's pointer callbacks since the chart was last drawn again by REDRAW (after which the page gives them
  // again): a chart drawn again by UPDATE is given them
  const callbacks = new Set<(p: Pointer) => void>();
  page.REDRAW = () => {
    const view = current.d.view();
    callbacks.clear();
    current.d.remove();
    current.d = drawn(view);
  };
  // a drawing due by UPDATE, at its view; and how many times the chart has been drawn again by it
  const due: { view: View | null; drawings: number } = { view: null, drawings: 0 };
  page.UPDATE = (tail) => {
    const view = current.d.update(tail, due.view);
    if (view === null) return;
    if (due.view === null)
      requestAnimationFrame(() => {
        const at = due.view;
        due.view = null;
        current.d.remove();
        current.d = drawn(at);
        due.drawings += 1;
        const drawing = due.drawings;
        // the page's pointer callbacks, once the chart drawn again has laid out its panes (on its first frame), and
        // only where it has not been drawn again since
        requestAnimationFrame(() => {
          if (drawing === due.drawings)
            callbacks.forEach((fn) => {
              current.d.ui.pointer(fn);
            });
        });
      });
    due.view = view;
  };
  page.CHART_UI = new Proxy({} as ChartUi, {
    get: (_, k) =>
      k === "pointer"
        ? (fn: (p: Pointer) => void) => {
            callbacks.add(fn);
            current.d.ui.pointer(fn);
          }
        : current.d.ui[k as keyof ChartUi],
  });
  page.MARKING = {
    mark: (layer) => {
      added.set(layer.key, layer);
      current.d.mark(layer);
    },
    unmark: (key) => {
      added.delete(key);
      current.d.unmark(key);
    },
  };
};

// The legend's line for a K-line: its stamp, its prices to `digits` places, and the values given.
export const pointerOf = (
  stamp: string,
  candle:
    | { readonly open: number; readonly high: number; readonly low: number; readonly close: number }
    | undefined,
  values: Values,
  digits: number,
): Pointer => {
  const f = (v: number) => v.toFixed(digits);
  return {
    stamp,
    candle: candle
      ? {
          open: f(candle.open),
          high: f(candle.high),
          low: f(candle.low),
          close: f(candle.close),
          up: candle.close >= candle.open,
        }
      : null,
    values,
  };
};
