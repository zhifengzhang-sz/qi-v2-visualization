// 成交量分布's derive (distribution.ts): over a configuration's K-lines, from its start merged bar's to
// its end's by the library's one map; rows by
// the cents spanned, at most 24; each level's 线段 (level 0's duan, level L's the 走势 of L − 1) and 中枢; a kind and
// level with none left out; the volumes whole.

import { result } from "@qi/base";
import { type Centre, type KLine, klinesSchema, type MergedBar, type Stroke } from "@qi/chanlun";
import { decode } from "@qi/core";
import { describe, expect, it } from "vitest";
import { profilesOf } from "../src/distribution.ts";

// K-lines from (low, high), each up, a volume of 10 (over three rows, 10/3 in each)
const axis = (ranges: readonly (readonly [number, number])[]): readonly KLine[] =>
  result.getOrElse((): readonly KLine[] => [])(
    decode(klinesSchema)(
      ranges.map(([low, high], i) => ({
        rno: i,
        date: 60 * (i + 1),
        up: true,
        open: low,
        high,
        low,
        close: high,
        volume: 10,
        confirmRno: 0,
        stored: 1,
      })),
    ),
  );

const line = (from: number, to: number, level = 0): Stroke => ({
  level,
  isUp: to > from,
  startDate: from,
  endDate: to,
  high: 0,
  low: 0,
  startRno: 0,
  endRno: 0,
  stored: 1,
  startBar: from,
  endBar: to,
});

const centre = (startDate: number, endDate: number, level: number): Centre => ({
  level,
  startRno: 0,
  startDate,
  endRno: 0,
  endDate,
  entrance: true,
  exit: true,
  zg: 0,
  zd: 0,
  gg: 0,
  ggRno: 0,
  ggDate: startDate,
  dd: 0,
  ddRno: 0,
  ddDate: startDate,
  d: 0,
  g: 0,
  buy: "()",
  tp0: "()",
  tp0Rno: "()",
  tp1: "()",
  tp1Rno: "()",
  tp2: "()",
  tp2Rno: "()",
  stored: 1,
  startBar: startDate,
  endBar: endDate,
  ggBar: startDate,
  ddBar: startDate,
});

// at a scale of 100, a price unit is a cent: the first three K-lines span 3 cents, all four 1,000
const xs = axis([
  [100, 103],
  [100, 103],
  [100, 103],
  [0, 1000],
]);

// a merged bar a K-line, up: each its own K-line by the one map
const merged: readonly MergedBar[] = xs.map((k, i) => ({
  rno: i,
  mno: i,
  up: true,
  high: k.high,
  low: k.low,
  startDate: i,
  endDate: i,
  stored: 1,
}));

describe("profilesOf", () => {
  const ps = profilesOf({ rows: 24 })({
    scale: 100,
    xAxis: xs,
    merged,
    strokes: [line(0, 2)],
    duan: [line(0, 3)],
    zoushi: [line(0, 2, 0)],
    zhongshu: [centre(1, 3, 1)],
  });

  it("gives each kind and level that has items, none for the rest", () => {
    expect(ps.map((p) => [p.kind, p.level, p.items.length])).toEqual([
      ["bi", 0, 1],
      ["duan", 0, 1],
      ["duan", 1, 1],
      ["zhongshu", 1, 1],
    ]);
  });

  it("takes a line's K-lines, a row a cent where it spans fewer than 24, the volumes whole", () => {
    const [bi] = ps;
    expect(bi?.items[0]).toEqual({
      from: 0,
      to: 2,
      low: 100,
      step: 1,
      up: [10, 10, 10],
      down: [0, 0, 0],
      poc: 0,
      value: { from: 0, to: 2 },
    });
  });

  it("has 24 rows at most, and a 中枢 over its merged bars' K-lines", () => {
    expect(ps[1]?.items[0]?.up.length).toBe(24);
    expect(ps[3]?.items[0]).toMatchObject({ from: 1, to: 3 });
  });

  it("spans a line from its start merged bar's K-line, by the one map, not from the producer's date", () => {
    // merged bar 1 over K-lines 1 and 2, up, its high 25 on both: the line starts at K-line 1, not at its date, 2
    const ks = axis([
      [10, 20],
      [12, 25],
      [15, 25],
      [11, 18],
    ]);
    const bar = (
      mno: number,
      from: number,
      to: number,
      up: boolean,
      low: number,
      high: number,
    ): MergedBar => ({
      rno: to,
      mno,
      up,
      high,
      low,
      startDate: from,
      endDate: to,
      stored: 1,
    });
    const [p] = profilesOf({ rows: 24 })({
      scale: 100,
      xAxis: ks,
      merged: [bar(0, 0, 0, true, 10, 20), bar(1, 1, 2, true, 12, 25), bar(2, 3, 3, false, 11, 18)],
      strokes: [{ ...line(1, 2), startDate: 2, endDate: 3 }],
      duan: [],
      zoushi: [],
      zhongshu: [],
    });
    expect(p?.items[0]).toMatchObject({ from: 1, to: 3 });
  });
});
