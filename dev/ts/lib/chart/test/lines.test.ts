// The lines' drawing (lines.ts) through an engine that writes each primitive it is given as a line of text: a 笔 or a
// 线段 whose start is confirmed is a line from its start merged bar's K-line to its end merged bar's, low to high when up, high to low
// when down, dashed until its end is confirmed; a 笔 grey, a 线段 the level's ink; one whose start is not confirmed,
// nothing.

import type { Stroke } from "@qi/chanlun";
import { describe, expect, it } from "vitest";
import type { Engine } from "../src/index.ts";
import { lineOf } from "../src/lines.ts";
import type { Locator } from "../src/locate.ts";
import { biDefaults, duanDefaults } from "../src/schemas.ts";

// a stand-in for the one map (locate.ts, tested there): each merged bar's K-lines as given
const loc = (of: { readonly [mno: number]: readonly number[] }): Locator => ({
  all: (mno) => of[mno] ?? [],
  at: (mno) => of[mno]?.[0],
});

const words: Engine<string> = {
  candle: (at) => `candle ${at}`,
  box: (from, to) => `box ${from}-${to}`,
  mark: (at) => `mark ${at}`,
  line: (from, to, s) =>
    `line ${from.at}@${from.price} ${to.at}@${to.price} ${s.colour}${s.dashed ? " dashed" : ""}`,
  series: (values, form) => `series ${form} ${values.length}`,
  profile: (from, to) => `profile ${from}-${to}`,
};

const stroke = (b: Partial<Stroke>): Stroke => ({
  level: -2,
  isUp: true,
  startDate: 2,
  confirmStartDate: 3,
  endDate: 4,
  confirmEndDate: 6,
  high: 25,
  low: 10,
  startRno: 0,
  endRno: 0,
  stored: 1,
  startBar: 1,
  endBar: 2,
  ...b,
});

describe("the lines' drawing", () => {
  it("draws a 笔 from its start merged bar's K-line to its end's, low to high when up, high to low when down", () => {
    const at = loc({ 1: [1], 2: [3, 4], 3: [5] });
    expect(
      lineOf(biDefaults)(words)(10)(at)([stroke({}), stroke({ isUp: false, startBar: 2, endBar: 3 })]),
    ).toEqual(["line 1@1 3@2.5 cl-stroke", "line 3@2.5 5@1 cl-stroke"]);
  });

  it("dashes one whose end is not confirmed, draws none whose start is not, and a 线段 in the level's ink", () => {
    const { confirmEndDate: _, ...open } = stroke({});
    const { confirmStartDate: __, ...unseen } = stroke({});
    expect(lineOf(duanDefaults)(words)(10)(loc({ 1: [1], 2: [3] }))([open, unseen])).toEqual([
      "line 1@1 3@2.5 cl-level dashed",
    ]);
  });
});
