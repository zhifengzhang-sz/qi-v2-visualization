// The d3fc engine (d3fc.ts): the same drawing as the tv engine's, its primitives as d3fc's shapes at x the K-line's
// position, through qi-d3fc/1's contract: a merged bar's box and marks, the candles coloured by their direction; the
// layers and groups as the drawing gives them.

import { result } from "@qi/base";
import { describe, expect, it } from "vitest";
import { marginsSchema } from "../src/dsl.ts";
import { type D3fc, d3fcChart, d3fcSchema } from "../src/index.ts";
import { merged, ranges, run } from "./records.ts";

const xs = ranges(
  [
    [10, 20],
    [12, 25],
    [15, 25],
  ],
  10,
);
// one merged bar over K-lines 1 and 2, going up, its high 2.5 on both, still merging
const { confirmEnd: _, ...bar } = merged({
  index: 1,
  high: 2.5,
  low: 1.5,
  start: 1,
  end: 2,
  extremes: [1, 2],
});

const out = (): D3fc | string =>
  result.match(
    (d: D3fc): D3fc | string => d,
    (e: { readonly message: string }) => e.message,
  )(
    d3fcChart({
      title: "t",
      scale: 10,
      xAxis: xs,
      run: run({ merged: [bar] }),
      addons: [],
    }),
  );

describe("the d3fc engine", () => {
  it("draws the candles, coloured by their direction, at their positions", () => {
    const d = out();
    expect(typeof d === "string" ? d : d.apart[0]?.candles).toEqual([
      { x: 0, open: 1, high: 2, low: 1, close: 2, colour: "cl-up" },
      { x: 1, open: 1.2, high: 2.5, low: 1.2, close: 2.5, colour: "cl-up" },
      { x: 2, open: 1.5, high: 2.5, low: 1.5, close: 2.5, colour: "cl-up" },
    ]);
  });

  it("draws a merged bar as a box and its extreme's marks, in the layer 包含, the times beside", () => {
    const d = out();
    const bh = typeof d === "string" ? undefined : d.groups[0]?.layers.find((l) => l.name === "包含");
    expect(bh?.boxes).toEqual([
      {
        x0: 1,
        x1: 2,
        low: 1.5,
        high: 2.5,
        colour: "cl-up",
        dashed: true,
        border: true,
        width: 0.7,
        fill: { colour: "cl-up", opacity: 0.08 },
      },
    ]);
    expect(bh?.marks).toEqual([
      { x: 1, side: "above", shape: "arrow", colour: "cl-up", size: 0.6 },
      { x: 2, side: "above", shape: "arrow", colour: "cl-up", size: 0.6 },
    ]);
    expect(typeof d === "string" ? d : d.times).toEqual([60, 120, 180]);
  });

  it("refuses times that do not increase, and margins that leave no height", () => {
    expect(d3fcSchema.unwrap().shape.times.safeParse([60, 120, 180]).success).toBe(true);
    expect(d3fcSchema.unwrap().shape.times.safeParse([60, 60, 180]).success).toBe(false);
    expect(marginsSchema.safeParse({ top: 0.8, bottom: 0.3 }).success).toBe(false);
    expect(marginsSchema.safeParse({ top: 0.5, bottom: 0.5 }).success).toBe(false);
    expect(marginsSchema.safeParse({ top: 0.75, bottom: 0 }).success).toBe(true);
  });
});
