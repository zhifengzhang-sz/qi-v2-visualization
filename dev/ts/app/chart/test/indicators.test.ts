// The app's add-ons (indicators.ts), by the settings: chart.toml's MA5, MA10, MA30 on the main graph and MACD(12,26,9)
// in a subgraph, or others; an MA with no value until it has its closes, the closes before the run counted first; the
// values at the run's scale divided.

import { pipe, result } from "@qi/base";
import type { Engine, Value, XAxis } from "@qi/chart";
import { xAxisSchema } from "@qi/chart";
import { decode } from "@qi/core";
import { describe, expect, it } from "vitest";
import { indicators } from "../src/indicators.ts";
import { type Resolved, resolved, settingsSchema } from "../src/settings.ts";

// settings by their schema, over the defaults: chart.toml's averages and MACD, or others
const settingsOf = (
  averages: readonly (readonly [number, string])[],
  fast: number,
  slow: number,
  signal: number,
) =>
  pipe(
    decode(settingsSchema)({
      averages: averages.map(([period, colour]) => ({ params: { period }, style: { colour } })),
      macd: { params: { fast, slow, signal } },
    }),
    result.mapError((e) => e.message),
    result.flatMap((s) => result.mapError((e: { readonly message: string }) => e.message)(resolved(s))),
  );
const defaults = settingsOf(
  [
    [5, "cl-ink"],
    [10, "cl-center"],
    [30, "cl-gap"],
  ],
  12,
  26,
  9,
);

// an engine that gives each series its legend's name, its pane and its values
type Drawn = { readonly name: string; readonly pane: number; readonly values: readonly Value[] };
const seen: Engine<Drawn> = {
  candle: () => ({ name: "", pane: -1, values: [] }),
  box: () => ({ name: "", pane: -1, values: [] }),
  mark: () => ({ name: "", pane: -1, values: [] }),
  line: () => ({ name: "", pane: -1, values: [] }),
  series: (values, _, place, __, legend) => ({ name: legend?.name ?? "", pane: place.pane, values }),
  profile: () => ({ name: "", pane: -1, values: [] }),
};

// six K-lines closing at 1.00 to 6.00, at a scale of 100
const xs: XAxis = result.getOrElse((): XAxis => [])(
  decode(xAxisSchema)(
    [100, 200, 300, 400, 500, 600].map((c, i) => ({
      rno: i,
      date: 60 * (i + 1),
      up: true,
      open: c,
      high: c,
      low: c,
      close: c,
      volume: 0,
      confirmRno: 0,
      stored: 1,
    })),
  ),
);

const drawnOf = (before: readonly number[]) =>
  result.getOrElse((): readonly Drawn[] => [])(
    result.map(
      (
        as: readonly {
          readonly place: string;
          readonly parts: <R>(e: Engine<R>) => (x: XAxis, p: number) => readonly R[];
        }[],
      ) => as.flatMap((a) => a.parts(seen)(xs, a.place === "main" ? 0 : 1)),
    )(result.map((s: Resolved) => indicators(s)(100, before))(defaults)),
  );

describe("indicators", () => {
  it("are MA5, MA10, MA30 on the main graph and MACD, DIFF, DEA in a subgraph", () => {
    expect(drawnOf([]).map((d) => [d.name, d.pane])).toEqual([
      ["MA5", 0],
      ["MA10", 0],
      ["MA30", 0],
      ["MACD", 1],
      ["DIFF", 1],
      ["DEA", 1],
    ]);
  });

  it("start an MA where it has its closes, the closes before counted first, at the scale", () => {
    const [ma5] = drawnOf([]);
    expect(ma5?.values).toEqual([
      { at: 4, value: 3 },
      { at: 5, value: 4 },
    ]);
    const [warm] = drawnOf([100, 100, 100, 100]);
    expect(warm?.values[0]).toEqual({ at: 0, value: 1 });
  });

  it("give MACD a value at every K-line, its bars red at or above 0 and green below", () => {
    const [, , , bars, diff, dea] = drawnOf([]);
    expect([bars?.values.length, diff?.values.length, dea?.values.length]).toEqual([6, 6, 6]);
    // rising closes: DIFF above DEA after the first, so the bars at or above 0
    expect(bars?.values.map((v) => v.colour)).toEqual(["cl-up", "cl-up", "cl-up", "cl-up", "cl-up", "cl-up"]);
    const [, , , falling] = result.getOrElse((): readonly Drawn[] => [])(
      result.map(
        (
          as: readonly {
            readonly place: string;
            readonly parts: <R>(e: Engine<R>) => (x: XAxis, p: number) => readonly R[];
          }[],
        ) =>
          as.flatMap((a) =>
            a.parts(seen)(
              [...xs].reverse().map((k, i) => ({ ...k, rno: i, date: 60 * (i + 1) })),
              1,
            ),
          ),
      )(result.map((s: Resolved) => indicators(s)(100, []))(defaults)),
    );
    expect(falling?.values.slice(1).every((v) => v.colour === "cl-down")).toBe(true);
  });

  it("follow the settings: the averages they list, in their colours, and MACD's periods in its name", () => {
    const named = result.map((s: Resolved) => indicators(s)(100, []).map((a) => a.name))(
      settingsOf([[17, "cl-event"]], 24, 52, 9),
    );
    expect(named).toEqual(result.success(["MA17", "MACD 24 52 9"]));
  });
});
