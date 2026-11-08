// 成交量分布's drawing, for any engine (docs/designs/design-chart-lib-2026-10-24.md, The DSL): the price
// distribution of each 笔, 线段, 走势 or 中枢, shown while the pointer is on its K-lines, its rows along the price axis in
// the candles' up and down colours, the value area stronger. One layer per kind and level; the page shows one,
// picked in a pull-down.

import type { Choice, DistributionStyle, Engine, Layer } from "./dsl.ts";
import type { Profile, Profiles } from "./schemas.ts";

// the pull-down's name
export const profileChoice = "成交量分布";

// a layer's name in the pull-down: 笔, or 线段, 走势 and 中枢 with their level
const names = { duan: "线段", zoushi: "走势", zhongshu: "中枢" } as const;
const nameOf = (p: Profiles): string => (p.kind === "bi" ? "笔" : `${names[p.kind]} ${p.level}`);

const drawn =
  <R>(e: Engine<R>) =>
  (scale: number, s: DistributionStyle) =>
  (p: Profile): R =>
    e.profile(
      p.from,
      p.to,
      { low: p.low / scale, step: p.step / scale, up: p.up, down: p.down, poc: p.poc, value: p.value },
      s,
    );

export const profiles =
  <R>(e: Engine<R>) =>
  (scale: number, s: DistributionStyle) =>
  (ps: readonly Profiles[]): Choice<R> => ({
    name: profileChoice,
    layers: ps.map(
      (p): Layer<R> => ({
        key: `profile:${p.kind}${p.level}`,
        name: nameOf(p),
        on: false,
        fine: false,
        parts: p.items.map(drawn(e)(scale, s)),
      }),
    ),
  });
