// Each engine's change at an online step (docs/designs/design-chart-online-2026-11-08.md, The online component): the
// part of its page data the step changed, cut from the batch's page data of the chart after the step (tvChart,
// d3fcChart), so a chart's page data with every tail applied (applied.ts) is the batch's of its K-lines. K线's and
// 成交量's items from the position the step changed; each add-on's whole, since it is made again from every K-line.

import { pipe, type Result, result } from "@qi/base";
import type { DecodeError } from "@qi/core";
import { type D3fcTail, type D3Layer, itemsOf, type TvTail } from "./applied.ts";
import { d3fcChart } from "./d3fc.ts";
import type { LocateError } from "./locate.ts";
import type { Step } from "./online.ts";
import { tvChart } from "./tv.ts";

// The batch draws K线 and 成交量 first among the layers apart, then the add-ons (drawing.ts): the first two are a
// K-line's own, the rest made again whole.
const own = 2;

export const tvTail = (step: Step): Result<TvTail, DecodeError | LocateError> =>
  pipe(
    tvChart(step.online.components, "all"),
    result.map(({ chart, layers }): TvTail => {
      const kline = new Set(layers.apart.slice(0, own).flatMap((l) => l.series));
      const candles = chart.series.find((s) => s.type === "Candlestick");
      const t = candles === undefined ? undefined : itemsOf(candles)[step.from]?.time;
      return {
        contract: "qi-chart-tail/1",
        from: step.from,
        series: chart.series.map((s) =>
          kline.has(s.id) && t !== undefined
            ? { id: s.id, from: t, data: itemsOf(s).filter((d) => d.time >= t) }
            : { id: s.id, from: null, data: itemsOf(s) },
        ),
      };
    }),
  );

const fromOn = (l: D3Layer, p: number): D3Layer => ({
  ...l,
  candles: l.candles.filter((c) => c.x >= p),
  series: l.series.map((s) => ({ ...s, points: s.points.filter((q) => q.x >= p) })),
});

export const d3fcTail = (step: Step): Result<D3fcTail, DecodeError | LocateError> =>
  pipe(
    d3fcChart(step.online.components, "all"),
    result.map(
      (chart): D3fcTail => ({
        contract: "qi-d3fc-tail/1",
        from: step.from,
        times: chart.times.slice(step.from),
        apart: chart.apart.map((l, i) =>
          i < own ? { from: step.from, layer: fromOn(l, step.from) } : { from: null, layer: l },
        ),
      }),
    ),
  );
