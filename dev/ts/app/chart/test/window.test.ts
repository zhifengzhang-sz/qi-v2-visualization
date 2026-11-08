// A page's window (window.ts): the window's K-lines and the configurations wholly inside it, moved to its start, the
// closes before it after the run's history; the structure itself never changed.
import type { Centre, Fractal, MergedBar, Stroke } from "@qi/chanlun";
import type { XAxis } from "@qi/chart";
import { describe, expect, it } from "vitest";
import type { Structure } from "../src/read.ts";
import { span, windowed, windowOf } from "../src/window.ts";

const day = 86400;
const t0 = 1700000000 - (1700000000 % day);
const xs: XAxis = Array.from({ length: 10 }, (_, i) => ({
  date: t0 + i * day,
  open: 100 + i,
  high: 110 + i,
  low: 90 + i,
  close: 105 + i,
  volume: 1,
}));
const bar = (mno: number, from: number, to: number): MergedBar => ({
  rno: 0,
  mno,
  up: true,
  high: 110 + to,
  low: 90 + from,
  startDate: from,
  confirmStartDate: from,
  endDate: to,
  confirmEndDate: to + 1,
  stored: 1,
});
const line = (startBar: number, endBar: number, startDate: number, endDate: number): Stroke => ({
  level: -2,
  isUp: true,
  startDate,
  confirmStartDate: startDate,
  endDate,
  confirmEndDate: endDate + 1,
  high: 120,
  low: 90,
  startRno: 0,
  endRno: 0,
  stored: 1,
  startBar,
  endBar,
});
const s: Structure = {
  xs,
  ms: [bar(0, 0, 1), bar(1, 3, 4), bar(2, 6, 7), bar(3, 8, 9)],
  fs: [] as readonly Fractal[],
  bs: [line(0, 1, 0, 3), line(1, 2, 3, 6), line(2, 3, 6, 8)],
  ds: [],
  zs: [],
  zh: [] as readonly Centre[],
};

describe("a page's window", () => {
  it("reads a window of two days, or of the last years or months, and refuses another", () => {
    expect(windowOf("2026-01-01:2026-06-30").tag).toBe("success");
    expect(windowOf("2y").tag).toBe("success");
    expect(windowOf("6m").tag).toBe("success");
    expect(windowOf("2026").tag).toBe("failure");
    expect(windowOf("0y").tag).toBe("failure");
    expect(windowOf("2025-02-29:2025-03-01").tag).toBe("failure");
    expect(windowOf("2024-02-29:2025-13-01").tag).toBe("failure");
    expect(windowOf("2024-02-29:2024-03-01").tag).toBe("success");
  });
  it("finds the window's K-lines by their times", () => {
    const r = span(
      xs.map((k) => k.date),
      { last: 1, unit: "m" },
    );
    expect(r.tag === "success" ? r.value : r.error.message).toEqual([0, 9]);
  });
  it("gives the K-lines in the window and the configurations wholly inside it, moved to its start", () => {
    const w = windowed(3, 7)(s, [7, 8]);
    expect(w.structure.xs.map((k) => k.date)).toEqual(xs.slice(3, 8).map((k) => k.date));
    expect(w.structure.ms.map((m) => [m.mno, m.startDate, m.endDate, m.confirmEndDate])).toEqual([
      [1, 0, 1, 2],
      [2, 3, 4, 5],
    ]);
    // the 笔 from merged bar 1 to 2 is inside; those reaching merged bars 0 and 3 cross an edge
    expect(w.structure.bs.map((b) => [b.startBar, b.endBar, b.startDate, b.endDate])).toEqual([[1, 2, 0, 3]]);
  });
  it("gives the closes before the window after the run's own history", () => {
    expect(windowed(3, 7)(s, [7, 8]).history).toEqual([7, 8, 105, 106, 107]);
  });
});
