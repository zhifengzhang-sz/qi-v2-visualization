// A chart's drawing, for any engine (docs/designs/design-chart-lib-2026-10-24.md, Components: derive and draw). Each
// component has two callbacks: `derive` picks its data from the components, `draw` turns that data into an engine's
// primitives. They are called here.
//
// What it draws, as the page shows it (docs/designs/design-chart-chanlun-3-2026-11-09.md, The levels):
// - outside any level: K线 and 成交量 (from the K-lines), then the caller's add-ons (addon.ts), each on the main graph
//   or in its own subgraph (panes 1, 2, … in order);
// - level 0: 包含 and 分型 (fine: shown only while few K-lines are in view; 分型 off at first) and 笔, each only where
//   the run has them;
// - each level L, 0 among them: its 线段, its 走势 and its 中枢, the run's records of level L, where it has them (a chart
//   of bars alone has no level);
// - 成交量分布: a choice of layers, none at first (derived from the K-lines and the run, distribution.ts).
// Every record is put on its K-lines by the one map (locate.ts). All levels are on at first, or only one. Every style,
// parameter and the layout come from the caller's options over the defaults (schemas.ts).

import type { AddOn } from "./addon.ts";
import { baohan } from "./baohan.ts";
import { profilesOf } from "./distribution.ts";
import type { Drawing, Engine, Layer } from "./dsl.ts";
import { fenxing } from "./fenxing.ts";
import { kline } from "./kline.ts";
import { lineOf, zoushi } from "./lines.ts";
import { componentsOf, type Inside, type Located, type Locator, locator } from "./locate.ts";
import { profiles } from "./profile.ts";
import {
  baohanDefaults,
  biDefaults,
  type Consolidation,
  detailDefaults,
  duanDefaults,
  type Fractal,
  fenxingDefaults,
  type KLines,
  klineDefaults,
  layoutDefaults,
  type MergedBar,
  type Move,
  type Options,
  profileDefaults,
  profileParamsDefaults,
  type Run,
  type Segment,
  type Stroke,
  shownDefaults,
  volumeDefaults,
  type XAxis,
  zhongshuDefaults,
  zoushiDefaults,
} from "./schemas.ts";
import { volume } from "./volume.ts";
import { zhongshu } from "./zhongshu.ts";

// The defaults with the caller's values over them; a value the caller leaves out (or sets undefined) keeps its
// default. The two casts are safe: the keys are the defaults' own, and each value has its key's type.
export const merged = <T extends object>(
  defaults: T,
  given: { readonly [K in keyof T]?: T[K] | undefined } | undefined,
): T =>
  Object.fromEntries(
    Object.entries(defaults).map(([k, v]) => [k, (given as Record<string, unknown> | undefined)?.[k] ?? v]),
  ) as T;

// each component's style defaults, by its key in the options
const styles = {
  candles: klineDefaults,
  volume: volumeDefaults,
  merged: baohanDefaults,
  fx: fenxingDefaults,
  bi: biDefaults,
  duan: duanDefaults,
  zoushi: zoushiDefaults,
  zhongshu: zhongshuDefaults,
} as const;
type Styled = keyof typeof styles;
// one component's options: shown at first, shown only while few K-lines are in view, and its style; each the
// caller's where given, else the default
const component = <K extends Styled>(
  k: K,
  given: {
    readonly show?: boolean | undefined;
    readonly detail?: boolean | undefined;
    readonly style?:
      | { readonly [P in keyof (typeof styles)[K]]?: (typeof styles)[K][P] | undefined }
      | undefined;
  } = {},
) => ({
  show: given.show ?? shownDefaults[k],
  detail: given.detail ?? detailDefaults[k],
  style: merged(styles[k], given.style),
});
// Every option's value, for each component and the layout: what the page's dialog shows and a settings file can say.
export const effective = (o: Options = {}) => ({
  candles: component("candles", o.candles),
  volume: component("volume", o.volume),
  merged: component("merged", o.merged),
  fx: component("fx", o.fx),
  bi: component("bi", o.bi),
  duan: component("duan", o.duan),
  zoushi: component("zoushi", o.zoushi),
  zhongshu: component("zhongshu", o.zhongshu),
  profile: {
    params: merged(profileParamsDefaults, o.profile?.params),
    style: merged(profileDefaults, o.profile?.style),
  },
  layout: merged(layoutDefaults, o.layout),
});
export type Effective = ReturnType<typeof effective>;

export type Components = {
  readonly title: string;
  // the K-lines' prices are held inside as whole numbers, the price times this scale, a power of ten
  readonly scale: number;
  // the caller's options; a default for everything left out
  readonly options?: Options;
  // the K-lines, market's (schemas.ts, xAxisSchema); `located` makes them bars
  readonly xAxis: KLines;
  // 缠论's records over them, a run of @qi/chanlun's contract, its positions the K-lines' indexes; a run of no record
  // for a chart of bars alone
  readonly run: Run;
  // the caller's add-ons, in the order they are shown
  readonly addons: readonly AddOn[];
};

// the components as `located` gives them, their K-lines bars and the run's positions the x-axis's: what the drawing is
// made from
export type Bars = Inside<Components>;

// the levels ticked at first: every one, or one
export type Shown = "all" | number;

// One of the library's components: its layer's key and name, on at first or not, fine or not; `derive` picks its
// data from the components, `draw` turns that data into an engine's primitives, given the one map and the scale.
type Own<D> = {
  readonly key: string;
  readonly name: string;
  readonly on: boolean;
  readonly fine: boolean;
  readonly derive: (c: Bars) => D;
  readonly draw: <R>(e: Engine<R>) => (scale: number, loc: Locator) => (data: D) => readonly R[];
};

