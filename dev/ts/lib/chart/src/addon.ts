// An add-on (docs/designs/design-chart-lib-2026-10-24.md, Components: derive and draw): a component the caller
// gives, such as an indicator, with its own two callbacks. `derive` computes its data from the K-lines and its
// parameters; `draw` turns that data into the DSL's primitives (dsl.ts) in the pane it is given, in its style. The
// library calls both, one after the other, each time it draws (drawing.ts). It goes on the main graph or in its own
// subgraph below; the library assigns the panes in the order the add-ons come.

import type { Engine } from "./dsl.ts";
import type { XAxis } from "./schemas.ts";

export type AddOnPlace = "main" | "sub";

// what the caller gives, with its own types of data, parameters and style
export type AddOnSpec<D, P, S> = {
  readonly key: string;
  readonly name: string;
  readonly place: AddOnPlace;
  readonly on: boolean;
  readonly params: P;
  readonly style: S;
  readonly derive: (xs: XAxis, params: P) => D;
  readonly draw: <R>(e: Engine<R>) => (data: D, pane: number, style: S) => readonly R[];
};

// an add-on as the library holds it: its data type hidden inside, so add-ons of any data type fit in one list
export type AddOn = {
  readonly key: string;
  readonly name: string;
  readonly place: AddOnPlace;
  readonly on: boolean;
  readonly parts: <R>(e: Engine<R>) => (xs: XAxis, pane: number) => readonly R[];
};

export const addOn = <D, P, S>(s: AddOnSpec<D, P, S>): AddOn => ({
  key: s.key,
  name: s.name,
  place: s.place,
  on: s.on,
  parts:
    <R>(e: Engine<R>) =>
    (xs: XAxis, pane: number): readonly R[] =>
      s.draw(e)(s.derive(xs, s.params), pane, s.style),
});
