// The page's script (docs/designs/design-chart-lib-2026-10-24.md, Version 1.7, steps 2 and 3), bundled by Bun for the
// browser with @qi/chart, @qi/indicator and the app's add-ons, no file system: it reads the page's input (INPUT,
// describe.ts), makes its components and the description of the page's engine (ENGINE) by the functions the command
// uses (describe.ts, tvChart, d3fcChart), and gives the engine's script what it reads: CHART and LAYERS for
// engine/tv.ts, CHART for engine/d3fc.ts; and its marks (MARKS, qi-marks/1), where it has them, decoded, which both
// engines read. A fault is written in the page in place of the chart, and on the console. In a page (not in the
// pages' check, which has no document), the page's controls as TradingView lays them out (ui.ts: the toolbar and the
// legend on the chart) and the settings (dialog.ts): a change makes the description again from the input with the
// new settings, and the engine draws it again (REDRAW). An online page (docs/designs/design-chart-online-2026-11-08.md,
// What changes for the chart app): its history drawn whole by the batch, then each K-line to come given to the online
// component, every quarter of a second, and its engine's tail applied (UPDATE); a change of the settings draws the
// K-lines so far again; REPLAY, the replay's handle, for the page's check.

import { type Json, pipe, type QiError, type Result, result } from "@qi/base";
import {
  type ChartUi,
  type Components,
  complete,
  d3fcChart,
  d3fcTail,
  forming,
  marksOn,
  marksSchema,
  type Online,
  online,
  tvChart,
  tvTail,
  type Update,
} from "@qi/chart";
import { decode } from "@qi/core";
import { comingFor, components, historyOf, type PageInput, pageInput } from "../describe.ts";
import { sectionOf, shows, withAverage, withoutAverage } from "../dialog.ts";
import { everyValue, type Resolved, resolved } from "../settings.ts";
import { settingsDialog } from "./dialog.ts";
import { controls, type Periods } from "./ui.ts";

// what the page gives this script, and the one part of the page it writes, where a fault is shown
type Page = {
  readonly INPUT?: unknown;
  readonly ENGINE?: unknown;
  readonly MARKS?: unknown;
  readonly REDRAW?: () => void;
  readonly UPDATE?: Update;
  readonly CHART_UI?: ChartUi;
  readonly document?: { readonly body: { readonly replaceChildren: (text: string) => void } };
};
const page = globalThis as Page;

type EngineError = QiError<"CHART_ENGINE", "VALIDATION">;
type Globals = Readonly<Record<string, unknown>>;

// the page's marks, decoded, on the page's K-lines, where it has them
const marks = (count: number): Result<Globals, QiError> =>
  page.MARKS === undefined
    ? result.success({})
    : pipe(
        decode(marksSchema)(page.MARKS),
        result.flatMap(marksOn(count)),
        result.map((m: unknown) => ({ MARKS: m })),
      );

// the engine's globals, from a chart's components
const globalsOf =
  (engine: unknown, level: PageInput["level"]) =>
  (c: Components): Result<Globals, QiError> =>
    engine === "tv"
      ? result.map(({ chart, layers }: { readonly chart: unknown; readonly layers: unknown }) => ({
          CHART: chart,
          LAYERS: layers,
        }))(tvChart(c, level))
      : engine === "d3fc"
        ? result.map((chart: unknown) => ({ CHART: chart }))(d3fcChart(c, level))
        : result.failure<EngineError>({
            category: "VALIDATION",
            code: "CHART_ENGINE",
            message: `the page's engine, ${String(engine)}: tv or d3fc`,
            context: {},
          });

// the engine's globals, from a page's input: an online page's, its history's
const described = (given: unknown, engine: unknown): Result<Globals, QiError> =>
  pipe(
    pageInput(given),
    result.map(historyOf),
    result.flatMap((i) =>
      pipe(
        components(i),
        result.flatMap(globalsOf(engine, i.level)),
        // and the marks, on the input's K-lines
        result.flatMap((globals) =>
          result.map((m: Globals) => ({ ...globals, ...m }))(marks(i.xAxis.length)),
        ),
      ),
    ),
  );

