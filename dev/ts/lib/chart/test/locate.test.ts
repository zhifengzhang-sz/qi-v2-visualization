// The one map from a merged bar to its K-lines (locate.ts): by its number, the K-line that represents it, those of its
// extreme, its extreme and its direction, as the contract gives them; and `located`, which refuses the components
// where the run does not fit the K-lines given beside it: a position none of theirs, a K-line of the extremes that
// does not hold the extreme, a merged bar a record names that the run does not have; the prices' scale.

import { result } from "@qi/base";
import type { Run } from "@qi/chanlun";
import { describe, expect, it } from "vitest";
import { d3fcChart, located, tvChart } from "../src/index.ts";
import { componentsOf, locator } from "../src/locate.ts";
import { merged, ranges, run } from "./records.ts";

// 0: [10, 20]; 1: [12, 25]; 2: [15, 25]; 3: [11, 18]; 4: [13, 16]
const xs = ranges([
  [10, 20],
  [12, 25],
  [15, 25],
  [11, 18],
  [13, 16],
]);

// up at 0; up over 1..2, its high 25 on both; down over 3..4, its low 11 on 3
const bars = [
  merged({}),
  merged({ index: 1, mIndex: 1, high: 25, low: 15, start: 1, end: 2, confirmEnd: 3, extremes: [1, 2] }),
  merged({
    index: 3,
    mIndex: 2,
    up: false,
    high: 16,
    low: 11,
    start: 3,
    end: 4,
    confirmEnd: 4,
    extremes: [3],
  }),
];

const centre = { level: 0, start: 0, end: 2, zg: 18, zd: 15, gg: 25, dd: 11 };
const good: Run = run({ merged: bars, fractals: [{ mIndex: 1 }], consolidations: [[centre]] });

const show = result.match(
  () => "located",
  (e: { readonly message: string }) => e.message,
);

describe("the one map", () => {
  it("gives a merged bar's K-line, the K-lines of its extreme, its extreme and its direction, by its number", () => {
    const loc = locator(bars);
    expect([loc.at(1), loc.all(1), loc.extreme(1), loc.extreme(2), loc.up(2)]).toEqual([
      1,
      [1, 2],
      25,
      11,
      false,
    ]);
    expect([loc.at(7), loc.all(7), loc.extreme(7), loc.up(7)]).toEqual([undefined, [], undefined, undefined]);
  });
});

describe("located", () => {
  it("takes a run that fits its K-lines", () => {
    expect(show(located({ scale: 1, xAxis: xs, run: good }))).toBe("located");
  });

  it("refuses a merged bar with a position none of the K-lines'", () => {
    const past = run({ merged: [...bars, merged({ index: 4, mIndex: 3, start: 4, end: 5, extremes: [4] })] });
    expect(show(located({ scale: 1, xAxis: xs, run: past }))).toBe(
      "merged bar 3: K-line 5 is none of the K-lines given",
    );
    const confirmed = run({ merged: [merged({ confirmEnd: 9 })] });
    expect(show(located({ scale: 1, xAxis: xs, run: confirmed }))).toBe(
      "merged bar 0: K-line 9 is none of the K-lines given",
    );
  });

  it("refuses a K-line of a merged bar's extremes that does not hold its extreme", () => {
    const high = run({ merged: [merged({ high: 25 })] });
    expect(show(located({ scale: 1, xAxis: xs, run: high }))).toBe(
      "merged bar 0: K-line 0 does not hold its high, 25",
    );
    const low = run({ merged: [...bars.slice(0, 2), merged({ ...bars[2], extremes: [3, 4] })] });
    expect(show(located({ scale: 1, xAxis: xs, run: low }))).toBe(
      "merged bar 2: K-line 4 does not hold its low, 11",
    );
    // an extreme finer than the scale holds no K-line's price
    const fine = run({ merged: [merged({ high: 20.5 })] });
    expect(show(located({ scale: 1, xAxis: xs, run: fine }))).toBe(
      "merged bar 0: K-line 0 does not hold its high, 20.5",
    );
  });

  it("refuses a record that names a merged bar the run does not have", () => {
    const named = (parts: Partial<Run>) =>
      show(located({ scale: 1, xAxis: xs, run: run({ merged: bars, ...parts }) }));
    expect(named({ fractals: [{ mIndex: 3 }] })).toBe("merged bar 3 is none of the run's merged bars");
    expect(named({ strokes: [{ start: 1, end: 2, confirmEnd: 5 }] })).toBe(
      "merged bar 5 is none of the run's merged bars",
    );
    expect(named({ moves: [[{ start: 0, end: 4, level: 0 }]] })).toBe(
      "merged bar 4 is none of the run's merged bars",
    );
    expect(named({ consolidations: [[{ ...centre, end: 6 }]] })).toBe(
      "merged bar 6 is none of the run's merged bars",
    );
  });

  it("makes the run's positions the x-axis's, each less the first K-line's index", () => {
    const later = xs.map((k, i) => ({ ...k, index: 100 + i }));
    const shifted = run({
      merged: bars.map((m) => ({
        ...m,
        index: m.index + 100,
        start: m.start + 100,
        end: m.end + 100,
        ...(m.confirmEnd === undefined ? {} : { confirmEnd: m.confirmEnd + 100 }),
        extremes: m.extremes.map((p) => p + 100),
      })),
    });
    const inside = result.match(
      (l: Parameters<typeof componentsOf>[0]) => componentsOf(l),
      () => undefined,
    )(located({ scale: 1, xAxis: later, run: shifted }));
    expect((inside as { readonly run: Run } | undefined)?.run.merged).toEqual(bars);
    expect(show(located({ scale: 1, xAxis: later, run: good }))).toBe(
      "merged bar 0: K-line 0 is none of the K-lines given",
    );
  });

  it("refuses the chart whole, in both engines, where the run does not fit", () => {
    const c = {
      title: "t",
      scale: 1,
      xAxis: xs,
      run: run({ merged: bars, strokes: [{ start: 1, end: 9 }] }),
      addons: [],
    };
    const message = result.match(
      () => "drawn",
      (e: { readonly message: string }) => e.message,
    );
    expect([message(tvChart(c)), message(d3fcChart(c))]).toEqual([
      "merged bar 9 is none of the run's merged bars",
      "merged bar 9 is none of the run's merged bars",
    ]);
  });
});

describe("the prices' scale", () => {
  it("is refused where it is not a power of ten from 1 to 1,000,000", () => {
    expect(show(located({ scale: 100, xAxis: xs, run: good }))).toBe("located");
    expect(
      ["0", "-100", "NaN", "50", "10000000"].map((s) =>
        show(located({ scale: Number(s), xAxis: xs, run: good })),
      ),
    ).toEqual([
      "the prices' scale, 0: a power of ten from 1 to 1,000,000",
      "the prices' scale, -100: a power of ten from 1 to 1,000,000",
      "the prices' scale, NaN: a power of ten from 1 to 1,000,000",
      "the prices' scale, 50: a power of ten from 1 to 1,000,000",
      "the prices' scale, 10000000: a power of ten from 1 to 1,000,000",
    ]);
  });
});
