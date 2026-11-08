// The app's add-ons (docs/designs/design-chart-lib-2026-10-24.md, Components: derive and draw, Version 1.7): MA and
// MACD, components of kind 1, their values by @qi/indicator, drawn as series; each its parameters, what its derive
// takes, and its style, what its draw takes, the settings' (settings.ts: MA5, MA10 and MA30, MACD 12 26 9 by default).
// The averages of the closes on the main graph, each in its colour; MACD in a subgraph, DIFF and DEA lines and the
// MACD bars in their up or down colour by their sign. The closes before the run's first K-line (history.csv, where the
// run has one) come first, so the first K-line has its averages; where there are none, from the first K-line: an MA
// has no value until it has its n closes, the EMAs start at the first close. Prices at the run's scale, drawn divided
// by it.

import { type AddOn, addOn, type XAxis } from "@qi/chart";
import { macd, type Period, sma } from "@qi/indicator";
import type { MacdStyle, MaStyle, Resolved } from "./settings.ts";

// the closes of the K-lines after those before them, and how many come before
const closes =
  (before: readonly number[]) =>
  (xs: XAxis): { readonly all: readonly number[]; readonly skip: number } => ({
    all: [...before, ...xs.map((k) => k.close)],
    skip: before.length,
  });

// an average's add-on: its values at the K-lines where it has one, a line on the main graph
const average =
  (scale: number, before: readonly number[]) =>
  (show: boolean, params: { readonly period: Period }, style: MaStyle): AddOn =>
    addOn({
      key: `ma${params.period}`,
      name: `MA${params.period}`,
      place: "main",
      on: show,
      params,
      style,
      derive: (xs, p) => {
        const c = closes(before)(xs);
        return sma(p.period)(c.all).slice(c.skip);
      },
      draw: (e) => (values, pane, s) => [
        e.series(
          values.flatMap((v, at) => (v === null ? [] : [{ at, value: v / scale }])),
          "line",
          { pane },
          { colour: s.colour, dashed: false, width: s.width },
          { name: `MA${params.period}`, format: "price" },
        ),
      ],
    });

// MACD's add-on: DIFF and DEA lines and the MACD bars, up at or above 0 and down below, in a subgraph
const macdAddOn =
  (scale: number, before: readonly number[]) =>
  (show: boolean, params: Resolved["macd"]["params"], style: MacdStyle): AddOn =>
    addOn({
      key: "macd",
      // a box's id is its name, and the address lists the unticked ones by commas: none in it
      name: `MACD ${params.fast} ${params.slow} ${params.signal}`,
      place: "sub",
      on: show,
      params,
      style,
      derive: (xs, p) => {
        const c = closes(before)(xs);
        const m = macd(p.fast, p.slow, p.signal)(c.all);
        return { diff: m.diff.slice(c.skip), dea: m.dea.slice(c.skip), macd: m.macd.slice(c.skip) };
      },
      // its bars, DIFF and DEA, each where its style shows it
      draw: (e) => (d, pane, s) => [
        ...(!s.showBars
          ? []
          : [
              e.series(
                d.macd.map((v, at) => ({ at, value: v / scale, colour: v >= 0 ? s.up : s.down })),
                "bars",
                { pane },
                { colour: "cl-muted", dashed: false },
                { name: "MACD", format: "price" },
              ),
            ]),
        ...(!s.showDiff
          ? []
          : [
              e.series(
                d.diff.map((v, at) => ({ at, value: v / scale })),
                "line",
                { pane },
                { colour: s.diff, dashed: false, width: s.width },
                { name: "DIFF", format: "price" },
              ),
            ]),
        ...(!s.showDea
          ? []
          : [
              e.series(
                d.dea.map((v, at) => ({ at, value: v / scale })),
                "line",
                { pane },
                { colour: s.dea, dashed: false, width: s.width },
                { name: "DEA", format: "price" },
              ),
            ]),
      ],
    });

// The add-ons of a run by the settings, at its scale, the closes before its first K-line given (none where it has no
// history.csv).
export const indicators =
  (s: Pick<Resolved, "averages" | "macd">) =>
  (scale: number, before: readonly number[]): readonly AddOn[] => [
    ...s.averages.map((a) => average(scale, before)(a.show, a.params, a.style)),
    macdAddOn(scale, before)(s.macd.show, s.macd.params, s.macd.style),
  ];
