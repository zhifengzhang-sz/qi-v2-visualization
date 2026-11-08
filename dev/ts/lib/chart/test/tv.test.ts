// The tv adapter (tv.ts) on a small x-axis: the merged bars of two K-lines or more as boxes, dashed until their end is
// confirmed, each marked at the K-lines of its extreme; a 分型 at the K-line that represents its merged bar; a 笔 as a
// segment from the K-line that represents its start merged bar, at its extreme, to its end's, dashed until its end is
// confirmed; the layers, the page's boxes.

import { result } from "@qi/base";
import type { MergedBar, Stroke } from "@qi/chanlun";
import { describe, expect, it } from "vitest";
import { type Chart, type Layers, tvChart } from "../src/index.ts";
import { merged, ranges, run } from "./records.ts";

// 0: [10, 20]; 1: [12, 25] higher, a new bar going up; 2: [15, 25] within 1, merged up to [15, 25], its high on 1 and
// 2; 3: [11, 18] lower, a new bar going down; 4: [13, 16] within 3, merged down to [11, 16], its low on 3; at a scale
// of 10
const xs = ranges(
  [
    [10, 20],
    [12, 25],
    [15, 25],
    [11, 18],
    [13, 16],
  ],
  10,
);
// merged bar 0 down to 1 at K-line 0; 1 up over 1 and 2, its high 2.5 on both; 2 down over 3 and 4, still merging
const { confirmEnd: _, ...merging } = merged({
  index: 3,
  mIndex: 2,
  up: false,
  high: 1.6,
  low: 1.1,
  start: 3,
  end: 4,
  extremes: [3],
});
const good: readonly MergedBar[] = [
  merged({ up: false, high: 2, low: 1 }),
  merged({ index: 1, mIndex: 1, high: 2.5, low: 1.5, start: 1, end: 2, confirmEnd: 3, extremes: [1, 2] }),
  merging,
];

// the adapter's output, or the failure's message
const out = (c: Parameters<typeof tvChart>[0], shown: Parameters<typeof tvChart>[1] = "all") =>
  result.match(
    (v: {
      readonly chart: Chart;
      readonly layers: Layers;
    }): { readonly chart: Chart; readonly layers: Layers } | string => v,
    (e: { readonly message: string }) => e.message,
  )(tvChart(c, shown));

const parts = (c: Parameters<typeof tvChart>[0], shown: Parameters<typeof tvChart>[1] = "all") => {
  const o = out(c, shown);
  return typeof o === "string"
    ? { series: [], layers: undefined }
    : { series: o.chart.series, layers: o.layers };
};

const base = {
  title: "t",
  scale: 10,
  xAxis: xs,
  run: run({ merged: good }),
  addons: [],
};

describe("the tv adapter", () => {
  it("draws the merged bars of two K-lines or more, dashed until their end is confirmed", () => {
    expect(parts(base).series.find((s) => s.type === "Boxes")?.data).toEqual([
      { time: 120, endTime: 180, low: 1.5, high: 2.5, color: "cl-up", fillColor: "cl-up/8", lineStyle: 0 },
      {
        time: 240,
        endTime: 300,
        low: 1.1,
        high: 1.6,
        color: "cl-down",
        fillColor: "cl-down/8",
        lineStyle: 2,
      },
    ]);
  });

  it("marks each drawn merged bar's extreme at its K-lines, in the layer 包含", () => {
    const merged = parts(base).layers?.levels[0]?.items.find((l) => l.name === "包含");
    expect(merged?.series).toEqual(["merged"]);
    expect(merged?.markers).toEqual([
      { time: 120, position: "aboveBar", shape: "arrowDown", color: "cl-up", size: 0.6 },
      { time: 180, position: "aboveBar", shape: "arrowDown", color: "cl-up", size: 0.6 },
      { time: 240, position: "belowBar", shape: "arrowUp", color: "cl-down", size: 0.6 },
    ]);
  });

  it("draws a 分型 at the K-line that represents its merged bar, in the layer 分型", () => {
    // a top at merged bar 1: it goes up, merged bar 2 down
    const fx = parts({
      ...base,
      run: run({ merged: good, fractals: [{ mIndex: 1 }] }),
    }).layers?.levels[0]?.items.find((l) => l.name === "分型");
    expect(fx?.markers).toEqual([
      { time: 120, position: "aboveBar", shape: "circle", color: "cl-ink", size: 0.6 },
    ]);
  });

  it("draws a 笔 as a segment from its start merged bar's index at its extreme to its end's, dashed until its end is confirmed", () => {
    const up: Stroke = { start: 0, end: 1 };
    const down: Stroke = { start: 1, end: 2, confirmEnd: 2 };
    expect(
      parts({ ...base, run: run({ merged: good, strokes: [up, down] }) }).series.find(
        (s) => s.type === "Segments",
      )?.data,
    ).toEqual([
      { time: 60, value: 1, endTime: 120, endValue: 2.5, color: "cl-stroke", lineStyle: 2 },
      { time: 120, value: 2.5, endTime: 240, endValue: 1.1, color: "cl-stroke", lineStyle: 0 },
    ]);
  });

  it("gives the page's boxes: K线 and 成交量 apart; level 0 its records that it has, here 包含 alone, fine", () => {
    const shape = (l: Layers | undefined) => ({
      apart: l?.apart.map((x) => [x.name, x.series, x.on, x.fine]),
      levels: l?.levels.map((g) => [g.level, g.on, g.items.map((x) => [x.name, x.series, x.on, x.fine])]),
    });
    expect(shape(parts(base).layers)).toEqual({
      apart: [
        ["K线", ["candles"], true, false],
        ["成交量", ["volume"], true, false],
      ],
      levels: [[0, true, [["包含", ["merged"], true, true]]]],
    });
    expect(parts(base, 1).layers?.levels[0]?.on).toBe(false);
    expect(parts(base).layers?.precision).toBe(2);
    // the digits shown the caller's, whatever the scale the prices are held at
    expect(parts({ ...base, scale: 1000000 }).layers?.precision).toBe(2);
    expect(parts({ ...base, options: { layout: { digits: 4 } } }).layers?.precision).toBe(4);
  });

  it("writes the price axis to the digits the caller gives, 2 where it gives none", () => {
    const format = (digits?: number) =>
      parts(digits === undefined ? base : { ...base, options: { layout: { digits } } }).series.find(
        (s) => s.type === "Candlestick",
      )?.options;
    expect(format()).toMatchObject({ priceFormat: { type: "price", precision: 2, minMove: 0.01 } });
    expect(format(4)).toMatchObject({ priceFormat: { type: "price", precision: 4, minMove: 0.0001 } });
  });
});
