// tikz, the static picture (docs/designs/design-chart-lib-2026-10-24.md, The engines, tikz; version 1.6): a chart's
// drawing as a standalone TikZ document for XeLaTeX, for a PDF. It takes the primitives as the d3fc engine
// records them (d3fc.ts), by K-line position and price, and lays them out:
// - K-lines `from` to `to`, in a picture `width` by `height` centimetres;
// - the layers on at first; a fine layer only if the range is under the drawing's `fine`; no 成交量分布 (a picture
//   has no pointer);
// - the main graph fitted to the candles in the range, within the drawing's margins; each subgraph below it, the
//   layout's share of its height, with one scale for its series (or a series' own band); each pane clipped;
// - no text measured: each label placed by its anchor (prices right of the main graph, dates under the last pane,
//   the title above).
// Colours are the palette's light or dark ones, by the theme, set as a document that takes the picture may set it:
// page cl-bg, text cl-ink, the picture under the style `cl chart`, so the picture on its own looks as it does in such
// a document. The caller's marks (marking.ts) are drawn for the layers on at first: boxes
// under the candles, the rest over them, their prices taken into the main graph's range like the K-lines'. A text's
// size is in pixels as on the pages, three quarters of that in points.

import { pipe, type QiError, type Result, result } from "@qi/base";
import { type D3Part, d3fcEngine } from "./d3fc.ts";
import { type Bars, type Components, drawing, type Shown } from "./drawing.ts";
import type { Drawing, Layer, Margins } from "./dsl.ts";
import { componentsOf, type Located, type LocateError, located } from "./locate.ts";
import { type Mark, type MarkingError, type MarkLayer, marksOn } from "./marking.ts";
import { layoutDefaults } from "./schemas.ts";

export type TikzOptions = {
  // the K-lines drawn, by position
  readonly from: number;
  readonly to: number;
  // the picture's size, in centimetres
  readonly width: number;
  readonly height: number;
  // each palette name's light and dark colour (`#RRGGBB`), and which of the two the picture uses
  readonly palette: { readonly [name: string]: readonly string[] };
  readonly theme: "light" | "dark";
};

type Part = D3Part;
type Candle = Extract<Part, { readonly candle: unknown }>["candle"];
type Series = Extract<Part, { readonly series: unknown }>["series"];

const n3 = (v: number): string => (Math.round(v * 1000) / 1000).toString();

