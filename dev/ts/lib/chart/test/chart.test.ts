// The description's contract against its vectors; the builders (what they build goes through the contract, a pane
// for every paneIndex used).

import { type Contract, contract } from "@qi/core";
import { describe, expect, it } from "vitest";
import { boxes, candlestick, chart, histogram, line, segments } from "../src/build.ts";
import { chartSchema } from "../src/index.ts";

const t0 = 1180402260;
const bar = { time: t0, open: 4300.1, high: 4310.5, low: 4295, close: 4301.8 };
const bars = {
  type: "Candlestick",
  id: "bars",
  options: { upColor: "cl-up", downColor: "#14945A" },
  data: [bar],
  paneIndex: 0,
};
const volume = {
  type: "Histogram",
  id: "volume",
  options: { priceScaleId: "volume", priceFormat: { type: "volume" } },
  data: [{ time: t0, value: 600000, color: "rgba(214, 39, 40, 0.3)" }],
  paneIndex: 0,
};
const diff = {
  type: "Line",
  id: "diff",
  options: { color: "cl-ink", lineWidth: 1 },
  data: [{ time: t0, value: 3.08 }],
  paneIndex: 1,
  markers: [{ time: t0, position: "aboveBar", shape: "arrowDown", color: "cl-down", text: "A" }],
  priceLines: [{ price: 0, color: "cl-muted", lineStyle: 2 }],
};
const bi = {
  type: "Segments",
  id: "bi",
  options: { color: "cl-stroke", lineWidth: 0.7 },
  data: [
    { time: t0, value: 4295, endTime: t0 + 600, endValue: 4335.69 },
    { time: t0 + 600, value: 4335.69, endTime: t0 + 900, endValue: 4310, lineStyle: 2 },
  ],
  paneIndex: 0,
};
const zhongshu = {
  type: "Boxes",
  id: "zhongshu",
  options: { color: "cl-center", fillColor: "rgba(230, 159, 0, 0.08)" },
  data: [{ time: t0, endTime: t0 + 900, low: 4300, high: 4320 }],
  paneIndex: 0,
};
const { id: _, ...noId } = volume;
const doc = {
  contract: "qi-chart/1",
  panes: [{}, { stretchFactor: 0.3 }],
  series: [bars, volume, diff, bi, zhongshu],
};

