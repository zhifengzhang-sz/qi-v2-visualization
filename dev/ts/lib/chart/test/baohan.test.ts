// 包含's drawing (baohan.ts) through an engine that writes each primitive it is given as a line of text: the program is
// the DSL's, whatever engine carries it out. A block of two K-lines or more, its start confirmed, is a box from its
// first K-line to its last, dashed until its end is confirmed, and a mark at each K-line of its extreme, above when it
// goes up, below when down; a block of one K-line, or one whose start is not confirmed, nothing.

import type { MergedBar } from "@qi/chanlun";
import { describe, expect, it } from "vitest";
import { baohan } from "../src/baohan.ts";
import type { Engine } from "../src/index.ts";
import type { Locator } from "../src/locate.ts";
import { baohanDefaults } from "../src/schemas.ts";

// a stand-in for the one map (locate.ts, tested there): each merged bar's K-lines as given
const loc = (of: { readonly [mno: number]: readonly number[] }): Locator => ({
  all: (mno) => of[mno] ?? [],
  at: (mno) => of[mno]?.[0],
});

const words: Engine<string> = {
  candle: (at, open, high, low, close) => `candle ${at} ${open} ${high} ${low} ${close}`,
  line: (from, to, st) => `line ${from.at}@${from.price}-${to.at}@${to.price} ${st.colour}`,
  box: (from, to, low, high, s) =>
    `box ${from}-${to} ${low}..${high} ${s.colour}${s.fill ? ` fill ${s.fill.colour}/${s.fill.opacity}` : ""}${s.dashed ? " dashed" : ""}`,
  mark: (at, side, shape, s) => `mark ${at} ${side} ${shape} ${s.colour}`,
  series: (values, form) => `series ${form} ${values.length}`,
  profile: (from, to) => `profile ${from}-${to}`,
};

const bar = (m: Partial<MergedBar>): MergedBar => ({
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
  ...m,
});

describe("包含's drawing", () => {
  it("draws a block of two K-lines or more as a box and a mark at each K-line of its extreme", () => {
    expect(
      baohan(words)(10, baohanDefaults)(loc({ 0: [0], 1: [1, 2], 2: [3] }))([
        bar({}),
        bar({
          mno: 1,
          rno: 2,
          high: 25,
          low: 15,
          startDate: 1,
          endDate: 2,
          confirmEndDate: 3,
        }),
        bar({ mno: 2, rno: 4, up: false, high: 16, low: 11, startDate: 3, endDate: 4 }),
      ]),
    ).toEqual([
      "box 1-2 1.5..2.5 cl-up fill cl-up/0.08",
      "mark 1 above arrow cl-up",
      "mark 2 above arrow cl-up",
      "box 3-4 1.1..1.6 cl-down fill cl-down/0.08",
      "mark 3 below arrow cl-down",
    ]);
  });

  it("dashes a block whose end is not confirmed, and draws none whose start is not", () => {
    const { confirmEndDate: _, ...open } = bar({ startDate: 1, endDate: 2 });
    const { confirmStartDate: __, ...unseen } = bar({ mno: 1, startDate: 3, endDate: 4 });
    expect(baohan(words)(10, baohanDefaults)(loc({ 0: [2], 1: [4] }))([open, unseen])).toEqual([
      "box 1-2 1..2 cl-up fill cl-up/0.08 dashed",
      "mark 2 above arrow cl-up",
    ]);
  });
});
