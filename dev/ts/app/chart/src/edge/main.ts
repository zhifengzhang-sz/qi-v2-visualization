/// <reference types="node" />
// The chart app's command: `main.ts DIR --palette PATH --config PATH [--engine tv,d3fc,tikz] [--bundle PATH] [--lib
// PATH --tv-engine PATH] [--d3 PATH --fc PATH --d3fc-engine PATH] [--range all|FROM-TO] [--title T] [--level all|0|1…] [--periods
// NAME=DIR,…] [--marks FILE] [--online N] [--results FILE --scale N | --input FILE --request FILE]` (README.md). --engine, the engines that draw,
// a list, each once, tv and d3fc where none is given; each page carrying its input (describe.ts) and --bundle, the
// app's script for the browser (src/edge/browser.ts bundled), which makes the engine's description there: tv, the page
// DIR/chart.html (@qi/chart's engine/tv.ts,
// --tv-engine; --lib, Lightweight Charts' standalone build); d3fc, the page DIR/chart-d3fc.html (D3's and d3fc's
// bundles and engine/d3fc.ts); tikz, the static picture DIR/chart.tex (@qi/chart's tikz.ts) of the K-lines --range
// gives, all or those from one position to another, all where none is given; --range refused without tikz. An
// engine's files are needed where it draws, and not read where it does not. --config, the settings (settings.ts,
// chart.toml): the library's components' styles and parameters and its layout (the digits a price is shown to among
// them), the averages and MACD, the picture's size and theme; --palette, the palette's names and colours. It makes the
// run first where it is given one (docs/designs/design-chart-app-2026-10-24.md, Making a run): --results, a set's file,
// and --scale, its prices' scale: DIR/run.json, the file as it is, and DIR/meta.json, the scale and the set's name, the
// file's, as the source and the title where none is given; --input, the bars of a chart of bars alone (input.ts), and
// --request, their scale and source: DIR/in.csv and DIR/meta.json. Neither, DIR is a run made already. Then, on DIR: the
// run's K-lines, merged bars, 分型, 笔, 线段, 走势 and 中枢 read into the
// components (read.ts) and drawn by each engine asked for; --level, the levels ticked at first; --periods, the same
// bars' runs at each period, this one among them, each page's 周期 (periods.ts). The add-ons, MA and MACD
// (indicators.ts), the closes in DIR/history.csv first where the run has one. --marks, a page's marks, a file in the
// form marks.ts takes, put on the run's K-lines and drawn by every engine; the static picture then of the K-lines the
// marks are of, where no --range is given. --online, an online page of a run of bars alone: all but its last N
// K-lines drawn whole, then those N one at a time (src/edge/browser.ts; docs/designs/design-chart-online-2026-11-08.md).
// A fault stops it, its message on stderr and exit 1.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { parseArgs } from "node:util";
import { error, type Json, pipe, type QiError, result, type Task, task } from "@qi/base";
import { d3fcChart, type Marks, tikzChart, tvChart, type XAxis } from "@qi/chart";
import { config, decode } from "@qi/core";
import { z } from "zod";
import {
  barsFile,
  barsOf,
  coloursOf,
  components,
  d3fcPage,
  everyValue,
  history,
  historyOf,
  picture as lean,
  marksOf,
  type PageInput,
  type Palette,
  page,
  paletteSchema,
  parse,
  periods,
  pictureShown,
  type Resolved,
  resolved,
  runOf,
  scales,
  settingsSchema,
} from "../index.ts";
import { span, windowed, windowOf } from "../window.ts";

type FileError = QiError<"FILE", "SYSTEM">;
type ArgError = QiError<"ARGS", "VALIDATION">;

const io =
  (what: string, path: string) =>
  (thrown: unknown): FileError => {
    const e = error.fromUnknown("SYSTEM")(thrown);
    return { category: "SYSTEM", code: "FILE", message: `${what} ${path}: ${e.message}`, context: { path } };
  };

const read = (path: string): Task<string, FileError> =>
  task.tryPromise(io("cannot read", path))(() => readFile(path, "utf8"));
