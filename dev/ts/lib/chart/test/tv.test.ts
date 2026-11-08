// The tv adapter (tv.ts) on a small x-axis: the merged bars of two K-lines or more as boxes, dashed until their end is
// confirmed, each marked at its K-lines (locate.ts); a 分型 at its merged bar's, muted while its end is not
// confirmed; a 笔 as a segment from its start merged bar's K-line to its end's, dashed until its end is confirmed; the
// layers, the page's boxes.

import { result } from "@qi/base";
import { type Fractal, type KLine, klinesSchema, type MergedBar, type Stroke } from "@qi/chanlun";
import { decode } from "@qi/core";
import { describe, expect, it } from "vitest";
import { type Chart, type Layers, tvChart } from "../src/index.ts";

// K-lines a minute apart, from (low, high), the open just above the low, the close just below the high, in the contract's
// fields
const axis = (ranges: readonly (readonly [number, number])[]): readonly KLine[] =>
  result.getOrElse((): readonly KLine[] => [])(
    decode(klinesSchema)(
      ranges.map(([low, high], i) => ({
        rno: i,
        date: 60 * (i + 1),
        up: false,
        open: low,
        high,
        low,
        close: high,
        volume: 0,
        confirmRno: 0,
        confirmDate: i,
        stored: 1,
      })),
    ),
  );

// 0: [10, 20]; 1: [12, 25] higher, a new bar going up; 2: [15, 25] within 1, merged up to [15, 25], its high on 1 and
// 2; 3: [11, 18] lower, a new bar going down; 4: [13, 16] within 3, merged down to [11, 16], its low on 3; each merged
// bar's rno its last K-line, as its producer gives it
const xs = axis([
  [10, 20],
  [12, 25],
  [15, 25],
  [11, 18],
  [13, 16],
]);
const good: readonly MergedBar[] = [
  {
    rno: 0,
    mno: 0,
    up: true,
    high: 20,
    low: 10,
    startDate: 0,
    confirmStartDate: 0,
    endDate: 0,
    confirmEndDate: 1,
    stored: 1,
  },
  {
    rno: 2,
    mno: 1,
    up: true,
    high: 25,
    low: 15,
    startDate: 1,
    confirmStartDate: 1,
    endDate: 2,
    confirmEndDate: 3,
    stored: 1,
  },
  {
    rno: 4,
    mno: 2,
    up: false,
    high: 16,
    low: 11,
    startDate: 3,
    confirmStartDate: 3,
    endDate: 4,
    stored: 0,
  },
];

// the top at merged bar 1, [15, 25], dated by its producer at its last K-line, 2; its high on K-lines 1 and 2
const top: Fractal = {
  rno: 2,
  date: 2,
  mno: 1,
  ding: true,
  turningpoint: false,
  high: 25,
  low: 15,
  confirmStartDate: 3,
  stored: 0,
};

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
  merged: good,
  fractals: [],
  strokes: [],
  duan: [],
  zoushi: [],
  zhongshu: [],
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

  it("draws a 分型 at each K-line of its merged bar, muted while its end is not confirmed, in the layer 分型", () => {
    const fx = parts({ ...base, fractals: [top] }).layers?.levels[0]?.items.find((l) => l.name === "分型");
    expect(fx?.markers).toEqual([
      { time: 120, position: "aboveBar", shape: "circle", color: "cl-muted", size: 0.6 },
      { time: 180, position: "aboveBar", shape: "circle", color: "cl-muted", size: 0.6 },
    ]);
  });

  it("draws a 笔 as a segment from its start merged bar's K-line to its end's, low to high when up, dashed until its end is confirmed", () => {
    const line = { level: -2, high: 25, startRno: 0, endRno: 0 } as const;
    const up: Stroke = {
      ...line,
      isUp: true,
      low: 10,
      startDate: 0,
      confirmStartDate: 3,
      endDate: 2,
      stored: 0,
      startBar: 0,
      endBar: 1,
    };
    const down: Stroke = {
      ...line,
      isUp: false,
      low: 11,
      startDate: 2,
      confirmStartDate: 3,
      endDate: 4,
      confirmEndDate: 4,
      stored: 1,
      startBar: 1,
      endBar: 2,
    };
    expect(parts({ ...base, strokes: [up, down] }).series.find((s) => s.type === "Segments")?.data).toEqual([
      { time: 60, value: 1, endTime: 120, endValue: 2.5, color: "cl-stroke", lineStyle: 2 },
      { time: 120, value: 2.5, endTime: 240, endValue: 1.1, color: "cl-stroke", lineStyle: 0 },
    ]);
  });

  it("gives the page's boxes: K线 and 成交量 apart; level 0 its configurations that have data, here 包含 alone, fine", () => {
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
