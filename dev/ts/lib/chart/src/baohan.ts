// 包含's drawing, for any engine (docs/designs/design-chart-chanlun-3-2026-11-09.md, Reading the records), in three
// steps:
//   1. which merged bars: those of two K-lines or more (a merged bar of one K-line is just that K-line);
//   2. where, in K-lines: its K-lines `start` to `end`, its low and high, and the K-lines of its extreme (`extremes`,
//      as the contract gives them);
//   3. the primitives: a box over its K-lines from its low to its high, in its direction's colour, lightly filled,
//      dashed until its end is confirmed; and a mark at each K-line of its extreme, above when it goes up, below when
//      it goes down.
// Its prices are the contract's decimals, drawn as they are.

import { type Engine, settled } from "./dsl.ts";
import type { BaohanStyle, MergedBar } from "./schemas.ts";

export const baohan =
  <R>(e: Engine<R>) =>
  (s: BaohanStyle) =>
  (bars: readonly MergedBar[]): readonly R[] =>
    bars
      .filter((m) => m.start < m.end)
      .flatMap((m) => {
        const colour = m.up ? s.up : s.down;
        return [
          ...(s.showBox
            ? [
                e.box(m.start, m.end, m.low, m.high, {
                  colour,
                  width: s.width,
                  dashed: settled(m) === "dashed",
                  fill: { colour, opacity: s.fill },
                }),
              ]
            : []),
          ...(s.showMarks
            ? m.extremes.map((p) =>
                e.mark(p, m.up ? "above" : "below", "arrow", { colour, dashed: false, size: s.mark }),
              )
            : []),
        ];
      });
