// The K-lines' drawing (kline.ts) through an engine of text: a candle at each K-line, its prices over the chart's
// scale, red when it closes at or above its open, green below.

import { result } from "@qi/base";
import { type KLine, klinesSchema } from "@qi/chanlun";
import { decode } from "@qi/core";
import { describe, expect, it } from "vitest";
import type { Engine } from "../src/index.ts";
import { kline } from "../src/kline.ts";
import { klineDefaults } from "../src/schemas.ts";

const words: Engine<string> = {
  candle: (at, open, high, low, close, colours) =>
    `candle ${at} ${open} ${high} ${low} ${close} ${close >= open ? colours.up : colours.down}`,
  box: (from, to) => `box ${from}-${to}`,
  mark: (at) => `mark ${at}`,
  line: (from, to) => `line ${from.at} ${to.at}`,
  series: (values, form) => `series ${form} ${values.length}`,
  profile: (from, to) => `profile ${from}-${to}`,
};

// two K-lines a minute apart: one up (10 to 20), one down (20 to 15)
const xs: readonly KLine[] = result.getOrElse((): readonly KLine[] => [])(
  decode(klinesSchema)(
    [
      [10, 20],
      [20, 15],
    ].map(([open = 0, close = 0], i) => ({
      rno: i,
      date: 60 * (i + 1),
      up: true,
      open,
      high: Math.max(open, close),
      low: Math.min(open, close),
      close,
      volume: 0,
      confirmRno: 0,
      confirmDate: i,
      stored: 1,
    })),
  ),
);

describe("the K-lines' drawing", () => {
  it("draws a candle at each K-line, its prices over the scale, red up, green down", () => {
    expect(kline(words)(10, klineDefaults)(xs)).toEqual([
      "candle 0 1 2 1 2 cl-up",
      "candle 1 2 2 1.5 1.5 cl-down",
    ]);
  });
});
