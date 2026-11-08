// 成交量's drawing, for any engine (docs/designs/design-chart-lib-2026-10-24.md, The DSL), as TradingView draws
// volume: a faint bar per K-line in its candle's colour, in a band at the bottom of the main graph behind the candles
// (the bottom quarter by default), on its own scale with no axis. The legend shows the volume at the pointer (量).

import type { Engine } from "./dsl.ts";
import type { VolumeStyle, XAxis } from "./schemas.ts";

export const volume =
  <R>(e: Engine<R>) =>
  (s: VolumeStyle) =>
  (xs: XAxis): readonly R[] => [
    e.series(
      xs.map((k, i) => ({ at: i, value: k.volume, colour: k.close >= k.open ? s.up : s.down })),
      "bars",
      { pane: 0, band: { top: 1 - s.height, bottom: 0 } },
      { colour: "cl-muted", dashed: false, opacity: s.opacity },
      { name: "量", format: "volume" },
    ),
  ];
