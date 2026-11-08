// The one map from merged bars to K-lines (docs/designs/design-chart-lib-2026-10-24.md, The DSL, layer 2). Every
// configuration after 包含 is given on merged bars (@qi/chanlun's contracts.ts), and every drawing puts it on K-lines
// through this map and no other way. A merged bar maps to the K-lines that hold its extreme (its high when it goes
// up, its low when it goes down), in order: a mark goes at each of them, a line's end or a box's edge at the first.
//
// Before a chart is drawn, `located` makes its K-lines bars (the market data's; 缠论's are drawn as they are) and
// checks its components: every merged bar a configuration names exists and has a K-line holding its extreme; each
// merged bar is numbered once and ends within the x-axis; and the scale, where given, is a positive number.

import { pipe, type QiError, type Result, result } from "@qi/base";
import type { KLine as MarketKLine } from "@qi/market";
import type { Bar, Centre, Fractal, KLines, MergedBar, Stroke, XAxis } from "./schemas.ts";

export type LocateError = QiError<"CHART_LOCATE", "VALIDATION">;

// Components that `located` has checked, held under a key this module does not export. The only way to get one is
// `located`, so a chart is only ever drawn from checked components (drawing.ts); if any check fails, the whole
// chart is refused.
const key: unique symbol = Symbol("located");
export type Located<C> = { readonly [key]: C };
export const componentsOf = <C>(l: Located<C>): C => l[key];
// components as a caller gives them, their K-lines a contract's; as `located` gives them, their K-lines bars
export type Inside<C> = Omit<C, "xAxis"> & { readonly xAxis: XAxis };

// the K-lines of merged bar `m` that hold its extreme
export const locate =
  (xs: XAxis) =>
  (m: MergedBar): readonly number[] =>
    xs
      .slice(m.startDate, m.endDate + 1)
      .flatMap((k, j) => ((m.up ? k.high === m.high : k.low === m.low) ? [m.startDate + j] : []));

// a merged bar's K-lines by its number: all of them, or the first
export type Locator = {
  readonly all: (mno: number) => readonly number[];
  readonly at: (mno: number) => number | undefined;
};

export const locator = (xs: XAxis, bars: readonly MergedBar[]): Locator => {
  const of = new Map(bars.map((m) => [m.mno, locate(xs)(m)]));
  return { all: (mno) => of.get(mno) ?? [], at: (mno) => of.get(mno)?.[0] };
};

const fault = (message: string, mno: number): LocateError => ({
  category: "VALIDATION",
  code: "CHART_LOCATE",
  message,
  context: { mno },
});

// The market data's K-lines as bars (docs/designs/design-chart-online-2026-11-08.md, The two components): a K-line's
// position its index less the first one's, the indexes one after another; its date in whole seconds; each price a
// whole number at the scale, read exactly from its digits (the contract gives a price back as its digits), the scale a
// power of ten from 1 to 1,000,000; its volume as it is.
const scales = [1, 10, 100, 1000, 10000, 100000, 1000000];
const atScale =
  (scale: number) =>
  (x: number): number | undefined => {
    const digits = scales.indexOf(scale);
    const text = String(Math.abs(x));
    const [whole = "", fraction = ""] = text.split(".");
    const n = Number(`${whole}${fraction.padEnd(digits, "0")}`);
    // only a price written in digits, as the contract writes it: one with an exponent is refused, never read as 0
    return !/^[0-9]+(\.[0-9]+)?$/.test(text) || fraction.length > digits || !Number.isSafeInteger(n)
      ? undefined
      : x < 0
        ? -n
        : n;
  };
const barOf =
  (scale: number, first: number) =>
  (k: MarketKLine, i: number): Result<Bar, LocateError> => {
    const [open, high, low, close] = [k.open, k.high, k.low, k.close].map(atScale(scale));
    return k.index !== first + i
      ? result.failure(fault(`K-line ${k.index}: the index after ${first + i - 1} is ${first + i}`, -1))
      : k.date % 1000 !== 0
        ? result.failure(fault(`K-line ${k.index}: its date, ${k.date}, is not a whole second`, -1))
        : open === undefined || high === undefined || low === undefined || close === undefined
          ? result.failure(
              fault(`K-line ${k.index}: a price with more digits than the scale ${scale} holds`, -1),
            )
          : result.success({ date: k.date / 1000, open, high, low, close, volume: k.volume });
  };
