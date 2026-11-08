// 分型's drawing (fenxing.ts) through an engine that writes each primitive it is given as a line of text: a 分型 at
// merged bar m is a top where m goes up and m + 1 down, a bottom where m goes down and m + 1 up, a circle at the K-line
// that represents m (its `index`), above a top, below a bottom, in one colour; one the merged bars make neither,
// nothing.

import { describe, expect, it } from "vitest";
import { fenxing } from "../src/fenxing.ts";
import type { Engine } from "../src/index.ts";
import { locator } from "../src/locate.ts";
import { fenxingDefaults } from "../src/schemas.ts";
import { merged } from "./records.ts";

const words: Engine<string> = {
  candle: (at, open, high, low, close) => `candle ${at} ${open} ${high} ${low} ${close}`,
  line: (from, to, st) => `line ${from.at}@${from.price}-${to.at}@${to.price} ${st.colour}`,
  box: (from, to, low, high, s) => `box ${from}-${to} ${low}..${high} ${s.colour}`,
  mark: (at, side, shape, s) => `mark ${at} ${side} ${shape} ${s.colour}`,
  series: (values, form) => `series ${form} ${values.length}`,
  profile: (from, to) => `profile ${from}-${to}`,
};

// up, up, down, up: a top at 1, a bottom at 2; 0 is neither (0 and 1 both go up), and 3 has no merged bar after it
const loc = locator([
  merged({}),
  merged({ mIndex: 1, index: 2, start: 1, end: 2, extremes: [1, 2] }),
  merged({ mIndex: 2, index: 3, up: false, start: 3, end: 3, extremes: [3] }),
  merged({ mIndex: 3, index: 4, start: 4, end: 4, extremes: [4] }),
]);

describe("分型's drawing", () => {
  it("draws a circle at its merged bar's index, above a top, below a bottom", () => {
    expect(fenxing(words)(fenxingDefaults)(loc)([{ mIndex: 1 }, { mIndex: 2 }])).toEqual([
      "mark 2 above circle cl-ink",
      "mark 3 below circle cl-ink",
    ]);
  });

  it("draws none the merged bars make neither a top nor a bottom", () => {
    expect(fenxing(words)(fenxingDefaults)(loc)([{ mIndex: 0 }, { mIndex: 3 }])).toEqual([]);
  });

  it("draws it in its style's colour", () => {
    expect(fenxing(words)({ ...fenxingDefaults, colour: "cl-muted" })(loc)([{ mIndex: 1 }])).toEqual([
      "mark 2 above circle cl-muted",
    ]);
  });
});
