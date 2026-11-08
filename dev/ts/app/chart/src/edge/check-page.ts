/// <reference types="node" />
// The pages' check (docs/designs/design-chart-lib-2026-10-24.md, Version 1.7, step 2): `check-page.ts PAGE…`, each a
// page the command wrote (chart.html, chart-d3fc.html). From each, its input and the app's script as the page carries
// them, the script's text as it is in the page; the script run on that input, in a context of its own, by Bun's
// JavaScript engine, not a browser's (a browser's engine may round a power, ema's, in its last bit otherwise); its
// description (CHART, and LAYERS for tv) compared with one made again from the same input by the functions the
// command uses (describe.ts, tvChart, d3fcChart). One page after another; a line for each when all agree; exit 1 at
// the first that differs or cannot be read, or where no page is given.

import { readFile } from "node:fs/promises";
import { createContext, runInContext } from "node:vm";
import { error, pipe, type QiError, type Result, result, type Task, task } from "@qi/base";
import { d3fcChart, tvChart } from "@qi/chart";
import { components, historyOf, pageInput } from "../describe.ts";

type CheckError = QiError<"CHECK_PAGE", "VALIDATION">;
const fault = (message: string): CheckError => ({
  category: "VALIDATION",
  code: "CHECK_PAGE",
  message,
  context: {},
});

// the page's input and engine, and its scripts, as written by page.ts
const parts = (
  html: string,
): Result<
  { readonly input: unknown; readonly engine: string; readonly scripts: readonly string[] },
  QiError
> => {
  const data = /<script>globalThis\.INPUT = (.*);\nglobalThis\.ENGINE = "(tv|d3fc)";/s.exec(html);
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1] ?? "");
  return data === null || data[1] === undefined || data[2] === undefined
    ? result.failure(fault("no INPUT and ENGINE in it"))
    : pipe(
        result.tryCatch(error.fromUnknown("VALIDATION"))(() => JSON.parse(data[1] ?? "") as unknown),
        result.map((input) => ({ input, engine: data[2] ?? "", scripts })),
      );
};

// what the page's own script gives the engine, run on the page's input
const inBrowser = (
  engine: string,
  input: unknown,
  scripts: readonly string[],
): Result<Readonly<Record<string, unknown>>, QiError> => {
  // the app's script is the one that reads INPUT: the script after the page's data
  const at = scripts.findIndex((s) => s.startsWith("globalThis.INPUT = "));
  const bundle = scripts[at + 1];
  return at < 0 || bundle === undefined
    ? result.failure(fault("no app's script after the page's data"))
    : result.tryCatch(error.fromUnknown("VALIDATION"))(() => {
        const context = createContext({ INPUT: input, ENGINE: engine, console });
        runInContext(bundle, context);
        const got = context as Record<string, unknown>;
        return engine === "tv" ? { CHART: got.CHART, LAYERS: got.LAYERS } : { CHART: got.CHART };
      });
};

// what the command makes from the same input (an online page's, of its history)
const byCommand = (engine: string, input: unknown): Result<Readonly<Record<string, unknown>>, QiError> =>
  pipe(
    pageInput(input),
    result.flatMap((i) =>
      pipe(
        components(historyOf(i)),
        result.flatMap(
          (c): Result<Readonly<Record<string, unknown>>, QiError> =>
            engine === "tv"
              ? result.map((d: { readonly chart: unknown; readonly layers: unknown }) => ({
                  CHART: d.chart,
                  LAYERS: d.layers,
                }))(tvChart(c, i.level))
              : result.map((chart: unknown) => ({ CHART: chart }))(d3fcChart(c, i.level)),
        ),
      ),
    ),
  );

const check = (path: string): Task<string, QiError> =>
  pipe(
    task.tryPromise(error.fromUnknown("SYSTEM"))(() => readFile(path, "utf8")),
    task.flatMap((html) =>
      task.fromResult(
        pipe(
          parts(html),
          result.flatMap((p) =>
            pipe(
              inBrowser(p.engine, p.input, p.scripts),
              result.flatMap((b) =>
                pipe(
                  byCommand(p.engine, p.input),
                  result.flatMap((c) =>
                    JSON.stringify(b) === JSON.stringify(c)
                      ? result.success(
                          `check-page: ${path}: the same (${p.engine}, ${html.length.toLocaleString("en")} bytes)`,
                        )
                      : result.failure(fault("the page's description differs from the command's")),
                  ),
                ),
              ),
            ),
          ),
          result.mapError((e) => fault(`${path}: ${e.message}`)),
        ),
      ),
    ),
  );

const pages = process.argv.slice(2);

const main = pipe(
  pages.length === 0 ? task.fail(fault("no pages given: none checked")) : task.sequence(pages.map(check)),
  task.flatMap((lines) =>
    task.tryPromise(error.fromUnknown("SYSTEM"))(() => Promise.resolve(console.log(lines.join("\n")))),
  ),
);

task.run(main).then(
  result.match(
    () => undefined,
    (e: QiError) => {
      console.error(`check-page: ${e.message}`);
      process.exit(1);
    },
  ),
);
