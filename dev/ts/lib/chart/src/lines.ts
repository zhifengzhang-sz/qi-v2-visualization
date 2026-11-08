// The lines' drawing, for any engine (docs/designs/design-chart-lib-2026-10-24.md, The DSL): each 笔, 线段 or 走势
// whose start is confirmed is a line from its start merged bar's K-line to its end merged bar's (locate.ts), from low
// to high when it goes up, high to low when it goes down, dashed until its end is confirmed. A 笔 and a 线段 each
// have their own colour and width. A 走势 of level L (the 线段 of level L + 1) takes the up or down colour, and is a
// step wider per level.

import { type Engine, settled } from "./dsl.ts";
import type { Locator } from "./locate.ts";
import type { LineStyle, Stroke, ZoushiStyle } from "./schemas.ts";

const lines =
  (colour: (b: Stroke) => string, width: (b: Stroke) => number) =>
  <R>(e: Engine<R>) =>
  (scale: number) =>
  (loc: Locator) =>
  (ls: readonly Stroke[]): readonly R[] =>
    ls
      .filter((b) => settled(b) !== "none")
      .flatMap((b) => {
        const from = loc.at(b.startBar);
        const to = loc.at(b.endBar);
        return from === undefined || to === undefined
          ? []
          : [
              e.line(
                { at: from, price: (b.isUp ? b.low : b.high) / scale },
                { at: to, price: (b.isUp ? b.high : b.low) / scale },
                { colour: colour(b), width: width(b), dashed: settled(b) === "dashed" },
              ),
            ];
      });

// a 笔 or a 线段, in its style
export const lineOf = (s: LineStyle) =>
  lines(
    () => s.colour,
    () => s.width,
  );
export const zoushi = (s: ZoushiStyle) =>
  lines(
    (b) => (b.isUp ? s.up : s.down),
    // rounded to a thousandth, so 1.4 + 0.7 is exactly 2.1
    (b) => Math.round((s.width + s.step * b.level) * 1000) / 1000,
  );
