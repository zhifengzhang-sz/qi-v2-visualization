// The adapter from a run to the components (read.ts): a set's file decoded by the contract's own decodeRun, every record
// kept as it is, the 走势 and 中枢 of each level after the level before; a text or a record the contract does not take
// refused, the file named. A run of bars only: its bars the x-axis, no structure.

import { result } from "@qi/base";
import { encodeRun, type Run } from "@qi/chanlun";
import { describe, expect, it } from "vitest";
import { barsAxis, barsFile, barsOf, parse, runOf } from "../src/index.ts";
import { calendar, epoch } from "../src/read.ts";

const show = result.match(
  (v: unknown) => v,
  (e: { readonly message: string }) => e.message,
);

const line = (level: number) => ({
  level,
  isUp: false,
  startDate: 2,
  confirmStartDate: 4,
  endDate: 4,
  high: 25,
  low: 11,
  startRno: 0,
  endRno: 0,
  stored: 0 as const,
  startBar: 1,
  endBar: 2,
});

const centre = (level: number) => ({
  level,
  startRno: 0,
  startDate: 0,
  endRno: 0,
  endDate: 4,
  entrance: true,
  exit: false,
  zg: 18,
  zd: 15,
  gg: 25,
  ggRno: 0,
  ggDate: 2,
  dd: 11,
  ddRno: 0,
  ddDate: 4,
  d: 15,
  g: 18,
  buy: "()",
  tp0: "()",
  tp0Rno: "()",
  tp1: "()",
  tp1Rno: "()",
  tp2: "()",
  tp2Rno: "()",
  confirmStartDate: 2,
  stored: 1 as const,
  startBar: 0,
  endBar: 2,
  ggBar: 1,
  ddBar: 2,
});

// five K-lines a minute apart, three merged bars, and at two levels a 走势 and a 中枢
const run: Run = {
  klines: [0, 1, 2, 3, 4].map((i) => ({
    rno: i,
    date: 1743499860 + 60 * i,
    up: true,
    open: 10,
    high: 20,
    low: 10,
    close: 20,
    volume: 5 + i,
    confirmRno: 0,
    confirmDate: i,
    stored: 1 as const,
  })),
  merged: [
    {
      rno: 0,
      mno: 0,
      up: true,
      high: 20,
      low: 10,
      startDate: 0,
      confirmStartDate: 0,
      endDate: 0,
      confirmEndDate: 1,
      stored: 1,
    },
    {
      rno: 2,
      mno: 1,
      up: true,
      high: 25,
      low: 15,
      startDate: 1,
      confirmStartDate: 1,
      endDate: 2,
      confirmEndDate: 3,
      stored: 1,
    },
    {
      rno: 4,
      mno: 2,
      up: false,
      high: 16,
      low: 11,
      startDate: 3,
      confirmStartDate: 3,
      endDate: 4,
      stored: 0,
    },
  ],
  fractals: [
    {
      rno: 2,
      date: 2,
      mno: 1,
      ding: true,
      turningpoint: false,
      high: 25,
      low: 15,
      confirmStartDate: 3,
      stored: 0,
    },
  ],
  strokes: [line(-2)],
  segments: [line(-1)],
  trends: [[line(0)], [line(1)]],
  centres: [[centre(0)], [centre(1)]],
};

const text = encodeRun(run);

describe("a run of the results", () => {
  it("keeps every record, a level's 走势 and 中枢 after the level before", () => {
    expect(show(runOf("set.json")(text))).toEqual({
      xs: run.klines,
      ms: run.merged,
      fs: run.fractals,
      bs: run.strokes,
      ds: run.segments,
      zs: [line(0), line(1)],
      zh: [centre(0), centre(1)],
    });
  });

  it.each([
    ["a text that is not JSON", "{", /^set.json: not JSON/],
    [
      "a number that is not a whole number",
      text.replace('"volume":5', '"volume":5.5'),
      /^set.json: 5.5: a number is a whole number/,
    ],
    [
      "a field the contract does not hold",
      text.replace('"rno":0', '"rno":0,"more":1'),
      /^set.json: klines.0: .*more/,
    ],
    [
      "a record that breaks its rule: a merged bar's low above its high",
      text.replace('"high":25,"low":15', '"high":15,"low":25'),
      /^set.json: merged.1: a merged bar's first K-line not after its last, its low at most its high/,
    ],
    [
      "a run that breaks its rule: a position past its K-lines",
      text.replace('"endDate":4', '"endDate":9'),
      /^set.json: merged.2: a position past the run's K-lines/,
    ],
  ])("refuses %s, the file named", (_, t, message) => {
    expect(show(runOf("set.json")(t))).toMatch(message);
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

describe("a run of bars only", () => {
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
  it("keeps its bars as in.csv, read back with no structure", () => {
    const bars = parse(100)("time,open,high,low,close,volume\n2007-05-21 09:31,39.00,39.02,38.93,39.01,10\n");
    expect(bars.tag === "success" ? show(barsOf(barsFile(bars.value))) : bars.error.message).toEqual({
      xs: [
        { date: epoch("2007-05-21 09:31:00"), open: 3900, high: 3902, low: 3893, close: 3901, volume: 10 },
      ],
      ms: [],
      fs: [],
      bs: [],
      ds: [],
      zs: [],
      zh: [],
    });
  });
});