// a file a run may not have (history.csv): its text, or empty where it is not there
const optional = (path: string): Task<string, FileError> =>
  task.tryPromise(io("cannot read", path))(() =>
    readFile(path, "utf8").catch((e: { readonly code?: string }) =>
      e.code === "ENOENT" ? "" : Promise.reject(e),
    ),
  );
const write = (path: string, text: string): Task<string, FileError> =>
  task.tryPromise(io("cannot write", path))(() => writeFile(path, text).then(() => path));
const json = (path: string) => (text: string) =>
  task.fromResult(result.tryCatch((e: unknown) => io("not JSON:", path)(e))((): Json => JSON.parse(text)));
const say = (line: string): Task<void, FileError> =>
  task.tryPromise(io("cannot write to", "stdout"))(() => Promise.resolve(console.log(line)));

const usage =
  "usage: main.ts DIR --palette PATH --config PATH [--engine tv,d3fc,tikz] [--bundle PATH] [--lib PATH --tv-engine PATH] " +
  "[--d3 PATH --fc PATH --d3fc-engine PATH] [--range all|FROM-TO] [--title T] [--level all|0|1…] " +
  "[--periods NAME=DIR,…] [--window FROM:TO|Ny|Nm] [--online N] [--results FILE --scale N | --input FILE --request FILE]";

// the engines that draw a run, in the order they draw
const engineNames = ["tv", "d3fc", "tikz"] as const;
type EngineName = (typeof engineNames)[number];

// a fault of the data (a run's bars, its request, a chart its components could not draw): no usage, the command was
// right
type DataError = QiError<"DATA", "VALIDATION">;
const dataError = (message: string): DataError => ({
  category: "VALIDATION",
  code: "DATA",
  message,
  context: {},
});

const argError = (message: string): ArgError => ({
  category: "VALIDATION",
  code: "ARGS",
  message: `${message}; ${usage}`,
  context: {},
});

// a prices' scale: a power of ten, as the bars' prices are read (input.ts)
const scaleSchema = z
  .number()
  .int()
  .refine((s) => scales.some((x) => x === s), "a scale is a power of ten, 1 to 1,000,000");

