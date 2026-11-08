// 中枢's drawing (zhongshu.ts) through an engine of text, and the groups by level (drawing.ts): a 中枢 a box DD to GG
// lightly filled and a box ZD to ZG filled darker without a border, in its level's colour, from the K-line that
// represents its start merged bar to the one that represents its end merged bar, dashed until its end is confirmed;
// level L the group of its 线段, its 走势 and its 中枢, level 0's with 包含, 分型 and 笔.

import { result } from "@qi/base";
import type { Consolidation } from "@qi/chanlun";
import { describe, expect, it } from "vitest";
import { type Bars, drawing, type Engine, type Located, located } from "../src/index.ts";
import { locator } from "../src/locate.ts";
import { zhongshuDefaults } from "../src/schemas.ts";
import { zhongshu } from "../src/zhongshu.ts";
import { merged, ranges, run } from "./records.ts";

const words: Engine<string> = {
  candle: (at) => `candle ${at}`,
  box: (from, to, low, high, s) =>
    `box ${from}-${to} ${low}..${high} ${s.colour}${s.border === false ? " no border" : ""}${s.fill ? ` fill ${s.fill.opacity}` : ""}${s.dashed ? " dashed" : ""}`,
  mark: (at) => `mark ${at}`,
  line: (from, to, s) => `line ${from.at}@${from.price} ${to.at}@${to.price} ${s.colour} ${s.width}`,
  series: (values, form) => `series ${form} ${values.length}`,
  profile: (from, to) => `profile ${from}-${to}`,
};

const centre = (c: Partial<Consolidation>): Consolidation => ({
  level: 0,
  start: 1,
  end: 2,
  confirmEnd: 3,
  zg: 2,
  zd: 1.5,
  gg: 2.5,
  dd: 1,
  ...c,
});

describe("中枢's drawing", () => {
  it("draws its range and its band, in its level's colour, from its start merged bar's index to its end's", () => {
    // merged bar 1 at K-line 0, merged bar 2 at K-line 3 (its extremes 3 and 4)
    const loc = locator([
      merged({}),
      merged({ mIndex: 1, index: 0, extremes: [0] }),
      merged({ mIndex: 2, index: 3, start: 1, end: 4, extremes: [3, 4] }),
    ]);
    const { confirmEnd: _, ...building } = centre({ level: 1 });
    expect(
      zhongshu(words)(zhongshuDefaults, (l) => ["cl-center", "cl-event", "cl-gap"][l] ?? "cl-muted")(loc)([
        centre({}),
        building,
      ]),
    ).toEqual([
      "box 0-3 1..2.5 cl-center fill 0.08",
      "box 0-3 1.5..2 cl-center no border fill 0.3",
      "box 0-3 1..2.5 cl-event fill 0.08 dashed",
      "box 0-3 1.5..2 cl-event no border fill 0.3",
    ]);
  });
});

describe("the groups by level", () => {
  it("groups each level's 线段, 走势 and 中枢, level 0's after 包含, 分型 and 笔", () => {
    // five K-lines, a merged bar each, up and down by turns
    const xs = ranges([
      [10, 25],
      [5, 20],
      [10, 25],
      [5, 20],
      [10, 25],
    ]);
    const bars = xs.map((_, i) =>
      merged({
        index: i,
        mIndex: i,
        up: i % 2 === 0,
        high: i % 2 === 0 ? 25 : 20,
        low: i % 2 === 0 ? 10 : 5,
        start: i,
        end: i,
        confirmEnd: Math.min(i + 1, 4),
        extremes: [i],
      }),
    );
    const d = result.match(
      (l: Located<Bars>) => drawing(words)(l),
      () => undefined,
    )(
      located({
        title: "t",
        scale: 1,
        xAxis: xs,
        run: run({
          merged: bars,
          fractals: [{ mIndex: 1 }],
          strokes: [{ start: 0, end: 1, confirmEnd: 2 }],
          segments: [[{ start: 0, end: 3, confirmEnd: 4, level: 0 }], [{ start: 0, end: 4, level: 1 }]],
          moves: [[{ start: 0, end: 3, confirmEnd: 4, level: 0 }]],
          consolidations: [[], [centre({ level: 1, start: 0, end: 4, confirmEnd: 4 })]],
        }),
        addons: [],
      }),
    );
    expect(d?.groups.map((g) => [g.level, g.colour, g.layers.map((l) => `${l.key} ${l.name}`)])).toEqual([
      [0, "cl-center", ["merged 包含", "fx 分型", "bi 笔", "duan0 线段", "zoushi0 走势"]],
      [1, "cl-event", ["duan1 线段", "zhongshu1 中枢"]],
    ]);
  });
});
