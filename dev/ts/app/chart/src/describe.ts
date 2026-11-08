// What a page carries and what is made from it (docs/designs/design-chart-lib-2026-10-24.md, Version 1.7, step 2): the
// page carries its inputs, not the engines' descriptions: the components as read (read.ts), the closes before the
// run's first K-line, the scale, the title, the settings (every value, as everyValue gives them) and the levels ticked
// at first. `components` makes the chart's components from them, the add-ons by the settings (indicators.ts); the
// command (src/edge/main.ts) and the page's script (src/edge/browser.ts) both call it, then the same engine's function
// (tvChart, d3fcChart), so the browser draws what the command would.

import { type QiError, type Result, result } from "@qi/base";
import { runSchema } from "@qi/chanlun";
import type { Components, KLines, XAxis } from "@qi/chart";
import type { KLine, OngoingKLine } from "@qi/market";
import { z } from "zod";
import { indicators } from "./indicators.ts";
import { axisSchema } from "./read.ts";
import { type Resolved, resolved, type SettingsError, settingsSchema } from "./settings.ts";

export const pageInputSchema = z
  .object({
    title: z.string().min(1),
    scale: z.number().int().positive(),
    // the levels ticked at first: all, or a level's number
    level: z.union([z.literal("all"), z.number().int().nonnegative()]),
    settings: settingsSchema,
    // the closes before the run's first K-line, at the scale (history.csv; none where the run has none)
    history: z.array(z.number().int()).readonly(),
    xAxis: axisSchema,
    // 缠论's records over the bars, a run of the contract (read.ts); a run of no record for bars alone
    run: runSchema,
    // an online page (docs/designs/design-chart-online-2026-11-08.md, What changes for the chart app): all but the last
    // N K-lines drawn whole, then those N one at a time (src/edge/browser.ts)
    online: z.number().int().positive().optional(),
  })
  .strict();
export type PageInput = z.output<typeof pageInputSchema>;

export type PageInputError = QiError<"CHART_INPUT", "VALIDATION">;

// a page's input, read where it enters: in the browser, the page's own; where it is made, what the command built
export const pageInput = (v: unknown): Result<PageInput, PageInputError> => {
  const parsed = pageInputSchema.safeParse(v);
  return parsed.success
    ? result.success(parsed.data)
    : result.failure({
        category: "VALIDATION",
        code: "CHART_INPUT",
        message: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
        context: {},
      });
};

// A whole number at a scale, a power of ten, as the decimal it stands for: its digits exactly (the market data's
// contract gives a price back as its digits)
const decimal = (n: number, scale: number): number => {
  const digits = String(scale).length - 1;
  const text = String(Math.abs(n)).padStart(digits + 1, "0");
  const whole = text.slice(0, text.length - digits);
  const fraction = text.slice(text.length - digits).replace(/0+$/, "");
  return Number(`${n < 0 ? "-" : ""}${whole}${fraction === "" ? "" : `.${fraction}`}`);
};

// The K-lines as the library takes them, market's (docs/designs/design-chart-online-2026-11-08.md, What changes for
// the chart app): a run's bars, each an index from 0 (its place, as a run's positions name it), its date in
// milliseconds, its prices as decimals at the scale, its volume as the run keeps it, so the library makes the same bars
// of them.
export const klinesOf = (xs: XAxis, scale: number): KLines =>
  xs.map((k, index) => ({
    index,
    date: k.date * 1000,
    open: decimal(k.open, scale),
    high: decimal(k.high, scale),
    low: decimal(k.low, scale),
    close: decimal(k.close, scale),
    volume: k.volume,
  }));

// The chart's components from a page's input: the settings over their defaults, the add-ons by them.
export const components = (i: PageInput): Result<Components, SettingsError> =>
  result.map(
    (r: Resolved): Components => ({
      title: i.title,
      scale: i.scale,
      options: r.chart,
      xAxis: klinesOf(i.xAxis, i.scale),
      run: i.run,
      addons: indicators(r)(i.scale, i.history),
    }),
  )(resolved(i.settings));

// The online page (docs/designs/design-chart-online-2026-11-08.md, What changes for the chart app): its history, all
// but its last N K-lines, drawn whole; then each of the N given to the online component as market's records, ongoing
// K-lines that reach its values (its open; its body; the whole of it) and then the complete one. A page that is not
// online is its history.
export const historyOf = (i: PageInput): PageInput =>
  i.online === undefined ? i : { ...i, xAxis: i.xAxis.slice(0, i.xAxis.length - i.online) };

export type Coming = { readonly complete: KLine } | { readonly forming: OngoingKLine };
const comingOf = (k: KLine): readonly Coming[] => {
  const at = (seconds: number): number => k.date + seconds * 1000;
  return [
    { forming: { ...k, high: k.open, low: k.open, close: k.open, volume: 0, asOf: at(15) } },
    {
      forming: {
        ...k,
        high: Math.max(k.open, k.close),
        low: Math.min(k.open, k.close),
        volume: 0,
        asOf: at(30),
      },
    },
    { forming: { ...k, asOf: at(45) } },
    { complete: k },
  ];
};
export const comingFor = (i: PageInput): readonly Coming[] =>
  klinesOf(i.xAxis, i.scale)
    .slice(i.xAxis.length - (i.online ?? 0))
    .flatMap(comingOf);
