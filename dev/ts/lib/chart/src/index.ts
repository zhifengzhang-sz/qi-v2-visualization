// @qi/chart, a 缠论 drawing library (docs/designs/design-chart-lib-2026-10-24.md; dev/docs/lib.md, Domain libraries
// and apps). It knows no app and no producer, and computes no structure: it draws what it is given.
// - What it takes: market's K-lines (@qi/market) and, beside them, a run of 缠论's contract over them (@qi/chanlun),
//   and the settings (schemas.ts); `located` (locate.ts) checks that the run fits the K-lines, which the one map puts
//   its records on (docs/designs/design-chart-chanlun-3-2026-11-09.md).
// - How it draws: each component has two callbacks, derive and draw (drawing.ts), drawing with the DSL's primitives
//   (dsl.ts). The library's own components: kline.ts, volume.ts, baohan.ts, fenxing.ts, lines.ts, zhongshu.ts, and
//   成交量分布 (distribution.ts, profile.ts); the caller's: add-ons (addon.ts). Marks are a DSL of their own
//   (marking.ts).
// - The engines: tv (tv.ts makes its page data, description.ts and layers.ts, built with build.ts; engine/tv.ts draws
//   it), d3fc (d3fc.ts, qi-d3fc/1; engine/d3fc.ts) and tikz (tikz.ts). The handles both browser engines give a page:
//   handle.ts.
// - Its two components (docs/designs/design-chart-online-2026-11-08.md): the batch, which draws a chart whole (the
//   engines' functions above), and the online one (online.ts), which takes a chart one K-line at a time and gives each
//   engine its change (tails.ts, applied.ts).
//
// What it exports is what a taker uses, the rest being the library's own (its tests import that from its modules):
// - drawing a chart: tvChart, d3fcChart, tikzChart; located, drawing, effective, merged; marksOn;
// - taking it one K-line at a time: online, complete, forming; tvTail, d3fcTail; tvApplied, d3fcApplied;
// - what a chart takes, with its schemas: the K-lines, market's (xAxisSchema), the options (optionsSchema,
//   and the pieces an add-on's style is built from), the marks (marksSchema, markLayerSchema);
// - what it gives: each engine's page data (chartSchema, layersSchema, d3fcSchema), and the handles' types;
// - writing an add-on or an engine of one's own: addOn, and the DSL's types (dsl.ts).

export { type AddOn, type AddOnPlace, type AddOnSpec, addOn } from "./addon.ts";
export { type D3fcTail, d3fcApplied, type TvItem, type TvTail, tvApplied } from "./applied.ts";
export { type D3fc, d3fcChart, d3fcSchema } from "./d3fc.ts";
export { type Chart, chartSchema, type Point } from "./description.ts";
export {
  type Bars,
  type Components,
  drawing,
  type Effective,
  effective,
  merged,
  type Shown,
} from "./drawing.ts";
export type {
  Choice,
  Distribution,
  DistributionStyle,
  Drawing,
  Engine,
  Group,
  Layer as DrawingLayer,
  Legend,
  Look,
  Margins,
  Place,
  Point as DrawingPoint,
  Style,
  Value,
} from "./dsl.ts";
export type { ChartUi, LayerState, LayerStates, Marking, Pointer, Update, Values } from "./handle.ts";
export { type Layers, layersSchema } from "./layers.ts";
export { type Inside, type Located, type LocateError, located } from "./locate.ts";
export {
  type Mark,
  type MarkingError,
  type MarkLayer,
  type MarkPoint,
  type Marks,
  markLayerSchema,
  marksOn,
  marksSchema,
} from "./marking.ts";
export { complete, forming, type Online, type OnlineError, online, type Step } from "./online.ts";
export {
  type Bar,
  colourSchema,
  type KLines,
  type Layout,
  layoutSchema,
  type Options,
  opacitySchema,
  optionsSchema,
  shareSchema,
  sizeSchema,
  widthSchema,
  type XAxis,
  xAxisSchema,
} from "./schemas.ts";
export { d3fcTail, tvTail } from "./tails.ts";
export { type TikzError, type TikzOptions, tikzChart } from "./tikz.ts";
export { tvChart } from "./tv.ts";
