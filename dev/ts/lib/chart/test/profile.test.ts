// 成交量分布's drawing (profile.ts) through an engine of text: a layer a kind and level, named for the pull-down, none
// on at first, its prices by the chart's scale; and through each engine: tv's Profiles series, its layer in the
// choice, d3fc's profiles in the choice's layer with its style.

import { result } from "@qi/base";
import { type KLine, klinesSchema, type MergedBar, type Stroke } from "@qi/chanlun";
import { decode } from "@qi/core";
import { describe, expect, it } from "vitest";
import { type Chart, type D3fc, d3fcChart, type Engine, type Layers, tvChart } from "../src/index.ts";
import { profileChoice, profiles } from "../src/profile.ts";
import { type Profile, profileDefaults } from "../src/schemas.ts";

const words: Engine<string> = {
  candle: (at) => `candle ${at}`,
  box: (from, to) => `box ${from}-${to}`,
  mark: (at) => `mark ${at}`,
  line: (from, to) => `line ${from.at} ${to.at}`,
  series: (values, form) => `series ${form} ${values.length}`,
  profile: (from, to, d, s) =>
    `profile ${from}-${to} from ${d.low} by ${d.step}: ${d.up.join(",")} / ${d.down.join(",")} poc ${d.poc} value ${d.value.from}-${d.value.to} ${s.up} ${s.down} ${s.opacity} ${s.share}`,
};

const item: Profile = {
  from: 1,
  to: 3,
  low: 100,
  step: 5,
  up: [3, 0],
  down: [1, 2],
  poc: 0,
  value: { from: 0, to: 1 },
};

// four K-lines from 1.00 to 1.02 at a scale of 100, each up with a volume of 1, a merged bar each; one 笔 from merged
// bar 1 to merged bar 3: its distribution two rows of a cent, 1.5 each, rounded to 2
const xs: readonly KLine[] = result.getOrElse((): readonly KLine[] => [])(
  decode(klinesSchema)(
    [0, 1, 2, 3].map((i) => ({
      rno: i,
      date: 60 * (i + 1),
      up: true,
      open: 100,
      high: 102,
      low: 100,
      close: 102,
      volume: 1,
      confirmRno: 0,
      stored: 1,
    })),
  ),
);

const merged: readonly MergedBar[] = xs.map((_, i) => ({
  rno: i,
  mno: i,
  up: true,
  high: 102,
  low: 100,
  startDate: i,
  endDate: i,
  stored: 1,
}));

const stroke: Stroke = {
  level: -2,
  isUp: true,
  startDate: 1,
  confirmStartDate: 2,
  endDate: 3,
  high: 102,
  low: 100,
  startRno: 0,
  endRno: 0,
  stored: 1,
  startBar: 1,
  endBar: 3,
};

const components = {
  title: "t",
  scale: 100,
  xAxis: xs,
  merged,
  fractals: [],
  strokes: [stroke],
  duan: [],
  zoushi: [],
  zhongshu: [],
  addons: [],
};

const given = [
  { kind: "bi" as const, level: 0, items: [item] },
  { kind: "duan" as const, level: 1, items: [item] },
  { kind: "zhongshu" as const, level: 0, items: [] },
];

describe("成交量分布", () => {
  it("is a choice of layers, a kind and level each, none on, its prices by the scale", () => {
    const c = profiles(words)(10, profileDefaults)(given);
    expect(c.name).toBe(profileChoice);
    expect(c.layers.map((l) => [l.key, l.name, l.on, l.parts.length])).toEqual([
      ["profile:bi0", "笔", false, 1],
      ["profile:duan1", "线段 1", false, 1],
      ["profile:zhongshu0", "中枢 0", false, 0],
    ]);
    expect(c.layers[0]?.parts).toEqual([
      "profile 1-3 from 10 by 0.5: 3,0 / 1,2 poc 0 value 0-1 cl-up cl-down 0.4 0.25",
    ]);
  });

  it("is derived by the library and drawn as a Profiles series in tv, its layer in the choice", () => {
    const r = result.match(
      (v: { readonly chart: Chart; readonly layers: Layers }) => v,
      (): undefined => undefined,
    )(tvChart(components));
    const s = r?.chart.series.find((x) => x.id === "profile:bi0");
    expect(s?.type).toBe("Profiles");
    expect(s?.data).toEqual([
      {
        time: 120,
        endTime: 240,
        low: 1,
        step: 0.01,
        up: [2, 2],
        down: [0, 0],
        poc: 0,
        valueFrom: 0,
        valueTo: 1,
      },
    ]);
    expect(r?.layers.choice.name).toBe(profileChoice);
    expect(r?.layers.choice.items.map((l) => [l.name, l.series, l.on])).toEqual([
      ["笔", ["profile:bi0"], false],
    ]);
  });

  it("is a layer's profiles in d3fc, with its style", () => {
    const r = result.match(
      (v: D3fc) => v,
      (): undefined => undefined,
    )(d3fcChart(components));
    const l = r?.choice.layers[0];
    expect(l?.profiles).toEqual([
      { x0: 1, x1: 3, low: 1, step: 0.01, up: [2, 2], down: [0, 0], poc: 0, valueFrom: 0, valueTo: 1 },
    ]);
    expect(l?.profileStyle).toEqual({ up: "cl-up", down: "cl-down", opacity: 0.4, share: 0.25 });
  });
});