// The effects, at once, not as a Task: the engine's script is the page's next and reads CHART when it runs, before a
// Task's run would settle; so the engine's globals are given to the page here, synchronously, or the fault shown in it.
result.match(
  (globals: Globals): void => void Object.assign(globalThis, globals),
  (e: QiError): void => {
    console.error(`chart: ${e.message}`);
    page.document?.body.replaceChildren(`chart: ${e.message}`);
  },
)(described(page.INPUT, page.ENGINE));

// the palette's names and each its colour as the page shows it (light or dark), from the page's PALETTE
declare const PALETTE: Readonly<Record<string, readonly string[]>> | undefined;
declare const PERIODS: Periods | undefined;
const shown = (): Readonly<Record<string, string>> => {
  const dark = matchMedia("(prefers-color-scheme: dark)").matches;
  return typeof PALETTE === "undefined"
    ? {}
    : Object.fromEntries(Object.entries(PALETTE).map(([name, pair]) => [name, pair[dark ? 1 : 0] ?? ""]));
};

// The online page's replay: the online component started from the history's components, the K-lines to come given to
// it in turn, each step's tail, for the page's engine, applied by UPDATE. A fault stops it, shown in the console.
type Replay = {
  readonly state: { o: Online; next: number; paused: boolean; ms: number; fault: string | null };
  // the next K-line given, false where none is left or a fault stopped it
  readonly step: () => boolean;
  // the rest given at once, and how many were
  readonly run: () => number;
  readonly left: () => number;
  // the batch's page data of the K-lines so far, as JSON
  readonly whole: () => string | null;
};
const replayOf = (i: PageInput): Result<Replay, QiError> =>
  pipe(
    components(historyOf(i)),
    result.flatMap((c): Result<Online, QiError> => online(c)),
    result.map((o): Replay => {
      const coming = comingFor(i);
      const state = { o, next: 0, paused: false, ms: 0, fault: null as string | null };
      const step = (): boolean => {
        const u = coming[state.next];
        if (u === undefined || state.fault !== null) return false;
        const t0 = performance.now();
        const stepped = pipe(
          "complete" in u ? complete(state.o, u.complete) : forming(state.o, u.forming),
          result.flatMap((s) =>
            result.map((tail: Parameters<Update>[0]) => ({ s, tail }))(
              page.ENGINE === "tv" ? tvTail(s) : d3fcTail(s),
            ),
          ),
        );
        return result.match(
          ({
            s,
            tail,
          }: {
            readonly s: { readonly online: Online };
            readonly tail: Parameters<Update>[0];
          }) => {
            page.UPDATE?.(tail);
            state.o = s.online;
            state.next += 1;
            state.ms += performance.now() - t0;
            return true;
          },
          (e: QiError) => {
            state.fault = e.message;
            console.error(`chart: the replay: ${e.message}`);
            return false;
          },
        )(stepped);
      };
      return {
        state,
        step,
        run: () => coming.slice(state.next).reduce((n: number) => (step() ? n + 1 : n), 0),
        left: () => coming.length - state.next,
        whole: () =>
          result.match(
            (g: Globals) => JSON.stringify({ chart: g.CHART, layers: g.LAYERS ?? null }),
            () => null,
          )(globalsOf(page.ENGINE, i.level)(state.o.components)),
      };
    }),
  );
const replay: Replay | null = pipe(
  pageInput(page.INPUT),
  result.flatMap(
    (i): Result<Replay | null, QiError> => (i.online === undefined ? result.success(null) : replayOf(i)),
  ),
  result.getOrElse((): Replay | null => null),
);

