// The structure on the contracts' own vectors (docs/designs/design-chart-chanlun-3-2026-11-09.md, How the release is
// checked, 1), at the tags the flake pins, named by the shell: chanlun's (CHANLUN_VECTORS), market's (MARKET_VECTORS).
// run.json over the 4,000 bars its bars.ts makes, as market's K-lines, drawn by each engine, each layer's items counted
// against the records; small.json and edge.json on six K-lines made to fit them; bounds.json refused at every scale;
// market's ongoing K-line given to the online component on the first six of those bars.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { result } from "@qi/base";
import { decodeRun, type Run } from "@qi/chanlun";
import { decodeOngoingKLine, type KLine } from "@qi/market";
import { describe, expect, it } from "vitest";
import {
  type Chart,
  type D3fc,
  type D3fcTail,
  d3fcApplied,
  d3fcChart,
  d3fcTail,
  forming,
  located,
  type Online,
  online,
  type Step,
  type TvTail,
  tikzChart,
  tvApplied,
  tvChart,
  tvTail,
  xAxisSchema,
} from "../src/index.ts";
import { klines } from "./records.ts";

// a folder the shell names, or the test stops with its name
const folder = (name: string): string => {
  const dir = process.env[name];
  if (dir === undefined || dir === "") throw new Error(`${name} is not set: run the tests in nix develop`);
  return dir;
};
const chanlun = folder("CHANLUN_VECTORS");
const market = folder("MARKET_VECTORS");

const runOf = (file: string): Run => {
  const d = decodeRun(readFileSync(join(chanlun, file), "utf8"));
  if (!d.ok) throw new Error(`${file}: ${d.error}`);
  return d.run;
};

// bars.ts's bars, a line each: date (milliseconds), open, high, low, close, volume, as market's K-lines
const bars: readonly KLine[] = execFileSync("bun", [join(chanlun, "bars.ts"), "4000"], { encoding: "utf8" })
  .trim()
  .split("\n")
  .map((line, index) => {
    const [date = 0, open = 0, high = 0, low = 0, close = 0, volume = 0] = line.split(",").map(Number);
    return { index, date, open, high, low, close, volume };
  });

const chart = (xAxis: readonly KLine[], run: Run) => ({
  title: "vectors",
  scale: 100,
  xAxis,
  run,
  addons: [],
});
const ok = <T>(r: { readonly tag: string }): T =>
  result.match(
    (v: T) => v,
    (e: { readonly message: string }): T => {
      throw new Error(e.message);
    },
  )(r as never);

// the 分型 the merged bars make a top or a bottom (SPEC, Reading the records)
const kinded = (run: Run): number =>
  run.fractals.filter((f) => {
    const [here, after] = [run.merged[f.mIndex]?.up, run.merged[f.mIndex + 1]?.up];
    return here !== undefined && after !== undefined && here !== after;
  }).length;

// a d3fc layer's items, by its group's level and its name
const items = (d: D3fc, level: number, name: string) =>
  d.groups.find((g) => g.level === level)?.layers.find((l) => l.name === name);

describe("run.json over bars.ts's bars", () => {
  const run = runOf("run.json");

  it("are market's K-lines the library takes, and a run that fits them", () => {
    expect(bars).toHaveLength(4000);
    expect(xAxisSchema.safeParse(bars).success).toBe(true);
    expect(located(chart(bars, run)).tag).toBe("success");
  });

  it("are drawn by d3fc, each layer's items the records' own", () => {
    const d = ok<D3fc>(d3fcChart(chart(bars, run)));
    const two = run.merged.filter((m) => m.start < m.end);
    expect(d.groups.map((g) => [g.level, g.layers.map((l) => l.name)])).toEqual([
      [0, ["包含", "分型", "笔", "线段", "走势", "中枢"]],
      [1, ["线段", "中枢"]],
    ]);
    expect(items(d, 0, "包含")?.boxes).toHaveLength(two.length);
    expect(items(d, 0, "包含")?.marks).toHaveLength(two.reduce((n, m) => n + m.extremes.length, 0));
    expect(items(d, 0, "分型")?.marks).toHaveLength(kinded(run));
    expect(kinded(run)).toBe(run.fractals.length - 1);
    expect(items(d, 0, "笔")?.lines).toHaveLength(run.strokes.length);
    expect(items(d, 0, "线段")?.lines).toHaveLength(run.segments[0]?.length ?? -1);
    expect(items(d, 1, "线段")?.lines).toHaveLength(run.segments[1]?.length ?? -1);
    expect(items(d, 0, "走势")?.lines).toHaveLength(run.moves[0]?.length ?? -1);
    expect(items(d, 0, "中枢")?.boxes).toHaveLength(2 * (run.consolidations[0]?.length ?? -1));
    expect(items(d, 1, "中枢")?.boxes).toHaveLength(2 * (run.consolidations[1]?.length ?? -1));
    expect(d.choice.layers.map((l) => [l.name, l.profiles.length])).toEqual([
      ["笔", run.strokes.length],
      ["线段 0", run.segments[0]?.length],
      ["线段 1", run.segments[1]?.length],
      ["走势 0", run.moves[0]?.length],
      ["中枢 0", run.consolidations[0]?.length],
      ["中枢 1", run.consolidations[1]?.length],
    ]);
  });

  it("are drawn by tv with the same layers, and as the picture", () => {
    const tv = ok<{
      readonly layers: { readonly levels: readonly { readonly items: readonly unknown[] }[] };
    }>(tvChart(chart(bars, run)));
    expect(tv.layers.levels.map((g) => g.items.length)).toEqual([6, 2]);
    const tex = ok<string>(
      tikzChart(chart(bars, run), {
        from: 2000,
        to: 3999,
        width: 10,
        height: 6,
        palette: {},
        theme: "light",
      }),
    );
    expect(tex).toContain("\\begin{tikzpicture}");
  });
});

