// A page's window (window.ts), of a run of bars alone: the window's K-lines, the closes before it after the run's
// history.
import type { XAxis } from "@qi/chart";
import { describe, expect, it } from "vitest";
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
  it("gives the K-lines in the window", () => {
    expect(windowed(3, 7)(xs, [7, 8]).xs.map((k) => k.date)).toEqual(xs.slice(3, 8).map((k) => k.date));
  });
  it("gives the closes before the window after the run's own history", () => {
    expect(windowed(3, 7)(xs, [7, 8]).history).toEqual([7, 8, 105, 106, 107]);
  });
});
