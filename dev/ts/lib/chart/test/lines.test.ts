// The lines' drawing (lines.ts) through an engine that writes each primitive it is given as a line of text: a 笔, 线段
// or 走势 is a line from the K-line that represents its start merged bar, at that merged bar's extreme, to the one that
// represents its end merged bar, at its extreme, dashed until its end is confirmed; a 笔 grey, a 线段 the level's ink;
// a 走势 up, down or flat by its ends' extremes, a step wider per level.

import type { Segment } from "@qi/chanlun";
import { describe, expect, it } from "vitest";
import type { Engine } from "../src/index.ts";
import { lineOf, zoushi } from "../src/lines.ts";
import { locator } from "../src/locate.ts";
import { biDefaults, duanDefaults, zoushiDefaults } from "../src/schemas.ts";
import { merged } from "./records.ts";

const words: Engine<string> = {
  candle: (at) => `candle ${at}`,
  box: (from, to) => `box ${from}-${to}`,
  mark: (at) => `mark ${at}`,
  line: (from, to, s) =>
    `line ${from.at}@${from.price} ${to.at}@${to.price} ${s.colour} ${s.width}${s.dashed ? " dashed" : ""}`,
  series: (values, form) => `series ${form} ${values.length}`,
  profile: (from, to) => `profile ${from}-${to}`,
};

// down to 1 at K-line 1; up to 2.5 at 3 (and 4); down to 1 at 5; up to 1 at 6, level with 5's low
const loc = locator([
  merged({ index: 0 }),
  merged({ mIndex: 1, index: 1, up: false, high: 2, low: 1, start: 1, end: 1, extremes: [1] }),
  merged({ mIndex: 2, index: 3, high: 2.5, low: 1.5, start: 2, end: 4, extremes: [3, 4] }),
  merged({ mIndex: 3, index: 5, up: false, high: 2, low: 1, start: 5, end: 5, extremes: [5] }),
  merged({ mIndex: 4, index: 6, high: 1, low: 0.5, start: 6, end: 6, extremes: [6] }),
]);

describe("the lines' drawing", () => {
  it("draws a 笔 from its start merged bar's index at its extreme to its end's at its extreme", () => {
    expect(
      lineOf(biDefaults)(words)(loc)([
        { start: 1, end: 2, confirmEnd: 3 },
        { start: 2, end: 3, confirmEnd: 4 },
      ]),
    ).toEqual(["line 1@1 3@2.5 cl-stroke 0.7", "line 3@2.5 5@1 cl-stroke 0.7"]);
  });

  it("dashes one whose end is not confirmed, and draws a 线段 in the level's ink", () => {
    const segment: Segment = { start: 1, end: 2, level: 0 };
    expect(lineOf(duanDefaults)(words)(loc)([segment])).toEqual(["line 1@1 3@2.5 cl-level 0.7 dashed"]);
  });

  it("draws a 走势 up, down, or flat where its ends are level, a step wider per level", () => {
    expect(
      zoushi(zoushiDefaults)(words)(loc)([
        { start: 1, end: 2, confirmEnd: 3, level: 0 },
        { start: 2, end: 3, confirmEnd: 4, level: 1 },
        { start: 3, end: 4, level: 2 },
      ]),
    ).toEqual(["line 1@1 3@2.5 cl-up 1.4", "line 3@2.5 5@1 cl-down 2.1", "line 5@1 6@1 cl-muted 2.8 dashed"]);
  });
});
