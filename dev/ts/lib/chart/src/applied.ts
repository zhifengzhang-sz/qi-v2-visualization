// Each engine's change at an online step, as its page data's tail, and the page data with a tail applied
// (docs/designs/design-chart-online-2026-11-08.md, The online component). A tail is cut from the batch's page data of
// the chart after the step (tails.ts); applied to the page data before it, it gives the batch's page data after it.
// Pure, and with nothing but types imported, so that each engine's script, which keeps its page data so (UPDATE),
// bundles nothing else of the library.

import type { D3fc } from "./d3fc.ts";
import type { Chart } from "./description.ts";

type TvSeries = Chart["series"][number];
// an item of a series: what every series' items have
export type TvItem = { readonly time: number };

// tv's tail: the position it changes, and each series' items from a time, or (from null) the series whole
export type TvTail = {
  readonly contract: "qi-chart-tail/1";
  readonly from: number;
  readonly series: readonly {
    readonly id: string;
    readonly from: number | null;
    readonly data: readonly TvItem[];
  }[];
};

export type D3Layer = D3fc["apart"][number];
// d3fc's tail: the times from a position, and each layer apart, its items from that position, or (from null) whole
export type D3fcTail = {
  readonly contract: "qi-d3fc-tail/1";
  readonly from: number;
  readonly times: readonly number[];
  readonly apart: readonly { readonly from: number | null; readonly layer: D3Layer }[];
};

export const itemsOf = (s: TvSeries): readonly TvItem[] => s.data as readonly TvItem[];

// tv's page data with a tail applied: each series' items before the tail's, then the tail's
export const tvApplied = (chart: Chart, tail: TvTail): Chart => ({
  ...chart,
  series: chart.series.map((s): TvSeries => {
    const t = tail.series.find((x) => x.id === s.id);
    if (t === undefined) return s;
    const from = t.from;
    // a series' items are of its own kind: the tail's, cut from the same series, are too
    return {
      ...s,
      data: from === null ? t.data : [...itemsOf(s).filter((d) => d.time < from), ...t.data],
    } as TvSeries;
  }),
});

// d3fc's page data with a tail applied: the times before its position, then the tail's; each layer apart, its items
// before the tail's position, then the tail's, or the tail's layer whole
export const d3fcApplied = (chart: D3fc, tail: D3fcTail): D3fc => ({
  ...chart,
  times: [...chart.times.slice(0, tail.from), ...tail.times],
  apart: chart.apart.map((l, i): D3Layer => {
    const t = tail.apart[i];
    if (t === undefined) return l;
    const from = t.from;
    return from === null
      ? t.layer
      : {
          ...l,
          candles: [...l.candles.filter((c) => c.x < from), ...t.layer.candles],
          series: l.series.map((s, j) => ({
            ...s,
            points: [...s.points.filter((q) => q.x < from), ...(t.layer.series[j]?.points ?? [])],
          })),
        };
  }),
});