// a component drawn into its layer: both callbacks called
const layer =
  <R>(e: Engine<R>, c: Bars, loc: Locator) =>
  <D>(o: Own<D>): Layer<R> => ({
    key: o.key,
    name: o.name,
    on: o.on,
    fine: o.fine,
    parts: o.draw(e)(c.scale, loc)(o.derive(c)),
  });

export const drawing =
  <R>(e: Engine<R>) =>
  (l: Located<Bars>, shown: Shown = "all"): Drawing<R> => {
    const c = componentsOf(l);
    const o = effective(c.options);
    const layout = o.layout;
    const colourOf = (level: number): string =>
      layout.levels[Math.min(level, layout.levels.length - 1)] ?? "cl-muted";
    const on = (level: number): boolean => shown === "all" || shown === level;
    // the one map from a merged bar to its K-lines, for every configuration
    const loc = locator(c.run.merged);
    const drawn = layer(e, c, loc);
    const top = Math.max(c.run.segments.length, c.run.moves.length, c.run.consolidations.length, 1) - 1;
    const levels = Array.from({ length: top + 1 }, (_, level) => level);
    // a part's records of a level, none where it holds no such level
    const levelOf = <T>(part: readonly (readonly T[])[], level: number): readonly T[] => part[level] ?? [];
    // a level's 线段, 走势 and 中枢, each where it has any
    const ofLevel = (level: number): readonly Layer<R>[] => {
      const segments: Own<readonly Segment[]> = {
        key: `duan${level}`,
        name: "线段",
        on: o.duan.show && on(level),
        fine: o.duan.detail,
        derive: (x) => levelOf(x.run.segments, level),
        draw: (en) => (_, at) => lineOf(o.duan.style)(en)(at),
      };
      const moves: Own<readonly Move[]> = {
        key: `zoushi${level}`,
        name: "走势",
        on: o.zoushi.show && on(level),
        fine: o.zoushi.detail,
        derive: (x) => levelOf(x.run.moves, level),
        draw: (en) => (_, at) => zoushi(o.zoushi.style)(en)(at),
      };
      const centres: Own<readonly Consolidation[]> = {
        key: `zhongshu${level}`,
        name: "中枢",
        on: o.zhongshu.show && on(level),
        fine: o.zhongshu.detail,
        derive: (x) => levelOf(x.run.consolidations, level),
        draw: (en) => (_, at) => zhongshu(en)(o.zhongshu.style, colourOf)(at),
      };
      return [
        ...(segments.derive(c).length === 0 ? [] : [drawn(segments)]),
        ...(moves.derive(c).length === 0 ? [] : [drawn(moves)]),
        ...(centres.derive(c).length === 0 ? [] : [drawn(centres)]),
      ];
    };
    const candles: Own<XAxis> = {
      key: "candles",
      name: "K线",
      on: o.candles.show,
      fine: o.candles.detail,
      derive: (x) => x.xAxis,
      draw: (en) => (scale) => kline(en)(scale, o.candles.style),
    };
    const volumes: Own<XAxis> = {
      key: "volume",
      name: "成交量",
      on: o.volume.show,
      fine: o.volume.detail,
      derive: (x) => x.xAxis,
      draw: (en) => () => volume(en)(o.volume.style),
    };
    const merged: Own<readonly MergedBar[]> = {
      key: "merged",
      name: "包含",
      on: o.merged.show && on(0),
      fine: o.merged.detail,
      derive: (x) => x.run.merged,
      draw: (en) => () => baohan(en)(o.merged.style),
    };
    const fractals: Own<readonly Fractal[]> = {
      key: "fx",
      name: "分型",
      on: o.fx.show && on(0),
      fine: o.fx.detail,
      derive: (x) => x.run.fractals,
      draw: (en) => (_, at) => fenxing(en)(o.fx.style)(at),
    };
    const strokes: Own<readonly Stroke[]> = {
      key: "bi",
      name: "笔",
      on: o.bi.show && on(0),
      fine: o.bi.detail,
      derive: (x) => x.run.strokes,
      draw: (en) => (_, at) => lineOf(o.bi.style)(en)(at),
    };
    // the add-ons: on the main graph, pane 0; each in a subgraph, the next pane
    const subs = c.addons.filter((a) => a.place === "sub");
    const addons = c.addons.map(
      (a): Layer<R> => ({
        key: `addon:${a.key}`,
        name: a.name,
        on: a.on,
        fine: false,
        parts: a.parts(e)(c.xAxis, a.place === "main" ? 0 : subs.indexOf(a) + 1),
      }),
    );
    return {
      title: c.title,
      fine: layout.fine,
      precision: layout.digits,
      prices: { top: layout.above, bottom: layout.below },
      subgraph: layout.subgraph,
      look: { dash: layout.dash, font: layout.font, offset: layout.offset },
      apart: [drawn(candles), drawn(volumes), ...addons],
      // 成交量分布: derived here from the K-lines and the run
      choice: profiles(e)(c.scale, o.profile.style)(profilesOf(o.profile.params)(c)),
      // a kind of record with none has no layer, and a level with no layer none (a chart of bars alone has none)
      groups: levels
        .map((level) => ({
          level,
          colour: colourOf(level),
          on: on(level),
          layers:
            level === 0
              ? [
                  ...(c.run.merged.length === 0 ? [] : [drawn(merged)]),
                  ...(c.run.fractals.length === 0 ? [] : [drawn(fractals)]),
                  ...(c.run.strokes.length === 0 ? [] : [drawn(strokes)]),
                  ...ofLevel(0),
                ]
              : ofLevel(level),
        }))
        .filter((g) => g.layers.length > 0),
    };
  };
