// The one map from a merged bar to its K-lines (locate.ts): those that hold its high when it goes up, its low when
// down, in order; by its number, all and the first; and the components refused where a configuration names a merged
// bar that is none of them.

import { result } from "@qi/base";
import { type Centre, centreSchema, type KLine, klinesSchema, type MergedBar } from "@qi/chanlun";
import { decode } from "@qi/core";
import { describe, expect, it } from "vitest";
import { d3fcChart, located, tvChart } from "../src/index.ts";
import { locate, locator } from "../src/locate.ts";

// 0: [10, 20]; 1: [12, 25]; 2: [15, 25]; 3: [11, 18]; 4: [13, 16]
const xs: readonly KLine[] = result.getOrElse((): readonly KLine[] => [])(
  decode(klinesSchema)(
    [
      [10, 20],
      [12, 25],
      [15, 25],
      [11, 18],
      [13, 16],
    ].map(([low = 0, high = 0], i) => ({
      rno: i,
      date: 60 * (i + 1),
      up: false,
      open: low,
      high,
      low,
      close: high,
      volume: 0,
      confirmRno: 0,
      stored: 1,
    })),
  ),
);

const bar = (m: Partial<MergedBar>): MergedBar => ({
  rno: 0,
  mno: 0,
  up: true,
  high: 20,
  low: 10,
  startDate: 0,
  endDate: 0,
  stored: 1,
  ...m,
});

// up over 1..2, its high 25 on both; down over 3..4, its low 11 on 3
const bars = [
  bar({}),
  bar({ mno: 1, high: 25, low: 15, startDate: 1, endDate: 2 }),
  bar({ mno: 2, up: false, high: 16, low: 11, startDate: 3, endDate: 4 }),
];

const centre = (c: Partial<Centre>): Centre => ({
  level: 0,
  startRno: 0,
  startDate: 0,
  endRno: 0,
  endDate: 4,
  entrance: true,
  exit: true,
  zg: 18,
  zd: 15,
  gg: 25,
  ggRno: 0,
  ggDate: 2,
  dd: 11,
  ddRno: 0,
  ddDate: 4,
  d: 15,
  g: 18,
  buy: "()",
  tp0: "()",
  tp0Rno: "()",
  tp1: "()",
  tp1Rno: "()",
  tp2: "()",
  tp2Rno: "()",
  stored: 1,
  startBar: 0,
  endBar: 2,
  ggBar: 1,
  ddBar: 2,
  ...c,
});

const components = (zhongshu: readonly Centre[]) => ({
  xAxis: xs,
  merged: bars,
  fractals: [],
  strokes: [],
  duan: [],
  zoushi: [],
  zhongshu,
});

describe("the one map", () => {
  it("gives a merged bar's K-lines of its high when up, of its low when down, in order", () => {
    expect(bars.map(locate(xs))).toEqual([[0], [1, 2], [3]]);
  });

  it("gives them by the merged bar's number, all and the first", () => {
    const loc = locator(xs, bars);
    expect([loc.all(1), loc.at(1), loc.at(2), loc.all(7), loc.at(7)]).toEqual([[1, 2], 1, 3, [], undefined]);
  });

  it("takes the components whose every merged bar is one of theirs, refuses one that names another", () => {
    const show = result.match(
      () => "located",
      (e: { readonly message: string }) => e.message,
    );
    expect(show(located(components([centre({})])))).toBe("located");
    expect(show(located(components([centre({ ddBar: 9 })])))).toBe("merged bar 9 is none of the merged bars");
  });

  it("refuses a merged bar none of whose K-lines holds its extreme", () => {
    const show = result.match(
      () => "located",
      (e: { readonly message: string }) => e.message,
    );
    const wrong = {
      ...components([]),
      merged: [...bars, bar({ mno: 3, high: 99, startDate: 4, endDate: 4 })],
    };
    expect(show(located(wrong))).toBe("merged bar 3 has no K-line of its extreme");
  });

  it("refuses a merged bar numbered twice, and one that ends past the x-axis", () => {
    const show = result.match(
      () => "located",
      (e: { readonly message: string }) => e.message,
    );
    const twice = { ...components([]), merged: [...bars, bar({ mno: 1, startDate: 4, endDate: 4 })] };
    expect(show(located(twice))).toBe("merged bar 1 is numbered twice");
    const past = { ...components([]), merged: [...bars, bar({ mno: 7, startDate: 4, endDate: 40 })] };
    expect(show(located(past))).toBe("merged bar 7 ends at K-line 40, past the x-axis");
  });

  it("takes a 中枢 only with its band within its range", () => {
    expect(centreSchema.safeParse(centre({})).success).toBe(true);
    expect(centreSchema.safeParse(centre({ zd: 0, dd: 10 })).success).toBe(false);
    expect(centreSchema.safeParse(centre({ zg: 999, gg: 30 })).success).toBe(false);
  });

  it("refuses the chart whole, in both engines, where a merged bar is unknown", () => {
    const c = { title: "t", scale: 10, ...components([centre({ startBar: 9 })]), addons: [] };
    const message = result.match(
      () => "drawn",
      (e: { readonly message: string }) => e.message,
    );
    expect([message(tvChart(c)), message(d3fcChart(c))]).toEqual([
      "merged bar 9 is none of the merged bars",
      "merged bar 9 is none of the merged bars",
    ]);
  });
});

describe("the prices' scale", () => {
  it("is refused where it is not a positive number", () => {
    const show = result.match(
      () => "located",
      (e: { readonly message: string }) => e.message,
    );
    const c = components([centre({})]);
    expect(show(located({ ...c, scale: 100 }))).toBe("located");
    expect(show(located({ ...c, scale: 0 }))).toBe("the prices' scale, 0: a positive number");
    expect(show(located({ ...c, scale: -100 }))).toBe("the prices' scale, -100: a positive number");
    expect(show(located({ ...c, scale: Number.NaN }))).toBe("the prices' scale, NaN: a positive number");
  });
});
