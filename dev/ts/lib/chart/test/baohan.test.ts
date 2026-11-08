// 包含's drawing (baohan.ts) through an engine that writes each primitive it is given as a line of text: the program is
// the DSL's, whatever engine carries it out. A merged bar of two K-lines or more is a box from its first K-line to its
// last, its low to its high (the contract's decimals), dashed until its end is confirmed, and a mark at each K-line of
// its extreme (`extremes`), above when it goes up, below when down; a merged bar of one K-line, nothing.

import { describe, expect, it } from "vitest";
import { baohan } from "../src/baohan.ts";
import type { Engine } from "../src/index.ts";
import { baohanDefaults } from "../src/schemas.ts";
import { merged } from "./records.ts";

const words: Engine<string> = {
  candle: (at, open, high, low, close) => `candle ${at} ${open} ${high} ${low} ${close}`,
  line: (from, to, st) => `line ${from.at}@${from.price}-${to.at}@${to.price} ${st.colour}`,
  box: (from, to, low, high, s) =>
    `box ${from}-${to} ${low}..${high} ${s.colour}${s.fill ? ` fill ${s.fill.colour}/${s.fill.opacity}` : ""}${s.dashed ? " dashed" : ""}`,
  mark: (at, side, shape, s) => `mark ${at} ${side} ${shape} ${s.colour}`,
  series: (values, form) => `series ${form} ${values.length}`,
  profile: (from, to) => `profile ${from}-${to}`,
};

describe("包含's drawing", () => {
  it("draws a merged bar of two K-lines or more as a box and a mark at each K-line of its extreme", () => {
    expect(
      baohan(words)(baohanDefaults)([
        merged({ high: 2, low: 1 }),
        merged({
          mIndex: 1,
          index: 1,
          high: 2.5,
          low: 1.5,
          start: 1,
          end: 2,
          confirmEnd: 3,
          extremes: [1, 2],
        }),
        merged({ mIndex: 2, index: 3, up: false, high: 1.6, low: 1.1, start: 3, end: 4, extremes: [3] }),
      ]),
    ).toEqual([
      "box 1-2 1.5..2.5 cl-up fill cl-up/0.08",
      "mark 1 above arrow cl-up",
      "mark 2 above arrow cl-up",
      "box 3-4 1.1..1.6 cl-down fill cl-down/0.08",
      "mark 3 below arrow cl-down",
    ]);
  });

  it("dashes a merged bar whose end is not confirmed", () => {
    const { confirmEnd: _, ...open } = merged({ index: 2, high: 2, low: 1, start: 1, end: 2, extremes: [2] });
    expect(baohan(words)(baohanDefaults)([open])).toEqual([
      "box 1-2 1..2 cl-up fill cl-up/0.08 dashed",
      "mark 2 above arrow cl-up",
    ]);
  });
});
