// The online component (docs/designs/design-chart-online-2026-11-08.md): a chart's components as the batch takes them
// (drawing.ts), taken one K-line at a time, each appended or replacing the one still forming. It draws nothing whole:
// the batch draws a chart, and this gives the chart's components after each K-line and the position the K-line
// changed, from which each engine's change is made (tails.ts). Its K-lines are market's (@qi/market): a complete one, a
// K-line; the one still forming, an ongoing K-line. Every rule broken is a fault of its own, the chart as it was.

import { pipe, type QiError, type Result, result } from "@qi/base";
import type { KLine as MarketKLine, OngoingKLine } from "@qi/market";
import type { AddOn } from "./addon.ts";
import type { Components } from "./drawing.ts";
import type { Engine } from "./dsl.ts";
import { componentsOf, located } from "./locate.ts";
import type { XAxis } from "./schemas.ts";

// a fault a rule: the start; the index; the date not after the last, or not the forming one's; asOf; a K-line the
// batch refuses (its message says which of its rules); an add-on drawing more than series
export type OnlineError = QiError<
  | "ONLINE_START"
  | "ONLINE_INDEX"
  | "ONLINE_DATE"
  | "ONLINE_FORMING_DATE"
  | "ONLINE_AS_OF"
  | "ONLINE_KLINE"
  | "ONLINE_ADDON",
  "VALIDATION"
>;

// the chart so far, as the batch takes it, and the ongoing K-line drawn as its last, or none
export type Online = { readonly components: Components; readonly forming: OngoingKLine | undefined };
// a step: the chart after a K-line, and the position the K-line changed
export type Step = { readonly online: Online; readonly from: number };

const fault = (
  code: OnlineError["code"],
  message: string,
  context: Record<string, number> = {},
): OnlineError => ({
  category: "VALIDATION",
  code,
  message,
  context,
});

// An engine that names each primitive it is given: an add-on online draws with series only (its series are replaced
// whole at each update, and a box, a line or a mark has no such change).
const kinds: Engine<string> = {
  candle: () => "candle",
  box: () => "box",
  mark: () => "mark",
  line: () => "line",
  series: () => "series",
  profile: () => "profile",
};
const seriesOnly = (xs: XAxis, addons: readonly AddOn[]): Result<void, OnlineError> => {
  const subs = addons.filter((a) => a.place === "sub");
  const other = addons.find((a) =>
    a
      .parts(kinds)(xs, a.place === "main" ? 0 : subs.indexOf(a) + 1)
      .some((k) => k !== "series"),
  );
  return other === undefined
    ? result.success(undefined)
    : result.failure(fault("ONLINE_ADDON", `the add-on ${other.key} draws with more than series`));
};

// The components checked as the batch checks them (their K-lines made bars), and their add-ons drawing with series
const checked = (c: Components): Result<Components, OnlineError> =>
  pipe(
    located(c),
    result.mapError((e): OnlineError => fault("ONLINE_KLINE", e.message)),
    result.flatMap((l) => seriesOnly(componentsOf(l).xAxis, c.addons)),
    result.map(() => c),
  );

// An online chart from a chart's components: at least one K-line, a run of no record
const none = (r: Components["run"]): boolean =>
  [r.merged, r.fractals, r.strokes, r.segments, r.moves, r.consolidations].every((part) => part.length === 0);
export const online = (c: Components): Result<Online, OnlineError> =>
  c.xAxis.length === 0
    ? result.failure(fault("ONLINE_START", "the chart has no K-line"))
    : !none(c.run)
      ? result.failure(fault("ONLINE_START", "the chart has 缠论 data, which is not online"))
      : result.map((ok: Components): Online => ({ components: ok, forming: undefined }))(checked(c));

const marketOf = (o: Online): readonly MarketKLine[] => o.components.xAxis;
// the K-line's own fields: an ongoing K-line drawn as a K-line
const asKLine = (k: MarketKLine | OngoingKLine): MarketKLine => ({
  index: k.index,
  date: k.date,
  open: k.open,
  high: k.high,
  low: k.low,
  close: k.close,
  volume: k.volume,
});

// The chart with its last K-line replaced, or one appended: checked again, and the position changed
const placed = (
  o: Online,
  k: MarketKLine | OngoingKLine,
  replace: boolean,
  forming: OngoingKLine | undefined,
): Result<Step, OnlineError> => {
  const ks = marketOf(o);
  const xAxis = replace ? [...ks.slice(0, -1), asKLine(k)] : [...ks, asKLine(k)];
  const first = ks[0]?.index ?? k.index;
  return result.map((c: Components): Step => ({ online: { components: c, forming }, from: k.index - first }))(
    checked({ ...o.components, xAxis }),
  );
};

// the next index, and the last complete K-line
const next = (o: Online): { readonly index: number; readonly last: MarketKLine | undefined } => {
  const ks = marketOf(o);
  const last = o.forming === undefined ? ks.at(-1) : ks.at(-2);
  return { index: o.forming?.index ?? (ks.at(-1)?.index ?? -1) + 1, last };
};

const atNext = (o: Online, k: MarketKLine | OngoingKLine): Result<void, OnlineError> => {
  const n = next(o);
  return k.index !== n.index
    ? result.failure(fault("ONLINE_INDEX", `K-line ${k.index}: the next is ${n.index}`, { index: k.index }))
    : o.forming === undefined && n.last !== undefined && k.date <= n.last.date
      ? result.failure(
          fault("ONLINE_DATE", `K-line ${k.index}: its date is not after the last`, { index: k.index }),
        )
      : o.forming !== undefined && k.date !== o.forming.date
        ? result.failure(
            fault("ONLINE_FORMING_DATE", `K-line ${k.index}: its date is not the forming one's`, {
              index: k.index,
            }),
          )
        : result.success(undefined);
};

// A complete K-line at the next index: the forming one completed, or, with none forming, a new one appended
export const complete = (o: Online, k: MarketKLine): Result<Step, OnlineError> =>
  pipe(
    atNext(o, k),
    result.flatMap(() => placed(o, k, o.forming !== undefined, undefined)),
  );

// An ongoing K-line at the next index: the forming one replaced, or, with none forming, appended as forming
export const forming = (o: Online, k: OngoingKLine): Result<Step, OnlineError> =>
  pipe(
    atNext(o, k),
    result.flatMap(() =>
      o.forming !== undefined && k.asOf < o.forming.asOf
        ? result.failure(
            fault("ONLINE_AS_OF", `K-line ${k.index}: its asOf is before the forming one's`, {
              index: k.index,
            }),
          )
        : placed(o, k, o.forming !== undefined, k),
    ),
  );
