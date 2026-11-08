// 成交量分布's data (docs/designs/design-chart-lib-2026-10-24.md, Components): a price distribution over the
// K-lines of each 笔, each level's 线段 (at level L above 0, the 走势 of level L − 1) and each level's 中枢, from its
// start merged bar's K-line to its end merged bar's (the one map, locate.ts). Computed by @qi/indicator's profile,
// volumes rounded to whole shares. The rows are the parameter's (24 by default), but never more than the whole cents
// the item spans, so a short 笔 has fewer.

import { profile, rowsSchema } from "@qi/indicator";
import { locator } from "./locate.ts";
import type { Centre, MergedBar, Profile, ProfileParams, Profiles, Stroke, XAxis } from "./schemas.ts";

// the distribution over K-lines `from` to `to`; none if they are not on the x-axis
const over =
  (xs: XAxis, scale: number, most: number) =>
  (from: number | undefined, to: number | undefined): Profile | undefined => {
    if (from === undefined || to === undefined) return undefined;
    const bars = xs.slice(from, to + 1);
    const low = bars.reduce((m, k) => Math.min(m, k.low), Number.POSITIVE_INFINITY);
    const high = bars.reduce((m, k) => Math.max(m, k.high), Number.NEGATIVE_INFINITY);
    // the whole cents spanned: never more rows than that
    const cents = Math.floor(((high - low) * 100) / scale);
    const rows = rowsSchema.safeParse(Math.min(most, Math.max(1, cents)));
    const p = rows.success ? profile(rows.data)(bars) : undefined;
    return p === undefined
      ? undefined
      : {
          from,
          to,
          low: p.low,
          step: p.step,
          up: p.up.map(Math.round),
          down: p.down.map(Math.round),
          poc: p.poc,
          value: p.value,
        };
  };

// a kind and level's distributions, if it has any
const set = (
  kind: Profiles["kind"],
  level: number,
  items: readonly (Profile | undefined)[],
): readonly Profiles[] => {
  const kept = items.flatMap((p) => (p === undefined ? [] : [p]));
  return kept.length === 0 ? [] : [{ kind, level, items: kept }];
};

export const profilesOf =
  (p: ProfileParams) =>
  (c: {
    readonly scale: number;
    readonly xAxis: XAxis;
    readonly merged: readonly MergedBar[];
    readonly strokes: readonly Stroke[];
    readonly duan: readonly Stroke[];
    readonly zoushi: readonly Stroke[];
    readonly zhongshu: readonly Centre[];
  }): readonly Profiles[] => {
    const of = over(c.xAxis, c.scale, p.rows);
    const loc = locator(c.xAxis, c.merged);
    const line = (s: Stroke) => of(loc.at(s.startBar), loc.at(s.endBar));
    const top = Math.max(0, ...c.zhongshu.map((z) => z.level), ...c.zoushi.map((z) => z.level + 1));
    const levels = Array.from({ length: top + 1 }, (_, level) => level);
    return [
      ...set("bi", 0, c.strokes.map(line)),
      ...levels.flatMap((level) =>
        set("duan", level, (level === 0 ? c.duan : c.zoushi.filter((z) => z.level === level - 1)).map(line)),
      ),
      ...levels.flatMap((level) =>
        set(
          "zhongshu",
          level,
          c.zhongshu.filter((z) => z.level === level).map((z) => of(loc.at(z.startBar), loc.at(z.endBar))),
        ),
      ),
    ];
  };
