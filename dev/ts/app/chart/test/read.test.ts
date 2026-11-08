// The adapter from a run to the components (read.ts): 缠论's records beside a run's bars (run.json) decoded by the
// contract's own decodeRun, every record kept as it is; a text or a record the contract does not take refused, the
// file named. A run of bars alone: its bars the x-axis, a run of no record.

import { result } from "@qi/base";
import { encodeRun, type Run } from "@qi/chanlun";
import { describe, expect, it } from "vitest";
import { barsAxis, barsFile, barsOf, noRun, parse, runOf } from "../src/index.ts";
import { calendar, epoch } from "../src/read.ts";

const show = result.match(
  (v: unknown) => v,
  (e: { readonly message: string }) => e.message,
);

// three merged bars over five bars, a 分型, a 笔, and at two levels a 线段, a 走势 and a 中枢
const run: Run = {
  merged: [
    { index: 0, mIndex: 0, up: true, high: 20, low: 10, start: 0, end: 0, confirmEnd: 1, extremes: [0] },
    { index: 1, mIndex: 1, up: true, high: 25, low: 15, start: 1, end: 2, confirmEnd: 3, extremes: [1, 2] },
    { index: 3, mIndex: 2, up: false, high: 16, low: 11, start: 3, end: 4, extremes: [3] },
  ],
  fractals: [{ mIndex: 1 }],
  strokes: [{ start: 1, end: 2 }],
  segments: [[{ start: 0, end: 2, confirmEnd: 2, level: 0 }], [{ start: 0, end: 2, level: 1 }]],
  moves: [[{ start: 0, end: 2, level: 0 }]],
  consolidations: [
    [{ level: 0, start: 0, end: 2, zg: 18, zd: 15, gg: 25, dd: 11 }],
    [{ level: 1, start: 0, end: 2, zg: 18, zd: 15, gg: 25, dd: 11 }],
  ],
};

const text = encodeRun(run);

describe("缠论's records beside a run's bars", () => {
  it("keeps every record as it is", () => {
    expect(show(runOf("run.json")(text))).toEqual(run);
  });

  it.each([
    ["a text that is not JSON", "{", /^run.json: not JSON/],
    ["a number that is not a whole number", text.replace('"mIndex":1', '"mIndex":1.5'), /^run.json: /],
    [
      "a field the contract does not hold",
      text.replace('"mIndex":0,', '"mIndex":0,"more":1,'),
      /^run.json: .*more/,
    ],
    [
      "a record that breaks its rule: a merged bar's low above its high",
      text.replace('"high":25,"index":1,"low":15', '"high":15,"index":1,"low":25'),
      /^run.json: merged.1: a merged bar's first K-line not after its last, its low at most its high/,
    ],
    [
      "a run that breaks its rule: a merged bar past its merged bars",
      text.replace('{"mIndex":1}', '{"mIndex":7}'),
      /^run.json: .*a merged bar past the run's merged bars/,
    ],
  ])("refuses %s, the file named", (_, t, message) => {
    expect(show(runOf("run.json")(t))).toMatch(message);
  });
});

describe("the dates of a run's bars", () => {
  it("are days of the calendar and times of a day: leap years by the Gregorian rule", () => {
    expect(["2024-02-29 09:30:00", "2000-02-29 00:00:00", "2025-12-31 23:59:59"].map(calendar)).toEqual([
      true,
      true,
      true,
    ]);
    expect(
      [
        "1900-02-29 09:30:00",
        "2025-02-29 09:30:00",
        "2025-04-31 09:30:00",
        "2025-13-01 09:30:00",
        "2025-01-01 24:00:00",
        "2025-01-01 09:60:00",
      ].map(calendar),
    ).toEqual([false, false, false, false, false, false]);
  });
});

describe("a run of bars alone", () => {
  it("reads in.csv's bars as the x-axis of plain bars", () => {
    const r = barsAxis(
      "1179912660,412543,413646,412543,413625,3778083\n1179912720,413625,413700,413500,413600,100\n",
    );
    expect(r.tag === "success" ? r.value.map((b) => [b.date, b.close]) : r.error.message).toEqual([
      [1179912660, 413625],
      [1179912720, 413600],
    ]);
  });
  it("refuses a bar whose close is above its high", () => {
    expect(barsAxis("1179912660,412543,413646,412543,413700,1\n").tag).toBe("failure");
  });
  it("refuses bars out of time order", () => {
    expect(barsAxis("1179912720,1,2,1,2,1\n1179912660,1,2,1,2,1\n").tag).toBe("failure");
  });
  it("keeps its bars as in.csv, read back with a run of no record", () => {
    const bars = parse(100)("time,open,high,low,close,volume\n2007-05-21 09:31,39.00,39.02,38.93,39.01,10\n");
    expect(bars.tag === "success" ? show(barsOf(barsFile(bars.value))) : bars.error.message).toEqual({
      xs: [
        { date: epoch("2007-05-21 09:31:00"), open: 3900, high: 3902, low: 3893, close: 3901, volume: 10 },
      ],
      run: noRun,
    });
  });
});
