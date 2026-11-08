// @qi/chart as a taker uses it (make qi-chart-package; dev/ts/lib/chart/README.md): from the package's node_modules
// alone, three K-lines and one merged bar through their schemas, then each engine's description and the TikZ picture;
// then its two components: a chart of market K-lines drawn by the batch, then taken one K-line at a time by the online
// component, each step's tail applied to the page data, which are then the batch's of the K-lines; a line for each;
// the first that fails throws, its message the fault's.

import { result } from "@qi/base";
import { mergedBarSchema } from "@qi/chanlun";
import {
  type Chart,
  complete,
  type D3fc,
  type D3fcTail,
  d3fcApplied,
  d3fcChart,
  d3fcTail,
  forming,
  marksSchema,
  type Online,
  online,
  type Step,
  tikzChart,
  type TvTail,
  tvApplied,
  tvChart,
  tvTail,
  xAxisSchema,
} from "@qi/chart";
import { decode } from "@qi/core";
import type { KLine } from "@qi/market";

const fail =
  (what: string) =>
  (e: { readonly message: string }): never => {
    throw new Error(`qi-chart-taker: ${what}: ${e.message}`);
  };
const ok = <T>(what: string) => result.match((v: T): T => v, fail(what));

const xAxis = ok<ReturnType<typeof xAxisSchema.parse>>("the x-axis")(
  decode(xAxisSchema)(
    [0, 1, 2].map((i) => ({
      rno: i,
      date: 1179912660 + 60 * i,
      up: true,
      open: 410000 + 100 * i,
      high: 410050 + 100 * i,
      low: 409990 + 100 * i,
      close: 410040 + 100 * i,
      volume: 10,
      confirmRno: 0,
      stored: 1,
    })),
  ),
);
const merged = [0, 1, 2].map((i) =>
  ok<ReturnType<typeof mergedBarSchema.parse>>("a merged bar")(
    decode(mergedBarSchema)({
      rno: i,
      mno: i,
      up: true,
      high: 410050 + 100 * i,
      low: 409990 + 100 * i,
      startDate: i,
      endDate: i,
      confirmStartDate: i,
      confirmEndDate: i,
      stored: 1,
    }),
  ),
);
const c = {
  title: "taker",
  scale: 100,
  xAxis,
  merged,
  fractals: [],
  strokes: [],
  duan: [],
  zoushi: [],
  zhongshu: [],
  addons: [],
};

const tv = ok<{ readonly chart: { readonly series: readonly unknown[] } }>("tvChart")(tvChart(c));
console.log(`qi-chart-taker: tvChart, ${tv.chart.series.length} series`);
const d3 = ok<{ readonly times: readonly number[] }>("d3fcChart")(d3fcChart(c));
console.log(`qi-chart-taker: d3fcChart, ${d3.times.length} K-lines`);
const marks = ok<ReturnType<typeof marksSchema.parse>>("the marks")(
  decode(marksSchema)({
    contract: "qi-marks/1",
    layers: [{ key: "k", name: "k", marks: [{ kind: "dot", at: { at: 1, price: 4101 }, colour: "cl-ink" }] }],
  }),
);
const tex = ok<string>("tikzChart")(
  tikzChart(
    c,
    { from: 0, to: 2, width: 10, height: 6, palette: { "cl-ink": ["#000000", "#ffffff"] }, theme: "light" },
    "all",
    marks.layers,
  ),
);
console.log(`qi-chart-taker: tikzChart, ${tex.split("\n").length} lines`);

const minute = 60_000;
const kline = (i: number): KLine => ({
  index: i,
  date: 1179912660000 + minute * i,
  open: 4100 + i,
  high: 4101 + i,
  low: 4099 + i,
  close: 4100.5 + i,
  volume: 10,
});
const start = { ...c, xAxis: [kline(0), kline(1)], merged: [] };
const page = ok<{ readonly chart: Chart }>("tvChart of market K-lines")(tvChart(start)).chart;
const o = ok<Online>("online")(online(start));
const s1 = ok<Step>("forming")(forming(o, { ...kline(2), close: 4101, asOf: kline(2).date + 30_000 }));
const s2 = ok<Step>("complete")(complete(s1.online, kline(2)));
const applied = [s1, s2].reduce((p, s) => tvApplied(p, ok<TvTail>("tvTail")(tvTail(s))), page);
const whole = ok<{ readonly chart: Chart }>("tvChart of the K-lines so far")(
  tvChart(s2.online.components),
).chart;
if (JSON.stringify(applied) !== JSON.stringify(whole))
  throw new Error(
    "qi-chart-taker: online: the steps' tails do not give the batch's page data of the K-lines",
  );
console.log(
  `qi-chart-taker: online, 2 steps, ${s2.online.components.xAxis.length} K-lines, the batch's page data`,
);
const d3Page = ok<D3fc>("d3fcChart of market K-lines")(d3fcChart(start));
const d3Applied = [s1, s2].reduce((p, s) => d3fcApplied(p, ok<D3fcTail>("d3fcTail")(d3fcTail(s))), d3Page);
const d3Whole = ok<D3fc>("d3fcChart of the K-lines so far")(d3fcChart(s2.online.components));
if (JSON.stringify(d3Applied) !== JSON.stringify(d3Whole))
  throw new Error("qi-chart-taker: online: d3fc's tails do not give the batch's page data of the K-lines");
console.log(`qi-chart-taker: online, d3fc, ${d3Whole.times.length} K-lines, the batch's page data`);
