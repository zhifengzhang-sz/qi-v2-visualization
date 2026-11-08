// 成交量分布's data (docs/designs/design-chart-chanlun-3-2026-11-09.md, Reading the records): a price distribution over
// the K-lines of each 笔, each level's 线段, 走势 and 中枢, from the K-line that represents its start merged bar to the
// one that represents its end merged bar (the one map, locate.ts). Computed by @qi/indicator's profile, volumes rounded
// to whole shares. The rows are the parameter's (24 by default), but never more than the whole cents the item spans,
// so a short 笔 has fewer.

import { profile, rowsSchema } from "@qi/indicator";
import { locator } from "./locate.ts";
import type { Profile, ProfileParams, Profiles, Run, XAxis } from "./schemas.ts";

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
  (c: { readonly scale: number; readonly xAxis: XAxis; readonly run: Run }): readonly Profiles[] => {
    const of = over(c.xAxis, c.scale, p.rows);
    const loc = locator(c.run.merged);
    const span = (r: { readonly start: number; readonly end: number }) => of(loc.at(r.start), loc.at(r.end));
    const top = Math.max(c.run.segments.length, c.run.moves.length, c.run.consolidations.length, 1) - 1;
    const levels = Array.from({ length: top + 1 }, (_, level) => level);
    const levelOf = <T>(part: readonly (readonly T[])[], level: number): readonly T[] => part[level] ?? [];
    return [
      ...set("bi", 0, c.run.strokes.map(span)),
      ...levels.flatMap((level) => set("duan", level, levelOf(c.run.segments, level).map(span))),
      ...levels.flatMap((level) => set("zoushi", level, levelOf(c.run.moves, level).map(span))),
      ...levels.flatMap((level) => set("zhongshu", level, levelOf(c.run.consolidations, level).map(span))),
    ];
  };
