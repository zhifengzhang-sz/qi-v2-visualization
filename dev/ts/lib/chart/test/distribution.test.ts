// 成交量分布's derive (distribution.ts): over a record's K-lines, from the K-line that represents its start merged bar
// to the one that represents its end merged bar, by the library's one map; rows by the cents spanned, at most 24; each
// 笔, each level's 线段, 走势 and 中枢; a kind and level with none left out; the volumes whole.

import type { Consolidation } from "@qi/chanlun";
import { describe, expect, it } from "vitest";
import { profilesOf } from "../src/distribution.ts";
import type { Bar } from "../src/schemas.ts";
import { merged, run } from "./records.ts";

// bars inside from (low, high), each up, a volume of 10 (over three rows, 10/3 in each)
const axis = (ranges: readonly (readonly [number, number])[]): readonly Bar[] =>
  ranges.map(([low, high], i) => ({ date: 60 * (i + 1), open: low, high, low, close: high, volume: 10 }));

const centre = (start: number, end: number, level: number): Consolidation => ({
  level,
  start,
  end,
  zg: 1,
  zd: 1,
  gg: 1,
  dd: 1,
});

// at a scale of 100, a price unit is a cent: the first three K-lines span 3 cents, all four 1,000
const xs = axis([
  [100, 103],
  [100, 103],
  [100, 103],
  [0, 1000],
]);

// a merged bar a K-line, each represented by its own K-line
const bars = xs.map((_, i) => merged({ index: i, mIndex: i, start: i, end: i, extremes: [i] }));

describe("profilesOf", () => {
  const ps = profilesOf({ rows: 24 })({
    scale: 100,
    xAxis: xs,
    run: run({
      merged: bars,
      strokes: [{ start: 0, end: 2 }],
      segments: [[{ start: 0, end: 3, level: 0 }], [{ start: 0, end: 2, level: 1 }]],
      moves: [[{ start: 1, end: 3, level: 0 }]],
      consolidations: [[], [centre(1, 3, 1)]],
    }),
  });

  it("gives each kind and level that has items, none for the rest", () => {
    expect(ps.map((p) => [p.kind, p.level, p.items.length])).toEqual([
      ["bi", 0, 1],
      ["duan", 0, 1],
      ["duan", 1, 1],
      ["zoushi", 0, 1],
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

  it("has 24 rows at most, and a 走势 and a 中枢 over their merged bars' K-lines", () => {
    expect(ps[1]?.items[0]?.up.length).toBe(24);
    expect(ps[3]?.items[0]).toMatchObject({ from: 1, to: 3 });
    expect(ps[4]?.items[0]).toMatchObject({ from: 1, to: 3 });
  });

  it("spans a line from the K-line that represents its start merged bar, not from that merged bar's start", () => {
    // merged bar 1 over K-lines 1 and 2, represented by 2: the line starts at K-line 2
    const ks = axis([
      [10, 20],
      [12, 25],
      [15, 25],
      [11, 18],
    ]);
    const [p] = profilesOf({ rows: 24 })({
      scale: 100,
      xAxis: ks,
      run: run({
        merged: [
          merged({}),
          merged({ mIndex: 1, index: 2, start: 1, end: 2, extremes: [2] }),
          merged({ mIndex: 2, index: 3, up: false, start: 3, end: 3, extremes: [3] }),
        ],
        strokes: [{ start: 1, end: 2 }],
      }),
    });
    expect(p?.items[0]).toMatchObject({ from: 2, to: 3 });
  });
});