const chartContract: Contract<typeof chartSchema> = {
  name: "qi-chart/1",
  schema: chartSchema,
  vectors: {
    accept: [
      doc,
      { ...doc, title: "上证指数, 1m", timeScale: { rightOffset: 5, barSpacing: 6 } },
      {
        ...doc,
        panes: [{ priceScales: { volume: { scaleMargins: { top: 0.75, bottom: 0 }, visible: false } } }, {}],
      },
      // every form of colour; a marker at a price, with its price
      {
        ...doc,
        series: [
          { ...bars, options: { upColor: "#f00", downColor: "#14945a80", wickUpColor: "rgb(255, 0, 0)" } },
          { ...volume, data: [{ time: t0, value: 1, color: "rgba(0,0,0,0.5)" }] },
          {
            ...diff,
            markers: [{ time: t0, position: "atPriceTop", shape: "circle", color: "cl-up", price: 3 }],
          },
        ],
      },
      // a segment of one bar (a 笔 begun and not yet grown), a box of one bar
      {
        ...doc,
        series: [
          { ...bi, data: [{ time: t0, value: 1, endTime: t0, endValue: 2 }] },
          { ...zhongshu, data: [{ time: t0, endTime: t0, low: 1, high: 1 }] },
        ],
      },
    ],
    reject: [
      { ...doc, contract: "qi-chart/2" },
      { ...doc, series: [] },
      { ...doc, panes: [] },
      { ...doc, panes: [{}] },
      { ...doc, series: [{ ...bars, type: "Bar" }] },
      { ...doc, series: [{ ...bars, options: { color: "blue" } }] },
      { ...doc, series: [{ ...bars, data: [{ ...bar, time: -1 }] }] },
      {
        ...doc,
        series: [{ ...diff, markers: [{ time: 1, position: "above", shape: "circle", color: "cl-up" }] }],
      },
      { ...doc, panes: [{ priceScales: { volume: { scaleMargins: { top: 1.5, bottom: 0 } } } }, {}] },
      { ...doc, extra: 1 },
      null,
      // a series without its id, two with one id
      { ...doc, series: [noId] },
      { ...doc, series: [bars, { ...volume, id: "bars" }] },
      // times out of order, a time twice
      { ...doc, series: [{ ...bars, data: [{ ...bar, time: t0 + 60 }, bar] }] },
      { ...doc, series: [{ ...bars, data: [bar, bar] }] },
      // a segment ending before it starts, a box upside down, a segment's options a box's
      { ...doc, series: [{ ...bi, data: [{ time: t0, value: 1, endTime: t0 - 60, endValue: 2 }] }] },
      { ...doc, series: [{ ...zhongshu, data: [{ time: t0, endTime: t0, low: 2, high: 1 }] }] },
      { ...doc, series: [{ ...bi, options: { fillColor: "cl-up" } }] },
      // colours that are none: a word, an empty rgb(), a byte too large, an alpha too large, four hex digits
      ...["blue", "rgb()", "rgb(999, 0, 0)", "rgba(1.2.3)", "rgba(0, 0, 0, 1.5)", "#ffff"].map((c) => ({
        ...doc,
        series: [{ ...diff, options: { color: c } }],
      })),
      // a line's width not Lightweight Charts' (whole pixels, 1 to 4); a 笔 may be thinner
      { ...doc, series: [{ ...diff, options: { lineWidth: 0.7 } }] },
      // a marker at a price without its price; markers or price lines on a drawn kind
      {
        ...doc,
        series: [
          { ...diff, markers: [{ time: t0, position: "atPriceTop", shape: "circle", color: "cl-up" }] },
        ],
      },
      { ...doc, series: [{ ...bi, markers: diff.markers }] },
      { ...doc, series: [{ ...zhongshu, priceLines: diff.priceLines }] },
    ],
  },
};

describe("the description's contract", () => {
  it("agrees with its vectors", () => {
    expect(contract.verify(chartContract).tag).toBe("success");
  });
});

describe("the builders", () => {
  it("build what the contract accepts, a pane for every paneIndex", () => {
    const c = chart({
      series: [
        candlestick("bars", [bar], { upColor: "cl-up" }),
        histogram("volume", [{ time: bar.time, value: 6e5 }], { priceScaleId: "volume" }),
        {
          ...line("diff", [{ time: bar.time, value: 3.08 }], {}, 1),
          markers: [{ time: bar.time, position: "belowBar", shape: "arrowUp", color: "cl-up" }],
          priceLines: [{ price: 0, color: "cl-muted" }],
        },
        segments("bi", [{ time: t0, value: 4295, endTime: t0 + 60, endValue: 4300 }], { lineStyle: 2 }),
        boxes("zhongshu", [{ time: t0, endTime: t0 + 60, low: 4295, high: 4300 }], {
          fillColor: "cl-center",
        }),
      ],
    });
    expect(c.tag === "success" && c.value.panes).toHaveLength(2);
  });
  it("keep the panes given", () => {
    const c = chart({ series: [candlestick("bars", [bar])], panes: [{ stretchFactor: 2 }] });
    expect(c.tag === "success" && c.value.panes).toEqual([{ stretchFactor: 2 }]);
  });
  it("refuse what the contract refuses: two series of one id, a pane not given, no series", () => {
    expect(chart({ series: [candlestick("a", [bar]), line("a", [])] }).tag).toBe("failure");
    expect(chart({ series: [line("a", [], {}, 1)], panes: [{}] }).tag).toBe("failure");
    expect(chart({ series: [] }).tag).toBe("failure");
  });
});