// The page's controls and its settings, in a page (not in the pages' check, which has no document), once the engine's
// script has run and given its handle (CHART_UI): the settings, one cell, the input's at first; a change makes the
// description again from the input with them and the engine draws it again (REDRAW), the controls made again; on an
// online page, of its K-lines so far.
const input = page.INPUT as { readonly settings?: Json } | undefined;
const mount = (): void => {
  const ui = page.CHART_UI;
  if (ui === undefined || input?.settings === undefined) return;
  const state = { settings: input.settings };
  const holder: { refresh: () => void } = { refresh: () => {} };
  // drawn again; a section whose 显示 changed, its layers shown or hidden as it says (the view keeps the rest)
  const redraw =
    (settings: Json) =>
    (globals: Globals): void => {
      const was = shows(state.settings);
      Object.assign(globalThis, globals);
      page.REDRAW?.();
      state.settings = settings;
      const l = ui.layers();
      Object.entries(shows(settings))
        .filter(([key, on]) => was[key] !== on)
        .forEach(([key, on]) => {
          // each layer's section by its name, a level's 线段, 走势 and 中枢 among them
          [
            ...l.apart.map((x) => ({ id: x.id, section: sectionOf(x.name, settings) })),
            ...l.levels.flatMap((g) =>
              g.items.map((x) => ({ id: x.id, section: sectionOf(x.name, settings) })),
            ),
          ]
            .filter((x) => x.section === key)
            .forEach((x) => {
              ui.show(x.id, on);
            });
        });
      holder.refresh();
    };
  const apply = (settings: Json): Result<void, QiError> =>
    result.map(redraw(settings))(
      replay === null
        ? described({ ...input, settings }, page.ENGINE)
        : pipe(
            pageInput({ ...input, settings }),
            result.flatMap((i) =>
              pipe(
                components(i),
                // the K-lines so far with the new settings' options and add-ons, checked as the online component
                // checks a chart (its add-ons drawing with series only), the forming K-line kept
                result.flatMap(
                  (c): Result<Online, QiError> =>
                    online({
                      ...replay.state.o.components,
                      ...(c.options === undefined ? {} : { options: c.options }),
                      addons: c.addons,
                    }),
                ),
                // kept only once the batch has drawn them: a chart the page does not draw is not the replay's
                result.flatMap((o) =>
                  result.map((globals: Globals): Globals => {
                    replay.state.o = { ...o, forming: replay.state.o.forming };
                    return globals;
                  })(globalsOf(page.ENGINE, i.level)(o.components)),
                ),
              ),
            ),
          ),
    );
  const defaults = result.getOrElse((): Json => input.settings ?? {})(
    result.map((r: Resolved): Json => everyValue(r))(resolved({})),
  );
  const dialog = settingsDialog({ settings: () => state.settings, defaults, palette: shown(), apply });
  const tell = (r: Result<void, QiError>): void =>
    result.match(
      (): void => undefined,
      (e: QiError): void => alert(e.message),
    )(r);
  holder.refresh = controls(ui, {
    periods: typeof PERIODS === "undefined" ? undefined : PERIODS,
    sectionOf: (name) => sectionOf(name, state.settings),
    open: (section) => dialog.open(section),
    addAverage: (period) => tell(apply(withAverage(state.settings, period))),
    removeAverage: (section) => tell(apply(withoutAverage(state.settings, Number(section.split(".")[1])))),
  }).refresh;
};
if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", mount);

// The replay, once the engine has drawn: an update every quarter of a second until it is paused or done; and its
// handle: paused, the rest run at once (the number run), how many are left, the batch's page data of the K-lines so far
// (as JSON, for the check to compare with the engine's), the mean cost of an update in milliseconds, and a fault.
if (replay !== null && typeof document !== "undefined")
  document.addEventListener("DOMContentLoaded", () => {
    const timer = setInterval(() => {
      if (!replay.state.paused && !replay.step()) clearInterval(timer);
    }, 250);
    Object.assign(globalThis, {
      REPLAY: {
        pause: () => {
          replay.state.paused = true;
        },
        step: replay.step,
        run: replay.run,
        left: replay.left,
        whole: replay.whole,
        cost: () => (replay.state.next === 0 ? 0 : replay.state.ms / replay.state.next),
        fault: () => replay.state.fault,
      },
    });
  });