// TeX's special characters in a text
const tex = (s: string): string =>
  s.replace(/[\\{}$&#^_%~]/g, (c) =>
    c === "\\"
      ? "\\textbackslash{}"
      : c === "~"
        ? "\\textasciitilde{}"
        : c === "^"
          ? "\\textasciicircum{}"
          : `\\${c}`,
  );

// about `count` round values from lo to hi: steps of 1, 2 or 5 times a power of ten
export const ticks = (lo: number, hi: number, count: number): readonly number[] => {
  const raw = (hi - lo) / Math.max(1, count);
  if (!(raw > 0)) return [];
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((k) => k * power).find((s) => s >= raw) ?? 10 * power;
  const first = Math.ceil(lo / step);
  const last = Math.floor(hi / step);
  return Array.from(
    { length: Math.max(0, last - first + 1) },
    (_, i) => Math.round((first + i) * step * 1e9) / 1e9,
  );
};

// days since 1970-01-01 as a calendar date (H. Hinnant's civil_from_days); a time as its date, or as its date and
// minute if the K-lines are finer than a day
const civil = (days: number): readonly [number, number, number] => {
  const z = days + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor(
    (doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365,
  );
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  return [yoe + era * 400 + (m <= 2 ? 1 : 0), m, d];
};
const two = (v: number): string => String(v).padStart(2, "0");
const stamp =
  (daily: boolean) =>
  (t: number): string => {
    const [y, m, d] = civil(Math.floor(t / 86400));
    const s = t % 86400;
    return daily
      ? `${y}-${two(m)}-${two(d)}`
      : `${two(m)}-${two(d)} ${two(Math.floor(s / 3600))}:${two(Math.floor((s % 3600) / 60))}`;
  };

// The segment from (x0, y0) to (x1, y1) cut to the rectangle xa..xb, ya..yb (Liang–Barsky); none if it misses it.
// TeX takes no dimension past 16383pt (about 575 cm), so no line is written far outside the picture.
export const cut = (
  [x0, y0]: readonly [number, number],
  [x1, y1]: readonly [number, number],
  [xa, xb, ya, yb]: readonly [number, number, number, number],
): readonly [readonly [number, number], readonly [number, number]] | undefined => {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const edges: readonly (readonly [number, number])[] = [
    [-dx, x0 - xa],
    [dx, xb - x0],
    [-dy, y0 - ya],
    [dy, yb - y0],
  ];
  const span = edges.reduce<readonly [number, number] | undefined>(
    (s, [k, q]) =>
      s === undefined
        ? undefined
        : k === 0
          ? q < 0
            ? undefined
            : s
          : ((next: readonly [number, number]) => (next[0] > next[1] ? undefined : next))(
              k < 0 ? [Math.max(s[0], q / k), s[1]] : [s[0], Math.min(s[1], q / k)],
            ),
    [0, 1],
  );
  return span === undefined
    ? undefined
    : [
        [x0 + span[0] * dx, y0 + span[0] * dy],
        [x0 + span[1] * dx, y0 + span[1] * dy],
      ];
};

// a scale: values lo to hi onto y0 to y1 (centimetres, y upward)
const scale =
  (lo: number, hi: number, y0: number, y1: number) =>
  (v: number): number =>
    hi === lo ? (y0 + y1) / 2 : y0 + ((v - lo) / (hi - lo)) * (y1 - y0);

// the range of the series' values over the K-lines drawn, from 0 for bars
const extent = (ss: readonly Series[], from: number, to: number): readonly [number, number] => {
  const vs = ss.flatMap((s) => s.points.filter((p) => p.x >= from && p.x <= to).map((p) => p.value));
  const withBars = ss.some((s) => s.form === "bars");
  const lo = vs.reduce((m, v) => Math.min(m, v), withBars ? 0 : Number.POSITIVE_INFINITY);
  const hi = vs.reduce((m, v) => Math.max(m, v), withBars ? 0 : Number.NEGATIVE_INFINITY);
  return Number.isFinite(lo) && hi > lo ? [lo, hi] : [0, 1];
};

// a drawing as a standalone TikZ document, given the K-lines' times for the dates
export const tikzPicture = (
  d: Drawing<readonly Part[]>,
  times: readonly number[],
  o: TikzOptions,
  marked: readonly MarkLayer[] = [],
): string => {
  const { from, to, width: W, height: H } = o;
  const count = to - from + 1;
  const step = W / count;
  const shown = (l: Layer<readonly Part[]>): boolean => l.on && (!l.fine || count < d.fine);
  const layers = [
    ...d.apart.filter(shown),
    ...d.groups.filter((g) => g.on).flatMap((g) => g.layers.filter(shown)),
  ];
  const parts = layers.flatMap((l) => l.parts.flat());
  const candles = parts.flatMap((p) =>
    "candle" in p && p.candle.x >= from && p.candle.x <= to ? [p.candle] : [],
  );
  const at = new Map(candles.map((c): [number, Candle] => [c.x, c]));
  const series = parts.flatMap((p) => ("series" in p ? [p.series] : []));
  // the subgraphs of every series, shown or not, as the pages keep a pane for an add-on that is off
  const subs = [...d.apart, ...d.groups.flatMap((g) => g.layers)]
    .flatMap((l) => l.parts.flat())
    .reduce((m, q) => ("series" in q ? Math.max(m, q.series.pane) : m), 0);
  const mainH = H / (1 + subs * d.subgraph);
  const subH = subs === 0 ? 0 : (H - mainH) / subs;
  const mainBottom = H - mainH;
  // the marks of the layers on at first, within the K-lines drawn; a point kept inside the picture
  const ours = marked.filter((l) => l.on).flatMap((l) => l.marks);
  const inRange = (m: Mark): boolean =>
    m.kind === "box"
      ? m.to >= from && m.from <= to
      : m.kind === "line"
        ? Math.max(m.from.at, m.to.at) >= from && Math.min(m.from.at, m.to.at) <= to
        : m.at.at >= from && m.at.at <= to;
  // the marks' lowest and highest prices, taken into the main graph's range like the K-lines'
  const priced = ours
    .filter(inRange)
    .map((m): readonly [number, number] =>
      m.kind === "box"
        ? [m.low, m.high]
        : m.kind === "line"
          ? [Math.min(m.from.price, m.to.price), Math.max(m.from.price, m.to.price)]
          : [m.at.price, m.at.price],
    );
  // by reductions rather than spreading, so any number of marks is fine
  const lo = priced.reduce(
    (m, [l]) => Math.min(m, l),
    candles.reduce((m, c) => Math.min(m, c.low), Number.POSITIVE_INFINITY),
  );
  const hi = priced.reduce(
    (m, [, h]) => Math.max(m, h),
    candles.reduce((m, c) => Math.max(m, c.high), Number.NEGATIVE_INFINITY),
  );
  const whole = (hi - lo || 1) / (1 - d.prices.top - d.prices.bottom);
  const [p0, p1] = [lo - whole * d.prices.bottom, hi + whole * d.prices.top];
  const X = (x: number): number => (x - from + 0.5) * step;
  const Y = scale(p0, p1, mainBottom, H);
  const half = Math.min(0.35 * step, 0.2);
  const lw = (w: number | undefined): string => `line width=${n3(0.75 * (w ?? 1))}pt`;
  // the page's dash, at three quarters (pixels to points)
  const dashed = (b: boolean): string =>
    b ? `, dash pattern=on ${n3(0.75 * d.look.dash[0])}pt off ${n3(0.75 * d.look.dash[1])}pt` : "";
  // a pane's band, bottom to top, and a series' scale in it (its own band's, if it has one)
  const paneOf = (pane: number): readonly [number, number] =>
    pane === 0 ? [mainBottom, H] : [mainBottom - pane * subH, mainBottom - (pane - 1) * subH];
  const bandOf = (b: Margins | undefined, [y0, y1]: readonly [number, number]): readonly [number, number] =>
    b === undefined ? [y0, y1] : [y0 + b.bottom * (y1 - y0), y1 - b.top * (y1 - y0)];
  const scaleOf = (s: Series): ((v: number) => number) => {
    const band = bandOf(s.band, paneOf(s.pane));
    const shared = series.filter((t) => t.pane === s.pane && t.band === undefined);
    const [vlo, vhi] =
      s.band === undefined ? (s.pane === 0 ? [p0, p1] : extent(shared, from, to)) : extent([s], from, to);
    const pad = s.band === undefined && s.pane !== 0 ? 0.05 : 0;
    return scale(vlo, vhi, band[0] + pad, band[1] - pad);
  };
  const boxes = parts.flatMap((p) => ("box" in p && p.box.x1 >= from && p.box.x0 <= to ? [p.box] : []));
  const lines = parts.flatMap((p) =>
    "line" in p && Math.max(p.line.x0, p.line.x1) >= from && Math.min(p.line.x0, p.line.x1) <= to
      ? [p.line]
      : [],
  );
  const marks = parts.flatMap((p) => ("mark" in p && p.mark.x >= from && p.mark.x <= to ? [p.mark] : []));
  // the picture's area with a margin around it: lines are cut to it, boxes and mark points held within it
  const room: readonly [number, number, number, number] = [-1, W + 1, -1, H + 1];
  const within = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
  const drawBox = (b: (typeof boxes)[number]): string => {
    const [xa, xb, ya, yb] = room;
    const rect = `(${n3(within(X(b.x0) - step / 2, xa, xb))},${n3(within(Y(b.low), ya, yb))}) rectangle (${n3(within(X(b.x1) + step / 2, xa, xb))},${n3(within(Y(b.high), ya, yb))})`;
    return [
      ...(b.fill === undefined ? [] : [`\\fill[${b.fill.colour}, opacity=${n3(b.fill.opacity)}] ${rect};`]),
      ...(b.border ? [`\\draw[${b.colour}, ${lw(b.width)}${dashed(b.dashed)}] ${rect};`] : []),
    ].join("\n");
  };
  const drawCandle = (c: Candle): string => {
    const top = Y(Math.max(c.open, c.close));
    const bottom = Y(Math.min(c.open, c.close));
    return [
      `\\draw[${c.colour}, ${lw(1)}] (${n3(X(c.x))},${n3(Y(c.low))}) -- (${n3(X(c.x))},${n3(Y(c.high))});`,
      `\\fill[${c.colour}] (${n3(X(c.x) - half)},${n3(bottom)}) rectangle (${n3(X(c.x) + half)},${n3(Math.max(top, bottom + 0.01))});`,
    ].join("\n");
  };
  const drawLine = (l: (typeof lines)[number]): string => {
    const c = cut([X(l.x0), Y(l.y0)], [X(l.x1), Y(l.y1)], room);
    return c === undefined
      ? ""
      : `\\draw[${l.colour}, ${lw(l.width)}${dashed(l.dashed)}, line cap=round] (${n3(c[0][0])},${n3(c[0][1])}) -- (${n3(c[1][0])},${n3(c[1][1])});`;
  };
  const drawMark = (m: (typeof marks)[number]): string => {
    const c = at.get(m.x);
    const k = 0.06 * (m.size ?? 1);
    const y = m.side === "above" ? Y(c?.high ?? p1) + 0.1 : Y(c?.low ?? p0) - 0.1;
    const x = X(m.x);
    return m.shape === "circle"
      ? `\\fill[${m.colour}] (${n3(x)},${n3(m.side === "above" ? y + k : y - k)}) circle (${n3(k)});`
      : `\\fill[${m.colour}] (${n3(x - k)},${n3(m.side === "above" ? y + k : y - k)}) -- (${n3(x + k)},${n3(m.side === "above" ? y + k : y - k)}) -- (${n3(x)},${n3(y)}) -- cycle;`;
  };
  const markBoxes = ours.filter((m) => m.kind === "box" && inRange(m));
  const markRest = ours.filter((m) => m.kind !== "box" && inRange(m));
  // a text beside its point: its anchor and its shift, six pixels off, as on the pages
  const beside = {
    above: "anchor=south, yshift=4.5pt",
    below: "anchor=north, yshift=-4.5pt",
    left: "anchor=east, xshift=-4.5pt",
    right: "anchor=west, xshift=4.5pt",
  } as const;
  const drawOurs = (m: Mark): string => {
    const [xa, xb, ya, yb] = room;
    const pt = (at: number, price: number): string =>
      `(${n3(within(X(at), xa, xb))},${n3(within(Y(price), ya, yb))})`;
    if (m.kind === "box") {
      const rect = `(${n3(within(X(m.from) - step / 2, xa, xb))},${n3(within(Y(m.low), ya, yb))}) rectangle (${n3(within(X(m.to) + step / 2, xa, xb))},${n3(within(Y(m.high), ya, yb))})`;
      return [
        `\\fill[${m.colour}, opacity=${n3(m.opacity)}] ${rect};`,
        ...(m.border ? [`\\draw[${m.colour}, ${lw(1)}] ${rect};`] : []),
      ].join("\n");
    }
    if (m.kind === "line") {
      const c = cut([X(m.from.at), Y(m.from.price)], [X(m.to.at), Y(m.to.price)], room);
      return c === undefined
        ? ""
        : `\\draw[${m.colour}, ${lw(m.width)}${dashed(m.dashed)}, line cap=round] (${n3(c[0][0])},${n3(c[0][1])}) -- (${n3(c[1][0])},${n3(c[1][1])});`;
    }
    return m.kind === "dot"
      ? `\\fill[${m.colour}] ${pt(m.at.at, m.at.price)} circle (${n3(0.75 * m.size)}pt);`
      : `\\node[${beside[m.anchor]}, text=${m.colour}, inner sep=0pt, font=\\fontsize{${n3(0.75 * m.size)}pt}{${n3(0.9 * m.size)}pt}\\selectfont] at ${pt(m.at.at, m.at.price)} {${tex(m.text)}};`;
  };
  const drawSeries = (s: Series): string => {
    const ys = scaleOf(s);
    const points = s.points.filter((p) => p.x >= from && p.x <= to);
    const opacity = s.opacity === undefined ? "" : `, opacity=${n3(s.opacity)}`;
    return s.form === "line"
      ? points.length < 2
        ? ""
        : `\\draw[${s.colour}, ${lw(s.width)}${opacity}] ${points.map((p) => `(${n3(X(p.x))},${n3(ys(p.value))})`).join(" -- ")};`
      : points
          .map(
            (p) =>
              `\\fill[${p.colour ?? s.colour}${opacity}] (${n3(X(p.x) - step * 0.4)},${n3(ys(0))}) rectangle (${n3(X(p.x) + step * 0.4)},${n3(ys(p.value))});`,
          )
          .join("\n");
  };
  const precision = d.precision;
  const priceTicks = ticks(p0, p1, 6).filter((v) => v >= p0 && v <= p1);
  const daily = times.length > 1 && (times[1] ?? 0) - (times[0] ?? 0) >= 86400;
  const dateAt = Array.from({ length: Math.min(6, count) }, (_, i) =>
    Math.round(from + ((i + 0.5) * (count - 1)) / Math.min(6, count)),
  );
  const subPanes = Array.from({ length: subs }, (_, i) => i + 1);
  const colours = Object.entries(o.palette).flatMap(([name, pair]) => {
    const c = pair[o.theme === "dark" ? 1 : 0];
    return c === undefined ? [] : [`\\definecolor{${name}}{HTML}{${c.replace("#", "").toUpperCase()}}`];
  });
  const body = [
    `\\node[anchor=south west, font=\\small] at (0,${n3(H + 0.1)}) {${tex(d.title)}};`,
    // the main graph
    "\\begin{scope}",
    `\\clip (0,${n3(mainBottom)}) rectangle (${n3(W)},${n3(H)});`,
    ...priceTicks.map((v) => `\\draw[cl-state-fill, ${lw(0.5)}] (0,${n3(Y(v))}) -- (${n3(W)},${n3(Y(v))});`),
    ...boxes.map(drawBox),
    ...markBoxes.map(drawOurs),
    ...series.filter((s) => s.pane === 0 && s.form === "bars").map(drawSeries),
    ...candles.map(drawCandle),
    ...lines.map(drawLine),
    ...series.filter((s) => s.pane === 0 && s.form === "line").map(drawSeries),
    ...marks.map(drawMark),
    ...markRest.map(drawOurs),
    "\\end{scope}",
    `\\draw[cl-muted, ${lw(0.6)}] (0,${n3(mainBottom)}) rectangle (${n3(W)},${n3(H)});`,
    ...priceTicks.map(
      (v) => `\\node[anchor=west, cl-muted] at (${n3(W + 0.05)},${n3(Y(v))}) {${v.toFixed(precision)}};`,
    ),
    // each subgraph
    ...subPanes.flatMap((pane) => {
      const [y0, y1] = paneOf(pane);
      const own = series.filter((s) => s.pane === pane);
      const shared = own.filter((s) => s.band === undefined);
      const [vlo, vhi] = extent(shared, from, to);
      const ys = scale(vlo, vhi, y0 + 0.05, y1 - 0.05);
      const marks3 = ticks(vlo, vhi, 2);
      return [
        "\\begin{scope}",
        `\\clip (0,${n3(y0)}) rectangle (${n3(W)},${n3(y1)});`,
        ...own.filter((s) => s.form === "bars").map(drawSeries),
        ...own.filter((s) => s.form === "line").map(drawSeries),
        "\\end{scope}",
        `\\draw[cl-muted, ${lw(0.6)}] (0,${n3(y0)}) rectangle (${n3(W)},${n3(y1)});`,
        ...marks3.map(
          (v) => `\\node[anchor=west, cl-muted] at (${n3(W + 0.05)},${n3(ys(v))}) {${v.toFixed(precision)}};`,
        ),
      ];
    }),
    // the dates under the last pane
    ...dateAt.flatMap((i) => {
      const t = times[i];
      return t === undefined
        ? []
        : [
            `\\node[anchor=north, cl-muted] at (${n3(X(i))},${n3(mainBottom - subs * subH - 0.05)}) {${stamp(daily)(t)}};`,
          ];
    }),
  ];
  return [
    "\\documentclass[tikz,border=4pt]{standalone}",
    "\\usepackage{xeCJK}",
    ...colours,
    // the style `cl chart`, for its text only: round caps, as a document's chart style may have, would make the
    // dashes longer than the page's
    "\\tikzset{cl chart/.style={every node/.append style={text=cl-ink}}}",
    "\\pagecolor{cl-bg}",
    "\\begin{document}",
    "\\begin{tikzpicture}[cl chart, x=1cm, y=1cm, font=\\scriptsize]",
    ...body,
    "\\end{tikzpicture}",
    "\\end{document}",
    "",
  ].join("\n");
};

// a refused number of digits for prices (toFixed takes 0 to 100)
export type TikzError = QiError<"CHART_TIKZ", "VALIDATION">;

// a chart's components, checked (locate.ts), drawn and laid out as a TikZ picture, with the caller's marks if given

export const tikzChart = (
  c: Components,
  o: TikzOptions,
  shown: Shown = "all",
  marked: readonly MarkLayer[] = [],
): Result<string, LocateError | TikzError | MarkingError> => {
  const digits = c.options?.layout?.digits ?? layoutDefaults.digits;
  return pipe(
    Number.isInteger(digits) && digits >= 0 && digits <= 100
      ? result.success<Components>(c)
      : result.failure<TikzError>({
          category: "VALIDATION",
          code: "CHART_TIKZ",
          message: `the digits a price is shown to, ${digits}: a whole number 0 to 100`,
          context: {},
        }),
    result.flatMap((ok): Result<Located<Bars>, LocateError | TikzError> => located(ok)),
    // the marks checked against the chart's K-lines
    result.flatMap(
      (ok): Result<Located<Bars>, LocateError | TikzError | MarkingError> =>
        result.map(() => ok)(marksOn(c.xAxis.length)({ contract: "qi-marks/1", layers: marked })),
    ),
    result.map((ok) =>
      tikzPicture(
        drawing(d3fcEngine)(ok, shown),
        componentsOf(ok).xAxis.map((k) => k.date),
        o,
        marked,
      ),
    ),
  );
};
