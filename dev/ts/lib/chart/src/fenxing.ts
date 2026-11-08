// 分型's drawing, for any engine (docs/designs/design-chart-lib-2026-10-24.md, The DSL): each 分型 whose start is
// confirmed is a circle at each K-line holding its merged bar's extreme (locate.ts), above a top and below a
// bottom; in the confirmed colour once its end is confirmed, the other colour until then.

import { type Engine, settled } from "./dsl.ts";
import type { Locator } from "./locate.ts";
import type { FenxingStyle, Fractal } from "./schemas.ts";

export const fenxing =
  <R>(e: Engine<R>) =>
  (s: FenxingStyle) =>
  (loc: Locator) =>
  (fractals: readonly Fractal[]): readonly R[] =>
    fractals
      .filter((f) => settled(f) !== "none")
      .flatMap((f) =>
        loc.all(f.mno).map((p) =>
          e.mark(p, f.ding ? "above" : "below", "circle", {
            colour: settled(f) === "solid" ? s.confirmed : s.unconfirmed,
            dashed: false,
            size: s.size,
          }),
        ),
      );
