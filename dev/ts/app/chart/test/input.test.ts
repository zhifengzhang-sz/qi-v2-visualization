// A run's bars (input.ts): a price exactly at its scale, or refused; minutes and days read, a bar's low not above
// its open, close or high, the bars in order.

import { describe, expect, it } from "vitest";
import { atScale, parse } from "../src/input.ts";
import { epoch } from "../src/read.ts";

describe("atScale", () => {
  it.each([
    ["567.78", 100, 56778],
    ["567.7", 100, 56770],
    ["567", 100, 56700],
    ["567.360000", 1000000, 567360000],
    ["0.5", 10, 5],
    ["-1.25", 100, -125],
    ["567.780", 100, 56778],
  ])("%s at %i is %i", (s, scale, n) => {
    expect(atScale(scale)(s)).toEqual({ tag: "success", value: n });
  });
  it.each([
    ["567.785", 100],
    ["1.5", 1],
    ["5,6", 100],
    ["", 100],
  ])("refuses %s at %i", (s, scale) => {
    expect(atScale(scale)(s).tag).toBe("failure");
  });
});

describe("parse", () => {
  const head = "time,open,high,low,close,volume\n";
  it("reads minutes and days, exactly", () => {
    const r = parse(100)(
      `${head}2007-05-21 09:31,39.00,39.02,38.93,39.01,10\n2007-05-21 09:32:00,39.01,39.10,39.00,39.05,7\n`,
    );
    expect(r).toEqual({
      tag: "success",
      value: [
        {
          d: "2007-05-21 09:31:00",
          t: epoch("2007-05-21 09:31:00"),
          label: 200705210931,
          o: 3900,
          h: 3902,
          l: 3893,
          c: 3901,
          v: 10,
        },
        {
          d: "2007-05-21 09:32:00",
          t: epoch("2007-05-21 09:32:00"),
          label: 200705210932,
          o: 3901,
          h: 3910,
          l: 3900,
          c: 3905,
          v: 7,
        },
      ],
    });
    const days = parse(100)("time,open,high,low,close\n2007-05-21,1,2,1,2\n");
    expect(days.tag === "success" && days.value[0]?.label).toBe(20070521);
  });
  it.each([
    ["an inexact price", "time,open,high,low,close\n2007-05-21,1.001,2,1,2\n"],
    ["a low above the close", "time,open,high,low,close\n2007-05-21,1.5,2,1.6,1.7\n"],
    ["bars out of order", "time,open,high,low,close\n2007-05-22,1,2,1,2\n2007-05-21,1,2,1,2\n"],
    ["a malformed time", "time,open,high,low,close\n21/05/2007,1,2,1,2\n"],
    ["a day not of the calendar", "time,open,high,low,close\n2025-02-30,1,2,1,2\n"],
    ["a time not of a day", "time,open,high,low,close\n2025-02-03 24:00,1,2,1,2\n"],
    ["a malformed volume", "time,open,high,low,close,volume\n2007-05-21,1,2,1,2,lots\n"],
    ["a volume below 0", "time,open,high,low,close,volume\n2007-05-21,1,2,1,2,-5\n"],
    ["no bars", "time,open,high,low,close\n"],
  ])("refuses %s", (_, text) => {
    expect(parse(100)(text).tag).toBe("failure");
  });
});
