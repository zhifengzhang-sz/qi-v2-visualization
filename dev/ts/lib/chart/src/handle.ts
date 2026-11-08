// The engines' handles on a page (engine/tv.ts, engine/d3fc.ts; the README, The page): what an engine's script gives
// the page once it has drawn, the same from both engines. CHART_UI, for the page's controls: the layers and their
// state, showing and choosing them, the view, the K-line under the pointer with the legend's values there, the panes'
// places, a palette name's colour. REDRAW, the chart drawn again from the page's data as it is then, the view and what
// is hidden kept. MARKING, a layer of marks added to the chart as it stands, or taken away. UPDATE, an online step's
// change, its engine's tail (applied.ts), applied to the chart as drawn and to the page's data, the view following
// the newest K-line only while it is in view (docs/designs/design-chart-online-2026-11-08.md, The engines).

import type { D3fcTail, TvTail } from "./applied.ts";
import type { MarkLayer } from "./marking.ts";

// each shown layer's values at a K-line, by the layer's id: each value's name and its text
export type Values = Readonly<Record<string, readonly { readonly name: string; readonly text: string }[]>>;

// the K-line under the pointer (else the last): its time, its prices, and each shown layer's values there; null
// where there is no K-line
export type Pointer = {
  readonly stamp: string;
  readonly candle: {
    readonly open: string;
    readonly high: string;
    readonly low: string;
    readonly close: string;
    readonly up: boolean;
  } | null;
  readonly values: Values;
} | null;

// a layer's state: its id (its name; a level's after its level, 1:中枢), its name, ticked or not, its colour
export type LayerState = {
  readonly id: string;
  readonly name: string;
  readonly on: boolean;
  readonly colour: string;
};

// the layers as the page shows them: those apart (each in its pane), each level's, the price distributions' choice
// (the one chosen, −1 for none), and the layers of marks
export type LayerStates = {
  readonly apart: readonly (LayerState & { readonly pane: number })[];
  readonly levels: readonly {
    readonly level: number;
    readonly colour: string;
    readonly items: readonly LayerState[];
  }[];
  readonly choice: { readonly name: string; readonly items: readonly string[]; readonly chosen: number };
  readonly marks: readonly { readonly key: string; readonly name: string; readonly on: boolean }[];
};

export type ChartUi = {
  readonly layers: () => LayerStates;
  readonly show: (id: string, on: boolean) => void;
  readonly choose: (i: number | null) => void;
  readonly showMark: (key: string, on: boolean) => void;
  // the view: all the K-lines, or the last 400
  readonly all: () => void;
  readonly latest: () => void;
  // the address of the view (time=FROM-TO&off=…), where another period's page opens
  readonly here: () => string;
  // called at once, then at each move of the pointer
  readonly pointer: (fn: (p: Pointer) => void) => void;
  // each pane's top and height in pixels, within the chart's element: the main graph, then each subgraph
  readonly panes: () => readonly { readonly top: number; readonly height: number }[];
  readonly colour: (name: string) => string;
};

export type Marking = {
  readonly mark: (layer: MarkLayer) => void;
  readonly unmark: (key: string) => void;
};

export type Update = (tail: TvTail | D3fcTail) => void;