// six K-lines made to fit small.json's merged bars: the high of K-line 1, 100.3; the low of 3, 99.5; the high of 5,
// 100.5
const six = klines(
  [
    [9990, 10010, 9990, 10000],
    [10000, 10030, 9995, 10020],
    [10020, 10028, 9980, 9990],
    [9990, 10000, 9950, 9970],
    [9970, 10020, 9955, 10010],
    [10010, 10050, 9990, 10040],
  ].map(([open = 0, high = 0, low = 0, close = 0]) => ({ open, high, low, close })),
  100,
);

describe("small.json and edge.json on six K-lines", () => {
  it("are drawn: every kind of record, and parts empty", () => {
    const small = ok<D3fc>(d3fcChart(chart(six, runOf("small.json"))));
    expect(small.groups.map((g) => [g.level, g.layers.map((l) => l.name)])).toEqual([
      [0, ["包含", "分型", "笔", "线段", "走势", "中枢"]],
      [1, ["中枢"]],
    ]);
    // 分型 at 0, a top (up, then down), and at 1, a bottom
    expect(items(small, 0, "分型")?.marks.map((m) => [m.x, m.side])).toEqual([
      [1, "above"],
      [3, "below"],
    ]);
    expect(items(small, 0, "笔")?.lines).toEqual([
      expect.objectContaining({ x0: 1, y0: 100.3, x1: 3, y1: 99.5, dashed: false }),
    ]);
    const edge = ok<D3fc>(d3fcChart(chart(six, runOf("edge.json"))));
    expect(edge.groups.map((g) => [g.level, g.layers.map((l) => l.name)])).toEqual([
      [0, ["包含", "笔", "中枢"]],
    ]);
  });

  it("refuse bounds.json at every scale: no scale holds both its prices", () => {
    const bounds = runOf("bounds.json");
    // its K-lines' prices as its merged bars', at their bounds: 0.000001 and 999999999999999
    const ks = six.map((k, i) =>
      i === 3 ? { ...k, low: 0.000001 } : i === 5 ? { ...k, high: 999999999999999 } : k,
    );
    const faults = [1, 10, 100, 1000, 10000, 100000, 1000000].map((scale) =>
      result.match(
        () => "located",
        (e: { readonly message: string }) => e.message,
      )(located({ scale, xAxis: ks, run: bounds })),
    );
    expect(faults.every((f) => f !== "located")).toBe(true);
    expect(faults[6]).toBe("K-line 5: a price with more digits than the scale 1000000 holds");
  });
});

describe("market's ongoing K-line", () => {
  it("is given to the online component on bars.ts's first six K-lines, its tail the batch's", () => {
    const d = decodeOngoingKLine(readFileSync(join(market, "ongoing", "kline.json"), "utf8"));
    if (!d.ok) throw new Error(d.error);
    expect(d.kline.index).toBe(6);
    const start = chart(bars.slice(0, 6), {
      merged: [],
      fractals: [],
      strokes: [],
      segments: [],
      moves: [],
      consolidations: [],
    });
    const step = ok<Step>(forming(ok<Online>(online(start)), d.kline));
    const page = ok<{ readonly chart: Chart }>(tvChart(start)).chart;
    expect(tvApplied(page, ok<TvTail>(tvTail(step)))).toEqual(
      ok<{ readonly chart: Chart }>(tvChart(step.online.components)).chart,
    );
    const d3 = ok<D3fc>(d3fcChart(start));
    expect(d3fcApplied(d3, ok<D3fcTail>(d3fcTail(step)))).toEqual(
      ok<D3fc>(d3fcChart(step.online.components)),
    );
  });
});
