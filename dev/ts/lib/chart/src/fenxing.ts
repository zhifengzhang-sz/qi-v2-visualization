// 分型's drawing, for any engine (docs/designs/design-chart-chanlun-3-2026-11-09.md, Reading the records): a 分型 at
// merged bar m is a top where m goes up and m + 1 goes down, a bottom where m goes down and m + 1 goes up; a circle at
// the K-line that represents m (its `index`, locate.ts), above a top and below a bottom, in one colour (the contract's
// 分型 holds no confirmation). One the merged bars make neither (no m + 1, or one of m's direction) has no kind, and no
// mark.

import type { Engine } from "./dsl.ts";
import type { Locator } from "./locate.ts";
import type { FenxingStyle, Fractal } from "./schemas.ts";

export const fenxing =
  <R>(e: Engine<R>) =>
  (s: FenxingStyle) =>
  (loc: Locator) =>
  (fractals: readonly Fractal[]): readonly R[] =>
    fractals.flatMap((f) => {
      const [here, after, at] = [loc.up(f.mIndex), loc.up(f.mIndex + 1), loc.at(f.mIndex)];
      const top = here === true && after === false;
      const bottom = here === false && after === true;
      return at === undefined || !(top || bottom)
        ? []
        : [e.mark(at, top ? "above" : "below", "circle", { colour: s.colour, dashed: false, size: s.size })];
    });
