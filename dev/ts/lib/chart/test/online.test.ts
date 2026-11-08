// The online component (online.ts, tails.ts, applied.ts; docs/designs/design-chart-online-2026-11-08.md, How the
// release is checked, 1). Its law: for any chart of market K-lines and any sequence of complete and forming K-lines
// within the rules, the batch's page data of the chart it started from, with every step's tail applied, is the batch's
// page data of the chart it ends with, for tv and for d3fc, with add-ons on the main graph and in a subgraph. Each rule
// broken is refused with its fault, the chart as it was. The batch makes a market K-line's prices whole numbers at the
// scale exactly, and refuses a finer price or a date off a whole second.

import { type Result, result } from "@qi/base";
import type { KLine, OngoingKLine } from "@qi/market";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  type AddOn,
  addOn,
  type Components,
  complete,
  d3fcApplied,
  d3fcChart,
  d3fcTail,
  forming,
  located,
  type Online,
  online,
  type Step,
  tvApplied,
  tvChart,
  tvTail,
} from "../src/index.ts";
import { componentsOf } from "../src/locate.ts";
import { merged, run } from "./records.ts";

// a sum of the last three closes on the main graph, and the closes less the opens in a subgraph, as bars
const sum3: AddOn = addOn({
  key: "sum3",
  name: "SUM3",
  place: "main",
  on: true,
  params: {},
  style: {},
  derive: (xs) =>
    xs.map((_, i) => (i < 2 ? undefined : xs.slice(i - 2, i + 1).reduce((s, x) => s + x.close, 0))),
  draw: (e) => (data, pane) => [
    e.series(
      data.flatMap((v, at) => (v === undefined ? [] : [{ at, value: v / 100 }])),
      "line",
      { pane },
      { colour: "cl-ink", dashed: false },
      { name: "SUM3", format: "price" },
    ),
  ],
});
const body: AddOn = addOn({
  key: "body",
  name: "BODY",
  place: "sub",
  on: true,
  params: {},
  style: {},
  derive: (xs) => xs.map((k) => k.close - k.open),
  draw: (e) => (data, pane) => [
    e.series(
      data.map((value, at) => ({ at, value, colour: value >= 0 ? "cl-up" : "cl-down" })),
      "bars",
      { pane },
      { colour: "cl-muted", dashed: false },
      { name: "BODY", format: "price" },
    ),
  ],
});

// a price of cents as the market data's decimal
const price = (cents: number): number => Number((cents / 100).toFixed(2));
const kline = (index: number, date: number, o: number, c: number, wick: number, volume: number): KLine => ({
  index,
  date,
  open: price(o),
  high: price(Math.max(o, c) + wick),
  low: price(Math.min(o, c) - wick),
  close: price(c),
  volume,
});

const chartOf = (ks: readonly KLine[], addons: readonly AddOn[] = [sum3, body]): Components => ({
  title: "online",
  scale: 100,
  xAxis: ks,
  run: run(),
  addons,
});

const ok = <T>(r: Result<T, unknown>): T =>
  result.match(
    (v: T) => v,
    (e: unknown) => {
      throw new Error(`expected a success: ${JSON.stringify(e)}`);
    },
  )(r);
const code = (r: Result<unknown, { readonly code: string }>): string | undefined =>
  result.match(
    () => undefined,
    (e: { readonly code: string }) => e.code,
  )(r);

// A bar: its open, close and wick in cents, its volume
const bar = fc.record({
  o: fc.integer({ min: 10000, max: 20000 }),
  c: fc.integer({ min: 10000, max: 20000 }),
  wick: fc.integer({ min: 0, max: 50 }),
  volume: fc.integer({ min: 0, max: 1000 }),
});
// A history and what comes after it: each bar after the history as zero to three ongoing K-lines, then complete
const scenario = fc.record({
  first: fc.integer({ min: 0, max: 1000 }),
  history: fc.array(bar, { minLength: 1, maxLength: 12 }),
  after: fc.array(fc.record({ bar, ongoing: fc.array(bar, { maxLength: 3 }) }), { maxLength: 6 }),
});

type Scenario = typeof scenario extends fc.Arbitrary<infer T> ? T : never;
type Update = { readonly complete: KLine } | { readonly forming: OngoingKLine };
const minute = 60_000;
const updatesOf = (s: Scenario): readonly Update[] =>
  s.after.flatMap((a, j) => {
    const index = s.first + s.history.length + j;
    const date = (s.history.length + j) * minute;
    return [
      ...a.ongoing.map(
        (b, n): Update => ({
          forming: { ...kline(index, date, b.o, b.c, b.wick, b.volume), asOf: date + (n + 1) * 1000 },
        }),
      ),
      { complete: kline(index, date, a.bar.o, a.bar.c, a.bar.wick, a.bar.volume) },
    ];
  });
