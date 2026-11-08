// The price distribution (a volume profile): the volume traded at each price over a run of bars, in rows of equal
// height from the run's lowest low to its highest high. A bar's volume is spread over the rows its low to its high
// covers, each its share of the overlap (the last row's top the highest high itself), so the rows hold the run's whole
// volume; a bar at one price gives all to its row. Up volume is a bar's that closes at or above its open, down the
// rest. The point of control is the fullest row; the value area grows from it, a row at a time, by the fuller of the
// rows above and below (on a tie the one nearer the point of control, then the one above), until it holds 70% of the
// volume or every row (TradingView's steps, docs/research/price-distribution-2026-10-24.md, but for its "do not
// exceed the remaining target": the row that reaches 70% is kept). General, not 缠论's, and no chart's: which bars, how
// many rows and the rounding are the caller's.

import type { Result } from "@qi/base";
import { type DecodeError, decode } from "@qi/core";
import { z } from "zod";

// how many rows, a whole number from 1
export const rowsSchema = z.number().int().positive().brand<"Rows">();
export type Rows = z.output<typeof rowsSchema>;
export const rows = (n: number): Result<Rows, DecodeError> => decode(rowsSchema)(n);

export type Bar = {
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly volume: number;
};

// From `low`, rows of `step` each (one row of 0 where every bar is at one price): their up and down volume, the point
// of control's row and the value area's rows, `from` to `to`.
export type Profile = {
  readonly low: number;
  readonly step: number;
  readonly up: readonly number[];
  readonly down: readonly number[];
  readonly poc: number;
  readonly value: { readonly from: number; readonly to: number };
};

// the share of the value area in the volume
const valueShare = 0.7;

// the value area: from the rows `from` to `to` about the point of control `poc`, holding `held`, the fuller neighbour
// added (on a tie the one nearer `poc`, then the one above) until it holds `target` or every row
const grow = (
  totals: readonly number[],
  poc: number,
  target: number,
  from: number,
  to: number,
  held: number,
): { readonly from: number; readonly to: number } => {
  const below = from > 0 ? totals[from - 1] : undefined;
  const above = to < totals.length - 1 ? totals[to + 1] : undefined;
  const upward =
    above !== undefined &&
    (below === undefined || above > below || (above === below && to + 1 - poc <= poc - (from - 1)));
  return held >= target || (below === undefined && above === undefined)
    ? { from, to }
    : upward
      ? grow(totals, poc, target, from, to + 1, held + above)
      : grow(totals, poc, target, from - 1, to, held + (below ?? 0));
};

// the price distribution of the bars in `n` rows; none for no bars
export const profile =
  (n: Rows) =>
  (bars: readonly Bar[]): Profile | undefined => {
    if (bars.length === 0) return undefined;
    // by reduce, not by spreading: a long run would overflow the stack
    const low = bars.reduce((m, b) => Math.min(m, b.low), Number.POSITIVE_INFINITY);
    const high = bars.reduce((m, b) => Math.max(m, b.high), Number.NEGATIVE_INFINITY);
    // one row where all is at one price, or where the rows would be too thin to tell apart (their height 0 in floating
    // point)
    const count = (high - low) / n > 0 ? n : 1;
    const step = (high - low) / count;
    // a row's top: the last row's the highest high itself, not a sum that may fall short of it
    const topOf = (r: number): number => (r === count - 1 ? high : low + (r + 1) * step);
    // a price's row: the last holds the highest high
    const rowOf = (p: number): number => (step === 0 ? 0 : Math.min(count - 1, Math.floor((p - low) / step)));
    // a bar's volume in the row r: all of it where it is at one price, else its share of the overlap
    const share =
      (r: number) =>
      (b: Bar): number =>
        b.high === b.low
          ? rowOf(b.low) === r
            ? b.volume
            : 0
          : (Math.max(0, Math.min(b.high, topOf(r)) - Math.max(b.low, low + r * step)) / (b.high - b.low)) *
            b.volume;
    const ups = bars.filter((b) => b.close >= b.open);
    const downs = bars.filter((b) => b.close < b.open);
    const row = Array.from({ length: count }, (_, r) => r);
    const up = row.map((r) => ups.reduce((s, b) => s + share(r)(b), 0));
    const down = row.map((r) => downs.reduce((s, b) => s + share(r)(b), 0));
    const totals = row.map((r) => (up[r] ?? 0) + (down[r] ?? 0));
    const poc = totals.reduce((best, t, r) => (t > (totals[best] ?? 0) ? r : best), 0);
    const whole = totals.reduce((s, t) => s + t, 0);
    return {
      low,
      step,
      up,
      down,
      poc,
      value: grow(totals, poc, valueShare * whole, poc, poc, totals[poc] ?? 0),
    };
  };