const optionsSchema = z
  .object({
    dir: z.string().min(1),
    // the engines that draw: a list, each once; the two pages where none is given
    engine: z
      .string()
      .transform((t) => t.split(","))
      .pipe(
        z
          .array(z.enum(engineNames))
          .min(1)
          .refine((es) => new Set(es).size === es.length, "each engine once"),
      )
      .default(["tv", "d3fc"]),
    // the tv engine's page, chart.html: Lightweight Charts' standalone build and engine/tv.ts
    lib: z.string().min(1).optional(),
    "tv-engine": z.string().min(1).optional(),
    // the app's script for the pages, src/edge/browser.ts bundled for the browser
    bundle: z.string().min(1).optional(),
    palette: z.string().min(1),
    // the settings, a TOML file (settings.ts)
    config: z.string().min(1),
    // the d3fc engine's page too, chart-d3fc.html: D3's and d3fc's bundles and engine/d3fc.ts
    d3: z.string().min(1).optional(),
    fc: z.string().min(1).optional(),
    "d3fc-engine": z.string().min(1).optional(),
    title: z.string().min(1).optional(),
    // the same bars at each period, this folder among them: NAME=DIR,NAME=DIR,…
    periods: z.string().min(1).optional(),
    // the K-lines the static picture draws: all, or those from one position to another (FROM-TO)
    range: z
      .string()
      .regex(/^(all|[0-9]+-[0-9]+)$/)
      .optional(),
    // the levels ticked at first: all, or a level's number
    level: z.union([z.literal("all"), z.coerce.number().int().nonnegative()]).default("all"),
    // the page's window, FROM:TO or the last N years or months (window.ts); none, the whole run
    window: z.string().min(1).optional(),
    // a run made first, of the results: a set's file, and its prices' scale, which a run does not hold
    results: z.string().min(1).optional(),
    scale: z.coerce.number().pipe(scaleSchema).optional(),
    // or of bars alone: the bars, their scale and source
    input: z.string().min(1).optional(),
    request: z.string().min(1).optional(),
    // a page's marks, a file in the form marks.ts takes
    marks: z.string().min(1).optional(),
    // an online page (docs/designs/design-chart-online-2026-11-08.md, What changes for the chart app): of a run of bars
    // alone, all but its last N K-lines drawn whole, then those N one at a time
    online: z.coerce.number().int().positive().optional(),
  })
  .strict()
  .refine(
    (o) =>
      [o.d3, o.fc, o["d3fc-engine"]].every((x) => x === undefined) ||
      [o.d3, o.fc, o["d3fc-engine"]].every((x) => x !== undefined),
    { message: "--d3, --fc and --d3fc-engine go together, or none", path: ["d3"] },
  )
  .refine((o) => !o.engine.includes("tv") || (o.lib !== undefined && o["tv-engine"] !== undefined), {
    message: "the engine tv needs --lib and --tv-engine",
    path: ["engine"],
  })
  .refine((o) => !(o.engine.includes("tv") || o.engine.includes("d3fc")) || o.bundle !== undefined, {
    message: "the engines tv and d3fc need --bundle, the app's script for the pages",
    path: ["engine"],
  })
  .refine((o) => !o.engine.includes("d3fc") || o.d3 !== undefined, {
    message: "the engine d3fc needs --d3, --fc and --d3fc-engine",
    path: ["engine"],
  })
  .refine((o) => o.range === undefined || o.engine.includes("tikz"), {
    message: "--range is the picture's: it needs the engine tikz",
    path: ["range"],
  })
  .refine(
    (o) =>
      (o.results === undefined) === (o.scale === undefined) &&
      (o.input === undefined) === (o.request === undefined) &&
      (o.results === undefined || o.input === undefined),
    {
      message: "--results and --scale go together, --input and --request go together, one pair or none",
      path: ["results"],
    },
  );

// meta.json, written when the run is made: the prices' scale, the source, and the run's title where it has one, so the
// pages drawn again keep it; request.json the same, without the title
const metaSchema = z
  .object({
    scale: scaleSchema,
    source: z.string().min(1),
    title: z.string().min(1).optional(),
    // a run of bars only: its bars the x-axis, no structure
    bars: z.literal(true).optional(),
  })
  .strict();

