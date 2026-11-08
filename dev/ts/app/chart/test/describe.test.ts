// A page's input (describe.ts): read where it enters, refused whole where a part is not the contract's; the
// components made from it, the add-ons by its settings and from its closes before the run; the same components for an
// input carried through JSON, as the page carries it.

import { result } from "@qi/base";
import { tvChart } from "@qi/chart";
import { describe, expect, it } from "vitest";
import { comingFor, components, historyOf, klinesOf, type PageInput, pageInput } from "../src/describe.ts";

// six bars closing at 1.00 to 6.00, at a scale of 100, and a run of no record
const ks = [100, 200, 300, 400, 500, 600].map((c, i) => ({
  date: 60 * (i + 1),
  open: c,
  high: c,
  low: c,
  close: c,
  volume: 0,
}));
const none = { merged: [], fractals: [], strokes: [], segments: [], moves: [], consolidations: [] };
const raw = {
  title: "t",
  scale: 100,
  level: "all",
  settings: { averages: [{ params: { period: 2 } }], macd: { params: { fast: 2, slow: 3, signal: 2 } } },
  history: [50],
  xAxis: ks,
  run: none,
};

describe("a page's input", () => {
  it("is read by the contract's schemas, and refused where a part is not theirs", () => {
    expect(pageInput(raw).tag).toBe("success");
    expect(pageInput({ ...raw, scale: 0 }).tag).toBe("failure");
    expect(pageInput({ ...raw, xAxis: [] }).tag).toBe("failure");
    expect(pageInput({ ...raw, extra: 1 }).tag).toBe("failure");
    // a K-line whose close is above its high
    expect(pageInput({ ...raw, xAxis: [{ ...ks[0], close: 900 }] }).tag).toBe("failure");
    // a run the contract refuses: a 分型 at a merged bar the run does not have
    expect(pageInput({ ...raw, run: { ...none, fractals: [{ mIndex: 0 }] } }).tag).toBe("failure");
  });

  it("makes the components, the add-ons by its settings and from the closes before the run", () => {
    const names = result.map((i: Parameters<typeof components>[0]) =>
      result.map((c: { readonly addons: readonly { readonly name: string }[] }) =>
        c.addons.map((a) => a.name),
      )(components(i)),
    )(pageInput(raw));
    expect(names).toEqual(result.success(result.success(["MA2", "MACD 2 3 2"])));
    // a settings value out of range refused, as the settings file's is
    const bad = result.map((i: Parameters<typeof components>[0]) => components(i).tag)(
      pageInput({ ...raw, settings: { macd: { params: { fast: 3, slow: 2, signal: 2 } } } }),
    );
    expect(bad).toEqual(result.success("failure"));
  });

  it("gives the same description after a trip through JSON, as the page carries it", () => {
    const describe = (v: unknown) =>
      JSON.stringify(
        result.map((i: Parameters<typeof components>[0]) =>
          result.map((c: Parameters<typeof tvChart>[0]) => tvChart(c, i.level))(components(i)),
        )(pageInput(v)),
      );
    expect(describe(JSON.parse(JSON.stringify(raw)))).toBe(describe(raw));
  });
});

// a run of bars alone, as the run keeps them: dates in seconds, prices at a scale of 100, whole volumes
const bars = [
  [10000, 10055, 9990, 10050, 3],
  [10050, 10100, 10000, 10010, 0],
  [10010, 10020, 9800, 9805, 7],
].map(([open = 0, high = 0, low = 0, close = 0, volume = 0], i) => ({
  date: 60 * (i + 1),
  open,
  high,
  low,
  close,
  volume,
}));

describe("the K-lines the library takes (docs/designs/design-chart-online-2026-11-08.md)", () => {
  it("are a run's bars made market's: an index from 0, milliseconds, decimals", () => {
    expect(klinesOf(bars, 100)).toEqual([
      { index: 0, date: 60_000, open: 100, high: 100.55, low: 99.9, close: 100.5, volume: 3 },
      { index: 1, date: 120_000, open: 100.5, high: 101, low: 100, close: 100.1, volume: 0 },
      { index: 2, date: 180_000, open: 100.1, high: 100.2, low: 98, close: 98.05, volume: 7 },
    ]);
    expect(klinesOf([{ ...bars[0], open: -5, low: -5 } as never], 1000)[0]).toMatchObject({ open: -0.005 });
  });
});

describe("an online page (describe.ts)", () => {
  const online = { ...raw, xAxis: bars, history: [], online: 2 };
  const read = (v: unknown): PageInput =>
    result.match(
      (i: PageInput) => i,
      (e: { readonly message: string }): PageInput => {
        throw new Error(e.message);
      },
    )(pageInput(v));
  it("has for its history all but its last N K-lines, and a page not online is its history", () => {
    const i = read(online);
    expect(historyOf(i).xAxis).toEqual(bars.slice(0, 1));
    const whole = read({ ...online, online: undefined });
    expect(historyOf(whole)).toBe(whole);
  });
  it("gives each K-line to come as ongoing K-lines reaching its values, then the complete one", () => {
    const i = read(online);
    const coming = comingFor(i);
    expect(coming).toHaveLength(8);
    const k = { index: 1, date: 120_000, open: 100.5, high: 101, low: 100, close: 100.1, volume: 0 };
    expect(coming.slice(0, 4)).toEqual([
      { forming: { ...k, high: 100.5, low: 100.5, close: 100.5, volume: 0, asOf: 135_000 } },
      { forming: { ...k, high: 100.5, low: 100.1, volume: 0, asOf: 150_000 } },
      { forming: { ...k, asOf: 165_000 } },
      { complete: k },
    ]);
  });
});
