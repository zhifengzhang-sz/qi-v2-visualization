// The averages: the indicators a trading screen draws with its bars, each a map over a list of numbers by its definition, no
// state carried from one item to the next: the simple average of n (MA5 … MA250 on the closes, MAVOL5 and MAVOL10 on
// the volume), the exponential average of n, and MACD(fast, slow, signal) as the Chinese screens draw it (DIFF the EMA
// of `fast` less the EMA of `slow`, DEA the EMA of `signal` DIFFs, MACD 2 × (DIFF − DEA)): (12,26,9), or another, such as
// (24,52,9). General, not 缠论's, and no chart's: a caller gives the numbers (the
// closes before the chart first, so that its first bars have their averages) and takes the values; no rounding, which
// is the caller's.
// A period is a whole number of items, at least 1, decoded once (`period`), so that every average is defined. A chart
// takes them through its add-ons (@qi/chart's addon.ts).

import type { Result } from "@qi/base";
import { type DecodeError, decode } from "@qi/core";
import { z } from "zod";

export const periodSchema = z.number().int().positive().brand<"Period">();
export type Period = z.output<typeof periodSchema>;
export const period = (n: number): Result<Period, DecodeError> => decode(periodSchema)(n);

// The mean of the n numbers up to each item, null where there are fewer than n.
export const sma =
  (n: Period) =>
  (xs: readonly number[]): readonly (number | null)[] =>
    xs.map((_, i) => (i + 1 < n ? null : xs.slice(i + 1 - n, i + 1).reduce((s, x) => s + x, 0) / n));

// The EMA of n at each item, by its definition: the number k items back weighs α(1 − α)^k (α = 2 / (n + 1)), the
// first what is left, (1 − α)^i, as if the average began at it; the closed form of e₀ = x₀, eᵢ = αxᵢ + (1 − α)eᵢ₋₁.
// The weights fall geometrically: the numbers further back than `reach` weigh, together, at most (1 − α)^reach ≤
// 1e-13 of the average, below a price's last digit, and are left out. At n = 1, α = 1: the average is the number.
export const ema =
  (n: Period) =>
  (xs: readonly number[]): readonly number[] => {
    const a = 2 / (n + 1);
    const reach = a === 1 ? 1 : Math.ceil(Math.log(1e-13) / Math.log(1 - a));
    const [x0 = 0] = xs;
    return xs.map((_, i) => {
      const lo = Math.max(1, i - reach + 1);
      const first = i <= reach ? (1 - a) ** i * x0 : 0;
      return xs.slice(lo, i + 1).reduce((s, x, j) => s + a * (1 - a) ** (i - lo - j) * x, first);
    });
  };

export type Macd = {
  readonly diff: readonly number[];
  readonly dea: readonly number[];
  readonly macd: readonly number[];
};

export const macd =
  (fast: Period, slow: Period, signal: Period) =>
  (xs: readonly number[]): Macd => {
    const s = ema(slow)(xs);
    const diff = ema(fast)(xs).map((x, i) => x - (s[i] ?? 0));
    const dea = ema(signal)(diff);
    return { diff, dea, macd: diff.map((d, i) => 2 * (d - (dea[i] ?? 0))) };
  };
