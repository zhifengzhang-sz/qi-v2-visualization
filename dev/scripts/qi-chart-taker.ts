// @qi/chart as a taker uses it (make qi-chart-package; dev/ts/lib/chart/README.md): from the package's node_modules
// alone, six market K-lines through the x-axis's schema and, beside them, a run of 缠论's contract decoded by its own
// decodeRun (the records of its vector small.json), then each engine's description and the TikZ picture; then its two
// components: a chart of market K-lines drawn by the batch, then taken one K-line at a time by the online component,
// each step's tail applied to the page data, which are then the batch's of the K-lines; a line for each; the first
// that fails throws, its message the fault's.

import { result } from "@qi/base";
import { decodeRun } from "@qi/chanlun";
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

// six K-lines a minute apart, made to fit the run below: the high of K-line 1, 100.3; the low of 3, 99.5; the high
// of 5, 100.5
const xAxis = ok<ReturnType<typeof xAxisSchema.parse>>("the x-axis")(
  decode(xAxisSchema)(
    [
      [99.9, 100.1, 99.9, 100],
      [100, 100.3, 99.95, 100.2],
      [100.2, 100.28, 99.8, 99.9],
      [99.9, 100, 99.5, 99.7],
      [99.7, 100.2, 99.55, 100.1],
      [100.1, 100.5, 99.9, 100.4],
    ].map(([open, high, low, close], index) => ({
      index,
      date: 1767623400000 + 60000 * index,
      open,
      high,
      low,
      close,
      volume: 1,
    })),
  ),
);
// the contract's vector small.json: three merged bars, two 分型, a 笔, a 线段, a 走势, a 中枢 at two levels
const decoded = decodeRun(`{
"merged": [
{"confirmEnd":2,"end":1,"extremes":[1],"high":100.3,"index":1,"low":99.9,"mIndex":0,"start":0,"up":true},
{"confirmEnd":4,"end":3,"extremes":[3],"high":100.28,"index":3,"low":99.5,"mIndex":1,"start":2,"up":false},
{"end":5,"extremes":[5],"high":100.5,"index":5,"low":99.55,"mIndex":2,"start":4,"up":true}
],
"fractals": [
{"mIndex":0},
{"mIndex":1}
],
"strokes": [
{"confirmEnd":2,"end":1,"start":0}
],
"segments": [
[
{"confirmEnd":2,"end":1,"level":0,"start":0}
]
],
"moves": [
[
{"confirmEnd":2,"end":1,"level":0,"start":0}
]
],
"consolidations": [
[
{"confirmEnd":2,"dd":99.5,"end":2,"gg":100.5,"level":0,"start":0,"zd":99.9,"zg":100.28}
],
[
{"confirmEnd":2,"dd":99.5,"end":2,"gg":100.5,"level":1,"start":0,"zd":99.9,"zg":100.28}
]
]
}
`);
if (!decoded.ok) throw new Error(`qi-chart-taker: the run: ${decoded.error}`);
const none = { merged: [], fractals: [], strokes: [], segments: [], moves: [], consolidations: [] };
const c = { title: "taker", scale: 100, xAxis, run: decoded.run, addons: [] };

const tv = ok<{
  readonly chart: { readonly series: readonly unknown[] };
  readonly layers: { readonly levels: readonly unknown[] };
}>("tvChart")(tvChart(c));
console.log(`qi-chart-taker: tvChart, ${tv.chart.series.length} series, ${tv.layers.levels.length} levels`);
const d3 = ok<{ readonly times: readonly number[] }>("d3fcChart")(d3fcChart(c));
console.log(`qi-chart-taker: d3fcChart, ${d3.times.length} K-lines`);
const marks = ok<ReturnType<typeof marksSchema.parse>>("the marks")(
  decode(marksSchema)({
    contract: "qi-marks/1",
    layers: [{ key: "k", name: "k", marks: [{ kind: "dot", at: { at: 1, price: 100.3 }, colour: "cl-ink" }] }],
  }),
);
const tex = ok<string>("tikzChart")(
  tikzChart(
    c,
    { from: 0, to: 5, width: 10, height: 6, palette: { "cl-ink": ["#000000", "#ffffff"] }, theme: "light" },
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
const start = { ...c, xAxis: [kline(0), kline(1)], run: none };
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
