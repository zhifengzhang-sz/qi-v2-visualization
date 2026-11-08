// The lines' drawing, for any engine (docs/designs/design-chart-chanlun-3-2026-11-09.md, Reading the records): each
// 笔, 线段 or 走势 is a line from the K-line that represents its start merged bar (its `index`, locate.ts), at that
// merged bar's extreme, to the one that represents its end merged bar, at its extreme; dashed until its end is
// confirmed. A 笔 and a 线段 each have their own colour and width. A 走势 goes up where its end's extreme is above its
// start's and down where it is below, in the up or the down colour, `flat` where they are level (the records give it no
// direction); a step wider per level.

import { type Engine, settled } from "./dsl.ts";
import type { Locator } from "./locate.ts";
import type { Line, LineStyle, Move, ZoushiStyle } from "./schemas.ts";

const lines =
  <L extends Line>(colour: (from: number, to: number) => string, width: (l: L) => number) =>
  <R>(e: Engine<R>) =>
  (loc: Locator) =>
  (ls: readonly L[]): readonly R[] =>
    ls.flatMap((l) => {
      const [from, to] = [loc.at(l.start), loc.at(l.end)];
      const [begins, ends] = [loc.extreme(l.start), loc.extreme(l.end)];
      return from === undefined || to === undefined || begins === undefined || ends === undefined
        ? []
        : [
            e.line(
              { at: from, price: begins },
              { at: to, price: ends },
              { colour: colour(begins, ends), width: width(l), dashed: settled(l) === "dashed" },
            ),
          ];
    });

// a 笔 or a 线段, in its style
export const lineOf = (s: LineStyle) =>
  lines<Line>(
    () => s.colour,
    () => s.width,
  );
export const zoushi = (s: ZoushiStyle) =>
  lines<Move>(
    (from, to) => (to > from ? s.up : to < from ? s.down : s.flat),
    // rounded to a thousandth, so 1.4 + 0.7 is exactly 2.1
    (l) => Math.round((s.width + s.step * l.level) * 1000) / 1000,
  );