const historyOf = (s: Scenario): readonly KLine[] =>
  s.history.map((b, i) => kline(s.first + i, i * minute, b.o, b.c, b.wick, b.volume));
const stepped = (o: Online, u: Update): Result<Step, unknown> =>
  "complete" in u ? complete(o, u.complete) : forming(o, u.forming);

describe("the online component's law", () => {
  it("gives tv the batch's page data of the K-lines, a tail at a time", () => {
    fc.assert(
      fc.property(scenario, (s) => {
        const start = ok(online(chartOf(historyOf(s))));
        const end = updatesOf(s).reduce(
          (acc, u) => {
            const step = ok(stepped(acc.o, u));
            return { o: step.online, chart: tvApplied(acc.chart, ok(tvTail(step))) };
          },
          { o: start, chart: ok(tvChart(start.components)).chart },
        );
        expect(end.chart).toEqual(ok(tvChart(end.o.components)).chart);
        // the layers (qi-layers/1), which no tail changes, the same as the batch's of the K-lines ended with
        expect(ok(tvChart(start.components)).layers).toEqual(ok(tvChart(end.o.components)).layers);
      }),
      { numRuns: 60 },
    );
  });
  it("gives d3fc the batch's page data of the K-lines, a tail at a time", () => {
    fc.assert(
      fc.property(scenario, (s) => {
        const start = ok(online(chartOf(historyOf(s))));
        const end = updatesOf(s).reduce(
          (acc, u) => {
            const step = ok(stepped(acc.o, u));
            return { o: step.online, chart: d3fcApplied(acc.chart, ok(d3fcTail(step))) };
          },
          { o: start, chart: ok(d3fcChart(start.components)) },
        );
        expect(end.chart).toEqual(ok(d3fcChart(end.o.components)));
      }),
      { numRuns: 60 },
    );
  });
  it("changes one position a step: the forming one's when it is replaced, the new one's when appended", () => {
    const o = ok(online(chartOf([kline(5, 0, 10000, 10100, 10, 1)])));
    const f1 = ok(forming(o, { ...kline(6, minute, 10100, 10200, 0, 1), asOf: minute + 1000 }));
    const f2 = ok(forming(f1.online, { ...kline(6, minute, 10100, 10300, 0, 2), asOf: minute + 2000 }));
    const c = ok(complete(f2.online, kline(6, minute, 10100, 10250, 5, 3)));
    const n = ok(complete(c.online, kline(7, 2 * minute, 10250, 10200, 5, 3)));
    expect([f1.from, f2.from, c.from, n.from]).toEqual([1, 1, 1, 2]);
    expect([f1.online.forming?.asOf, f2.online.forming?.asOf, c.online.forming, n.online.forming]).toEqual([
      minute + 1000,
      minute + 2000,
      undefined,
      undefined,
    ]);
    expect(n.online.components.xAxis).toHaveLength(3);
  });
});

