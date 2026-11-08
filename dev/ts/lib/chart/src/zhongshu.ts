// 中枢's drawing, for any engine (docs/designs/design-chart-lib-2026-10-24.md, The DSL): each 中枢 whose start is
// confirmed is two boxes from its start merged bar's K-line to its end merged bar's (locate.ts), in its level's
// colour (the layout's, drawing.ts). The outer box, DD to GG, is lightly filled, its border a step wider per level
// and dashed until its end is confirmed; the inner box, ZD to ZG, is filled darker, with no border.

import { type Engine, settled } from "./dsl.ts";
import type { Locator } from "./locate.ts";
import type { Centre, ZhongshuStyle } from "./schemas.ts";

export const zhongshu =
  <R>(e: Engine<R>) =>
  (scale: number, s: ZhongshuStyle, colourOf: (level: number) => string) =>
  (loc: Locator) =>
  (cs: readonly Centre[]): readonly R[] =>
    cs
      .filter((c) => settled(c) !== "none")
      .flatMap((c) => {
        const colour = colourOf(c.level);
        const from = loc.at(c.startBar);
        const to = loc.at(c.endBar);
        return from === undefined || to === undefined
          ? []
          : [
              ...(s.showOuter
                ? [
                    e.box(from, to, c.dd / scale, c.gg / scale, {
                      colour,
                      // rounded to a thousandth, so 0.7 + 0.7 × 2 is exactly 2.1
                      width: Math.round((s.width + s.step * c.level) * 1000) / 1000,
                      dashed: settled(c) === "dashed",
                      fill: { colour, opacity: s.fill },
                    }),
                  ]
                : []),
              ...(s.showInner
                ? [
                    e.box(from, to, c.zd / scale, c.zg / scale, {
                      colour,
                      dashed: false,
                      border: false,
                      fill: { colour, opacity: s.inner },
                    }),
                  ]
                : []),
            ];
      });
