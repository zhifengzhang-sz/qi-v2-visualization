// 包含's drawing, for any engine (docs/designs/design-chart-lib-2026-10-24.md, The DSL), in three steps:
//   1. which merged bars: those of two K-lines or more (a merged bar of one K-line is just that K-line) whose start
//      is confirmed;
//   2. where, in K-lines: its K-lines startDate to endDate, its low and high, and the K-lines holding its extreme
//      (the one map, locate.ts);
//   3. the primitives: a box over its K-lines from its low to its high, in its direction's colour, lightly filled,
//      dashed until its end is confirmed; and a mark at each K-line holding its extreme, above when it goes up,
//      below when it goes down.

import { type Engine, settled } from "./dsl.ts";
import type { Locator } from "./locate.ts";
import type { BaohanStyle, MergedBar } from "./schemas.ts";

export const baohan =
  <R>(e: Engine<R>) =>
  (scale: number, s: BaohanStyle) =>
  (loc: Locator) =>
  (bars: readonly MergedBar[]): readonly R[] =>
    bars
      .filter((m) => m.startDate < m.endDate && settled(m) !== "none")
      .flatMap((m) => {
        const colour = m.up ? s.up : s.down;
        return [
          ...(s.showBox
            ? [
                e.box(m.startDate, m.endDate, m.low / scale, m.high / scale, {
                  colour,
                  width: s.width,
                  dashed: settled(m) === "dashed",
                  fill: { colour, opacity: s.fill },
                }),
              ]
            : []),
          ...(s.showMarks
            ? loc
                .all(m.mno)
                .map((p) =>
                  e.mark(p, m.up ? "above" : "below", "arrow", { colour, dashed: false, size: s.mark }),
                )
            : []),
        ];
      });