describe("the online component's rules", () => {
  const o = ok(online(chartOf([kline(0, 0, 10000, 10100, 10, 1), kline(1, minute, 10100, 10000, 10, 1)])));
  const next = (date: number): KLine => kline(2, date, 10000, 10050, 0, 1);
  const f = ok(forming(o, { ...next(2 * minute), asOf: 2 * minute + 5000 })).online;
  it("refuses a K-line not at the next index", () => {
    expect(code(complete(o, kline(3, 2 * minute, 10000, 10000, 0, 0)))).toBe("ONLINE_INDEX");
    expect(code(complete(o, kline(1, minute, 10000, 10000, 0, 0)))).toBe("ONLINE_INDEX");
    expect(code(forming(f, { ...kline(3, 3 * minute, 10000, 10000, 0, 0), asOf: 3 * minute }))).toBe(
      "ONLINE_INDEX",
    );
  });
  it("refuses a date not after the last, or not the forming one's", () => {
    expect(code(complete(o, next(minute)))).toBe("ONLINE_DATE");
    expect(code(forming(o, { ...next(minute), asOf: minute }))).toBe("ONLINE_DATE");
    expect(code(complete(f, next(3 * minute)))).toBe("ONLINE_FORMING_DATE");
    expect(code(forming(f, { ...next(3 * minute), asOf: 3 * minute }))).toBe("ONLINE_FORMING_DATE");
  });
  it("refuses an ongoing K-line whose asOf is before the forming one's", () => {
    expect(code(forming(f, { ...next(2 * minute), asOf: 2 * minute + 4000 }))).toBe("ONLINE_AS_OF");
  });
  it("refuses a price finer than the scale, and a date off a whole second, the chart as it was", () => {
    expect(code(complete(o, { ...next(2 * minute), close: 100.555 }))).toBe("ONLINE_KLINE");
    expect(code(complete(o, next(2 * minute + 500)))).toBe("ONLINE_KLINE");
    expect(code(complete(o, { ...next(2 * minute), low: 1e-7 }))).toBe("ONLINE_KLINE");
    expect(code(complete(o, { ...next(2 * minute), high: 2 ** 53 }))).toBe("ONLINE_KLINE");
    expect(o.components.xAxis).toHaveLength(2);
  });
  it("refuses a chart of no K-line or with 缠论 data, and an add-on drawing more than series", () => {
    expect(code(online(chartOf([])))).toBe("ONLINE_START");
    expect(code(online(chartOf([kline(0, 0, 100, 100, 0, 0), kline(2, minute, 100, 100, 0, 0)])))).toBe(
      "ONLINE_KLINE",
    );
    expect(code(online({ ...chartOf([kline(0, 0, 100, 100, 0, 0)]), scale: 50 }))).toBe("ONLINE_KLINE");
    expect(
      code(
        online({
          ...chartOf([kline(0, 0, 100, 100, 0, 0)]),
          run: run({ merged: [merged({ high: 100, low: 100 })] }),
        }),
      ),
    ).toBe("ONLINE_START");
    // a mark only once there are three K-lines: refused at the update that draws it
    const marking = addOn({
      key: "m",
      name: "M",
      place: "main",
      on: true,
      params: {},
      style: {},
      derive: (xs) => xs.length,
      draw: (e) => (n) => (n < 3 ? [] : [e.mark(0, "above", "circle", { colour: "cl-ink", dashed: false })]),
    });
    const two = ok(
      online(chartOf([kline(0, 0, 100, 100, 0, 0), kline(1, minute, 100, 100, 0, 0)], [marking])),
    );
    expect(code(complete(two, kline(2, 2 * minute, 100, 100, 0, 0)))).toBe("ONLINE_ADDON");
    const three = [0, 1, 2].map((i) => kline(i, i * minute, 100, 100, 0, 0));
    expect(code(online(chartOf(three, [marking])))).toBe("ONLINE_ADDON");
  });
});

describe("the batch's market K-lines", () => {
  it("are their prices read exactly at every scale: a whole number of the scale's units, its digits", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 6 }),
        fc.integer({ min: -(10 ** 15 - 1), max: 10 ** 15 - 1 }),
        (digits, units) => {
          const text = String(Math.abs(units)).padStart(digits + 1, "0");
          const whole = text.slice(0, text.length - digits);
          const fraction = text.slice(text.length - digits);
          const p = Number(`${units < 0 ? "-" : ""}${whole}${digits > 0 ? `.${fraction}` : ""}`);
          const k = { index: 0, date: 60_000, open: p, high: p, low: p, close: p, volume: 0 };
          const bars = componentsOf(ok(located({ ...chartOf([k], []), scale: 10 ** digits }))).xAxis;
          expect(bars[0]?.open).toBe(units);
        },
      ),
      { numRuns: 300 },
    );
  });
  it("are whole numbers at the scale, exactly, and a finer price or a date off a second is refused", () => {
    const k = kline(0, 60_000, 10055, 10056, 1, 2);
    const chart = ok(d3fcChart(chartOf([k], [])));
    const candle = chart.apart[0]?.candles[0];
    expect([candle?.open, candle?.close, chart.times]).toEqual([100.55, 100.56, [60]]);
    expect(code(d3fcChart(chartOf([{ ...k, open: 100.555 }], [])))).toBe("CHART_LOCATE");
    expect(code(d3fcChart(chartOf([{ ...k, date: 60_001 }], [])))).toBe("CHART_LOCATE");
    expect(code(d3fcChart({ ...chartOf([k], []), scale: 3 }))).toBe("CHART_LOCATE");
    expect(code(d3fcChart(chartOf([k, { ...kline(2, 120_000, 10055, 10056, 1, 2) }], [])))).toBe(
      "CHART_LOCATE",
    );
  });
});
