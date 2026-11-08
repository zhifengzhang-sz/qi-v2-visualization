// The indicators against the EMA's recursion, of which `ema` is the closed form, and at their edges (a period of 1,
// nothing to average); a period a whole number from 1.

import { describe, expect, it } from "vitest";
import { ema, macd, period, periodSchema, sma } from "../src/average.ts";

describe("the indicators", () => {
  const p = (n: number) => periodSchema.parse(n);
  const xs = Array.from({ length: 800 }, (_, i) => 1000 + Math.round(300 * Math.sin(i / 17)) + (i % 7));
  // the EMA's recursion, e₀ = x₀, eᵢ = αxᵢ + (1 − α)eᵢ₋₁, of which `ema` is the closed form (the reference records
  // its values as it goes: a test observes, it is not the code under the rule)
  const recursion = (n: number, ys: readonly number[]): readonly number[] =>
    ys.reduce<number[]>((e, y, i) => {
      e.push(i === 0 ? y : (2 / (n + 1)) * y + (1 - 2 / (n + 1)) * (e[i - 1] ?? 0));
      return e;
    }, []);
  it.each([1, 2, 9, 12, 24, 26, 52])("EMA(%i) is the recursion's, at every item", (n) => {
    const a = ema(p(n))(xs);
    recursion(n, xs).forEach((e, i) => {
      expect(a[i]).toBeCloseTo(e, 6);
    });
  });
  it("gives the numbers themselves for EMA(1) and SMA(1), and nothing for nothing", () => {
    expect(ema(p(1))([5, 6, 7])).toEqual([5, 6, 7]);
    expect(sma(p(1))([5, 6, 7])).toEqual([5, 6, 7]);
    expect(ema(p(9))([])).toEqual([]);
    expect(sma(p(5))([])).toEqual([]);
  });
  it("takes as a period a whole number from 1 only", () => {
    expect([0, -1, 2.5, Number.NaN, Number.POSITIVE_INFINITY].map((n) => period(n).tag)).toEqual(
      Array(5).fill("failure"),
    );
    expect(period(250).tag).toBe("success");
  });
  it("averages the last n, none where there are fewer", () => {
    expect(sma(p(5))([100, 102, 104, 106])).toEqual([null, null, null, null]);
    expect(sma(p(5))([100, 102, 104, 106, 108, 120])).toEqual([null, null, null, null, 104, 108]);
  });
  it.each([
    [12, 26, 9],
    [24, 52, 9],
  ])("MACD(%i,%i,%i): DIFF the fast EMA less the slow, DEA its EMA, MACD 2 × (DIFF − DEA), by the recursion", (f, s, g) => {
    const m = macd(p(f), p(s), p(g))(xs);
    const fast = recursion(f, xs);
    const slow = recursion(s, xs);
    const diff = fast.map((x, i) => x - (slow[i] ?? 0));
    const dea = recursion(g, diff);
    diff.forEach((d, i) => {
      expect(m.diff[i]).toBeCloseTo(d, 6);
      expect(m.dea[i]).toBeCloseTo(dea[i] ?? 0, 6);
      expect(m.macd[i]).toBeCloseTo(2 * (d - (dea[i] ?? 0)), 6);
    });
  });
});
