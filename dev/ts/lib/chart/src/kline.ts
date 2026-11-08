// The K-lines' drawing, for any engine (docs/designs/design-chart-lib-2026-10-24.md, The DSL): a candle for each
// K-line, in the up colour if it closes at or above its open, else the down colour.

import type { Engine } from "./dsl.ts";
import type { KlineStyle, XAxis } from "./schemas.ts";

export const kline =
  <R>(e: Engine<R>) =>
  (scale: number, s: KlineStyle) =>
  (xs: XAxis): readonly R[] =>
    xs.map((k, i) =>
      e.candle(i, k.open / scale, k.high / scale, k.low / scale, k.close / scale, { up: s.up, down: s.down }),
    );
