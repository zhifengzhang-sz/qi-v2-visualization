// The adapter from a page's marks, the file --marks gives, to @qi/chart's (marks.ts): each put on the K-lines by its
// time, its price at the file's scale; a point's text below it where it is its K-line's low; a time no K-line's a fault.

import { result } from "@qi/base";
import type { Marks, XAxis } from "@qi/chart";
import { describe, expect, it } from "vitest";
import { marksOf, picture } from "../src/index.ts";

// three minutes from 2007-05-23 09:31 (read as UTC, as a run's), at a scale of 100
const xs: XAxis = [0, 1, 2].map((i) => ({
  date: 1179912660 + 60 * i,
  open: 410000 + 100 * i,
  high: 410050 + 100 * i,
  low: 409990 + 100 * i,
  close: 410040 + 100 * i,
  volume: 10,
}));

const lean = {
  picture: "minutes",
  instrument: "SH000001",
  period: "1m",
  scale: 100,
  from: "2007-05-23 09:31:00",
  to: "2007-05-23 09:33:00",
  levels: [{ price: 410100, text: "4101" }],
  points: [
    { time: "2007-05-23 09:32:00", price: 410150, text: "a high" },
    { time: "2007-05-23 09:33:00", price: 410190, text: "a low" },
  ],
  spans: [
    { from: "2007-05-23 09:31:00", to: "2007-05-23 09:32:00", low: 410000, high: 410100, text: "sideways" },
  ],
  gaps: [{ from: "2007-05-23 09:32:00", low: 409000, high: 409050, text: "gap" }],
  moves: [
    {
      from: { time: "2007-05-23 09:31:00", price: 410050 },
      to: { time: "2007-05-23 09:33:00", price: 410250 },
      text: "up",
    },
  ],
};

const marks = (v: unknown): Marks | undefined =>
  result.match(
    (m: Marks): Marks | undefined => m,
    (): Marks | undefined => undefined,
  )(result.flatMap(marksOf(xs, 100))(picture(v)));

describe("a page's marks", () => {
  it("puts each on the K-lines by its time, its price at the file's scale", () => {
    const m = marks(lean);
    expect(m?.layers.map((l) => l.key)).toEqual([
      "level:0",
      "span:0",
      "gap:0",
      "point:0",
      "point:1",
      "move:0",
    ]);
    expect(m?.layers[0]?.marks[0]).toMatchObject({
      kind: "line",
      from: { at: 0, price: 4101 },
      to: { at: 2, price: 4101 },
      dashed: true,
    });
    expect(m?.layers[1]?.marks[0]).toMatchObject({ kind: "box", from: 0, to: 1, low: 4100, high: 4101 });
    expect(m?.layers[2]?.marks[0]).toMatchObject({ kind: "box", from: 1, to: 2, low: 4090, high: 4090.5 });
    expect(m?.layers[5]?.marks[0]).toMatchObject({
      kind: "line",
      from: { at: 0 },
      to: { at: 2, price: 4102.5 },
    });
    expect(m?.layers[3]?.name).toBe("a high");
  });

  it("writes a point's text above it, but below where it is its K-line's low", () => {
    const m = marks(lean);
    expect(m?.layers[3]?.marks[1]).toMatchObject({ kind: "text", text: "a high", anchor: "above" });
    expect(m?.layers[4]?.marks[1]).toMatchObject({ kind: "text", text: "a low", anchor: "below" });
  });

  it("refuses a time no K-line's, and a file not of its form", () => {
    expect(
      marks({ ...lean, points: [{ time: "2007-05-23 09:40:00", price: 1, text: "t" }] }),
    ).toBeUndefined();
    expect(marks({ ...lean, shade: [] })).toBeUndefined();
    expect(marks({ ...lean, from: "2007-05-23 9:31" })).toBeUndefined();
  });
});