const args = (argv: readonly string[]) =>
  pipe(
    result.tryCatch((e: unknown) => argError(error.fromUnknown("VALIDATION")(e).message))(() =>
      parseArgs({
        args: [...argv],
        allowPositionals: true,
        options: {
          engine: { type: "string" },
          lib: { type: "string" },
          "tv-engine": { type: "string" },
          bundle: { type: "string" },
          palette: { type: "string" },
          config: { type: "string" },
          d3: { type: "string" },
          fc: { type: "string" },
          "d3fc-engine": { type: "string" },
          title: { type: "string" },
          level: { type: "string" },
          window: { type: "string" },
          periods: { type: "string" },
          range: { type: "string" },
          results: { type: "string" },
          scale: { type: "string" },
          input: { type: "string" },
          request: { type: "string" },
          marks: { type: "string" },
          online: { type: "string" },
        },
      }),
    ),
    result.flatMap((a) => {
      const parsed = optionsSchema.safeParse({ ...a.values, dir: a.positionals[0] });
      return parsed.success
        ? result.success(parsed.data)
        : result.failure(
            argError(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")),
          );
    }),
  );

// the static picture, DIR/chart.tex, where the engine tikz is asked for (version 1.6; @qi/chart's tikz.ts)
const picture = (
  o: {
    readonly dir: string;
    readonly level: "all" | number;
    readonly engine: readonly EngineName[];
    readonly range?: string | undefined;
  },
  r: {
    readonly components: Parameters<typeof tikzChart>[0];
    readonly pal: Palette;
    readonly picture: Resolved["picture"];
    readonly marks: Marks | undefined;
    // the K-lines of the picture the marks are of, where they are given
    readonly shown: readonly [number, number] | undefined;
  },
): Task<void, FileError | DataError> => {
  // the most K-lines it draws: beyond, TeX's memory, and a picture no reader can read
  const most = r.picture.most;
  if (!o.engine.includes("tikz")) return task.of(undefined);
  const ask = o.range ?? (r.shown === undefined ? "all" : `${r.shown[0]}-${r.shown[1]}`);
  const n = r.components.xAxis.length;
  const [a = 0, b = n - 1] = ask === "all" ? [0, n - 1] : ask.split("-").map(Number);
  const from = Math.max(0, Math.min(a, b));
  const to = Math.min(n - 1, Math.max(a, b));
  return from > to
    ? task.fromResult(result.failure(dataError(`the picture: no K-lines from ${a} to ${b}, of ${n}`)))
    : to - from + 1 > most
      ? task.fromResult(
          result.failure(
            dataError(
              `the picture: ${to - from + 1} K-lines, more than ${most}; give RANGE=FROM-TO (--range), positions`,
            ),
          ),
        )
      : pipe(
          task.fromResult(
            pipe(
              tikzChart(
                r.components,
                {
                  from,
                  to,
                  width: r.picture.width,
                  height: r.picture.height,
                  palette: r.pal,
                  theme: r.picture.theme,
                },
                o.level,
                r.marks?.layers ?? [],
              ),
              result.mapError((e) => dataError(`the picture: ${e.message}`)),
            ),
          ),
          task.flatMap((text) => write(join(o.dir, "chart.tex"), text)),
          task.flatMap((path) => say(`chart: written ${path}, K-lines ${from} to ${to}`)),
        );
};

// the tv engine's page, DIR/chart.html, where the engine tv is asked for
const tv = (
  o: {
    readonly dir: string;
    readonly engine: readonly EngineName[];
    readonly level: "all" | number;
    readonly periods?: string | undefined;
    readonly lib?: string | undefined;
    readonly "tv-engine"?: string | undefined;
    readonly bundle?: string | undefined;
  },
  r: {
    readonly input: PageInput;
    readonly components: Parameters<typeof tvChart>[0];
    readonly pal: Json;
    readonly source: string;
    readonly marks: Marks | undefined;
  },
): Task<void, FileError | ArgError | DataError> => {
  const lib = o.lib;
  const engine = o["tv-engine"];
  const bundle = o.bundle;
  return !o.engine.includes("tv") || lib === undefined || engine === undefined || bundle === undefined
    ? task.of(undefined)
    : pipe(
        task.all([read(lib), read(engine), read(bundle)]),
        task.flatMap(([ls = "", es = "", bs = ""]) =>
          task.fromResult(
            pipe(
              // made here as the page's script will make it, so a fault stops the command, not the page
              tvChart(r.components, o.level),
              result.mapError((e) => dataError(`the tv description: ${e.message}`)),
              result.flatMap(() =>
                pipe(
                  periods(o.periods, o.dir)("chart.html"),
                  result.mapError(argError),
                  result.map((ps) =>
                    page({
                      input: r.input,
                      bundle: bs,
                      source: r.source,
                      palette: r.pal,
                      periods: ps,
                      marks: r.marks,
                      lib: ls,
                      engine: es,
                    }),
                  ),
                ),
              ),
            ),
          ),
        ),
        task.flatMap((html) => write(join(o.dir, "chart.html"), html)),
        task.flatMap((path) => say(`chart: written ${path}, by the tv engine`)),
      );
};

// the d3fc engine's page, DIR/chart-d3fc.html, where the engine d3fc is asked for
const d3fc = (
  o: {
    readonly dir: string;
    readonly engine: readonly EngineName[];
    readonly level: "all" | number;
    readonly periods?: string | undefined;
    readonly d3?: string | undefined;
    readonly fc?: string | undefined;
    readonly "d3fc-engine"?: string | undefined;
    readonly bundle?: string | undefined;
  },
  r: {
    readonly input: PageInput;
    readonly components: Parameters<typeof d3fcChart>[0];
    readonly pal: Json;
    readonly source: string;
    readonly marks: Marks | undefined;
  },
): Task<void, FileError | ArgError | DataError> => {
  const d3 = o.d3;
  const fc = o.fc;
  const engine = o["d3fc-engine"];
  const bundle = o.bundle;
  return !o.engine.includes("d3fc") ||
    d3 === undefined ||
    fc === undefined ||
    engine === undefined ||
    bundle === undefined
    ? task.of(undefined)
    : pipe(
        task.all([read(d3), read(fc), read(engine), read(bundle)]),
        task.flatMap(([d3s = "", fcs = "", es = "", bs = ""]) =>
          task.fromResult(
            pipe(
              // made here as the page's script will make it, so a fault stops the command, not the page
              d3fcChart(r.components, o.level),
              result.mapError((e) => dataError(`the d3fc description: ${e.message}`)),
              result.flatMap(() =>
                pipe(
                  periods(o.periods, o.dir)("chart-d3fc.html"),
                  result.mapError(argError),
                  result.map((ps) =>
                    d3fcPage({
                      input: r.input,
                      bundle: bs,
                      source: r.source,
                      palette: r.pal,
                      periods: ps,
                      marks: r.marks,
                      d3: d3s,
                      fc: fcs,
                      engine: es,
                    }),
                  ),
                ),
              ),
            ),
          ),
        ),
        task.flatMap((html) => write(join(o.dir, "chart-d3fc.html"), html)),
        task.flatMap((path) => say(`chart: written ${path}, by the d3fc engine`)),
      );
};

const folder = (dir: string): Task<string | undefined, FileError> =>
  task.tryPromise(io("cannot make", dir))(() => mkdir(dir, { recursive: true }));

// a run of the results made: the set's file as it is, and meta.json, the set's name its source and its title where
// none is given; the text read first, so a file given at DIR/run.json is written back as it was
const ofResults = (
  dir: string,
  file: string,
  scale: number,
  title: string | undefined,
): Task<void, FileError> => {
  const set = basename(file, ".json");
  return pipe(
    read(file),
    task.flatMap((text) =>
      pipe(
        folder(dir),
        task.flatMap(() =>
          task.all([
            write(join(dir, "run.json"), text),
            write(join(dir, "meta.json"), `${JSON.stringify({ scale, source: set, title: title ?? set })}\n`),
          ]),
        ),
      ),
    ),
    task.map(() => undefined),
  );
};

// a run of bars alone made: in.csv and meta.json
const ofBars = (
  dir: string,
  input: string,
  request: string,
  title: string | undefined,
): Task<void, FileError | DataError> =>
  pipe(
    task.all([read(input), read(request)]),
    task.flatMap(([text = "", requestText = ""]) =>
      pipe(
        json(request)(requestText),
        task.flatMap((m) =>
          task.fromResult(
            pipe(
              decode(metaSchema)(m),
              result.mapError((e) => dataError(`${request}: ${e.message}`)),
              result.flatMap((meta) =>
                pipe(
                  parse(meta.scale)(text),
                  result.mapError((e) => dataError(`${input}: ${e.message}`)),
                  result.map((bars) => ({ meta, bars })),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
    task.flatMap(({ meta, bars }) =>
      pipe(
        folder(dir),
        task.flatMap(() =>
          task.all([
            write(join(dir, "in.csv"), barsFile(bars)),
            write(
              join(dir, "meta.json"),
              `${JSON.stringify({ ...meta, ...(title === undefined ? {} : { title }), bars: true })}\n`,
            ),
          ]),
        ),
      ),
    ),
    task.map(() => undefined),
  );

// the run made, where one is given (optionsSchema); nothing where none is (DIR is a run already made)
const made = (o: {
  readonly dir: string;
  readonly results?: string | undefined;
  readonly scale?: number | undefined;
  readonly input?: string | undefined;
  readonly request?: string | undefined;
  readonly title?: string | undefined;
}): Task<void, FileError | DataError> =>
  o.results !== undefined && o.scale !== undefined
    ? ofResults(o.dir, o.results, o.scale, o.title)
    : o.input !== undefined && o.request !== undefined
      ? ofBars(o.dir, o.input, o.request, o.title)
      : task.of(undefined);

// the settings and the palette, read and checked before a run is made, so a fault in them costs no run: every colour
// the settings name a name of the palette, or that part would not show
const shown = (o: {
  readonly config: string;
  readonly palette: string;
}): Task<{ readonly settings: Resolved; readonly pal: Palette }, FileError | DataError> =>
  pipe(
    task.all([read(o.config), read(o.palette)]),
    task.flatMap(([conf = "", palette = ""]) =>
      pipe(
        json(o.palette)(palette),
        task.flatMap((j) =>
          task.fromResult(
            pipe(
              decode(paletteSchema)(j),
              result.mapError((e) => dataError(`${o.palette}: ${e.message}`)),
              result.flatMap((pal) =>
                pipe(
                  config.fromText(settingsSchema)(conf),
                  result.flatMap(resolved),
                  result.mapError((e) => dataError(`${o.config}: ${e.message}`)),
                  result.flatMap((settings) => {
                    const unknown = coloursOf(settings).filter((c) => pal[c] === undefined);
                    return unknown.length === 0
                      ? result.success({ settings, pal })
                      : result.failure(
                          dataError(`${o.config}: ${unknown.join(", ")} not in the palette ${o.palette}`),
                        );
                  }),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );

// the page's marks, where --marks gives a file of them (marks.ts), on the run's K-lines
const marked = (
  path: string | undefined,
  xs: XAxis,
  scale: number,
  pal: Palette,
): Task<
  { readonly marks: Marks | undefined; readonly shown: readonly [number, number] | undefined },
  FileError | DataError
> =>
  path === undefined
    ? task.of({ marks: undefined, shown: undefined })
    : pipe(
        read(path),
        task.flatMap(json(path)),
        task.flatMap((v) =>
          task.fromResult(
            pipe(
              lean(v),
              result.flatMap((p) =>
                pipe(
                  marksOf(xs, scale)(p),
                  result.flatMap((marks) =>
                    result.map((shown: readonly [number, number]) => ({ marks, shown }))(pictureShown(xs)(p)),
                  ),
                ),
              ),
              result.mapError((e) => dataError(e.message)),
              // every colour the marks name, one of the palette's, as the settings' are
              result.flatMap((m) => {
                const unknown = [
                  ...new Set((m.marks.layers ?? []).flatMap((l) => l.marks.map((x) => x.colour))),
                ].filter((c) => pal[c] === undefined);
                return unknown.length === 0
                  ? result.success(m)
                  : result.failure(dataError(`${path}: ${unknown.join(", ")} not in the palette`));
              }),
            ),
          ),
        ),
      );

const main = pipe(
  task.fromResult(args(process.argv.slice(2))),
  task.flatMap((o) =>
    pipe(
      shown(o),
      task.flatMap((s) =>
        pipe(
          made(o),
          task.map(() => ({ ...o, ...s })),
        ),
      ),
    ),
  ),
  task.flatMap((o) =>
    pipe(
      read(join(o.dir, "meta.json")),
      task.flatMap((text) => json(join(o.dir, "meta.json"))(text)),
      task.flatMap((v) =>
        task.fromResult(
          pipe(
            decode(metaSchema)(v),
            result.mapError((e) => dataError(`meta.json: ${e.message}`)),
          ),
        ),
      ),
      // a run of bars only: its bars (in.csv); a run of the results: the set's file (run.json)
      task.flatMap((meta) =>
        pipe(
          task.all([
            read(join(o.dir, meta.bars === true ? "in.csv" : "run.json")),
            optional(join(o.dir, "history.csv")),
          ]),
          task.map(([text = "", hist = ""]) => ({ meta, text, hist })),
        ),
      ),
      task.flatMap(({ meta, text, hist }) =>
        pipe(
          task.of(meta),
          task.flatMap((m) =>
            pipe(
              task.of(o.pal),
              task.flatMap((pal) =>
                task.fromResult(
                  pipe(
                    m.bars === true ? barsOf(text) : runOf(join(o.dir, "run.json"))(text),
                    // the page's input: the components as read, the closes before the run's first K-line (the
                    // add-ons start from them where it has them), the settings, every value
                    // the page's window, where one is asked: the structure is the whole series' (window.ts)
                    result.flatMap((whole) =>
                      pipe(
                        history(hist),
                        result.mapError((e) => dataError(e.message)),
                        result.flatMap((h) =>
                          o.window === undefined
                            ? result.success({ structure: whole, history: h })
                            : pipe(
                                windowOf(o.window),
                                result.flatMap((w) =>
                                  span(
                                    whole.xs.map((k) => k.date),
                                    w,
                                  ),
                                ),
                                result.map(([a, b]) => windowed(a, b)(whole, h)),
                                result.mapError((e) => dataError(e.message)),
                              ),
                        ),
                      ),
                    ),
                    result.flatMap(({ structure: v, history: before }) =>
                      pipe(
                        result.success(before),
                        result.map(
                          (before): PageInput => ({
                            title: o.title ?? m.title ?? basename(o.dir),
                            scale: m.scale,
                            level: o.level,
                            settings: everyValue(o.settings),
                            history: before,
                            xAxis: v.xs,
                            merged: v.ms,
                            fractals: v.fs,
                            strokes: v.bs,
                            duan: v.ds,
                            zoushi: v.zs,
                            zhongshu: v.zh,
                            ...(o.online === undefined ? {} : { online: o.online }),
                          }),
                        ),
                        // an online page: of a run of bars alone, with K-lines before the N that come one at a time
                        result.flatMap((input: PageInput) =>
                          input.online === undefined || (m.bars === true && input.online < input.xAxis.length)
                            ? result.success(input)
                            : result.failure(
                                dataError(
                                  `--online ${input.online}: an online page is of a run of bars alone, N fewer than its ${input.xAxis.length} K-lines`,
                                ),
                              ),
                        ),
                        result.map((input) => ({ ...v, input })),
                      ),
                    ),
                    // the components from it, as the page's script makes them
                    result.flatMap(({ xs, ms, fs, bs, ds, input }) =>
                      pipe(
                        // an online page's, of its history (describe.ts)
                        components(historyOf(input)),
                        result.mapError((e) => dataError(`the settings: ${e.message}`)),
                        result.map((c) => ({
                          input,
                          components: c,
                          pal,
                          picture: o.settings.picture,
                          source:
                            m.bars === true
                              ? m.source
                              : `${m.source}; the structure from the published results`,
                          xs,
                          ms,
                          fs,
                          bs,
                          ds,
                        })),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
          task.flatMap((r) =>
            pipe(
              marked(o.marks, r.xs, r.input.scale, r.pal),
              task.map((m) => ({ ...r, ...m })),
            ),
          ),
          task.flatMap((r) =>
            pipe(
              say(
                `chart: ${o.dir}: ${r.xs.length} K-lines, ${r.ms.length} merged bars ` +
                  `(${r.ms.filter((x) => x.endDate > x.startDate).length} of two K-lines or more), ` +
                  `${r.ms.filter((x) => x.confirmEndDate === undefined).length} not yet confirmed; ${r.fs.length} 分型 ` +
                  `(${r.fs.filter((x) => x.ding).length} tops, ${r.fs.filter((x) => x.turningpoint).length} 拐点); ${r.bs.length} 笔, ${r.ds.length} 线段; ` +
                  `${r.components.zoushi.length} 走势, ${r.components.zhongshu.length} 中枢; ` +
                  `add-ons: ${r.components.addons.map((a) => a.name).join(", ")}`,
              ),
              task.flatMap(() => tv(o, r)),
              task.flatMap(() => d3fc(o, r)),
              task.flatMap(() => picture(o, r)),
            ),
          ),
        ),
      ),
    ),
  ),
);

task.run(main).then(
  result.match(
    () => undefined,
    (e: QiError) => {
      console.error(`chart: ${error.show(e)}`);
      process.exit(1);
    },
  ),
);
