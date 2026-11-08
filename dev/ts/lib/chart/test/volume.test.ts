// 成交量's drawing (volume.ts) through an engine of text, and through each engine: each K-line's volume a bar, faint,
// in its candle's colour, in the main graph's bottom quarter on a scale of its own with no axis, in the legend as 量,
// the K-lines over the whole height; for tv a Histogram first among the series, on a price scale of its own with the
// band as its margins, the main graph's price scale with the drawing's, its entry in qi-layers/1's legend; for d3fc
// the series with its band, opacity and legend, the margins beside.

import { result } from "@qi/base";
import { describe, expect, it } from "vitest";
import { type Chart, type D3fc, d3fcChart, type Engine, type Layers, tvChart } from "../src/index.ts";
import { type Bar, volumeDefaults } from "../src/schemas.ts";
import { volume } from "../src/volume.ts";
import { klines, run } from "./records.ts";

const words: Engine<string> = {
  candle: (at) => `candle ${at}`,
  box: (from, to) => `box ${from}-${to}`,
  mark: (at) => `mark ${at}`,
  line: (from, to) => `line ${from.at} ${to.at}`,
  series: (values, form, place, s, legend) =>
    `${form} pane ${place.pane} band ${place.band?.top}..${place.band?.bottom} ${s.colour} ${s.opacity} ${legend?.name} ${legend?.format}: ${values
      .map((v) => `${v.at}=${v.value} ${v.colour}`)
      .join(", ")}`,
  profile: (from, to) => `profile ${from}-${to}`,
};

// three K-lines a minute apart: up, down, flat (closing at its open), with volumes 5, 7, 0; as bars inside, and as
// market's K-lines at the scale 10
const rows = [
  [10, 20, 5],
  [20, 10, 7],
  [15, 15, 0],
].map(([open = 0, close = 0, volume = 0]) => ({
  open,
  high: Math.max(open, close),
  low: Math.min(open, close),
  close,
  volume,
}));
const xs: readonly Bar[] = rows.map((r, i) => ({ date: 60 * (i + 1), ...r }));
const ks = klines(rows, 10);

const components = {
  title: "t",
  scale: 10,
  xAxis: ks,
  run: run(),
  addons: [],
};

describe("成交量's drawing", () => {
  it("draws each K-line's volume a bar in its candle's colour, faint, in the main graph's bottom quarter", () => {
    expect(volume(words)(volumeDefaults)(xs)).toEqual([
      "bars pane 0 band 0.75..0 cl-muted 0.4 量 volume: 0=5 cl-up, 1=7 cl-down, 2=0 cl-up",
    ]);
  });

  it("is a Histogram for tv, first, on a price scale of its own with the band as its margins, in the legend", () => {
    const o = result.match(
      (v: {
        readonly chart: Chart;
        readonly layers: Layers;
      }): { readonly chart: Chart; readonly layers: Layers } | string => v,
      (e: { readonly message: string }) => e.message,
    )(tvChart(components));
    const ch = typeof o === "string" ? undefined : o.chart;
    expect(typeof o === "string" ? o : o.layers.legend).toEqual([
      { series: "volume", name: "量", format: "volume" },
    ]);
    expect(ch?.series.map((s) => s.id)).toEqual(["volume", "candles"]);
    expect(ch?.series.find((s) => s.id === "volume")).toEqual({
      type: "Histogram",
      id: "volume",
      paneIndex: 0,
      options: {
        color: "cl-muted/40",
        lastValueVisible: false,
        priceLineVisible: false,
        priceScaleId: "volume",
        priceFormat: { type: "volume" },
      },
      data: [
        { time: 60, value: 5, color: "cl-up/40" },
        { time: 120, value: 7, color: "cl-down/40" },
        { time: 180, value: 0, color: "cl-up/40" },
      ],
    });
    expect(ch?.panes).toEqual([
      {
        priceScales: {
          right: { scaleMargins: { top: 0.05, bottom: 0.05 } },
          volume: { scaleMargins: { top: 0.75, bottom: 0 } },
        },
      },
    ]);
  });

  it("is a series for d3fc, with its band, opacity and legend, the main graph's margins beside", () => {
    const o = result.match(
      (d: D3fc): D3fc | string => d,
      (e: { readonly message: string }) => e.message,
    )(d3fcChart(components));
    const d = typeof o === "string" ? undefined : o;
    expect(d?.prices).toEqual({ top: 0.05, bottom: 0.05 });
    expect(d?.apart.map((l) => [l.name, l.on, l.series])).toEqual([
      ["K线", true, []],
      [
        "成交量",
        true,
        [
          {
            form: "bars",
            pane: 0,
            band: { top: 0.75, bottom: 0 },
            points: [
              { x: 0, value: 5, colour: "cl-up" },
              { x: 1, value: 7, colour: "cl-down" },
              { x: 2, value: 0, colour: "cl-up" },
            ],
            colour: "cl-muted",
            opacity: 0.4,
            legend: { name: "量", format: "volume" },
          },
        ],
      ],
    ]);
  });
});
