// Add-ons (addon.ts) in a drawing (drawing.ts): the library calls both callbacks, derive on the K-lines and draw in the
// pane it gives, the main graph's 0 or the next subgraph's; each a box after 成交量, in the order given.

import { result } from "@qi/base";
import { type KLine, klinesSchema } from "@qi/chanlun";
import { decode } from "@qi/core";
import { describe, expect, it } from "vitest";
import {
  type AddOn,
  addOn,
  type Bars,
  type Chart,
  drawing,
  type Engine,
  type Located,
  located,
  tvChart,
} from "../src/index.ts";

const words: Engine<string> = {
  candle: (at) => `candle ${at}`,
  box: (from, to) => `box ${from}-${to}`,
  mark: (at) => `mark ${at}`,
  line: (from, to) => `line ${from.at} ${to.at}`,
  series: (values, form, place, _, legend) =>
    `${form} pane ${place.pane} ${legend?.name}: ${values.map((v) => v.value).join(",")}`,
  profile: (from, to) => `profile ${from}-${to}`,
};

const xs: readonly KLine[] = result.getOrElse((): readonly KLine[] => [])(
  decode(klinesSchema)(
    [1, 2, 3].map((c, i) => ({
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

// an add-on whose data is its K-lines' closes times its parameter, 2, drawn as a line in its style's colour where the
// library places it
const doubled = (key: string, place: "main" | "sub"): AddOn =>
  addOn({
    key,
    name: key,
    place,
    on: true,
    params: { factor: 2 },
    style: { colour: "cl-ink" },
    derive: (ks, p) => ks.map((k) => p.factor * k.close),
    draw: (e) => (values, pane, s) => [
      e.series(
        values.map((value, at) => ({ at, value })),
        "line",
        { pane },
        { colour: s.colour, dashed: false },
        { name: key, format: "price" },
      ),
    ],
  });

const drawn = (addons: readonly AddOn[]) =>
  result.match(
    (l: Located<Bars>) => drawing(words)(l),
    () => undefined,
  )(
    located({
      title: "t",
      scale: 1,
      xAxis: xs,
      merged: [],
      fractals: [],
      strokes: [],
      duan: [],
      zoushi: [],
      zhongshu: [],
      addons,
    }),
  );

describe("add-ons", () => {
  it("are derived from the K-lines and drawn, a box each after 成交量, in the pane the library gives", () => {
    const d = drawn([doubled("a", "main"), doubled("b", "sub"), doubled("c", "sub")]);
    expect(d?.apart.map((l) => [l.key, l.name, l.parts])).toEqual([
      ["candles", "K线", ["candle 0", "candle 1", "candle 2"]],
      ["volume", "成交量", ["bars pane 0 量: 0,0,0"]],
      ["addon:a", "a", ["line pane 0 a: 2,4,6"]],
      ["addon:b", "b", ["line pane 1 b: 2,4,6"]],
      ["addon:c", "c", ["line pane 2 c: 2,4,6"]],
    ]);
  });

  it("give tv a pane for each subgraph, by default a quarter of the main graph's height", () => {
    const c = {
      title: "t",
      scale: 1,
      xAxis: xs,
      merged: [],
      fractals: [],
      strokes: [],
      duan: [],
      zoushi: [],
      zhongshu: [],
      addons: [doubled("a", "main"), doubled("b", "sub")],
    };
    const panes = result.match(
      (v: { readonly chart: Chart }) => v.chart.panes.map((p) => p.stretchFactor),
      () => undefined,
    )(tvChart(c));
    expect(panes).toEqual([4, 1]);
  });
});
