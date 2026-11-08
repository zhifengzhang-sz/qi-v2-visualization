// 分型's drawing (fenxing.ts) through an engine that writes each primitive it is given as a line of text: a 分型 whose
// start is confirmed is a circle at each K-line of its merged bar, above a top, below a bottom, in ink once its end is
// confirmed, muted while not; one whose start is not confirmed, nothing.

import type { Fractal } from "@qi/chanlun";
import { describe, expect, it } from "vitest";
import { fenxing } from "../src/fenxing.ts";
import type { Engine } from "../src/index.ts";
import type { Locator } from "../src/locate.ts";
import { fenxingDefaults } from "../src/schemas.ts";

// a stand-in for the one map (locate.ts, tested there): each merged bar's K-lines as given
const loc = (of: { readonly [mno: number]: readonly number[] }): Locator => ({
  all: (mno) => of[mno] ?? [],
  at: (mno) => of[mno]?.[0],
});

const words: Engine<string> = {
  candle: (at, open, high, low, close) => `candle ${at} ${open} ${high} ${low} ${close}`,
  line: (from, to, st) => `line ${from.at}@${from.price}-${to.at}@${to.price} ${st.colour}`,
  box: (from, to, low, high, s) => `box ${from}-${to} ${low}..${high} ${s.colour}`,
  mark: (at, side, shape, s) => `mark ${at} ${side} ${shape} ${s.colour}`,
  series: (values, form) => `series ${form} ${values.length}`,
  profile: (from, to) => `profile ${from}-${to}`,
};

const fx = (f: Partial<Fractal>): Fractal => ({
  rno: 2,
  date: 2,
  mno: 1,
  ding: true,
  turningpoint: false,
  high: 25,
  low: 15,
  confirmStartDate: 3,
  confirmEndDate: 5,
  stored: 1,
  ...f,
});

describe("分型's drawing", () => {
  it("draws a circle at each K-line of its extreme, above a top, below a bottom", () => {
    expect(
      fenxing(words)(fenxingDefaults)(loc({ 1: [1, 2], 2: [3] }))([
        fx({}),
        fx({ ding: false, mno: 2, rno: 4, date: 4 }),
      ]),
    ).toEqual(["mark 1 above circle cl-ink", "mark 2 above circle cl-ink", "mark 3 below circle cl-ink"]);
  });

  it("mutes one whose end is not confirmed, and draws none whose start is not", () => {
    const { confirmEndDate: _, ...open } = fx({});
    const { confirmStartDate: __, ...unseen } = fx({ mno: 3 });
    expect(fenxing(words)(fenxingDefaults)(loc({ 1: [1, 2], 3: [4] }))([open, unseen])).toEqual([
      "mark 1 above circle cl-muted",
      "mark 2 above circle cl-muted",
    ]);
  });
});
