// The price distribution: the rows hold the whole volume, up and down apart (a property over random runs); a bar's
// volume by its overlap with each row; a bar at one price, and a run at one price; the point of control the fullest
// row; the value area grown by the fuller neighbour to 70%; no bars, none.

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { type Bar, profile, rowsSchema } from "../src/profile.ts";

const n = (k: number) => rowsSchema.parse(k);
const sum = (xs: readonly number[]) => xs.reduce((s, x) => s + x, 0);
const bar = (low: number, high: number, volume: number, up = true): Bar => ({
  open: up ? low : high,
  close: up ? high : low,
  low,
  high,
  volume,
});

describe("profile", () => {
  it("holds the whole volume, up and down apart", () => {
    const bars = fc
      .tuple(
        fc.integer({ min: 0, max: 1000 }),
        fc.integer({ min: 0, max: 50 }),
        fc.integer({ min: 0, max: 1e6 }),
        fc.boolean(),
      )
      .map(([low, h, volume, up]) => bar(low, low + h, volume, up));
    fc.assert(
      fc.property(
        fc.array(bars, { minLength: 1, maxLength: 60 }),
        fc.integer({ min: 1, max: 40 }),
        (bs, k) => {
          const p = profile(n(k))(bs);
          expect(p).toBeDefined();
          const ups = sum(bs.filter((b) => b.close >= b.open).map((b) => b.volume));
          const downs = sum(bs.filter((b) => b.close < b.open).map((b) => b.volume));
          expect(sum(p?.up ?? [])).toBeCloseTo(ups, 4);
          expect(sum(p?.down ?? [])).toBeCloseTo(downs, 4);
        },
      ),
    );
  });

  it("spreads a bar's volume by its overlap with each row", () => {
    // rows of 10 from 0: the bar from 5 to 25 is a quarter in the first, half in the second, a quarter in the third
    const p = profile(n(3))([bar(0, 30, 0), bar(5, 25, 400)]);
    expect(p?.low).toBe(0);
    expect(p?.step).toBe(10);
    expect(p?.up).toEqual([100, 200, 100]);
    expect(p?.down).toEqual([0, 0, 0]);
  });

  it("gives a bar at one price all to its row, the highest high to the last row; it is up", () => {
    // at one price, its close is its open: up
    const p = profile(n(2))([bar(0, 10, 0), bar(3, 3, 7), bar(10, 10, 5, false)]);
    expect(p?.up).toEqual([7, 5]);
    expect(p?.down).toEqual([0, 0]);
  });

  it("is one row where every bar is at one price", () => {
    const p = profile(n(24))([bar(4, 4, 3), bar(4, 4, 2, false)]);
    expect(p).toEqual({ low: 4, step: 0, up: [5], down: [0], poc: 0, value: { from: 0, to: 0 } });
  });

  it("finds the point of control and grows the value area by the fuller neighbour", () => {
    // rows of 1 from 0, volumes 30, 30, 80, 40, 20 (200 in all, 70% 140): from 80, the 40 above (120), then the 30
    // below, fuller than the 20 above (150)
    const p = profile(n(5))([0, 1, 2, 3, 4].map((r) => bar(r, r + 1, [30, 30, 80, 40, 20][r] ?? 0)));
    expect(p?.poc).toBe(2);
    expect(p?.value).toEqual({ from: 1, to: 3 });
    expect(
      profile(n(5))([0, 1, 2, 3, 4].map((r) => bar(r, r + 1, [10, 40, 100, 30, 20][r] ?? 0)))?.value,
    ).toEqual({
      from: 1,
      to: 2,
    });
  });

  it("breaks a tie by the row nearer the point of control, then the one above", () => {
    // volumes 20, 30, 100, 30, 20 (200, 70% 140): from 100 the 30 above and the 30 below are as near, the one above
    // first (130), then the 30 below, fuller than the 20 above (160)
    const p = profile(n(5))([0, 1, 2, 3, 4].map((r) => bar(r, r + 1, [20, 30, 100, 30, 20][r] ?? 0)));
    expect(p?.value).toEqual({ from: 1, to: 3 });
    // volumes 10, 30, 100, 40, 30 (210, 70% 147): 100, the 40 above (140), then the 30 above two rows off and the 30
    // below one row off: the one below, nearer (170)
    const q = profile(n(5))([0, 1, 2, 3, 4].map((r) => bar(r, r + 1, [10, 30, 100, 40, 30][r] ?? 0)));
    expect(q?.value).toEqual({ from: 1, to: 3 });
  });

  it("puts the highest high's volume wholly in the last row", () => {
    // a third of 0.1 to 0.3 is not exactly representable: the last row's top is the high itself
    const p = profile(n(3))([bar(0.1, 0.3, 300)]);
    expect((p?.up ?? []).reduce((s, x) => s + x, 0)).toBe(300);
  });

  it("is none for no bars", () => {
    expect(profile(n(24))([])).toBeUndefined();
  });
});
