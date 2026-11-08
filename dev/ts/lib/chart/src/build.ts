// Builders for the tv description (description.ts): one function per Lightweight Charts call, returning a value
// instead of changing a chart. `candlestick(id, data, options, paneIndex)` stands for
// `chart.addSeries(CandlestickSeries, options, paneIndex).setData(data)`; `line` and `histogram` likewise; `segments`,
// `boxes` and `profiles` likewise for the three drawn kinds (primitives in Lightweight Charts). `chart({ series,
// panes })` checks the whole against the contract, with a pane for every paneIndex used unless panes are given.

import type { Result } from "@qi/base";
import { type DecodeError, decode } from "@qi/core";
import {
  type Box,
  type BoxesOptions,
  type Candle,
  type CandlestickOptions,
  type Chart,
  chartSchema,
  type Distribution,
  type HistogramOptions,
  type LineOptions,
  type Pane,
  type Point,
  type ProfilesOptions,
  type Segment,
  type SegmentsOptions,
  type Series,
  type TimeScale,
} from "./description.ts";
import type { Look } from "./dsl.ts";

// a series of one kind
type Of<K extends Series["type"]> = Extract<Series, { readonly type: K }>;

export const candlestick = (
  id: string,
  data: readonly Candle[],
  options: CandlestickOptions = {},
  paneIndex = 0,
): Of<"Candlestick"> => ({ type: "Candlestick", id, options, data, paneIndex });

export const line = (
  id: string,
  data: readonly Point[],
  options: LineOptions = {},
  paneIndex = 0,
): Of<"Line"> => ({ type: "Line", id, options, data, paneIndex });

export const histogram = (
  id: string,
  data: readonly Point[],
  options: HistogramOptions = {},
  paneIndex = 0,
): Of<"Histogram"> => ({ type: "Histogram", id, options, data, paneIndex });

export const segments = (
  id: string,
  data: readonly Segment[],
  options: SegmentsOptions = {},
  paneIndex = 0,
): Of<"Segments"> => ({ type: "Segments", id, options, data, paneIndex });

export const boxes = (
  id: string,
  data: readonly Box[],
  options: BoxesOptions = {},
  paneIndex = 0,
): Of<"Boxes"> => ({ type: "Boxes", id, options, data, paneIndex });

export const profiles = (
  id: string,
  data: readonly Distribution[],
  options: ProfilesOptions = {},
  paneIndex = 0,
): Of<"Profiles"> => ({ type: "Profiles", id, options, data, paneIndex });

export const chart = (c: {
  readonly series: readonly Series[];
  readonly panes?: readonly Pane[];
  readonly title?: string;
  readonly timeScale?: TimeScale;
  readonly look?: Look;
}): Result<Chart, DecodeError> =>
  decode(chartSchema)({
    contract: "qi-chart/1",
    ...(c.title === undefined ? {} : { title: c.title }),
    ...(c.timeScale === undefined ? {} : { timeScale: c.timeScale }),
    ...(c.look === undefined ? {} : { look: c.look }),
    panes:
      c.panes ?? Array.from({ length: Math.max(0, ...c.series.map((s) => s.paneIndex)) + 1 }, () => ({})),
    series: c.series,
  });
