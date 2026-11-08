// 中枢's and 走势's drawings (zhongshu.ts, lines.ts) through an engine of text, and the groups by level (drawing.ts): a
// 中枢 a box DD to GG lightly filled and a box ZD to ZG filled darker without a border, in its level's colour; a 走势 a
// line red up, green down, heavier a level; a level L above 0 the group of its 线段 (the 走势 of level L − 1) and its
// 中枢.

import { result } from "@qi/base";
import { type Centre, type KLine, klinesSchema, type MergedBar, type Stroke } from "@qi/chanlun";
import { decode } from "@qi/core";
import { describe, expect, it } from "vitest";
import { type Bars, drawing, type Engine, type Located, located } from "../src/index.ts";
import { zoushi } from "../src/lines.ts";
import type { Locator } from "../src/locate.ts";
import { zhongshuDefaults, zoushiDefaults } from "../src/schemas.ts";
import { zhongshu } from "../src/zhongshu.ts";

// a stand-in for the one map (locate.ts, tested there): each merged bar's K-lines as given
const loc = (of: { readonly [mno: number]: readonly number[] }): Locator => ({
  all: (mno) => of[mno] ?? [],
  at: (mno) => of[mno]?.[0],
});

const words: Engine<string> = {
  candle: (at) => `candle ${at}`,
  box: (from, to, low, high, s) =>
    `box ${from}-${to} ${low}..${high} ${s.colour}${s.border === false ? " no border" : ""}${s.fill ? ` fill ${s.fill.opacity}` : ""}${s.dashed ? " dashed" : ""}`,
  mark: (at) => `mark ${at}`,
  line: (from, to, s) => `line ${from.at}@${from.price} ${to.at}@${to.price} ${s.colour} ${s.width}`,
  series: (values, form) => `series ${form} ${values.length}`,
  profile: (from, to) => `profile ${from}-${to}`,
};

const centre = (c: Partial<Centre>): Centre => ({
  level: 0,
  startRno: 0,
  startDate: 1,
  endRno: 0,
  endDate: 4,
  entrance: false,
  exit: true,
  zg: 20,
  zd: 15,
  gg: 25,
  ggRno: 0,
  ggDate: 2,
  dd: 10,
  ddRno: 0,
  ddDate: 3,
  d: 15,
  g: 20,
  buy: "()",
  tp0: "()",
  tp0Rno: "()",
  tp1: "()",
  tp1Rno: "()",
  tp2: "()",
  tp2Rno: "()",
  confirmStartDate: 2,
  confirmEndDate: 5,
  stored: 1,
  startBar: 1,
  endBar: 4,
  ggBar: 2,
  ddBar: 3,
  ...c,
});

const trend = (b: Partial<Stroke>): Stroke => ({
  level: 1,
  isUp: true,
  startDate: 1,
  confirmStartDate: 2,
  endDate: 4,
  confirmEndDate: 5,
  high: 25,
  low: 10,
  startRno: 0,
  endRno: 0,
  stored: 1,
  startBar: 1,
  endBar: 4,
  ...b,
});

describe("中枢's and 走势's drawings", () => {
  it("draws a 中枢 as its range and its band, in its level's colour, from its start merged bar's K-line to its end's", () => {
    // the K-lines of the merged bars, not the producer's dates (startDate 1, endDate 4)
    expect(
      zhongshu(words)(10, zhongshuDefaults, (l) => ["cl-center", "cl-event", "cl-gap"][l] ?? "cl-muted")(
        loc({ 1: [0], 4: [3, 4] }),
      )([centre({}), centre({ level: 1 })]),
    ).toEqual([
      "box 0-3 1..2.5 cl-center fill 0.08",
      "box 0-3 1.5..2 cl-center no border fill 0.3",
      "box 0-3 1..2.5 cl-event fill 0.08",
      "box 0-3 1.5..2 cl-event no border fill 0.3",
    ]);
  });

  it("draws a 走势 red up, green down, heavier a level", () => {
    expect(
      zoushi(zoushiDefaults)(words)(10)(loc({ 1: [1], 4: [4], 6: [6] }))([
        trend({}),
        trend({ isUp: false, level: 0, startBar: 4, endBar: 6 }),
      ]),
    ).toEqual(["line 1@1 4@2.5 cl-up 2.1", "line 4@2.5 6@1 cl-down 1.4"]);
  });

  it("groups level 1 as its 线段, the 走势 of level 0, and its 中枢", () => {
    // five K-lines, a merged bar each, so the merged bars the 走势 and the 中枢 name are known
    const xs: readonly KLine[] = result.getOrElse((): readonly KLine[] => [])(
      decode(klinesSchema)(
        [0, 1, 2, 3, 4].map((i) => ({
          rno: i,
          date: 60 * (i + 1),
          up: true,
          open: 10,
          high: 25,
          low: 10,
          close: 25,
          volume: 0,
          confirmRno: 0,
          stored: 1,
        })),
      ),
    );
    const merged: readonly MergedBar[] = xs.map((_, i) => ({
      rno: i,
      mno: i,
      up: true,
      high: 25,
      low: 10,
      startDate: i,
      endDate: i,
      stored: 1,
    }));
    const d = result.match(
      (l: Located<Bars>) => drawing(words)(l),
      () => undefined,
    )(
      located({
        title: "t",
        scale: 10,
        xAxis: xs,
        merged,
        fractals: [],
        strokes: [],
        duan: [],
        zoushi: [trend({ level: 0 })],
        zhongshu: [centre({ level: 1 })],
        addons: [],
      }),
    );
    expect(d?.groups.map((g) => [g.level, g.colour, g.layers.map((l) => l.name)])).toEqual([
      [0, "cl-center", ["包含"]],
      [1, "cl-event", ["线段", "中枢"]],
    ]);
  });
});
