// The records the tests are made of, in the contracts' forms: market's K-lines (@qi/market), 缠论's run over them
// (@qi/chanlun). A test names its prices as whole numbers at the chart's scale, as the bars inside hold them; the
// K-lines carry the decimals they stand for, and `located` makes them the same whole numbers.

import type { MergedBar, Run } from "@qi/chanlun";
import type { KLine } from "@qi/market";

// a whole number at a scale (a power of ten) as the decimal it stands for, its digits exactly
export const decimal = (n: number, scale = 1): number => {
  const digits = String(scale).length - 1;
  const text = String(Math.abs(n)).padStart(digits + 1, "0");
  const whole = text.slice(0, text.length - digits);
  const fraction = text.slice(text.length - digits).replace(/0+$/, "");
  return Number(`${n < 0 ? "-" : ""}${whole}${fraction === "" ? "" : `.${fraction}`}`);
};

export type Prices = {
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly volume?: number;
};

// K-lines a minute apart, the first at 00:01 of 1970-01-01, UTC, indexed from `first`; their prices whole numbers at
// the scale
export const klines = (rows: readonly Prices[], scale = 1, first = 0): readonly KLine[] =>
  rows.map((r, i) => ({
    index: first + i,
    date: 60_000 * (i + 1),
    open: decimal(r.open, scale),
    high: decimal(r.high, scale),
    low: decimal(r.low, scale),
    close: decimal(r.close, scale),
    volume: r.volume ?? 0,
  }));

// K-lines from (low, high): each opening at its low and closing at its high
export const ranges = (rs: readonly (readonly [number, number])[], scale = 1): readonly KLine[] =>
  klines(
    rs.map(([low, high]) => ({ open: low, high, low, close: high })),
    scale,
  );

// a merged bar, confirmed, of one K-line at 0 going up, its prices given as decimals
export const merged = (m: Partial<MergedBar>): MergedBar => ({
  index: 0,
  mIndex: 0,
  up: true,
  high: 20,
  low: 10,
  start: 0,
  end: 0,
  confirmEnd: 1,
  extremes: [0],
  ...m,
});

// a run of the parts given, the others empty
export const run = (parts: Partial<Run> = {}): Run => ({
  merged: [],
  fractals: [],
  strokes: [],
  segments: [],
  moves: [],
  consolidations: [],
  ...parts,
});