const bars = (scale: number | undefined, ks: KLines): Result<XAxis, LocateError> => {
  const market = ks.flatMap((k) => ("index" in k ? [k] : []));
  return market.length === 0
    ? result.success(ks.flatMap((k) => ("index" in k ? [] : [k])))
    : market.length < ks.length
      ? result.failure(fault("the K-lines are not all of one contract", -1))
      : scale === undefined || !scales.includes(scale)
        ? result.failure(fault(`the prices' scale, ${scale}: a power of ten from 1 to 1,000,000`, -1))
        : result.traverse((x: { readonly k: MarketKLine; readonly i: number }) =>
            barOf(scale, market[0]?.index ?? 0)(x.k, x.i),
          )(market.map((k, i) => ({ k, i })));
};

// what `checked` checks of components: their bars and the 缠论 data on them
type Shape = {
  readonly scale?: number;
  readonly xAxis: XAxis;
  readonly merged: readonly MergedBar[];
  readonly fractals: readonly Fractal[];
  readonly strokes: readonly Stroke[];
  readonly duan: readonly Stroke[];
  readonly zoushi: readonly Stroke[];
  readonly zhongshu: readonly Centre[];
};
const checked = <C extends Shape>(c: C): Result<Located<C>, LocateError> => {
  const loc = locator(c.xAxis, c.merged);
  const named = [
    ...c.merged.map((m) => m.mno),
    ...c.fractals.map((f) => f.mno),
    ...[...c.strokes, ...c.duan, ...c.zoushi].flatMap((l) => [l.startBar, l.endBar]),
    ...c.zhongshu.flatMap((z) => [z.startBar, z.endBar, z.ggBar, z.ddBar]),
  ];
  const known = new Set(c.merged.map((m) => m.mno));
  // each merged bar numbered once and within the x-axis; otherwise the map would lose one, or reach past the end
  const first = new Map([...c.merged].reverse().map((m, i) => [m.mno, c.merged.length - 1 - i]));
  const twice = c.merged.find((m, i) => first.get(m.mno) !== i);
  const past = c.merged.find((m) => m.endDate >= c.xAxis.length);
  return pipe(
    c.scale !== undefined && !(Number.isFinite(c.scale) && c.scale > 0)
      ? result.failure(fault(`the prices' scale, ${c.scale}: a positive number`, -1))
      : twice !== undefined
        ? result.failure(fault(`merged bar ${twice.mno} is numbered twice`, twice.mno))
        : past !== undefined
          ? result.failure(
              fault(`merged bar ${past.mno} ends at K-line ${past.endDate}, past the x-axis`, past.mno),
            )
          : result.success(named),
    result.flatMap((ns) =>
      result.traverse((mno: number) =>
        !known.has(mno)
          ? result.failure(fault(`merged bar ${mno} is none of the merged bars`, mno))
          : loc.at(mno) === undefined
            ? result.failure(fault(`merged bar ${mno} has no K-line of its extreme`, mno))
            : result.success(mno),
      )(ns),
    ),
    result.map((): Located<C> => ({ [key]: c })),
  );
};

// The components, their K-lines made bars, checked: every merged bar they name exists and has a K-line holding its
// extreme; each merged bar is numbered once and ends within the x-axis; and the scale, where given, is a positive
// number (a price is drawn divided by it).
export const located = <
  C extends {
    readonly scale?: number;
    readonly xAxis: KLines;
    readonly merged: readonly MergedBar[];
    readonly fractals: readonly Fractal[];
    readonly strokes: readonly Stroke[];
    readonly duan: readonly Stroke[];
    readonly zoushi: readonly Stroke[];
    readonly zhongshu: readonly Centre[];
  },
>(
  given: C,
): Result<Located<Inside<C>>, LocateError> =>
  pipe(
    bars(given.scale, given.xAxis),
    // the components with their K-lines replaced by the bars: Inside<C> by construction, of the shape checked
    result.flatMap(
      (xAxis): Result<Located<Inside<C>>, LocateError> => checked({ ...given, xAxis } as Inside<C> & Shape),
    ),
  );
