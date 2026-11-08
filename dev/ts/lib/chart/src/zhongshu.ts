// 中枢's drawing, for any engine (docs/designs/design-chart-chanlun-3-2026-11-09.md, Reading the records): each 中枢 is
// two boxes from the K-line that represents its start merged bar (its `index`, locate.ts) to the one that represents
// its end merged bar, in its level's colour (the layout's, drawing.ts). The outer box, DD to GG, is lightly filled, its
// border a step wider per level and dashed until its end is confirmed; the inner box, ZD to ZG, is filled darker, with
// no border. Its prices are the contract's decimals, drawn as they are.

import { type Engine, settled } from "./dsl.ts";
import type { Locator } from "./locate.ts";
import type { Consolidation, ZhongshuStyle } from "./schemas.ts";

export const zhongshu =
  <R>(e: Engine<R>) =>
  (s: ZhongshuStyle, colourOf: (level: number) => string) =>
  (loc: Locator) =>
  (cs: readonly Consolidation[]): readonly R[] =>
    cs.flatMap((c) => {
      const colour = colourOf(c.level);
      const [from, to] = [loc.at(c.start), loc.at(c.end)];
      return from === undefined || to === undefined
        ? []
        : [
            ...(s.showOuter
              ? [
                  e.box(from, to, c.dd, c.gg, {
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
                  e.box(from, to, c.zd, c.zg, {
                    colour,
                    dashed: false,
                    border: false,
                    fill: { colour, opacity: s.inner },
                  }),
                ]
              : []),
          ];
    });
