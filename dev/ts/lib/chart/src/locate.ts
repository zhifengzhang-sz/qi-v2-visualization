// The one map from merged bars to K-lines (docs/designs/design-chart-chanlun-3-2026-11-09.md, Reading the records).
// Every record after 包含 is on merged bars, by their number (`mIndex`, a merged bar's place among them; @qi/chanlun),
// and every drawing puts it on K-lines through this map and no other way: a merged bar's `index`, the K-line that
// represents it, where a 分型's mark, a line's end and a 中枢's edge go; its `extremes`, the K-lines of its extreme, where
// 包含's marks go; its extreme, its high when it goes up, its low when it goes down, a line's price at its end.
//
// Before a chart is drawn, `located` makes its K-lines bars and the run's positions the x-axis's, and checks the run
// against the K-lines given beside it, which it does not name: every position of a merged bar is one of the K-lines;
// each K-line of a merged bar's extremes holds its extreme; every merged bar a record names is the run's.

import { pipe, type QiError, type Result, result } from "@qi/base";
import type { Bar, KLines, MergedBar, Run, XAxis } from "./schemas.ts";

export type LocateError = QiError<"CHART_LOCATE", "VALIDATION">;

// Components that `located` has checked, held under a key this module does not export. The only way to get one is
// `located`, so a chart is only ever drawn from checked components (drawing.ts); if any check fails, the whole
// chart is refused.
const key: unique symbol = Symbol("located");
export type Located<C> = { readonly [key]: C };
export const componentsOf = <C>(l: Located<C>): C => l[key];
// components as a caller gives them, their K-lines market's and the run's positions those K-lines' indexes; as
// `located` gives them, their K-lines bars and the run's positions the x-axis's
export type Inside<C> = Omit<C, "xAxis"> & { readonly xAxis: XAxis };

// a merged bar by its number: the K-line that represents it, the K-lines of its extreme, its extreme, its direction
export type Locator = {
  readonly at: (m: number) => number | undefined;
  readonly all: (m: number) => readonly number[];
  readonly extreme: (m: number) => number | undefined;
  readonly up: (m: number) => boolean | undefined;
};

export const locator = (bars: readonly MergedBar[]): Locator => ({
  at: (m) => bars[m]?.index,
  all: (m) => bars[m]?.extremes ?? [],
  extreme: (m) => {
    const b = bars[m];
    return b === undefined ? undefined : b.up ? b.high : b.low;
  },
  up: (m) => bars[m]?.up,
});

const fault = (message: string, mIndex: number): LocateError => ({
  category: "VALIDATION",
  code: "CHART_LOCATE",
  message,
  context: { mIndex },
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
  (k: KLines[number], i: number): Result<Bar, LocateError> => {
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
const bars = (scale: number, ks: KLines): Result<XAxis, LocateError> =>
  !scales.includes(scale)
    ? result.failure(fault(`the prices' scale, ${scale}: a power of ten from 1 to 1,000,000`, -1))
    : result.traverse((x: { readonly k: KLines[number]; readonly i: number }) =>
        barOf(scale, ks[0]?.index ?? 0)(x.k, x.i),
      )(ks.map((k, i) => ({ k, i })));

// a merged bar's positions: the K-line that represents it, its first and last, the one that confirmed its end, those
// of its extreme
const positions = (m: MergedBar): readonly number[] => [
  m.index,
  m.start,
  m.end,
  ...(m.confirmEnd === undefined ? [] : [m.confirmEnd]),
  ...m.extremes,
];

// the merged bars each record names: a 分型's, a line's and a 中枢's start, end and confirmation
const named = (run: Run): readonly number[] => [
  ...run.fractals.map((f) => f.mIndex),
  ...[...run.strokes, ...run.segments.flat(), ...run.moves.flat(), ...run.consolidations.flat()].flatMap(
    (r) => [r.start, r.end, ...(r.confirmEnd === undefined ? [] : [r.confirmEnd])],
  ),
];

// The run checked against the K-lines (by their indexes, first to last) and the bars made of them (`xs`, at the
// scale): the first fault found, or none.
const unfit = (run: Run, ks: KLines, xs: XAxis, scale: number): LocateError | undefined => {
  const first = ks[0]?.index ?? 0;
  const last = ks.at(-1)?.index ?? -1;
  const outside = run.merged
    .map((m, i) => ({ i, p: positions(m).find((p) => p < first || p > last) }))
    .find((x) => x.p !== undefined);
  // each K-line of the extremes holds the extreme, compared at the scale: one finer than the scale holds none
  const holds = (m: MergedBar) => (p: number) => {
    const k = xs[p - first];
    const x = atScale(scale)(m.up ? m.high : m.low);
    return k !== undefined && x !== undefined && (m.up ? k.high === x : k.low === x);
  };
  const loose = run.merged
    .map((m, i) => ({ i, m, p: m.extremes.find((p) => !holds(m)(p)) }))
    .find((x) => x.p !== undefined);
  const unknown = named(run).find((b) => b >= run.merged.length);
  return outside !== undefined
    ? fault(`merged bar ${outside.i}: K-line ${outside.p} is none of the K-lines given`, outside.i)
    : loose !== undefined
      ? fault(
          `merged bar ${loose.i}: K-line ${loose.p} does not hold its ${loose.m.up ? "high" : "low"}, ` +
            `${loose.m.up ? loose.m.high : loose.m.low}`,
          loose.i,
        )
      : unknown !== undefined
        ? fault(`merged bar ${unknown} is none of the run's merged bars`, unknown)
        : undefined;
};

// the run's positions made the x-axis's: each less the first K-line's index
const rebased =
  (first: number) =>
  (run: Run): Run => ({
    ...run,
    merged: run.merged.map((m) => ({
      ...m,
      index: m.index - first,
      start: m.start - first,
      end: m.end - first,
      ...(m.confirmEnd === undefined ? {} : { confirmEnd: m.confirmEnd - first }),
      extremes: m.extremes.map((p) => p - first),
    })),
  });

// The components, their K-lines made bars and the run's positions the x-axis's, checked: the scale, the K-lines (their
// indexes one after another, their dates whole seconds, their prices exact at the scale), and the run against them.
export const located = <
  C extends {
    readonly scale: number;
    readonly xAxis: KLines;
    readonly run: Run;
  },
>(
  given: C,
): Result<Located<Inside<C>>, LocateError> =>
  pipe(
    bars(given.scale, given.xAxis),
    result.flatMap((xAxis): Result<Located<Inside<C>>, LocateError> => {
      const wrong = unfit(given.run, given.xAxis, xAxis, given.scale);
      // the components with their K-lines replaced by the bars and the run rebased: Inside<C> by construction
      return wrong !== undefined
        ? result.failure(wrong)
        : result.success({
            [key]: { ...given, xAxis, run: rebased(given.xAxis[0]?.index ?? 0)(given.run) } as Inside<C>,
          });
    }),
  );
